@echo off
chcp 65001 >nul
title 上帝之眼戰情台 - 停止服務

echo ========================================================
echo  🛑 正在停止戰情台服務並釋放連接埠...
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-no-admin.ps1"
pause
