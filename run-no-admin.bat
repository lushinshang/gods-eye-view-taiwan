@echo off
chcp 65001 >nul
title 上帝之眼戰情台 - 免管理者權限極速啟動器

echo ========================================================
echo  👁️ 上帝之眼台海戰情台 - 完全免管理者權限啟動器
echo  🏢 適合環境：無 Admin 權限公發機、未安裝 Docker 辦公電腦
echo ========================================================

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-no-admin.ps1"
pause
