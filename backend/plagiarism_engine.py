"""
plagiarism_engine.py  —  Authentiq Plagiarism Engine (v3)
==========================================================
Improvements over v2
---------------------
1. **Sliding-window chunking** — long documents are split into overlapping
   128-token windows and scored independently, then aggregated. This catches
   plagiarism in the middle of a paragraph that a sentence-split would miss.

2. **Source attribution** — each match carries a source_id that maps back to
   the original submission, enabling "previously submitted by user X on date Y"
   style reporting (like Turnitin).

3. **Similarity distribution statistics** — max, mean, median similarity across
   all sentences. Turnitin shows the full distribution, not just flagged count.

4. **PostgreSQL migration shim** — if POSTGRES_DSN is set, submissions are
   written to Postgres + pgvector instead of flat files. The flat-file path
   remains for zero-config local use.

5. **Chunk deduplication** — identical sentences are only checked once,
   reducing both latency and index pressure.

6. **Configurable threshold** — SIMILARITY_THRESHOLD can be set per-request
   (within a safe 0.60–0.95 range) for strict vs. lenient mode.
"""

import os
import re
import time
import threading
import uuid
from datetime import datetime
from typing import Optional

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

# ─── Model ────────────────────────────────────────────────────────────────────
print("[plagiarism] Loading SentenceTransformer model...")
MODEL = SentenceTransformer("all-MiniLM-L6-v2")
print("[plagiarism] Model loaded.")

CORPUS_FILE          = os.path.join(os.path.dirname(__file__), "sample_corpus.txt")
SUBMISSIONS_FILE     = os.path.join(os.path.dirname(__file__), "submissions.txt")
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.75"))
MAX_TEXT_CHARS       = 50_000
CHUNK_SIZE           = 128    # tokens per sliding window
CHUNK_OVERLAP        = 32     # overlap between windows
MIN_CHUNK_WORDS      = 8      # discard very short chunks

# ─── Thread safety ────────────────────────────────────────────────────────────
_lock       = threading.RLock()
_corpus: list[str]              = []
_source_ids: list[Optional[str]] = []   # parallel list: source ID per corpus entry
_index      = None
_embeddings = None

# ─── Debounced rebuild ────────────────────────────────────────────────────────
_last_rebuild: float = 0.0
_REBUILD_COOLDOWN    = 5.0
_pending_sentences: list[tuple[str, Optional[str]]] = []
_pending_lock        = threading.Lock()


def _flush_pending():
    global _pending_sentences
    with _pending_lock:
        if not _pending_sentences:
            return
        with open(SUBMISSIONS_FILE, "a", encoding="utf-8") as f:
            for sentence, src_id in _pending_sentences:
                tag = f"\t{src_id}" if src_id else ""
                f.write(sentence + tag + "\n")
        _pending_sentences = []


def _do_rebuild():
    global _corpus, _source_ids, _index, _embeddings, _last_rebuild
    lines, source_ids = [], []

    for path in [CORPUS_FILE, SUBMISSIONS_FILE]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.rstrip("\n")
                    if "\t" in line:
                        parts    = line.split("\t", 1)
                        text_    = parts[0].strip()
                        src_id_  = parts[1].strip() if len(parts) > 1 else None
                    else:
                        text_   = line.strip()
                        src_id_ = None
                    if text_:
                        lines.append(text_)
                        source_ids.append(src_id_)

    _corpus     = lines
    _source_ids = source_ids

    if not lines:
        _index = _embeddings = None
        return

    emb = MODEL.encode(lines, show_progress_bar=False, normalize_embeddings=True)
    dim = emb.shape[1]
    idx = faiss.IndexFlatIP(dim)
    idx.add(emb.astype(np.float32))
    _index      = idx
    _embeddings = emb
    _last_rebuild = time.time()


def rebuild_index(force: bool = False):
    global _last_rebuild
    if not force and (time.time() - _last_rebuild) < _REBUILD_COOLDOWN:
        return
    _flush_pending()
    with _lock:
        _do_rebuild()


def warmup():
    rebuild_index(force=True)
    MODEL.encode(["warmup"], show_progress_bar=False, normalize_embeddings=True)
    print(f"[plagiarism] Warmup complete. Corpus size: {len(_corpus)}")


rebuild_index(force=True)


# ─── Chunking ─────────────────────────────────────────────────────────────────

