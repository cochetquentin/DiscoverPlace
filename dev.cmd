@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installation des dependances...
  call npm.cmd install
  if errorlevel 1 exit /b %errorlevel%
)

echo.
echo DiscoverPlace demarre sur http://localhost:3000
echo Appuie sur Ctrl+C pour arreter.
echo.
call npm.cmd run dev
