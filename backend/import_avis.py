"""Download City of Montreal avis/alertes and keep circulation and parking notices.

The open-data CSV has titles and links but no coordinates. The GeoJSON has the
same fields plus geometry, so this script downloads that file. The server
refuses downloads that do not look like a browser, so a normal User-Agent is
always sent.

Only notices typed Circulation et transport or Stationnement are stored. Those
are official city notices that can close a street or parking — not a complete
list of demonstrations, parties, or other events.

Run once a day, after or beside the roadwork import:

    python import_avis.py
"""

from __future__ import annotations

import json
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = (
    "https://donnees.montreal.ca/dataset/556c84af-aebf-4ca9-9a9c-2f246601674c"
    "/resource/d249e452-46f5-422f-91ae-898c98eea6cc/download/avis-alertes.geojson"
)
SOURCE_PAGE = "https://donnees.montreal.ca/dataset/avis-alertes"
HUMAN_URL = "https://montreal.ca/avis-et-alertes"
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
KEEP_TYPES = ("Circulation et transport", "Stationnement")
MHM = "Mercier-Hochelaga-Maisonneuve"
OUT_PATH = Path(__file__).resolve().parent / "data" / "avis.json"
# Island of Montreal, including Pointe-aux-Trembles. Dummy GeoJSON points at
# 0,0 (Null Island, Gulf of Guinea) are stored as missing coordinates.
LAT_MIN, LAT_MAX = 45.40, 45.72
LNG_MIN, LNG_MAX = -73.99, -73.45

# service_publieur is the city communications service, not the borough. Titles
# usually name the borough; match those names onto the roadwork boroughid values.
BOROUGH_NEEDLES = (
    ("Ahuntsic-Cartierville", "Ahuntsic-Cartierville"),
    ("Anjou", "Anjou"),
    ("Côte-des-Neiges-Notre-Dame-de-Grâce", "Côte-des-Neiges-Notre-Dame-de-Grâce"),
    ("Côte-des-Neiges", "Côte-des-Neiges-Notre-Dame-de-Grâce"),
    ("Notre-Dame-de-Grâce", "Côte-des-Neiges-Notre-Dame-de-Grâce"),
    ("L'Île-Bizard-Sainte-Geneviève", "L'Île-Bizard-Sainte-Geneviève"),
    ("Île-Bizard", "L'Île-Bizard-Sainte-Geneviève"),
    ("LaSalle", "LaSalle"),
    ("Lachine", "Lachine"),
    ("Le Plateau-Mont-Royal", "Le Plateau-Mont-Royal"),
    ("Plateau-Mont-Royal", "Le Plateau-Mont-Royal"),
    ("Le Sud-Ouest", "Le Sud-Ouest"),
    ("Sud-Ouest", "Le Sud-Ouest"),
    ("Mercier-Hochelaga-Maisonneuve", MHM),
    ("Hochelaga-Maisonneuve", MHM),
    ("Outremont", "Outremont"),
    ("Pierrefonds-Roxboro", "Pierrefonds-Roxboro"),
    ("Rivière-des-Prairies-Pointe-aux-Trembles", "Rivière-des-Prairies-Pointe-aux-Trembles"),
    ("Rivière-des-Prairies", "Rivière-des-Prairies-Pointe-aux-Trembles"),
    ("Pointe-aux-Trembles", "Rivière-des-Prairies-Pointe-aux-Trembles"),
    ("Rosemont-La Petite-Patrie", "Rosemont-La Petite-Patrie"),
    ("Petite-Patrie", "Rosemont-La Petite-Patrie"),
    ("Rosemont", "Rosemont-La Petite-Patrie"),
    ("Saint-Léonard", "Saint-Léonard"),
    ("Saint-Laurent", "St-Laurent"),
    ("St-Laurent", "St-Laurent"),
    ("Montréal-Nord", "Montréal-Nord"),
    ("Verdun", "Verdun"),
    ("Ville-Marie", "Ville-Marie"),
    ("Villeray-Saint-Michel-Parc-Extension", "Villeray-Saint-Michel-Parc-Extension"),
    ("Parc-Extension", "Villeray-Saint-Michel-Parc-Extension"),
    ("Villeray", "Villeray-Saint-Michel-Parc-Extension"),
    ("Saint-Michel", "Villeray-Saint-Michel-Parc-Extension"),
)


def fold_key(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text or "")
    without = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without.lower().replace("'", "").replace("’", "").replace("–", "-").replace("—", "-")


