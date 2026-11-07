# 全維度數據源與時效特性說明文件 (Data Sources & Telemetry Matrix)

> 🇹🇼 **God's Eye View 臺灣海域戰情台** 遵循各資料提供者之開放資料規範與服務條款。本文件詳載系統所整合的 9 大維度、20+ 類數據源之更新頻率、物理不變性分類與官方授權資訊。
> 
> 🌐 **線上互動版報告**：可直接參閱 [`data-sources.html`](data-sources.html) 或至戰情台畫面**左下角點擊「📊 數據源時效報告 ↗」**直接在新分頁開啟。

---

## 一、三層時效性特徵總覽 (Lifecycle & Mutability Hierarchy)

在戰情系統架構中，我們依據資料的物理性質與業務邊界劃分為三大層級：

| 層級 (Tier) | 時效特質 (Lifecycle Characteristic) | 戰情台資料實例 (Examples in System) |
| :--- | :--- | :--- |
| 🟢 **不可變動層**<br>*(Immutable)* | **歷史時空事實，寫入即定案（Append-only）**<br>具有事後稽核與法律存證價值，絕不覆寫或竄改。 | • **臺灣海域 7 天歷史航跡庫**（Append-only NDJSON）<br>• **USGS 已定案歷史地震紀錄**（Seismic Event ID）<br>• **警廣已結案道路事故日誌**（Archived Incidents） |
| 🟡 **不用變動層**<br>*(Static / Quasi-Static)* | **物理基礎建設與固定地貌，常態靜態運作**<br>除非重大實體工程更新，日常運作數月至數年無須頻繁變動。 | • **全球海底光纖通訊電纜海床路由**（TeleGeography）<br>• **基礎衛星底圖與 3D 建築網格**（Esri / Google 3D Tiles）<br>• **國道攝影機實體樁號門架坐標**（1,800 支坐標固定）<br>• **本機 Ollama AI 模型權重**（Gemma / Llama 離線檔案） |
| 🔴 **動態遙測層**<br>*(Dynamic Telemetry)* | **隨時間流轉的海空陸即時態勢，設定各級刷新週期**<br>依目標航速與 API 負載保護，從毫秒串流至小時級數值模擬。 | • **公海船舶**（毫秒級 WebSocket）<br>• **民航客機與軍機**（5 ~ 10 秒）<br>• **國道 CCTV 快照**（5 ~ 15 秒）<br>• **臺灣在席商漁船 AIS**（40 秒快取合併）<br>• **大氣風場數值預報**（每 6 小時計算） |

---

## 二、動態更新頻率全面對照矩陣 (Refresh Rates & Polling Specifications)

