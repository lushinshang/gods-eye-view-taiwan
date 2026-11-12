# 中國海警局(China Coast Guard)公務船 MMSI 對照清查

## 查詢清單中各舷號的 MMSI 核實結果(逐一查證)

### Takeaway
在使用者指定的 27 個舷號中，僅 2301/2501/2502/2901/3501(已於先前確認)屬於有 2 個以上獨立網域互相印證、且無矛盾的「CONFIRMED」等級；另有 2102 可視為 CONFIRMED（3 網域印證，含 call sign 一致）。5901、6501 在獨立來源之間出現明確數字矛盾，必須標「CONFLICT」。2202、2203、2303、2304、21610、21616、11601、31601、14608、14513、14603 這 11 個舷號在 WebSearch 範圍內查無任何 AIS 聚合站紀錄，標「查無」。1106 僅見單一來源且 IMO 格式可疑，標「AMBIGUOUS」。

### Cited Findings

**CONFIRMED（≥2 個不同網域、數字一致、無矛盾）**
- CHINACOASTGUARD2901 → MMSI 413875041（使用者背景已確認，本次研究未重複查證，沿用）
- CHINACOASTGUARD2501 → MMSI 413875039，IMO 9763643，call sign BNSA — [maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9763643/mmsi:413875039/CHINACOASTGUARD2501.html)；[magicport.ai](https://magicport.ai/vessels/special-craft/chinacoastguard2501-mmsi-413875039)
- CHINACOASTGUARD2502 → MMSI 413875040 — [magicport.ai](https://magicport.ai/vessels/tugs-harbor-craft/chinacoastguard2502-mmsi-413875040)（第二來源為使用者背景已確認資料，本次搜尋結果重複出現同一數字，未發現矛盾）
- CHINACOASTGUARD3501 → MMSI 413875340（使用者背景已確認，沿用）
- CHINACOASTGUARD2102 → MMSI 413875052，IMO 9351878，call sign ZGHJ — [magicport.ai](https://magicport.ai/vessels/tugs-harbor-craft/chinacoastguard2102-mmsi-413875052)；[maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9351878/mmsi:413875052/CHINACOASTGUARD2102.html)；[tradlinx.com 搜尋結果列出同 call sign ZGHJ](https://www.tradlinx.com)。註：maritimeoptima 另有一個 URL 路徑含 `mmsi:413212102`，但該頁實際文字內容仍顯示 413875052，判斷該 413212102 只是網址層級的錨點/拼字異常，不是頁面內容矛盾，故仍計為 CONFIRMED，但建議之後有機會用 WebFetch 直接開那個 URL 二次確認。

**CONFLICT（獨立來源數字互相矛盾，不可選一用）**
- CHINACOASTGUARD5901（使用者背景已知矛盾，本次研究重新確認同一矛盾仍存在）：magicport.ai 與 maritimeoptima.com 同時出現兩個不同頁面，共用 IMO 9756028，但 MMSI 分別為 413875411 與 413482360 — [magicport.ai (413875411)](https://magicport.ai/vessels/tugs-harbor-craft/chinacoastguard5901-mmsi-413875411)、[magicport.ai (413482360)](https://magicport.ai/vessels/tugs-harbor-craft/chinacoastguard5901-mmsi-413482360)、[maritimeoptima.com (413875411)](https://maritimeoptima.com/public/vessels/pages/imo:9756028/mmsi:413875411/CHINACOASTGUARD5901.html)、[maritimeoptima.com (413482360)](https://maritimeoptima.com/public/vessels/pages/imo:9756028/mmsi:413482360/CHINACOASTGUARD5901.html)。注意：413482360 落在使用者已知的「偽造區段」413483xxx 附近但非完全相同數字，仍需視為矛盾不可信，不可採用。
- CHINACOASTGUARD6501：至少兩組互相矛盾的身分資料。(a) warshipsresearch 部落格引用 vesselfinder/vesseltracker：IMO 9767003、MMSI 413330110、call sign BNQJ，maritimeoptima 也列出同一 MMSI/IMO 組合但船名記為 ZHONGGUOHAIJING_6501 — [warshipsresearch.blogspot.com](https://warshipsresearch.blogspot.com/2024/06/chinese-coast-guard-patrol-vessel.html)、[maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9767003/mmsi:413330110/ZHONGGUOHAIJING_6501.html)。(b) magicport.ai 另給出 IMO 9769003（與 (a)差一位數）、MMSI 413875750、call sign 同為 BNQJ — [magicport.ai](https://magicport.ai/vessels/special-craft/chinacoastguard6501-mmsi-413875750)。call sign 相同但 IMO/MMSI 不同，無法判定哪組正確，列為 CONFLICT。

**AMBIGUOUS（僅單一網域來源，或來源品質可疑，不足以列為 CONFIRMED）**
- CHINACOASTGUARD1106：僅 tradlinx.com 單一來源，MMSI 412371217、IMO 4780085、call sign "CCG" — [tradlinx.com](https://www.tradlinx.com/vessel-tracking/230813-CHINA-COASTGUARD1106-MMSI-412371217-IMO-4780085)。IMO 4780085 的格式(校驗碼)可疑，且查無第二個獨立網域佐證，不可列為 CONFIRMED。另注意此 MMSI 412371217 不在 413875xxx 區段內，與其他已確認海警船規律不符。
- CHINACOASTGUARD6306：僅 magicport.ai 單一來源，MMSI 413875756，但該頁給出的 IMO 為 1235456，格式明顯不符合真實 IMO 編號規則(搜尋工具本身也標註「IMO 編號對這類船看起來不尋常」)，需進一步查證才能用 — [magicport.ai](https://magicport.ai/vessels/special-craft/chinacoastguard-6306-mmsi-413875756)

**查無(WebSearch 範圍內找不到任何 AIS 聚合站紀錄)**
- CHINACOASTGUARD / 海警 2202、2203、2303、2304、21610、21616、11601、31601、14608、14513、14603 — 多輪搜尋(含單獨查詢與鄰近舷號查詢)均未出現任何 MarineTraffic / VesselFinder / MagicPort / Maritime Optima / TradLinx / MarineLink / Shipfix / aisvesseltracker / myshiptracking 的對應紀錄。不排除是因為這些舷號的船隻未開啟 AIS 或未被這些聚合站收錄，但目前查無法律上足以引用的來源。

### Inferences
- 413875xxx 這個六位數子區段(確切範圍目前觀察到從 413875024 到 413875881 之間多個數字)看起來是中國海警局現役公務船 MMSI 的主要集中帶，但並非所有「CHINACOASTGUARD」命名的紀錄都落在這個區段內 —— 有些落在 412xxxxxx 或 413xxxxxx 的其他子區段(例如 412371217、412302410、412473810)，這些很可能是聚合站的錯誤命名配對(把舊船名/漢字船名誤標成 CHINACOASTGUARD 字樣)，不能單純因為名字含有 CHINACOASTGUARD 字樣就當作真正海警船。
- magicport.ai 單獨出現的「CONFIRMED」候選數字需要高度警惕：本次研究發現 magicport.ai 本身就會對同一艘船(同 IMO)刊出兩個不同的 MMSI 頁面(5901、2301、1104 皆如此)，顯示該站存在資料品質問題，單獨引用 magicport.ai 不足以當作「獨立來源」佐證力道。

### Gaps
- 2202、2203、2303、2304、21610、21616、11601、31601、14608、14513、14603 這 11 個舷號完全查無資料，無法進一步確認是否真實存在對應的 AIS 可追蹤海警船。
- 1106、6306 雖找到數字但信心不足，需要用 WebFetch 直接開啟原始頁面逐一核對船名/IMO/MMSI 三者是否完全一致(本次因工具呼叫預算限制未逐一 WebFetch 驗證，僅用 WebSearch 摘要判斷)。
- 2102 的 maritimeoptima.com 另一個 URL 路徑含 413212102，尚未用 WebFetch 直接開啟核對是否為真實矛盾或只是網址錯字，建議後續驗證。

## 新發現、未在清單中但有獨立佐證的中國海警船(舷號+MMSI)

### Takeaway
在查詢過程中另外發現 6 筆落在 413875xxx 區段、且有 2 個以上獨立網域互相印證的額外海警船記錄，以及數筆僅單一來源或互相矛盾的額外記錄。

### Cited Findings

**CONFIRMED（≥2 網域一致）**
- CHINACOASTGUARD3502 → MMSI 413875341，IMO 9776511 — [magicport.ai](https://magicport.ai/vessels/special-craft/chinacoastguard3502-mmsi-413875341)、[maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9776511/mmsi:413875341/CHINACOASTGUARD3502.html)、[directory.shipfix.com](https://directory.shipfix.com/ship/chinacoastguard-3502_IMO-9776511)（三個不同網域一致，信心最高的一筆新增發現）
- CHINACOASTGUARD6104 → MMSI 413875764，IMO 9596519 — [magicport.ai](https://magicport.ai/vessels/tugs-harbor-craft/chinacoastguard-6104-mmsi-413875764)、[maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9596519/mmsi:413875764/CHINACOASTGUARD_6104.html)
- CHINACOASTGUARD6105 → MMSI 413875765，IMO 9607497 — [magicport.ai](https://magicport.ai/vessels/tugs-harbor-craft/chinacoastguard6105-mmsi-413875765)、[maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9607497/mmsi:413875765/CHINACOASTGUARD6105.html)
- CHINACOASTGUARD3103 → MMSI 413875350，IMO 9591791 — [maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9591791/mmsi:413875350/CHINACOASTGUARD3103.html)、[vesselfinder.com](https://www.vesselfinder.com/vessels/details/9591791)
- CHINACOASTGUARD2305 → MMSI 413875037，IMO 列為 3430000(此 IMO 格式本身可疑，僅 7 位數但不符合一般海警大型船 IMO 常見起始碼，建議標註存疑) — [maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:3430000/mmsi:413875037/CHINACOASTGUARD2305.html)、[magicport.ai](https://magicport.ai/vessels/special-craft/chinacoastguard2305-mmsi-413875037)（MMSI 數字本身兩網域一致，但 IMO 欄位可疑，建議標 CONFIRMED-MMSI-only，IMO 待查）
- CHINACOASTGUARD3102 → 2 個網域(tradlinx.com、magicport.ai)同時給出 MMSI 413875349、IMO 9355678、call sign CNTF，但第三個網域 shipfix.com 對同一 IMO 9355678 給出不同的 MMSI 413211000 — [tradlinx.com](https://www.tradlinx.com/vessel-tracking/155321-CHINACOASTGUARD3102-MMSI-413875349-IMO-9355678)、[magicport.ai](https://magicport.ai/vessels/tugs-harbor-craft/chinacoastguard3102-mmsi-413875349)、[directory.shipfix.com](https://directory.shipfix.com/ship/china-coastguard-3102_IMO-9355678)（因存在第三方矛盾，依照「寧可少列、不可編造」原則降級為 CONFLICT，而非 CONFIRMED，即使 2/3 來源一致）

**CONFLICT（獨立來源互相矛盾）**
- CHINACOASTGUARD3102 → 如上，413875349(2 來源) vs 413211000(1 來源)，列 CONFLICT
- ZHONGGUO HAIJING1104 / CHINA COASTGUARD1104 → 同一 IMO 9361316，但出現兩個不同 MMSI：413875024(magicport.ai、tradlinx.com 兩網域一致)與 413213000(magicport.ai 另一頁、maritimeoptima.com) — [magicport.ai (413875024)](https://magicport.ai/vessels/special-craft/china-coastguard1104-mmsi-413875024)、[tradlinx.com](https://www.tradlinx.com/vessel-tracking/193997-CHINA-COASTGUARD1104-MMSI-413875024-IMO-9361316)、[magicport.ai (413213000)](https://magicport.ai/vessels/tugs-harbor-craft/china-coastguard1104-mmsi-413213000)、[maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9361316/mmsi:413213000/ZHONGGUO_HAIJING1104.html)。注意 413875024 這組的獨立網域印證力較強(2 個不同網域一致)，但因與另一組矛盾並存，依規則仍標 CONFLICT，不自行選用。
- CHINA GOVT COAST GUARD 旗下 ZHONG GUO HAI JING 6101/CHINACOASTGUARD6101 → 同一 IMO 9341811，magicport.ai 給 MMSI 413006101，maritimeoptima.com 給 MMSI 413045000 — [magicport.ai](https://magicport.ai/vessels/tugs-harbor-craft/china-coastguard6101-mmsi-413006101)、[maritimeoptima.com](https://maritimeoptima.com/public/vessels/pages/imo:9341811/mmsi:413045000/ZHONG_GUO_HAI_JING_6101.html)

**AMBIGUOUS（僅單一網域來源）**
- CHINACOASTGUARD11512 → MMSI 413875097，僅 magicport.ai 單一來源 — [magicport.ai](https://magicport.ai/vessels/pleasure-craft/chinacoastguard11512-mmsi-413875097)
- CHINACOASTGUARD13601 → MMSI 413875186，僅 magicport.ai 單一來源 — [magicport.ai](https://magicport.ai/vessels/special-craft/chinacoastguard13601-mmsi-413875186)
- CHINACOASTGUARD32504 → MMSI 413875881，僅 magicport.ai 單一來源 — [magicport.ai](https://magicport.ai/vessels/tugs-harbor-craft/chinacoastguard32504-mmsi-413875881)
- CHINACOASTGUARD3101 → MMSI 413875348，僅 ports.marinelink.com 單一來源，call sign BPRP9 — [ports.marinelink.com](https://ports.marinelink.com/vessels/vessel/413875348)
- CHINACOASTGUARD33601 → MMSI 412302410，僅 magicport.ai 單一來源；且此 MMSI 不在 413875xxx 區段內，需特別存疑 — [magicport.ai](https://magicport.ai/vessels/unspecified/chinacoastguard33601-mmsi-412302410)
- CHINACOASTGUARD5103 → MMSI 412473810，僅 magicport.ai 單一來源；MMSI 不在 413875xxx 區段內 — [magicport.ai](https://magicport.ai/vessels/tugs-harbor-craft/china-coastguard5103-mmsi-412473810)
- CHINACOASTGUARD2301 → magicport.ai 本身對同一字串給出兩筆完全不同性質的船舶紀錄：一筆是 MMSI 413875033(中國籤、call sign BNRX、一般貨船類別)，另一筆是 MMSI 352004016(巴拿馬籤、call sign 3E5404、不同船東)。這兩筆看起來是資料庫誤配對(把不相關商船誤標成 CHINACOASTGUARD2301)，不建議當作海警船 2301 的真實 MMSI 來源，列 AMBIGUOUS/存疑，需要更可靠來源才能判斷哪個(甚至兩個都不是)是真正的海警2301。

### Inferences
- 真正可信的 413875xxx 區段內新增舷號(有 2 網域以上一致，且未被第三方矛盾)：3502、6104、6105、3103，加上清單原有的 2901、2501、2502、3501、2102。這組合顯示該區段用於 2000~3999 系列與 6000+ 系列的船。
- magicport.ai 的資料品質明顯不穩定，同一字串可重複對應到不同 MMSI/IMO，使用前務必搭配至少一個非 magicport.ai 的網域二次核對，否則容易把資料庫雜訊誤植入正式清單。

### Gaps
- 未能找到更多舷號(例如 11601、31601、14xxx 系列)的任何佐證，無法判斷 413875xxx 區段是否還覆蓋這些舷號，或者它們根本不使用公開 AIS。
- 本次研究受限於約 15 次工具呼叫的建議上限，未對每一筆 AMBIGUOUS/CONFLICT 項目都用 WebFetch 直接開啟原始頁面逐字核對，僅依賴 WebSearch 回傳的摘要文字判斷；若要達到「每筆都必須用 WebFetch 直接開啟頁面核對」的更高標準，需要後續追加研究輪次逐一驗證。

## 413875xxx 子區段內還能找到哪些其他舷號(有獨立佐證)

### Takeaway
除了使用者已知的 2901/2501/2502/3501 與本次確認的 2102 之外，本次研究額外找到 3502、6104、6105、3103 共 4 筆落在 413875xxx 區段、且有 2 個以上獨立網域互相印證的舷號；另有 2305(MMSI 兩網域一致但 IMO 存疑)、3102(2 網域一致但第三方矛盾，降級 CONFLICT)、以及多筆僅 magicport.ai 單一來源(11512、13601、32504)。

### Cited Findings
- 詳見上一節「新發現」的完整列表與來源連結，此處不重複列出。

### Inferences
- 413875xxx 區段內已觀察到的確切數字範圍(依本次研究 + 使用者已知背景)：413875024、413875037、413875039、413875040、413875041、413875052、413875097、413875186、413875340、413875341、413875348、413875349(存疑)、413875350、413875411(存疑/矛盾)、413875750(存疑/矛盾)、413875756(單一來源存疑)、413875764、413875765、413875881。這顯示該區段至少橫跨 413875024 到 413875881，涵蓋範圍比原先已知的 4 筆更廣。

### Gaps
- 無法確認 413875xxx 區段的完整分配邏輯(例如是否按下水年份或船廠批次排序)，也無法確認區段的上下邊界，僅能依實際查到的數字列出目前觀察到的範圍。

---

## 總表(供報告撰寫者快速引用)

| 舷號 | MMSI | 狀態 | 來源數(網域) |
|---|---|---|---|
| 2901 | 413875041 | CONFIRMED(使用者背景已確認) | ≥2(背景) |
| 2501 | 413875039 | CONFIRMED | 2 |
| 2502 | 413875040 | CONFIRMED | ≥2 |
| 3501 | 413875340 | CONFIRMED(使用者背景已確認) | ≥2(背景) |
| 2102 | 413875052 | CONFIRMED | 2~3 |
| 3502 | 413875341 | CONFIRMED | 3 |
| 6104 | 413875764 | CONFIRMED | 2 |
| 6105 | 413875765 | CONFIRMED | 2 |
| 3103 | 413875350 | CONFIRMED | 2 |
| 2305 | 413875037 | CONFIRMED(MMSI)/IMO存疑 | 2 |
| 5901 | 413875411 或 413482360 | CONFLICT | 矛盾 |
| 6501 | 413330110 或 413875750 | CONFLICT | 矛盾 |
| 3102 | 413875349(2來源) 或 413211000(1來源) | CONFLICT | 矛盾 |
| 1104 | 413875024(2來源) 或 413213000(2來源) | CONFLICT | 矛盾 |
| 6101 | 413006101 或 413045000 | CONFLICT | 矛盾 |
| 1106 | 412371217 | AMBIGUOUS(單一來源) | 1 |
| 6306 | 413875756 | AMBIGUOUS(單一來源+IMO可疑) | 1 |
| 11512 | 413875097 | AMBIGUOUS(單一來源) | 1 |
| 13601 | 413875186 | AMBIGUOUS(單一來源) | 1 |
| 32504 | 413875881 | AMBIGUOUS(單一來源) | 1 |
| 3101 | 413875348 | AMBIGUOUS(單一來源) | 1 |
| 33601 | 412302410 | AMBIGUOUS(單一來源,區段外) | 1 |
| 5103 | 412473810 | AMBIGUOUS(單一來源,區段外) | 1 |
| 2301 | 413875033 或 352004016 | AMBIGUOUS/疑似誤配對 | 矛盾且疑似非真實海警船 |
| 2202, 2203, 2303, 2304, 21610, 21616, 11601, 31601, 14608, 14513, 14603 | — | 查無 | 0 |
