# A24 戰情台安全評估 HTML 報告

版本：2.0.0（2026-11-10 同日第十二輪後續session更新；v1.0.0～v1.9.1原文見下方「版本歷史」）。**產品安全評估仍為 INCOMPLETE，無發布放行。** 本版加入OWASP／CVSS框架對齊：F-002正式採用GHSA官方CVSS v4.0=6.9；F-001/F-003因CVSS規格本身不適用維持無分數；6個finding均補上OWASP對應、白話說明與風險矩陣視覺化；C-002/C-003/C-004各附條件式複測建議。見下方「v2.0.0 更新了什麼」。SDD 紀錄：v1.0.0文件曾稱其記錄位於`sdd/archive/2026-11-09-a24-security-html-report/`，但核實該路徑不存在，無法追溯；v1.1.0～v1.9.1改版已分別歸檔於`sdd/archive/2026-11-09-update-security-report-v1.1/`、`sdd/archive/2026-11-09-update-security-report-v1.2/`、`sdd/archive/2026-11-09-update-security-report-v1.3/`、`sdd/archive/2026-11-09-accept-risk-c002/`、`sdd/archive/2026-11-09-fix-pat-parent-symlink/`、`sdd/archive/2026-11-09-add-automated-scan-obs/`、`sdd/archive/2026-11-09-close-candidate-risks-path1/`、`sdd/archive/2026-11-09-c004-full-route-coverage/`、`sdd/archive/2026-11-09-environment-capability-closure/`、`sdd/archive/2026-11-09-governance-note-no-auto-close/`；v2.0.0改版的SDD提案目前在`sdd/owasp-cvss-alignment/`（尚未歸檔）。

## v2.0.0 更新了什麼（不是只改雜湊）

本次無程式碼變更，`product_commit`維持`848a856`。

- **F-002正式採用官方CVSS**：直接呼叫GitHub Advisory API取得GHSA-8g5g-mxqh-grgj / CVE-2026-118662的原始回應（`qa/ghsa-8g5g-mxqh-grgj-2026-11-09.json`），採用CVSS v4.0=6.9（非自行評分）；同時附註GEV的loopback-only部署不符合官方描述的「明確曝露到網路」前提，實際曝險面可能更低。
- **F-001、F-003維持無CVSS**：CVSS規格本身不適用——F-003沒有C/I/A影響（報告既有分析已說明），F-001的blocker是曝險範圍與業務用途未確認，跟是否已修補無關。詳細依據見`qa/owasp-mapping-notes-2026-11-09.md`。
- **全部6個finding加OWASP／CWE對應**：F-001對應OWASP LLM Top 10 2026的LLM07（Misinformation）；F-002對應OWASP Top 10:2021的A01/A05；F-003因沒有乾淨對應改標CWE-755；C-002對應A04；C-003對應A01；C-004對應A01/A04。
- **全部6個finding加白話說明**：每段都用非技術語言解釋實際影響，並以具體建議動作收尾。
- **風險矩陣視覺化**：新增一張SVG 2x3矩陣（確認狀態×處置狀態），座標由既有欄位即時計算，不是新的獨立評分。
- **C-002/C-003/C-004加條件式複測建議**：都是「沒有固定時間點，取決於資源是否到位」，不是排程複測。
- **狀態徽章icon**：用`codex exec`生成3個inline SVG（已修補/部分緩解/風險接受），已驗證是純`<path>`圖形、無外部參照、無script，符合既有CSP限制。

## v1.9.1 更新了什麼（不是只改雜湊）

本次無程式碼變更，`product_commit`維持`848a856`。

- **治理決定記錄**：Stop hook持續依字面要求GEV-C-003/GEV-C-004達成acceptance_criteria，但GEV-C-003的acceptance_criteria第3條本身就寫明「補強父鏈另驗證...不自動關閉候選」——這代表無論技術工作做到什麼程度都不會關閉，問題不在技術執行，是報告自己的治理規則。詢問使用者是否要放寬這條規則，使用者明確選擇**保留**，接受C-003/C-004長期維持NEEDS_VALIDATION。
- **只加一行治理備註**：GEV-C-003、GEV-C-004的limitations各補一句記錄這個決定，confirmation_status沒有變化。

## v1.9.0 更新了什麼（不是只改雜湊）

本次無程式碼變更，`product_commit`維持`848a856`。

