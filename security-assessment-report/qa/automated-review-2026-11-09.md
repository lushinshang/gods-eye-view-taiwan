# 自動化安全掃描記錄（2026-11-09）

## 工具與方法

Claude Code `/security-review` 指令（security-review skill）：AI驅動的diff審查，讀取完整程式碼差異、對照repo既有安全慣例，找出「本次新增程式碼」帶來的具體安全含義。非人工滲透測試，非形式化稽核；是對diff的靜態閱讀分析，不執行程式碼。

## 範圍

- diff範圍：`origin/HEAD`（commit `375dfa7`）到本機 `main`（commit `2bdec8a`），共10個commit
- 修改檔案：`repo/server/providers/ai/ollama-advisor.js`（+test）、`repo/server/providers/local.js`、`repo/server/standalone/memory-monitor.js`（+test）、`repo/src/tools/queries/panelRequestRealHandlers.test.mjs`、`repo/src/ui/views/panels/TaiwanAiAdvisor.vue`、`tokenReveal.js`（+test）、`security-assessment-report/build_report.py`、`security-assessment-report/qa/*.py`／`*.mjs`
- 檢查類別：輸入驗證（SQL/command/XXE/template/NoSQL injection、path traversal）、認證與授權、加密與密鑰管理、注入與程式碼執行（反序列化RCE、eval injection、XSS）、資料暴露
- 明確排除（不在此次掃描範圍）：Denial of Service／資源耗盡、磁碟上的secrets儲存、rate limiting、本次PR之前就存在的既有問題

## 結果

未發現符合條件的具體高可信度（信心>80%）安全漏洞。逐檔案判斷：

| 檔案 | 判斷 |
|---|---|
| `ollama-advisor.js`（`assertNoSymlinkAncestors`） | 安全強化，非新漏洞；註解已誠實標註殘留TOCTOU間隙，屬已知並接受的風險 |
| `memory-monitor.js` | 只讀`os.totalmem()/freemem()`印到console，無使用者輸入、無敏感資料外洩 |
| `local.js` | 只新增import+陣列註冊，無邏輯風險 |
| `TaiwanAiAdvisor.vue`＋`tokenReveal.js` | 改動方向是降低PAT曝露面；「系統剪貼簿可能被其他app讀取」屬裝置生態既有特性，非程式新增缺陷，信心不足80% |
| `panelRequestRealHandlers.test.mjs` | 純測試檔，非生產路徑 |
| `build_report.py`（`stat_dashboard()`） | 輸出經既有`esc()`escaping，資料來源是本機JSON，無template injection/XSS路徑 |
| `qa/*.py`／`*.mjs` | 離線稽核腳本，未發現新增的`subprocess`/`eval`/`pickle`/`yaml.load`/`shell=True` |

## 限制（為什麼這不構成任何候選風險的解決）

- 只檢查5類（輸入驗證、認證授權、加密、注入/RCE、資料暴露），明確排除DoS/資源耗盡與rate limiting——GEV-C-002（上游無byte上限）屬於排除範圍，這次掃描完全沒有評估它。
- GEV-C-003的殘留TOCTOU間隙被此掃描辨識為「已知並接受的風險」而不列為新漏洞，但這不等於TOCTOU問題已解決，只是沒有被列為「本次新增」的漏洞。
- GEV-C-004（代理路由責任契約）不屬於上述5個檢查類別，此次掃描未觸及。
- 範圍只是這10個commit的diff，不是整個repo或整個應用程式的全面掃描；「沒找到」不等於「沒有」，只代表這個範圍、這個方法、這次執行沒找到達到信心門檻的具體漏洞。
