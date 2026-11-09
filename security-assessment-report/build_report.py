"""Build the offline report from reviewed JSON; never execute product code."""
from pathlib import Path
import base64
import hashlib
import html
import json
import re

HERE = Path(__file__).resolve().parent

def esc(value):
    return html.escape(str(value), quote=True)

def json_text(value):
    return json.dumps(value, ensure_ascii=False).replace('&', '\\u0026').replace('<', '\\u003c').replace('>', '\\u003e').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')

LABELS = {
    'CONFIRMED': '已確認', 'NEEDS_VALIDATION': '待確認', 'OPEN': '未修補',
    'FIXED': '已修補', 'LIVE_HTTP_DYNAMIC': '真實動態測試', 'INCOMPLETE': '評估未完成',
    'PENDING_VALIDATION': '待驗證', 'PARTIALLY_VERIFIED': '部分驗證',
    'KNOWN_OPEN_FINDING': '含已知未修補缺陷', 'EXECUTED': '實際執行',
    'INHERITED_OBSERVATION': '沿用歷史觀察', 'OFFLINE_REEVALUATION': '離線重評',
    'NOT_ASSESSED': '尚未評估', 'SUPPORTED_BY_RETAINED_AUDIT': '保留審計支持',
    'BLOCKED': '受阻', 'NOT_TESTED': '未測試',
    'DECISION_REQUIRED': '待決策', 'CONTRACT_REQUIRED': '待定契約',
    'BLOCKED_MISSING_TOOL_BINARY': '缺必要工具', 'OWNER_DECISION_REQUIRED': '待責任人決定',
    'PARTIAL_MITIGATION': '部分緩解', 'NOT_APPLICABLE': '不適用',
    'ADOPTED_OFFICIAL_SCORE': '採用官方分數', 'PENDING_CONTEXT': '待補脈絡',
}

def label(value):
    return LABELS.get(value, value)

def tag(value, tone='neutral'):
    return f'<span class="tag {esc(tone)}">{esc(label(value))}</span>'

# Inline SVG badge icons (generated via `codex exec`, reviewed and validated
# as plain single-color <path> markup before embedding — no scripts, no
# external refs, no ids). Decorative only: the text label next to each icon
# always carries the actual status; the icon never substitutes for it.
STATUS_ICONS = {
    'FIXED': '<svg class="badge-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12 2 3 6v6c0 5 6 9 9 10 3-1 9-5 9-10V6L12 2Zm-1.5 14.5-4-4L8 11l2.5 2.5L16 8l1.5 1.5-7 7Z"/></svg>',
    'PARTIAL_MITIGATION': '<svg class="badge-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12 2 3 6v6c0 5 6 9 9 10 3-1 9-5 9-10V6L12 2Zm0 2.2v15.6c3-1.4 7-4.6 7-7.8V7.3l-7-3.1Z"/></svg>',
    'PENDING_VALIDATION': '<svg class="badge-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12 2 3 6v6c0 5 6 9 9 10 3-1 9-5 9-10V6L12 2Zm-1 5h2v6h-2V7Zm0 8h2v2h-2v-2Z"/></svg>',
}

def status_tag(value, tone='neutral'):
    icon = STATUS_ICONS.get(value, '')
    return f'<span class="tag {esc(tone)}">{icon}{esc(label(value))}</span>'

def refs(items):
    return '<p class="refs">證據 '+ ' · '.join(f'<a href="#{esc(s)}">{esc(s)}</a>' for s in dict.fromkeys(items))+'</p>' if items else ''

def paras(items):
    return ''.join(f'<p>{esc(x)}</p>' for x in items)

def ul(items, ordered=False):
    el = 'ol' if ordered else 'ul'
    return f'<{el}>'+''.join(f'<li>{esc(x)}</li>' for x in items)+f'</{el}>'

def blocks(section):
    return ''.join(f'<article class="prose-block"><h3>{esc(b["title"])}</h3>{paras(b["paragraphs"])}{refs(b.get("source_refs",[]))}</article>' for b in (section.get('content') or {}).get('blocks', []))

def head(sid, number, title, intro=''):
    return f'<section id="{esc(sid)}" class="report-section"><header class="section-heading"><p class="eyebrow">{esc(number)}</p><h2>{esc(title)}</h2>{("<p>"+esc(intro)+"</p>") if intro else ""}</header>'

DIAGRAM_SVG_STYLE = '''
svg{font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC",sans-serif}
.node-box{fill:#f5f8f6;stroke:#8da99f;stroke-width:1.4}.node.confirmed .node-box{fill:#fff3eb;stroke:#ae5a39}.node.unverified .node-box{fill:#f7f7f4;stroke:#8b938c;stroke-dasharray:5 4}.node-title{font-size:16px;font-weight:700;fill:#172d36}.node-line{font-size:13px;fill:#36545a}.node-state{font-size:11.5px;fill:#735219}.edge-base{fill:none;stroke:#527e75;stroke-width:1.7}.edge-base.architecture{stroke:#778b88}.edge-base.unverified_external{stroke:#7c847e;stroke-dasharray:6 5}.motion-line{fill:none;stroke:#11776a;stroke-width:3;stroke-dasharray:4 16;opacity:0}.boundary-line{stroke:#aab9b2;stroke-width:1;stroke-dasharray:3 5}.boundary-label{font-size:12px;fill:#536a62}.diagram-caption{font-size:12px;fill:#536a62}.node:focus .node-box,.node:hover .node-box{stroke:#9b6509;stroke-width:3}.node{outline:none}
'''

def svg_presentation_fallback(svg):
    """Keep SVG readable in print engines that ignore outer HTML CSS."""
    import xml.etree.ElementTree as ET
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    root=ET.fromstring(svg)
    root.set('font-family','PingFang TC, Noto Sans TC, sans-serif')
    text_styles={
        'node-title':('16','#172d36','700'),'node-line':('13','#36545a',None),
        'node-state':('11.5','#735219',None),'boundary-label':('12','#536a62',None),
        'diagram-caption':('12','#536a62',None),'matrix-caption':('12','#52685e',None),
        'matrix-heading':('13','#274139','700'),'matrix-id':('13','#243e36',None),
        'matrix-symbol':('17','#426c62',None),'timeline-date':('12','#52685e',None),
        'timeline-title':('16','#172d36','700'),'timeline-kind':('11','#70581d',None),
        'timeline-summary':('13','#36544b',None),
    }
    def visit(element,tone=''):
        classes=element.get('class','').split()
        if 'node' in classes:tone=next((v for v in ['confirmed','unverified'] if v in classes),'')
        if 'node-box' in classes:
            element.set('fill','#fff3eb' if tone=='confirmed' else '#f7f7f4' if tone=='unverified' else '#f5f8f6')
            element.set('stroke','#ae5a39' if tone=='confirmed' else '#8b938c' if tone=='unverified' else '#8da99f')
            element.set('stroke-width','1.4')
            if tone=='unverified':element.set('stroke-dasharray','5 4')
        if 'edge-base' in classes:
            element.set('fill','none');element.set('stroke','#7c847e' if 'unverified_external' in classes else '#778b88' if 'architecture' in classes else '#527e75');element.set('stroke-width','1.7')
            if 'unverified_external' in classes:element.set('stroke-dasharray','6 5')
        if 'motion-line' in classes:element.set('fill','none');element.set('opacity','0')
        if 'boundary-line' in classes:element.set('stroke','#aab9b2');element.set('stroke-width','1');element.set('stroke-dasharray','3 5')
        if 'matrix-row-bg' in classes:element.set('fill','#f3f6f3');element.set('stroke','#e0e6e1');element.set('stroke-width','.5')
        for cls,(size,color,weight) in text_styles.items():
            if cls in classes:
                element.set('font-size',size);element.set('fill',color)
                if weight:element.set('font-weight',weight)
        if 'matrix-symbol' in classes:
            if 'defect' in classes:element.set('fill','#a34227')
            elif any(c in classes for c in ['limited','historical_blocked','subset_blocked']):element.set('fill','#815321')
            elif 'not_indexed' in classes:element.set('fill','#78867e')
        for child in element:visit(child,tone)
    visit(root)
    return ET.tostring(root,encoding='unicode')


