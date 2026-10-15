@echo off
title MatchED - Fresh Start
echo.
echo  This ERASES the local database and rebuilds it (demo data + data-import\*.xlsx).
pause

cd /d "%~dp0MatchED-Backend"

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
)

call npm run setup -- --reset

echo.
echo  Starting server at http://localhost:3000
echo.
start http://localhost:3000
node src/server.js
pause
