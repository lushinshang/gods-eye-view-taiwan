"""Build the standalone report from the complete Traditional Chinese Markdown.
Run from any directory: uv run --with markdown --with beautifulsoup4 python <this-file>
"""
from pathlib import Path
import html
import re
import markdown
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT.parent
EVIDENCE = ROOT / 'docs/resource-evaluation/2026-11-05'
MD = ROOT / 'SYSTEM_RESOURCE_EVALUATION.md'

CSS = r'''
:root{--bg:#070d14;--card:rgba(13,23,38,.88);--line:rgba(56,189,248,.26);--text:#e2e8f0;--muted:#a1afc3;--cyan:#00f2fe;--blue:#38bdf8;--green:#2dd4bf;--purple:#c084fc;--orange:#fbbf24;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:90px}body{margin:0;background:radial-gradient(ellipse at 85% 0,rgba(56,189,248,.10),transparent 34%),radial-gradient(ellipse at 5% 18%,rgba(168,85,247,.07),transparent 24%),var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;font-size:16px;line-height:1.78;-webkit-font-smoothing:antialiased}a{color:#7dd3fc;text-underline-offset:4px;overflow-wrap:anywhere}a:hover{color:#cffafe}p,li,td,th{overflow-wrap:anywhere}img,svg{max-width:100%}img{height:auto}button{font:inherit}.top-glow-bar{height:3px;background:linear-gradient(90deg,#a855f7,#00f2fe,#38bdf8,#10b981)}.container{max-width:1140px;margin:auto;padding:0 22px;min-width:0}.site-nav{position:sticky;top:0;z-index:20;background:rgba(10,18,30,.94);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}.nav-wrapper{display:flex;align-items:center;gap:24px;padding-top:12px;padding-bottom:12px;min-width:0}.brand{font-weight:800;font-size:14px;white-space:nowrap;text-decoration:none;color:var(--cyan)}.nav-links{display:flex;gap:7px;overflow-x:auto;min-width:0;scrollbar-width:thin}.nav-links a{white-space:nowrap;font-size:13px;color:var(--muted);text-decoration:none;padding:5px 11px;border-radius:6px}.nav-links a.active{color:var(--cyan);background:rgba(0,242,254,.10);border:1px solid var(--line)}.hero{padding:54px 0 26px;position:relative}.eyebrow{display:flex;gap:10px;align-items:center;color:#7dd3fc;font:12px var(--mono);letter-spacing:.08em}.status-dot{height:7px;width:7px;display:inline-block;border-radius:50%;background:var(--green);box-shadow:0 0 12px #2dd4bf}.hero h1{font-size:clamp(29px,4.1vw,46px);line-height:1.35;letter-spacing:-.015em;margin:20px 0 18px;font-weight:850;text-wrap:balance}.hero h1 span{background:linear-gradient(120deg,#e2e8f0 5%,#38bdf8 65%,#c084fc);background-clip:text;-webkit-text-fill-color:transparent}.lead{color:var(--muted);font-size:17px;max-width:790px;margin:0 0 22px}.meta{display:flex;flex-wrap:wrap;gap:8px}.pill{border:1px solid var(--line);border-radius:5px;padding:5px 10px;font-size:12px;background:rgba(13,23,38,.8);color:#b9c8da}.hero-orbit{position:absolute;right:0;top:22px;opacity:.12;width:260px;pointer-events:none;z-index:-1}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:10px 0 24px}.metric{border:1px solid var(--line);border-radius:12px;background:linear-gradient(150deg,rgba(25,49,72,.8),rgba(10,20,32,.9));padding:15px 17px 14px;min-width:0;box-shadow:0 16px 34px #0003;backdrop-filter:blur(12px)}.metric h2{font-size:13px;font-weight:600;margin:0;color:#becde0}.metric svg{width:100%;height:auto;display:block;overflow:visible}.metric p{font-size:12px;line-height:1.6;color:var(--muted);margin:0}.metric .metric-tag{font:10px var(--mono);color:var(--green);letter-spacing:.08em}.metric-note{font-size:11px;color:var(--muted);margin:-12px 0 20px}.decision{padding:23px 25px;border:1px solid rgba(45,212,191,.35);border-radius:12px;background:linear-gradient(120deg,rgba(45,212,191,.10),rgba(56,189,248,.05));display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;margin-bottom:30px}.decision strong{font-size:20px;color:#d1fae5}.decision p{font-size:14px;color:var(--muted);margin:5px 0 0}.download{display:inline-block;border:1px solid var(--line);background:#142c41;padding:9px 15px;border-radius:6px;white-space:nowrap;text-decoration:none;font-size:13px}.toc{border:1px solid var(--line);background:var(--card);padding:19px 22px;border-radius:12px;margin-bottom:34px}.toc-title{font:11px var(--mono);color:var(--cyan);margin-bottom:12px;letter-spacing:.12em}.toc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 18px}.toc a{font-size:13px;color:var(--muted);text-decoration:none;line-height:1.6}.toc a:hover{color:var(--cyan)}.section-card{padding:30px 28px;background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:26px;box-shadow:0 10px 35px rgba(0,0,0,.22);backdrop-filter:blur(12px);min-width:0}.section-card h2{font-size:24px;line-height:1.5;color:#f1f5f9;margin:0 0 21px;padding-bottom:15px;border-bottom:1px solid var(--line);text-wrap:balance}.section-card h2 .section-no{font:20px var(--mono);color:var(--cyan);margin-right:10px}.section-card h3{font-size:19px;color:#a5e4ff;margin:28px 0 12px}.section-card>p{max-width:880px;margin:17px 0}.section-card>p:first-of-type{margin-top:0}.section-card strong{color:#eef8ff;font-weight:700}.section-card ul,.section-card ol{padding-left:25px;max-width:900px}.section-card li{margin:11px 0;padding-left:4px}.section-card code{font-family:var(--mono);font-size:.86em;color:#a5e4ff;background:rgba(56,189,248,.08);padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}.section-card pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#080f1a;border:1px solid var(--line);border-left:3px solid #38bdf8;border-radius:8px;padding:20px;line-height:1.8;font-size:13px}.section-card pre code{background:none;padding:0;color:#c8d7e9}.table-wrap{margin:22px 0;border:1px solid var(--line);border-radius:8px;min-width:0}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;line-height:1.7}th{text-align:left;color:#7dd3fc;background:rgba(56,189,248,.08);font-weight:600}th,td{padding:13px 15px;vertical-align:top;border-bottom:1px solid rgba(56,189,248,.12)}tbody tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:rgba(56,189,248,.025)}td:first-child{font-weight:550;color:#dbeafe}th:first-child{width:23%}#hardware th:first-child{width:16%}#hardware td:nth-child(3),#hardware th:nth-child(3){background:rgba(45,212,191,.055)}#hardware td:nth-child(3){border-left:1px solid rgba(45,212,191,.15);border-right:1px solid rgba(45,212,191,.15)}blockquote{border-left:2px solid #38bdf8;padding:4px 18px;margin:0 0 25px;color:var(--muted);font-size:13px}figure{margin:24px 0}.diagram{border:1px solid var(--line);border-radius:10px;padding:20px;background:#080f1a}.diagram svg{display:block;width:100%;height:auto}.diagram figcaption,figure.scene figcaption{font-size:12px;color:var(--muted);margin-top:13px}.diagram-head{display:flex;justify-content:space-between;align-items:center;gap:10px;font:11px var(--mono);color:#7dd3fc;margin-bottom:15px}.zoom-button{font-size:12px;background:#183149;color:#c5eaff;border:1px solid var(--line);padding:5px 10px;border-radius:5px;cursor:pointer}.mobile-map{display:none}.scene img{display:block;width:100%;border-radius:8px;border:1px solid var(--line);cursor:zoom-in}.scope-note{background:rgba(168,85,247,.08);border:1px solid rgba(192,132,252,.24);padding:18px 20px;border-radius:8px;font-size:14px;margin:20px 0}.footer{padding:12px 0 50px;color:var(--muted);font-size:12px}.footer-line{height:1px;background:linear-gradient(90deg,var(--line),transparent);margin-bottom:20px}.lightbox{display:none;position:fixed;inset:0;z-index:100;background:rgba(4,9,16,.96);padding:56px 20px 20px;overflow:auto;align-items:center;justify-content:center}.lightbox.open{display:flex}.lightbox img{max-height:86vh;max-width:96vw;object-fit:contain}.lightbox .zoomed-diagram{width:min(1500px,95vw);background:#0d1726;padding:20px;border:1px solid var(--line);border-radius:10px}.lightbox .zoomed-diagram svg{width:100%;height:auto}.lightbox-close{position:fixed;right:20px;top:15px;background:#1b344a;color:#e2e8f0;border:1px solid var(--line);border-radius:5px;padding:7px 13px;cursor:pointer}.qa-status{border:1px solid rgba(45,212,191,.3);background:rgba(45,212,191,.07);border-radius:8px;padding:15px;font-family:var(--mono);font-size:13px;color:#a7f3d0}.page-tools{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.skip-link{position:absolute;top:-80px;left:12px;background:#102d43;color:#fff;padding:8px;z-index:200}.skip-link:focus{top:6px}:focus-visible{outline:2px solid #38bdf8;outline-offset:4px}
@media(max-width:900px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.toc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nav-wrapper{gap:15px}.hero-orbit{width:180px}.hero{padding-top:38px}.decision{grid-template-columns:1fr}.download{justify-self:start}}
@media(max-width:640px){body{font-size:15.5px;line-height:1.8}.container{padding:0 16px}.nav-wrapper{padding-top:10px;padding-bottom:10px;display:block}.brand{font-size:12px;display:block;margin-bottom:5px}.nav-links{gap:3px}.nav-links a{font-size:12px;padding:4px 9px}.hero{padding-top:30px}.hero h1{font-size:29px;line-height:1.45;margin-top:16px}.lead{font-size:15px}.eyebrow{font-size:10px;letter-spacing:.02em}.meta{gap:6px}.pill{font-size:11px;padding:4px 8px}.metrics{gap:10px}.metric{padding:12px 12px 13px}.metric h2{font-size:12px}.metric p{font-size:11.5px}.metric-tag{display:none}.decision{padding:18px;gap:13px}.decision strong{font-size:18px}.toc{padding:16px}.toc-grid{gap:9px 12px}.toc a{font-size:12px}.section-card{padding:22px 17px;margin-bottom:18px;border-radius:10px}.section-card h2{font-size:21px;line-height:1.55}.section-card h2 .section-no{font-size:17px}.section-card h3{font-size:18px}.section-card>p{margin:16px 0}.table-wrap{border:0;margin:20px 0}table,tbody,tr,td{display:block;width:100%}thead{display:none}tbody tr{background:rgba(8,17,29,.5);border:1px solid var(--line);border-radius:8px;margin-bottom:12px;padding:5px 13px}tbody tr:nth-child(even){background:rgba(15,32,49,.5)}td{padding:10px 0;border-bottom:1px solid rgba(56,189,248,.12);font-size:14px}td::before{content:attr(data-label);display:block;color:#7b9ab5;font-size:11px;font-weight:500;margin-bottom:4px}td:first-child{font-size:15px;color:#e2e8f0;font-weight:650}td:first-child::before{color:#7dd3fc}#hardware td:nth-child(3){background:rgba(45,212,191,.06);border-left:0;border-right:0;padding-left:7px;padding-right:7px}.section-card pre{font-size:11.5px;padding:13px;line-height:1.9}.section-card code{font-size:.82em}.diagram{padding:12px}.desktop-map{display:none}.mobile-map{display:block}.diagram-head{font-size:10px}.lightbox .zoomed-diagram{width:100%;padding:6px}.lightbox .zoomed-diagram .desktop-map{display:block}.lightbox .zoomed-diagram .mobile-map{display:none}.section-card ul,.section-card ol{padding-left:20px}.scope-note{padding:15px}.footer{padding-bottom:30px}html{scroll-padding-top:110px}}
.nav-links a.nav-hw{color:#04121c;background:linear-gradient(120deg,#00f2fe,#38bdf8);font-weight:700}.nav-links a.nav-hw:hover{color:#04121c;filter:brightness(1.1)}
.hw-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:16px 0 8px}.hw-card{min-width:0;padding:20px 18px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(160deg,rgba(56,189,248,.10),rgba(13,23,38,.9))}.hw-card.t1{border-color:rgba(45,212,191,.5)}.hw-card.t3{border-color:rgba(192,132,252,.55)}.hw-card h4{margin:0 0 12px;font-size:17px;color:#f1f5f9}.hw-card dl{margin:0}.hw-card dt{font:11px var(--mono);letter-spacing:.08em;color:var(--cyan);margin-top:10px}.hw-card dd{margin:2px 0 0;color:var(--text);font-size:14.5px;line-height:1.6;overflow-wrap:anywhere}
.section-card h4{font-size:16px;line-height:1.6;color:#7dd3fc;margin:24px 0 10px;padding-left:10px;border-left:3px solid var(--cyan)}
@media(max-width:860px){.hw-cards{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{body{background:white;color:#172033}.site-nav,.hero-orbit,.zoom-button,.page-tools{display:none}.section-card{break-inside:auto;background:white;box-shadow:none;border-color:#bcccdc;backdrop-filter:none}.section-card h2,.section-card strong,td:first-child{color:#142c43}.section-card h3,a{color:#075985}.metric,.decision,.toc{background:#eff6ff;color:#172033}.section-card p{color:#172033}th,td{border-color:#cbd5e1}.diagram{background:#0d1726}.footer{color:#334155}}
'''


