# 2026-11-09 後續 session 摘要（報告 v1.1.0 用）

本檔是摘錄，不是原始證據。完整主動測試產出（提案、任務、可重跑腳本 `run_all.py`、`build-throwaway.sh`、完整 `results.md`）保留在本工作區外的 `sdd/archive/2026-11-09-active-pentest-localhost/`，不在 `tools/` 範圍內，因此本報告的來源連結機制（`href` 必須是 `../../` + `tools/` 內相對路徑）連不到那裡；本檔把判讀結論複製進 `tools/` 範圍內，供報告引用與連結。摘錄時間：2026-11-09，摘錄者核對過完整版本一致。

## 本次新增的產品 commit（基於原報告鎖定的 `e50944f`）

| commit | 日期 | 內容 |
|---|---|---|
| `6bff971` | 2026-11-09 | fix(ai): GEV-F-001 grounding 船舶數量固定值 5 修補 |
| `75fa234` | 2026-11-09 | chore(deps): vite 6.4.4 → 6.4.5，修補 GHSA-8g5g-mxqh-grgj |
| `eed948f` | 2026-11-09 | docs(security): 新增本安全評估 HTML 報告並於 README 掛載連結 |
| `255abdd` | 2026-11-09 | chore: 移除已追蹤的 pyc 並忽略 `__pycache__` |
| `375dfa7` | 2026-11-09 | fix(setup): `/api/setup/keys` 超限時改回乾淨 413；docs(security): 補 Deployment model 段落 |

## 主動測試六面向結論（摘自 `active-pentest-localhost/results.md` 總覽）

對運行中容器 `127.0.0.1:4173` 只送 GET／HEAD／OPTIONS，會變更狀態的測試（PAT 生命週期、`/api/setup/keys`、超大 body）只打一個用完即棄的原生 node 副本（不含真實 `.env`）。涵蓋六面向：Host／Origin／DNS rebinding、本機准入偽造、檔案存取與 `fs.deny`、輸入邊界、PAT 生命週期與 `panel_request`、信任邊界彙整。

**結論**：六個面向全部測完，沒有找到可讓外部或跨來源請求繞過准入、讀到機密、或造成未授權狀態變更的缺口。找到三項「考慮」等級的正確性／設計澄清，不是漏洞：

1. 重複 `Host` 標頭由底層解析器取第一個值，不符 RFC 7230，但目前服務沒有反向代理擋在前面，不構成可利用缺口（面向 A）。
2. Docker 閘道信任是 `docker-start.mjs` 開機時主動把容器核心的預設閘道位址寫進執行中行程記憶體，把先前報告 OBS-002「待確認」的機制坐實為已知、刻意設計的行為（面向 B）。
3. `/api/setup/keys` 超過 8192 bytes 時，原始程式用 `req.destroy()` 中止連線，413 分支是無法到達的死碼；已於 `375dfa7` 修補。

PAT 建立／輪替／撤銷的生效時機（面向 E，連續 10 次驗證非偶發）與 vite 6.4.5 的 `fs.deny` 修補是否擋下已知繞過手法（面向 C，用真實存在的 `package.json`／`.gev-cache` 檔案做正向對照）都用真實 HTTP 請求確認過，結果乾淨。

**驗收過程**：經四輪獨立驗收（每輪皆為不信任前一輪結論的全新 agent），逐步發現並補齊可重跑腳本（`run_all.py`）的缺漏，最終 65 個展開後的子測試與 `results.md` 逐一核對一致。另有一輪驗收發現並修正了暫存殘留風險（另一次任務留下的測試副本整個用符號連結指到真實 `.env`／`.gev-cache`／`.gev-logs`），已清除並確認未影響真實檔案。

## 本次未做、仍是缺口的部分

Standalone 建置、受控瀏覽器 DOM、Docker 實體拓樸、真模型／真上游測試仍未執行；happy-dom 的 2 筆 dev 相依漏洞（跨大版本）未處理；C-002（上游無累積 byte 上限）未實際加上限，只補了文件聲明單人本機的信任假設；C-003（PAT 父目錄鏈）同樣只補文件聲明，未加父目錄驗證。

這些限制不因本次工作而解除，產品安全評估整案仍未完成，無發布放行。
