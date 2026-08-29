@echo off
title MAXSHOW - Live Host Server & Cloudflare Tunnel
echo =======================================================
echo        MAXSHOW - Running Live from your Laptop!
echo =======================================================
echo.
cd /d "%~dp0"

:: 1. Build frontend and start watcher
echo [1/3] Building frontend and starting watcher...
cd /d "%~dp0Frontend"
call npm run build
start "MAXSHOW Frontend Watcher" /min cmd /k "cd /d \"%~dp0Frontend\" && npm run watch"
cd /d "%~dp0"

:: 2. Start Backend Server with Auto-Reload
echo [2/3] Starting Backend Server on http://127.0.0.1:8000...
start "MAXSHOW Backend Server (Local)" cmd /k "cd /d \"%~dp0Backend\" && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --reload-dir ."

timeout /t 2 /nobreak >nul

:: 3. Connect Cloudflare Tunnel
echo [3/3] Connecting Secure Cloudflare Tunnel to https://maxshow.site...
echo.
echo =======================================================
echo   Your website is LIVE worldwide at:
echo   - https://maxshow.site
echo   - https://www.maxshow.site
echo.
echo   * Auto-Compile: ENABLED (Frontend changes auto-compile)
echo   * Auto-Reload: ENABLED (Backend changes auto-reload)
echo =======================================================
echo Keep this window OPEN while you want your site online.
echo Press Ctrl+C to stop broadcasting.
echo.

cloudflared.exe tunnel run maxshow-tunnel
pause