def diagram_svg(model, standalone=False):
    gid=model['id']
    for field in ('width','height'):
        if type(model[field]) is not int or not 1 <= model[field] <= 5000:raise ValueError('Invalid diagram dimensions')
    for node in model['nodes']:
        if any(type(node[field]) is not int or node[field] < 0 for field in ('x','y','width','height')):raise ValueError('Invalid node geometry')
        if node['x']+node['width'] > model['width'] or node['y']+node['height'] > model['height']:raise ValueError('Node outside viewBox')
    if not re.fullmatch(r'[a-z][a-z0-9-]*',gid):raise ValueError('Unsafe diagram ID')
    marker=gid+'-arrow'
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" id="{gid}-svg" viewBox="0 0 {model["width"]} {model["height"]}" role="group" aria-labelledby="{gid}-title {gid}-description" class="diagram-svg"><title id="{gid}-title">{esc(model["title"])}</title><desc id="{gid}-description">{esc(model["description"])}</desc>{('<style>'+DIAGRAM_SVG_STYLE+'</style>') if standalone else ''}<defs><marker id="{marker}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse"><path d="M0 0 L7 3.5 L0 7 Z" fill="#527e75"/></marker></defs><rect width="{model["width"]}" height="{model["height"]}" fill="#fcfdfb"/><text x="16" y="24" class="diagram-caption">關係示意 · 非即時執行 · 節點可查看證據</text>'
    for edge in model['edges']:
        if not re.fullmatch(r'[MLHV0-9 .,-]+',edge['path']):raise ValueError('Unsupported diagram path')
        start=f' marker-start="url(#{marker})"' if edge.get('bidirectional') else ''
        svg+=f'<path class="edge-base {esc(edge["kind"])}" d="{edge["path"]}" marker-end="url(#{marker})"{start}><title>{esc(edge["label"])}</title></path>'
        if edge['kind'] in ('observed_subset','explanation'):
            svg+=f'<path class="motion-line" d="{edge["path"]}" aria-hidden="true"/>'
    for b in model['boundaries']:
        svg+=f'<line class="boundary-line" x1="16" x2="404" y1="{b["y"]}" y2="{b["y"]}"/><rect x="12" y="{b["y"]-25}" width="396" height="22" fill="#fcfdfb"/><text class="boundary-label" x="16" y="{b["y"]-9}">{esc(b["label"])}</text>'
    for n in model['nodes']:
        if not re.fullmatch(r'[a-z][a-z0-9-]*',n['id']):raise ValueError('Unsafe node ID')
        x,y=n['x'],n['y'];dest=gid+'-detail-'+n['id']
        svg+=f'<a class="node {esc(n["tone"])}" href="#{dest}" tabindex="0" aria-label="{esc(n["title"]+"："+n["status"]+"，查看證據與限制")}"><title>{esc(n["title"]+"；"+n["status"])}</title><rect class="node-box" x="{x}" y="{y}" width="{n["width"]}" height="{n["height"]}" rx="10"/><text x="{x+12}" y="{y+27}" class="node-title">{esc(n["title"])}</text>'
        for i,line in enumerate(n['lines']):svg+=f'<text x="{x+12}" y="{y+50+i*19}" class="node-line">{esc(line)}</text>'
        svg+=f'<text x="{x+12}" y="{y+n["height"]-11}" class="node-state">{esc(n["status"])}</text></a>'
    return svg_presentation_fallback(svg+'</svg>')

def diagram_figure(model):
    gid=model['id']
    controls='' if model.get('animated') is False else f'<div class="diagram-controls js-only"><button type="button" data-animation-toggle="{gid}" aria-controls="{gid}-svg" aria-pressed="false">播放示意動畫</button><span id="{gid}-motion-status" class="small" aria-live="polite">靜態顯示</span></div>'
    legend='' if model.get('animated') is False else '<div class="diagram-legend"><span>實線：已測入口子集或架構關係</span><span>虛線：真外部服務未驗證</span><span>動畫：概念示意，不是測試證據</span></div>'
    result=f'<figure id="{gid}" class="diagram" data-playing="false"><figcaption><h3>{esc(model["title"])}</h3><p>{esc(model["description"])}</p></figcaption>{controls}{diagram_svg(model)}<p class="qualifier">{esc(model["animation_caption"])}</p>{legend}{refs(model["source_refs"])}<div class="diagram-transcript"><h4>節點文字對照與證據</h4>'
    for n in model['nodes']:
        result+=f'<details open data-fold id="{gid}-detail-{n["id"]}"><summary>{esc(n["title"])} · {esc(n["status"])}</summary><p>{esc(n["detail"])}</p>'
        if n.get('entries'):result+='<p class="small">產品入口／元件：'+esc(' · '.join(n['entries']))+'</p>'
        if n.get('target'):
            if not re.fullmatch(r'[A-Za-z0-9-]+',n['target']):raise ValueError('Unsafe evidence anchor')
            result+=f'<p><a href="#{n["target"]}">前往相關發現／證據節錄</a></p>'
        result+=refs(n['source_refs'])+'</details>'
    return result+'</div></figure>'

DIAGRAM_CSS = '''
.diagram{margin:28px 0;padding:22px;border:1px solid #cbd8d1;border-radius:12px;background:#fcfdfb;min-width:0}.diagram figcaption h3{margin-top:0}.diagram-svg{display:block;width:100%;max-width:500px;height:auto;margin:14px auto}.diagram-controls{gap:10px;align-items:center;flex-wrap:wrap}.diagram-controls button{padding:8px 13px;border:1px solid #9aafa6;border-radius:6px;background:#fff;color:#174d45;font:inherit;cursor:pointer}.diagram-controls button:disabled{cursor:default;color:#53645d}.diagram[data-playing="true"] .motion-line{opacity:.8;animation:diagram-flow 1.8s linear infinite}.diagram-legend{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:#52685e}.diagram-legend span{padding:4px 8px;border:1px solid #d9e2dc;border-radius:4px}.diagram-transcript{border-top:1px solid #d4dedb;margin-top:18px;padding-top:12px}.diagram-transcript details{padding:8px 0;border-bottom:1px dotted #d5ded8}.diagram-transcript p{font-size:14px}.diagram-transcript .refs{font-size:12px}@keyframes diagram-flow{from{stroke-dashoffset:40}to{stroke-dashoffset:0}}@media(max-width:720px){.diagram{padding:12px;margin:20px 0}.diagram-svg{max-width:420px}.diagram figcaption p{font-size:14px}}@media(prefers-reduced-motion:reduce){.diagram .motion-line{display:none!important;animation:none!important}}@media print{.diagram-controls{display:none!important}.diagram{padding:10px;background:#fff;break-inside:auto;border-radius:0}.diagram .motion-line{display:none!important;animation:none!important}.diagram-svg{max-width:115mm;max-height:230mm;width:100%;break-inside:avoid}.diagram figcaption{break-after:avoid}.diagram-transcript{break-before:auto}.diagram-legend{font-size:8pt}}
'''

