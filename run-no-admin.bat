@echo off
chcp 65001 >nul
title 上帝之眼台海戰情台 - 免管理者權限極速啟動器

echo ========================================================
echo   👁️ 上帝之眼台海戰情台 - 完全免管理者權限啟動器
echo   🏢 模式：Zero-Admin 便攜版（無需密碼、無需 Docker）
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. 檢查是否已有便攜版 Node.js
if not exist "runtime\node.exe" (
    echo [1/3] 正在下載 Node.js 官方免安裝便攜版 (約 30MB)...
    if not exist "runtime" mkdir "runtime"
    
    :: 使用 Windows 內建 curl 下載
    curl.exe -L -o "runtime\node.zip" "https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip"
    if errorlevel 1 (
        echo ❌ 下載失敗，請檢查網路連線。
        pause
        exit /b 1
    )
    
    echo 📦 正在解壓縮 Node.js 執行環境...
    tar.exe -xf "runtime\node.zip" -C "runtime"
    
    :: 將解壓縮後的目錄檔案移至 runtime 根層級
    xcopy /e /y /q "runtime\node-v22.11.0-win-x64\*" "runtime\" >nul 2>&1
    rd /s /q "runtime\node-v22.11.0-win-x64" >nul 2>&1
    del /f /q "runtime\node.zip" >nul 2>&1
    echo ✅ Node.js 便攜環境配置完成！
    echo.
)

:: 2. 將本機 runtime 臨時加入 PATH（只影響此視窗，不影響全機）
set "PATH=%~dp0runtime;%PATH%"

echo [2/3] 檢查執行環境：
call node -v
call npm -v
echo.

:: 3. 進入 repo 目錄準備啟動
cd /d "%~dp0repo"

if not exist "node_modules" (
    echo [3/3] 📦 首次運行，正在安裝前端與後端套件 (約需 1~2 分鐘)...
    call npm install
    echo.
) else (
    echo [3/3] 依賴套件已就緒，準備啟動服務...
    echo.
)

:: 自動在預設瀏覽器開啟戰情台
echo 🌐 正在開啟瀏覽器進入戰情台 (http://localhost:4173)...
start http://localhost:4173

:: 啟動戰情台
echo 🟢 戰情台運行中！隨時按下 [Ctrl + C] 或關閉視窗即可結束。
echo ========================================================
call npm run dev

pause
