# 上帝之眼（God's Eye View）全系統當前資源耗用實測與跨裝置移植硬體規格評估報告

> 量測日期：2026-11-05（Asia/Taipei，UTC+8）。對象為本專案目前的 Docker／Vite 開發部署、臺灣 AIS 船舶與路況子系統，以及主機原生 Ollama。以下將「實測」「推估」「建議驗收目標」分開標示。MB／GB 使用十進位，MiB／GiB 使用二進位；記憶體採購規格沿用廠商 GB 標示。

## 01｜部署結論與決策摘要

**若要同一台電腦同時運行近萬艘船舶的 3D 戰情台與本機 AI，建議以 32 GB 記憶體為採購起點。** 目前 Apple M4／16 GB 確實能執行，但同日 AI 測試前後的系統 swap 從 4,833.94 MiB 增為 10,411.38 MiB，不能將「可以啟動」等同於「足以全天候執勤」。這是整台主機的觀察，包含其他應用程式，尚不能把全部增量歸因於本系統。

| 核心指標 | 實測數值 | 部署上的意義 |
| --- | --- | --- |
| 磁碟｜應用映像 | 1.54 GB；內容大小 433 MB | 另計原始碼、Docker volume、建置快取與 AI 模型 |
| RAM｜本機 AI 載入 | 9.42 GB，約 8.77 GiB | Apple 統一記憶體由 CPU／GPU 共用，不要重複加總 |
| CPU｜容器當前快照 | 2.80%；983.7 MiB／7.748 GiB | CPU 100% 約相當一個邏輯核心；此值不是整台主機負載 |
| GPU｜近萬艘船旋轉 | 41.40 FPS；43.22 次 Draw Calls／幀 | 同日主量測為 9,976 艘、1920×1080、Metal 硬體繪圖 |

**最低 MVP** 可先以 8～16 GB、4 核心與支援 WebGL2 的整合顯示核心執行資料與地圖，關閉同機大型 AI。**Standard** 採 32 GB、8 核心以上與足夠 GPU 餘裕。**24/7 指揮中心** 採 64 GB 以上、獨立推論資源、SSD 與備份機制；更大的主機仍需要值勤與復原設計。

### 🚀 跨裝置移植三級硬體規格對比速查卡片 (Hardware Specs Fast Reference)

| 規格項目 | 🟢 最低 MVP | 🔵 推薦 Standard | 🟣 旗艦 Command Center |
| --- | --- | --- | --- |
| CPU | 現代 4 核心 | 8 核心以上（如 Core i7／Ryzen 7） | 12～24 核心 |
| RAM | 8～16 GB | **32 GB** | 64～128 GB |
| GPU／VRAM | 硬體 WebGL2 整合 GPU；AI 遠端或關閉 | 獨顯 16 GB VRAM 起評估（如 RTX 4060 Ti 16GB），或 Apple 32 GB 統一記憶體 | VRAM 24～48 GB 起；顯示與推論分機 |
| SSD | 128 GB（可用 ≥40 GiB） | 512 GB～1 TB NVMe（可用 ≥65 GiB） | 1 TB 以上 NVMe＋備份另碟 |
| 網路頻寬 | 下行 10 Mbps 以上 | 下行 50 Mbps 以上 | 100～300 Mbps 以上；有線＋備援 |