def sliding_window_chunks(text: str) -> list[str]:
    """
    Split text into overlapping word-based chunks.
    This catches mid-paragraph plagiarism that sentence splitting misses.
    Returns deduplicated chunk list.
    """
    words  = text.split()
    chunks = []
    seen   = set()
    step   = CHUNK_SIZE - CHUNK_OVERLAP

    for start in range(0, max(1, len(words) - MIN_CHUNK_WORDS + 1), step):
        chunk = " ".join(words[start : start + CHUNK_SIZE])
        if len(chunk.split()) < MIN_CHUNK_WORDS:
            continue
        key = chunk[:80]
        if key not in seen:
            seen.add(key)
            chunks.append(chunk)

    return chunks


def split_sentences(text: str) -> list[str]:
    raw = re.split(r'(?<=[.!?])\s+', text.strip()[:MAX_TEXT_CHARS])
    seen, result = set(), []
    for s in raw:
        s = s.strip()
        if len(s) > 15 and s not in seen:
            seen.add(s)
            result.append(s)
    return result


def cosine_sim_to_percent(score: float) -> int:
    return max(0, min(100, int(round(score * 100))))


# ─── Web Search ───────────────────────────────────────────────────────────────

def fetch_web_snippets(query: str) -> list[str]:
    api_key = os.getenv("SERPAPI_KEY")
    if not api_key:
        return []
    try:
        import requests
        resp = requests.get(
            "https://serpapi.com/search",
            params={"q": query, "api_key": api_key, "num": 5, "engine": "google"},
            timeout=5
        )
        if resp.status_code != 200:
            return []
        return [r.get("snippet", "") for r in resp.json().get("organic_results", []) if r.get("snippet")]
    except Exception as e:
        print(f"[plagiarism] Web search failed: {e}")
        return []


# ─── PostgreSQL migration shim ────────────────────────────────────────────────

def _pg_store(sentences: list[str], source_id: str) -> bool:
    """
    Store sentences in PostgreSQL + pgvector if POSTGRES_DSN is configured.
    Falls back silently — flat files remain the source of truth unless PG is set.
    """
    dsn = os.getenv("POSTGRES_DSN")
    if not dsn:
        return False
    try:
        import psycopg2
        import psycopg2.extras
        embs = MODEL.encode(sentences, normalize_embeddings=True)
        conn = psycopg2.connect(dsn)
        cur  = conn.cursor()
        rows = [(str(uuid.uuid4()), s, embs[i].tolist(), source_id)
                for i, s in enumerate(sentences)]
        psycopg2.extras.execute_values(
            cur,
            "INSERT INTO submission_chunks (id, text, embedding, source_id) VALUES %s ON CONFLICT DO NOTHING",
            rows,
        )
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[plagiarism] PG store failed (non-fatal): {e}")
        return False


# ─── Main Check ───────────────────────────────────────────────────────────────

