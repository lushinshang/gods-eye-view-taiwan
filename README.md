# God's Eye View — 臺灣海域戰術指揮台 · 系統總覽與架構白皮書

> **現代化 3D 地球態勢感知中樞 × 臺灣交通部航港局（MOTC MPB）9,000+ 艘官方即時雷達數據對接**  
> 融合幾十年分散式 GIS / C4ISR 防禦雷達工程底蘊與 2026+ AI 時代（Agentic / MCP / 多模態 Vision）架構演進規劃。

---

## 📑 核心成果與系統文件導覽（HTML 圖文並茂）

本專案所有核心交付物均已完成 **Playwright 雙端自動化檢驗（桌機 1280px / 手機直屏 390px 零橫向滾動、零錯誤）**：

| 文件名稱 | 檔案路徑 | 顧問規格與核心內容 |
| :--- | :--- | :--- |
| **📖 系統發布與使用指南** | [`readme.html`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/readme.html) | 一鍵 Docker + uv 啟動指引、8 大船型辨識圖譜、即時更新矩陣、人機工效快捷鍵與 FAQ。 |
| **🏛️ 現代 C4ISR 系統架構白皮書** | [`system-architecture.html`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/system-architecture.html) | 幾十年資深系統分析顧問 × AI 時代全景白皮書：雙軌 API 契約、40s 快取安全、Texture Atlas 1 Draw Call 合批、Screen-Space 13.4px 尺度治理、Agentic/MCP 演進藍圖。 |
| **📊 技術演進與實錄全歷程** | [`gods-eye-view-summary.html`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/gods-eye-view-summary.html) | 深入記錄本機 Docker 實測、Claude Code 逆向挖掘免金鑰官方雷達源、數據解耦、尺度災難復盤與修復實錄。 |
| **🔬 深度研究與實測規劃報告** | [`gods-eye-view-analysis.html`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/gods-eye-view-analysis.html) | 基於 GitHub v0.3.0 與 DeepWiki 42 篇文件交叉實證、19/21 免金鑰圖層驗證、臺灣高公局 CCTV 與本土化實測存證。 |
| **🎨 微光學圖標設計展示書** | [`spec.html`](repo/public/icons/taiwan-vessels/spec.html)（本機離線；容器網址：http://localhost:4173/icons/taiwan-vessels/spec.html） | Awwwards / FWA 規格 16 款（8 normal + 8 白金選取態）48×48 Texture Atlas 微光學船舶點陣圖標設計展示。 |

---

## ⚡ 系統五大突破性工程架構

### 1. 雙軌 API 契約與邊界防護（Resilience Engineering）
- **全球源與臺灣源徹底解耦**：保留原版 `/api/vessels`（全球 AISStream WebSocket），獨立掛載 `/api/taiwan-vessels`。
- **40 秒記憶體快取 + 請求合併鎖（Request Coalescing）**：面對多併發客戶端，後端每 40 秒對航港局外部伺服器僅發送精準 1 次請求，保護公共開放資料伺服器免遭擊穿。
- **串流防禦**：使用 Node 原生 `node:https` 串流接收 Buffer，徹底根除 3.6MB 巨型封包在 undici TLS 底層連線超時中斷問題。

### 2. GPU 圖形學極限壓榨（WebGL 60 FPS）
- **Texture Atlas 1 Draw Call 原則**：將向量 SVG 預先光柵化為 48×48 小點陣圖，WebGL 自動合批至單一紋理貼圖，**繪製臺灣周邊 9,000 艘船僅消耗 1 次 Draw Call**。
- **Screen-Space Fixed 13.4px 幾何解法**：修復早期 92px 巨型圖標遮蔽海峽的空間尺度事故，固定為 13.4 螢幕像素，航向羅盤針清晰分明。
- **GPU 著色器語意視距抽稀**：航行商船（>0.5kt）全域 8,000km 可見，停泊小船（≤0.5kt）拉近至 280km 近景展開，海峽開闊清爽。

### 3. 人機工效雙面板戰情室（Dual-Dock Ergonomics）
- **左側全域大盤**：全球多源圖層開關（飛機、全球船、衛星、地震、CCTV）與 GLSL 後製濾鏡（NVG 夜視鏡、CRT 掃描線、FLIR 熱成像）。
- **右側臺灣專精台**：臺灣航港局 8 大船型勾選器、即時在席艘數徽章、單船點擊詳細情資卡與折疊手柄（`🚢 ➔`）。