以上是由單機 M4 實測推導的採購起點，並非逐台實測；x86 平台細節見 [第 09 章 x86 專題](#hardware)。

## 02｜量測邊界、方法與環境

| 項目 | 本次環境與取樣方式 |
| --- | --- |
| 主機 | MacBook Pro（Mac16,1）；Apple M4，10 核心 CPU、10 核心 GPU、16 GiB 統一記憶體 |
| 作業系統 | macOS 27.2；Darwin arm64 |
| Docker | Desktop 4.98.0；Engine 29.9.2；Linux arm64 映像；VM 可用 10 CPU、7.748 GiB RAM |
| 部署型態 | `repo/compose.yaml`；Node＋Vite 開發伺服器與 API 同容器，原始碼 bind mount；主機 Ollama 經 `host.docker.internal:11434` 連接 |
| 瀏覽器 | Playwright 控制獨立 Chrome 156.0.8078.81，前景、有視窗、1920×1080、DPR 1、resolutionScale 1 |
| GPU 驗證 | `ANGLE Metal Renderer: Apple M4`；未使用 SwiftShader；瀏覽器的 GPU 工作在用戶端，並非 Node 容器內 |
| 場景 | 3D 地球、臺灣船舶；動態測試每個動畫回呼旋轉相機 0.00012 rad；各情境觀察 15 秒 |
| 首輪資料 | 06:58 起的主機快照；約 07:02～07:09 的瀏覽器與 AI 量測，保留原始 JSON |
| 接續複核 | 07:44 的磁碟／容器／模型快照；另留當前瀏覽器複測與獨立 HTTP 快取測試 |

FPS 以 Cesium `scene.postRender` 的實際繪製幀數除以觀察時間計算；`requestAnimationFrame` 的回呼頻率另列，兩者不可混用。Draw Calls 由 WebGL／WebGL2 的 draw 方法計數，含地球、底圖與其他繪製工作。DOM 同時記錄 `querySelectorAll('*')` 元素數與 CDP 節點數。

主量測為單一主機、短時間樣本；並未完成 24 小時持續測試、多用戶壓力測試、4K 多螢幕、全部圖層同開、CCTV 多路解碼或多模態 AI 推論測試。容器遙測每輪需執行數個指令，約每 2～3 秒得到一筆，而非精準每秒取樣；取樣本身也有開銷。其他正在執行的桌面應用與系統圖形工作會影響 GPU／swap 數值。

資料來源：[host.json](docs/resource-evaluation/2026-11-05/host.json)、[browser.json](docs/resource-evaluation/2026-11-05/browser.json)、[current-check.json](docs/resource-evaluation/2026-11-05/current-check.json)。

## 03｜資源分佈與架構邊界

這張圖說明運算負擔實際落在哪裡，協助判斷該升級伺服器、顯示端或 AI 主機。

```mermaid
flowchart TD
    U["航港局 AIS／高公局路況"] -->|"HTTPS／按需刷新"| API["Docker：Node＋Vite API"]
    API -->|"每 40 秒船位快照"| WEB["用戶端：Chrome＋Cesium"]
    WEB --> GPU["用戶端 GPU：地球與船舶"]
    API -->|"差量寫入"| DISK["NDJSON 航跡庫：7 天政策"]
    API --> RAM["RAM 索引：最近 24 小時"]
    WEB -->|"AI 參謀請求"| API
    API -.->|"本機 HTTP"| AI["主機 Ollama：gemma4:e4b"]
    AI --> UMA["Apple 統一記憶體＋GPU"]
    classDef service fill:#112d46,stroke:#38bdf8,color:#e2e8f0,stroke-width:2px
    classDef client fill:#113c3b,stroke:#2dd4bf,color:#d1fae5,stroke-width:2px
    classDef storage fill:#352745,stroke:#c084fc,color:#f3e8ff,stroke-width:2px
    classDef ai fill:#422e1e,stroke:#fbbf24,color:#fef3c7,stroke-width:2px
    class API service
    class WEB,GPU client
    class DISK,RAM storage
    class AI,UMA ai
```

這是目前單機部署的資源分界；Ollama 連線是選配。遠端瀏覽器會把 3D GPU 負載移到遠端裝置；單純升級 Node 伺服器無法保證手機繪圖更快。主機 GPU 的全域利用率也不能直接當作某一個程式的 GPU 利用率。

依原始碼，航跡檔保留政策為 7 天，RAM 索引只留最近 24 小時，每艘最多 360 點；較長時段查詢需掃描檔案。單船回傳最多抽稀至 2,000 點。這能限制常駐索引，但 7 天資料成長後的查詢延遲仍需另測。資料更新與記錄由請求觸發，沒有啟用中的用戶端或排程採集器時，不能假設航跡會持續收集。

原始碼依據：[taiwan-tracks.js](server/providers/vessels/taiwan-tracks.js)、[mpb-taiwan.js](server/providers/vessels/mpb-taiwan.js)、[taiwanManager.js](src/layers/taiwanVessels/taiwanManager.js)。

## 04｜磁碟空間：把應用、歷史與模型分開算

07:44 的 `du -sk` 為已配置空間；此快照拍攝於新增本報告與驗證截圖之前。目錄有包含關係，不能把所有列直接相加。

| 儲存對象 | 實測大小 | 判讀 |
| --- | --- | --- |
| 專案根目錄 | 935,864 KiB＝913.93 MiB | 已包含 `repo/`、既有報告、圖片與備份 |
| `repo/` | 840,600 KiB＝820.90 MiB | 已包含本機依賴、Git 與 `.gev-cache` |
| `repo/node_modules/` | 466,068 KiB＝455.14 MiB | 主機依賴；容器另有 Linux 版匿名 volume |
| `repo/.git/` | 188,184 KiB＝183.77 MiB | Git 歷史，不是執行期 RAM |
| 原始工作樹 | 邏輯 154,821,722 B＝147.65 MiB；配置 153.80 MiB | 06:58 掃描；排除依賴、Git、執行快取、量測成果 |
| `repo/.gev-cache/` | 22,544 KiB＝22.02 MiB | 包含航跡、地形高度與衛星等快取；根目錄沒有獨立 `.gev-cache/` |
| 航跡檔目錄 | 配置 11,652 KiB＝11.38 MiB；邏輯 11.04 MiB | 只有 2 個日期檔，尚未累積完整 7 天 |
| Docker 應用映像 | 1,540,974,114 B，約 1.54 GB／1.44 GiB | `docker images` 內容大小另列 433 MB，兩個數字不可相加 |
| Docker 全域環境 | volumes 4.979 GB，其中 4.526 GB 可回收；build cache 1.744 GB | 共有 11 個 volume，不能全算本系統必要容量；此次未清除 |
| 單一 AI 模型 | 邏輯 9,461,576,343 B＝9.46 GB／8.81 GiB；配置約 8.82 GiB | 同 digest 別名共用 blob，不可重算成兩份模型 |
| 全部本機 Ollama 模型 | `du -sh` 約 46 GiB | 個人其他模型也在其中；不是移植本專案必帶的容量 |

### 航跡庫實際資料與每日外推

| 檔案 | 邏輯大小 | 點數 | 檔內最早～最晚定位時間（臺灣時間） |
| --- | --- | --- | --- |
| `2026-11-04.ndjson` | 3,445,282 B＝3.29 MiB | 28,126 | 11/04 21:44:45～22:22:13 |
| `2026-11-05.ndjson` | 8,130,606 B＝7.75 MiB | 66,772 | 11/05 00:45:55～07:41:05 |
| 合計 | 11,575,888 B＝11.04 MiB | 94,898 | 首尾約 9.94 小時，期間有收集空窗 |

API 摘要當時顯示 15,378 個歷史 MMSI、94,898 點、2 檔、`retentionDays=7`、損壞行 0。**歷史 MMSI 去重數不等於當前在席船數。** `diskKB=11,305` 是摘要依檔案長度換算的值，與檔案系統配置空間不同；檔案仍在寫入，依序讀取也可能略有時間差。

平均每行約 **121.98 B，外推取 122 B／點**。下列數字均為容量推估：

- **全時段平均外推**：11.04 MiB ÷ 9.94 小時 × 24 ≈ **26.66 MiB／日**；7 天約 **186.61 MiB**。期間有空窗，可能低估連續執行量。
- **短期增量外推**：06:58 摘要約 8.285 MiB，07:44 約 11.040 MiB；約 46 分鐘的增量換算為 **86 MiB／日**，7 天約 **602 MiB**。此時包含驗證請求與較頻繁的實際更新，不是長期平均。
- **時間門檻情境**：假設 10,000 艘全為航行船，全部每 10 分鐘留 1 點，`10,000 × 144 × 122` ≈ **167.54 MiB／日**；7 天約 **1.15 GiB**。這不是上限，因為位移達 30 m 也會記錄。
- **高變動規劃情境**：假設 10,000 艘每 40 秒都有新定位，且每次都通過差量門檻，`10,000 × 2,160 × 122` ≈ **2.45 GiB／日**；7 天約 **17.18 GiB**。以日檔清理時最多可能跨 8 個日檔，約 **19.63 GiB**；加 25% 餘裕約 **24.54 GiB**，建議另留 **30 GiB 航跡空間**。這是以 122 B／點及固定船數假設的規劃值，並非資料格式的絕對上限。

差量規則為：航行船位移至少 30 m **或**間隔至少 10 分鐘；低於 0.5 節的停泊／慢船為 150 m **或**30 分鐘。重複或倒退的定位時間會跳過。因清理以「日期小於 7 天前」判斷，實體檔案可能保留 8 個日期，不能把標示 7 天理解為磁碟上恰好只有 168 小時資料。

移植時，建議先預留 **應用與建置 10 GiB＋單一 AI 模型與更新餘裕 20 GiB＋航跡 30 GiB＋瀏覽器與日誌 5 GiB＝65 GiB 可用空間**，另計 OS、swap 與備份。這是保守作業預算，不是目前的實際佔用量；MVP 不帶 AI 可減少模型預算。參考資料：[current-check.json](docs/resource-evaluation/2026-11-05/current-check.json)、[host.json](docs/resource-evaluation/2026-11-05/host.json)。

## 05｜Docker 容器：CPU、RAM、網路與磁碟 I/O

| 觀察情境 | CPU（Docker %） | 記憶體 | 樣本／備註 |
| --- | --- | --- | --- |
| 07:44 當前快照 | 2.80% | 983.7 MiB／7.748 GiB，12.40% | 一次快照，不代表全天平均 |
| 9,000 艘、靜止 | 平均 25.08%；20.29～32.66% | 平均 956.96 MiB | 15 秒、7 筆，含遙測開銷 |
| 9,000 艘、旋轉 | 平均 41.97%；22.63～118.41% | 平均 957.67 MiB | 15 秒、7 筆；旋轉本身在瀏覽器執行 |
| 9,000 艘＋路況、靜止 | 平均 22.50%；19.85～24.77% | 平均 961.66 MiB | 27 筆事件、453 路段；7 筆 |
| AI 首次請求期間 | 平均 35.01%；15.18～109.97% | 平均 962.09 MiB | 16 筆；模型推論在主機，不在此容器 |

本次 Compose 未設定容器獨立的 `memory` 或 CPU 配額：`Memory=0`、`NanoCpus=0`。顯示的 **7.748 GiB 是 Docker Linux VM 的可用上限**，不是此容器已預先吃掉 7.748 GiB，也不是主機有額外一份同大小 RAM。Docker CPU 100% 約代表使用一個邏輯核心，118% 約 1.18 核心。

07:44 的 `docker top` 行程 RSS 合計為 `(603,464＋301,796) KiB`，約 **884.04 MiB**。同時 cgroup `memory.current` 約 **1,060.07 MiB**、匿名記憶體 `anon` 約 **819.61 MiB**。Docker stats 的工作集記憶體會排除部分檔案快取，RSS 加總也可能重複計算共享頁，因此三者並不是相同指標；不要把 `docker stats` 的 983.7 MiB 直接標為精確 RSS。[Docker stats 官方定義](https://docs.docker.com/reference/cli/docker/container/stats/)

同一快照的 **網路 I/O 為接收 244 MB／傳送 705 MB**，**Block I/O 為讀取 111 MB／寫入 49.4 MB**；這些都是容器自啟動以來的累積量，不是 MB/s。它們也不涵蓋主機 Ollama 模型讀取、瀏覽器快取或主機 swap，bind mount 寫入的歸屬亦受 Docker Desktop I/O 路徑影響。主量測期間一段約 55 秒的 AI 首次請求，網路計數約增加接收 9 MB／傳送 8 MB；包含其他請求，不能當作 AI API 本身的封包量。

伺服器 RAM 可以先以 **2 GiB 作為服務預算、Docker VM 4 GiB 起測**，再保留建置與突發餘裕；這是驗收起點，未實際套用資源限制。此環境是 Vite 開發模式，不能直接把以上耗用當作正式打包部署結果。資料：[distributions.json](docs/resource-evaluation/2026-11-05/distributions.json)、[container-processes.txt](docs/resource-evaluation/2026-11-05/container-processes.txt)。

## 06｜本機 Ollama：模型規格與推論成本

### 模型身分與載入記憶體

| 項目 | 本機實測 |
| --- | --- |
| 模型名稱／digest 前綴 | `gemma4:e4b`／`5a08735df03c`；同 digest 別名 `gemma4:e4b-mlx` |
| 格式與後端 | safetensors；`runner=mlx`；`quantization_level=nvfp4`（以 `/api/show` 為準） |
| 參數數量 | `/api/show` 為 8.1B，`general.parameter_count=8,074,934,862`；42 layers、embedding 2560 |
| 模型與執行期 context | metadata 上限 131,072；本次實際載入 context 4,096。沒有測試 128K 記憶體需求 |
| 模型下載／檔案 | 9.46 GB（8.81 GiB） |
| 推論後載入大小 | `/api/ps` 的 `size`／`size_vram` 約 9.404～9.421 GB；約 8.76～8.77 GiB |
| CLI 狀態 | `ollama ps` 為 `100% GPU`，表示模型 GPU 放置狀態，不代表 GPU 一直滿載 |
| 版本 | server 0.40.14、CLI 0.40.13；有小版差異，移植時應記錄並對齊版本 |
| 07:44 複核 | `/api/ps` 為空陣列；當時模型已卸載，前述大小是推論期間觀察 |

E4B 名稱中的 E 是 effective；Google 官方模型卡列出約 4.5B effective、含 embedding 約 8B。本機回報的精確參數數量以實際檔案 metadata 為準。**不能用「4B×4 bit」直接推導這份多模態 MLX 模型只有 2 GB。** NVFP4 是量化標示，不代表所有張量、編碼器、執行期緩衝與 KV cache 都以同一位元數儲存。[Gemma 4 官方模型卡](https://ai.google.dev/gemma/docs/core/model_card_4)

Apple M4 採統一記憶體；`size_vram` 是後端回報的 GPU 配置／模型載入估值，與系統 RAM 共用實體記憶體，不能再把 RAM＋VRAM 各加 9.42 GB。這也不是獨立量測到的 GPU 常駐實體頁數。移植到 NVIDIA／AMD 獨立顯示卡時，主機 RAM 與 VRAM 才是分開的容量池；模型格式、後端與量化改變後須重新量測。[Ollama 執行中模型 API](https://docs.ollama.com/api/ps)

### 有界文字推論實測

測試時維持 9,000 艘船舶＋路況頁面開啟、相機靜止。直接呼叫 Ollama `/api/chat`，相同 61-token 提示、`think=false`、`temperature=0`、`num_predict=256`、非串流；兩次皆輸出 256 tokens，`done_reason=length`，因此是截斷的效能樣本，未評估內容品質。

| 指標 | 首次請求（模型先前未載入） | 緊接重複提示（暖機＋提示快取） |
| --- | --- | --- |
| 用戶端端到端時間 | 54.546 秒 | 7.449 秒 |
| API total duration | 54.515 秒 | 7.429 秒 |
| 模型載入時間 | 12.949 秒 | 0.026 秒 |
| Prompt evaluation | 33.092 秒；0 cached tokens | 0.0025 秒；60 cached tokens |
| 生成時間／吞吐 | 8.469 秒／30.23 tokens/s | 7.382 秒／34.68 tokens/s |
| 主機全域 GPU 利用率 | 平均 53%，42～96%，16 筆 | 平均 80%，48～96%，3 筆 |
| Ollama 行程 CPU 觀察值 | 平均 20.83%，最高 49.7% | 平均 28.97%，最高 54.8% |

CPU 數字來自 `ps %cpu` 的行程觀察值與加總，並非整台主機 CPU 百分比，也不是精準的每秒增量計時。GPU 來自 `ioreg`，包含桌面與其他程式；暖機只有 3 筆樣本，不能由此計算可靠的長期負載。**7.449 秒的結果包含提示快取命中，不代表所有新問題都能在 7.5 秒內回答。** 非串流測試沒有量到首 token 延遲（TTFT）。

同日 AI 前後 swap 從 4,833.94 MiB 增至 10,411.38 MiB，約增加 **5.45 GiB**；07:44 快照仍使用 9,066.38 MiB swap，但模型當時已卸載。swap 會留存舊頁面，這不能直接等同於當下缺少多少 RAM。它顯示現有多工環境餘裕不足，適合作為升級與隔離負載的依據。

### 單機 RAM 預算（推估）

以同一台 Apple 統一記憶體裝置估算：OS 與一般桌面 4～6 GiB＋Docker VM 工作集及餘裕 2～4 GiB（含 Node 容器）＋瀏覽器／圖形 1～2 GiB＋AI 載入 8.77 GiB＋安全餘裕 3～5 GiB，合計約 **19～26 GiB**。因此 32 GB 是較合理的獨立單機起點；24 GB 需控制背景程式、context 與同時工作數。瀏覽器 1～2 GiB 是預算，並非這次實測的整體 RSS。

原始證據：[ollama.json](docs/resource-evaluation/2026-11-05/ollama.json)、[host.json](docs/resource-evaluation/2026-11-05/host.json)。

## 07｜Cesium：近萬艘船舶的實際繪圖負擔

### 同日主量測

| 情境（15 秒） | 船舶數 | 實際 FPS | Draw Calls／幀（平均／P95） | `performance.memory` 使用量 |
| --- | --- | --- | --- | --- |
| 即時船舶、靜止 | 9,976 | 1.00 | 29.00／29 | 173.49 MB（165.45 MiB） |
| 即時船舶、旋轉 | 9,976 | 41.40 | 43.22／45 | 179.87 MB（171.54 MiB） |
| 同頁暖機後暫移除船舶、旋轉 | 0 | 42.00 | 42.29／44 | 167.31 MB（159.56 MiB） |
| 固定真實快照、靜止 | 9,000 | 0.00 | 無繪製，不定義每幀值 | 176.29 MB（168.13 MiB） |
| 固定真實快照、旋轉 | 9,000 | 39.33 | 43.29／45 | 181.17 MB（172.78 MiB） |
| 固定快照＋路況、靜止 | 9,000 | 1.00 | 47.00／47 | 178.82 MB（170.53 MiB） |

9,000 艘測試由當日實際 AIS 快照截取，未複製船舶灌水；測試期間暫停該頁輪詢以固定樣本。0 艘情境仍保留同頁其他配置與快取，因此不能當作全新空白地球的純淨基準；同時也顯示此視角的地球／底圖本身占了大部分 Draw Calls。兩個船數的測試不是同時、同樣熱狀態的嚴格控制實驗，不能據此推論 9,976 艘反而必然比 9,000 艘更快。

**閒置約 0～1 FPS 是按需繪製的節能行為。** `requestRenderMode=true` 時，沒有相機或資料變化就不必繪製新幀；這不是操作卡頓。9,976 艘旋轉時每幀間隔 P50 約 24.1 ms、P95 約 28.1 ms。原本「約 41～42 FPS」是此次特定場景的觀察，不是所有 9,000～10,000 艘情境的保證；固定 9,000 艘也實際量到 39.33 FPS。

### Heap、DOM 與計數定義

- 主頁一般元素數為 **2,605**；加路況後 **2,617**。這對應「約 2,600 個元素」，不等於 CDP 的全部節點數。
- CDP `Memory.getDOMCounters` 在 9,000 艘旋轉樣本為 **7,347 nodes、8 documents**，9,976 艘旋轉為 7,413 nodes。包括文字、文件及其他 DOM 節點，和元素選取器口徑不同。
- 「JS Heap 約 181 MB」來自 `performance.memory.usedJSHeapSize=181,170,573 B`。同樣本 CDP V8 `usedSize` 約 **104.05 MiB**，`backingStorageSize` 約 **68.76 MiB**，兩者量級可解釋 API 口徑差異，但不宣稱所有情境都能精確相加相等。
- 上述 Heap **不包含整個 Chrome 的 renderer／GPU process RSS、WebGL texture／framebuffer 與所有原生配置**，因此不能直接拿 181 MB 當成瀏覽器完整 RAM 需求。
- 船舶資料筆數、`billboard.show=true` 數量與當下真正可見的船舶像素數不同；仍有視錐、地球遮蔽與視距抽稀。這是近萬筆在席資料的測試，不是近萬艘同時出現在畫面上的保證。
- 船舶 Texture Atlas 有助合批，但整個場景約 43～45 次 Draw Calls／幀；此次沒有獨立標記船舶 pass，不能把全場景寫成 1 Draw Call，也不能宣稱已實證船舶層固定只用 1 次。

### 接續複測

| 接續情境 | 船舶數 | 實際 FPS | 平均／P95 Draw Calls | Heap（MB） |
| --- | --- | --- | --- | --- |
| 即時船舶、靜止 | 9,911 | 1.07 | 45.00／45 | 176.84 |
| 即時船舶、旋轉 | 9,911 | 48.20 | 43.13／45 | 178.70 |
| 固定快照、靜止 | 9,000 | 1.00 | 45.00／45 | 176.95 |
| 固定快照、旋轉 | 9,000 | 48.47 | 43.07／45 | 176.16 |

此輪於 07:46 起測，未同步執行首輪的主機遙測迴圈；9,911 艘旋轉量得 48.20 FPS，固定 9,000 艘為 48.47 FPS，頁面 JavaScript 錯誤 0。較首輪改善可能涉及遙測開銷、背景負載與快取狀態，尚未做單因子控制實驗。

接續複測沿用相同量測程式與硬體渲染路徑，另存 [current-browser.json](docs/resource-evaluation/2026-11-05/current-browser.json)。不同時段的 GPU 競爭、圖磚快取與背景負載會改變 FPS，因此報告保留兩輪數值，沒有把單一數字當作硬體性能保證。

![9,000 艘真實快照的前景 Chrome 戰情台](docs/resource-evaluation/2026-11-05/taiwan-9000.png)

圖：同日主量測的 9,000 艘快照畫面。截圖只用於說明測試場景，FPS／記憶體仍以原始遙測為準。

## 08｜網路傳輸與下行頻寬建議

### 封包與瀏覽器資源

| 對象 | 實測傳輸／內容大小 | 解讀 |
| --- | --- | --- |
| 航港局 AIS 原始回應 | 3,820,122 B，約 3.82 MB；1.179 秒 | 本次未壓縮；單次成功抓取 |
| 本機船舶代理 JSON | 4,423,299 B，約 4.42 MB；9,823 艘 | 轉換後欄位增加；與其他時刻船數不同屬正常 |
| 高公局即時事件 | gzip 傳輸 2,116 B；解碼 22,730 B | 單次量測，不含所有路況資料 |
| 高公局即時車速 | gzip 傳輸 7,007 B；解碼 336,429 B | 另有路段與線形資料 |
| 高公局路段／線形 | 壓縮傳輸約 16.3 KB／328.1 KB | 不應每輪當成完全沒有快取而無限重算 |
| 本機路況代理 | 113,901 B，約 0.114 MB | 當時 20 事件、453 路段 |
| Chrome 首輪冷載入 | CDP 完成請求累計 86.09 MB；1,648 個請求 | 約 14.53 秒的應用就緒＋等待窗；含 localhost 與外部資源 |
| 同一非持久 context 重載 | CDP 約 57.56 MB | 此量測未證明充分使用磁碟快取，不能當作長期暖載入最低值 |
| 獨立持久 profile 冷／暖載入 | CDP 約 80.86 MB／9.61 MB | 各次導頁後觀察 15 秒；暖載入 350 個 response 命中 disk cache |

持久 profile 快取測試的暖載入後，HTTP Cache、Code Cache、GPUCache 合計邏輯約 **138.19 MiB**、配置約 **145.96 MiB**。檔案在瀏覽器執行時量測，邏輯與配置可能因稀疏檔、延遲配置與寫入時間差而不同；不是最終穩態，也不是所有裝置的固定上限。

`performance.getEntriesByType` 的 Resource Timing 約 71 MB 只是其中一種觀察口徑；跨來源沒有 Timing-Allow-Origin 的回應、快取命中與尚未完成的資源可能呈現 0。本文的冷載入主數字採 CDP `Network.loadingFinished.encodedDataLength` 累計；它仍不是作業系統網卡上包含 TCP／TLS／WebSocket 等全部流量的封包擷取。**localhost 的大量 Vite 模組也不是 WAN 下行量。** 主量測採開發模式，尚未測試正式 bundle／壓縮／CDN 後的大小。

PBS 端點本次 40 秒連線逾時；不能標為已成功連通，也不能把無回應的 0 B 當成其正常傳輸成本。其他交通來源正常回應。原始資料：[network.json](docs/resource-evaluation/2026-11-05/network.json)、[cache.json](docs/resource-evaluation/2026-11-05/cache.json)。

### 頻寬推估與多裝置效應

若持續請求觸發刷新，AIS 以 3.82 MB／40 秒估算：`3.82 × 8 ÷ 40` ≈ **0.764 Mbps 平均下行**，約 8.25 GB／24 小時。這是假設一直拿到同樣大小完整回應的推估，不含底圖、其他來源、重試與傳輸協定開銷。4.42 MB 代理每 40 秒分送一個用戶端，約 **0.885 Mbps／用戶端**；N 個遠端用戶端約 N 倍伺服器對外／LAN 傳送，公共源請求則受 40 秒快取與合併鎖保護。多用戶 JSON 解析與序列化仍有 CPU 成本。

| 使用情境 | 建議下行／連線 | 規劃假設 |
| --- | --- | --- |
| MVP 邊緣端 | 穩定 10 Mbps 以上；有線或良好 Wi-Fi | 單一 1080p 地圖、AIS／路況；不開多路 CCTV；冷載入較慢可接受 |
| Standard 獨立單機 | 50 Mbps 以上；區網 1 GbE | 預留圖磚瀏覽、模型更新與單路影像；50 Mbps 傳 86 MB 理想約 14 秒，但其中 localhost 流量不走 WAN |
| 24/7 指揮中心 | 100～300 Mbps 以上，區網 1 GbE 起 | 多個席位與影像並行；依實際串流碼率追加、備援線路另規劃 |

以上為**工程建議，非頻寬壓力實測結果**。影像另以 `同開路數 × 實際碼率 × 1.3` 預留，例如假設 4 路各 4 Mbps，需約 20.8 Mbps；這不是本案 CCTV 的已測碼率。多席位還要評估伺服器上行，不能只看下行；首次 AI 模型下載約 9.46 GB 是一次性大流量，本機文字推論不需要每次把模型傳上網。

## 09｜跨裝置硬體矩陣：三級情境

**以下均是由單一 M4 實測推導的採購與驗收起點；除本機 M4 外，未逐台實測。** 以記憶體容量、驅動支援與工作分工為優先，不用 CPU 型號承諾 FPS。

| 規劃項目 | 最低 MVP 邊緣端 | 推薦 Standard 獨立單機 | 指揮中心 24/7 旗艦 |
| --- | --- | --- | --- |
| 工作邊界 | 單人 1080p、AIS／路況、少量航跡；AI 遠端或關閉 | 近萬筆 AIS＋路況＋單一文字 AI 工作 | 多席位、多螢幕、長時間值勤、AI 排程與復原 |
| CPU | 現代 4 核心；x86-64／ARM64 | 現代 8 核心以上 | 12～24 核心；資料服務與推論可分機 |
| 系統 RAM | 8 GB 為受限起點；16 GB 較穩妥 | **32 GB 建議**；Apple 24 GB 需限制多工 | 64～128 GB；Apple 統一記憶體 64～96 GB 起評估 |
| 顯示／推論 GPU | 硬體 WebGL2 整合 GPU；不承諾 40 FPS | Apple M 系列 GPU，或支援後端的獨顯；推論 VRAM 以 16 GB 起評估 | 推論 VRAM 24～48 GB 起；顯示與推論資源分開；長 context／並行另測 |
| AI | 不以同機載入這份 9.42 GB 模型為目標 | 這份 MLX 模型限適用後端；跨平台重選對應模型格式 | 模型常駐、工作佇列、並行限制；單純增加 VRAM 不保證多工吞吐 |
| SSD 裝置容量 | 128 GB SSD；可用空間至少 40 GiB（不帶 AI） | 256～512 GB NVMe；可用空間至少 65 GiB | 1 TB 以上 NVMe；備份另碟、保留至少 20% 餘裕 |
| 顯示配置 | 單螢幕 1080p | 1080p～1440p；4K 須重新驗收 | 4K／多螢幕獨立測試，不能把 1080p FPS 直接套用 |
| 網路下行 | 10 Mbps 以上 | 50 Mbps 以上 | 100～300 Mbps 以上；有線、備援連線 |
| 建議驗收目標 | 旋轉 ≥20 FPS；無記憶體耗盡；資料健康可見 | 1080p 旋轉 ≥30 FPS；AI 期間畫面可操作；新提示延遲另量 | 24 小時以上負載測試；更新、備份、故障復原與資料時效驗收 |

MVP 可考慮小型 x86 主機或 8～16 GB ARM 裝置，但 CPU 架構相同不代表 GPU 驅動與圖磚效能相同。沒有顯示端的 Linux server 仍可提供 API，瀏覽器渲染則由遠端席位承擔。若預定使用無風扇設備，必須檢查連續負載的溫度與降頻；本次未量測功耗或熱節流。

Standard 在 x86 獨顯平台可採 **32 GB RAM＋16 GB VRAM** 作為起點，與 Apple 的 32 GB 統一記憶體不是等價可互換的容量公式。MLX NVFP4 的大小與吞吐不能直接移植到 GGUF／CUDA／ROCm；須重測所選檔案的載入、prompt、生成與 GPU 競爭。[Ollama 硬體支援清單](https://docs.ollama.com/gpu)

旗艦如需不中斷值勤，應採兩個可復原服務節點或備援主機、UPS、時間同步、日誌輪替、容量告警與離機備份；目前系統沒有在本次工作中新增這些能力。此處是硬體及維運規劃，不宣稱已具有高可用架構。7 天單船查詢現在會掃描 NDJSON，若多席位頻繁查詢，可先量測再決定是否新增索引／資料庫。

### x86 專題：Ubuntu＋Docker 與 Windows 11＋WSL2

以下依預定的 x86 平台（Ubuntu 或 Windows WSL2，搭配 Docker）整理。**數值為規劃建議與推估，本案未在這兩種 x86 環境實測**；容器記憶體節省比例、GPU 效能需在目標機器以實際快照驗收。

#### x86 Ubuntu 22.04／24.04 LTS＋Docker 原生環境（性價比首選）

- **容器開銷：** Docker 在 Linux 原生執行，沒有 macOS／Windows 必備的 Linux VM，容器記憶體開銷估計比 macOS 少約 25～30%（推估，未實測）。
- **本機 Ollama：** 搭配 NVIDIA 獨立顯卡（如 RTX 3060 12GB、RTX 4060 Ti 16GB、RTX 4070），安裝 NVIDIA 驅動與 `nvidia-container-toolkit`（容器內推論），或直接在宿主機安裝原生 Ollama；CUDA 後端支援最完整。Ollama 在宿主機時，容器需另測到宿主機的連線與綁定位址。
- **CPU：** Intel Core i7-12700／i7-13700，或 AMD Ryzen 7 5700X／7700（8C／16T）。
- **RAM：** 32 GB DDR4／DDR5；模型放在 GPU VRAM 時，系統 32 GB 相當充裕。

#### x86 Windows 11＋WSL2／Docker Desktop 環境（企業與辦公桌面）

- **WSL2 後端：** Docker Desktop 啟用 WSL2 後端。WSL2 預設會動態使用最多約 50% 實體 RAM，建議在 `%USERPROFILE%\.wslconfig` 限制，避免記憶體膨脹：

```ini
[wsl2]
memory=16GB
processors=8
```

  修改後執行 `wsl --shutdown` 再重啟 Docker Desktop 才會生效。
- **Ollama：** 建議安裝 Windows 原生版 Ollama（可直接使用 NVIDIA CUDA 加速），Docker 內的 Node.js 後端經 `http://host.docker.internal:11434`（Docker Desktop 提供）連到宿主機 Ollama，不把推論放進 WSL2 內部；連線與 GPU 放置須實測。
- **CPU：** Intel Core i7 第 12～14 代，或 AMD Ryzen 7。
- **RAM：** 實體 32 GB；Windows 本身、WSL2 與 Chrome 需要更多餘裕。專案放在 WSL Linux 檔案系統，不放在 `/mnt/c`。

#### x86 硬體型號對照表（規劃範例）

| 項目 | Ubuntu＋Docker 原生（Standard） | Windows 11＋WSL2（Standard） | 旗艦（Command Center） |
| --- | --- | --- | --- |
| CPU | Core i7-12700／13700 或 Ryzen 7 5700X／7700 | Core i7 12～14 代或 Ryzen 7 | 12～24 核心工作站級 CPU |
| RAM | 32 GB DDR4／DDR5 | 32 GB；`.wslconfig` 限 `memory=16GB` | 64 GB 以上 |
| GPU／VRAM | RTX 3060 12GB、RTX 4060 Ti 16GB 或 RTX 4070 | RTX 3060 12GB 或 RTX 4060 Ti 16GB（Windows 原生 Ollama） | 24～48 GB VRAM 級顯卡；顯示與推論分機 |
| SSD | 1 TB NVMe | 1 TB NVMe | 1 TB 以上 NVMe＋備份碟 |
| AI 路徑 | 宿主機 Ollama 或 `nvidia-container-toolkit` | Windows 原生 Ollama＋`host.docker.internal` | 獨立推論節點 |
| 網路下行 | 50 Mbps 以上 | 50 Mbps 以上 | 100～300 Mbps 以上 |

注意：「RTX 4060 16GB」常見的實際型號是 RTX 4060 Ti 16GB；一般 RTX 4060 為 8GB，採購前請核對 VRAM。

## 10｜作業系統相容性與移植重點

| 目標平台 | 可沿用的部分 | AI／GPU 與移植注意 |
| --- | --- | --- |
| macOS Apple M 系列 | 已實測 Docker Desktop Linux arm64＋主機 Chrome＋主機 Ollama | 保持 Ollama 在主機原生執行以用 Metal／MLX；本機透過 `host.docker.internal` 連接。Ollama 官方列 macOS 14 以上與 M 系列 CPU／GPU 支援；本案實測為 27.2 |
| Linux x86-64 | Docker Engine 或 Node；Chrome／Chromium 硬體 WebGL2 | 在目標架構重建映像與原生依賴；AI 改用適用 CUDA／ROCm／Vulkan 的模型與驅動。主機 Ollama 綁定位址與容器到主機的可達性要另測 |
| Linux ARM64 | Node 與 Docker 可在相符架構建置；Ollama 有 ARM64 安裝包 | 一般 ARM 板、Jetson 與 Apple M 的 GPU 生態不同；不能複製這份 MLX 執行環境便期待相同效能。Jetson 必須核對 JetPack 與對應後端 |
| Windows 11 x86-64＋WSL2 | Docker Desktop Linux containers；專案置於 WSL Linux 檔案系統；Windows Chrome 負責顯示 | 開啟硬體虛擬化；依 Docker 官方要求至少 WSL 2.1.5。可選 Windows 原生 Ollama 或 WSL 推論服務，需驗證連線與 GPU 驅動；不保證 MLX 模型可直接沿用 |
| Windows ARM | 本次未測；不列為同機 AI 推薦路徑 | 容器、瀏覽器、推論後端各自確認 ARM 支援；可先做遠端顯示／API 用戶端 |

平台能力依據：[Ollama macOS](https://docs.ollama.com/macos)、[Ollama Linux／ARM64](https://docs.ollama.com/linux)、[Ollama 容器 GPU／JetPack](https://docs.ollama.com/docker)、[Docker Windows 安裝需求](https://docs.docker.com/desktop/setup/install/windows-install/)、[Docker WSL2](https://docs.docker.com/desktop/features/wsl/)。這些文件說明平台能力，不代表本專案已在所有平台通過驗收。

### 可執行的移植順序

1. **先建置應用。** 帶走程式碼、lockfile 與所需公共資產，在目標架構執行 `docker compose build`／`docker compose up -d`；不要直接複製 macOS `node_modules` 到 Linux／Windows。現有映像僅實測 `linux/arm64`，x86-64 應重建並驗證基底映像與原生依賴。
2. **再還原執行資料。** 以一致性快照／暫停寫入方式備份及還原航跡 NDJSON，保留目錄 0700／檔案 0600；設定值與金鑰另外安全遷移。驗證 `mode=summary`、單船 6h／24h／168h 查詢與資料時效，不要把複製到的檔案日期當成有效覆蓋期間。
3. **獨立接通 AI。** 檢查目標 `/api/show`、digest、runner、量化與 context；跨平台時重新選擇模型。先量一次新提示與重複提示，再檢查 GPU 放置、RAM／VRAM、swap 與逾時。Compose 的環境變數名稱可沿用，服務位址依平台驗證。
4. **最後測顯示與值勤。** 用真實 9,000～10,000 筆快照，確認 WebGL renderer 是目標硬體；以實際螢幕解析度測靜止、旋轉、AI 同時推論、長航跡查詢與預定 CCTV 路數。24/7 情境追加至少 24 小時的記憶體、資料新鮮度、磁碟成長與故障復原觀察。

## 11｜重現指令、證據與驗收

在專案根目錄量磁碟；Docker／Ollama 必須已啟動。以下為觀察用途，不含清除資料或調整資源配額：

```bash
du -sk . repo repo/.gev-cache repo/.gev-cache/taiwan-tracks
docker images
docker stats --no-stream
docker top repo-gods-eye-view-1 -eo pid,rss,comm
curl -s http://localhost:11434/api/ps
curl -s http://localhost:11434/api/show -d '{"model":"gemma4:e4b"}'
curl -s 'http://localhost:4173/api/taiwan-vessel-tracks?mode=summary'
uv run --with playwright python repo/scripts/resource-evaluation/current_probe.py
```

`current_probe.py` 會啟動獨立 Chrome、保留真實快照、暫停該頁輪詢並量測 4 種情境；不變更服務配置。主量測與 AI 原始腳本也留在 `scripts/resource-evaluation/`，但重新執行部分腳本會覆寫同名 JSON，重跑前應先另存舊檔。

| 證據檔 | 用途 |
| --- | --- |
| [host.json](docs/resource-evaluation/2026-11-05/host.json) | 06:58 環境、磁碟、模型 metadata 與模型 blob 空間 |
| [current-check.json](docs/resource-evaluation/2026-11-05/current-check.json) | 07:44 當前容器、磁碟、模型卸載狀態與逐日航跡檔統計 |
| [browser.json](docs/resource-evaluation/2026-11-05/browser.json) | 首輪場景、WebGL 計數、FPS、Heap、DOM 與資源傳輸 |
| [current-browser.json](docs/resource-evaluation/2026-11-05/current-browser.json) | 接續完成的瀏覽器複測 |
| [ollama.json](docs/resource-evaluation/2026-11-05/ollama.json) | 首次／暖機推論時間與主機 CPU／GPU、swap 取樣 |
| [distributions.json](docs/resource-evaluation/2026-11-05/distributions.json) | 由原始樣本整理的範圍、平均值與樣本數 |
| [network.json](docs/resource-evaluation/2026-11-05/network.json)、[cache.json](docs/resource-evaluation/2026-11-05/cache.json) | 上游回應大小、錯誤與獨立 profile 冷／暖載入 |
| [resource-architecture.mmd](docs/resource-evaluation/2026-11-05/resource-architecture.mmd) | 可編輯 Mermaid 原始碼；HTML 內嵌預先渲染 SVG，離線也可閱讀 |
| [report-qa.json](docs/resource-evaluation/2026-11-05/report-qa.json) | 最終 HTML 桌機／手機橫向溢出、錯誤與截圖驗證結果 |

已執行 Playwright 驗證：**桌機 1280×800：scrollWidth／clientWidth＝1280／1280；手機直屏 390×844：390／390；兩者皆零橫向溢出、零 JavaScript 錯誤。** 另通過本機連結、圖片載入、四張 SVG 指標卡、架構圖與圖片放大／Esc 關閉檢查。頁面不需要外部網路請求即可呈現。

```bash
uv run --with playwright python -c "import runpy; runpy.run_path('repo/scripts/resource-evaluation/verify_report.py', run_name='__main__')"
```

桌機／手機完整截圖與各章節截圖，保存在 `docs/resource-evaluation/2026-11-05/report-1280-*.png` 與 `report-390-*.png`。HTML 的 Markdown 內容由 `build_report.py` 產生，更新正文後可用下列指令同步：

```bash
uv run --with markdown --with beautifulsoup4 python repo/scripts/resource-evaluation/build_report.py
```

本報告的範圍是「以現有實測建立可追溯的容量預算」。尚未量到的設備、CCTV 路數、多用戶與長期穩定性，都保留為部署驗收項目；三級硬體矩陣的 FPS 與值勤指標是下一階段應通過的目標。
