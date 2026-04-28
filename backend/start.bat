@echo off
cd /d "%~dp0"

REM Activate venv — tries both common locations
if exist "..\venv\Scripts\activate.bat" (
  call "..\venv\Scripts\activate.bat"
) else if exist "..\..\.venv\Scripts\activate.bat" (
  call "..\..\.venv\Scripts\activate.bat"
) else if exist "venv\Scripts\activate.bat" (
  call "venv\Scripts\activate.bat"
)

echo [authentiq] Installing/updating dependencies...
pip install -r requirements.txt --quiet

echo [authentiq] Starting development server...
REM --reload-exclude stops test files from triggering reloads
uvicorn main:app --reload --reload-exclude "tests/*" --host 127.0.0.1 --port 8000