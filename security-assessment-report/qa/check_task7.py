"""Audit report data against selected retained sources; never import products.

PINNED TO REPORT v1.0.0. This script asserts exact point-in-time facts of
that version (GEV-F-001 still OPEN, metadata.product_commit == e50944f,
source-index hashes matching security-assessment/execution/snapshot.json's
frozen v1.0.0 record) — it is a historical audit, not a regression test, and
is EXPECTED to fail from the 2026-11-09 update (report v1.1.0) onward. See
qa/check_v1.1.py for the equivalent audit against the current version.
"""
from pathlib import Path
from html.parser import HTMLParser
from datetime import datetime
from zoneinfo import ZoneInfo
import copy
import hashlib
import importlib.util
import json
import re

HERE=Path(__file__).resolve().parents[1];ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('report_builder',HERE/'build_report.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
data=json.loads((HERE/'report-data.json').read_text());index=json.loads((HERE/'source-index.json').read_text());sources={s['id']:s for s in index['sources']}
assert len(sources)==len(index['sources'])
refs=[]
def walk(value,key=''):
    if isinstance(value,dict):
        for k,v in value.items():
            if k=='source_ref' and v is not None:refs.append(v)
            else:walk(v,k)
    elif isinstance(value,list):
        if key.endswith('refs'):refs.extend(value)
        else:
            for v in value:walk(v)
walk(data)
assert all(r in sources for r in refs),'Unknown source reference'
for sid,s in sources.items():
    file=ROOT/s['path'];raw=file.read_bytes()
    assert hashlib.sha256(raw).hexdigest()==s['sha256'],f'Source changed: {sid}'
    assert len(raw)==s['size_bytes'],f'Size changed: {sid}'
    assert (HERE/s['href']).resolve()==file.resolve(),f'Link changed: {sid}'
    if s.get('locator'):
        loc=s['locator'];assert loc['anchor_text'] in raw.decode().splitlines()[loc['start']-1],sid
snapshot=json.loads((ROOT/'security-assessment/execution/snapshot.json').read_text())
snap={e['path']:e['sha256'] for e in snapshot['source_files']};product_count=0
for s in sources.values():
    if s['role']=='product_source':
        rel=s['path'].split('/repo/',1)[1];assert snap[rel]==s['sha256'];product_count+=1
original=[]
for line in (ROOT/'security-assessment/test-matrix.md').read_text().splitlines():
    match=re.match(r'\| (GEV-\d{2}) (.*?) \| RQ\d+ \|',line)
    if match:original.append(match.groups())
assert len(original)==15
assert original==[(s['id'],s['title']) for s in data['scenarios']]
assert original==[(s['scenario_id'],s['title']) for s in data['coverage_matrix']['rows']]
assert all(s['whole_scenario_pass'] is False for s in data['scenarios'])
proof={p['code'] for p in data['proof_level_definitions']}
assert all(set(s['proof_levels'])<=proof for s in data['scenarios'])
assert data['findings'][0]['id']=='GEV-F-001' and data['findings'][0]['confirmation_status']=='CONFIRMED' and data['findings'][0]['remediation_status']=='OPEN'
assert all(f['confirmation_status']=='NEEDS_VALIDATION' for f in data['findings'][1:])
assert all(f['risk_rating']['cvss'] is None and f['risk_rating']['value'] is None for f in data['findings'])
assert all(a['owner'] is None and a['due_date'] is None and not a['approved'] for a in data['remediation_actions'])
assert not data['metadata']['release_authorization'] and data['metadata']['overall_status']=='INCOMPLETE'
assert all(s['state']=='DRAFT_CONTENT_COMPLETE' for s in data['sections'])
excerpts={e['id']:e for e in data['evidence_excerpts']}
for e in excerpts.values():
    src=sources[e['source_ref']];assert '/evidence/raw/' not in src['path']
    raw=(ROOT/src['path']).read_text();loc=e['locator']
    if loc['kind']=='lines':assert '\n'.join(raw.splitlines()[loc['start']-1:loc['end']])==e['text'],e['id']
    else:
        value=json.loads(raw)
        for part in loc['pointer'].strip('/').split('/') if loc['pointer'] else []:value=value[int(part)] if isinstance(value,list) else value[part]
        assert {key:value[key] for key in loc['fields']}==e['value'],e['id']
    assert e['render_as']=='plain_text'
for f in data['findings']:
    assert set(f['details']['evidence_ids'])<=set(excerpts)
    assert not f['details']['reproduction']['executed_during_report_preparation']
for o in data['observations']:assert set(o['evidence_ids'])<=set(excerpts)
provenance=json.loads((ROOT/sources['SRC-029']['path']).read_text())
for row in provenance['records']:
    assert hashlib.sha256((ROOT/row['source_path']).read_bytes()).hexdigest()==row['source_sha256']
    assert hashlib.sha256((ROOT/row['derived_path']).read_bytes()).hexdigest()==row['derived_sha256']
assert [p['execution_kind'] for p in data['evidence_provenance']]==['EXECUTED','EXECUTED','INHERITED_OBSERVATION','OFFLINE_REEVALUATION']
browser=json.loads((ROOT/sources['SRC-027']['path']).read_text());assert browser['supervise_result']['observation_status']=='OBSERVED' and browser['supervise_result']['cleanup_status']=='CLEAN'
assert data['evidence_provenance'][1]['browser_status']==browser['diagnostic_status']
assert data['evidence_provenance'][1]['supervisor_status']=='OBSERVED'
time_checks=0
for event in data['evidence_timeline']['events']:
    basis=event['time_basis']
    if basis['source_timestamp']:
        value=json.loads((ROOT/sources[basis['source_ref']]['path']).read_text())
        for k in basis['json_pointer'].strip('/').split('/'):value=value[k]
        instant=datetime.fromisoformat(value);assert instant==datetime.fromisoformat(basis['source_timestamp'])
        assert event['date_label'].startswith(instant.astimezone(ZoneInfo('Asia/Taipei')).strftime('%m/%d'));time_checks+=1

class Inspect(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.hrefs=[];self.active=[];self.resources=[];self.scripts=[];self.current=None;self.styles=[];self.instyle=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if 'href' in a:self.hrefs.append(a['href'])
        if any(k.lower().startswith('on') for k in a) or tag in ('iframe','object','embed','foreignobject','img','base'):self.active.append(tag)
        if 'src' in a or 'srcset' in a or tag=='link':self.resources.append(tag)
        if tag=='script':self.current={'type':a.get('type',''),'text':''};self.scripts.append(self.current)
        if tag=='style':self.instyle=True
    def handle_data(self,text):
        if self.current is not None:self.current['text']+=text
        if self.instyle:self.styles.append(text)
    def handle_endtag(self,tag):
        if tag=='script':self.current=None
        if tag=='style':self.instyle=False

html=(HERE/'index.html').read_text();assert html==b.build(data,index)
p=Inspect();p.feed(html);assert len(p.ids)==len(set(p.ids))
assert all(h[1:] in p.ids for h in p.hrefs if h.startswith('#'))
assert all(h.startswith('#') or h.startswith('../../') for h in p.hrefs)
assert not p.active and not p.resources and len(p.scripts)==3
assert [json.loads(s['text']) for s in p.scripts if s['type']=='application/json']==[data,index]
css=''.join(p.styles);assert '@import' not in css
assert all(url.strip(' \"\'').startswith('#') for url in re.findall(r'url\((.*?)\)',css))
script=next(s['text'] for s in p.scripts if not s['type'])
assert not any(sink in script for sink in ['innerHTML','outerHTML','document.write','fetch(','XMLHttpRequest','WebSocket','sendBeacon','eval('])
attack='</script><img src=x onerror="globalThis.reportInjected=1"><script>globalThis.reportInjected=1</script>'
mutations=[lambda d,i:d['findings'][1]['details'].__setitem__('summary',attack),lambda d,i:d['evidence_excerpts'][0].__setitem__('text',attack),lambda d,i:i['sources'][0].__setitem__('summary',attack),lambda d,i:d['diagrams'][0]['nodes'][0].__setitem__('title',attack),lambda d,i:d['coverage_matrix']['columns'][0].__setitem__('title',attack),lambda d,i:d['evidence_timeline']['events'][0].__setitem__('summary',attack),lambda d,i:d['glossary'][0].__setitem__('definition',attack)]
for mutate in mutations:
    d,i=copy.deepcopy(data),copy.deepcopy(index);mutate(d,i);x=Inspect();x.feed(b.build(d,i));assert not x.active and not x.resources and len(x.scripts)==3
for area in ['coverage_matrix','evidence_timeline']:
    d=copy.deepcopy(data);d[area]['id']='bad" onload="alert(1)'
    try:b.build(d,index)
    except ValueError:pass
    else:raise AssertionError('Invalid visual ID accepted')
serial=json.dumps(data,ensure_ascii=False)+json.dumps(index,ensure_ascii=False)
assert not any(path in serial for path in ['/Users/','/private/tmp/','/var/folders/','file://'])
patterns={
 'private_key_block':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 'aws_access_key':r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
 'google_api_key':r'\bAIza[0-9A-Za-z_-]{30,}\b',
 'openai_token_shape':r'\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}',
 'bearer_literal':r'Bearer\s+[A-Za-z0-9_.-]{24,}',
}
pattern_counts={name:len(re.findall(pattern,serial)) for name,pattern in patterns.items()};assert all(n==0 for n in pattern_counts.values())
result={'task':7,'status':'PASS','scope':'Selected-source reconciliation and report rendering audit only; no product tests, installation or external requests.','sources_verified':len(sources),'product_sources_matching_snapshot':product_count,'references_checked':len(refs),'safe_excerpts_verified':len(excerpts),'scenario_identities_verified':len(original),'provenance_mappings_verified':len(provenance['records']),'timezone_timestamps_verified':time_checks,'injection_mutations_verified':len(mutations),'checks':{'all_hashes_sizes_hrefs_locators_match':True,'original_15_scenario_names_and_matrix_preserved':True,'finding_candidate_and_release_statuses_consistent':True,'all_proof_level_codes_have_definitions':True,'browser_fixture_status_not_browser_success':True,'all_safety_excerpts_traceable_and_plain_text':True,'no_external_rendering_resource_or_network_sink':True,'no_absolute_host_paths_embedded':True,'unsafe_svg_ids_rejected':True,'no_fabricated_owners_dates_ratings_or_approvals':True},'limited_secret_pattern_counts':pattern_counts,'manual_review_notes':['F-001仍指realCounts.艘中的固定5，不改名。','C002傳輸bytes總量矛盾明列未解，不作容量證明。','Panel離線重評不當重掃，Standalone無成品不宣稱零洩漏。','報告未內嵌raw日誌全文，安全節錄取自非秘密程式碼或白名單合成結果。','三個候選仍NEEDS VALIDATION；改善順序不代表CVSS或風險接受。'],'limitations':['有限格式比對與人工選取節錄不等於完整秘密掃描，未安裝或執行外部掃描器。','未讀真env、憑證、Keychain或宿主Profile。','真瀏覽器CSP與桌機／手機／鍵盤／瀏覽器列印未驗證；詳見第8項交付紀錄。']}
(HERE/'qa/task-7-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
