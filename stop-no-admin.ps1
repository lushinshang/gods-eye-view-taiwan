# ==============================================================================
# 上帝之眼戰情台 - 一鍵完全關閉服務腳本 (免管理者權限)
# ==============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host " 🛑 正在安全關閉戰情台 Node.js 服務..." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

# 強制停止所有當前使用者權限下的 node 程序，完全釋放 4173 埠位
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

Write-Host "✅ 戰情台服務已徹底停止！4173 連接埠已安全釋放。" -ForegroundColor Green
