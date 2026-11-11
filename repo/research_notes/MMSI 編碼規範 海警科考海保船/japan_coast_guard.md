# Japan Coast Guard (海上保安庁, JCG) MMSI Numbering Patterns

## Q1: For specific named JCG vessels, what are their documented MMSI numbers?

### Takeaway
Multiple JCG patrol/survey vessels have verifiable MMSI numbers (via third-party AIS aggregators, not an official JCG registry), all within Japan's 431/432 MID block, but the sample shows no single clean leading-digit sub-range reserved for JCG — JCG MMSIs are interleaved with merchant-vessel MMSIs across both 431xxxxxx and 432xxxxxx space.

### Cited Findings
- AKITSUSHIMA (あきつしま, large PLH-type patrol vessel) — MMSI **431004594**, IMO 9638068, commercial manager/registered owner listed as Japan Govt Coastguard, length ~150 m, DWT ~3,800t — [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/akitsushima-mmsi-431004594); note a same-named general cargo ship "AKITSUSHIMA" exists with a different MMSI (431005736, IMO 9711274) and must not be confused with the patrol vessel — [MagicPort](https://magicport.ai/vessels/general-cargo/akitsushima-mmsi-431005736), [Shipfix](https://directory.shipfix.com/ship/akitsushima_IMO-9638068)
- MIZUHO (みずほ, PLH-41-class large patrol vessel) — MMSI **431001410**, IMO 9820752, call sign 7KEA, built 2019, LOA ~134m, commercial manager "JAPAN GOVT COASTGUARD" — cross-confirmed by [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/mizuho-mmsi-431001410), [Maritime Optima](https://maritimeoptima.com/public/vessels/pages/imo:9820752/mmsi:431001410/MIZUHO.html), and [MarineLink](https://ports.marinelink.com/vessels/vessel/431001410); a same-named cargo tug "MIZUHO MARU" has unrelated MMSIs 431000483 and 431007486 — do not confuse
- ECHIGO (えちご, patrol vessel) — MMSI **431176000** — [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/echigo-mmsi-431176000)
- DAISEN (だいせん, patrol vessel) — MMSI **432307000**, registered owner Japan Govt Coastguard — [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/daisen-mmsi-432307000)
- ISHIGAKI (いしがき, patrol vessel, Japan-flagged) — MMSI **432674000** — [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/ishigaki-mmsi-432674000)
- ISEHAMA (いせはま) — MMSI **432446000**, classified by MagicPort as a "fishery patrol vessel" — [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/isehama-mmsi-432446000) — **unverified whether this is JCG or a separate agency (水産庁/Fisheries Agency) vessel; flag as uncertain, not confirmed JCG**
- YONAKUNI (よなくに, patrol vessel, Senkaku-area Ishigaki-based unit) — MMSI **431008353**, IMO 9802372, registered owner Japan Govt Coastguard — [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/yonakuni-mmsi-431008353)
- OKI (おき, patrol vessel) — MMSI **431008718** — [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/oki-mmsi-431008718)
- NOTO (のと, patrol vessel) — MMSI **431005989**, IMO 9765627 — [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/noto-mmsi-431005989)
- ASAZUKI (あさづき, patrol vessel) — MMSI **431017198**, IMO 9860855 — [MagicPort](https://magicport.ai/vessels/tugs-harbor-craft/asazuki-mmsi-431017198)
- HAKUREI (はくれい, survey vessel) — MMSI **432833000**, IMO 9597604, Japan-flagged, owner listed as Japan Coast Guard; position data on the aggregator page looked garbled (identical lat/long), so treat the live-position portion (not the MMSI itself) with caution — [AIS Vessel Tracker](https://aisvesseltracker.com/) (via search aggregation)
- No MMSI could be found in search results for しきしま (SHIKISHIMA, new PLH-32-class vessel launched March 2024) or ほうおう (HOUOU) — see Gaps
- JAPAN GOVT COASTGUARD is listed by MagicPort as commercial manager/owner of a fleet variously reported as 67 or 100 vessels (two different MagicPort pages gave inconsistent totals), but the fleet roster/MMSI list itself is paywalled and not visible — [MagicPort fleet page](https://magicport.ai/owners-managers/japan/japan-govt-coastguard)

### Inferences
- JCG vessel MMSIs span both the 431 and 432 MID blocks with no observed clustering in a specific leading digit after the prefix (observed third-to-fourth digits after 431/432 include 0,1,5,6,7,8 — e.g. 431001410, 431004594, 431005989, 431008353, 431008718, 431017198, 431176000, 432307000, 432446000, 432674000, 432833000). This suggests MMSIs are assigned sequentially/administratively by radio-station licensing order rather than by a vessel-category code embedded in the MMSI itself.
- Confusion with same-named merchant vessels (AKITSUSHIMA, MIZUHO MARU) in search results indicates that vessel name alone is an unreliable lookup key; MMSI/IMO pairing is necessary for confident identification.

### Gaps
- Could not find MMSI for SHIKISHIMA (しきしま) — neither the retired first-generation vessel nor the new PLH-type vessel launched 2024-03-13 at Mitsubishi Heavy Industries Shimonoseki. Japanese search results only returned news articles about the vessel's history/retirement, no AIS/MMSI data.
- Could not find MMSI for HOUOU (ほうおう) — no vessel by this name surfaced in any patrol-vessel class list reviewed (Mizuho-class, Shunko/PLH-41-class).
- Could not confirm whether ISEHAMA and HAKUREI's "Japan Coast Guard" ownership attribution (third-party aggregator) is accurate versus belonging to Japan Fisheries Agency (水産庁) or Japan Hydrographic/other government bodies — these labels come from MagicPort's automated classification, not an authoritative source.
- No access to MarineTraffic.com or VesselFinder.com ship detail pages directly (search snippets only); a direct fetch of those sites for named vessels was not performed within this research pass and could add further confirmed examples or contradict the above.

## Q2: Does 総務省 (MIC) publish official documentation distinguishing government/patrol vessel MMSI ranges from merchant MMSI ranges within 431/432?

### Takeaway
No such distinguishing documentation was found. Japanese-language searches of 総務省 (Ministry of Internal Affairs and Communications) radio-station licensing pages returned only general procedural material on small-craft radio station licensing (免許, AIS equipment installation rules), with no indication that 総務省 publishes a sub-range or allocation scheme separating government/patrol vessels from merchant vessels within Japan's 431/432 MID block.

### Cited Findings
- 総務省 pages found cover general ship radio station classification (e.g., which installed equipment — international VHF, simplified AIS — classifies a vessel as a "特定船舶局 (MSS)") and licensing procedures (application, renewal, discontinuation) at the regional bureau level (東海総合通信局) — [総務省 東海総合通信局 手続きページ](https://www.soumu.go.jp/soutsu/tokai/musen/musenkyokukaisetu/0329.html)
- A 2014 総務省 press release discusses regulatory changes to make it easier to install simplified AIS on small vessels (removing mandatory periodic inspection, simplifying licensing procedures) but does not address MMSI range allocation by vessel category — [総務省報道資料](https://www.soumu.go.jp/menu_news/s-news/01kiban15_02000071.html)
- A 2008 総務省 document summarizing maritime communications as centered on small vessel ship stations was found but not confirmed to contain MID/MMSI sub-allocation detail — [総務省資料](https://www.soumu.go.jp/main_sosiki/joho_tsusin/policyreports/chousa/kaijo_senpaku/pdf/080424_2_si3.pdf) (title/content not fully verified — listed in search results only)

### Inferences
- The absence of any such published distinction, combined with the Q1 finding that observed JCG MMSIs are scattered across the 431/432 space without clustering, together suggest Japan likely assigns MMSIs from a common pool regardless of vessel type (government vs. merchant), rather than reserving a sub-block for government/patrol vessels — but this is an inference, not a confirmed policy statement.

### Gaps
- Did not locate or read the full text of the 2008 総務省 PDF (080424_2_si3.pdf) or several other PDF results (e.g., 000551755.pdf, 000551761.pdf, 000551765.pdf, 000852610.pdf) that appeared in search results — these were not fetched and could potentially contain MID/MMSI allocation detail not captured above.
- No official JCG (kaiho.mlit.go.jp) page describing a public vessel-tracking service or MMSI policy was found in this research pass; the JCG's own "Vessels and Craft" page (https://www.kaiho.mlit.go.jp/e/organization/vessels_craft.html) appeared in search results but was not fetched/read for MMSI content.

## Q3: Is there a known digit-pattern convention associated with JCG vessels across multiple examples?

### Takeaway
Based on the 11 vessel-MMSI pairs collected (Q1), there is **no identifiable digit-pattern convention** — i.e., this is an unverified/negative finding: no particular leading digit(s) after the 431/432 MID prefix empirically correlate with JCG vessels in this sample.

### Cited Findings
- Observed JCG-attributed MMSIs (431xxxxxx): 431001410 (MIZUHO), 431004594 (AKITSUSHIMA), 431005989 (NOTO), 431008353 (YONAKUNI), 431008718 (OKI), 431017198 (ASAZUKI), 431176000 (ECHIGO) — sources as listed in Q1
- Observed JCG-attributed MMSIs (432xxxxxx): 432307000 (DAISEN), 432446000 (ISEHAMA, ownership uncertain), 432674000 (ISHIGAKI), 432833000 (HAKUREI) — sources as listed in Q1
- No source (official or aggregator) explicitly states or documents a reserved digit pattern for JCG within 431/432 — this absence was consistent across all queries run (direct MMSI-pattern searches, 総務省 searches, and general "MMSI 431 Japan Coast Guard" searches)

### Inferences
- The mix of "clean" round-number MMSIs (e.g., 431176000, 432307000, 432674000, 432446000, 432833000 — all ending in 000, suggesting an earlier-era/batch assignment style) alongside non-round MMSIs (e.g., 431001410, 431004594, 431005989, 431008353, 431008718, 431017198) may reflect different licensing eras or ship-station registration batches rather than a vessel-category-based numbering scheme — but this is speculative and not confirmed by any source.

### Gaps
- Could not test this question against a larger, systematically compiled MMSI list (e.g., all ~67–100 JCG vessels) because the one aggregator fleet-list page found (MagicPort) was paywalled/empty of vessel rows in this fetch.
- No access to any Japanese enthusiast/tracking site (e.g., ship-watching forums) that might catalog JCG AIS data systematically was reviewed in this pass — this was listed as a suggested source but not pursued within the tool-call budget.

## Q4: Does JCG reliably broadcast AIS, or is it known to disable AIS during sensitive operations (e.g., near Senkaku)?

### Takeaway
Reporting (traced to Kyodo News / The Japan Times via multiple re-publishing outlets, circa May 2023) indicates JCG patrol vessels deliberately do **not** operate AIS around the Senkaku Islands to keep operations confidential, reserving AIS use for situations like congested sea lanes or rescue operations — this is a reasonably well-sourced claim, though the primary reporting is from 2023 and current (2026) practice was not independently confirmed.

### Cited Findings
- "Japan Coast Guard patrol vessels do not use the technology [AIS] around the disputed islands to keep their operations confidential. The Japan Coast Guard says it limits its own use of the technology to situations such as congested sea routes and marine rescue operations." — reported via Kyodo/Japan Times, relayed by [Japan Today](https://japantoday.com/category/national/china-vessels-near-disputed-japan-islands-sending-location-data) and other outlets (May 2023 timeframe)
- By contrast, China Coast Guard vessels reportedly began activating AIS in the territorial sea and contiguous zone around the Senkakus starting March 2023, after having stopped broadcasting AIS in 2018 when the China Coast Guard came under People's Armed Police command — [Japan Today](https://japantoday.com/category/national/china-vessels-near-disputed-japan-islands-sending-location-data), [Maritime Executive](https://maritime-executive.com/article/japanese-and-chinese-coast-guard-face-off-in-disputed-island-chain)
- 中文補充（來源：udn.com，2025年底報導）：2025年12月尖閣（釣魚台）周邊海域曾出現「幽靈」貨船 AIS 訊號，日方海保相關人士表示該船實際上並不存在，MarineTraffic 判定為 AIS 偽造（spoofing）訊號 — [udn.com](https://udn.com/news/story/124658/9230420)（此為偽造信號事件，與 JCG 船舶本身是否發送 AIS 無直接關聯，但顯示該海域 AIS 資料品質需謹慎對待）

### Inferences
- Given this documented practice, any MMSI-based tracking of JCG vessels via MarineTraffic/VesselFinder near the Senkakus specifically may show gaps or absence of position reports for JCG vessels during active patrol operations there, even though the vessels' MMSIs are assigned and in principle could be tracked elsewhere (e.g., in home port or during transit).

### Gaps
- Could not confirm current (2026) status of this policy — most sourcing traces to 2023 reporting; no 2025/2026-dated primary source on JCG's own AIS usage policy was found (the 2025-12 udn.com item concerns a spoofed signal, not JCG's own broadcast behavior).
- Did not locate the original Japan Times article directly (only secondary outlets citing it), so the claim rests on secondary sourcing rather than the primary article.
