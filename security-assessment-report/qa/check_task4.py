"""Focused offline HTML generation checks; no product execution."""
from pathlib import Path
from html.parser import HTMLParser
import base64
import copy
import hashlib
import importlib.util
import json
import re

HERE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('report_builder',HERE/'build_report.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
class Inspect(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.anchors=[];self.resources=[];self.bad=[];self.scripts=[];self.active=None;self.csp=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='a':self.anchors.append(a.get('href',''))
        if tag in ('img','iframe','object') or any(k.startswith('on') for k in a):self.bad.append(tag)
        if 'src' in a or tag=='link':self.resources.append(a)
        if tag=='script':self.active={'type':a.get('type',''),'text':''};self.scripts.append(self.active)
        if a.get('http-equiv')=='Content-Security-Policy':self.csp=a['content']
    def handle_data(self,data):
        if self.active is not None:self.active['text']+=data
    def handle_endtag(self,tag):
        if tag=='script':self.active=None

data=json.loads((HERE/'report-data.json').read_text());index=json.loads((HERE/'source-index.json').read_text());text=(HERE/'index.html').read_text()
assert text==builder.build(data,index),'Generated output stale'
p=Inspect();p.feed(text)
assert len(p.ids)==len(set(p.ids)), 'Duplicate document IDs'
assert all(h[1:] in p.ids for h in p.anchors if h.startswith('#')), 'Unresolved anchor'
assert not p.resources and not p.bad, 'Unexpected resource or active source content'
assert len(p.scripts)==3
embedded=[json.loads(s['text']) for s in p.scripts if s['type']=='application/json']
assert embedded==[data,index]
js=next(s['text'] for s in p.scripts if not s['type'])
script_hash=base64.b64encode(hashlib.sha256(js.encode()).digest()).decode()
assert "'sha256-"+script_hash+"'" in p.csp
assert "default-src 'none'" in p.csp
assert 'fetch(' not in js and 'innerHTML' not in js
malicious='</script><img src=x onerror="globalThis.reportInjected=1"><script>globalThis.reportInjected=1</script>'
mut=copy.deepcopy(data);mut['metadata']['title']=malicious;mut['evidence_excerpts'][0]['text']=malicious;mut['findings'][0]['details']['summary']=malicious
q=Inspect();q.feed(builder.build(mut,index));assert not q.bad and not q.resources and len(q.scripts)==3
assert json.loads(next(s['text'] for s in q.scripts if s['type']=='application/json'))['metadata']['title']==malicious
bad=copy.deepcopy(index);bad['sources'][0]['href']='javascript:alert(1)'
try:builder.build(data,bad)
except ValueError:pass
else:raise AssertionError('Unsafe source href accepted')
assert all(s['id'] in p.ids for s in data['scenarios'])
assert all(f['id'] in p.ids for f in data['findings'])
result={'task':4,'status':'PASS','scope':'Static single-file HTML and generator checks, not browser security or visual acceptance.','html_bytes':len(text.encode()),'unique_ids':len(p.ids),'source_links':len(index['sources']),'checks':{'deterministic_output':True,'embedded_data_matches_json_sources':True,'no_external_rendering_resources':True,'all_internal_anchors_resolve':True,'csp_script_hash_matches':True,'source_text_and_json_script_termination_escaped':True,'unsafe_source_href_rejected':True,'all_findings_and_scenarios_rendered_statically':True},'real_browser':'BLOCKED_TARGET_CLOSED','visual_acceptance':'NOT_VERIFIED'}
(HERE/'qa/task-4-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
