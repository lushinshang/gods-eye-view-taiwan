"""Structural audit for report v2.0.0 (2026-11-10, OWASP/CVSS framework alignment).

Unlike qa/check_task7.py through qa/check_v1.9.1.py (each pinned to the
exact content of their own version and expected to fail once the version
moves past them), this script re-derives the generic, always-true
invariants and adds the v2.0.0-specific facts this update is supposed to
establish. check_v1.9.1.py now also only asserts v1.9.1's exact
data_version; its generic checks still hold.

This update adds, for every finding: owasp_mapping (OWASP Top 10:2021 /
OWASP Top 10 for LLM Applications 2026 / CWE classification) and
plain_language (a non-technical summary ending in a concrete recommended
action); and for GEV-C-002/003/004: retest_recommendation (conditional,
no fixed date). GEV-F-002 is the ONLY finding that now carries a non-null
cvss — it adopts the official GHSA-8g5g-mxqh-grgj / CVE-2026-118662 CVSS
v4.0 score (6.9) verbatim from qa/ghsa-8g5g-mxqh-grgj-2026-11-09.json (a
raw, unmodified API response), not a self-assigned score. GEV-F-001 and
GEV-F-003 still carry cvss: null — CVSS does not apply to F-003 (no C/I/A
impact per the report's own prior analysis) and F-001's blocker
(unconfirmed exposure/business-impact context) is unrelated to whether the
defect is fixed. GEV-C-002/003/004 still carry cvss: null; this update
does not change any finding's confirmation_status or risk_acceptance.
No product code changed; product_commit is unchanged from v1.9.1 (848a856).
"""
from pathlib import Path
import hashlib
import importlib.util
import json
import re

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[1]  # tools/
spec = importlib.util.spec_from_file_location('report_builder', HERE / 'build_report.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

data = json.loads((HERE / 'report-data.json').read_text())
index = json.loads((HERE / 'source-index.json').read_text())
sources = {s['id']: s for s in index['sources']}
assert len(sources) == len(index['sources']), 'duplicate source id'

# 1) every source_ref anywhere in report-data.json resolves. owasp_mapping is
# a list of dicts (framework/id/title/role), not a list of source ids, so it
# must NOT be swept by the generic "*refs" walk below — guard that first.
for f in data['findings']:
    assert 'owasp_mapping' not in f or all(isinstance(m, dict) for m in f['owasp_mapping']), \
        'owasp_mapping must be dicts, not source-id strings (would corrupt the generic refs walk)'

refs = []


def walk(value, key=''):
    if isinstance(value, dict):
        for k, v in value.items():
            if k == 'source_ref' and v is not None:
                refs.append(v)
            elif k == 'owasp_mapping':
                continue  # dicts, not source ids — see guard above
            else:
                walk(v, k)
    elif isinstance(value, list):
        if key.endswith('refs'):
            refs.extend(value)
        else:
            for v in value:
                walk(v)


walk(data)
unknown = sorted(set(r for r in refs if r not in sources))
assert not unknown, f'Unknown source reference(s): {unknown}'

# 2) every source's hash/size/href match the live file (re-derived, not trusted)
for sid, s in sources.items():
    assert re.fullmatch(r'SRC-\d{3}', s['id']), f'bad id {sid}'
    file = ROOT / s['path']
    raw = file.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == s['sha256'], f'Source changed: {sid}'
    assert len(raw) == s['size_bytes'], f'Size changed: {sid}'
    assert (HERE / s['href']).resolve() == file.resolve(), f'Link changed: {sid}'
    if s.get('locator') and s['locator'].get('anchor_text'):
        loc = s['locator']
        assert loc['anchor_text'] in raw.decode().splitlines()[loc['start'] - 1], sid

# 3) every evidence excerpt's text matches its locator in the live source
excerpts = {e['id']: e for e in data['evidence_excerpts']}
assert len(excerpts) == len(data['evidence_excerpts']), 'duplicate evidence id'
frozen_count = 0
for eid, e in excerpts.items():
    if e.get('frozen_historical'):
        assert e.get('frozen_as_of_commit'), f'{eid} missing frozen_as_of_commit'
        frozen_count += 1
        continue
    src = sources[e['source_ref']]
    raw = (ROOT / src['path']).read_text()
    loc = e['locator']
    if loc['kind'] == 'lines' and 'text' in e:
        actual = '\n'.join(raw.splitlines()[loc['start'] - 1:loc['end']])
        assert actual == e['text'], f'Excerpt text drifted: {eid}'

# 4) the 15 original scenario identities are untouched (id/title only — not status text)
original = []
for line in (ROOT / 'security-assessment/test-matrix.md').read_text().splitlines():
    match = re.match(r'\| (GEV-\d{2}) (.*?) \| RQ\d+ \|', line)
    if match:
        original.append(match.groups())
assert len(original) == 15
assert original == [(s['id'], s['title']) for s in data['scenarios']]
assert original == [(s['scenario_id'], s['title']) for s in data['coverage_matrix']['rows']]
assert all(s['whole_scenario_pass'] is False for s in data['scenarios']), \
    'no scenario may claim a full pass'

# 5) proof levels used anywhere are all defined
proof_codes = {p['code'] for p in data['proof_level_definitions']}
for s in data['scenarios']:
    assert set(s['proof_levels']) <= proof_codes, s['id']
for f in data['findings']:
    assert set(f['proof_levels']) <= proof_codes, f['id']

# 6) v2.0.0-specific facts this update is supposed to establish
meta = data['metadata']
assert meta['data_version'] == '2.0.0'
assert meta['product_commit'] == '848a856', 'no product code change this update'
assert meta['overall_status'] == 'INCOMPLETE', 'this update must not claim the assessment is complete'
assert meta['release_authorization'] is False, 'this update must not grant release authorization'
assert data['document_control']['report_version'] == '2.0.0'

by_id = {f['id']: f for f in data['findings']}
assert by_id['GEV-F-001']['confirmation_status'] == 'CONFIRMED'
assert by_id['GEV-F-001']['remediation_status'] == 'FIXED'
assert by_id['GEV-F-002']['remediation_status'] == 'FIXED'
assert by_id['GEV-F-003']['remediation_status'] == 'FIXED'
assert by_id['GEV-C-002']['confirmation_status'] == 'NEEDS_VALIDATION'
assert by_id['GEV-C-003']['confirmation_status'] == 'NEEDS_VALIDATION'
assert by_id['GEV-C-004']['confirmation_status'] == 'NEEDS_VALIDATION'
assert by_id['GEV-C-003']['remediation_status'] == 'PARTIAL_MITIGATION'
assert by_id['GEV-C-004']['remediation_status'] == 'PARTIAL_MITIGATION'
c002 = by_id['GEV-C-002']['details']['risk_acceptance']
assert c002 is not None and c002['accepted'] is True
assert by_id['GEV-C-003']['details']['risk_acceptance'] is None
assert by_id['GEV-C-004']['details']['risk_acceptance'] is None

# 7) the CVSS invariant changed in this version: null for everyone EXCEPT
# GEV-F-002, which must carry the exact official score/vector, re-derived
# from the raw advisory JSON on disk (not trusted from report-data.json alone)
for fid in ('GEV-F-001', 'GEV-F-003', 'GEV-C-002', 'GEV-C-003', 'GEV-C-004'):
    assert by_id[fid]['risk_rating']['cvss'] is None, f'{fid} must not carry a CVSS score'
f002_cvss = by_id['GEV-F-002']['risk_rating']['cvss']
assert isinstance(f002_cvss, dict), 'GEV-F-002 must carry a structured CVSS object'
assert f002_cvss['score'] == 6.9
assert f002_cvss['version'] == '4.0'
assert f002_cvss['source_ref'] == 'SRC-063'
ghsa_raw = json.loads((ROOT / sources['SRC-063']['path']).read_text())
assert ghsa_raw['cve_id'] == 'CVE-2026-118662'
assert ghsa_raw['cvss_severities']['cvss_v4']['score'] == 6.9
assert f002_cvss['vector'] == ghsa_raw['cvss_severities']['cvss_v4']['vector_string'], \
    "the cited vector must match what the raw advisory JSON actually says today"

# 8) every finding has an owasp_mapping and a plain_language field
for fid, f in by_id.items():
    assert f.get('owasp_mapping'), f'{fid} missing owasp_mapping'
    for m in f['owasp_mapping']:
        assert m['framework'] and m['id'] and m['title'] and m['role'], f'{fid} owasp_mapping entry incomplete'
    assert f.get('plain_language'), f'{fid} missing plain_language'
    assert len(f['plain_language']) > 20, f'{fid} plain_language looks too short to be substantive'

# 9) the three candidates each carry a retest_recommendation; F-001/002/003 (fixed) do not need one
for fid in ('GEV-C-002', 'GEV-C-003', 'GEV-C-004'):
    rt = by_id[fid].get('retest_recommendation')
    assert rt and rt.get('condition') and rt.get('note'), f'{fid} missing retest_recommendation'

# 10) the governance note (no-auto-close) from v1.9.1 is still present and unchanged
c003_limitations = ' '.join(by_id['GEV-C-003']['details']['limitations'])
assert '不自動關閉候選' in c003_limitations

result = {
    'check': 'v2.0.0', 'status': 'PASS',
    'sources': len(sources), 'findings': len(data['findings']),
    'observations': len(data['observations']),
    'evidence_excerpts': len(excerpts), 'frozen_historical_excerpts': frozen_count,
    'scope': 'Structural/content consistency only; not browser or visual acceptance.',
}
(HERE / 'qa' / 'check-v2.0-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=1))
