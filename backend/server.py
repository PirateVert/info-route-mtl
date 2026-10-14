"""Info-Route MTL API. Reads stores written by import_roadwork.py and import_avis.py."""

from __future__ import annotations

import json
import math
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent


def _load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env(ROOT / ".env")

STORE_PATH = ROOT / "data" / "roadwork.json"
AVIS_PATH = ROOT / "data" / "avis.json"
FRONTEND_BUILD = ROOT.parent / "frontend" / "build"
BOROUGH_FIELD = "boroughid"
MHM = "Mercier-Hochelaga-Maisonneuve"
ROADWORK_PAGE = "https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d"
AVIS_PAGE = "https://donnees.montreal.ca/dataset/avis-alertes"
AVIS_HUMAN_URL = "https://montreal.ca/avis-et-alertes"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
DAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
NOMINATIM_UA = "Info-Route MTL/1.0 (citizen roadwork map; Montreal)"
NEARBY_RADIUS_M = 500
# Coordinate search starts at 500 m. If nothing is found, expand once so a
# visitor standing just outside a cluster still sees nearby work.
NEARBY_FALLBACK_RADIUS_M = 1000
STOP_WORDS = {
    "rue", "street", "avenue", "ave", "av", "boul", "boulevard", "blvd",
    "chemin", "ch", "place", "pl", "de", "du", "des", "la", "le", "les",
    "et", "entre", "sur", "a", "au", "aux", "montreal", "qc", "quebec",
    "nord", "sud", "est", "ouest",
}

app = FastAPI(title="Info-Route MTL", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

_cache: dict = {"mtime": None, "data": None}
_avis_cache: dict = {"mtime": None, "data": None}
_geocode_cache: dict[str, dict | None] = {}


def load_store() -> dict:
    if not STORE_PATH.is_file():
        raise HTTPException(
            status_code=503,
            detail="Roadwork data is missing. Run: python import_roadwork.py",
        )
    mtime = STORE_PATH.stat().st_mtime
    if _cache["mtime"] != mtime:
        _cache["data"] = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        _cache["mtime"] = mtime
    return _cache["data"]


def load_avis_store() -> dict:
    empty = {
        "imported_at": None,
        "source_url": None,
        "source_page": AVIS_PAGE,
        "human_url": AVIS_HUMAN_URL,
        "license": "CC-BY-4.0",
        "types": ["Circulation et transport", "Stationnement"],
        "count": 0,
        "note": (
            "Official City notices that can close a street or parking. "
            "Not a complete inventory of events or demonstrations."
        ),
        "rows": [],
    }
    if not AVIS_PATH.is_file():
        return empty
    mtime = AVIS_PATH.stat().st_mtime
    if _avis_cache["mtime"] != mtime:
        _avis_cache["data"] = json.loads(AVIS_PATH.read_text(encoding="utf-8"))
        _avis_cache["mtime"] = mtime
    return _avis_cache["data"] or empty


def _float(value: str | None) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"t", "true", "1", "yes", "vrai"}


def project(row: dict) -> dict:
    return {
        "id": row.get("id") or "",
        "kind": "work",
        "borough": row.get(BOROUGH_FIELD) or "",
        "street": row.get("occupancy_name") or "",
        "reason": row.get("reason_category") or "",
        "organization": row.get("organizationname") or "",
        "submitter": row.get("submittercategory") or "",
        "status": row.get("currentstatus") or "",
        "start": row.get("duration_start_date") or "",
        "end": row.get("duration_end_date") or "",
        "lat": _float(row.get("latitude")),
        "lng": _float(row.get("longitude")),
        "active_days": [
            day for day in DAY_CODES if _truthy(row.get(f"duration_days_{day}_active"))
        ],
    }


def project_avis(row: dict) -> dict:
    title = row.get("titre") or ""
    lat = row.get("lat")
    lng = row.get("lng")
    return {
        "id": row.get("id") or "",
        "kind": "avis",
        "title": title,
        "street": title,
        "borough": row.get("borough") or "",
        "type": row.get("type") or "",
        "publisher": row.get("service_publieur") or "",
        "start": row.get("date_debut") or "",
        "end": row.get("date_fin") or "",
        "url": row.get("lien") or "",
        "lat": lat if isinstance(lat, (int, float)) else _float(lat),
        "lng": lng if isinstance(lng, (int, float)) else _float(lng),
        "geometry": row.get("geometry_type") or "",
    }