def metric_svg(value, unit, color, kind):
    symbols = {
        'disk': '<rect x="167" y="14" width="46" height="36" rx="7"/><path d="M168 38h44M175 45h2m7 0h2"/><ellipse cx="190" cy="27" rx="12" ry="6"/>',
        'ram': '<rect x="165" y="19" width="54" height="30" rx="3"/><path d="M174 24v14h10V24zm18 0v14h10V24zM171 49v7m9-7v7m9-7v7m9-7v7m9-7v7"/>',
        'cpu': '<rect x="174" y="16" width="34" height="34" rx="5"/><rect x="183" y="25" width="16" height="16" rx="2"/><path d="M179 10v6m12-6v6m12-6v6M179 50v6m12-6v6m12-6v6M168 21h6m-6 12h6m-6 12h6m34-24h6m-6 12h6m-6 12h6"/>',
        'fps': '<path d="M163 47V20a4 4 0 0 1 4-4h47a4 4 0 0 1 4 4v27zM183 48v7m16-7v7m-22 0h28"/><path d="M169 36h8l5-10 6 15 6-9h17"/>'}
    paths = {'disk':'M2 109L38 109 55 105 80 105 95 100 123 99 145 94 169 92 199 85 236 83', 'ram':'M2 109L40 109 63 106 76 90 100 87 120 78 150 78 175 77 198 76 236 76', 'cpu':'M2 103L35 102 48 95 57 107 74 102 95 98 104 79 114 106 140 102 157 99 164 87 172 103 198 102 216 99 236 102', 'fps':'M2 106L24 100 42 98 59 83 79 82 97 78 115 83 130 77 148 79 168 75 190 78 212 73 236 76'}
    return f'''<svg viewBox="0 0 240 126" role="img" aria-label="{value} {unit}"><defs><linearGradient id="grad-{kind}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="{color}" stop-opacity=".28"/><stop offset="1" stop-color="{color}" stop-opacity="0"/></linearGradient></defs><g stroke="{color}" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{symbols[kind]}</g><text x="0" y="63" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="40" font-weight="700" fill="#f1f5f9">{value}</text><text x="1" y="84" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="13" fill="{color}">{unit}</text><g transform="translate(0,50) scale(1,.6)"><path d="{paths[kind]}L236 126H2Z" fill="url(#grad-{kind})"/><path d="{paths[kind]}" fill="none" stroke="{color}" stroke-width="2.4"/></g><path d="M0 124h240" stroke="{color}" stroke-opacity=".2"/></svg>'''


