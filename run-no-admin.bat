@echo off
title Gods Eye View - Zero Admin Runner

echo ========================================================
echo   God's Eye View - Taiwan Theater 3D Dashboard
echo   Mode: Zero-Admin Portable (No Admin Rights, No Docker)
echo ========================================================
echo.

cd /d "%~dp0"

REM Step 1: Check and download portable Node.js runtime
if not exist "runtime\node.exe" (
    echo [1/3] Downloading official portable Node.js (approx. 30MB)...
    if not exist "runtime" mkdir "runtime"
    
    curl.exe -L -o "runtime\node.zip" "https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip"
    if errorlevel 1 (
        echo [ERROR] Failed to download Node.js. Check your internet connection.
        pause
        exit /b 1
    )
    
    echo [1/3] Extracting Node.js runtime...
    tar.exe -xf "runtime\node.zip" -C "runtime"
    
    xcopy /e /y /q "runtime\node-v22.11.0-win-x64\*" "runtime\" >nul 2>&1
    rd /s /q "runtime\node-v22.11.0-win-x64" >nul 2>&1
    del /f /q "runtime\node.zip" >nul 2>&1
    echo [1/3] Node.js portable runtime successfully configured!
    echo.
)

REM Step 2: Add runtime to current session PATH
set "PATH=%~dp0runtime;%PATH%"

echo [2/3] Runtime environment check:
call node -v
call npm -v
echo.

REM Step 3: Enter repo and start application
cd /d "%~dp0repo"

if not exist "node_modules" (
    echo [3/3] First run: Installing packages (takes approx. 1-2 mins)...
    call npm install
    echo.
) else (
    echo [3/3] Packages already installed, launching...
    echo.
)

echo Opening browser at http://localhost:4173 ...
start http://localhost:4173

echo.
echo ========================================================
echo   God's Eye View is RUNNING!
echo   Press [Ctrl + C] or close this window to stop.
echo ========================================================
call npm run dev

pause