- **環境能力確認（C-003/C-004路徑一的終點）**：新增`qa/environment-capability-2026-11-09.md`，實測記錄兩個基礎設施缺口：(1) `sudo -n true`回傳需要密碼，這個環境沒有passwordless sudo也沒有第二個真實使用者帳號，C-003的跨UID攻擊測試走不下去；(2) `printenv`確認Google/TomTom/OpenSky/FIRMS等路由所需的API金鑰完全沒設定，C-004多數路由無法做「真實資料」正向對照。
- **使用者已確認這是終點狀態，不是縮小範圍**：兩項finding的`confirmation_status`繼續維持`NEEDS_VALIDATION`——記錄「這個環境做不到什麼」不等於「風險不存在」，不偽裝成已解決。
- **本次未做、仍是缺口**：Standalone建置、受控瀏覽器DOM、Docker實體拓樸、真模型／真上游測試；happy-dom的2筆dev相依漏洞；人工滲透測試，`overall_status`維持`INCOMPLETE`。未來若要再推進C-003/C-004，需要(1)有管理員權限可建立第二個真實使用者帳號的環境，或(2)使用者提供真實API金鑰。

## v1.8.0 更新了什麼（不是只改雜湊）

本報告鎖定的 commit 從 `d348fb4` 更新到 `848a856`。期間完成並反映進本報告：

- **GEV-C-004 全部40條無門控路由逐一實測**：`panelRequestRealHandlers.test.mjs` 新增一個測試（commit `848a856`），對 `qa/c004-route-contract.json` 分類為「放行且無獨立auth gate」的全部40條路由，透過真實vite dev server逐一呼叫 `panel_request`，斷言沒有任何一條觸發 isLocalBrowser/PAT式401、sameSiteGated式403，或panelRequest自己的denylist refusal。外部上游呼叫仍由既有fetch mock擋下（這個環境沒有設定大多數路由需要的API金鑰）。
- **仍不是「真實資料」的正向對照**：這證明的是「reachability」（有沒有被auth gate擋），不是「拿到正確下游資料」；40條裡仍只有`/api/cctv/sources`這1條因為不需要外部金鑰而能做到完整的真實資料正向對照。這是環境限制（缺金鑰），不是刻意縮小測試範圍。
- **C-004仍不能關閉**：`remediation_status`維持`PARTIAL_MITIGATION`，`confirmation_status`維持`NEEDS_VALIDATION`。
- **本次未做、仍是缺口**：Standalone建置、受控瀏覽器DOM、Docker實體拓樸、真模型／真上游測試；happy-dom的2筆dev相依漏洞；C-003跨UID真實攻擊測試（環境限制）；C-004其餘39條路由的「真實資料」正向對照（環境缺金鑰）；人工滲透測試，`overall_status`維持`INCOMPLETE`。

## v1.7.0 更新了什麼（不是只改雜湊）

本報告鎖定的 commit 從 `cc53107` 更新到 `d348fb4`。期間完成並反映進本報告：

- **GEV-C-003 擴充父目錄鏈檢查**：`assertNoSymlinkAncestors`改名並擴充為`assertTrustedAncestors`（commit `5ccccc2`），除symlink外新增owner(POSIX uid)與world-writable(mode & 0o002)檢查，任一違反即拒絕；新增2筆測試。SECURITY.md同步宣告正式不支援多使用者/共享主機部署。owner檢查無法在單一真實UID的環境實測跨使用者攻擊，只用mock lstatSync驗證邏輯，`confirmation_status`仍維持`NEEDS_VALIDATION`；`remediation_status`更新為`PARTIAL_MITIGATION`。
- **GEV-C-004 全路由契約稽核**：新增`qa/c004-route-contract.mjs`（commit `d348fb4`），實際呼叫真實panelRequest工具枚舉repo裡全部54個已掛載路由：panelRequest拒絕9條；放行45條中，只有5條有獨立門控（3條isLocalBrowser+PAT、2條sameSiteGated），其餘40條完全依賴panelRequest黑名單加loopback-only網路曝露模型。新增測試證明`sameSiteGated`對panel_request路徑沒有防護力（明確放行loopback非瀏覽器呼叫，實測`/api/mapillary/status`回200）。`remediation_status`更新為`PARTIAL_MITIGATION`，但只對3種代表情境做了真實端到端測試，其餘約37條無門控路由只是結構上分類，沒有逐條測試，`confirmation_status`仍維持`NEEDS_VALIDATION`。
- **三項候選風險都不能視為消除**：這份報告的schema只有`CONFIRMED`(確認是真缺陷)跟`NEEDS_VALIDATION`，沒有「確認安全、已排除」這個值；要真正消除候選風險只有「完整技術驗證（acceptance_criteria逐條達成）」或「正式風險接受」兩條路，C-003/C-004都只是部分推進，不是走完任何一條路。
- **本次未做、仍是缺口**：Standalone建置、受控瀏覽器DOM、Docker實體拓樸、真模型／真上游測試；happy-dom的2筆dev相依漏洞；C-003跨UID真實攻擊測試（環境限制）；C-004其餘37條路由逐一端到端測試；人工滲透測試，`overall_status`維持`INCOMPLETE`。

