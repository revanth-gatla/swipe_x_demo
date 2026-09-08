# SWIPE X - Project Launcher Script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Launching SWIPE X Platform Servers      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Start Backend in a separate window
Write-Host "[1/2] Starting FastAPI Backend on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\backend'; .\venv\Scripts\uvicorn.exe app:app --host 127.0.0.1 --port 8000 --reload"

# 2. Start Frontend in a separate window
Write-Host "[2/2] Starting Vite Frontend on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\frontend'; npm run dev"

Write-Host "`nServers launched!" -ForegroundColor Green
Write-Host "  - Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  - Backend:  http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  - API Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
