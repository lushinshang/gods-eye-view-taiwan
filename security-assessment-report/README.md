# A24 戰情台安全評估 HTML 報告

版本：1.1.0（2026-11-09 同日後續session更新；v1.0.0原文見下方「版本歷史」）。**產品安全評估仍為 INCOMPLETE，無發布放行。** F-001 已於本次更新確認修補（FIXED），C-002／C-003／C-004 仍維持 NEEDS_VALIDATION。SDD 紀錄：v1.0.0文件曾稱其記錄位於`sdd/archive/2026-11-09-a24-security-html-report/`，但本次核實該路徑不存在，無法追溯；v1.1.0改版的SDD提案目前在`sdd/update-security-report-v1.1/`（尚未歸檔，歸檔後路徑會變為`sdd/archive/<歸檔日期>-update-security-report-v1.1/`）。

## v1.1.0 更新了什麼（不是只改雜湊）

本報告鎖定的 commit 從 `e50944f` 更新到 `375dfa7`。期間完成並反映進本報告：

- **GEV-F-001 已修補**：`server/providers/ai/ollama-client.js` 的 grounding 固定值5改為`Math.min(vessels.length,5)`（commit `6bff971`），新增回歸測試確認樣本2艘時5與3被拒、2通過。殘留限制：樣本≥5艘時「5艘」與「前N艘」語法的既有豁免未處理。
- **新增 GEV-F-002（已修補）**：osv-scanner掃出vite 6.4.4受GHSA-8g5g-mxqh-grgj影響（`server.fs.deny`可被query繞過），已升級至6.4.5（commit `75fa234`），並對運行中服務實測9種已知繞過手法全部守住。
- **新增 GEV-F-003（已修補）**：`/api/setup/keys`超過8192 bytes時原用`req.destroy()`中止連線，讓413分支成為死碼；改為停止累積但不destroy（commit `375dfa7`），新增真實TCP server回歸測試。
- **OBS-002機制已查明**：讀`scripts/docker-start.mjs`原始碼確認，開機時自動把容器核心的預設閘道位址寫入執行中行程記憶體的`GEV_KEY_SETUP_TRUSTED_PEERS`，是刻意設計；部署拓樸層面風險判斷仍待確認。
- **C-002／C-003補上文件引用**：`SECURITY.md`新增Deployment model段落，文件化「上游固定、操作者信任」與「PAT儲存假設單一OS使用者」兩項既有假設（commit `375dfa7`）；**補文件不等於風險解除**，兩者confirmation_status維持NEEDS_VALIDATION。
- **主動滲透測試**：對運行中服務六面向真實動態測試（Host/Origin/DNS rebinding、本機准入偽造、檔案存取與fs.deny、輸入邊界、PAT生命週期與panel_request、信任邊界彙整），經四輪獨立驗收，摘要見`session-2026-11-09/summary.md`，完整產出在`sdd/archive/2026-11-09-active-pentest-localhost/`（超出本報告href可達範圍，故另存摘要）。沒有找到可繞過准入或讀機密的缺口。
- **本次未做、仍是缺口**：Standalone建置、受控瀏覽器DOM、Docker實體拓樸、真模型／真上游測試；happy-dom的2筆dev相依漏洞；C-002實際byte cap；C-003父目錄鏈驗證。`overall_status`維持`INCOMPLETE`，不因本次工作整案放行。

## 版本歷史

- **v1.0.0**（2026-11-09上午）：原始交付版，鎖定commit `e50944f`，F-001 CONFIRMED/OPEN。
- **v1.1.0**（2026-11-09同日後續session）：見上「v1.1.0 更新了什麼」。

## 開啟報告

直接開啟 `index.html`。單一 HTML 已內嵌樣式、JavaScript、報告 JSON 與五類 SVG 視覺，不需要 HTTP 服務、CDN、外部字型或安裝套件。

內容包括管理摘要、範圍方法、攻擊面／信任邊界、F-001 與三項候選、其他觀察、原 15 情境、改善交接及證據附錄。可搜尋／篩選、展開節錄、暫停動畫及列印。JavaScript 停用時核心內容與安全節錄仍靜態存在。

HTML 可單獨攜出閱讀；完整證據檔沒有嵌入。來源相對連結需要保留本工作區的資料夾結構。來源索引記錄52份選取檔案的SHA-256（v1.0.0為45份，v1.1.0新增7份），不是數位簽章或整個歷史執行範圍的證明。

## QA 結果與限制

