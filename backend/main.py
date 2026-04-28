import asyncio
import io
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from plagiarism_engine import check_plagiarism, store_submission, warmup as plagiarism_warmup
from ai_detector import detect_ai, warmup as ai_warmup

# ─── Rate Limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])

# ─── Allowed origins ──────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8080,http://localhost:5173,http://127.0.0.1:8080"
).split(",")

# ─── Optional API key auth ────────────────────────────────────────────────────
_API_KEY = os.getenv("AUTHENTIQ_API_KEY")   # if set, all endpoints require this key

def _check_api_key(x_api_key: Optional[str]):
    """If AUTHENTIQ_API_KEY env var is set, validate it. No-op otherwise."""
    if _API_KEY and x_api_key != _API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")

# ─── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[startup] Warming up models...")
    plagiarism_warmup()
    ai_warmup()
    print("[startup] Models ready. Accepting requests.")
    yield
    print("[shutdown] Shutting down.")

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Authentiq API",
    description="Real AI originality detection — plagiarism + AI content scoring",
    version="3.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "X-Api-Key"],
)

# ─── Timeout helper ───────────────────────────────────────────────────────────
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))

async def run_with_timeout(coro, timeout: int = REQUEST_TIMEOUT):
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail=f"Analysis timed out after {timeout}s. Try shorter text."
        )

# ─── Schemas ─────────────────────────────────────────────────────────────────
class TextPayload(BaseModel):
    text: str = Field(..., min_length=10, max_length=50_000)
    use_web: bool = Field(False)
    store: bool = Field(True)
    threshold: Optional[float] = Field(None, ge=0.60, le=0.95,
        description="Plagiarism similarity threshold (0.60–0.95). Default: 0.75")
    source_id: Optional[str] = Field(None, max_length=128,
        description="Optional ID to tag this submission for source attribution")

class BatchItem(BaseModel):
    id: str = Field(..., description="Client-supplied ID for this item")
    text: str = Field(..., min_length=10, max_length=50_000)

class BatchPayload(BaseModel):
    items: list[BatchItem] = Field(..., min_length=1, max_length=10,
        description="Up to 10 texts to analyse in one request")
    use_web: bool = Field(False)
    store: bool = Field(True)

class SubmitPayload(BaseModel):
    text: str = Field(..., min_length=10, max_length=50_000)
    source_id: Optional[str] = Field(None, max_length=128)

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "3.0.0",
        "web_search_enabled": bool(os.getenv("SERPAPI_KEY")),
        "api_key_required": bool(_API_KEY),
        "rate_limit": "30/minute per IP",
        "postgres_enabled": bool(os.getenv("POSTGRES_DSN")),
    }


@app.post("/check-plagiarism")
@limiter.limit("20/minute")
async def plagiarism_endpoint(
    request: Request,
    payload: TextPayload,
    x_api_key: Optional[str] = Header(None),
):
    _check_api_key(x_api_key)
    async def _run():
        result = check_plagiarism(payload.text, use_web=payload.use_web, threshold=payload.threshold)
        if payload.store:
            result["source_id"] = store_submission(payload.text, payload.source_id)
        return result
    return await run_with_timeout(_run())


@app.post("/check-ai")
@limiter.limit("20/minute")
async def ai_endpoint(
    request: Request,
    payload: TextPayload,
    x_api_key: Optional[str] = Header(None),
):
    _check_api_key(x_api_key)
    async def _run():
        return detect_ai(payload.text)
    return await run_with_timeout(_run())


@app.post("/check-full")
@limiter.limit("15/minute")
async def full_check_endpoint(
    request: Request,
    payload: TextPayload,
    x_api_key: Optional[str] = Header(None),
):
    _check_api_key(x_api_key)
    async def _run():
        start = time.time()
        plagiarism_result = check_plagiarism(
            payload.text, use_web=payload.use_web, threshold=payload.threshold
        )
        ai_result = detect_ai(payload.text)
        source_id = None
        if payload.store:
            source_id = store_submission(payload.text, payload.source_id)
        combined_originality = round(
            plagiarism_result["originality_score"] * 0.60 +
            ai_result["human_probability"] * 0.40
        )
        return {
            "combined_originality_score": combined_originality,
            "plagiarism":                 plagiarism_result,
            "ai_detection":               ai_result,
            "source_id":                  source_id,
            "total_processing_ms":        round((time.time() - start) * 1000),
        }
    return await run_with_timeout(_run(), timeout=60)


@app.post("/check-batch")
@limiter.limit("5/minute")
async def batch_check_endpoint(
    request: Request,
    payload: BatchPayload,
    x_api_key: Optional[str] = Header(None),
):
    """
    Analyse up to 10 texts in a single request.
    Results are returned in the same order as the input items.
    Each item runs full plagiarism + AI detection independently.
    Total timeout: 120 seconds for the whole batch.
    """
    _check_api_key(x_api_key)

    async def _run_one(item: BatchItem):
        try:
            plag   = check_plagiarism(item.text, use_web=payload.use_web)
            ai_res = detect_ai(item.text)
            src    = None
            if payload.store:
                src = store_submission(item.text)
            combined = round(
                plag["originality_score"] * 0.60 +
                ai_res["human_probability"] * 0.40
            )
            return {
                "id":      item.id,
                "status":  "ok",
                "combined_originality_score": combined,
                "plagiarism":  plag,
                "ai_detection": ai_res,
                "source_id": src,
            }
        except Exception as exc:
            return {"id": item.id, "status": "error", "detail": str(exc)}

    async def _run_all():
        tasks = [_run_one(item) for item in payload.items]
        return await asyncio.gather(*tasks)

    return await run_with_timeout(_run_all(), timeout=120)


@app.post("/upload-pdf")
@limiter.limit("10/minute")
async def upload_pdf_endpoint(
    request: Request,
    file: UploadFile = File(...),
    use_web: bool = False,
    store: bool = True,
    x_api_key: Optional[str] = Header(None),
):
    _check_api_key(x_api_key)

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF must be under 10MB.")

    try:
        import pypdf
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed.")

    contents = await file.read()
    reader   = pypdf.PdfReader(io.BytesIO(contents))
    text     = "\n".join(page.extract_text() or "" for page in reader.pages).strip()

    if len(text) < 10:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF.")

    async def _run():
        start  = time.time()
        plag   = check_plagiarism(text, use_web=use_web)
        ai_res = detect_ai(text)
        src    = None
        if store:
            src = store_submission(text)
        combined = round(
            plag["originality_score"] * 0.60 +
            ai_res["human_probability"] * 0.40
        )
        return {
            "filename":                  file.filename,
            "extracted_text_length":     len(text),
            "combined_originality_score": combined,
            "plagiarism":                plag,
            "ai_detection":              ai_res,
            "source_id":                 src,
            "total_processing_ms":       round((time.time() - start) * 1000),
        }
    return await run_with_timeout(_run(), timeout=60)


@app.post("/submit")
@limiter.limit("30/minute")
async def submit_endpoint(
    request: Request,
    payload: SubmitPayload,
    x_api_key: Optional[str] = Header(None),
):
    _check_api_key(x_api_key)
    source_id = store_submission(payload.text, payload.source_id)
    return {
        "status":    "stored",
        "source_id": source_id,
        "message":   "Text added to comparison corpus.",
    }
