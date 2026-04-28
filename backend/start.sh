#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate venv
if [ -d "../.venv" ]; then source ../.venv/bin/activate
elif [ -d "venv" ]; then source venv/bin/activate
elif [ -d ".venv" ]; then source .venv/bin/activate
fi

echo "[authentiq] Installing/updating dependencies..."
pip install -r requirements.txt --quiet

if [ "$1" == "--prod" ]; then
  echo "[authentiq] Starting PRODUCTION server..."
  uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
else
  echo "[authentiq] Starting DEVELOPMENT server..."
  uvicorn main:app --reload --reload-exclude "tests/*" --host 127.0.0.1 --port 8000
fi