def check_plagiarism(
    text: str,
    use_web: bool = False,
    threshold: Optional[float] = None,
) -> dict:
    start = time.time()

    # Clamp threshold to safe range
    sim_threshold = max(0.60, min(0.95, threshold or SIMILARITY_THRESHOLD))

    sentences = split_sentences(text)
    chunks    = sliding_window_chunks(text)

    if not sentences:
        return {
            "plagiarism_score": 0, "originality_score": 100,
            "matches": [], "sentence_results": [],
            "chunk_results": [],
            "total_sentences": 0, "flagged_sentences": 0,
            "similarity_stats": {"max": 0, "mean": 0, "median": 0},
            "processing_ms": 0, "corpus_size": len(_corpus),
            "web_checked": False, "threshold_used": sim_threshold,
        }

    # ── Sentence-level scoring ──
    input_embeddings = MODEL.encode(
        sentences, show_progress_bar=False, normalize_embeddings=True
    ).astype(np.float32)

    sentence_results = []
    matches = []

    with _lock:
        local_index  = _index
        local_corpus = list(_corpus)
        local_srcs   = list(_source_ids)

    if local_index is not None and local_corpus:
        scores, indices = local_index.search(input_embeddings, k=1)
        for i, sentence in enumerate(sentences):
            sim          = float(scores[i][0])
            idx_         = int(indices[i][0])
            matched_text = local_corpus[idx_] if idx_ >= 0 else ""
            source_id    = local_srcs[idx_]   if idx_ >= 0 else None
            sim_pct      = cosine_sim_to_percent(sim)
            flagged      = sim > sim_threshold
            result = {
                "sentence":     sentence,
                "similarity":   sim_pct,
                "matched_text": matched_text,
                "source_id":    source_id,
                "source":       "corpus",
                "flagged":      flagged,
            }
            sentence_results.append(result)
            if flagged:
                matches.append(result)

    # ── Chunk-level scoring (catches mid-paragraph plagiarism) ──
    chunk_results = []
    if local_index is not None and local_corpus and chunks:
        chunk_embeddings = MODEL.encode(
            chunks, show_progress_bar=False, normalize_embeddings=True
        ).astype(np.float32)
        c_scores, c_indices = local_index.search(chunk_embeddings, k=1)
        for i, chunk in enumerate(chunks):
            sim   = float(c_scores[i][0])
            idx_  = int(c_indices[i][0])
            if sim > sim_threshold:
                chunk_results.append({
                    "chunk":        chunk[:200] + ("…" if len(chunk) > 200 else ""),
                    "similarity":   cosine_sim_to_percent(sim),
                    "matched_text": local_corpus[idx_] if idx_ >= 0 else "",
                    "source_id":    local_srcs[idx_]   if idx_ >= 0 else None,
                    "flagged":      True,
                })

    # ── Web search ──
    web_checked = False
    if use_web and os.getenv("SERPAPI_KEY"):
        web_checked = True
        top = sorted(sentence_results, key=lambda x: x["similarity"], reverse=True)[:3]
        for s in top:
            snippets = fetch_web_snippets(s["sentence"][:100])
            if not snippets:
                continue
            snip_emb = MODEL.encode(snippets, normalize_embeddings=True).astype(np.float32)
            sent_emb = MODEL.encode([s["sentence"]], normalize_embeddings=True).astype(np.float32)
            sims     = (snip_emb @ sent_emb.T).flatten()
            best_idx = int(np.argmax(sims))
            best_sim = float(sims[best_idx])
            if best_sim > 0.70:
                web_result = {
                    "sentence":     s["sentence"],
                    "similarity":   cosine_sim_to_percent(best_sim),
                    "matched_text": snippets[best_idx],
                    "source_id":    "web",
                    "source":       "web",
                    "flagged":      True,
                }
                for idx, r in enumerate(sentence_results):
                    if r["sentence"] == s["sentence"] and best_sim > r["similarity"] / 100:
                        sentence_results[idx] = web_result
                if web_result not in matches:
                    matches.append(web_result)

    flagged_count    = sum(1 for r in sentence_results if r["flagged"])
    plagiarism_score = round((flagged_count / len(sentences)) * 100, 1) if sentences else 0

    # ── Similarity statistics ──
    all_sims = [r["similarity"] for r in sentence_results]
    sim_stats = {
        "max":    max(all_sims) if all_sims else 0,
        "mean":   round(float(np.mean(all_sims)), 1) if all_sims else 0,
        "median": round(float(np.median(all_sims)), 1) if all_sims else 0,
    }

    return {
        "plagiarism_score":    plagiarism_score,
        "originality_score":   round(100 - plagiarism_score, 1),
        "matches":             matches,
        "sentence_results":    sentence_results,
        "chunk_results":       chunk_results,
        "total_sentences":     len(sentences),
        "flagged_sentences":   flagged_count,
        "similarity_stats":    sim_stats,
        "processing_ms":       round((time.time() - start) * 1000),
        "corpus_size":         len(local_corpus),
        "web_checked":         web_checked,
        "threshold_used":      sim_threshold,
    }


# ─── Store Submission ─────────────────────────────────────────────────────────

def store_submission(text: str, source_id: Optional[str] = None) -> str:
    """
    Append to corpus. Returns the source_id so callers can track provenance.
    If POSTGRES_DSN is set, also writes to pgvector.
    In production: Postgres + pgvector replaces flat files entirely.
    """
    sentences = split_sentences(text)
    if not sentences:
        return source_id or ""

    sid = source_id or str(uuid.uuid4())

    # Try Postgres first
    pg_ok = _pg_store(sentences, sid)

    # Always write to flat files as fallback
    with _pending_lock:
        for s in sentences:
            _pending_sentences.append((s, sid))

    rebuild_index()
    return sid
