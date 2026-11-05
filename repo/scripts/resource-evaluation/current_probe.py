"""Repeat the live Cesium probe without overwriting the first capture."""
import datetime
import json
import time
from playwright.sync_api import sync_playwright
from browser import INIT, MEASURE
from host import OUT


def main():
    result = {"time": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "scenarios": [], "errors": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=False, args=[
            "--enable-precise-memory-info", "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding"])
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        page = context.new_page()
        page.add_init_script(INIT)
        page.on("pageerror", lambda e: result["errors"].append(str(e)))
        cdp = context.new_cdp_session(page)
        cdp.send("Network.enable")
        completed = []
        cdp.on("Network.loadingFinished", lambda e: completed.append(e["encodedDataLength"]))
        start = time.monotonic()
        page.goto("http://localhost:4173/?welcome=0", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_function("""async()=>{const m=(await import('/src/layers/taiwanVessels/taiwanManager.js')).taiwanVesselsManager;window.__manager=m;return !!m.viewer&&m.vessels.length>=9000}""", timeout=90000)
        page.wait_for_timeout(12000)
        snapshot_count = page.evaluate("""()=>{const m=window.__manager;clearInterval(m.pollTimer);m.pollTimer=null;window.__liveRows=JSON.parse(JSON.stringify(m.vessels));return window.__liveRows.length}""")
        assert snapshot_count >= 9000, f"Insufficient live snapshot: {snapshot_count}"
        result["cold_load"] = {"wallToSettledSeconds": time.monotonic()-start,
                               "cdpTransferredBytes": sum(completed), "completedRequests": len(completed)}
        result["browser_version"] = browser.version
        for label, moving, count in [("live_static", False, None), ("live_moving", True, None),
                                      ("9000_static", False, 9000), ("9000_moving", True, 9000)]:
            page.evaluate("""count=>{const m=window.__manager;if(count){m.vessels=window.__liveRows.slice(0,count);m.syncBillboards();m.recomputeStats();m.notify()};m.viewer.camera.cancelFlight();m.viewer.camera.setView({destination:m.viewer.camera.position.constructor.fromDegrees(121,23.6,800000),orientation:{heading:0,pitch:-Math.PI/2,roll:0}});m.viewer.scene.requestRender()}""", count)
            page.wait_for_timeout(3000)
            d = page.evaluate(MEASURE, {"seconds": 15, "moving": moving})
            assert d["vessels"] == (count or snapshot_count), "Vessel population changed during capture"
            d["label"] = label
            d["cdpDOM"] = cdp.send("Memory.getDOMCounters")
            d["cdpHeap"] = cdp.send("Runtime.getHeapUsage")
            result["scenarios"].append(d)
            (OUT/"current-browser.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
            print(json.dumps({k:d[k] for k in ["label", "vessels", "actualRenderFPS", "drawsPerFrame", "drawsPerFrameP95", "heap", "domElements", "renderer"]}), flush=True)
        page.screenshot(path=str(OUT/"taiwan-current.png"))
        browser.close()


if __name__ == "__main__":
    main()