def mobile_diagram():
    nodes = [(10, 55, '外部資料', '航港局 AIS／高公局路況', ''),
             (105, 80, '服務層 · Docker', 'Node＋Vite API', '船位快取 40 秒／按需刷新'),
             (220, 85, '顯示端 · Chrome＋Cesium', '地球與船舶交給用戶端 GPU', '每個席位各自承擔繪圖負載'),
             (360, 85, '儲存層 · 航跡庫', 'NDJSON：7 天保留政策', 'RAM 索引：最近 24 小時'),
             (500, 85, 'AI 層 · 主機原生 Ollama', 'gemma4:e4b／MLX', '主機 GPU 與統一記憶體')]
    out=['<svg viewBox="0 0 330 610" role="img" aria-label="手機架構圖：外部資料進入 Docker API，分送顯示端、航跡庫與主機 Ollama"><defs><marker id="mobile-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#64748b"/></marker></defs><g fill="none" stroke="#64748b" stroke-width="1.5" marker-end="url(#mobile-arrow)"><path d="M190 65v35"/><path d="M190 185v15H24v60h30"/><path d="M24 260v140h30"/><path d="M24 400v140h30" stroke-dasharray="5 4"/></g>']
    colors=['#38bdf8','#38bdf8','#2dd4bf','#c084fc','#fbbf24']
    for (y,h,title,desc,note),c in zip(nodes,colors):
        out.append(f'<rect x="58" y="{y}" width="260" height="{h}" rx="8" fill="{c}" fill-opacity=".06" stroke="{c}" stroke-opacity=".6"/><g font-family="-apple-system, PingFang TC, Microsoft JhengHei, sans-serif"><text x="73" y="{y+23}" font-size="12" fill="{c}">{title}</text><text x="73" y="{y+45}" font-size="14" fill="#e2e8f0">{desc}</text>')
        if note:out.append(f'<text x="73" y="{y+65}" font-size="11" fill="#a1afc3">{note}</text>')
        out.append('</g>')
    out.append('</svg>')
    return ''.join(out)