DIAGRAM_SCRIPT = '''
const diagramMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const motionButtons = Array.from(document.querySelectorAll('[data-animation-toggle]'));
function setDiagramPlaying(button, playing) {
  const figure = document.getElementById(button.dataset.animationToggle);
  if (!figure) return;
  const reduced = Boolean(diagramMotion && diagramMotion.matches);
  const actual = Boolean(playing && !reduced);
  figure.dataset.playing = String(actual);
  button.setAttribute('aria-pressed', String(actual));
  button.disabled = reduced;
  button.textContent = reduced ? '已停用動畫（減少動態）' : actual ? '暫停示意動畫' : '播放示意動畫';
  document.getElementById(figure.id + '-motion-status').textContent = reduced ? '依系統設定保持靜態' : actual ? '播放概念示意；非即時測試' : '靜態顯示';
}
motionButtons.forEach(button => {
  setDiagramPlaying(button, false);
  button.addEventListener('click', () => setDiagramPlaying(button, button.getAttribute('aria-pressed') !== 'true'));
});
function syncReducedMotion() { motionButtons.forEach(button => setDiagramPlaying(button, false)); }
if (diagramMotion && diagramMotion.addEventListener) diagramMotion.addEventListener('change', syncReducedMotion);
let diagramPrintState = null;
window.addEventListener('beforeprint', () => {
  if (diagramPrintState) return;
  diagramPrintState = motionButtons.map(button => [button,button.getAttribute('aria-pressed') === 'true']);
  motionButtons.forEach(button => setDiagramPlaying(button, false));
});
window.addEventListener('afterprint', () => {
  if (!diagramPrintState) return;
  diagramPrintState.forEach(([button,playing]) => setDiagramPlaying(button, playing));
  diagramPrintState = null;
});
'''

STYLE = '''
:root{--ink:#172d36;--muted:#4c6470;--paper:#fff;--bg:#f1f3f1;--line:#d4dedb;--accent:#126a62;--warm:#a74624;--warn:#794f09;--soft:#edf4f1;--radius:12px;color-scheme:light}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.8 -apple-system,BlinkMacSystemFont,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}a{color:var(--accent);text-underline-offset:3px}a:hover{text-decoration-thickness:2px}button,input,select{font:inherit}button{cursor:pointer}button,a,input,select,summary{touch-action:manipulation}:focus-visible{outline:3px solid #b2760b;outline-offset:4px}.skip{position:fixed;top:-100px;left:12px;z-index:50;background:#fff;padding:12px}.skip:focus{top:12px}.layout{display:grid;grid-template-columns:250px minmax(0,1fr);max-width:1600px;margin:auto}.sidebar{position:sticky;top:0;height:100vh;padding:32px 20px;overflow:auto;border-right:1px solid var(--line)}.brand{font-size:28px;font-weight:800;letter-spacing:.1em}.small,.sidebar p{font-size:13px;color:var(--muted)}.sidebar nav{display:grid;gap:6px;margin:30px 0}.sidebar nav a{padding:8px 10px;text-decoration:none;border-left:3px solid transparent}.sidebar nav a[aria-current="location"]{background:#e0eae5;border-left-color:var(--accent);font-weight:700}.sidebar button{background:white;border:1px solid var(--line);border-radius:6px;padding:8px 12px;width:100%}main{min-width:0;background:var(--paper);padding:48px clamp(24px,5vw,80px) 72px}.hero{border-top:5px solid var(--accent);padding:32px 0 40px;border-bottom:1px solid var(--line)}.eyebrow{font-size:12px;letter-spacing:.16em;font-weight:700;color:var(--accent);margin:0 0 10px;text-transform:uppercase}h1{font-size:clamp(28px,3.5vw,46px);line-height:1.35;letter-spacing:-.02em;margin:12px 0}h2{font-size:29px;line-height:1.5;margin:0 0 12px}h3{font-size:20px;line-height:1.6;margin:20px 0 8px}h4{font-size:16px;margin:16px 0 6px}p{margin:8px 0 14px}.subtitle{font-size:19px;color:var(--muted)}.status-banner{border-left:4px solid var(--warm);background:#fbf1eb;padding:16px 20px;margin:24px 0;color:#653723}.status-banner strong{display:block;font-size:20px}.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 24px;margin:24px 0 0}.meta div{min-width:0}.meta dt{font-size:12px;color:var(--muted)}.meta dd{margin:2px 0;font-size:14px;overflow-wrap:anywhere}.report-section{padding-top:52px;margin-top:12px}.section-heading{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:24px}.section-heading>p:last-child{color:var(--muted)}.prose-block{margin:24px 0}.refs{font-size:12px;color:var(--muted);overflow-wrap:anywhere;line-height:1.8}.refs a{display:inline-block}.tag{display:inline-block;font-size:12px;padding:2px 9px;background:#edf0ef;border:1px solid #d9e0dd;border-radius:4px;vertical-align:middle;line-height:1.8}.tag.confirmed{color:#8a321c;background:#fcf0e8;border-color:#edc9b8}.tag.pending{color:var(--warn);background:#faf4df;border-color:#e6d69c}.tag.teal{background:#e9f2f0;color:#17594f}.tags{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.stat-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:24px 0 4px}.stat-tile{border:1px solid var(--line);border-radius:var(--radius);padding:16px 14px;min-width:0;background:var(--soft);display:flex;flex-direction:column;gap:4px}.stat-tile.confirmed{border-color:#edc9b8;background:#fcf0e8}.stat-tile.pending{border-color:#e6d69c;background:#faf4df}.stat-value{font-size:28px;font-weight:800;line-height:1.1;overflow-wrap:anywhere}.stat-tile.confirmed .stat-value{color:#8a321c}.stat-tile.pending .stat-value{color:var(--warn)}.stat-label{font-size:12px;color:var(--muted)}.card{border:1px solid var(--line);border-radius:var(--radius);padding:24px;margin:20px 0;min-width:0;overflow-wrap:anywhere}.card-heading{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.card-heading h3{margin:0}.identifier{font:700 12px/1.6 ui-monospace,SFMono-Regular,monospace;color:var(--accent);display:block;margin-bottom:5px}.subgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 28px}.subgrid>div{min-width:0}.risk-note{border-left:3px solid #d7bf7d;padding:8px 14px;background:#fcfaf3}.qualifier{font-size:14px;color:var(--muted)}.filter{background:var(--soft);border-radius:8px;padding:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:end}.filter label{display:grid;gap:4px;font-size:13px;color:var(--muted);flex:1;min-width:150px}.filter input,.filter select{width:100%;min-width:0;border:1px solid #b7c9c3;background:#fff;color:var(--ink);border-radius:5px;padding:8px}.filter button,.toolbar button{border:1px solid #b7c9c3;background:white;color:var(--ink);border-radius:5px;padding:8px 13px}.count{font-size:13px;color:var(--muted)}.toolbar{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}details{margin:14px 0}summary{cursor:pointer;color:var(--accent);font-weight:600;overflow-wrap:anywhere}summary::marker{font-size:12px}pre{padding:16px;background:#f3f5f4;border:1px solid var(--line);border-radius:6px;font:12px/1.7 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;color:#253b44}code{font-family:ui-monospace,SFMono-Regular,monospace;font-size:.85em;overflow-wrap:anywhere}.evidence{margin:16px 0;padding:16px 0;border-top:1px dashed var(--line)}.evidence h4{margin-top:0}.source-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.source-item{padding:16px;border:1px solid var(--line);border-radius:8px;min-width:0;overflow-wrap:anywhere}.source-item p{font-size:13px}.source-item code{font-size:11px}.source-item:target,.evidence:target{outline:2px solid var(--accent);outline-offset:4px}.callout{background:var(--soft);padding:18px 22px;border-radius:8px}.draft-note{font-size:13px;border:1px dashed #b6c7bf;padding:12px 16px;color:var(--muted);margin-top:20px}li{margin:6px 0}ul,ol{padding-left:24px}.no-results{padding:24px;background:#faf7ed}footer{margin-top:48px;padding-top:22px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}[hidden]{display:none!important}.js-only{display:none}.js-enabled .js-only{display:flex}.mono{font-family:ui-monospace,monospace;font-size:12px;overflow-wrap:anywhere}
.plain-language{border-left:3px solid #4c8f84;background:#eef6f4;padding:10px 16px;margin:14px 0}.plain-language h4{margin-top:0;color:#17594f}.risk-matrix{margin:24px 0;padding:18px 20px;border:1px solid var(--line);border-radius:var(--radius);background:var(--soft)}.risk-matrix figcaption h3{margin-top:0}.risk-matrix-svg{display:block;width:100%;max-width:420px;height:auto;margin:10px auto}.rm-axis{font-size:13px;fill:var(--muted)}.rm-cell{stroke:#c7d3cd;stroke-width:1}.rm-cell-label{font-size:12px;fill:var(--ink);font-weight:600}.badge-icon{width:16px;height:16px;vertical-align:-3px;margin-right:4px}
@media(max-width:1000px){.layout{grid-template-columns:205px minmax(0,1fr)}.sidebar{padding:24px 12px}main{padding:32px 26px}.source-list{grid-template-columns:1fr}}
@media(max-width:720px){html{scroll-padding-top:12px}.layout{display:block}.sidebar{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--line);padding:16px 20px}.sidebar .brand{font-size:22px}.sidebar p{margin:2px 0}.sidebar nav{display:flex;flex-wrap:wrap;gap:4px;margin:12px 0}.sidebar nav a{font-size:13px;padding:4px 8px}.sidebar button{width:auto;padding:5px 12px}.sidebar .sidebar-note{display:none}main{padding:24px 20px 48px}.hero{padding:22px 0 28px}.meta,.subgrid{grid-template-columns:1fr}.stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.meta{gap:10px}.report-section{padding-top:36px}h2{font-size:24px}.card{padding:18px}.card-heading{display:block}.filter{padding:12px}.source-list{grid-template-columns:1fr}.status-banner{padding:12px 16px}.status-banner strong{font-size:17px}.risk-matrix{padding:12px}.risk-matrix-svg{max-width:300px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}}
@page{size:A4;margin:17mm 15mm;@bottom-left{content:'A24 · 安全評估 · 無發布放行';font-size:8pt;color:#536a62}@bottom-right{content:counter(page) ' / ' counter(pages);font-size:8pt;color:#536a62}}
@media print{html{scroll-behavior:auto}body{background:#fff;color:#111;font-size:10pt;line-height:1.65}.layout{display:block;max-width:none}.sidebar,.skip,.filter,.toolbar,.count,.no-results,.js-only,.draft-note{display:none!important}main{padding:0}.hero{padding:12px 0 20px}h1{font-size:26pt}h2{font-size:19pt}h3{font-size:13pt}h4{font-size:11pt}.report-section{padding-top:20px;margin-top:10px}.report-section:not(#executive-summary){break-before:page}#executive-summary .prose-block{margin:14px 0}.card{padding:12px;margin:12px 0;border-radius:0}.card,.prose-block{break-inside:auto}h2,h3,h4,summary{break-after:avoid}.refs{font-size:8pt}.source-list{display:block}.source-item{margin-bottom:10px;break-inside:avoid}pre{font-size:8pt;white-space:pre-wrap;break-inside:auto}a{color:inherit;text-decoration:underline}.tag{font-size:8pt}details[open]>summary{list-style:none}details::details-content{display:block;content-visibility:visible}details>*:not(summary){display:block!important}.filterable[hidden]{display:block!important}.status-banner{padding:10px 14px;background:#fff;border:1px solid #555;border-left-width:4px}.meta{gap:8px 16px}.meta dd{font-size:9pt}.stat-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.stat-tile{padding:8px 6px}.stat-value{font-size:16pt}.stat-label{font-size:8pt}.callout{padding:10px 14px;background:#f4f4f4}.subgrid{gap:8px 20px}footer{font-size:8pt}.risk-matrix{padding:8px 10px;background:#fff;border:1px solid #555}.risk-matrix-svg{max-width:100mm}.plain-language{padding:6px 10px;background:#f4f4f4}}
'''

