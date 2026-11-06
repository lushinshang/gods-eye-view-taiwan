# ==============================================================================
# 上帝之眼戰情台 - 完全免管理者權限 (Zero-Admin) 極速啟動腳本
# ==============================================================================
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 👁️  上帝之眼台海戰情台 - 免管理者權限啟動器" -ForegroundColor Cyan
Write-Host " 🏢 適合環境：無 Admin 權限公發機、未安裝 Docker 的辦公電腦" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$rootDir = $PSScriptRoot
$runtimeDir = Join-Path $rootDir "runtime"
$nodeExe = Join-Path $runtimeDir "node.exe"

# 1. 檢查本機是否已有便攜版 Node.js，若無則自動下載
if (-not (Test-Path $nodeExe)) {
    Write-Host "`n[1/3] 正在下載官方免安裝 Node.js 便攜版 (約 30MB，無需密碼)..." -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

    $nodeZipUrl = "https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip"
    $zipPath = Join-Path $runtimeDir "node.zip"
    $tempExtract = Join-Path $runtimeDir "temp"

    Invoke-WebRequest -Uri $nodeZipUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $tempExtract -Force

    # 搬移至 runtime 根目錄
    $extractedFolder = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
    Get-ChildItem -Path $extractedFolder.FullName | Move-Item -Destination $runtimeDir -Force

    # 清理暫存壓縮檔
    Remove-Item -Recurse -Force $tempExtract, $zipPath
    Write-Host "✅ Node.js 便攜版配置完成！" -ForegroundColor Green
}

# 2. 將本機 runtime 臨時加入當前 Session 的 PATH (完全不碰系統設定，免權限)
$env:PATH = "$runtimeDir;$env:PATH"
Write-Host "`n[2/3] 檢查執行環境：" -ForegroundColor Green
& node -v
& npm -v

# 3. 進入 repo 目錄準備啟動
$repoDir = Join-Path $rootDir "repo"
Set-Location $repoDir

if (-not (Test-Path (Join-Path $repoDir "node_modules"))) {
    Write-Host "`n📦 首次運行，正在安裝依賴套件 (請稍候約 1~2 分鐘)..." -ForegroundColor Yellow
    & npm install
}

# 4. 自動開啟 Windows 預設瀏覽器進入戰情台
Write-Host "`n[3/3] 正在啟動戰情台並開啟瀏覽器..." -ForegroundColor Green
Start-Process "http://localhost:4173"

# 啟動前端與後端服務
& npm run dev
