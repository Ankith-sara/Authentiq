# Authentiq

**Real-time AI content and plagiarism detection — no mocks, no hardcoded scores.**

Authentiq is a full-stack originality checker that combines semantic plagiarism detection with multi-model AI content scoring. It is built as a React + TypeScript frontend backed by a Python FastAPI service, with Supabase handling authentication, user data, and vector similarity search.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Backend API Reference](#backend-api-reference)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)

---

## Overview

Authentiq analyses text or PDF uploads and returns two independent signals combined into a single **originality score**:

| Signal | Weight | Method |
|---|---|---|
| Plagiarism | 60% | Semantic cosine similarity via SentenceTransformers + FAISS |
| AI Detection | 40% | Multi-LLM perplexity ensemble (GPT-2, DistilGPT-2, GPT-2-medium) + DeBERTa classifier + heuristics |

The combined score ranges from 0 (fully plagiarised / AI-generated) to 100 (fully original / human-written).

---

## Architecture

```
┌──────────────────────────────────────────┐
│         React Frontend (Vite + TS)       │
│  shadcn/ui · Tailwind · React Query      │
│  Supabase Auth · History · Profiles      │
└───────────────┬──────────────────────────┘
                │ HTTP (REST)
┌───────────────▼──────────────────────────┐
│       FastAPI Backend (Python)           │
│                                          │
│  ┌────────────────┐  ┌────────────────┐  │
│  │ plagiarism_    │  │  ai_detector   │  │
│  │ engine.py      │  │  .py           │  │
│  │                │  │                │  │
│  │ SentenceTransf.│  │ GPT-2 family   │  │
│  │ + FAISS index  │  │ + DeBERTa v3   │  │
│  │ + pgvector opt.│  │ + Heuristics   │  │
│  └────────────────┘  └────────────────┘  │
└───────────────┬──────────────────────────┘
                │
┌───────────────▼──────────────────────────┐
│  Supabase (PostgreSQL + pgvector)        │
│  Auth · Profiles · Check History        │
│  Supabase Edge Functions (embeddings)   │
└──────────────────────────────────────────┘
```

---

## Features

**Plagiarism Detection**
- Sliding-window chunking of long documents (128-token windows, 32-token overlap)
- 384-dimensional sentence embeddings via `all-MiniLM-L6-v2`
- FAISS index for fast cosine similarity search across the entire corpus
- Source attribution — each match links back to the original submission ID
- Optional live web search via SerpAPI for internet-sourced plagiarism
- Configurable similarity threshold (0.60–0.95, default 0.75)
- Similarity distribution statistics (max, mean, median)

**AI Content Detection**
- Multi-LLM token log-probability scoring across GPT-2, DistilGPT-2, and GPT-2-medium
- DeBERTa-v3-base sequence classifier (with paraphrase-robustness averaging)
- Heuristic feature ensemble: burstiness, stylometry, AI-phrase density, structural uniformity
- Platt-scaling calibration layer
- Weighted ensemble: Multi-LLM 40% + DeBERTa 35% + Heuristics 25%
- Graceful degradation when optional model weights are absent

**API**
- Batch processing of up to 10 texts in a single request
- PDF upload and text extraction (`/upload-pdf`)
- Optional API key authentication
- Rate limiting: 30 requests/minute per IP (endpoint-specific limits apply)
- Request timeout protection (default 30s, 60s for full/PDF checks)
- Health endpoint with capability flags

**Frontend**
- Supabase authentication (email/password)
- Per-user check history with detailed score breakdown
- Group/workspace support
- Beta signup flow

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | shadcn/ui, Radix UI, Tailwind CSS |
| State / Data | TanStack React Query, React Hook Form, Zod |
| Backend | Python 3.11, FastAPI, Uvicorn |
| ML — Plagiarism | SentenceTransformers (`all-MiniLM-L6-v2`), FAISS |
| ML — AI Detection | GPT-2 / DistilGPT-2 / GPT-2-medium, DeBERTa-v3-base, scikit-learn |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth |
| Edge Functions | Supabase Edge Functions (Deno/TypeScript) |
| PDF | pypdf |
| Rate Limiting | slowapi |
| Testing | pytest, pytest-asyncio, httpx |

---

## Project Structure

```
Authentiq-main/
├── src/                          # React frontend source
│   ├── App.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx       # Supabase auth context
│   └── components/
│       └── OriginalityChecker.tsx
├── backend/                      # Python FastAPI backend
│   ├── main.py                   # All API endpoints
│   ├── plagiarism_engine.py      # Semantic plagiarism detection
│   ├── ai_detector.py            # Multi-LLM + DeBERTa AI detection
│   ├── requirements.txt
│   ├── sample_corpus.txt         # Initial reference corpus
│   ├── submissions.txt           # Auto-generated submission store
│   ├── start.sh                  # Unix startup script
│   ├── start.bat                 # Windows startup script
│   ├── SECURITY.md
│   └── tests/
│       ├── test_plagiarism.py
│       ├── test_ai_detector.py
│       └── conftest.py
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── generate-embedding/   # Edge function: vector embeddings
│   │   ├── check-originality/    # Edge function: originality check
│   │   └── beta-signup/          # Edge function: beta waitlist
│   └── migrations/               # SQL migration files
│       ├── pgvectorextension.sql
│       ├── profilestable.sql
│       ├── create_check_history.sql
│       └── ...
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm / bun
- Python 3.11+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone and install frontend dependencies

```bash
git clone https://github.com/your-org/authentiq.git
cd authentiq
npm install        # or: bun install
```

### 2. Set up the backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate       # Mac/Linux
venv\Scripts\activate          # Windows

# Install dependencies (~500MB first run due to PyTorch)
pip install -r requirements.txt
```

### 3. Configure environment variables

Create `.env` in `backend/`:

```env
# Required for Supabase-based corpus (optional — flat file used otherwise)
POSTGRES_DSN=postgresql://user:password@host:5432/postgres

# Optional — enables live web plagiarism search
SERPAPI_KEY=your_serpapi_key

# Optional — protects the API with a key
AUTHENTIQ_API_KEY=your_secret_key

# Optional — configure allowed origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080

# Optional — similarity threshold override
SIMILARITY_THRESHOLD=0.75
```

Create `.env.local` in the project root (for the frontend):

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Start the backend

```bash
# From the backend/ directory (with venv activated)
./start.sh           # Mac/Linux
start.bat            # Windows

# Or manually:
uvicorn main:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000`.  
Swagger docs: `http://127.0.0.1:8000/docs`

### 5. Start the frontend

```bash
# From the project root
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Backend API Reference

All endpoints accept and return JSON unless noted. Rate limits are per IP.

### `GET /health`

Returns server status and capability flags.

```json
{
  "status": "ok",
  "version": "3.0.0",
  "web_search_enabled": false,
  "api_key_required": false,
  "rate_limit": "30/minute per IP",
  "postgres_enabled": false
}
```

### `POST /check-full` — 15 req/min

Full plagiarism + AI detection combined. **Primary endpoint.**

```json
{
  "text": "Your text here...",
  "use_web": false,
  "store": true,
  "threshold": 0.75,
  "source_id": "optional-label"
}
```

Response includes `combined_originality_score`, `plagiarism`, `ai_detection`, and `total_processing_ms`.

### `POST /check-plagiarism` — 20 req/min

Plagiarism check only. Accepts the same payload as `/check-full`.

### `POST /check-ai` — 20 req/min

AI detection only. Accepts the same payload as `/check-full`.

### `POST /check-batch` — 5 req/min

Analyse up to 10 texts in one request. Total timeout: 120 seconds.

```json
{
  "items": [
    { "id": "doc-1", "text": "First document..." },
    { "id": "doc-2", "text": "Second document..." }
  ],
  "use_web": false,
  "store": true
}
```

### `POST /upload-pdf` — 10 req/min

Upload a PDF (multipart/form-data, max 10MB). Extracts text and runs a full check.

```bash
curl -X POST http://localhost:8000/upload-pdf \
  -F "file=@document.pdf" \
  -F "use_web=false" \
  -F "store=true"
```

### `POST /submit` — 30 req/min

Add text to the comparison corpus without analysing it. Useful for bulk-loading reference documents.

```json
{
  "text": "Reference document text...",
  "source_id": "optional-label"
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_DSN` | No | — | PostgreSQL connection string. Enables pgvector storage instead of flat files. |
| `SERPAPI_KEY` | No | — | SerpAPI key for live web plagiarism search. |
| `AUTHENTIQ_API_KEY` | No | — | If set, all endpoints require `X-Api-Key` header. |
| `ALLOWED_ORIGINS` | No | `localhost:8080,localhost:5173` | Comma-separated list of allowed CORS origins. |
| `SIMILARITY_THRESHOLD` | No | `0.75` | Default plagiarism similarity threshold. |
| `REQUEST_TIMEOUT_SECONDS` | No | `30` | Per-request timeout in seconds. |
| `VITE_API_URL` | Yes (frontend) | — | Backend base URL. |
| `VITE_SUPABASE_URL` | Yes (frontend) | — | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Yes (frontend) | — | Supabase anonymous public key. |

---

## Database Setup

Run the migrations in your Supabase SQL editor in this order:

```
supabase/migrations/pgvectorextension.sql
supabase/migrations/profilestable.sql
supabase/migrations/submission_chunks_pg.sql
supabase/migrations/vectorsimilaritysearch.sql
supabase/migrations/matchsubmissions.sql
supabase/migrations/fix_vector_dimensions.sql
supabase/migrations/create_check_history.sql
```

Row-level security is enabled on all user tables — users can only read and write their own data.

---

## Testing

```bash
cd backend
pytest
```

Tests cover plagiarism engine accuracy, AI detector signal correctness, and FastAPI endpoint responses. Configuration is in `pytest.ini`.

---

## Deployment

**Backend** — recommended platforms: Render (free tier), Railway, AWS EC2

```bash
# Example: Render start command
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Frontend** — deploy the Vite build to Vercel, Netlify, or any static host:

```bash
npm run build        # outputs to dist/
```

**Supabase Edge Functions** — deploy with the Supabase CLI:

```bash
supabase functions deploy generate-embedding
supabase functions deploy check-originality
supabase functions deploy beta-signup
```

The GitHub Actions workflow in `.github/workflows/deploy-functions.yml` automates edge function deployment on push.

### Production upgrade checklist

- [ ] Replace FAISS flat-file store with PostgreSQL + pgvector for persistence across restarts
- [ ] Add Redis caching for embedding results to reduce latency and compute cost
- [ ] Set `AUTHENTIQ_API_KEY` to protect the backend
- [ ] Set `ALLOWED_ORIGINS` to your production frontend domain only
- [ ] Obtain a SerpAPI key and enable `use_web: true` for internet-sourced plagiarism detection
- [ ] Fine-tune a RoBERTa classifier on domain-specific data to improve AI detection accuracy

---

## Security

See [`backend/SECURITY.md`](backend/SECURITY.md) for the responsible disclosure policy and known security considerations.

Key points:
- Optional API key authentication via `X-Api-Key` header
- CORS restricted to explicitly allowed origins
- Rate limiting on all endpoints (slowapi)
- Request size capped at 50,000 characters for text, 10MB for PDFs
- Request timeout protection prevents resource exhaustion