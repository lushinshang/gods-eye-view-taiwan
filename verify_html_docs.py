import asyncio
import os
from playwright.async_api import async_playwright

BASE_DIR = "/Users/lanss/projects/2_Practice/tools/1151104_gods-eye-view"
OUT_DIR = os.path.join(BASE_DIR, "test-results", "html-qa")
os.makedirs(OUT_DIR, exist_ok=True)

HTML_FILES = [
    "readme.html",
    "system-architecture.html",
    "gods-eye-view-summary.html",
    "gods-eye-view-analysis.html"
]

VIEWPORTS = {
    "desktop": {"width": 1280, "height": 800},
    "mobile": {"width": 390, "height": 844, "is_mobile": True}
}

async def check_file(page, filename, mode, vp):
    file_path = f"file://{os.path.join(BASE_DIR, filename)}"
    errors = []
    
    page.on("pageerror", lambda err: errors.append(f"PageError: {err.message}"))
    page.on("console", lambda msg: errors.append(f"ConsoleError: {msg.text}") if msg.type == "error" else None)
    
    await page.set_viewport_size({"width": vp["width"], "height": vp["height"]})
    await page.goto(file_path, wait_until="networkidle")
    
    # 等待 Mermaid 渲染完成（若有）
    await page.wait_for_timeout(1000)
    
    # 檢查橫向捲軸溢出
    overflow_info = await page.evaluate('''() => {
        const docElem = document.documentElement;
        const body = document.body;
        const scrollW = Math.max(docElem.scrollWidth, body.scrollWidth);
        const clientW = docElem.clientWidth;
        
        // 尋找造成橫向溢出的元素
        let overflowingElements = [];
        if (scrollW > clientW) {
            const allElements = document.querySelectorAll('*');
            for (let el of allElements) {
                const rect = el.getBoundingClientRect();
                if (rect.right > clientW + 2) {
                    overflowingElements.push({
                        tag: el.tagName,
                        className: el.className,
                        id: el.id,
                        right: rect.right,
                        width: rect.width
                    });
                }
            }
        }
        return {
            scrollWidth: scrollW,
            clientWidth: clientW,
            hasOverflow: scrollW > clientW,
            overflowingElements: overflowingElements.slice(0, 5)
        };
    }''')
    
    # 截圖存證
    prefix = filename.replace(".html", "")
    screenshot_name = f"{prefix}_{mode}.png"
    screenshot_path = os.path.join(OUT_DIR, screenshot_name)
    await page.screenshot(path=screenshot_path, full_page=True)
    
    return {
        "file": filename,
        "mode": mode,
        "viewport": f"{vp['width']}x{vp['height']}",
        "scrollWidth": overflow_info["scrollWidth"],
        "clientWidth": overflow_info["clientWidth"],
        "hasOverflow": overflow_info["hasOverflow"],
        "overflowing": overflow_info["overflowingElements"],
        "errors": errors,
        "screenshot": screenshot_path
    }

async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()
        
        for filename in HTML_FILES:
            for mode, vp in VIEWPORTS.items():
                print(f"Testing {filename} on {mode} ({vp['width']}x{vp['height']})...")
                res = await check_file(page, filename, mode, vp)
                results.append(res)
                status = "❌ OVERFLOW" if res["hasOverflow"] else "✅ PERFECT"
                print(f"  -> {status}: scrollWidth={res['scrollWidth']}, clientWidth={res['clientWidth']}")
                if res["hasOverflow"]:
                    print(f"     Elements: {res['overflowing']}")
                if res["errors"]:
                    print(f"     Errors: {res['errors']}")
                    
        await browser.close()
        
    print("\n--- Summary ---")
    all_passed = True
    for r in results:
        passed = (not r["hasOverflow"]) and (len(r["errors"]) == 0)
        if not passed: all_passed = False
        mark = "✅" if passed else "❌"
        print(f"{mark} {r['file']} [{r['mode']}]: Scroll {r['scrollWidth']}/{r['clientWidth']} | Errors: {len(r['errors'])}")
        
    if all_passed:
        print("\n🎉 ALL HTML DOCS PASSED MOBILE & DESKTOP ZERO-OVERFLOW VERIFICATION!")
    else:
        print("\n⚠️ SOME CHECKS FAILED. INVESTIGATE ABOVE.")

if __name__ == "__main__":
    asyncio.run(main())
