@echo off
setlocal
cd /d "%~dp0"

call rtk proxy npm.cmd run typecheck
if errorlevel 1 exit /b %errorlevel%

call rtk proxy npm.cmd run lint
if errorlevel 1 exit /b %errorlevel%

call rtk proxy npm.cmd run test
if errorlevel 1 exit /b %errorlevel%

call rtk proxy npm.cmd run build
if errorlevel 1 exit /b %errorlevel%

echo.
echo Tout est bon. Le projet est pret a etre deploye.
