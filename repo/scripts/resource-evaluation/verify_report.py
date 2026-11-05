"""Standalone HTML QA at the two requested viewport sizes."""
import datetime
import json
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT.parent
OUT = ROOT / 'docs/resource-evaluation/2026-11-05'
HTML = PROJECT / 'system-resource-evaluation.html'


def main():
    result = {'time': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'file': str(HTML.relative_to(PROJECT)), 'viewports': []}
    hrefs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        result['browser_version'] = browser.version
        for width, height in [(1280, 800), (390, 844)]:
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
            page = context.new_page()
            errors, failed, requests = [], [], []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('requestfailed', lambda r: failed.append(r.url))
            page.on('request', lambda r: requests.append(r.url))
            page.goto(HTML.as_uri(), wait_until='load')
            page.evaluate('document.fonts.ready')
            page.wait_for_timeout(250)
            row = page.evaluate('''()=>({
              width:innerWidth, clientWidth:document.documentElement.clientWidth,
              documentScrollWidth:document.documentElement.scrollWidth,
              bodyScrollWidth:document.body.scrollWidth,
              sections:document.querySelectorAll('section.section-card').length,
              svgCards:document.querySelectorAll('.metric svg').length,
              horizontalOffenders:[...document.querySelectorAll('main *')].filter(e=>{
                const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+.5||r.left<-.5)
              }).slice(0,10).map(e=>({tag:e.tagName,id:e.id,cls:e.getAttribute('class')})),
              clippedText:[...document.querySelectorAll('td,p,h1,h2,h3,pre')].filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth+1).map(e=>e.tagName),
              imageFailures:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),
              tocBroken:[...document.querySelectorAll('.toc a')].filter(a=>!document.querySelector(a.getAttribute('href'))).map(a=>a.hash)
            })''')
            hrefs += page.locator('a[href]').evaluate_all('(els)=>els.map(e=>e.getAttribute("href"))')
            row['errors'] = errors
            row['requestFailures'] = failed
            row['externalRequests'] = [u for u in requests if u.startswith(('http://','https://'))]
            row['viewport'] = f'{width}x{height}'
            full = f'report-{width}-full.png'
            page.screenshot(path=str(OUT/full), full_page=True)
            page.screenshot(path=str(OUT/f'report-{width}-hero.png'))
            for sid in ['architecture', 'hardware']:
                page.locator(f'#{sid}').screenshot(path=str(OUT/f'report-{width}-{sid}.png'), style='.site-nav{visibility:hidden}')
            page.locator('#zoom-architecture').click()
            row['diagramZoomOpened'] = page.locator('#lightbox.open').count() == 1
            row['zoomOverflow'] = page.evaluate('document.documentElement.scrollWidth>innerWidth')
            page.keyboard.press('Escape')
            row['diagramZoomClosed'] = page.locator('#lightbox.open').count() == 0
            page.locator('.scene img').click()
            row['imageZoomOpened'] = page.locator('#lightbox.open').count() == 1
            page.keyboard.press('Escape')
            row['imageZoomClosed'] = page.locator('#lightbox.open').count() == 0
            row['screenshot'] = full
            row['passed'] = (row['clientWidth'] == width == row['documentScrollWidth'] == row['bodyScrollWidth']
                             and not any(row[k] for k in ['horizontalOffenders','clippedText','imageFailures','tocBroken','errors','requestFailures','externalRequests','zoomOverflow'])
                             and row['sections'] == 12 and row['svgCards'] == 4
                             and all(row[k] for k in ['diagramZoomOpened','diagramZoomClosed','imageZoomOpened','imageZoomClosed']))
            result['viewports'].append(row)
            print(f"{row['viewport']}: scroll={row['documentScrollWidth']}/{row['clientWidth']}, errors={len(errors)}, passed={row['passed']}", flush=True)
            context.close()
        browser.close()
    path = OUT/'report-qa.json'
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    missing = []
    for href in set(hrefs):
        parsed = urlparse(href)
        if parsed.scheme or not parsed.path: continue
        if not (PROJECT/unquote(parsed.path)).exists(): missing.append(href)
    result['missingLocalLinks'] = missing
    result['passed'] = not missing and all(r['passed'] for r in result['viewports'])
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    assert result['passed'], json.dumps(result, ensure_ascii=False, indent=2)
    print('PASS: both viewport sizes, local links, inline SVG, images, offline rendering and zoom interactions.')


if __name__ == '__main__':
    main()
