# AMTI (CSIS Asia Maritime Transparency Initiative) Primary Sources — Vessel Name ↔ MMSI

## Does amti.csis.org host an interactive map/database where clicking a vessel reveals MMSI?

### Takeaway
No. AMTI's maps section (`amti.csis.org/maps/`) only lists static thematic maps (arbitration outcomes, energy exploration, maritime power projection network, maritime claims, SCS features) and an "Island Tracker" site section — none are a searchable vessel database, and none expose MMSI, hull numbers, or an underlying JSON/API endpoint in the page's own links.

### Cited Findings
- `amti.csis.org/maps/` lists five static maps (Philippines v. China arbitration outcomes; South China Sea energy exploration; China's Maritime Power Projection Network; Maritime Claims of the Indo-Pacific; South China Sea Features) and a separate "Island Tracker" section; no vessel-level tool, no API/JSON link, no mention of MMSI or CCG/militia tracking on this page — [amti.csis.org/maps/](https://amti.csis.org/maps/)
- The "Behind the Curtain" feature page's raw HTML (fetched directly, 599 lines rendered / 66KB raw) contains zero `<table>` elements, no iframe, no Tableau embed, no CSV/Google Sheets link, and no `wp-json` data route beyond the generic oEmbed endpoint — the promised "full table... can be viewed at the bottom of this feature" is **not present in the page as served** to an automated fetch (confirmed via both WebFetch and a direct `curl` of the raw HTML) — [amti.csis.org/behind-the-curtain-an-update-on-hainans-maritime-militia/](https://amti.csis.org/behind-the-curtain-an-update-on-hainans-maritime-militia/)

### Inferences
- The missing Hainan table most likely renders via a client-side JS table plugin (e.g., lazy-loaded shortcode) that isn't present in the static-fetched DOM, or it requires a logged-in/paywalled state, or it was removed/moved after publication. This could not be confirmed either way with the tools available.

### Gaps
- Could not execute JavaScript to see if the Hainan militia table renders dynamically in a real browser. This needs a browser-automation tool (e.g., Playwright) to confirm whether the 152-vessel table (with MMSI + ID-confidence level) actually exists client-side. **This is a hard limitation of this research pass — flagging explicitly rather than guessing** whether the table exists but is JS-rendered, or is simply absent from the live page.

---

## Has AMTI published PDF reports (e.g. "A Constant Presence" CCG series, or militia reports) with a vessel-name/MMSI/IMO appendix?

### Takeaway
Yes for **maritime militia** vessels: the 2021 CSIS/C4ADS report "Pulling Back the Curtain on China's Maritime Militia" contains detailed Appendix A/B tables mapping specific fishing-militia vessel names + hull numbers to MMSI and ownership. No equivalent MMSI appendix was found for AMTI's China Coast Guard "A Constant Presence" / "Control by Patrol" / "Flooding the Zone" patrol-tracking report series — those appear to report aggregate patrol-day statistics derived from AIS, not a public vessel-by-vessel MMSI list.

### Cited Findings
- "Pulling Back the Curtain on China's Maritime Militia" (CSIS/AMTI + C4ADS, Nov 2021) full PDF, hosted at C4ADS, contains **Appendix A: Identified Maritime Militia Vessels, Owners, and Ultimate Beneficial Owners** and (per the AMTI landing page) an Appendix B of "likely militia" vessels — [PDF](https://c4ads.org/wp-content/uploads/2021/11/PullingBacktheCurtain-Report.pdf), landing page [amti.csis.org/pulling-back-the-curtain-on-chinas-maritime-militia/](https://amti.csis.org/pulling-back-the-curtain-on-chinas-maritime-militia/)
- The PDF's Appendix A table columns are: `VESSEL NAME | CITY OF REGISTRATION | MMSI | DIRECT OWNER | ULTIMATE BENEFICIAL OWNER`. Representative extracted rows (vessel name / hull no. — city — MMSI):
  - Bin Hai (滨海) 285 — MMSI 412300330 — direct owner China Oilfield Services Limited, UBO SASAC
  - Gui Bei Yu (桂北渔) 39198 — Beihai, Guangxi — MMSI 412501101
  - Gui Bei Yu (桂北渔) 80699 — Beihai, Guangxi — MMSI 412500677
  - Qiong Lin Yu (琼临渔) 01456 — Lingao, Hainan — MMSI 412524861
  - Qiong Lin Yu (琼临渔) 11587 — Lingao, Hainan — MMSI 412520361
  - Qiong Lin Yu (琼临渔) 60017/60018/60019/60020 — Lingao, Hainan — MMSI 412524858 / 412520251 / 412520252 / 412524877
  - Qiong Sansha Yu (琼三沙渔) 00101 — Sansha, Hainan — MMSI 412520152
  - Qiong Sansha Yu (琼三沙渔) 00111 — Sansha, Hainan — MMSI 412520163 (owner Sansha Fisheries Development Co. Ltd., UBO Sansha City Finance Office)
  - Qiong Sansha Yu (琼三沙渔) 00114 — Sansha, Hainan — MMSI 412520166
  - Qiong Sansha Yu (琼三沙渔) 00301 — Sansha, Hainan — MMSI 212520221 (note: leading digit "2" not "4" as printed — likely an OCR/typo artifact in the source PDF, flagging rather than correcting)
  - Qiong Sansha Yu (琼三沙渔) 00312 / 00315 — Sansha, Hainan — MMSI 412520233 / 412520194
  - Qiong Sanya Yu (琼三亚渔) 72108 — Sanya, Hainan — MMSI 412168668
  - Qiong Sanya Yu (琼三亚渔) 72113 — Sanya, Hainan — MMSI 412524557
  - Qiong Sanya Yu (琼三亚渔) 72118/72122/72125/72126/72127/72130/72131/72132/72135/72136/72137/72199 — Sanya, Hainan — MMSI 412523272 / 412523671 / 412721269 / 412523256 / 412524461 / 412524449 / 412524443 / 412524436 / 412524433 / 412523613 / 412520344 / 412520903
  - Yue Jiang Cheng Yu (粤江城渔) 60666 — Yangjiang, Guangdong — MMSI 412474386
  - Yue Lei Yu (粤雷渔) 07888/08888/09999/12066/77777/88888/99999 — Leizhou, Guangdong — MMSI 412473656 / 412472879 / 412472878 / 412472809 / 412473002 / 412473003 / 412473004
  - Yue Lian Yu (粤廉渔) 11113/11688/11999/12333/21666/22266/22288/22888/24666/24999/28128 — Lianjiang, Guangdong — MMSI 412472872 / 412390125 / 412463949 / 412464002 / 412470814 / 412464018 / 412464003 / 412473147 / 412463728 / 412463726 / 412464445
  - **Yue Mao Bin Yu (粤茂滨渔) 42812 / 42881 / 42882 / 42883 / 42885 / 42886** — Maoming, Guangdong — MMSI 412474531 / 412472796 / 412472795 / 412472794 / 412472793 / 412472792 — all owned by Maoming Desheng Fisheries Company Ltd., UBO Ling Lianwei (这些艇後來出現在 Whitsun Reef 事件中，見下方交叉引用)
  - Yue Shan Cheng Yu (粤汕城渔) 16117/16118/20341/20346/20361 — Shanwei, Guangdong — MMSI 412472657 / 412474783 / 412488833 / 412483535 / 412485279
  - Table 5 (Taishan-based Yue Tai Yu fleet, p.31, "adapted from Appendices A and B" — 26 vessels, direct owner/UBO data for each): Yue Tai Yu 11098=412463494; 11981=412471002; 23688=412472931; 61188=412463149; 61868=412461574; 62338=412463354; 11028=412461607; 11302=412470993; 11266=412472887; 12588=412472784; 12589=412472785; 12898=412464567; 18168=412474203; 18000=412472778; 18111=412472779; 18222=412472781; 18333=412472782; 18555=412472783; 18666=412472884; 18777=412472885; 18888=412472883; 18999=412472882; 61166=412463291; 61999=412463147; 62098=412464942; 63888=412463784 — [PDF](https://c4ads.org/wp-content/uploads/2021/11/PullingBacktheCurtain-Report.pdf) (Table 5, p.31; Appendix A, pp.49–53)
  - All of the above MMSIs have the Chinese MSI prefix 412 or 413 (412xxxxxx dominant for Guangdong/Hainan-flagged civilian/militia fishing vessels, distinct from the China Coast Guard's apparent 413875xxx sub-block noted in prior research — no overlap observed)
  - "Caught on Camera: Two Dozen Militia Boats at Whitsun Reef Identified" (AMTI, 2021) independently names several of the same Yue Mao Bin Yu hull numbers (42881, 42882, 42883, 42885, 42886) present at Whitsun Reef in March 2021, but this article itself gives **no MMSI**, only bow/hull numbers — cross-referencing it against Appendix A above is what yields the MMSI for those hulls — [amti.csis.org/caught-on-camera-two-dozen-militia-boats-at-whitsun-reef-identified/](https://amti.csis.org/caught-on-camera-two-dozen-militia-boats-at-whitsun-reef-identified/)
- The PDF itself is marked with an `/Encrypt` dictionary (owner-password/permissions-restricted); it had to be decrypted with `qpdf --decrypt` before `pdftotext` could extract the appendix tables — noting this as a technical access note, not a content finding.
- "Behind the Curtain: An Update on Hainan's Maritime Militia" (AMTI, Dec 2024) states it expanded the known/suspected Hainan militia list from 69 (in the 2021 report) to 152 vessels, with a promised table of "vessel names, MMSI numbers, and identification level," sourced from four years of Starboard Maritime Intelligence AIS data on vessels with "Qiong" (琼) name prefixes — but as noted above, **the table itself was not present in the fetched page content** — [amti.csis.org/behind-the-curtain-an-update-on-hainans-maritime-militia/](https://amti.csis.org/behind-the-curtain-an-update-on-hainans-maritime-militia/)
- No "A Constant Presence" PDF title was found. AMTI's actual CCG patrol-tracking report series is titled differently year to year: "Flooding the Zone: China Coast Guard Patrols in 2022," "Control by Patrol: The China Coast Guard in 2023," "China Coast Guard Patrols in 2024: An Exercise in Futility" — searches for these did not surface any vessel-MMSI appendix; they appear to report only aggregate patrol-day/vessel-day counts per feature (Scarborough Shoal, Second Thomas Shoal, etc.), explicitly caveated as minimum estimates due to incomplete AIS coverage — [amti.csis.org/flooding-the-zone-china-coast-guard-patrols-in-2022/](https://amti.csis.org/flooding-the-zone-china-coast-guard-patrols-in-2022/), [amti.csis.org/control-by-patrol-the-china-coast-guard-in-2023/](https://amti.csis.org/control-by-patrol-the-china-coast-guard-in-2023/), [amti.csis.org/china-coast-guard-patrols-in-2024-an-exercise-in-futility/](https://amti.csis.org/china-coast-guard-patrols-in-2024-an-exercise-in-futility/)
- "Seeking Clues in the Case of the Yuemaobinyu 42212" (AMTI case study) gives a specific vessel-MMSI pair and documents MMSI reuse as a known identification hazard: **Yuedianyu 42212** (earlier name) and **Yueyangxi 82189** both transmitted under **MMSI 412463659** (per Fleetmon), with overlapping active periods — AMTI treats this as a methodological risk (same MMSI reused across different physical hulls/names over time), not proof of identity — [amti.csis.org/seeking-clues-in-the-case-of-the-yuemaobinyu-42212/](https://amti.csis.org/seeking-clues-in-the-case-of-the-yuemaobinyu-42212/)
- That same article states the general rule: Chinese-flagged MMSIs begin with 412, 413, or 414 (consistent with the user's prior finding that CCG MMSIs cluster at 413875xxx and one outlier at 412371217 for CCG1106).

### Inferences
- AMTI's methodology splits cleanly into two tracks: (1) **maritime militia** (civilian fishing-fleet) vessels, for which AMTI/C4ADS has published granular vessel-name + MMSI + ownership data (Appendix A/B of the 2021 report, and presumably the unretrieved 152-vessel Hainan table); and (2) **China Coast Guard cutters**, for which AMTI's own public-facing reports only publish aggregate patrol statistics, not a vessel-by-vessel MMSI roster. This suggests that for the user's specific CCG hull-number-to-MMSI targets (CCG2901, CCG3102, etc.), AMTI's public materials are **not** the primary source — those CCG MMSI pairs likely originate from AMTI's underlying AIS data work being cited/relayed by secondary trackers (e.g., Twitter/X OSINT accounts, MarineTraffic/Starboard outputs) rather than from an AMTI-published CCG appendix.
- None of the militia MMSIs recovered here (all 412xxxxxx/413xxxxxx with various sub-ranges tied to Guangdong/Hainan/Guangxi registration ports) overlap with or corroborate the user's known CCG MMSI set (413875xxx block, plus CCG1106=412371217) — they are a disjoint vessel population (civilian militia fishing boats vs. government cutters), so no direct confirm/conflict signal either way on the specific CCG pairs listed in the assignment.

### Gaps
- Could not confirm or refute the specific CCG pairs in the assignment (CCG2901, CCG3102=413875349, CCG3103, CCG3502, CCG3501, CCG5901 (conflict 413875411 vs 413482360), CCG6103-6105, CCG6306, CCG6501=413875750, CCG13601, CCG2102, CCG2502, CCG3172, CCG1106=412371217) against any AMTI primary document — no AMTI-published CCG-vessel MMSI appendix was located.
- Did not retrieve the full, updated 152-vessel Hainan militia table (names/MMSI/ID-level) referenced in the Dec 2024 "Behind the Curtain" feature — the table is described but not present in the fetched page; may require a JS-capable browser or may no longer be hosted at that URL.
- Did not fully extract Appendix B ("likely militia," ~52 vessels) from the 2021 PDF — only Appendix A's opening section (Bin Hai through part of the Yue Tai/Yue Mao/Yue Shan Cheng entries, roughly the first third alphabetically) and the separate Table 5 (Taishan, 26 vessels) were extracted within this research pass's tool budget. The decrypted PDF text (4,211 lines) is saved locally and contains the rest of Appendix A/B if deeper extraction is wanted later.
- Did not verify whether any CCG vessel ever appears in AMTI's underlying (non-public) AIS dataset with a documented MMSI, since AMTI does not publish that cutter-level data openly.

---

## Does AMTI have a GitHub or other open dataset (CSV/JSON) of tracked vessels with MMSI?

### Takeaway
No CSIS/AMTI-affiliated GitHub repository or open dataset was found. All GitHub search results were unrelated general-purpose AIS tooling projects with no connection to CSIS or AMTI.

### Cited Findings
- A targeted `site:github.com` search for "CSIS AMTI vessel tracking data" returned no CSIS/AMTI-owned repository; results were unrelated AIS tooling (US Coast Guard ocean-planning AIS data repo, Global Fishing Watch anchorage data, generic `AIS_tracker` and `aisutil` projects, a Strait-of-Hormuz tracker) — none affiliated with CSIS or AMTI.

### Inferences
- AMTI's public-facing data distribution model relies on static report PDFs and feature-article text/tables (sometimes not rendering, per above) rather than versioned open datasets. This is consistent with AMTI being a think-tank publication unit rather than a data-engineering project.

### Gaps
- Did not check CSIS's main organizational GitHub presence (if any) beyond this single targeted search; a broader search strategy (e.g., GitHub's own search UI for "amti" or "asia maritime transparency") was not attempted due to tool-call budget, and should be considered a gap rather than a confirmed absence.

---

## Methodology / Access Notes

- Primary sources read directly in this pass: `amti.csis.org/maps/`; `amti.csis.org/behind-the-curtain-an-update-on-hainans-maritime-militia/` (both rendered + raw HTML); `amti.csis.org/pulling-back-the-curtain-on-chinas-maritime-militia/`; the full C4ADS-hosted PDF of that report (decrypted and converted to text locally); `amti.csis.org/seeking-clues-in-the-case-of-the-yuemaobinyu-42212/`; `amti.csis.org/caught-on-camera-two-dozen-militia-boats-at-whitsun-reef-identified/`.
- Explicit limitation: no JavaScript-rendering browser tool was used in this pass, so any AMTI content that depends on client-side rendering (e.g., the Hainan table, or any hidden interactive map layer) could not be confirmed to exist or not exist — flagged above rather than guessed.
