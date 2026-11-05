# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "httpx",
#     "playwright",
# ]
# ///
"""
verify_gev.py — Automated verification script for gods-eye-view containerized instance.
Executed via `uv run verify_gev.py` to ensure complete dependency isolation.
"""

import json
import os
import sys
import time
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:4173"
RESULTS_DIR = Path(__file__).parent / "test-results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def test_api_endpoints() -> dict:
    print("🔍 [1/3] Testing backend proxy and health endpoints...")
    report = {}
    with httpx.Client(base_url=BASE_URL, timeout=20.0) as client:
        # 1. Root HTML
        r_root = client.get("/")
        print(f"  • Root '/' -> status: {r_root.status_code}")
        report["root_html"] = {
            "status": r_root.status_code,
            "csp_header": bool(r_root.headers.get("content-security-policy")),
            "ok": r_root.status_code == 200,
        }

        # 2. Setup status (Provider Settings loopback / gateway check)
        r_setup = client.get("/api/setup/status")
        setup_json = r_setup.json() if r_setup.status_code == 200 else {}
        keys_count = len(setup_json.get("keys", []))
        print(f"  • Provider Settings '/api/setup/status' -> status: {r_setup.status_code}, available provider keys: {keys_count}")
        report["setup_status"] = {
            "status": r_setup.status_code,
            "keys_count": keys_count,
            "store": setup_json.get("store"),
            "ok": r_setup.status_code == 200,
        }

        # 3. Military flights API (Keyless via adsb.lol)
        r_mil = client.get("/api/military")
        mil_data = r_mil.json() if r_mil.status_code == 200 else {}
        ac_count = len(mil_data.get("ac", [])) if isinstance(mil_data, dict) else 0
        print(f"  • Military flights '/api/military' -> status: {r_mil.status_code}, live military aircraft: {ac_count}")
        report["military_flights"] = {
            "status": r_mil.status_code,
            "count": ac_count,
            "sample_callsigns": [item.get("flight", "").strip() for item in mil_data.get("ac", [])[:5]],
            "ok": r_mil.status_code == 200 and ac_count > 0,
        }

        # 4. CCTV catalog & Taiwan MOTC pack
        r_cctv = client.get("/api/cctv/sources")
        cctv_data = r_cctv.json() if r_cctv.status_code == 200 else {}
        trimmed_packs = cctv_data.get("trimmedPacks", [])
        taiwan_pack = next((p for p in trimmed_packs if p.get("pack") == "taiwan"), None)
        total_sources = len(cctv_data.get("sources", []))
        
        taiwan_cameras = [s for s in cctv_data.get("sources", []) if s.get("pack") == "taiwan"]
        sample_tw_cam = taiwan_cameras[0].get("name") if taiwan_cameras else "None"
        
        print(f"  • CCTV sources '/api/cctv/sources' -> status: {r_cctv.status_code}, total served: {total_sources}")
        if taiwan_pack:
            print(f"  • 🇹🇼 Taiwan MOTC CCTV pack -> available: {taiwan_pack.get('available')}, served: {taiwan_pack.get('served')}, sample: '{sample_tw_cam}'")
        report["cctv_sources"] = {
            "status": r_cctv.status_code,
            "total_served": total_sources,
            "taiwan_pack_present": bool(taiwan_pack),
            "taiwan_available": taiwan_pack.get("available") if taiwan_pack else 0,
            "taiwan_served": taiwan_pack.get("served") if taiwan_pack else 0,
            "sample_camera": sample_tw_cam,
            "ok": r_cctv.status_code == 200 and bool(taiwan_pack),
        }

        # 5. Celestrak satellites API (group: stations)
        r_sat = client.get("/api/celestrak/stations")
        sat_text = r_sat.text if r_sat.status_code == 200 else ""
        sat_lines = [line.strip() for line in sat_text.splitlines() if line.strip()]
        sat_count = len(sat_lines) // 3
        print(f"  • Satellites '/api/celestrak/stations' -> status: {r_sat.status_code}, stations TLE count: {sat_count}")
        report["satellites"] = {
            "status": r_sat.status_code,
            "count": sat_count,
            "sample_station": sat_lines[0] if sat_lines else "None",
            "ok": r_sat.status_code == 200 and sat_count > 0,
        }

        # 6. AISStream Vessels API
        r_vessels = client.get("/api/vessels")
        vessels_data = r_vessels.json() if r_vessels.status_code == 200 else {}
        vessels_rows = vessels_data.get("rows", [])
        vessels_status = vessels_data.get("status", "unknown")
        print(f"  • AISStream Vessels '/api/vessels' -> status: {r_vessels.status_code}, live ships: {len(vessels_rows)}, feed: {vessels_status}")
        report["vessels"] = {
            "status": r_vessels.status_code,
            "feed_status": vessels_status,
            "count": len(vessels_rows),
            "sample_ship": vessels_rows[0].get("name") if vessels_rows else "None",
            "ok": r_vessels.status_code == 200 and vessels_status == "live",
        }

    return report


