#!/usr/bin/env bash
# ==============================================================================
# God's Eye View — 臺灣海域 3D 地球戰情室一鍵啟動腳本 (支援 Ctrl+C 自動關閉)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${SCRIPT_DIR}/repo"
APP_URL="http://localhost:4173"
LOGS_PID=""

# 優雅清理函數：按下 Ctrl+C 或終止訊號時自動關閉 Docker
cleanup() {
  echo ""
  echo "=========================================================="
  echo " 🛑 偵測到中斷訊號 (Ctrl+C)，正在關閉戰情室容器..."
  if [ -n "$LOGS_PID" ]; then
    kill "$LOGS_PID" 2>/dev/null || true
  fi
  cd "${REPO_DIR}" && docker compose down >/dev/null 2>&1 || true
  echo " ✅ 戰情室 Docker 容器已安全停止，連接埠已完全釋放。"
  echo "=========================================================="
  exit 0
}

# 註冊中斷訊號攔截器
trap cleanup SIGINT SIGTERM

echo "=========================================================="
echo " 👁️  正在啟動 God's Eye View 臺灣海域戰情台..."
echo "=========================================================="

# 1. 檢查 Docker 是否運行中，若未運行則智慧自動喚醒
if ! docker info >/dev/null 2>&1; then
  echo "🐳 偵測到 Docker 尚未啟動，正在為您自動開啟 Docker Desktop..."
  if [ "$(uname)" = "Darwin" ]; then
    open -a Docker >/dev/null 2>&1 || open /Applications/Docker.app >/dev/null 2>&1 || true
  elif command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start docker >/dev/null 2>&1 || true
  fi

  echo -n "⏳ 等待 Docker 守護程序初始化就緒"
  DOCKER_RETRIES=40
  DOCKER_COUNT=0
  DOCKER_READY=false
  while [ $DOCKER_COUNT -lt $DOCKER_RETRIES ]; do
    if docker info >/dev/null 2>&1; then
      DOCKER_READY=true
      break
    fi
    sleep 2
    DOCKER_COUNT=$((DOCKER_COUNT + 1))
    printf "."
  done
  echo ""

  if [ "$DOCKER_READY" != true ]; then
    echo "❌ 啟動逾時：Docker Desktop 未能在預期時間內就緒。"
    echo "👉 請確認 Docker Desktop 應用程式狀態後，再重新執行 ./run.sh"
    exit 1
  fi
  echo "✅ Docker 引擎已順利就緒！"
fi

# 2. 進入 repo 目錄並以背景模式啟動容器
echo "📦 啟動 Docker 容器服務..."
cd "${REPO_DIR}"
docker compose up -d

# 3. 等待服務就緒
echo "⏳ 等待戰情台後端服務就緒 (${APP_URL})..."
MAX_RETRIES=20
COUNT=0
READY=false

while [ $COUNT -lt $MAX_RETRIES ]; do
  if curl -s -o /dev/null -w "%{http_code}" "${APP_URL}" | grep -q "200\|304"; then
    READY=true
    break
  fi
  sleep 1
  COUNT=$((COUNT + 1))
  printf "."
done
echo ""

if [ "$READY" = true ]; then
  echo "✅ 戰情台服務已健康就緒！"
  echo "🌐 自動開啟瀏覽器進入戰情室..."
  open "${APP_URL}"
else
  echo "⚠️ 服務啟動稍有延遲，請手動開啟瀏覽器造訪：${APP_URL}"
fi

echo ""
echo "=========================================================="
echo " 🚀 戰情室已啟動完成！"
echo " 👉 戰情室網址：   ${APP_URL}"
echo " 👉 系統操作手冊： file://${SCRIPT_DIR}/readme.html"
echo " 👉 架構白皮書：   file://${SCRIPT_DIR}/system-architecture.html"
echo "----------------------------------------------------------"
echo " 🟢 戰情室守護進程運行中..."
echo " 💡 提示：隨時按下 [Ctrl + C] 即可一鍵關閉戰情室並釋放資源"
echo "=========================================================="

# 4. 常駐等待並輸出日誌，按下 Ctrl+C 即由 trap 自動觸發 cleanup
cd "${REPO_DIR}"
docker compose logs -f &
LOGS_PID=$!
wait "$LOGS_PID" 2>/dev/null || true
cleanup