SCRIPT = '''
'use strict';
document.documentElement.classList.add('js-enabled');
const allDetails = () => Array.from(document.querySelectorAll('details[data-fold]'));
allDetails().forEach(d => { d.open = false; });
function applyFilter(form) {
  const area = document.getElementById(form.dataset.filterFor);
  const query = form.querySelector('[name="query"]').value.trim().toLocaleLowerCase();
  const status = form.querySelector('[name="status"]').value;
  const cards = Array.from(area.querySelectorAll('.filterable'));
  let count = 0;
  cards.forEach(card => {
    const visible = (!status || card.dataset.status === status) && (!query || card.textContent.toLocaleLowerCase().includes(query));
    card.hidden = !visible;
    if (visible) count += 1;
  });
  document.getElementById(form.dataset.filterFor + '-count').textContent = '顯示 ' + count + ' / ' + cards.length + ' 項；此數量不是安全通過率。';
  document.getElementById(form.dataset.filterFor + '-empty').hidden = count !== 0;
  if (form.dataset.filterFor === 'scenario-list') syncCoverageMatrix();
}
document.querySelectorAll('[data-filter-for]').forEach(form => {
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('input', () => applyFilter(form));
  form.addEventListener('change', () => applyFilter(form));
  form.addEventListener('reset', () => { setTimeout(() => applyFilter(form), 0); });
  applyFilter(form);
});
document.querySelectorAll('[data-details-action]').forEach(button => button.addEventListener('click', () => {
  const open = button.dataset.detailsAction === 'open';
  allDetails().forEach(d => { d.open = open; });
}));
function revealHash() {
  let target;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
  if (!target) return;
  let parent = target;
  while (parent) {
    if (parent.tagName === 'DETAILS') parent.open = true;
    if (parent.classList && parent.classList.contains('filterable')) parent.hidden = false;
    parent = parent.parentElement;
  }
  syncCoverageMatrix();
}
window.addEventListener('hashchange', revealHash);
revealHash();
let printState = null;
function preparePrint() {
  if (printState) return;
  printState = { details: allDetails().map(d => [d,d.open]), cards: Array.from(document.querySelectorAll('.filterable')).map(c => [c,c.hidden]) };
  printState.details.forEach(([d]) => { d.open = true; });
  printState.cards.forEach(([c]) => { c.hidden = false; });
}
function restorePrint() {
  if (!printState) return;
  printState.details.forEach(([d,open]) => { d.open = open; });
  printState.cards.forEach(([c,hidden]) => { c.hidden = hidden; });
  printState = null;
}
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('afterprint', restorePrint);
document.getElementById('print-report').addEventListener('click', () => { preparePrint(); window.print(); });
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    const current = entries.find(e => e.isIntersecting);
    if (!current) return;
    document.querySelectorAll('nav a').forEach(a => {
      if (a.getAttribute('href') === '#' + current.target.id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }, {rootMargin:'-5% 0px -65% 0px'});
  document.querySelectorAll('.report-section').forEach(s => observer.observe(s));
}
'''

def wrap_svg_text(text, units=43):
    import unicodedata
    rows=[];current='';used=0
    for char in text:
        width=2 if unicodedata.east_asian_width(char) in ('W','F') else 1
        if used+width > units:
            rows.append(current);current='';used=0
        current+=char;used+=width
    if current:rows.append(current)
    return rows


