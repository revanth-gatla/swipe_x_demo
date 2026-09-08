@echo off
title SWIPE X Launcher
echo ==========================================
echo   Launching SWIPE X Platform Servers
echo ==========================================

echo [1/2] Starting Backend (FastAPI / Uvicorn)...
start "SWIPE X Backend" powershell -NoExit -Command "cd '%~dp0backend'; .\venv\Scripts\uvicorn.exe app:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting Frontend (Vite / React)...
start "SWIPE X Frontend" powershell -NoExit -Command "cd '%~dp0frontend'; npm run dev"

echo.
echo Both servers started!
echo Frontend: http://localhost:5173
echo Backend:  http://127.0.0.1:8000
echo API Docs: http://127.0.0.1:8000/docs
echo.
pause
