# OWASP／CVSS 對應方法說明（2026-11-09）

記錄這次把6個finding對應到OWASP分類、以及F-002正式採用官方CVSS分數的依據與查證過程。

## F-002：正式採用GHSA官方CVSS（唯一有CVSS的finding）

`qa/ghsa-8g5g-mxqh-grgj-2026-11-09.json` 是直接呼叫GitHub Advisory API
（`https://api.github.com/advisories/GHSA-8g5g-mxqh-grgj`）取得的原始回應，未經修改。關鍵欄位：

- `cve_id`: CVE-2026-118662
- `cvss_severities.cvss_v4`: `vector_string` = `CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:L/VI:N/VA:N/SC:H/SI:N/SA:N`，`score` = 6.9
- `cwes`: CWE-180（Incorrect Behavior Order: Validate Before Canonicalize）、CWE-284（Improper Access Control）
- `description`：官方明寫只有符合三個條件的部署才受影響——明確用`--host`或`server.host`把dev server曝露到網路、敏感檔案在`server.fs.allow`允許目錄內、且被`server.fs.deny`的pattern擋到。

GEV的預設部署是loopback-only（SECURITY.md已有文件），不符合官方描述的「明確曝露到網路」前提，
所以**引用官方6.9分，但同時附註GEV自身的實際曝露面可能更低**，不能直接說GEV用戶的實際風險就是6.9。

## F-001、F-003：為什麼仍然沒有CVSS

CVSS規格本身的適用範圍是「有C/I/A（機密性/完整性/可用性）影響的安全缺陷」：

- **F-003**（413死碼）：報告自己的既有分析已經寫明「不構成安全繞過，只影響呼叫端能否得知失敗原因」——沒有C/I/A影響，CVSS計算機套進去只會算出0分，給分數反而誤導讀者以為這是「低但有」的安全問題。
- **F-001**（grounding缺陷）：缺的是「實際暴露範圍」與「業務決策用途」，這兩者至今仍未確認（沒有去量化使用者實際上會不會因為這個回答做錯決定），跟修補與否無關。

兩者都不是「偷懶不給」，是CVSS規格本身的適用條件不成立。

## OWASP對應依據

**Web應用（OWASP Top 10:2021）**：用2021版（穩定、無爭議的正式版本）。2026年網頁版Top 10目前
只查到未經OWASP官方頁面確認的draft報導（gbhackers等二手來源，說法互相矛盾），引用未確認的draft
不夠嚴謹，所以採用已經正式定案的2021版。

**LLM應用（OWASP Top 10 for LLM Applications 2026）**：2026年8月3日發布的正式版（多個獨立來源
交叉確認LLM07為Misinformation），F-001對應到這個分類。

| Finding | 對應分類 | 依據 |
|---|---|---|
| F-001 | OWASP LLM Top 10 2026 — **LLM07: Misinformation** | AI輸出的錯誤資訊被驗證邏輯誤判為可信 |
| F-002 | OWASP Top 10:2021 — **A01:權限控制失效**（主）／**A05:安全設定缺陷**（次） | 符合GHSA的CWE-284 Improper Access Control |
| F-003 | 無法乾淨對應到A01-A10:2021任一項；CWE-755（Improper Handling of Exceptional Conditions）更貼切 | 純錯誤處理缺陷，非存取控制或設定問題 |
| C-002 | OWASP Top 10:2021 — **A04:不安全設計** | 缺資源消耗上限是典型的設計層級缺陷 |
| C-003 | OWASP Top 10:2021 — **A01:權限控制失效** | 父目錄鏈信任邊界問題 |
| C-004 | OWASP Top 10:2021 — **A01:權限控制失效**（主）／**A04:不安全設計**（次） | 代理路由責任邊界的架構設計問題 |
