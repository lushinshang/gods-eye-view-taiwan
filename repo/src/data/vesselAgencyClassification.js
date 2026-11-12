/**
 * @module vesselAgencyClassification
 * @description Best-effort, name-text-based guess at whether a tracked AIS
 * vessel belongs to China Coast Guard, a Chinese government research
 * vessel, or Japan Coast Guard. MMSI number-range heuristics were evaluated
 * and rejected as a classification signal: ITU Rec. M.585-10 defines no
 * government/law-enforcement MMSI structure at all, China Coast Guard
 * sampling clusters in 413875xxx but has documented exceptions (CCG1106 =
 * 412371217) and cross-aggregator conflicts (CCG5901 reported under two
 * different MMSIs), and Chinese research vessels / Japan Coast Guard show
 * no numeric pattern whatsoever. See the research behind this module at
 * `research_notes/MMSI 編碼規範 海警科考海保船/` and
 * `research_notes/MMSI 公開清單深度彙整/` (reports in `reports/`).
 *
 * Vessel *name* text is the more reliable signal actually found in that
 * research: China Coast Guard cutters consistently broadcast an AIS name of
 * "CCG" + hull number (CCG1106, CCG5201, CCG5901, CCG21543); a fixed set of
 * Chinese government research vessel names recurs across sources (Xiang
 * Yang Hong / 向陽紅 series, Xue Long / 雪龍, etc.); and a representative
 * subset of named Japan Coast Guard patrol vessels was found in official and
 * aggregator sources. None of this is an officially confirmed vessel
 * registry — names can be changed or spoofed (a documented case: CCG5201
 * impersonating a fishing boat's callsign) and the research vessel / Japan
 * Coast Guard lists cover only the vessels this session's research happened
 * to find named, not an exhaustive fleet roster. Every match from this
 * module must therefore be presented to the user as a guess, never as a
 * confirmed identity.
 *
 * A later, separate round of research (see `vesselMmsiWatchlist.js`)
 * independently cross-verified a small MMSI-keyed lookup against ≥2
 * independent public AIS aggregator domains for a subset of China Coast
 * Guard and Chinese research vessels. That table is checked first, ahead of
 * the name-text rules below: an exact MMSI match is a stronger signal
 * (MMSI is numeric and the match is exact) than a name-text guess. Japan
 * Coast Guard is intentionally absent from that table — no credible MMSI
 * pattern was found for it (see `DATA_SOURCES.md`) — so JCG classification
 * still relies entirely on the name-text rules in this module.
 */

import { lookupVerifiedMmsi } from './vesselMmsiWatchlist.js';

/** @typedef {'china-coast-guard'|'china-research'|'japan-coast-guard'} VesselAgencyCategory */

const CHINA_COAST_GUARD_NAME_PATTERN = /^CCG\s*\d+$/i;

// Chinese government research vessel names recurring across sources in the
// MMSI research (both Chinese characters and common Latin transliterations).
const CHINA_RESEARCH_VESSEL_NAMES = new Set(
  [
    '向阳红01',
    '向阳红O1',
    '向阳红1',
    '向阳红3',
    '向阳红03',
    '向阳红09',
    '向阳红18',
    'XIANG YANG HONG 01',
    'XIANGYANGHONG01',
    '雪龙',
    '雪龙号',
    '雪龙2',
    '雪龙2号',
    'XUE LONG',
    'XUELONG',
    'XUE LONG 2',
    'XUELONG2',
    '实验1号',
    '实验2号',
    '实验3号',
    'SHI YAN 1',
    'SHI YAN 2',
    'SHI YAN 3',
    'SHIYAN1',
    'SHIYAN2',
    'SHIYAN3',
    '科学',
    '科学号',
    'KE XUE',
    'KEXUE',
    '大洋一号',
    '大洋号',
    'DA YANG YI HAO',
    'DAYANGYIHAO',
    '嘉庚',
    '嘉庚号',
    'JIA GENG',
    'JIAGENG',
    'TAN KAH KEE',
    '东方红3',
    '东方红三号',
    'DONG FANG HONG 3',
    'DONGFANGHONG3',
    '海洋地质8号',
    '海洋地质八号',
    'HAI YANG DI ZHI 8',
    'HAIYANGDIZHI8',
  ].map(normalizeName),
);

// Representative named Japan Coast Guard large patrol vessels found in this
// session's research. Known-incomplete: JCG operates 475 vessels total; this
// covers only the subset whose names surfaced in public sources checked.
const JAPAN_COAST_GUARD_VESSEL_NAMES = new Set(
  [
    'MIZUHO',
    'AKITSUSHIMA',
    'SHIKISHIMA',
    'YASHIMA',
    'ECHIGO',
    'DAISEN',
    'AKITAKA',
    'HATESHIRO',
  ].map(normalizeName),
);

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[　\s]+/g, ' ');
}

/**
 * Guess whether a tracked vessel record is a China Coast Guard cutter,
 * a Chinese government research vessel, or a Japan Coast Guard vessel,
 * based on its AIS name text alone. Returns null when nothing matches —
 * callers must leave the vessel's existing rendering untouched in that case.
 * @param {{name?: string, mmsi?: string|number}} record Normalized vessel record.
 * @returns {{category: VesselAgencyCategory, confidence: 'mmsi-confirmed'|'name-pattern'|'curated-name'}|null}
 */
export function classifyVesselAgency(record) {
  const mmsiMatch = lookupVerifiedMmsi(record?.mmsi);
  if (mmsiMatch) {
    return { category: mmsiMatch, confidence: 'mmsi-confirmed' };
  }

  const rawName = String(record?.name || '').trim();
  if (!rawName) return null;

  if (CHINA_COAST_GUARD_NAME_PATTERN.test(rawName)) {
    return { category: 'china-coast-guard', confidence: 'name-pattern' };
  }

  const normalized = normalizeName(rawName);
  if (CHINA_RESEARCH_VESSEL_NAMES.has(normalized)) {
    return { category: 'china-research', confidence: 'curated-name' };
  }
  if (JAPAN_COAST_GUARD_VESSEL_NAMES.has(normalized)) {
    return { category: 'japan-coast-guard', confidence: 'curated-name' };
  }

  return null;
}