v1.1.0 新增 `qa/check_v1.1.py`：來源雜湊/連結、證據節錄逐字核對（含標記為`frozen_historical`的歷史節錄另外處理）、15情境原名不變、v1.1.0應有事實（F-001 FIXED、product_commit等）全部PASS，見`qa/check-v1.1-audit.json`。`qa/check_task7.py`與`qa/task4-dom.mjs`／`task5-diagrams.mjs`／`task6-coverage.mjs`／`task8-final.mjs`釘死在v1.0.0的具體內容（如「4筆finding」「GEV-07是KNOWN_OPEN_FINDING」），從v1.1.0起預期會失敗，各檔頭已加註記；這是版本釘死的歷史稽核，不是未知迴歸。

v1.0.0的既有結果如下（未重新驗證視覺／瀏覽器部分，狀態不變）：

| 項目 | v1.0.0結果 |
| --- | --- |
| 來源、15情境及安全節錄核對 | 通過：45來源、644處來源引用、14節錄、4份建置出處 |
| HTML／SVG字串跳脫、錨點與內嵌資料 | 靜態對照通過；不代表真瀏覽器CSP驗收 |
| 搜尋／篩選、證據展開、深連結、列印事件還原 | 合成DOM檢查通過 |
| 減少動態設定 | 合成初始設定與變更檢查通過；真OS／瀏覽器未驗證 |
| SVG文字、顏色與邊界 | 靜態圖像及獨立列印預覽已檢視 |
| A4預覽 | WeasyPrint產出67頁，首頁與管理摘要在第1–2頁；已檢視全頁縮圖與重點頁 |
| 桌機與390px手機真實排版 | **未驗證：Browser管道無可用瀏覽器** |
| 原生鍵盤Tab順序、Chrome列印與CSP | **未驗證**；合成DOM不取代原生驗收 |

詳細紀錄：`qa/task-8-summary.json`。既有Chrome最小啟動曾回報Target closed；本項未重試相同啟動、不關閉沙箱、不啟動產品、不新增安全測試run。

`qa/report-print.pdf` 是獨立排版引擎的QA預覽，**不是瀏覽器列印驗收或主要交付格式**。其來源檔連結已停用，避免預覽將相對路徑解析為宿主絕對file URI；HTML來源連結維持原樣。`qa/print-contact-*.png` 為全部頁面縮圖，`qa/summary-page-*.png` 為摘要檢視畫面。

列印工具現有版本不相容已由 `qa/render_print.py` 在單一程序內提供方法名稱相容轉接；未改動已安裝套件或產品依賴。SVG已增加自身的presentation attributes，避免不支援外層CSS的列印引擎把方框畫黑。

## 資料與重新產生

- `report-data.json`：主文、發現、圖表模型、狀態與安全節錄。
- `source-index.json`：選取來源的相對路徑、完整性與定位。
- `build_report.py`：只讀同目錄兩份JSON並產生HTML，不載入產品模組。
- `delivery-manifest.json`：核心交付與選取QA紀錄的檔案雜湊清冊，排除自身。

重新產生：

```sh
python3 -B /完整路徑/1151104_gods-eye-view/security-assessment-report/build_report.py
```

從工作區根目錄執行既有本機檢查：

```sh
python3 -B 1151104_gods-eye-view/security-assessment-report/qa/check_task4.py
python3 -B 1151104_gods-eye-view/security-assessment-report/qa/check_v1.1.py
# 以下四支與 check_task7.py 釘死在 v1.0.0，v1.1.0起預期失敗，見各檔頭註記：
python3 -B 1151104_gods-eye-view/security-assessment-report/qa/check_task7.py
node 1151104_gods-eye-view/security-assessment-report/qa/task4-dom.mjs
node 1151104_gods-eye-view/security-assessment-report/qa/task5-diagrams.mjs
node 1151104_gods-eye-view/security-assessment-report/qa/task6-coverage.mjs
node 1151104_gods-eye-view/security-assessment-report/qa/task8-final.mjs
```

合成DOM檢查只使用既有 `node_modules` 的 happy-dom。HTML閱讀與產生器本身不需要該函式庫。來源內容變動時，須重新核對並明示更新；不要只改hash掩蓋差異。

C002歷史傳輸bytes未完全對齊的問題仍明列未解，不用其支持容量結論。工具供給缺失、候選契約、未測環境與已知OPEN缺陷維持原判讀。報告產製完成不代表風險接受、產品修補完成或發布獲准。

## 專案內位置

本報告現置於 `1151104_gods-eye-view/security-assessment-report/`，與專案其他文件一起管理。原安全評估歷史證據仍位於工作區 `security-assessment/execution/`；報告深度相同，因此來源相對連結不需改寫。若單獨搬移專案，HTML主文仍可閱讀，但完整歷史證據連結需另保留相應資料夾。
