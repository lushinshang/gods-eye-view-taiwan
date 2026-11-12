/**
 * @module vesselMmsiWatchlist
 * @description MMSI-keyed exact-match lookup for a small, independently
 * cross-verified subset of China Coast Guard cutters and Chinese government
 * research vessels. Every entry here was confirmed against at least 2
 * independent public AIS aggregator domains (not merely 2 pages on the same
 * site) during the research behind `reports/海警科考海保船 MMSI 核實清單.md`
 * (see `research_notes/海警科考海保船 MMSI 核實清單/` for the raw notes).
 *
 * This table deliberately does NOT attempt full coverage:
 * - China Coast Guard: only 9 of 27 investigated hull numbers cleared the
 *   2-independent-source bar; the rest were either contradicted by
 *   different sources (e.g. CCG5901 has at least two conflicting MMSIs
 *   across sources and is intentionally excluded) or not found at all.
 * - China research vessels: 34 of 35 investigated names cleared the bar;
 *   "南鋒" (NAN FENG) is excluded — no public record could be found for it.
 * - Japan Coast Guard is entirely absent from this table on purpose: no
 *   credible MMSI pattern was found for JCG vessels (the only MMSI block
 *   that looked plausible, 431999xxx, turned out to belong to Japan
 *   Maritime Self-Defense Force warships, not JCG patrol vessels), and JCG
 *   vessels are believed to broadcast AIS only intermittently in practice.
 *   JCG classification continues to rely solely on the name-text matching
 *   in `vesselAgencyClassification.js`.
 *
 * An earlier externally-supplied file (`data/watchlist_vessels.json`,
 * outside this repo) claimed MMSI mappings for 79 vessels across these same
 * three categories. Independent verification found 0 of 79 entries
 * confirmed — most conflicted with independent sources, and the Japan Coast
 * Guard entries were all found to actually belong to JMSDF warships. That
 * file was deleted; none of its numbers are reused here. See
 * `DATA_SOURCES.md` for the full account.
 */

/** @typedef {'china-coast-guard'|'china-research'} MmsiVerifiedCategory */

/**
 * MMSI (string) -> verified category. Only MMSIs confirmed against ≥2
 * independent source domains are present.
 * @type {Map<string, MmsiVerifiedCategory>}
 */
export const VERIFIED_VESSEL_MMSI = new Map([
  // China Coast Guard (9 confirmed of 27 investigated hull numbers)
  ['413875052', 'china-coast-guard'], // CHINACOASTGUARD2102
  ['413875039', 'china-coast-guard'], // CHINACOASTGUARD2501
  ['413875040', 'china-coast-guard'], // CHINACOASTGUARD2502
  ['413875041', 'china-coast-guard'], // CHINACOASTGUARD2901
  ['413875340', 'china-coast-guard'], // CHINACOASTGUARD3501
  ['413875341', 'china-coast-guard'], // CHINACOASTGUARD3502
  ['413875764', 'china-coast-guard'], // CHINACOASTGUARD6104
  ['413875765', 'china-coast-guard'], // CHINACOASTGUARD6105
  ['413875350', 'china-coast-guard'], // CHINACOASTGUARD3103

  // Chinese government/academic research vessels (34 confirmed of 35
  // investigated names; "南鋒"/NAN FENG excluded — no public record found)
  ['413330890', 'china-research'], // 向陽紅01 / XIANG YANG HONG 01
  ['413701510', 'china-research'], // 向陽紅03 / XIANG YANG HONG 03
  ['413320530', 'china-research'], // 向陽紅06 / XIANG YANG HONG 06
  ['412917000', 'china-research'], // 向陽紅09 / XIANG YANG HONG 09
  ['413452850', 'china-research'], // 向陽紅10 / XIANG YANG HONG 10
  ['413330290', 'china-research'], // 向陽紅18 / XIANGYANGHONG 18
  ['413376370', 'china-research'], // 向陽紅19 / XIANG YANG HONG 19
  ['413218280', 'china-research'], // 向陽紅22 / XIANGYANGHONG22
  ['412018330', 'china-research'], // 雪龍 / XUE LONG
  ['413381260', 'china-research'], // 雪龍2 / XUE LONG 2
  ['412330910', 'china-research'], // 科學號 / KE XUE
  ['413523770', 'china-research'], // 探索一號 / TAN SUO YI HAO
  ['413229620', 'china-research'], // 探索二號 / TAN SUO ER HAO
  ['413595860', 'china-research'], // 探索三號 / TAN SUO SAN HAO
  ['413542000', 'china-research'], // 實驗1 / SHI YAN 1
  ['413255690', 'china-research'], // 實驗6 / SHI YAN 6
  ['412461610', 'china-research'], // 海洋地質四號 / HAIYANG DIZHI 4 HAO
  ['412360000', 'china-research'], // 海洋地質六號 / HAIYANG DIZHI LIUHAO
  ['413491890', 'china-research'], // 海洋地質八號 / HAIYANGDIZHI BAHAO
  ['413331770', 'china-research'], // 海洋地質九號 / HAIYANGDIZHIJIUHAO
  ['413491880', 'china-research'], // 海洋地質十號 / HAIYANG DIZHI SHIHAO
  ['412461570', 'china-research'], // 海洋地質十二號 / HAIYANG DIZHI 12 HAO
  ['414914000', 'china-research'], // 夢想號 / MENG XIANG
  ['413263240', 'china-research'], // 中山大學號 / ZHONG SHAN DA XUE
  ['413332930', 'china-research'], // 東方紅3號 / DONG FANG HONG 3
  ['413702290', 'china-research'], // 嘉庚號 / JIA GENG
  ['412371227', 'china-research'], // 淞航號 / SONG HANG
  ['412962000', 'china-research'], // 遠望3號 / YUAN WANG 3
  ['413289000', 'china-research'], // 遠望5號 / YUAN WANG 5
  ['413326000', 'china-research'], // 遠望6號 / YUAN WANG 6
  ['413379290', 'china-research'], // 遠望7號 / YUAN WANG 7
  ['412336829', 'china-research'], // 藍海101 / LAN HAI 101
  ['412371228', 'china-research'], // 藍海201 / LAN HAI 201
  ['413212230', 'china-research'], // 大洋號 / DA YANG HAO
]);

/**
 * Look up a vessel's verified category by exact MMSI match.
 * @param {string|number|null|undefined} mmsi
 * @returns {MmsiVerifiedCategory|null}
 */
export function lookupVerifiedMmsi(mmsi) {
  const key = String(mmsi ?? '').trim();
  if (!key) return null;
  return VERIFIED_VESSEL_MMSI.get(key) || null;
}
