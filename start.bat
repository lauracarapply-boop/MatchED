@echo off
title MatchED Server
echo.
echo  ===================================
echo        MatchED - Starting...
echo  ===================================
echo.

cd /d "%~dp0MatchED-Backend"

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 ( echo ERROR: npm install failed && pause && exit /b 1 )
)

:: Creates .env and the database, imports data-import\*.xlsx (safe to run every time)
call npm run setup

echo  Server starting at http://localhost:3000
echo  Press Ctrl+C to stop
echo.
start http://localhost:3000
node src/server.js
pause