### 4. AI 時代 Agentic C4ISR 演進藍圖
- **Model Context Protocol (MCP)**：對外暴露海事時空查詢工具集，賦予 Claude、Gemini 等大模型自主調用衛星交會與船隻推估能力。
- **多模態邊緣視覺推論**：針對全臺 1,781 支 CCTV 影像流進行無人機與不明集結視覺辨識。
- **因果鏈異常預警**：AI 自主推論「AIS 突然靜默」、「非典型錨泊」與「灰區行動」。

---

## 🚀 快速啟動指南

戰情室已在本機容器環境就緒，提供兩種啟動方式：

### 方法一：極速一鍵啟動（推薦）
在專案根目錄直接執行腳本，自動檢查 Docker、啟動容器、開啟瀏覽器；**終端機按下 `Ctrl + C` 即自動優雅關閉容器**：
```bash
./run.sh
```

### 方法二：手動 Docker Compose 啟動
```bash
# 1. 進入 repo 目錄並背景啟動容器
cd /Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/repo
docker compose up -d

# 2. 開啟瀏覽器進入戰情室
open http://localhost:4173

# 3. 查閱本機圖文並茂系統文件
open /Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/readme.html
open /Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/system-architecture.html
```

---

## 🎮 戰情指揮官全操作指南與快捷鍵圖譜

### 1. 3D 地球視角操縱手勢
| 動作 | 滑鼠操作 (Mouse) | Mac 觸控板手勢 (Trackpad) | 效果 |
| :--- | :--- | :--- | :--- |
| **平移地球 (Pan)** | 按住 **滑鼠左鍵** 拖曳 | 單指按住滑動 | 平移海峽焦點 |
| **無段縮放 (Zoom)** | 滑動 **滑鼠滾輪** 或按住 **右鍵** 拖曳 | 雙指張合 / 捏合 | 10,000km 太空至 500m 近景泊位 |
| **俯仰傾斜 (Tilt)** | 按住 **滑鼠右鍵** 或 **Ctrl + 左鍵** 拖曳 | 雙指按住上下滑動 | 鳥瞰切換為地平線戰術視角 |
| **環形旋轉 (Orbit)** | 按住 **滑鼠中鍵（滾輪）** 拖曳 | 雙指按住左右旋轉 | 以當前目標為中心 360° 環視 |

### 2. 軍規鍵盤快捷鍵 (Hotkeys Spectrum)
- **GLSL 著色器即時切換（數字鍵 1～6）**：
  - `1`：Normal（真實全彩衛星底圖）
  - `2`：Retro（CRT 復古綠色掃描線戰情螢幕）
  - `3`：Surveillance（PVS-14 綠磷光夜視鏡 NVG）
  - `4`：Thermal（FLIR 紅外熱成像偽彩色譜）
  - `5`：Anime（動漫線條輪廓描邊）
  - `6`：Noir（黑白高反差情資偵察）
- **HUD 快捷控制**：
  - `H`：一鍵隱藏/顯示所有儀表板（進入全螢幕沉浸純視圖）
  - `O`：啟動相機自動環球慢速巡航模式（Auto Orbit）
  - `D`：循環切換 AI 目標偵測框（Object Detection Bounding Box）
  - `C`：快速啟閉全臺公路 CCTV 攝影機圖層
  - `F`：開啟 / 收折左側圖層大盤
  - `V`：切換極簡視圖（Clean View）
  - `Esc`：取消選取當前目標 / 關閉搜尋與彈窗

### 3. 右側臺灣專精台與 CCTV 交互
- **抽屜手柄（`🚢 ➔`）**：點擊可自適應折疊或展開右側面板。
- **8 大船型過濾與徽章**：即時勾選分類，各類別旁皆有即時在席艘數計數。
- **單船情報卡**：直接點擊海面任意船隻，圖標切換為白金選取發光態，彈出詳細資訊卡（MMSI、航速 SOG、航向 COG、吃水深、目的港）。
- **隨選 CCTV 視訊**：在地圖上點擊國道攝影機圖標，即時彈出 HLS 串流車流監控影片。

---

## 🛡️ 自動化驗收指標（Playwright Verified）

