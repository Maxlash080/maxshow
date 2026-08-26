@echo off
title MAXSHOW - Live Host Server & Cloudflare Tunnel
echo =======================================================
echo        MAXSHOW - Running Live from your Laptop!
echo =======================================================
echo.
cd /d "%~dp0"

echo [1/2] Starting Backend Server on http://127.0.0.1:8000...
start "MAXSHOW Backend Server (Local)" cmd /k "python -m uvicorn Backend.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/2] Connecting Secure Cloudflare Tunnel to https://maxshow.site...
echo.
echo =======================================================
echo   Your website is LIVE worldwide at:
echo   - https://maxshow.site
echo   - https://www.maxshow.site
echo =======================================================
echo Keep this window OPEN while you want your site online.
echo Press Ctrl+C to stop broadcasting.
echo.

cloudflared.exe tunnel run maxshow-tunnel
pause
