@echo off
title MAXSHOW - Local Development Server
echo =======================================================
echo           Starting MAXSHOW Local Server
echo =======================================================
echo.
cd /d "%~dp0"

:: 1. Check Python requirements
python -c "import uvicorn, fastapi" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [Setup] Installing Python backend requirements...
    python -m pip install -r Backend/requirements.txt
)

:: 2. Start Frontend Auto-Compiler in background (instantly compiles JSX/CSS edits)
echo [1/2] Starting Frontend Auto-Compiler...
start "MAXSHOW Frontend Watcher" /min cmd /c "cd /d \"%~dp0Frontend\" && npm run watch"

:: 3. Open browser after short delay in background
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

:: 4. Start Backend Server with Auto-Reload in this window
echo [2/2] Starting Backend Server on http://localhost:8000...
echo.
echo =======================================================
echo   * MAXSHOW Server is Live on: http://localhost:8000
echo   * Auto-Reload: ENABLED (Frontend & Backend)
echo   * Press Ctrl+C in this window to stop the server
echo =======================================================
echo.

python -m uvicorn Backend.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir Backend

pause