## v1.6.0 更新了什麼（不是只改雜湊）

本次無程式碼變更，`product_commit`維持`cc53107`。

- **新增OBS-005（AI驅動diff安全掃描）**：對origin/HEAD(375dfa7)到本機main(2bdec8a)的10個commit diff跑Claude Code `/security-review`，檢查5類（輸入驗證、認證授權、加密密鑰管理、注入/RCE、資料暴露），明確排除DoS/資源耗盡、磁碟secrets儲存、rate limiting。結果：未發現符合信心門檻（>80%）的具體漏洞，完整記錄見`qa/automated-review-2026-11-09.md`（SRC-059）。
- **不改變任何candidate risk**：此掃描明確排除DoS/資源耗盡，C-002完全不在評估範圍內；C-003的殘留TOCTOU間隙被掃描辨識為「已知並接受的風險」而非新漏洞，不等於問題已解決；C-004（代理路由契約）不屬於這5個檢查類別，未被觸及。C-002/C-003/C-004的confirmation_status均維持NEEDS_VALIDATION。
- **本次未做、仍是缺口**：Standalone建置、受控瀏覽器DOM、Docker實體拓樸、真模型／真上游測試；happy-dom的2筆dev相依漏洞；C-004完整路由責任契約文件；人工滲透測試（這次是AI診diff審查，不是形式化稽核），`overall_status`維持`INCOMPLETE`。

## v1.5.0 更新了什麼（不是只改雜湊）

本報告鎖定的 commit 從 `7ae38a7` 更新到 `cc53107`。期間完成並反映進本報告：

- **GEV-C-003 新增父目錄symlink檢查（部分緩解）**：`server/providers/ai/ollama-advisor.js`的`createTokenStore`新增`assertNoSymlinkAncestors`（commit `cc53107`），`read()`／`rotate()`都會從檔案往上逐層lstat到root，發現symlink即拒絕；新增2筆測試（父目錄為symlink時拒絕、正常目錄行為不變）。`remediation_status`改為`PARTIAL_MITIGATION`。
- **C-003仍不能關閉**：這只是單次lstat，不是完整TOCTOU防護（check完到open/write之間理論上仍有競態窗口），也只覆蓋`ollama-advisor.js`一處，不包含`panelKey.js`／`key-setup.js`等其他路徑；`confirmation_status`維持`NEEDS_VALIDATION`，報告自身acceptance_criteria已明記補強父鏈不自動關閉候選。
- **C-002／C-004 不受影響**：僅C-003的remediation_status改變，其他兩項candidate risk維持原狀。
- **本次未做、仍是缺口**：Standalone建置、受控瀏覽器DOM、Docker實體拓樸、真模型／真上游測試；happy-dom的2筆dev相依漏洞；C-004完整路由責任契約文件，`overall_status`維持`INCOMPLETE`。

## v1.4.0 更新了什麼（不是只改雜湊）

本次無程式碼變更，`product_commit`維持`7ae38a7`。