```
✅ readme.html [desktop]: Scroll 1280/1280 | Errors: 0
✅ readme.html [mobile]: Scroll 390/390 | Errors: 0
✅ system-architecture.html [desktop]: Scroll 1280/1280 | Errors: 0
✅ system-architecture.html [mobile]: Scroll 390/390 | Errors: 0
✅ gods-eye-view-summary.html [desktop]: Scroll 1280/1280 | Errors: 0
✅ gods-eye-view-summary.html [mobile]: Scroll 390/390 | Errors: 0
✅ gods-eye-view-analysis.html [desktop]: Scroll 1280/1280 | Errors: 0
✅ gods-eye-view-analysis.html [mobile]: Scroll 390/390 | Errors: 0

🎉 ALL HTML DOCS PASSED MOBILE & DESKTOP ZERO-OVERFLOW VERIFICATION!
```

---

## 🗺️ 零付費實驗室精進藍圖（待選功能清單）

借鏡「零付費實驗室版本（Zero-Cost Lab Edition）」架構設計，以下為本專案規劃之 5 大精進項目（依序推進，完成即打勾）：

- [x] **1. 台灣陸地動態補完（高公局 `TISVCloud` 即時車速 ＋ `警廣 PBS` 道路事件）（已完成 ✅）**：新增 `/api/taiwan-traffic`（60 秒快取、上游失敗回傳 stale）與 `taiwan_traffic_events` MCP 工具，右側戰情台加入「🛣️ 臺灣即時路況與事件」開關與事件徽章。實測（2026-11-04，容器 `repo-gods-eye-view-1`）：72 筆事件（壅塞 59／施工 3／事故 1／其他 9）、453 個國道路段、均速 84 km/h，首次 6.0 s、快取命中 15 ms（Step 9 PBS 解耦後降為冷啟動 0.197 s、到期刷新 0.087 s，見第 5 點）。⚠️ 警廣 PBS（MOI）端點實測連線逾時，已自動降級，事件目前全來自高公局 TISVCloud `LiveEvents.xml`；3D 地球圖元渲染與點擊詳情卡於無頭瀏覽器未能實證。
- [x] **2. 將「臺灣航港局 `/api/taiwan-vessels` 9,000+ 艘船」打通至內建本機 MCP Server（已完成 ✅）**：已擴充 `taiwan_vessels_in_area` 與 `find_vessel` 工具，實測成功查詢台海 8,932 艘船舶 8 大分類統計與高雄港 30km 內 26 艘油輪（含 MMSI `416460000` DER YUN 單船反查與 `data.view` 3D 視角自動定位）。
- [x] **3. 台灣船舶「7 天滾動歷史航跡庫（Rolling Track Retention）」（已完成 ✅）**：採 NDJSON 滾動日誌（`.gev-cache/taiwan-tracks/YYYY-MM-DD.ndjson`，UTC+8 分檔、`0700/0600` 權限、逾 7 天自動清理）取代 SQLite；每次抓取以真實定位時間差量去重（航行船位移 ≥ 30 m 或間隔 ≥ 10 分鐘；停泊船 s < 0.5 節需位移 ≥ 150 m 或間隔 ≥ 30 分鐘以濾除 GPS 漂移）。新增 `/api/taiwan-vessel-tracks`（單船 `mmsi＋hours`、`mode=summary`、`since/until`）、`taiwan_vessel_track` MCP 工具（距離／平均與最大航速／straightness／疑似徘徊），面板新增「🗄️ 航跡庫」徽章、單船「🧭 歷史航跡」折線（6h／24h／7d、🎥 飛覽航跡）。同步修正資料契約：型號 33 歸 `special_ops`、無時區時間視為 UTC+8、COG ≥ 360 輸出 `null`。實測（2026-11-04，容器 `repo-gods-eye-view-1`，庫運行約 29 分鐘）：9,183 艘／18,541 點／2,219 KB；MMSI `100000225` 24h 取得 4 點、4.6 km、跨度 18 分；MCP 實呼叫 MMSI `416460000` 成功回傳。⚠️ 台海 24 小時縮時回放**未實作**；7 天磁碟佔用僅有 29 分鐘樣本（含首輪全船初始寫入），尚不足以外推；3D 折線已以截圖確認可見，容器重啟後持久化依賴 `.:/app` bind mount（已確認 `.gev-cache` 位於 repo 內）。
- [x] **4. 零付費 AI 參謀架構（本機 Ollama `gemma4:e4b` ＋ 唯讀個人存取權杖 PAT）（已完成 ✅）**：不依賴任何付費雲端 LLM；新增 `/api/taiwan-ai-advisor`、`/api/taiwan-ai-status`、`/api/taiwan-ai-token`，確定性檢索器＋白名單 Context（≤1,200 tokens）＋`Grounding Validator` 防幻覺（不通過即降級為確定性簡報）；PAT 僅存 SHA-256、僅顯示一次；右側戰情台新增「🧠 AI 戰情參謀」面板（連線燈、快捷提問、`think` 開關、Citations、PAT 管理）。實測（2026-11-04，容器 `repo-gods-eye-view-1`，重建後 `extra_hosts` 生效）：status `connected/ready=true`、model `gemma4:e4b`；提問「總結臺灣海域與國道整體態勢」`think=false` 耗時 47.2 s、`think=true` 耗時 9.1 s（含模型載入差異），兩次皆 `fallback_used=false`（Grounding 核驗通過）、Context 上限 1,118 tokens、檢索 8,808 艘船／53 件事件／453 路段；Playwright 實測面板渲染、快捷提問、Citations 展開、PAT 產生／撤銷皆正常、零 pageerror。另修復第一階段遺留 bug：`ollamaAdvisorProxy` 的 `configureServer` 回傳 connect app，被 Vite 當 post hook 呼叫而導致 dev server 啟動失敗。⚠️ 回答內容受 Validator 約束，實質等同確定性簡報的核驗版本，非自由生成；`ageMs` 與耗時為單次量測。
- [x] **5. 免金鑰高低頻分層快取與慢速源退避隔離（已完成 ✅）**：警廣 PBS 自 `build()` 解耦為非阻塞背景更新（成功快取 60 秒；失敗退避 1 小時不重試），不再每 60 秒被失聯的 `od.moi.gov.tw` 卡住 6,000 ms；靜態路網（Section／SectionShape）`STATIC_TTL_MS` 由 6 小時改為 24 小時（對齊高公局 `UpdateInterval = 86400` 每日校準），過期重抓失敗時退回記憶體舊路網，453 個國道路段車速不歸零。實測（2026-11-04，容器 `repo-gods-eye-view-1` 重啟載入新碼後實打 `/api/taiwan-traffic`）：冷啟動 **0.197 s**（修改前 6,047 ms）、快取命中 3.6 ms、60 秒到期刷新 **0.087 s**（修改前 6,007 ms）；主機直跑 `getTaiwanTraffic()` 為 225 ms／84 ms；453 路段、42～44 筆事件。新增 `taiwan-traffic.test.mjs`（8 項，`node --test` 全過，並以刪除回退邏輯的變異測試確認會失敗）。專案維持 **100% Keyless，不需 TDX 金鑰**。⚠️ PBS 端點仍連線逾時，事件仍全來自 TISVCloud；PBS 恢復後最久需等 1 小時才會重試；耗時為單次量測；此項採 Opus 審查「方案三」，取代原「TDX 每日校準」構想。

