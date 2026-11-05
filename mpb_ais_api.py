"""MPB AIS API：由 data/fetch_mpb_ais.exe 還原的邏輯改寫（航港局公開 AIS GeoJSON）。

啟動：  uvicorn mpb_ais_api:app --port 8000
端點：
  GET /ships?min_lat=&max_lat=&min_lon=&max_lon=&ship_type=&q=&limit=
      預設範圍 = exe 內的 TARGET_ZONE（台灣周邊）
  GET /ships/{mmsi}
  GET /health
"""
import time
from typing import Optional

import requests
from fastapi import FastAPI, HTTPException, Query

SOURCE_URL = "https://mpbais.motcmpb.gov.tw/aismpb/tools/geojsonais.ashx"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Referer": "https://mpbais.motcmpb.gov.tw/aismpb/",
}
CACHE_TTL = 30  # 秒；與 exe 的 POLL_INTERVAL 相同，避免對來源過度請求
TARGET_ZONE = {"min_lat": 20.45, "max_lat": 25.36, "min_lon": 118.13, "max_lon": 123.22}

app = FastAPI(title="MPB AIS API")
_cache = {"at": 0.0, "ships": []}


def _load():
    if time.time() - _cache["at"] < CACHE_TTL:
        return _cache["ships"]
    try:
        resp = requests.get(SOURCE_URL, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        features = resp.json()["features"]
    except (requests.RequestException, KeyError, ValueError) as exc:
        raise HTTPException(502, f"上游 MPB AIS 失敗：{exc}")
    ships = []
    for f in features:
        p = f.get("properties") or {}
        coords = (f.get("geometry") or {}).get("coordinates") or []
        mmsi = str(p.get("MMSI", "")).strip()
        if len(coords) < 2 or not mmsi:
            continue
        ships.append({
            "mmsi": mmsi,
            "name": str(p.get("ShipName") or "Unknown").strip(),
            "lat": float(coords[1]),
            "lon": float(coords[0]),
            "speed": p.get("SOG"),
            "course": p.get("COG"),
            "ship_type": p.get("Ship_and_Cargo_Type"),
            "nav_status": p.get("Navigational_Status"),
            "imo": p.get("IMO_Number"),
            "call_sign": p.get("Call_Sign"),
            "record_time": p.get("Record_Time"),
        })
    _cache.update(at=time.time(), ships=ships)
    return ships


@app.get("/health")
def health():
    return {"cached_ships": len(_cache["ships"]), "cache_age_s": round(time.time() - _cache["at"], 1)}


@app.get("/ships")
def ships(
    min_lat: float = TARGET_ZONE["min_lat"], max_lat: float = TARGET_ZONE["max_lat"],
    min_lon: float = TARGET_ZONE["min_lon"], max_lon: float = TARGET_ZONE["max_lon"],
    ship_type: Optional[int] = None,
    q: Optional[str] = Query(None, description="船名子字串（不分大小寫）"),
    limit: int = Query(1000, ge=1, le=20000),
):
    out = [
        s for s in _load()
        if min_lat <= s["lat"] <= max_lat and min_lon <= s["lon"] <= max_lon
        and (ship_type is None or s["ship_type"] == ship_type)
        and (q is None or q.lower() in s["name"].lower())
    ]
    return {"count": len(out), "returned": min(len(out), limit), "ships": out[:limit]}


@app.get("/ships/{mmsi}")
def ship(mmsi: str):
    for s in _load():
        if s["mmsi"] == mmsi:
            return s
    raise HTTPException(404, "MMSI 不在目前快照中")