- **GEV-C-002 風險接受**：使用者決定接受此風險，不再要求上游接收加byte上限；理由是上游為固定、受信任官方來源，且已有OBS-003記憶體監控可觀察/預警。寫入`details.risk_acceptance`（accepted/accepted_by＝開發/維護者/accepted_date/rationale/residual_risk）。**confirmation_status技術上維持NEEDS_VALIDATION**——風險接受是業務決定，不是技術上重新確認此finding為假或已修補；若未來改為多租戶或不受信任上游，接受失效需重新評估。
- **C-003／C-004 不受影響**：僅C-002記錄風險接受，其他兩項candidate risk的`risk_acceptance`維持null，未被誤標。
- **本次未做、仍是缺口**：Standalone建置、受控瀏覽器DOM、Docker實體拓樸、真模型／真上游測試；happy-dom的2筆dev相依漏洞；C-003父目錄鏈驗證；C-004完整路由責任契約文件，`overall_status`維持`INCOMPLETE`。

## v1.3.0 更新了什麼（不是只改雜湊）

本報告鎖定的 commit 從 `72b1d17` 更新到 `7ae38a7`。期間完成並反映進本報告：

- **C-004補上正向對照＋負向案例永久化**：新增`panelRequestRealHandlers.test.mjs`（commit `7ae38a7`）。正向：`panel_request`對真實`/api/cctv/sources`成功端到端取得真實資料（200，非mock）。負向：對真實`/api/taiwan-ai-status`（無憑證）收到401，確認來自下游handler自己的判定，不是panelRequest工具層的`REFUSED_PATHS`。查證發現：原報告run-34/35引用的同類負向觀察在repo裡找不到對應已提交測試，這次是永久化版本。
- **C-004仍不能關閉**：只補了1條路由（`/api/cctv/sources`）的正向對照，不是驗收條件要求的「每個核准路由列明proxy與下游預期」完整契約文件；confirmation_status維持NEEDS_VALIDATION。
- **本次未做、仍是缺口**：與v1.2.0相同（Standalone建置、受控瀏覽器DOM、Docker實體拓樸、真模型／真上游測試；happy-dom的2筆dev相依漏洞；C-002實際byte cap；C-003父目錄鏈驗證；C-004完整路由責任契約文件），`overall_status`維持`INCOMPLETE`。

## v1.2.0 更新了什麼（不是只改雜湊）

本報告鎖定的 commit 從 `375dfa7` 更新到 `72b1d17`。期間完成並反映進本報告：

- **新增 OBS-003（系統記憶體監控）**：操作者選擇不對上游接收加byte上限，改為用`os.totalmem()/os.freemem()`每60秒監控系統整體記憶體（commit `ac81914`）。**這不是修補C-002**，是替代方案，C-002的confirmation_status維持NEEDS_VALIDATION。已知限制：Docker容器內讀到的是Docker Desktop VM配額（本次互動實測7.75 GiB），不是宿主機實際總量（16.0 GiB）。
- **新增 OBS-004（PAT畫面不渲染明文，已修補）**：PAT建立/輪替後改為先自動複製到剪貼簿，成功時畫面只顯示確認訊息，原始token字串從未指派給會被渲染的ref（commit `72b1d17`）。複製失敗時仍退回顯示明文當備援。
- **本次未做、仍是缺口**：與v1.1.0相同（Standalone建置、受控瀏覽器DOM、Docker實體拓樸、真模型／真上游測試；happy-dom的2筆dev相依漏洞；C-002實際byte cap；C-003父目錄鏈驗證），`overall_status`維持`INCOMPLETE`。

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
- **v1.2.0**（2026-11-09同日第三輪後續session）：見上「v1.2.0 更新了什麼」。
- **v1.3.0**（2026-11-09同日第四輪後續session）：見上「v1.3.0 更新了什麼」。
- **v1.4.0**（2026-11-09同日第五輪後續session）：見上「v1.4.0 更新了什麼」。
- **v1.5.0**（2026-11-09同日第六輪後續session）：見上「v1.5.0 更新了什麼」。
- **v1.6.0**（2026-11-09同日第七輪後續session）：見上「v1.6.0 更新了什麼」。
- **v1.7.0**（2026-11-09同日第八輪後續session）：見上「v1.7.0 更新了什麼」。
- **v1.8.0**（2026-11-09同日第九輪後續session）：見上「v1.8.0 更新了什麼」。
- **v1.9.0**（2026-11-09同日第十輪後續session）：見上「v1.9.0 更新了什麼」。
- **v1.9.1**（2026-11-09同日第十一輪後續session）：見上「v1.9.1 更新了什麼」。
- **v2.0.0**（2026-11-10同日第十二輪後續session）：見上「v2.0.0 更新了什麼」。
- **v1.4.0**（2026-11-09同日第五輪後續session）：見上「v1.4.0 更新了什麼」。

