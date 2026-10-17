@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22 or newer, then try again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js 22 or newer, then try again.
  pause
  exit /b 1
)

echo Starting Stockly backend, Android app preview, and owner tools...
echo Press Ctrl+C to stop all services.
npm run dev:all

echo.
echo Stockly services stopped.
pause