def test_browser_rendering_and_shaders() -> dict:
    print("🌐 [2/3] Testing WebGL 3D Globe, UI interactions and GLSL shaders via Playwright...")
    browser_report = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--enable-webgl", "--use-gl=angle", "--ignore-gpu-blocklist"]
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("  • Navigating to http://127.0.0.1:4173/ ...")
        page.goto(BASE_URL, wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(3000)

        # 1. Capture initial globe view
        screenshot_initial = RESULTS_DIR / "01_initial_globe.png"
        page.screenshot(path=str(screenshot_initial))
        print(f"  • Captured initial globe view -> {screenshot_initial.name}")
        browser_report["initial_screenshot"] = str(screenshot_initial)

        # 2. Check for Cesium canvas
        canvas = page.locator("canvas")
        canvas_count = canvas.count()
        print(f"  • Cesium WebGL canvas detected: {canvas_count > 0}")
        browser_report["canvas_found"] = canvas_count > 0

        # 3. Simulate first-run modal dismissal or 'Esc' to settle UI
        page.keyboard.press("Escape")
        page.wait_for_timeout(1000)

        # 4. Trigger Shader Mode '2' (Surveillance / NVG Night Vision)
        print("  • Testing Shader Hotkey '2' (NVG Night Vision)...")
        page.keyboard.press("Digit2")
        page.wait_for_timeout(2000)
        screenshot_nvg = RESULTS_DIR / "02_shader_nvg.png"
        page.screenshot(path=str(screenshot_nvg))
        print(f"  • Captured NVG Shader view -> {screenshot_nvg.name}")
        browser_report["nvg_screenshot"] = str(screenshot_nvg)

        # 5. Trigger Shader Mode '3' (Thermal / FLIR Ironbow)
        print("  • Testing Shader Hotkey '3' (FLIR Thermal Ironbow)...")
        page.keyboard.press("Digit3")
        page.wait_for_timeout(2000)
        screenshot_flir = RESULTS_DIR / "03_shader_flir.png"
        page.screenshot(path=str(screenshot_flir))
        print(f"  • Captured FLIR Shader view -> {screenshot_flir.name}")
        browser_report["flir_screenshot"] = str(screenshot_flir)

        # 6. Toggle Detection Overlay ('D' key) and Intelligence HUD ('H' key)
        print("  • Testing HUD & Detection hotkeys ('D' & 'H')...")
        page.keyboard.press("KeyD")
        page.keyboard.press("KeyH")
        page.wait_for_timeout(2000)
        screenshot_hud = RESULTS_DIR / "04_hud_detection.png"
        page.screenshot(path=str(screenshot_hud))
        print(f"  • Captured HUD & Detection view -> {screenshot_hud.name}")
        browser_report["hud_screenshot"] = str(screenshot_hud)

        browser.close()

    return browser_report


def check_local_cache_persistence() -> dict:
    print("📁 [3/3] Checking host bind-mount cache and log directories...")
    repo_dir = Path(__file__).parent / "repo"
    cache_dir = repo_dir / ".gev-cache"
    logs_dir = repo_dir / ".gev-logs"

    cache_exists = cache_dir.exists()
    logs_exists = logs_dir.exists()

    cache_files = [f.name for f in cache_dir.iterdir()] if cache_exists else []
    logs_files = [f.name for f in logs_dir.iterdir()] if logs_exists else []

    print(f"  • .gev-cache exists: {cache_exists} (entries: {len(cache_files)})")
    print(f"  • .gev-logs exists: {logs_exists} (entries: {len(logs_files)})")

    return {
        "cache_exists": cache_exists,
        "cache_files_count": len(cache_files),
        "logs_exists": logs_exists,
        "logs_files_count": len(logs_files),
    }


def main():
    print("==================================================")
    print("🚀 gods-eye-view Container Verification Suite")
    print("==================================================")

    api_results = test_api_endpoints()
    browser_results = test_browser_rendering_and_shaders()
    persistence_results = check_local_cache_persistence()

    all_passed = (
        api_results.get("root_html", {}).get("ok", False)
        and api_results.get("setup_status", {}).get("ok", False)
        and api_results.get("military_flights", {}).get("ok", False)
        and api_results.get("cctv_sources", {}).get("ok", False)
        and browser_results.get("canvas_found", False)
    )

    full_report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": BASE_URL,
        "all_passed": all_passed,
        "api_endpoints": api_results,
        "browser_rendering": browser_results,
        "persistence": persistence_results,
    }

    report_path = RESULTS_DIR / "report.json"
    report_path.write_text(json.dumps(full_report, indent=2, ensure_ascii=False))
    print(f"\n{'🎉 All Tests Passed!' if all_passed else '⚠️ Some Tests Failed'}")
    print(f"Full report saved to: {report_path}")
    print("==================================================")


if __name__ == "__main__":
    main()