---

## 📦 歷次備份版本與修改說明（Backup & Changelog）

本專案嚴格遵守「每次修改前先完整備份」之工程紀律，所有歷史快照皆保存在 [`backup/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/) 目錄下，隨時可一鍵還原：

| 備份階段 | 備份目錄路徑 | 備份檔案清單 (`.bak`) | 修改內容與演進說明 |
| :--- | :--- | :--- | :--- |
| **Step 0 (Initial)** | `backup/ais-live.js.bak` | `ais-live.js.bak` | 初始探索階段：首次測試將航港局數據混入原版 `ais-live.js` 前之原始備份。 |
| **Step 1 (雙軌解耦)** | [`backup/step1/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step1/) | `ais-live.js.bak`<br>`local.js.bak`<br>`live.js.bak` | **後端雙軌數據源徹底解耦**：還原 `ais-live.js` 保持全球 AISStream 純粹性；於 `server/local.js` 獨立掛載 `/api/taiwan-vessels` 代理與 40 秒記憶體防擊穿快取。 |
| **Step 2 (戰情面板)** | [`backup/step2/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step2/) | `index.html.bak`<br>`scene.js.bak`<br>`views_index.js.bak` | **右側「臺灣海域船舶」專精戰情台**：掛載 `TaiwanVesselsPanel.vue` 與 `taiwanManager.js`，實作母開關、8 大船型獨立篩選、即時艘數徽章、單船情報卡與抽屜收折手柄。 |
| **Step 3 (微光學圖標)** | [`backup/step3/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step3/) | `taiwanIcons.js.bak` | **Awwwards 級 16 款微光學點陣圖標**：將動態 SVG 光柵化改為預先生成 48×48 PNG（含白金選取態），達成 WebGL Texture Atlas 1 次 Draw Call 合批渲染。 |
| **Step 4 (尺度治理)** | [`backup/step4/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step4/) | `taiwanManager.js.bak` | **Screen-Space 13.4px 固定像素與視距抽稀**：修復 92px 巨型圖標遮蔽海峽事故，鎖定 `scale: 0.28`（13.4px），並配置航行船 8,000km、停泊小船 280km 階梯顯示。 |
| **Step 5 (MCP 海事打通)** | [`backup/step5/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step5/) | `README.md.bak`<br>`readme.html.bak`<br>`services.js.bak`<br>`maritime.js.bak`<br>`index.js.bak` | **台灣航港局 9,000+ 艘船打通本機 MCP Server**：在修改前備份文件與 MCP 工具鏈；新增 `taiwanVessels` 服務與 `taiwan_vessels_in_area` 工具，並擴充 `find_vessel` 支援台灣船隻查詢。 |
| **Step 6 (台灣陸地動態補完)** | [`backup/step6/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step6/) | `README.md.bak`<br>`readme.html.bak`<br>`local.js.bak`<br>`taiwanManager.js.bak`<br>`TaiwanVesselsPanel.vue.bak`<br>`services.js.bak`<br>`index.js.bak`<br>`mobility.js.bak` | **高公局 TISVCloud 國道車速＋即時事件**：新增 `server/providers/traffic/taiwan-traffic.js` 並於 `server/providers/local.js` 掛載 `/api/taiwan-traffic`；面板新增路況開關與徽章；新增 `taiwan_traffic_events` MCP 工具（`queries/taiwanTraffic.js`）。 |
| **Step 7 (零付費 Ollama gemma4:e4b AI 參謀)** | [`backup/step7/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step7/) | `README.md.bak`<br>`readme.html.bak`<br>`compose.yaml.bak`<br>`local.js.bak`<br>`mpb-taiwan.js.bak`<br>`taiwan-traffic.js.bak`<br>`TaiwanVesselsPanel.vue.bak`<br>`tasks.md.bak` | **本機 Ollama `gemma4:e4b` AI 參謀**：新增 `server/providers/ai/*`（retriever／prompt／ollama-client／ollama-advisor）與 `TaiwanAiAdvisor.vue`；`compose.yaml` 加入 `extra_hosts` 與 `OLLAMA_*`；`data_health` 與哨兵值過濾。 |
| **Step 8 (台灣船舶 7 天滾動歷史航跡庫與資料契約修正)** | [`backup/step8/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step8/) | `README.md.bak`<br>`readme.html.bak`<br>`local.js.bak`<br>`live.js.bak`<br>`mpb-taiwan.js.bak`<br>`taiwanManager.js.bak`<br>`TaiwanVesselsPanel.vue.bak`<br>`maritime.js.bak`<br>`services.js.bak`<br>`index.js.bak` | **滾動歷史航跡庫**：新增 `taiwan-tracks.js`（儲存核心、統計、API）與 `taiwan_vessel_track` 工具；`mpb-taiwan.js` 修正型號 33／時區／COG；前端新增航跡折線與庫狀態徽章。 |
| **Step 9 (免金鑰分層快取與慢速源退避)** | [`backup/step9/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step9/) | `taiwan-traffic.js.bak`<br>`README.md.bak`<br>`readme.html.bak` | **PBS 解耦＋1 小時退避、靜態路網 24 小時快取＋過期失敗回退**：修改 `taiwan-traffic.js`，新增 `taiwan-traffic.test.mjs`；冷啟動 6,047 ms → 197 ms。 |
| **Step 10 (四份 HTML 文件全面更新)** | [`backup/step10/`](file:///Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view/backup/step10/) | `readme.html.bak`<br>`system-architecture.html.bak`<br>`gods-eye-view-summary.html.bak`<br>`gods-eye-view-analysis.html.bak`<br>`README.md.bak` | **文件重構**：重構系統架構白皮書（Mermaid＋SVG），補齊戰情指標、深層技術分析與戰情操作手冊；`evidence/` 保留量測腳本。 |