def all_works() -> list[dict]:
    return [project(row) for row in load_store().get("rows", [])]


def all_avis() -> list[dict]:
    return [project_avis(row) for row in load_avis_store().get("rows", [])]


def fold(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text or "")
    without = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without.lower()


def street_tokens(query: str) -> list[str]:
    parts = re.findall(r"[a-z0-9]+", fold(query))
    return [part for part in parts if part not in STOP_WORDS and not part.isdigit() and len(part) > 2]


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def in_montreal(lat: float, lng: float) -> bool:
    return 45.40 <= lat <= 45.72 and -73.98 <= lng <= -73.47


def parse_coord_pair(text: str) -> dict | None:
    """Parse 'lat,lng' and accept the point only if it is in Montreal."""
    parts = [part.strip() for part in (text or "").split(",")]
    if len(parts) != 2:
        return None
    try:
        lat = float(parts[0])
        lng = float(parts[1])
    except ValueError:
        return None
    if not in_montreal(lat, lng):
        return None
    return {"lat": lat, "lng": lng}


def geocode(query: str) -> dict | None:
    key = fold(query)
    if key in _geocode_cache:
        return _geocode_cache[key]

    looked_up = query if "montr" in key else f"{query}, Montréal, Québec"
    params = urllib.parse.urlencode(
        {
            "q": looked_up,
            "format": "jsonv2",
            "limit": 1,
            "countrycodes": "ca",
            "viewbox": "-74.05,45.72,-73.45,45.40",
            "bounded": 0,
        }
    )
    request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={
            "User-Agent": NOMINATIM_UA,
            "Accept-Language": "fr,en",
        },
    )
    place = None
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload:
            lat = float(payload[0]["lat"])
            lng = float(payload[0]["lon"])
            if in_montreal(lat, lng):
                place = {
                    "label": payload[0].get("display_name") or looked_up,
                    "lat": lat,
                    "lng": lng,
                }
    except Exception:
        place = None

    _geocode_cache[key] = place
    return place


def with_distance(work: dict, place: dict | None) -> dict:
    item = dict(work)
    if place and work["lat"] is not None and work["lng"] is not None:
        item["distance_m"] = round(haversine(place["lat"], place["lng"], work["lat"], work["lng"]))
    else:
        item["distance_m"] = None
    return item


def search_works(place: dict | None, tokens: list[str], radius_m: float) -> list[dict]:
    results: dict[str, dict] = {}
    for work in [*all_works(), *all_avis()]:
        street_hit = False
        if tokens:
            folded_street = fold(work.get("street") or work.get("title") or "")
            street_hit = all(token in folded_street for token in tokens)

        nearby_hit = False
        if place and work["lat"] is not None and work["lng"] is not None:
            distance = haversine(place["lat"], place["lng"], work["lat"], work["lng"])
            nearby_hit = distance <= radius_m

        if not street_hit and not nearby_hit:
            continue

        item = with_distance(work, place)
        item["match"] = "street" if street_hit else "nearby"
        results[work["id"]] = item

    return sorted(
        results.values(),
        key=lambda item: (
            item["distance_m"] is None,
            item["distance_m"] if item["distance_m"] is not None else 10**9,
            item.get("street") or item.get("title") or "",
        ),
    )


@app.get("/api")
@app.get("/api/")
def health():
    store_ok = STORE_PATH.is_file()
    return {
        "ok": True,
        "service": "info-route-mtl",
        "data_ready": store_ok,
        "avis_ready": AVIS_PATH.is_file(),
    }


