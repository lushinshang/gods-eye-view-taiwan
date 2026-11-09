"""Structural audit for report v1.9.1 (2026-11-09, eleventh same-day update).

Unlike qa/check_task7.py through qa/check_v1.9.py (each pinned to the exact
content of their own version and expected to fail once the version moves
past them), this script re-derives the generic, always-true invariants and
adds the v1.9.1-specific facts this update is supposed to establish.
check_v1.9.py now also only asserts v1.9.0's exact data_version; its
generic checks still hold.

This update makes NO product/code change. It records a governance decision:
the Stop hook kept rejecting GEV-C-003/GEV-C-004 as "incomplete" against
their literal acceptance_criteria, but GEV-C-003's own acceptance_criteria
#3 explicitly says hardening the parent chain must NOT auto-close the
candidate — so no amount of further technical work closes it; the user
was asked and explicitly chose to KEEP that "no auto-close" rule rather
than relax it, for both GEV-C-003 and GEV-C-004. This update records that
decision as a one-line governance note on each finding. confirmation_status
is unchanged (NEEDS_VALIDATION); product_commit is unchanged from v1.9.0
(848a856) since no code changed.
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

# 6) v1.9.1-specific facts this update is supposed to establish
meta = data['metadata']
assert meta['data_version'] == '1.9.1'
assert meta['product_commit'] == '848a856', 'no product code change this update'
assert meta['overall_status'] == 'INCOMPLETE', 'this update must not claim the assessment is complete'
assert meta['release_authorization'] is False, 'this update must not grant release authorization'
assert data['document_control']['report_version'] == '1.9.1'

by_id = {f['id']: f for f in data['findings']}
assert by_id['GEV-F-001']['confirmation_status'] == 'CONFIRMED'
assert by_id['GEV-F-001']['remediation_status'] == 'FIXED'
assert by_id['GEV-F-002']['remediation_status'] == 'FIXED'
assert by_id['GEV-F-003']['remediation_status'] == 'FIXED'
# documenting that further validation is infrastructure-blocked must NOT be
# mistaken for the validation having actually happened
assert by_id['GEV-C-002']['confirmation_status'] == 'NEEDS_VALIDATION'
assert by_id['GEV-C-003']['confirmation_status'] == 'NEEDS_VALIDATION', \
    'documenting the missing-sudo blocker does not confirm C-003 is safe'
assert by_id['GEV-C-004']['confirmation_status'] == 'NEEDS_VALIDATION', \
    'documenting missing API keys does not confirm C-004 is safe'
assert by_id['GEV-C-003']['remediation_status'] == 'PARTIAL_MITIGATION'
assert by_id['GEV-C-004']['remediation_status'] == 'PARTIAL_MITIGATION'
assert all(f['risk_rating']['cvss'] is None and f['risk_rating']['value'] is None
           for f in data['findings'])
assert all(a['owner'] is None and a['due_date'] is None and not a['approved']
           for a in data['remediation_actions'])

obs_by_id = {o['id']: o for o in data['observations']}
assert obs_by_id['OBS-005']['remediation_status'] == 'NOT_APPLICABLE'
c002 = by_id['GEV-C-002']['details']['risk_acceptance']
assert c002 is not None and c002['accepted'] is True
# the environment-capability finding must NOT have been (mis)used to grant
# C-003/C-004 a risk acceptance they were never given
assert by_id['GEV-C-003']['details']['risk_acceptance'] is None
assert by_id['GEV-C-004']['details']['risk_acceptance'] is None

# 7) v1.9.0's own facts (unchanged): both findings cite the environment-capability record
c003 = by_id['GEV-C-003']
c004 = by_id['GEV-C-004']
assert 'EV-ENV-CAPABILITY' in c003['details']['evidence_ids']
assert 'EV-ENV-CAPABILITY' in c004['details']['evidence_ids']
assert 'SRC-062' in c003['source_refs']
assert 'SRC-062' in c004['source_refs']
env_doc = (ROOT / sources['SRC-062']['path']).read_text()
assert 'sudo' in env_doc and 'API' in env_doc

# 8) v1.9.1's own fact: the governance decision is recorded on both findings,
# and neither confirmation_status moved as a result of recording it
c003_limitations = ' '.join(c003['details']['limitations'])
c004_limitations = ' '.join(c004['details']['limitations'])
assert '不自動關閉候選' in c003_limitations
assert '使用者已明確確認' in c003_limitations
assert '治理原則' in c004_limitations
assert by_id['GEV-C-003']['confirmation_status'] == 'NEEDS_VALIDATION'
assert by_id['GEV-C-004']['confirmation_status'] == 'NEEDS_VALIDATION'

result = {
    'check': 'v1.9.1', 'status': 'PASS',
    'sources': len(sources), 'findings': len(data['findings']),
    'observations': len(data['observations']),
    'evidence_excerpts': len(excerpts), 'frozen_historical_excerpts': frozen_count,
    'scope': 'Structural/content consistency only; not browser or visual acceptance.',
}
(HERE / 'qa' / 'check-v1.9.1-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=1))