def matrix_svg(model):
    gid=model['id']
    if not re.fullmatch(r'[a-z][a-z0-9-]*',gid):raise ValueError('Unsafe matrix ID')
    height=114+34*len(model['rows']);legend={l['id']:l for l in model['legend']}
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" id="{gid}-svg" class="matrix-svg" viewBox="0 0 420 {height}" role="group" aria-labelledby="{gid}-svg-title {gid}-svg-desc" data-row-height="34"><title id="{gid}-svg-title">{esc(model["title"])}</title><desc id="{gid}-svg-desc">{esc(model["description"])}</desc><rect width="420" height="{height}" fill="#fcfdfb"/><text x="16" y="25" class="matrix-caption">證據層級分組 · 不是通過率</text><text x="16" y="61" class="matrix-heading">情境</text>'
    for j,c in enumerate(model['columns']):
        if c['id']=='filesystem':
            svg+=f'<text x="{116+48*j}" y="47" text-anchor="middle" class="matrix-heading">OS</text><text x="{116+48*j}" y="64" text-anchor="middle" class="matrix-heading">檔案</text>'
        else:svg+=f'<text x="{116+48*j}" y="61" text-anchor="middle" class="matrix-heading">{esc(c["title"])}</text>' 
    for i,row in enumerate(model['rows']):
        sid=row['scenario_id'];description='；'.join(c['title']+'：'+legend[row['cells'][c['id']]]['label'] for c in model['columns'])
        svg+=f'<g class="matrix-row" data-matrix-row="{esc(sid)}" data-filter-hidden="false" transform="translate(0,{90+i*34})"><a href="#{esc(sid)}" tabindex="0" aria-label="{esc(sid+row["title"]+"；"+description)}"><title>{esc(row["title"]+"；"+description)}</title><rect class="matrix-row-bg" x="8" y="-20" width="400" height="32" rx="4"/><text x="16" y="0" class="matrix-id">{esc(sid)}</text>'
        for j,c in enumerate(model['columns']):
            state=row['cells'][c['id']];svg+=f'<text x="{116+48*j}" y="0" text-anchor="middle" class="matrix-symbol {esc(state)}">{esc(legend[state]["symbol"])}</text>'
        svg+='</a></g>'
    return svg_presentation_fallback(svg+'</svg>')


def coverage_matrix(model):
    legends={x['id']:x for x in model['legend']}
    body=f'<figure id="{esc(model["id"])}" class="matrix-figure"><figcaption><h3>{esc(model["title"])}</h3><p>{esc(model["description"])}</p></figcaption><div class="matrix-legend">'+''.join(f'<span><strong>{esc(x["symbol"])}</strong> {esc(x["label"])}</span>' for x in model['legend'])+'</div>'+matrix_svg(model)+refs(model['source_refs'])
    body+='<details open data-fold><summary>完整文字矩陣與情境名稱</summary><div class="table-scroll" role="region" aria-label="15情境證明層級文字矩陣" tabindex="0"><table class="proof-table"><caption>符號是已採認證據的分組；破折號不是未測試結論。</caption><thead><tr><th scope="col">情境與原名稱</th>'+''.join(f'<th scope="col">{esc(c["title"])}</th>' for c in model['columns'])+'</tr></thead><tbody>'
    for r in model['rows']:
        body+=f'<tr data-matrix-table-row="{esc(r["scenario_id"])}"><th scope="row"><a href="#{esc(r["scenario_id"])}">{esc(r["scenario_id"]+" "+r["title"])}</a></th>'+''.join(f'<td>{esc(legends[r["cells"][c["id"]]]["symbol"])}<span class="cell-description"> {esc(legends[r["cells"][c["id"]]]["label"])}</span></td>' for c in model['columns'])+'</tr>'
    return body+'</tbody></table></div></details></figure>'


def timeline_svg(model):
    gid=model['id']
    if not re.fullmatch(r'[a-z][a-z0-9-]*',gid):raise ValueError('Unsafe timeline ID')
    height=40+170*len(model['events'])
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" id="{gid}-svg" viewBox="0 0 420 {height}" class="timeline-svg" role="group" aria-labelledby="{gid}-title {gid}-description"><title id="{gid}-title">{esc(model["title"])}</title><desc id="{gid}-description">{esc(model["description"])}</desc><rect width="420" height="{height}" fill="#fcfdfb"/><path d="M28 52 V{height-100}" fill="none" stroke="#a6bdb1" stroke-width="2"/>'
    for i,e in enumerate(model['events']):
        y=20+170*i;dest='timeline-detail-'+e['id']
        svg+=f'<a class="timeline-node" href="#{esc(dest)}" tabindex="0" aria-label="{esc(e["date_label"]+"，"+e["title"]+"，"+e["kind"]+"，查看出處")}"><title>{esc(e["qualification"])}</title><circle cx="28" cy="{y+32}" r="7" fill="#fcfdfb" stroke="#527e75" stroke-width="2"/><rect x="52" y="{y}" width="352" height="148" rx="9" fill="#f2f6f3" stroke="#b3c8ba"/><text x="66" y="{y+24}" class="timeline-date">{esc(e["date_label"])}</text><text x="66" y="{y+52}" class="timeline-title">{esc(e["title"])}</text><text x="66" y="{y+76}" class="timeline-kind">{esc(e["kind"])}</text>'
        for j,line in enumerate(wrap_svg_text(e['summary'])):svg+=f'<text x="66" y="{y+104+19*j}" class="timeline-summary">{esc(line)}</text>'
        svg+='</a>'
    return svg_presentation_fallback(svg+'</svg>')


def evidence_timeline(model):
    html=f'<figure id="{esc(model["id"])}" class="timeline-figure"><figcaption><h3>{esc(model["title"])}</h3><p>{esc(model["description"])}</p></figcaption>{timeline_svg(model)}{refs(model["source_refs"])}<div class="timeline-transcript"><h4>時間軸文字對照</h4>'
    for event in model['events']:
        html+=f'<details open data-fold id="timeline-detail-{esc(event["id"])}"><summary>{esc(event["date_label"]+" · "+event["title"])}</summary>{tag(event["kind"],"teal")}<p>{esc(event["summary"])}</p><p class="qualifier">{esc(event["qualification"])}</p>{refs(event["source_refs"])}</details>'
    return html+'</div></figure>'

MATRIX_TIMELINE_CSS = '''
.matrix-figure,.timeline-figure{margin:24px 0;padding:20px;border:1px solid #cbd8d1;border-radius:12px;background:#fcfdfb;min-width:0}.matrix-svg,.timeline-svg{display:block;width:100%;height:auto;max-width:500px;margin:20px auto}.matrix-caption{font-size:12px;fill:#52685e}.matrix-heading{font-size:13px;font-weight:700;fill:#274139}.matrix-id{font-size:13px;font-family:ui-monospace,monospace;fill:#243e36}.matrix-symbol{font-size:17px;fill:#426c62}.matrix-symbol.limited{fill:#84611b}.matrix-symbol.defect{fill:#a34227;font-weight:700}.matrix-symbol.fixed{fill:#1f7a52;font-weight:700}.matrix-symbol.historical_blocked,.matrix-symbol.subset_blocked{fill:#815321}.matrix-symbol.not_indexed{fill:#78867e}.matrix-row-bg{fill:#f3f6f3;stroke:#e0e6e1;stroke-width:.5}.matrix-row a:hover .matrix-row-bg,.matrix-row a:focus .matrix-row-bg{stroke:#a7751e;stroke-width:2}.matrix-legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:12px;line-height:1.6}.matrix-legend strong{display:inline-block;min-width:22px}.table-scroll{max-width:100%;overflow-x:auto}.proof-table{border-collapse:collapse;width:100%;min-width:620px;font-size:12px}.proof-table th,.proof-table td{padding:9px;border:1px solid #d1dcd4;vertical-align:top}.proof-table th{text-align:left;background:#edf3ee}.proof-table caption{text-align:left;margin-bottom:10px}.cell-description{display:block;font-size:11px;color:#52685e}.timeline-date{font-size:12px;fill:#52685e}.timeline-title{font-size:16px;font-weight:700;fill:#172d36}.timeline-kind{font-size:11px;font-family:ui-monospace,monospace;fill:#70581d}.timeline-summary{font-size:13px;fill:#36544b}.timeline-node:hover rect,.timeline-node:focus rect{stroke:#a7751e;stroke-width:2}.timeline-transcript details{padding:8px 0;border-bottom:1px dotted #d5ded8}[data-filter-hidden="true"]{display:none!important}@media(max-width:720px){.matrix-figure,.timeline-figure{padding:10px}.matrix-legend{grid-template-columns:1fr}.matrix-figure figcaption p,.timeline-figure figcaption p{font-size:14px}}@media print{.matrix-figure,.timeline-figure{padding:10px;border-radius:0;break-inside:auto}.matrix-svg{max-width:125mm;max-height:225mm;break-inside:avoid}.timeline-svg{max-width:95mm;max-height:245mm;break-inside:avoid}.matrix-legend{font-size:8pt}.proof-table{min-width:0;font-size:8pt;table-layout:fixed}.proof-table th,.proof-table td{padding:4px;overflow-wrap:anywhere}.proof-table th:first-child{width:25%}.cell-description{font-size:7pt}.table-scroll{overflow:visible}[data-filter-hidden="true"]{display:table-row!important}svg [data-filter-hidden="true"]{display:inline!important}}
'''

