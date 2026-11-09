"""Render report print QA with installed tools; no dependency files modified."""
from pathlib import Path
import json
import logging
import re
import pydyf
from weasyprint import HTML

HERE=Path(__file__).resolve().parents[1]
# Installed WeasyPrint62 uses old names; pydyf0.12 provides equivalent operators.
# These aliases affect this process only, not site-packages or product dependencies.
ALIASES={'transform':'set_matrix','text_matrix':'set_text_matrix','color_space':'set_color_space','shading':'paint_shading'}
for old,new in ALIASES.items():
    if not hasattr(pydyf.Stream,old):setattr(pydyf.Stream,old,getattr(pydyf.Stream,new))
logging.basicConfig(filename=HERE/'qa/print-compatibility.log',level=logging.WARNING)
def deny_resource(url,*args,**kwargs):
    raise ValueError('External resources disabled for offline print QA')
source=(HERE/'index.html').read_text()
# QA PDF keeps internal anchors but avoids resolving evidence links to host file URIs.
source=re.sub(r' href="\.\./\.\./[^"\n]*"','',source)
doc=HTML(string=source,base_url='https://report.invalid/',url_fetcher=deny_resource).render()
summary_pages=[]
for i,page in enumerate(doc.pages):
    text=''.join(box.text for box in page._page_box.descendants() if getattr(box,'text',None))
    if any(getattr(box,'element',None) is not None and box.element.get('id')=='executive-summary' for box in page._page_box.descendants()):summary_pages.append(i+1)
doc.write_pdf(HERE/'qa/report-print.pdf')
result={'renderer':'WeasyPrint62.3 + installed pydyf0.12.1','process_only_compatibility_aliases':ALIASES,'browser_equivalent':False,'total_pages':len(doc.pages),'management_summary_pages':summary_pages,'external_fetch_policy':'DENY_ALL','source':'index.html','evidence_file_links_disabled_for_preview':True,'purpose':'A4 print layout QA only; not primary deliverable or browser print acceptance.'}
(HERE/'qa/task-8-print-render.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
