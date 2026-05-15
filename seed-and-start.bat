@echo off
title MatchED - Fresh Start
echo.
echo  Resetting database and starting MatchED...
echo.

cd /d "%~dp0MatchED-Backend"

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
)

echo Seeding database with fresh demo data...
node src/seed-data/seed.js

echo.
echo  Starting server at http://localhost:3000
echo.
node src/server.js
pause
start http://localhost:3000