MATRIX_SCRIPT = '''
function syncCoverageMatrix() {
  const svg = document.getElementById('proof-matrix-svg');
  if (!svg) return;
  const visible = new Set(Array.from(document.querySelectorAll('#scenario-list .filterable')).filter(c => !c.hidden).map(c => c.id));
  let row = 0;
  svg.querySelectorAll('[data-matrix-row]').forEach(group => {
    const shown = visible.has(group.dataset.matrixRow);
    group.setAttribute('data-filter-hidden', String(!shown));
    if (shown) { group.setAttribute('transform','translate(0,' + (90 + row * 34) + ')'); row += 1; }
  });
  svg.setAttribute('viewBox', '0 0 420 ' + Math.max(134,114 + row * 34));
  document.querySelectorAll('[data-matrix-table-row]').forEach(tr => tr.setAttribute('data-filter-hidden',String(!visible.has(tr.dataset.matrixTableRow))));
}
syncCoverageMatrix();
window.addEventListener('beforeprint', syncCoverageMatrix);
window.addEventListener('afterprint', syncCoverageMatrix);
'''

STYLE += DIAGRAM_SVG_STYLE + DIAGRAM_CSS + MATRIX_TIMELINE_CSS
STYLE += '.glossary{margin:18px 0}.glossary>div{padding:12px 0;border-bottom:1px solid #d4dedb}.glossary dt{font-weight:700;overflow-wrap:anywhere}.glossary dd{margin:5px 0;overflow-wrap:anywhere}'
SCRIPT += DIAGRAM_SCRIPT + MATRIX_SCRIPT


def filter_form(target, options, placeholder):
    opts='<option value="">全部狀態</option>'+''.join(f'<option value="{esc(k)}">{esc(v)}</option>' for k,v in options)
    return f'''<form class="filter js-only" data-filter-for="{esc(target)}" role="search" aria-label="{esc(placeholder)}"><label>搜尋<input type="search" name="query" placeholder="{esc(placeholder)}" autocomplete="off"></label><label>狀態<select name="status">{opts}</select></label><button type="reset">清除篩選</button></form><p id="{esc(target)}-count" class="count" role="status" aria-live="polite"></p>'''


def stat_dashboard(data):
    """A row of stat tiles computed directly from report-data.json's existing
    findings/scenarios/metadata — no new claim, so no new source_ref: each
    number is a plain count of facts the rest of the report already cites."""
    findings = data['findings']
    scenarios = data['scenarios']
    meta = data['metadata']
    fixed = sum(1 for f in findings if f['remediation_status'] == 'FIXED')
    open_defects = sum(1 for f in findings if f['category'] == 'CONFIRMED_FINDING' and f['remediation_status'] != 'FIXED')
    needs_validation = sum(1 for f in findings if f['confirmation_status'] == 'NEEDS_VALIDATION')
    partial = sum(1 for s in scenarios if s['assessment_status'] == 'PARTIALLY_VERIFIED')
    tiles = [
        (str(fixed), '已修補缺陷', 'confirmed' if fixed else 'neutral'),
        (str(open_defects), '已確認未修補', 'pending' if open_defects else 'neutral'),
        (str(needs_validation), '待確認候選風險', 'pending' if needs_validation else 'neutral'),
        (f'{partial}/{len(scenarios)}', '情境部分驗證', 'neutral'),
        (label(meta['overall_status']), '整體狀態', 'pending' if meta['overall_status'] != 'COMPLETE' else 'confirmed'),
    ]
    return '<div class="stat-grid" role="group" aria-label="管理摘要統計（即時計算，非獨立宣稱）">' + ''.join(
        f'<div class="stat-tile {esc(tone)}"><span class="stat-value">{esc(value)}</span><span class="stat-label">{esc(lbl)}</span></div>'
        for value, lbl, tone in tiles
    ) + '</div><p class="qualifier">以上數字由本頁其他段落已引用的資料即時計算得出，不是獨立宣稱；逐項證據見下方管理摘要與安全發現。</p>'


RISK_MATRIX_ROWS = [('FIXED', '已修補'), ('PARTIAL_MITIGATION', '部分緩解'), ('PENDING_VALIDATION', '風險接受／待處理')]
RISK_MATRIX_COLS = [('CONFIRMED', '已確認'), ('NEEDS_VALIDATION', '待確認')]

def risk_matrix(data):
    """2x3矩陣：橫軸confirmation_status、縱軸remediation_status，純粹由findings既有欄位
    即時計算座標，不是獨立宣稱的嚴重度評分——座標本身不代表CVSS或OWASP等級。"""
    cells = {(r, c): [] for r, _ in RISK_MATRIX_ROWS for c, _ in RISK_MATRIX_COLS}
    for f in data['findings']:
        row_key = f['remediation_status'] if f['remediation_status'] in dict(RISK_MATRIX_ROWS) else 'PENDING_VALIDATION'
        col_key = f['confirmation_status']
        cells.setdefault((row_key, col_key), []).append(f['id'])
    cell_w, cell_h, pad_l, pad_t = 170, 70, 150, 36
    width = pad_l + cell_w * len(RISK_MATRIX_COLS) + 20
    height = pad_t + cell_h * len(RISK_MATRIX_ROWS) + 40
    svg = [f'<svg class="risk-matrix-svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="risk-matrix-title" xmlns="http://www.w3.org/2000/svg">',
           f'<title id="risk-matrix-title">候選風險與發現：確認狀態 × 處置狀態矩陣</title>']
    for ci, (_, clabel) in enumerate(RISK_MATRIX_COLS):
        x = pad_l + ci * cell_w + cell_w / 2
        svg.append(f'<text x="{x}" y="{pad_t - 12}" text-anchor="middle" class="rm-axis">{esc(clabel)}</text>')
    for ri, (_, rlabel) in enumerate(RISK_MATRIX_ROWS):
        y = pad_t + ri * cell_h + cell_h / 2
        svg.append(f'<text x="{pad_l - 12}" y="{y + 4}" text-anchor="end" class="rm-axis">{esc(rlabel)}</text>')
    for ri, (rkey, _) in enumerate(RISK_MATRIX_ROWS):
        for ci, (ckey, _) in enumerate(RISK_MATRIX_COLS):
            x, y = pad_l + ci * cell_w, pad_t + ri * cell_h
            ids = cells.get((rkey, ckey), [])
            fill = '#fcf0e8' if ckey == 'CONFIRMED' else '#faf4df'
            svg.append(f'<rect x="{x}" y="{y}" width="{cell_w - 6}" height="{cell_h - 6}" rx="8" class="rm-cell" style="fill:{fill}"></rect>')
            label_text = '、'.join(i.replace('GEV-', '') for i in ids) if ids else '—'
            svg.append(f'<text x="{x + (cell_w - 6) / 2}" y="{y + (cell_h - 6) / 2 + 5}" text-anchor="middle" class="rm-cell-label">{esc(label_text)}</text>')
    svg.append('</svg>')
    return ('<figure class="risk-matrix"><figcaption><h3>風險矩陣：確認狀態 × 處置狀態</h3>'
            '<p class="qualifier">座標由findings的confirmation_status／remediation_status即時計算，不是獨立的嚴重度評分；'
            '不能取代逐項finding的CVSS／OWASP對應與白話說明。</p></figcaption>' + ''.join(svg) + '</figure>')