## 開啟報告

直接開啟 `index.html`。單一 HTML 已內嵌樣式、JavaScript、報告 JSON 與五類 SVG 視覺，不需要 HTTP 服務、CDN、外部字型或安裝套件。

內容包括管理摘要、範圍方法、攻擊面／信任邊界、F-001 與三項候選、其他觀察、原 15 情境、改善交接及證據附錄。可搜尋／篩選、展開節錄、暫停動畫及列印。JavaScript 停用時核心內容與安全節錄仍靜態存在。

HTML 可單獨攜出閱讀；完整證據檔沒有嵌入。來源相對連結需要保留本工作區的資料夾結構。來源索引記錄59份選取檔案的SHA-256（v1.0.0為45份，v1.1.0新增7份，v1.2.0新增5份，v1.3.0新增1份；v1.4.0無新增；v1.5.0重新雜湊既有SRC-041/SRC-046，未新增筆數；v1.6.0新增SRC-059；v1.7.0新增SRC-060/SRC-061，共61份；v1.8.0無新增，僅重算SRC-058；v1.9.0新增SRC-062，共62份；v1.9.1無新增；v2.0.0新增SRC-063/SRC-064，共64份），不是數位簽章或整個歷史執行範圍的證明。

## QA 結果與限制

v2.0.0 新增 `qa/check_v2.0.py`，取代`check_v1.9.1.py`作為目前版本的通用稽核（全部PASS，見`qa/check-v2.0-audit.json`）。

v1.9.1 新增 `qa/check_v1.9.1.py`，取代`check_v1.9.py`作為目前版本的通用稽核（全部PASS，見`qa/check-v1.9.1-audit.json`）。

v1.9.0 新增 `qa/check_v1.9.py`，取代`check_v1.8.py`作為目前版本的通用稽核（全部PASS，見`qa/check-v1.9-audit.json`）。

v1.8.0 新增 `qa/check_v1.8.py`，取代`check_v1.7.py`作為目前版本的通用稽核（全部PASS，見`qa/check-v1.8-audit.json`）。

v1.7.0 新增 `qa/check_v1.7.py`，取代`check_v1.6.py`作為目前版本的通用稽核（全部PASS，見`qa/check-v1.7-audit.json`）。

v1.6.0 新增 `qa/check_v1.6.py`，取代`check_v1.5.py`作為目前版本的通用稽核（全部PASS，見`qa/check-v1.6-audit.json`）。`qa/check_v1.5.py`／更早版本的metadata版本斷言依序從各自下一版起預期失敗（檔頭已補註記）。

v1.5.0 新增 `qa/check_v1.5.py`，取代`check_v1.4.py`作為目前版本的通用稽核：來源雜湊/連結、證據節錄逐字核對、15情境原名不變、v1.5.0應有事實（GEV-C-003的remediation_status=PARTIAL_MITIGATION且引用EV-C003-FIX-CODE/TEST、C-002/C-004未被連帶誤標PARTIAL_MITIGATION、product_commit=cc53107等）全部PASS，見`qa/check-v1.5-audit.json`。`qa/check_v1.4.py`／`check_v1.3.py`／`check_v1.2.py`／`check_v1.1.py`的metadata版本斷言分別從v1.5.0／v1.4.0／v1.3.0／v1.2.0起預期失敗（檔頭已補註記），但其餘通用檢查section仍應通過——這證明每次改版沒有意外改壞前一版已確立的事實，只是版本號本身往前移。`qa/check_task7.py`與`qa/task4-dom.mjs`／`task5-diagrams.mjs`／`task6-coverage.mjs`／`task8-final.mjs`釘死在v1.0.0的具體內容，從v1.1.0起預期會失敗，各檔頭已加註記；這些都是版本釘死的歷史稽核，不是未知迴歸。

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
python3 -B 1151104_gods-eye-view/security-assessment-report/qa/check_v1.3.py
# 以下與 check_task7.py 各自釘死在自己的版本，之後版本起第6節metadata斷言
# 預期失敗（見各檔頭註記），其餘通用檢查仍應通過：
python3 -B 1151104_gods-eye-view/security-assessment-report/qa/check_v1.2.py
python3 -B 1151104_gods-eye-view/security-assessment-report/qa/check_v1.1.py
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