@app.get("/api/meta")
def meta():
    store = load_store()
    avis = load_avis_store()
    counts = Counter((row.get(BOROUGH_FIELD) or "") for row in store.get("rows", []))
    boroughs = [
        {"name": name, "count": count}
        for name, count in sorted(counts.items(), key=lambda item: item[0])
        if name
    ]
    avis_meta = {
        "imported_at": avis.get("imported_at"),
        "count": avis.get("count", 0),
        "source_url": avis.get("source_url"),
        "source_page": avis.get("source_page", AVIS_PAGE),
        "human_url": avis.get("human_url", AVIS_HUMAN_URL),
        "license": avis.get("license", "CC-BY-4.0"),
        "license_url": LICENSE_URL,
        "types": avis.get("types") or ["Circulation et transport", "Stationnement"],
        "note": avis.get("note"),
    }
    return {
        "imported_at": store.get("imported_at"),
        "count": store.get("count", 0),
        "borough_field": store.get("borough_field", BOROUGH_FIELD),
        "default_borough": MHM,
        "boroughs": boroughs,
        "source_url": store.get("source_url"),
        "license": store.get("license", "CC-BY-4.0"),
        "license_url": LICENSE_URL,
        "attribution": "Ville de Montréal",
        "avis": avis_meta,
        "sources": [
            {
                "id": "roadwork",
                "name": "Entraves et travaux en cours",
                "url": store.get("source_url"),
                "page": ROADWORK_PAGE,
                "license": store.get("license", "CC-BY-4.0"),
                "license_url": LICENSE_URL,
                "attribution": "Ville de Montréal",
                "imported_at": store.get("imported_at"),
                "count": store.get("count", 0),
            },
            {
                "id": "avis",
                "name": "Avis et alertes",
                "url": avis_meta["source_url"],
                "page": avis_meta["source_page"],
                "human_url": avis_meta["human_url"],
                "license": avis_meta["license"],
                "license_url": LICENSE_URL,
                "attribution": "Ville de Montréal",
                "imported_at": avis_meta["imported_at"],
                "count": avis_meta["count"],
                "note": avis_meta["note"],
            },
        ],
    }


@app.get("/api/avis")
def avis(borough: str | None = None):
    rows = all_avis()
    if borough:
        rows = [row for row in rows if row["borough"] == borough]
    store = load_avis_store()
    return {
        "count": len(rows),
        "borough": borough or "",
        "imported_at": store.get("imported_at"),
        "source_page": store.get("source_page", AVIS_PAGE),
        "human_url": store.get("human_url", AVIS_HUMAN_URL),
        "license": store.get("license", "CC-BY-4.0"),
        "types": store.get("types") or ["Circulation et transport", "Stationnement"],
        "note": store.get("note"),
        "avis": rows,
    }


@app.get("/api/works")
def works(borough: str | None = None):
    rows = all_works()
    if borough:
        rows = [row for row in rows if row["borough"] == borough]
    return {
        "count": len(rows),
        "borough_field": BOROUGH_FIELD,
        "borough": borough or "",
        "works": rows,
    }


@app.get("/api/search")
def search(
    q: str | None = Query(None, max_length=200),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
):
    query = (q or "").strip()
    from_coords = lat is not None or lng is not None
    place = None
    tokens: list[str] = []
    radius_m = NEARBY_RADIUS_M

    if from_coords:
        if lat is None or lng is None:
            raise HTTPException(status_code=400, detail="bad_coords")
        if not in_montreal(lat, lng):
            raise HTTPException(status_code=400, detail="outside_montreal")
        place = {
            "label": query,
            "lat": lat,
            "lng": lng,
            "source": "coords",
        }
    elif query:
        place = geocode(query)
        tokens = street_tokens(query)
    else:
        raise HTTPException(status_code=400, detail="Empty query")

    ordered = search_works(place, tokens, radius_m)
    if from_coords and not ordered:
        radius_m = NEARBY_FALLBACK_RADIUS_M
        ordered = search_works(place, tokens, radius_m)

    return {
        "query": query,
        "place": place,
        "radius_m": radius_m,
        "count": len(ordered[:40]),
        "results": ordered[:40],
    }


def _safe_build_file(full_path: str) -> Path | None:
    root = FRONTEND_BUILD.resolve()
    target = (root / full_path).resolve() if full_path else root / "index.html"
    try:
        target.relative_to(root)
    except ValueError:
        return None
    if full_path and target.is_file():
        return target
    index = root / "index.html"
    return index if index.is_file() else None


from subscriptions import ensure_snapshot, router as subscribe_router

app.include_router(subscribe_router)
ensure_snapshot()


if FRONTEND_BUILD.is_dir():
    static_assets = FRONTEND_BUILD / "static"
    if static_assets.is_dir():
        app.mount("/static", StaticFiles(directory=static_assets), name="frontend-static")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        target = _safe_build_file(full_path)
        if target is None:
            raise HTTPException(status_code=404, detail="Not found")
        if target.name != "index.html":
            return FileResponse(target)
        return HTMLResponse(target.read_text(encoding="utf-8"))