def build(data, index):
    source_ids={s['id'] for s in index['sources']}
    for s in index['sources']:
        if not re.fullmatch(r'SRC-\d{3}',s['id']): raise ValueError('Invalid source ID')
        # Only relative links beneath the known workspace directory structure.
        if not s['href'].startswith('../../') or ':' in s['href'] or '\\' in s['href'] or '?' in s['href'] or '#' in s['href']:
            raise ValueError('Unsafe source link')
        if s['href']!='../../'+s['path'] or '..' in Path(s['path']).parts or Path(s['path']).is_absolute():
            raise ValueError('Unsafe source path')
    sections={s['id']:s for s in data['sections']};meta=data['metadata'];excerpts={e['id']:e for e in data['evidence_excerpts']}
    def evidence(eid):
        e=excerpts[eid];payload=e.get('text') if 'text' in e else json.dumps(e['value'],ensure_ascii=False,indent=2)
        loc=e['locator'];position=f'第 {loc["start"]}–{loc["end"]} 行' if loc['kind']=='lines' else loc['pointer']+'（指定欄位）'
        return f'<article class="evidence" id="{esc(eid)}"><h4>{esc(e["label"])}</h4><p class="small">{esc(eid)} · {esc(position)}</p><pre><code>{esc(payload)}</code></pre><p class="qualifier">{esc(e["qualification"])}</p>{refs([e["source_ref"]])}</article>'
    nav=[('executive-summary','管理摘要'),('scope-method','範圍與方法'),('attack-surface','攻擊面'),('findings','安全發現'),('defense-validation','防禦驗證'),('coverage','情境覆蓋'),('remediation','改善與交接'),('appendix','證據附錄')]
    content=[]
    content.append(head('executive-summary','01 / DECISION','管理摘要')+stat_dashboard(data)+risk_matrix(data)+blocks(sections['executive-summary'])+'</section>')
    content.append(head('scope-method','02 / SCOPE','範圍與方法')+blocks(sections['scope-method'])+'</section>')
    diagrams={g['id']:g for g in data.get('diagrams',[])}
    content.append(head('attack-surface','03 / BOUNDARIES','攻擊面與信任邊界')+blocks(sections['attack-surface'])+diagram_figure(diagrams['attack-map'])+'</section>')
    fhtml=head('findings','04 / FINDINGS','安全發現','確認程度、風險等級與處置狀態分開記錄。候選風險不是已確認漏洞。')
    fhtml+=filter_form('finding-list',[('CONFIRMED','已確認'),('NEEDS_VALIDATION','待確認')],'搜尋發現、元件或證據')+'<div id="finding-list">'
    for f in data['findings']:
        q=f['details'];tone='confirmed' if f['confirmation_status']=='CONFIRMED' else 'pending'
        rr=f['risk_rating']
        severity_tag=tag(f'CVSS {rr["cvss"]["score"]}（v{rr["cvss"]["version"]}）','confirmed') if isinstance(rr.get('cvss'),dict) else tag('風險等級待評','pending')
        fhtml+=f'<article class="card filterable" id="{esc(f["id"])}" data-status="{esc(f["confirmation_status"])}"><div class="card-heading"><h3><span class="identifier">{esc(f["id"])}</span>{esc(f["title"])}</h3>{tag(f["confirmation_status"],tone)}</div><div class="tags">{status_tag(f["remediation_status"])}{severity_tag}{tag("責任人待指定")}</div><p>{esc(q["summary"])}</p><div class="risk-note"><strong>分級依據</strong><p>{esc(rr["rationale"])}</p></div>'
        if isinstance(rr.get('cvss'),dict):
            c=rr['cvss']
            fhtml+=f'<p class="qualifier">CVSS向量：<code>{esc(c["vector"])}</code> · 來源：{esc(c["source"])}</p>'
        if f.get('owasp_mapping'):
            fhtml+='<h4>OWASP／CWE 對應</h4><ul>'+''.join(f'<li>{esc(m["framework"])} {esc(m["id"])}：{esc(m["title"])}（{esc(m["role"])}）{"－"+esc(m["note"]) if m.get("note") else ""}</li>' for m in f['owasp_mapping'])+'</ul>'
        if f.get('plain_language'):
            fhtml+=f'<div class="plain-language"><h4>白話說明</h4><p>{esc(f["plain_language"])}</p></div>'
        if f.get('id')=='GEV-F-001':fhtml+=diagram_figure(diagrams['f001-cause'])
        fhtml+='<div class="subgrid"><div><h4>受影響元件</h4>'+ul(q['affected_components'])+'</div><div><h4>成立前提</h4>'+ul(q['preconditions'])+'</div></div>'
        fhtml+='<h4>已證實事實</h4>'+ul(q['established_facts'])+'<h4>既有重現紀錄</h4><p class="qualifier">以下整理歷史觀察，本次未重跑產品。</p>'+ul(q['reproduction']['steps'],True)
        fhtml+='<h4>影響判讀</h4>'+paras(['已觀察：'+q['impact']['demonstrated'],'有條件影響：'+q['impact']['conditional']])+'<p><strong>尚未證明</strong></p>'+ul(q['impact']['not_demonstrated'])
        fhtml+='<h4>證據限制</h4>'+ul(q['limitations'])+'<h4>改善建議</h4>'+ul(q['recommendations'])+'<h4>驗收條件</h4>'+ul(q['acceptance_criteria'])
        if f.get('retest_recommendation'):
            rt=f['retest_recommendation']
            fhtml+=f'<h4>複測建議</h4><p class="qualifier">{esc(rt["condition"])} · {esc(rt["note"])}</p>'
        fhtml+=f'<details open data-fold><summary>查看 {len(q["evidence_ids"])} 段安全證據節錄</summary>'+''.join(evidence(eid) for eid in q['evidence_ids'])+'</details>'+refs(f['source_refs'])+'</article>'
    fhtml+='</div><p id="finding-list-empty" class="no-results" hidden>沒有符合條件的發現；可清除篩選查看全部。</p><h3>其他觀察</h3>'
    for o in data['observations']:
        fhtml+=f'<article class="card" id="{esc(o["id"])}"><span class="identifier">{esc(o["id"])}</span><h3>{esc(o["title"])}</h3><p>{esc(o["summary"])}</p><h4>建議</h4>{ul(o["recommendations"])}<h4>驗收條件</h4>{ul(o["acceptance_criteria"])}<h4>限制</h4>{ul(o["limitations"])}'
        if o['evidence_ids']:fhtml+='<details open data-fold><summary>查看證據節錄</summary>'+''.join(evidence(eid) for eid in o['evidence_ids'])+'</details>'
        fhtml+=refs(o['source_refs'])+'</article>'
    content.append(fhtml+'</section>')
    content.append(head('defense-validation','05 / VALIDATION','防禦驗證','已驗證防護不承襲到未測路由、替身以外的服務或其他部署環境。')+blocks(sections['defense-validation'])+'</section>')
    chtml=head('coverage','06 / COVERAGE','15 情境覆蓋與未完成範圍')+blocks(sections['coverage'])
    chtml+=filter_form('scenario-list',[('PARTIALLY_VERIFIED','部分驗證'),('KNOWN_OPEN_FINDING','含已知未修補缺陷')],'搜尋情境、層級或缺口')+coverage_matrix(data['coverage_matrix'])+'<div id="scenario-list">'
    for s in data['scenarios']:
        chtml+=f'<article class="card filterable" id="{esc(s["id"])}" data-status="{esc(s["assessment_status"])}"><span class="identifier">{esc(s["id"])} / {esc(s["requirement_id"])}</span><h3>{esc(s["title"])}</h3>{tag(s["assessment_status"],"confirmed" if s["id"]=="GEV-07" else "pending")}<p>{esc(s["narrative"]["paragraphs"][0])}</p><h4>已有證據</h4><p>{esc(s["observed_summary"])}</p><h4>尚欠與限制</h4><p>{esc(s["remaining_scope"])}</p><p class="qualifier">證明層級：{esc(" · ".join(s["proof_levels"]))}</p>{refs(s["source_refs"])}</article>'
    content.append(chtml+'</div><p id="scenario-list-empty" class="no-results" hidden>沒有符合條件的情境；可清除篩選查看全部。</p></section>')
    rhtml=head('remediation','07 / HANDOVER','改善與交接')+blocks(sections['remediation'])+diagram_figure(diagrams['improvement-order'])
    for a in data['remediation_actions']:
        rhtml+=f'<article class="card" id="{esc(a["id"])}"><span class="identifier">{esc(a["id"])}</span><h3>{esc(a["title"])}</h3>{tag(a["status"],"pending")}<h4>所需輸入</h4><p>{esc(a["required_input"])}</p><h4>完成條件</h4><p>{esc(a["completion_condition"])}</p><p class="qualifier">責任人與期限待定；本項為交接建議，尚未核准執行。</p>{refs(a["source_refs"])}</article>'
    content.append(rhtml+'</section>')
    ahtml=head('appendix','08 / EVIDENCE','證據附錄','本頁內嵌報告資料及必要安全節錄。完整來源檔未包含在單一 HTML；以下相對連結需保留原資料夾結構才能開啟。')
    qa=data.get('delivery_qa')
    if qa:
        ahtml+='<article id="report-qa" class="callout"><h3>報告介面驗證範圍</h3><p>'+esc(qa['notice'])+'</p>'+''.join('<h4>'+esc(c['name'])+'</h4><p><strong>'+esc(c['status'])+'</strong> · '+esc(c['basis'])+'</p>' for c in qa['checks'])+'</article>'
    ahtml+=blocks(sections['appendix'])
    ahtml+='<h3>術語與判讀規則</h3><dl class="glossary">'+''.join(f'<div><dt>{esc(g["term"])}</dt><dd>{esc(g["definition"])}{refs(g["source_refs"])}</dd></div>' for g in data.get('glossary',[]))+'</dl>'
    ahtml+='<details open data-fold><summary>證明層級英文代碼對照</summary><dl class="glossary">'+''.join(f'<div><dt><code>{esc(g["code"])}</code></dt><dd>{esc(g["definition"])}</dd></div>' for g in data.get('proof_level_definitions',[]))+'</dl></details>'
    ahtml+=evidence_timeline(data['evidence_timeline'])
    ahtml+='<h3>執行與沿用分類</h3>'
    for p in data['evidence_provenance']:
        ahtml+=f'<article class="callout"><strong>{esc(p["task_id"])}</strong> {tag(p["execution_kind"],"teal")}<p>原始執行來源：{esc(p["origin_run"])}</p>{refs(p["refs"])}</article>'
    ahtml+='<h3>採認與勘誤判讀</h3>'+''.join(f'<article><h4>{esc(c["topic"])}</h4><p>{esc(c["resolution"])}</p>{refs(c["refs"])}</article>' for c in data['conflict_decisions'])
    ahtml+='<h3>尚未確認的問題</h3>'+''.join(f'<article><h4>{esc(q["topic"])}</h4><p>{esc(q["note"])}</p>{refs(q["refs"])}</article>' for q in data['unresolved_questions'])
    ahtml+='<h3>評估限制</h3>'+''.join(f'<article><h4>{esc(q["title"])}</h4><p>{esc(q["description"])}</p>{refs(q["source_refs"])}</article>' for q in data['assessment_limitations'])
    ahtml+='<h3>來源索引</h3><p class="qualifier">SHA-256 是完整性雜湊，不是數位簽章。索引記錄報告整理時讀取的版本；歷史檔案中的其他主張仍須套用本報告勘誤與複核限制。</p><div class="source-list">'
    for s in index['sources']:
        loc=s.get('locator');position=f'第 {loc["start"]} 行：{loc["anchor_text"]}' if loc else '完整來源索引；未內嵌全文'
        ahtml+=f'<article class="source-item" id="{esc(s["id"])}"><strong>{esc(s["id"])}</strong><p>{esc(s["summary"])}</p><a href="{esc(s["href"])}">{esc(s["path"])}</a><details open data-fold><summary>完整性與定位</summary><p>{esc(position)}</p><p>大小：{s["size_bytes"]:,} bytes</p><p>SHA-256<br><code>{esc(s["sha256"])}</code></p></details></article>'
    content.append(ahtml+'</div></section>')
    script_hash=base64.b64encode(hashlib.sha256(SCRIPT.encode()).digest()).decode()
    csp=f"default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-{script_hash}'; base-uri 'none'; form-action 'none'; object-src 'none'"
    navhtml=''.join(f'<a href="#{sid}">{esc(t)}</a>' for sid,t in nav)
    fields=[('文件版本',data['document_control']['report_version']),('資料截止',meta['cutoff_label']),('受評 Commit',meta['product_commit']),('產品工作樹','Dirty：保留三份歷史 tracked pyc 刪除'),('執行邊界','原生 macOS · 選項 A · 2 CPU'),('具名風險責任／簽核','待指定；未核准發布')]
    metadt=''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k,v in fields)
    return f'''<!doctype html>
<html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="{esc(csp)}"><meta name="referrer" content="no-referrer"><title>{esc(meta['title'])}｜HTML 交付版</title><style>{STYLE}</style></head>
<body><a href="#main" class="skip">跳至報告主文</a><div class="layout"><aside class="sidebar"><div class="brand">A24</div><p>SECURITY ASSESSMENT</p><p>安全評估報告 · 交付版</p><nav aria-label="報告章節">{navhtml}</nav><button id="print-report" type="button" class="js-only">列印完整報告</button><p class="sidebar-note">局部證據，明確邊界。<br>評估未完成，無發布放行。</p></aside><main id="main" tabindex="-1"><header class="hero"><p class="eyebrow">ASSESSMENT / GOD'S EYE VIEW</p><h1>{esc(meta['title'])}</h1><p class="subtitle">{esc(meta['subtitle'])}</p><div class="status-banner"><strong>評估未完成 · 無發布放行</strong><span>INCOMPLETE — NO RELEASE AUTHORIZATION</span></div><dl class="meta">{metadt}</dl><aside class="callout delivery-note"><strong>報告交付與驗證限制</strong><p>{esc(data.get("delivery_qa",{}).get("notice","報告仍在編製中。"))}</p><a href="#report-qa">查看介面 QA 範圍</a></aside></header><noscript><p class="callout">JavaScript 已停用。全部主文仍可閱讀；證據預設展開，可使用瀏覽器搜尋與列印。</p></noscript><div class="toolbar js-only"><button type="button" data-details-action="open">展開全部證據</button><button type="button" data-details-action="close">收合全部證據</button></div>{''.join(content)}<footer>資料截止：{esc(meta['cutoff_label'])}。風險接受、產品修補與發布決策未由本報告代行。單檔閱讀不代表完整原始證據隨附。</footer></main></div><script id="report-data" type="application/json">{json_text(data)}</script><script id="source-index" type="application/json">{json_text(index)}</script><script>{SCRIPT}</script></body></html>'''

if __name__ == '__main__':
    data=json.loads((HERE/'report-data.json').read_text())
    index=json.loads((HERE/'source-index.json').read_text())
    output=build(data,index)
    (HERE/'index.html').write_text(output,encoding='utf-8')
    print(f'Built index.html ({len(output.encode()):,} bytes); product execution: none.')
