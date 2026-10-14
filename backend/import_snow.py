"""Download free snow-removal parking lots (City open data). Best-effort.

Uses the GeoJSON so lots have WGS84 coordinates. Planif-Neige live loading
status is separate and stays behind SNOW_ENABLED until the City token exists.

    python import_snow.py
"""

from __future__ import annotations

import json
import math
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = (
    "https://donnees.montreal.ca/dataset/575ecf37-9097-44cd-817f-a2fbd8de314b"
    "/resource/def63739-6295-4745-97e9-74755ee0bf92/download/stationnements-h-2025-2026.geojson"
)
SOURCE_PAGE = "https://donnees.montreal.ca/dataset/stationnements-deneigement"
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
OUT_PATH = Path(__file__).resolve().parent / "data" / "snow_lots.json"


def _float(value) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(str(value).replace(",", ".").replace(" ", ""))
    except ValueError:
        return None


def mtm8_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """NAD83 MTM zone 8 (EPSG:32188) to WGS84 lat/lng. Good to a few metres on the island."""
    a = 6378137.0
    f = 1 / 298.257222101
    e2 = 2 * f - f * f
    ep2 = e2 / (1 - e2)
    k0 = 0.9999
    lon0 = math.radians(-73.5)
    x = (easting - 304800.0) / k0
    y = northing / k0
    e4 = e2 * e2
    e6 = e4 * e2
    m = y
    mu = m / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    j1 = 3 * e1 / 2 - 27 * e1**3 / 32
    j2 = 21 * e1**2 / 16 - 55 * e1**4 / 32
    j3 = 151 * e1**3 / 96
    j4 = 1097 * e1**4 / 512
    fp = mu + j1 * math.sin(2 * mu) + j2 * math.sin(4 * mu) + j3 * math.sin(6 * mu) + j4 * math.sin(8 * mu)
    sin_fp = math.sin(fp)
    cos_fp = math.cos(fp)
    tan_fp = math.tan(fp)
    c1 = ep2 * cos_fp * cos_fp
    t1 = tan_fp * tan_fp
    r1 = a * (1 - e2) / (1 - e2 * sin_fp * sin_fp) ** 1.5
    n1 = a / math.sqrt(1 - e2 * sin_fp * sin_fp)
    d = x / n1
    lat = fp - (n1 * tan_fp / r1) * (
        d * d / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d**6 / 720
    )
    lng = lon0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d**5 / 120
    ) / cos_fp
    return math.degrees(lat), math.degrees(lng)


def _text(value) -> str:
    text = str(value or "")
    if "Ã" not in text and "â€" not in text:
        return text
    for encoding in ("cp1252", "latin-1"):
        try:
            return text.encode(encoding).decode("utf-8")
        except (UnicodeDecodeError, UnicodeEncodeError):
            continue
    return text


def _is_free(value) -> bool:
    raw = str(value or "").strip().lower()
    return raw in {"0", "0.0", "false", "f", "non", "gratuit", "free"}


def empty_store(reason: str) -> dict:
    return {
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "source_url": SOURCE_URL,
        "source_page": SOURCE_PAGE,
        "license": "CC-BY-4.0",
        "available": False,
        "reason": reason,
        "count": 0,
        "rows": [],
    }


def download() -> dict | None:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": BROWSER_UA})
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        print(f"Snow lots download skipped: {exc}")
        return None
    head = raw[:400].lstrip().lower()
    if head.startswith(b"<!doctype") or head.startswith(b"<html") or b"<html" in head:
        print("Snow lots download returned HTML instead of GeoJSON.")
        return None
    try:
        return json.loads(raw.decode("utf-8-sig"))
    except json.JSONDecodeError:
        print("Snow lots download was not valid JSON.")
        return None


def feature_point(geometry: dict | None) -> tuple[float | None, float | None]:
    if not geometry:
        return None, None
    coords = geometry.get("coordinates")
    gtype = geometry.get("type") or ""
    if gtype == "Point" and isinstance(coords, (list, tuple)) and len(coords) >= 2:
        return float(coords[1]), float(coords[0])
    if isinstance(coords, (list, tuple)) and coords:
        first = coords[0]
        while isinstance(first, (list, tuple)) and first and not isinstance(first[0], (int, float)):
            first = first[0]
        if isinstance(first, (list, tuple)) and len(first) >= 2 and isinstance(first[0], (int, float)):
            return float(first[1]), float(first[0])
    return None, None


def main() -> None:
    payload_in = download()
    if not payload_in:
        payload = empty_store("download_failed")
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote empty snow lots store {OUT_PATH}")
        return

    rows = []
    for feature in payload_in.get("features") or []:
        props = feature.get("properties") or {}
        if not _is_free(props.get("TYPE_PAY") if "TYPE_PAY" in props else props.get("type_pay")):
            continue
        lat, lng = feature_point(feature.get("geometry"))
        if lat is None or lng is None:
            lat = _float(props.get("Latitude") or props.get("latitude"))
            lng = _float(props.get("Longitude") or props.get("longitude"))
        if (lat is None or lng is None) and props.get("X") and props.get("Y"):
            x = _float(props.get("X"))
            y = _float(props.get("Y"))
            if x is not None and y is not None:
                lat, lng = mtm8_to_wgs84(x, y)
        if lat is None or lng is None or abs(lat) > 90 or abs(lng) > 180:
            continue
        if lat == 0 and lng == 0:
            continue
        if not (45.3 <= lat <= 45.8 and -74.2 <= lng <= -73.4):
            continue
        rows.append({
            "id": str(props.get("ID_STA") or props.get("ID") or f"snow:{len(rows)}"),
            "name_fr": _text(props.get("EMPLACEMENT") or ""),
            "name_en": _text(props.get("LOCATION") or props.get("EMPLACEMENT") or ""),
            "hours_fr": _text(props.get("HEURES") or ""),
            "hours_en": _text(props.get("HOURS") or props.get("HEURES") or ""),
            "note_fr": _text(props.get("NOTE_FR") or props.get("Note_FR") or ""),
            "note_en": _text(props.get("NOTE_EN") or props.get("Note_EN") or ""),
            "borough": _text(props.get("ARRONDISSEMENT") or props.get("BOROUGH") or ""),
            "spaces": props.get("NBR_PLA") or "",
            "free": True,
            "lat": lat,
            "lng": lng,
        })

    payload = {
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "source_url": SOURCE_URL,
        "source_page": SOURCE_PAGE,
        "license": "CC-BY-4.0",
        "available": bool(rows),
        "reason": "" if rows else "no_free_lots",
        "count": len(rows),
        "rows": rows,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT_PATH} free_lots={len(rows)}")


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
