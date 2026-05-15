@echo off
title MatchED Server
echo.
echo  ===================================
echo        MatchED - Starting...
echo  ===================================
echo.

cd /d "%~dp0MatchED-Backend"

:: Install deps if needed
if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 ( echo ERROR: npm install failed && pause && exit /b 1 )
)

:: Seed if no database yet
if not exist "data\db.json" (
  echo Seeding database with demo data...
  call node src/seed-data/seed.js
)

echo  Server starting at http://localhost:3000
echo  Press Ctrl+C to stop
echo.

node src/server.js
pause