| 領域 (Domain) | 數據源項目 (Data Source) | 來源機構與協議 (Provider & Protocol) | 更新頻率等級 (Refresh Rate) | 技術機制與設計考量 (Technical Specs) |
| :--- | :--- | :--- | :--- | :--- |
| **公海海事**<br>Maritime | **全球公海船舶 AIS**<br>Global Maritime AIS | **AISStream.io**<br>WebSocket Realtime Push | **毫秒級即時串流**<br>(Realtime Stream) | 基於 WebSocket 長連接持續監聽，遠洋與各國外海商船一旦發射 AIS 廣播立即反映於海圖。 |
| **空域飛航**<br>Aviation | **全球民航客機與通用航空**<br>Global Civil Aviation | **OpenSky Network** / **adsb.lol**<br>REST API JSON | **每 5 ~ 10 秒** | 飛機時速達 800+ km/h，5~10 秒輪詢能確保飛行姿態、航向角與三維高度平滑連貫。 |
| **空域飛航**<br>Aviation | **全球軍用與特種公務機**<br>Military Aircraft Feed | **ADS-B.one Military Filter**<br>REST API JSON | **每 5 ~ 10 秒** | 專屬過濾各國空軍巡邏機、電偵機與加油機之公開 ADS-B 信號。 |
| **即時影像**<br>Traffic CCTV | **全臺國道即時攝影機**<br>Taiwan Freeway CCTV | **交通部高公局 TISVCloud**<br>MOTC 2.0 XML / Snapshot / MJPEG | **每 5 ~ 15 秒 (快照)**<br>**即時 (MJPEG 串流)** | 全島 1,800 支攝影機。展開單一鏡頭時，依頻寬自動切換即時影像串流或每 10 秒自動刷新快照。 |
| **臺灣海事**<br>Taiwan AIS | **全臺在席商漁船動態**<br>Taiwan Coastal AIS | **中華民國交通部航港局 (MOTC MPB)**<br>REST API JSON | **每 40 秒 (快取合併)** | 監控臺灣周邊海域 9,000+ 艘在席船艦。戰情台後端設有 40 秒防擊穿快取，保障官方伺服器穩定。 |
| **陸路交通**<br>Land Traffic | **國道即時車速與擁塞**<br>Freeway Traffic Flow | **交通部高速公路局 (Freeway Bureau)**<br>TISVCloud XML | **每 1 ~ 2 分鐘** | 涵蓋國道 1/3/5/6 號等 453 個路段平均時速與壅塞燈號（綠、黃、橘、紅）。 |
| **陸路交通**<br>Land Traffic | **警廣即時突發事件通報**<br>Police Radio Alerts (PBS) | **內政部警政署警察廣播電臺 (PBS)**<br>REST API JSON | **每 1 ~ 3 分鐘** | 即時通報交通事故、落石坍方、道路封閉。內建指數退避重試防護（Exponential Backoff）。 |
| **天然災害**<br>Disasters | **全球顯著地震監測**<br>USGS Seismic Events | **美國地質調查局 (USGS)**<br>GeoJSON Feed | **每 1 ~ 5 分鐘** | 輪詢全球 M2.5+ 及臺灣有感地震，新事件自動在地表引發震央動態光圈與震源深度卡片。 |
| **天候環境**<br>Weather | **降雨雷達反射率與雲圖**<br>Weather Radar & Clouds | **NOAA nowCOAST (MRMS) / GOES-16/18**<br>WMS / Tile Service | **每 5 ~ 15 分鐘** | 複合多波段氣象衛星紅外雲圖與地面都卜勒雨量雷達反射率（Precipitation Radar）。 |
| **天候環境**<br>Weather | **全球累積落雷密度**<br>Lightning Strike Density | **NOAA nowCOAST / Vaisala NLDN**<br>WMS Tile Service | **每 15 分鐘** | 統計過去 15 分鐘累積放電熱區，標示強對流與雷暴劇烈發展區域。 |
| **太空軌道**<br>Space Track | **低軌衛星與軌道星群**<br>Orbital Satellites & TLE | **CelesTrak / NORAD / Space-Track**<br>TLE Text Feed | **數據每 2~12 小時**<br>*(前端每 1 秒外推)* | TLE 軌道根數半天更新一次；前端運用 SGP4 演算法每秒外推 ISS、Starlink 與 GPS 衛星坐標。 |
| **天然災害**<br>Disasters | **全球林火與地表熱異常**<br>NASA FIRMS Thermal Anomalies | **NASA FIRMS (MODIS & VIIRS 衛星)**<br>CSV / GeoJSON Feed | **每 3 ~ 6 小時** | 隨 NASA 極軌地球觀測衛星繞行週期過境掃描產出，標定地表紅外光強輻射熱點。 |
| **大氣預報**<br>Atmosphere | **大氣風場與海面流場**<br>Atmospheric Wind Vectors | **NOAA GFS (0.25°) / ECMWF IFS**<br>GRIB2 / NetCDF 數值預報 | **每 6 小時**<br>*(00Z, 06Z, 12Z, 18Z)* | 全球超級電腦數值模擬模型產出 10 米海面風向風速粒子網格，由前端 WebGL 著色器動態繪製流線。 |
| **航太發射**<br>Rocket Launches | **全球火箭發射事件**<br>Rocket Launch Manifest | **The Space Devs (Launch Library 2 API)**<br>REST API JSON | **每 1 小時 ~ 每天** | 追蹤全球各主要發射場發射窗口、入軌載荷、火箭型號與發射倒數計時。 |
| **實體設施**<br>Cables | **全球海底光纖通訊電纜**<br>Subsea Fiber-optic Cables | **TeleGeography Submarine Cable Map**<br>GeoJSON Snapshot | **常態靜態 (不用變動)** | 跨國海纜鋪設週期長達 3~5 年，本機收錄高精度海床路由與臺灣八里、頭城、枋山登陸站。 |
| **三維地理**<br>Basemap | **3D 傾斜攝影地質與地名**<br>Basemap & 3D Mesh | **Google 3D Tiles / Esri / OSM**<br>3D Tiles / Raster Tiles | **常態靜態 (不用變動)** | 地表城市大樓與地質地形高度穩定，支援 Google 逼真 3D 建築網格與 Esri 高解析衛星影像。 |
| **邊緣人工智慧**<br>Local AI | **邊緣 AI 戰術參謀模型**<br>Local Tactical AI Advisor | **本機 Ollama (`gemma` / `llama3`)**<br>Local REST API | **模型固定 (推論即時)** | 模型權重完全離線常駐本機記憶體，推論延遲約 0.5~2 秒，零 API 調用費用且不對外傳輸敏感戰術數據。 |

---

## 三、官方數據授權與法律條款 (Licensing & Terms of Service)

1. **中華民國政府資料開放授權條款 (OGDL-Taiwan 1.0)**：
   * 交通部航港局海事資料、交通部高速公路局路況與攝影機資訊均依據《政府資料開放授權條款 - 第 1 版》規範，授權公眾進行加值利用與戰術態勢繪製。
2. **國際開放空間資料授權 (Open Data Commons / Creative Commons)**：
   * **OpenStreetMap** 與 **adsb.lol**：遵守 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) 授權。
   * **TeleGeography 海纜資料**：採用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 非商業授權標註。
   * **NOAA / NASA / USGS**：美國聯邦政府公開釋出之公有領域數據（Public Domain）。

---

## 四、戰情台操作指引

* 戰情台主畫面**左下角**設有 `Data attribution` 專屬燈箱。
* 點擊左下角燈箱旁的 **`[ 📊 數據源時效報告 ↗ ]`** 按鈕，即可在不中斷 3D/2D 戰情推演的情況下，隨時在新分頁開啟全功能說明網頁。