def extract_borough(titre: str) -> str:
    key = fold_key(titre)
    best = ""
    best_len = 0
    for needle, official in BOROUGH_NEEDLES:
        folded = fold_key(needle)
        if folded in key and len(folded) > best_len:
            best = official
            best_len = len(folded)
    return best


def first_pair(coords):
    if not coords:
        return None
    if isinstance(coords[0], (int, float)):
        return coords
    return first_pair(coords[0])


def valid_island_point(lat: float | None, lng: float | None) -> bool:
    if lat is None or lng is None:
        return False
    if lat == 0 and lng == 0:
        return False
    return LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX


def representative_point(geometry: dict | None) -> tuple[float | None, float | None]:
    if not geometry:
        return None, None
    coords = geometry.get("coordinates")
    gtype = geometry.get("type") or ""
    if gtype == "Point" and isinstance(coords, (list, tuple)) and len(coords) >= 2:
        return float(coords[1]), float(coords[0])
    if gtype == "LineString" and coords:
        mid = coords[len(coords) // 2]
        return float(mid[1]), float(mid[0])
    if gtype in {"Polygon", "MultiLineString", "MultiPolygon"} and coords:
        ring = coords[0]
        if gtype == "MultiPolygon" and ring:
            ring = ring[0]
        if ring and not isinstance(ring[0], (int, float)):
            xs = [pair[0] for pair in ring if isinstance(pair, (list, tuple)) and len(pair) >= 2]
            ys = [pair[1] for pair in ring if isinstance(pair, (list, tuple)) and len(pair) >= 2]
            if xs:
                return sum(ys) / len(ys), sum(xs) / len(xs)
    pair = first_pair(coords)
    if pair and len(pair) >= 2:
        return float(pair[1]), float(pair[0])
    return None, None


def avis_id(lien: str, index: int) -> str:
    slug = (lien or "").rstrip("/").rsplit("/", 1)[-1]
    return f"avis:{slug}" if slug else f"avis:{index}"


def download_geojson() -> dict:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": BROWSER_UA})
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"Download failed with HTTP {exc.code}. A browser User-Agent is required.") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Download failed: {exc.reason}") from exc

    head = raw[:400].lstrip().lower()
    if head.startswith(b"<!doctype") or head.startswith(b"<html") or b"<html" in head:
        raise SystemExit("The server returned a web page instead of the GeoJSON. Check the User-Agent header.")

    try:
        data = json.loads(raw.decode("utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise SystemExit("The download was not valid GeoJSON.") from exc
    if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise SystemExit("Expected a GeoJSON FeatureCollection.")
    return data


def project_feature(feature: dict, index: int) -> dict | None:
    props = feature.get("properties") or {}
    notice_type = (props.get("type") or "").strip()
    if notice_type not in KEEP_TYPES:
        return None
    geometry = feature.get("geometry") or {}
    lat, lng = representative_point(geometry)
    if not valid_island_point(lat, lng):
        lat, lng = None, None
    titre = (props.get("titre") or "").strip()
    lien = (props.get("lien") or "").strip()
    return {
        "id": avis_id(lien, index),
        "titre": titre,
        "date_debut": (props.get("date_debut") or "").strip(),
        "date_fin": (props.get("date_fin") or "").strip(),
        "type": notice_type,
        "service_publieur": (props.get("service_publieur") or "").strip(),
        "lien": lien,
        "borough": extract_borough(titre),
        "lat": lat,
        "lng": lng,
        "geometry_type": geometry.get("type") or "",
    }


def main() -> None:
    collection = download_geojson()
    rows = []
    for index, feature in enumerate(collection.get("features") or []):
        if not isinstance(feature, dict):
            continue
        row = project_feature(feature, index)
        if row:
            rows.append(row)

    if not rows:
        raise SystemExit("No circulation or parking notices were found in the GeoJSON.")

    payload = {
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "source_url": SOURCE_URL,
        "source_page": SOURCE_PAGE,
        "human_url": HUMAN_URL,
        "license": "CC-BY-4.0",
        "types": list(KEEP_TYPES),
        "count": len(rows),
        "note": (
            "Official City notices that can close a street or parking. "
            "Not a complete inventory of events or demonstrations."
        ),
        "rows": rows,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    typed = {name: sum(1 for row in rows if row["type"] == name) for name in KEEP_TYPES}
    located = sum(1 for row in rows if row["lat"] is not None and row["lng"] is not None)
    mhm = sum(1 for row in rows if row["borough"] == MHM)
    print(f"Wrote {OUT_PATH}")
    print(
        f"rows={len(rows)} circulation={typed['Circulation et transport']} "
        f"parking={typed['Stationnement']} with_coords={located} mhm={mhm}"
    )


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
