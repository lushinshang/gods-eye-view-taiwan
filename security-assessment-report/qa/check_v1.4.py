"""Structural audit for report v1.4.0 (2026-11-09, fifth same-day update).

Unlike qa/check_task7.py, qa/check_v1.1.py, qa/check_v1.2.py and
qa/check_v1.3.py (each pinned to the exact content of their own version —
see the note at check_task7.py's top — and expected to fail once the
version moves past them), this script re-derives the generic, always-true
invariants (every source_ref resolves, every source's hash/size/link match
the live file, every evidence excerpt's text matches its locator) and adds
the v1.4.0-specific facts this update is supposed to establish.
check_v1.3.py now also only asserts v1.3.0's exact metadata
(data_version/product_commit); its generic checks still hold.

This update makes NO product code change — it only records a risk
acceptance decision for GEV-C-002. product_commit is therefore unchanged
from v1.3.0 (7ae38a7); only data_version/report_version move.

Deliberately NOT cross-checked here: security-assessment/execution/
snapshot.json. That file is a frozen hash record of the files as they stood
for v1.0.0; source-index.json instead reflects each file's live state as of
whichever later commit last changed it. No source file changed for this
update, so source-index.json is untouched from v1.3.0.

UPDATE (v1.5.0, same day): section 6's exact-metadata assertions
(data_version==1.4.0, product_commit==7ae38a7) are now PINNED TO v1.4.0 and
EXPECTED TO FAIL from v1.5.0 onward. Sections 1-5 are still generic and
should still pass. See qa/check_v1.5.py for the current version's audit.
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

# 1) every source_ref anywhere in report-data.json resolves
refs = []


def walk(value, key=''):
    if isinstance(value, dict):
        for k, v in value.items():
            if k == 'source_ref' and v is not None:
                refs.append(v)
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

# 6) v1.4.0-specific facts this update is supposed to establish
meta = data['metadata']
assert meta['data_version'] == '1.4.0'
assert meta['product_commit'] == '7ae38a7', 'no product code change this update — commit unchanged from v1.3.0'
assert meta['overall_status'] == 'INCOMPLETE', 'this update must not claim the assessment is complete'
assert meta['release_authorization'] is False, 'this update must not grant release authorization'
assert data['document_control']['report_version'] == '1.4.0'

by_id = {f['id']: f for f in data['findings']}
assert by_id['GEV-F-001']['confirmation_status'] == 'CONFIRMED'
assert by_id['GEV-F-001']['remediation_status'] == 'FIXED'
assert by_id['GEV-F-002']['remediation_status'] == 'FIXED'
assert by_id['GEV-F-003']['remediation_status'] == 'FIXED'
# C-002/C-003/C-004 stay NEEDS_VALIDATION technically — risk acceptance is a
# business decision, not a technical confirmation that the finding is false
assert by_id['GEV-C-002']['confirmation_status'] == 'NEEDS_VALIDATION', \
    'accepting the risk does not change whether the finding is technically confirmed'
assert by_id['GEV-C-003']['confirmation_status'] == 'NEEDS_VALIDATION'
assert by_id['GEV-C-004']['confirmation_status'] == 'NEEDS_VALIDATION'
# no finding carries a CVSS/severity this update did not establish
assert all(f['risk_rating']['cvss'] is None and f['risk_rating']['value'] is None
           for f in data['findings'])
# remediation actions still have no named owner/date/approval — this update
# did not grant anyone authority to accept risk for a FINDING or approve a release
assert all(a['owner'] is None and a['due_date'] is None and not a['approved']
           for a in data['remediation_actions'])

coverage_row07 = next(r for r in data['coverage_matrix']['rows'] if r['scenario_id'] == 'GEV-07')
assert coverage_row07['cells']['source'] == 'fixed'
assert coverage_row07['cells']['synthetic'] == 'fixed'
assert any(l['id'] == 'fixed' for l in data['coverage_matrix']['legend'])

# 7) v1.2.0's two observations still hold (this update didn't touch them)
obs_by_id = {o['id']: o for o in data['observations']}
assert obs_by_id['OBS-003']['remediation_status'] == 'IMPLEMENTED'
assert obs_by_id['OBS-004']['remediation_status'] == 'FIXED'

# 8) v1.3.0's C-004 positive/negative control evidence still holds
assert 'SRC-058' in by_id['GEV-C-004']['source_refs']

# 9) v1.4.0's own fact: GEV-C-002 carries a recorded, specific risk acceptance
c002 = by_id['GEV-C-002']['details']['risk_acceptance']
assert c002 is not None, 'GEV-C-002 must carry a recorded risk acceptance'
assert c002['accepted'] is True
assert c002['accepted_by'] == '開發/維護者'
assert c002['accepted_date'] == '2026-11-09'
assert c002['rationale'], 'risk acceptance must state why'
assert c002['residual_risk'], 'risk acceptance must state what would invalidate it'
# the other two candidate risks must NOT have been silently accepted too
assert by_id['GEV-C-003']['details']['risk_acceptance'] is None
assert by_id['GEV-C-004']['details']['risk_acceptance'] is None

result = {
    'check': 'v1.4.0', 'status': 'PASS',
    'sources': len(sources), 'findings': len(data['findings']),
    'observations': len(data['observations']),
    'evidence_excerpts': len(excerpts), 'frozen_historical_excerpts': frozen_count,
    'scope': 'Structural/content consistency only; not browser or visual acceptance.',
}
(HERE / 'qa' / 'check-v1.4-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=1))