def build():
    source = MD.read_text()
    title = source.splitlines()[0][2:]
    body_source = '\n'.join(source.splitlines()[1:])
    diagram = (EVIDENCE/'resource-architecture.svg').read_text()
    diagram = re.sub(r'id="my-svg"', 'id="resource-architecture"', diagram).replace('#my-svg', '#resource-architecture')
    diagram_markup = f'<figure class="diagram"><div class="diagram-head"><span>RESOURCE PLACEMENT · 資源分工</span><button class="zoom-button" type="button" id="zoom-architecture">放大圖表 ↗</button></div><div class="desktop-map">{diagram}</div><div class="mobile-map">{mobile_diagram()}</div><figcaption>實線為主要資料流；虛線為選配 AI。桌機版由 Mermaid 預先渲染，手機版依相同資源分界直式重排。</figcaption></figure>'
    body_source = re.sub(r'```mermaid\n.*?```', lambda _: diagram_markup, body_source, flags=re.S)
    rendered = markdown.markdown(body_source, extensions=['tables', 'fenced_code', 'sane_lists'])
    soup = BeautifulSoup(rendered, 'html.parser')
    for a in soup.select('a[href]'):
        href=a['href']
        if href.startswith(('docs/','server/','src/')):a['href']='repo/'+href
    for im in soup.select('img[src]'):
        if im['src'].startswith('docs/'):im['src']='repo/'+im['src']
    for h3 in soup.select('h3'):
        if h3.get_text().startswith('🚀'):
            tbl=h3.find_next_sibling('table');rows=[[c.get_text(' ',strip=True) for c in tr.select('th,td')] for tr in tbl.select('tr')]
            grid=soup.new_tag('div',attrs={'class':'hw-cards'})
            for i in range(1,4):
                card=soup.new_tag('div',attrs={'class':f'hw-card t{i}'});h4=soup.new_tag('h4');h4.string=rows[0][i];card.append(h4);dl=soup.new_tag('dl')
                for r in rows[1:]:
                    dt=soup.new_tag('dt');dt.string=r[0];dd=soup.new_tag('dd');dd.string=r[i];dl.append(dt);dl.append(dd)
                card.append(dl);grid.append(card)
            tbl.replace_with(grid)
    for table in soup.select('table'):
        headings=[th.get_text(' ',strip=True) for th in table.select('thead th')]
        for tr in table.select('tbody tr'):
            for i,td in enumerate(tr.select('td')):td['data-label']=headings[i]
        wrap=soup.new_tag('div',attrs={'class':'table-wrap'});table.wrap(wrap)
    for im in list(soup.select('img')):
        parent=im.parent
        fig=soup.new_tag('figure',attrs={'class':'scene'})
        im.extract();fig.append(im)
        caption=soup.new_tag('figcaption');caption.string=im.get('alt','');fig.append(caption)
        if parent.name=='p' and not parent.get_text(strip=True):parent.replace_with(fig)
        else:parent.insert_after(fig)
    ids=['decision','method','architecture','storage','container','ollama','browser','network','hardware','portability','handson','evidence']
    sections=[];toc=[];current=None;section_index=0;preface=[]
    for node in list(soup.contents):
        if getattr(node,'name',None)=='h2':
            sid=ids[section_index];section_index+=1
            text=node.get_text();toc.append((sid,text))
            match=re.match(r'(\d+)｜(.*)',text)
            if match:node.clear();num=soup.new_tag('span',attrs={'class':'section-no'});num.string=match[1];node.append(num);node.append(match[2])
            current=soup.new_tag('section',attrs={'class':'section-card','id':sid});sections.append(current);current.append(node.extract())
        elif current is not None:current.append(node.extract())
        else:preface.append(str(node))
    metrics=[]
    for kind,label,value,unit,color,caption,tag in [
        ('disk','磁碟 · Docker Image','1.54','GB / DISK USAGE','#38bdf8','內容大小 433 MB；AI 模型另計','MEASURED / 07:44'),
        ('ram','RAM · 本機 AI 載入','9.42','GB / SHARED MEMORY','#c084fc','約 8.77 GiB；CPU／GPU 共用','MEASURED / INFERENCE'),
        ('cpu','CPU · Node 容器快照','2.80','% / DOCKER CPU','#2dd4bf','容器記憶體 983.7 MiB','MEASURED / 07:44'),
        ('fps','繪圖 · 9,911 艘旋轉','48.2','FPS / 43.13 DRAWS','#fbbf24','接續複測；首輪 41.4 FPS','MEASURED / REPEAT')]:
        metrics.append(f'<div class="metric"><h2>{label}</h2>{metric_svg(value,unit,color,kind)}<p>{caption}</p><span class="metric-tag">{tag}</span></div>')
    navlinks=[('readme.html','發布手冊'),('system-architecture.html','系統架構'),('gods-eye-view-summary.html','演進實錄'),('gods-eye-view-analysis.html','研究報告'),('system-resource-evaluation.html','資源評估')]
    nav='<a class="nav-hw" href="#hardware">🖥️ 硬體規格速查</a>'+''.join(f'<a href="{url}"'+(' class="active" aria-current="page"' if 'resource' in url else '')+f'>{label}</a>' for url,label in navlinks)
    toc_html=''.join(f'<a href="#{sid}">{label}</a>' for sid,label in toc)
    script=r'''<script>
const overlay=document.getElementById('lightbox'),content=overlay.querySelector('.lightbox-content');let lastFocus=null;
function closeBox(){overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');content.replaceChildren();document.body.style.overflow='';if(lastFocus)lastFocus.focus()}
function openBox(element){lastFocus=document.activeElement;content.replaceChildren(element);overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';overlay.querySelector('button').focus()}
document.querySelectorAll('.scene img').forEach(img=>{img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',img.alt+'，點擊放大');function show(){const copy=new Image();copy.src=img.currentSrc||img.src;copy.alt=img.alt;openBox(copy)}img.addEventListener('click',show);img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show()}})});
document.getElementById('zoom-architecture').addEventListener('click',()=>{const copy=document.createElement('div');copy.className='zoomed-diagram';copy.innerHTML=document.querySelector('.diagram .desktop-map').innerHTML;copy.querySelectorAll('[id]').forEach(e=>{const old=e.id,updated='zoom-'+old;copy.innerHTML=copy.innerHTML.replaceAll(old,updated)});openBox(copy)});
overlay.querySelector('button').addEventListener('click',closeBox);overlay.addEventListener('click',e=>{if(e.target===overlay)closeBox()});document.addEventListener('keydown',e=>{if(!overlay.classList.contains('open'))return;if(e.key==='Escape')closeBox();if(e.key==='Tab'){e.preventDefault();overlay.querySelector('button').focus()}});
</script>'''
    page=f'''<!doctype html>
<html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><meta name="description" content="Apple M4 真實環境：近萬艘 AIS、Docker、Ollama MLX 與七天航跡庫的資源實測，以及跨平台三級硬體評估。"><meta name="color-scheme" content="dark"><style>{CSS}</style></head><body id="top"><a class="skip-link" href="#decision">跳至報告內容</a><div class="top-glow-bar"></div><nav class="site-nav" aria-label="系統文件"><div class="container nav-wrapper"><a class="brand" href="readme.html">◉ GOD'S EYE VIEW</a><div class="nav-links">{nav}</div></div></nav><main class="container"><header class="hero"><div class="eyebrow"><span class="status-dot"></span>SYSTEM INTELLIGENCE / RESOURCE AUDIT 2026.11.05</div><h1>全系統資源耗用實測<br><span>跨裝置移植硬體評估</span></h1><p class="lead">上帝之眼（God's Eye View）從近萬艘船舶、3D 地球到本機 AI 的實際負擔。以量測拆開資源邊界，為下一台部署裝置建立可驗收的規格。</p><div class="meta"><span class="pill">Apple M4 · 16 GB</span><span class="pill">Chrome · Metal</span><span class="pill">Docker · Linux ARM64</span><span class="pill">Ollama · MLX / NVFP4</span></div></header><div class="metrics" aria-label="四大實測指標">{''.join(metrics)}</div><p class="metric-note">卡片曲線為視覺示意；實測取樣條件與數據詳列於下文。</p><aside class="decision"><div><strong>同機 3D 戰情台＋本機 AI：32 GB 起評估</strong><p>16 GB 已可執行；推論期間觀察到 swap 增加。MVP、單機與 24/7 情境各自保留不同餘裕。</p></div><a class="download" href="repo/SYSTEM_RESOURCE_EVALUATION.md">閱讀 Markdown 完整版 ↗</a></aside><nav class="toc" aria-label="報告目錄"><div class="toc-title">REPORT INDEX / 12 CHAPTERS</div><div class="toc-grid">{toc_html}</div></nav>{''.join(preface)}{''.join(str(s) for s in sections)}<footer class="footer"><div class="footer-line"></div>GOD'S EYE VIEW · SYSTEM RESOURCE EVALUATION · 2026-11-05<br>實測是本機觀察；容量公式與跨裝置規格另列假設。<div class="page-tools"><a href="#top" onclick="window.scrollTo(0,0);return false">回到頁首 ↑</a><a href="repo/docs/resource-evaluation/2026-11-05/report-qa.json">檢視驗證紀錄</a></div></footer></main><div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="放大圖表" aria-hidden="true"><button class="lightbox-close" type="button">關閉 · Esc</button><div class="lightbox-content"></div></div>{script}</body></html>'''
    (PROJECT/'system-resource-evaluation.html').write_text(page)
    print(f'Built {PROJECT / "system-resource-evaluation.html"}; {len(sections)} sections; {len(page):,} characters')


if __name__ == '__main__':
    build()
