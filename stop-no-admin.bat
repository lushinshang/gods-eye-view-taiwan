@echo off
title Gods Eye View - Stop Service

echo ========================================================
echo   Stopping God's Eye View service and releasing port 4173...
echo ========================================================
echo.

taskkill /f /im node.exe >nul 2>&1

echo [OK] All Node.js processes terminated. Port 4173 released!
echo.
pause
