@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [Environment check failed] Node.js was not found.
  echo Please install Node.js 20.19 or newer, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [Environment check failed] npm was not found.
  echo Please reinstall Node.js 20.19 or newer with npm enabled.
  pause
  exit /b 1
)

call node scripts\check-env.mjs --skip-deps
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo node_modules was not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [Environment check failed] Dependency installation failed.
    echo Please check your network or npm configuration, then retry.
    pause
    exit /b 1
  )
)

call npm run check:env
if errorlevel 1 (
  pause
  exit /b 1
)

echo Starting sales dashboard...
start "" "http://127.0.0.1:5173/"
npm run dev -- --port 5173

pause
