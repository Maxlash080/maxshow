@echo off
echo ==============================================
echo        Starting MAXSHOW Server
echo ==============================================
cd /d "%~dp0"

:: Check if uvicorn is installed, install requirements if missing
python -c "import uvicorn, fastapi" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Dependencies not found. Installing requirements...
    python -m pip install -r Backend/requirements.txt
)

:: Start the Python backend server in a separate window
start "MAXSHOW Backend Server" cmd /k "python -m uvicorn Backend.main:app --host 127.0.0.1 --port 8000 --reload"

