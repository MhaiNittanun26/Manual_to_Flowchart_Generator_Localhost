@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.13 or newer first.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 pause & exit /b 1
call npm run dev
pause
