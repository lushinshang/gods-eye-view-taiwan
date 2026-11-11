# MMSI 自動分類可靠性與 AIS 欺騙／偽造風險

## Key Question 1: MMSI 是否可由船員/操作者自行改動？標準 AIS 機載設備改 MMSI 有多容易？

### Takeaway
MMSI 在規範上應固定不變，但實務上標準 AIS 機載設備可透過密碼解鎖後自行改動，網路上流傳破解密碼，且船主可額外購買備用發射器，用「乾淨」MMSI 製造新身分；AIS 本身不具加密、驗證或防偽機制，廣播內容真實性無法僅憑訊號本身確認。

### Cited Findings
- MMSI 理論上只應在船舶改旗（reflag）時變更，部分機型設有密碼保護，但這些密碼可在網路上找到，讓船員自行重新設定 MMSI — [Security or Safety: What is AIS Really For?](https://cimsec.org/security-or-safety-what-is-ais-really-for/)
- 船東可購買多組 AIS 發射器，用來製造帶有「乾淨」MMSI 的新船舶身分 — [Security or Safety: What is AIS Really For?](https://cimsec.org/security-or-safety-what-is-ais-really-for/)
- AIS 沒有內建驗證、加密或防偽（anti-malware）機制；單靠訊號本身無法確認廣播內容的真實性，需要其他驗證手段 — [Security or Safety: What is AIS Really For?](https://cimsec.org/security-or-safety-what-is-ais-really-for/)
- 部分商用 AIS 資料平台會「自動清理並修正資料，而非標示異常」，可能誤導分析者 — [Security or Safety: What is AIS Really For?](https://cimsec.org/security-or-safety-what-is-ais-really-for/)
- 低成本 AIS 偽造設備已被實證：研究者曾用約 700 歐元的 AIS 設備配合 software-defined radio，用一般電腦即可發送偽造訊號 — [Security or Safety: What is AIS Really For?](https://cimsec.org/security-or-safety-what-is-ais-really-for/)
- 軟體式偽造（software-based spoofing）比無線電式偽造更靈活，部分追蹤系統上出現的船舶軌跡實際上該船並未真正發送訊號 — [CIMSEC](https://cimsec.org/security-or-safety-what-is-ais-really-for/)
- 惡意行為者可攔截並更改地面接收站傳來的資料，即使船舶原本正確設定 MMSI，資料仍可能在傳到追蹤網站前被竄改 — [CIMSEC](https://cimsec.org/security-or-safety-what-is-ais-really-for/)
- 一篇 2024 年 *Nautica Adriatica*（Banyś et al.）論文指出，MMSI 可在發射器軟體層被竄改，或因位元反轉（bit inversion）產生帶有他船 MMSI 的有效訊息；此類 MMSI 變造不留痕跡，故該文提出以航速合理性檢查偵測注入的假軌跡點 — [WebSearch 彙整，原文未直接取得](https://hrcak.srce.hr/en/316611)
- AIS 廣播在協定層屬「開放、未加密、未驗證」的自我回報資料；2026 年 *Archives of Transport* 論文指出，AIS 訊息既未加密也未驗證，對手可用極低技術門檻攔截、操縱或偽造訊息 — [preprints.org survey](https://www.preprints.org/frontend/manuscript/89f4f2a533d23a2795b127571e44c2f0/download_pub); [Archives of Transport](https://www.archivesoftransport.com/index.php/aot/article/download/852/657/4486)
- Windward（商用 AIS 分析公司）指出 AIS 從設計之初就不是為安全或執法用途而生 — [Windward glossary](https://windward.ai/glossary/what-is-automatic-identification-systems-ais/)

### Inferences
- 綜合以上，MMSI 欄位的「改動門檻」主要是軟體密碼與使用者意願問題，不是硬體層級的不可變保護；一般船員或船隻管理方即可在不具備特殊技術背景的情況下完成變更。
- 若應用程式要以 MMSI 作為「真實身分」的唯一依據，等同信任一個可被設備擁有者單方面改寫、且改寫後不留痕跡的欄位。

### Gaps
- 未找到 ITU/IMO 官方文件直接明確聲明「MMSI 欄位無驗證機制」，多數佐證來自智庫/產業部落格與學術二次文獻，非 ITU/IMO 一級來源原文。
- CIMSEC 文章中「密碼可在網路上找到」一句屬意見性文章敘述，未獨立驗證具體密碼來源或機型型號。

---

## Key Question 2: 有哪些已記錄的 AIS 欺騙／MMSI 操弄／關閉 AIS／MMSI 與實際船籍不符案例，特別是中國政府/執法/科考船在南海、東海、台海？

### Takeaway
已有多筆有名有姓、附時間地點的紀錄案例，涵蓋中國海警船廣播假 MMSI／假呼號、中國科考船關閉 AIS 或偽造位置、以及中國遠洋漁船群組（「150 系列」）大規模冒用／共用 MMSI；多數指控來自菲律賓海巡、智庫（C4ADS/JAC、CSIS AMTI、Sealight）與商用分析公司（Windward），中國官方對個案多否認或稱「正常作業」。

### Cited Findings
- **2023/4/18，仁愛礁（Second Thomas Shoal）**：一艘攔截菲律賓補給任務的中國海警船，AIS 廣播船名「G」、船型標示為 2x2 公尺遊艇、MMSI 為 412000000；該 MMSI 同時被全球數十艘船舶使用 — [Sealight: Gray Zone Tactics Playbook: Spoofing](https://www.sealight.live/posts/gray-zone-tactics-playbook-spoofing)
- **2023/3/21，南沙群島**：中國海警船 5201 在跟蹤菲律賓海巡船 BRP Malapascua 時，將 AIS 呼號從「CCG5201」改為「DONGYU1527-8 50%」，菲律賓海巡觀察到此變更；「Yu」在中文意為「魚」，分析認為該船偽裝成漁船 — [Sealight](https://www.sealight.live/posts/gray-zone-tactics-playbook-spoofing)
- **2024/12，Zambales（San Felipe）**：菲律賓海巡指控一艘疑似中國海警船（舷號 21543）AIS 顯示位於菲律賓近海，實際位置經查核應在香港或廣州附近；分析該船 60 天內的 AIS 紀錄，發現其在短時間內「出現」於馬尼拉、Zambales、中國與南非等不可能的位置組合 — [ABS-CBN](https://abs-cbn.com/news/nation/2024/12/13/suspected-china-coast-guard-ship-in-zambales-engaged-in-ais-spoofing-pcg-1945); [Manila Bulletin](https://mb.com.ph/2024/12/13/AIS-spoofing-china); [Inquirer](https://globalnation.inquirer.net/258190/pcg-china-using-ais-spoofing-to-mislead-public-and-stir-confusion)
- **2024，Zambales**：中國科考船「深勘」（Shen Kou）據菲律賓軍方稱在菲國專屬經濟區內關閉 AIS 以規避監測 — [Tribune](https://tribune.net.ph/2024/05/02/chinese-research-ship-shen-kou-goes-dark)
- **2026/9–10，Batanes 附近**：菲律賓海巡指控中國科考船「佳海科 7」（Jia Hai Ke 7，2,000 噸、70 米海洋地質調查船）廣播假 AIS 位置，追蹤資料顯示其「同一天」從廈門外海跳到巴布亞紐幾內亞外海；菲律賓海巡稱已「驅離」該船，一艘中國海警船據報為其提供掩護；北京稱該船在「中國管轄海域從事正常作業」，稱菲方行動為「騷擾」。菲方另稱科考船「海洋地質十號」（Haiyang Dizhi 10）偶爾關閉 AIS — [Baird Maritime](https://www.bairdmaritime.com/work-boat-world/research-environment-training/philippines-catches-chinese-research-ship-faking-location-near-taiwan); [The Star](https://www.thestar.com.my/aseanplus/aseanplus-news/2026/09/28/philippines-accuses-chinese-vessel-of-spoofing-location-in-northern-waters); [gCaptain](https://gcaptain.com/philippines-accuses-chinese-vessel-of-spoofing-location-in-northern-waters/)
- **2021，印尼 EEZ**：中國科考船「向陽紅 03」（Xiang Yang Hong 03）在被追蹤系統識別其 AIS 關閉狀態後，駛離印尼專屬經濟區 — [SCMP](https://www.scmp.com/news/asia/southeast-asia/article/3117835/indonesia-spots-chinese-research-vessel-its-waters-tracker)
- **2023/10，釣魚台（尖閣諸島）附近**：日本海上保安廳偵測到中國科考船「向陽紅 18」（Xiang Yang Hong 18）出現在爭議海域 — [Search summary, 原始報導未逐一取得全文](https://news.usni.org/2021/01/16/chinese-survey-ship-caught-running-dark-give-clues-to-underwater-drone-operations)
- **2021，南海海底電纜廊道**：Windward 報告一艘中國科考船在涵蓋 SEA-H2X 與 EAC-C2C 海底電纜路由的 29 浬見方海域內滯留約 53 小時；Windward 同時聲明「未證實有進行調查作業」，資料本身不能證明有干擾電纜行為 — [Windward](https://windward.ai/?p=59477)
- **「150 系列」中國遠洋魷釣船群組**：Joint Analytical Cell（JAC，C4ADS 與 Trygg Mat Tracking 合作）2023 年報告記錄一組以「150」開頭 MMSI 的中國關聯魷釣船群，其行為包括：更換並共用船名、使用多個 MMSI、使用未分配給任何國家的 MMSI 號碼（可能用以隱藏不法活動）；至少一例中，該系列船隻在印度洋使用了一艘經授權中國漁船的身分，而該授權船隻實際正在大西洋/太平洋魷釣漁場作業；中國海外漁業協會表示已對此個案展開調查 — [C4ADS/JAC report](https://c4ads.org/news/jac-fisheries-intelligence-report/)
- **Global Fishing Watch**：偽造訊號（spoofing）佔其接收 AIS 訊號總量不到 0.25%；許多中國船舶廣播佔位用的 MMSI「412000000」，導致多艘船同時廣播同一號碼 — [Global Fishing Watch](https://globalfishingwatch.org/?p=387)
- **北韓船舶案例**（非中國但可作對照）：一艘北韓船舶曾循環使用約 30 種不同身分，包含船名、MMSI、呼號，甚至 IMO 編號 — [S&P Global](https://www.spglobal.com/market-intelligence/en/news-insights/research/2025/11/challenges-of-false-flagged-vessels-in-maritime-safety-and-compliance)
- **Sealight 的方法分類**：將 AIS 操弄分為三類——（1）身分偽造（identity spoofing，持續廣播假資料）；（2）身分切換（identity switching，執行特定任務時暫時改變資料）；（3）位置偽造（location spoofing，在 AIS 中嵌入假 GPS 座標）；該文作者明確聲明「未知任何中國安全船舶（security vessels）在南海進行位置偽造的案例」，但身分偽造「被中國灰色地帶行為者頻繁使用」 — [Sealight](https://www.sealight.live/posts/gray-zone-tactics-playbook-spoofing)
- **AMTI（CSIS）**：2022 年一案例中，AMTI 發現一艘以不同船名廣播的船舶，經衛星影像比對，實際是一艘 101 公尺、Zhaojun 級（Type 718B）海警船 — [WebSearch 彙整](https://amti.csis.org/china-coast-guard-patrols-in-2024-an-exercise-in-futility/)
- **台灣海峽**：Starboard Maritime Intelligence 資料顯示漁船「閔獅漁 06718」（Min Shi Yu 06718）在 2024 年 8–9 月期間，同時廣播自身 AIS 與另一艘船「海巡 15012」（Hai Xun 15012）的 AIS 身分 — [WebSearch 彙整，原始出處未逐一核實](https://www.csis.org/analysis/signals-swarm-data-behind-chinas-maritime-gray-zone-campaign-near-taiwan)
- **CSIS（2025/10）**：結合 GPS 與 AIS 訊號分析 315 艘中國籍漁船，發現 209 艘在軍演區附近出現 AIS 異常，用以區分海上民兵船與一般民用船 — [WebSearch 彙整](https://amti.csis.org/china-coast-guard-patrols-in-2024-an-exercise-in-futility/)

### Inferences
- 中國海警船、科考船、及漁船群組三種類型都有具名、具時間地點的 AIS 操弄記錄，且手法多樣（假 MMSI、改呼號、關閉 AIS、位置偽造、冒用他船身分），顯示這不是單一特例而是反覆出現的作業模式。
- 然而「位置偽造」這一類手法，Sealight 明確表示「未知任何中國安全船舶在南海有此案例」，顯示不同類型的偽造在不同場景的證據密度不同——身分層偽造（改名、改 MMSI、改呼號）證據較多，GPS 座標層偽造證據相對少。
- 絕大多數指控來源為菲律賓政府（海巡、軍方）單方陳述，中國官方對個案多否認或稱「正常作業」，故這些案例屬「有爭議的指控」而非雙方都認可的事實，須在報告中保持此標註。

### Gaps
- 東海/釣魚台案例資料較薄弱，僅找到「向陽紅 18」一筆二手彙整描述，未能取得原始日本海保廳或一級新聞報導全文核實細節。
- 台海「閔獅漁 06718 / 海巡 15012」案例僅見於 WebSearch 摘要層級，未直接取得 CSIS 原文或 Starboard 原始資料驗證其技術細節（如具體日期、位置、分析方法）。
- 未找到任何「日本海上保安廳船舶 MMSI 遭偽造或被冒用」的案例——搜尋結果中日本海保廳皆以受害/偵測方角色出現，未發現其自身識別資料遭操弄的記錄。

---

## Key Question 3: 商船/漁船的 MMSI 是否可能「碰巧」落入與政府船隻相同的數字區段，造成誤判風險？MID 區塊內是否存在「政府船隻專屬號碼範圍」的結構性保證，還是僅為鬆散慣例？

### Takeaway
ITU 的 MID（Maritime Identification Digits）制度僅在國家層級分配三位數字首碼（如中國 412–416 系列、日本 431/432 系列等），**沒有任何 ITU 規範在一國 MID 之下，為政府船舶/海警/科考船劃出專屬的數字子區段**；現有觀察到的「某類船多落在某號碼段」僅是各國海事主管機關核發號碼時的鬆散、非強制慣例，商船/漁船完全可能落入同一子區段，構成結構性的誤判風險來源。

### Cited Findings
- MMSI 為 9 位數字，前三位為 MID（Maritime Identification Digits），代表船籍國／地區；後六位才是該船的獨立識別碼 — [Wikipedia: Maritime Mobile Service Identity](https://en.wikipedia.org/wiki/Maritime_Mobile_Service_Identity); [USCG NAVCEN: Maritime Identification Digits (MID)](https://navcen.uscg.gov/node/33029)
- MID 為三位數，範圍 201–775，依地區／國家分配（例如首位數字 2 多分配給歐洲、3 分配給北美與加勒比海、4 分配給亞洲（不含東南亞部分地區））；一國可被分配多個 MID（例如丹麥有 219 與 220 兩個） — [Wikipedia: Maritime identification digits](https://en.wikipedia.org/wiki/Maritime_identification_digits)
- 海岸電臺（coast station）身分以開頭「00」+ MID 表示；群組識別以開頭單個「0」+ MID 表示；SAR 航空器與 AIS-SART（搜救示位器）則有各自不同的編碼模式，AIS-SART 的識別碼甚至與製造商相關、而非與船籍國相關 — [Wikipedia: Maritime identification digits](https://en.wikipedia.org/wiki/Maritime_identification_digits)
- 搜尋結果中**沒有找到任何 ITU 文件（Radio Regulations Appendix 43 / ITU-R M.585）提及「政府船舶」或「海警/執法船舶」在 MID 之下有專屬的號碼子區段分配規則**；MID 制度本身只分國家/地區，不分船舶所有權或用途類別 — [USCG NAVCEN](https://navcen.uscg.gov/node/33029)
- 實際案例佐證「無結構保證」：日本海上保安廳（Japan Coast Guard）船舶的 MMSI 並未集中在單一子區段，而是分散在日本 MID 之下的多個範圍（例如 432833000、432742000、431565000、431214000、431480000、431008353 等），與一般日本籍商船、拖船共用同一 MID 前綴 431/432，僅後六位不同 — [MagicPort / MarineLink 船舶資料彙整](https://ports.marinelink.com/vessels/vessel/432833000); [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/koshiki-mmsi-432742000)
- 「150 系列」案例恰好是「號碼區段」被濫用的反例：JAC 報告指出，一組中國關聯魷釣船隻的 MMSI 前三位皆為「150」——但 150 **並未分配給任何國家**，之所以能成為一個可辨識的「群組」，恰恰是因為它脫離了正常 MID 分配，而非因為它是某類船舶的官方保留區段；JAC 認為這類未分配號碼反而可能被用來隱藏不法活動 — [C4ADS/JAC report](https://c4ads.org/news/jac-fisheries-intelligence-report/)
- 中國海警船廣播假 MMSI 時所用的「412000000」本身是一個**符合中國 MID（412-416系列）格式、但以全零填充後六位**的粗略偽造方式，而非利用某個「政府船隻專屬子區段」；該號碼同時被全球數十艘船使用，顯示這種零填充手法本身就會製造大量號碼衝突 — [Sealight: Gray Zone Tactics Playbook](https://www.sealight.live/posts/gray-zone-tactics-playbook-spoofing)
- 索馬利亞/亞丁灣外海一項研究發現，當地只識別出 5,122 個不同 MMSI 值，卻偵測到 5,235 艘不同船舶——即 MMSI 數量少於實際船舶數量，顯示號碼重複使用／共用在實務上普遍存在，而非僅限政府船隻 — [WebSearch 彙整自美國專利文件](https://patents.google.com/patent/US12469337)

### Inferences
- 由於 ITU 的 MID 制度只保證「國家層級」的首三位數字唯一性，一國主管機關（海事局）在核發後六位號碼時，通常依申請/註冊順序或类別**各自決定**，各國做法不保證公開、不保證政府船隻與商船使用不同數字池；因此任何「看起來像」海警船或科考船專屬的號碼模式（例如某些使用者觀察到「某段號碼多為海警船」），極可能只是該國主管機關核發時間/類別的巧合聚類，不是具約束力的國際規範。
- 日本海保廳案例直接證明了這一點：其船隻 MMSI 分散在與一般商船/拖船相同的國家 MID 前綴（431/432）之下，單從前綴或號碼段無法可靠地把海保廳船與其他日本籍船隻區分開。
- 若一個應用程式打算用「MMSI 數字區段」作為啟發式規則來自動標記「中國海警」「中國科考船」「日本海保」，等同於把「觀察到的巧合聚類」當成「結構性保證」——這在邏輯上是不成立的推論，且 150 系列、412000000 零填充等案例顯示，刻意偽造者反而更可能製造出「看起來像合法號碼段」的假象。

### Gaps
- 未直接取得 ITU Radio Regulations Appendix 43 / ITU-R M.585 原文逐條核對，僅透過二手來源（Wikipedia、USCG NAVCEN）確認其規範範圍不含「依船舶用途/所有權分類」的子區段規則；若需要絕對確定性的一級引用，仍應直接查閱該 ITU 文件。
- 未找到專門研究「各國海事主管機關核發 MMSI 給政府船舶 vs. 商船的實際號碼分佈模式」的量化研究（例如統計中國所有已知海警船 MMSI，看是否真的呈現可觀察的聚類，即使非規範性）；此為本報告未能驗證、但對評估「觀察到的鬆散慣例有多鬆散」很關鍵的缺口。

---

## Key Question 4: 海事資安／AIS 安全研究者如何評價 AIS 廣播身分欄位（MMSI、船名、呼號）作為安全/情報訊號的可信度，相較於物理/行為訊號（航跡、速度、位置模式）？

### Takeaway
學術與產業研究者的共識是：AIS 身分欄位（MMSI、船名、呼號）屬「未加密、未驗證的自我回報資料」，單獨不能作為可信的安全/情報訊號；真正用於偵測欺騙的方法，普遍依賴物理/行為層訊號（訊號傳播延遲、都卜勒頻移、航跡運動模式、衛星接收範圍一致性），而非身分欄位本身。

### Cited Findings
- 2026 年 arXiv 論文《SeaSpoofFinder》指出，僅憑 AIS 本身的證據無法確定偽造訊號的責任歸屬（who is responsible），且發現資料提供者層級的時間戳記（provider-level timestamp）並非可靠的偽造判別依據 — [arXiv:2602.16257](https://arxiv.org/html/2602.16257v1)
- 另一篇 2026 年 arXiv 論文（大範圍 GNSS 偽造/干擾偵測）指出，原始 AIS 訊息在通訊層本身就存在缺陷（如重複 MMSI），這類缺陷本身會與真正的偽造訊號相混淆；其框架在約 9.66 億則韓國海域訊息上測試，相較單純聚類方法減少 98.6% 的誤報 — [arXiv:2603.11055 彙整](https://arxiv.org/abs/2603.11055)
- *Revista Română de Informatică și Automatică*（2025）論文透過分析黑海船舶運動學特徵，論證可從真實航跡中區分出模擬／偽造航跡——即偵測重點放在行為/運動模式，而非身分欄位 — [DOAJ](https://doaj.org/article/3b1d85275a8942449f8aa7c67abf3d9b)
- CIMSEC 文章明確指出：「確認（AIS）廣播內容真實性，在沒有其他驗證手段的情況下是不可能的」；track 層訊號（例如軌跡超出地面接收站理論接收範圍、缺乏衛星接收痕跡）被用來標記軟體生成的假訊號 — [CIMSEC](https://cimsec.org/security-or-safety-what-is-ais-really-for/)
- CIMSEC 同文指出，機器學習被用於偵測可疑模式，例如船舶「瞬間移動」（teleporting）等異常航跡特徵，屬行為層偵測手段 — [CIMSEC](https://cimsec.org/security-or-safety-what-is-ais-really-for/)
- Windward 聲明 AIS 從設計之初即非為安全或執法用途而建 — [Windward](https://windward.ai/glossary/what-is-automatic-identification-systems-ais/)
- 2026 年 *Archives of Transport* 論文指出 AIS 訊息「既未加密也未驗證」，對手可用極低技術門檻攔截、操縱或偽造 — [Archives of Transport](https://www.archivesoftransport.com/index.php/aot/article/download/852/657/4486)
- Global Fishing Watch 的船舶分類模型明確承認：若「推論得出的船型」與「AIS 自報的船型」對是否為漁船的判斷互相矛盾，該 MMSI 便不會被指派任何船舶類別；其方法論文件也指出船殼對應的身分（包含 MMSI）會隨時間變化，且部分船舶會進行身分偽造 — [Global Fishing Watch](https://globalfishingwatch.org/?p=387)
- IQT Labs 分析發現，兩艘外觀視覺上相同的船舶，AIS 卻自報為兩種不同船型（「拖船」與「貨船」），顯示 AIS 自報船型欄位本身在設定階段就可能被誤填 — [IQT Labs](https://www.iqt.org/library/maritime-mysteries-solving-ai-data-labeling-challenges-at-sea)

### Inferences
- 研究社群的方法論選擇本身就是對「身分欄位可信度」的隱性評價：幾乎所有近期偵測偽造的學術工作都繞過身分欄位，改用物理層（訊號傳播延遲、都卜勒頻移）或行為層（航速、航向、時間間隔、軌跡形狀）特徵作為判別依據,這反映業界默認身分欄位不可單獨信任。
- 對本專案（公開資料視覺化應用）而言，這意味著：若僅憑 MMSI 數字模式做分類，其可信度低於結合航跡行為/物理訊號的方法；但即便是行為層方法，目前文獻顯示也只能做「異常偵測」（flag 可疑），尚未有成熟方法能做到「高準確度自動歸類船舶所屬機關」。

### Gaps
- 未找到專門比較「身分欄位 vs. 行為訊號」準確率的量化基準測試（benchmark），僅能從個別論文的方法選擇和質性陳述推論業界傾向；若需要具體準確率數字對比，現有搜尋結果不足以支撐。

---

## Key Question 5: 是否有已知的實際自動化船舶分類系統（學術、或 Windward/Spire/Starboard 等商用平台）明確使用「MMSI 號碼範圍啟發式規則」來分類船舶類型/所屬機關？其準確率/限制如何描述？

### Takeaway
在本次搜尋範圍內，**未發現任何學術或主流商用 AIS 分析平台（Global Fishing Watch、Starboard、Windward、Spire）將「MMSI 數字範圍」作為船舶類型/所屬機關分類的核心方法**；主流作法是依賴 AIS 訊息中「自我回報的船舶類型欄位（static ship type field）」搭配行為特徵（航速、航向、訊息間隔）做機器學習分類，且各平台都明確承認自報欄位本身可能錯誤或衝突。

### Cited Findings
- **Global Fishing Watch**：將 AIS 資料中每個活躍 MMSI 分配至其 40 種船舶類別中的一種，並推論船長、吨位、引擎功率；若推論結果與 AIS 自報資料在「是否為漁船」上互相矛盾，則該 MMSI 不會被指派任何類別；其方法論明確承認：船體對應的身分（含 MMSI）會隨時間改變，且部分船舶會進行身分偽造 — [Global Fishing Watch](https://globalfishingwatch.org/?p=387)
- **Starboard Maritime Intelligence**：其「漁船分類模型（fishing classifier）」主要依賴 AIS 自我回報的船舶類型欄位（如貨船、漁船、遊艇），搭配航速、航向、訊息間隔等行為特徵，並與 Global Fishing Watch 合作開發；當發現錄入錯誤時，Starboard 會更新「AIS 自報船型」欄位以反映實際船型；其資料供應商為 Spire 與 S&P Global。該分類模型僅涵蓋「是否為漁船」這一單一判斷，不涉及一般船舶類型/所屬機關的廣泛分類 — [Starboard help article](https://help.starboard.nz/en/articles/6230281-how-it-works-fishing-classifier-model)
- **美國專利文件（vessel identification 相關）**：指出 MMSI 與 IMO 編號的準確性問題，限制了用次級資料庫來補充 AIS 訊息本身資訊的可行性；索馬利亞外海的研究發現僅識別出 5,122 個不同 MMSI 值，卻偵測到 5,235 艘不同船舶，顯示 MMSI 與實際船舶數量不一致 — [US12469337B2](https://patents.google.com/patent/US12469337)
- **IQT Labs**：AIS 船型標籤可能互相矛盾——兩艘外觀相同的船舶被標示為不同船型；若發射器設定階段資料被誤填，收集到的資料就會引用錯誤的船舶類型 — [IQT Labs](https://www.iqt.org/library/maritime-mysteries-solving-ai-data-labeling-challenges-at-sea)
- **學術機器學習方法**（與商用平台方法不同，屬於研究性質）：2025 年 arXiv 論文使用 AIS 航跡在博恩霍爾姆海峽（Bornholm Strait）對 5 種船型做分類，測試集準確率達 92.15%，但這是窄範圍、5 類別的設定，不能外推至「一般啟發式規則的準確率」 — [arXiv:2509.18109](https://arxiv.org/abs/2509.18109)
- 2022 年 *Ocean Engineering* 期刊研究指出，AIS 船舶分類的表現會因「類別標籤的選擇」與「資料前處理過濾方式」而顯著不同 — [USF COMIT](https://www.marine.usf.edu/comit/2026/08/12/some-methods-for-addressing-errors-in-static-ais-data-records/)

### Inferences
- 沒有找到「MMSI 號碼範圍」被當作分類依據的先例，這本身是一個重要的負面結果：它暗示業界/學界普遍認為 MMSI 數字模式不足以支撐可靠分類，因此才轉向「自報船型欄位 + 行為特徵 + 機器學習」的複合方法，而即便是這種複合方法，也只處理「船舶類型」（如漁船/貨船）的粗分類，未見有平台宣稱能用 AIS 資料可靠分類「所屬政府機關」（如區分中國海警與中國漁政或地方海事局船隻）。
- 這進一步支持：對本專案而言，若要做「China Coast Guard / Chinese research vessel / Japan Coast Guard」這類機關層級的自動標記，比起一般「船舶類型」分類難度更高，且業界找不到先例可直接複用其方法論或準確率基準。

### Gaps
- 未直接取得 Windward 或 Spire 官方技術白皮書原文，僅透過二手搜尋結果得知其一般性立場（AIS 非安全系統設計）,未能確認這兩家公司是否有內部使用 MMSI 範圍作為任何輔助判斷因子（即使非公開揭露的方法論細節）。
- 未找到任何公開資料庫或清單，整理「已知中國海警/中國科考船/日本海保船」的完整 MMSI 清單並標註其分配邏輯；若使用者專案已有自建的 MMSI 對照表，建議單獨人工核實清單中每一條目的一手來源（例如 ITU MARS 資料庫、各國官方公告），而非依賴本報告列出的零散第三方聚合站資料（如 MagicPort 等船舶追蹤網站，其資料品質未經官方驗證）。
