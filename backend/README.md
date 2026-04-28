# Authentiq Backend — Setup Guide

Real originality detection. No mocks. No hardcoded percentages.

## What's inside

| File | Purpose |
|---|---|
| `main.py` | FastAPI server — all endpoints |
| `plagiarism_engine.py` | SentenceTransformers + FAISS semantic similarity |
| `ai_detector.py` | GPT-2 perplexity + burstiness + stylometry |
| `sample_corpus.txt` | Reference corpus (40 sentences to start) |
| `submissions.txt` | Auto-created — stores all checked texts |

## How it actually works

### Plagiarism detection
1. Your text is split into sentences
2. Each sentence is encoded into a 384-dim vector using `all-MiniLM-L6-v2`
3. Vectors are compared against the corpus using FAISS (cosine similarity)
4. Sentences with similarity > 75% are flagged
5. Score = (flagged / total) sentences
6. Optionally: top sentences are also checked against live web via SerpAPI

### AI detection
Uses 5 real signals:
- **GPT-2 Perplexity** (40%) — AI text is more predictable → lower perplexity
- **Burstiness** (25%) — AI has uniform sentence length → low variation
- **Unique Word Ratio** (15%) — AI uses diverse vocabulary
- **Avg Sentence Length** (10%) — AI typically writes 18-28 word sentences
- **Token Entropy** (10%) — diversity of word distribution

## Quick Start (Windows)

```bash
cd authentiq-backend
start.bat
```

## Quick Start (Mac/Linux)

```bash
cd authentiq-backend
chmod +x start.sh
./start.sh
```

## Manual Setup

```bash
# Create and activate virtualenv
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # Mac/Linux

# Install deps (torch download = ~500MB first time)
pip install -r requirements.txt

# Start server
uvicorn main:app --reload
```

Server runs at: http://127.0.0.1:8000  
Swagger UI: http://127.0.0.1:8000/docs

## API Endpoints

### POST /check-full (main endpoint)
```json
{
  "text": "Your text here",
  "use_web": false,
  "store": true
}
```
Returns combined plagiarism + AI detection result.

### POST /check-plagiarism
Just plagiarism check.

### POST /check-ai  
Just AI detection.

### POST /upload-pdf
Upload a PDF file (multipart/form-data). Extracts text then runs full check.

### POST /submit
Add text to corpus without analyzing it. Use to bulk-load reference docs.

### GET /health
Server status check.

## Enable Web Search (Optional upgrade)

Get a free SerpAPI key at https://serpapi.com (100 searches/month free).

Create a `.env` file:
```
SERPAPI_KEY=your_key_here
```

Then call endpoints with `"use_web": true`.

## Connect React Frontend

Create `.env.local` in the React project root:
```
VITE_API_URL=http://127.0.0.1:8000
```

The `OriginalityChecker` component reads this and calls your FastAPI directly.

## Upgrade Path to Production

1. **Replace FAISS** with PostgreSQL + pgvector for persistence across restarts
2. **Replace SerpAPI** with Google Custom Search for more quota
3. **Add Redis** for caching embedding results (saves API cost)
4. **Deploy backend** on Render (free tier works), Railway, or AWS EC2
5. **Improve AI detector** by fine-tuning a RoBERTa classifier on labeled data
