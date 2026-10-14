"""Download Québec 511 / MTQ Travaux routiers and keep Montréal island + approaches.

The WFS is province-wide. This script keeps highway, tunnel, and bridge lane
closures on or next to the island (Ville-Marie/Viger, A-15, A-25 La Fontaine,
Honoré-Mercier, Saint-Urbain, and similar approaches). It is not local streets —
those stay on the City roadwork and avis layers.

The MapServer sometimes refuses downloads that do not look like a browser, so a
normal User-Agent is always sent.

Run once a day, after or beside the other imports:

    python import_mtq.py
"""

from __future__ import annotations

import json
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib import error as urllib_error
from urllib import request as urllib_request

SOURCE_URL = (
    "https://ws.mapserver.transports.gouv.qc.ca/swtq"
    "?service=wfs&version=2.0.0&request=getfeature"
    "&typename=ms:chantiers_mtmdet&outfile=TravauxRoutiers"
    "&srsname=EPSG:4326&outputformat=geojson"
)
SOURCE_PAGE = "https://www.donneesquebec.ca/recherche/dataset/travaux-routiers"
HUMAN_URL = "https://www.quebec511.info"
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
OUT_PATH = Path(__file__).resolve().parent / "data" / "mtq.json"
MHM = "Mercier-Hochelaga-Maisonneuve"

# Island plus a short buffer for bridge and tunnel approaches.
LAT_MIN, LAT_MAX = 45.38, 45.73
LNG_MIN, LNG_MAX = -74.05, -73.45

AUTOROUTES = {
    "10", "13", "15", "19", "20", "25", "30", "40", "50", "55",
    "136", "440", "520", "540", "640", "720",
}
ISLAND_TEXT = (
    "montreal", "senneville", "dorval", "kirkland", "lachine", "lasalle",
    "verdun", "saint-laurent", "st-laurent", "ville-marie", "viger",
    "la fontaine", "souligny", "saint-urbain", "ile-aux-tourtes",
    "honore-mercier", "decarie", "metropolitaine", "ile des soeurs",
    "nuns island", "pont victoria", "pont champlain",
)

BOROUGH_NEEDLES = (
    ("Ahuntsic-Cartierville", "Ahuntsic-Cartierville"),
    ("Anjou", "Anjou"),
    ("Côte-des-Neiges-Notre-Dame-de-Grâce", "Côte-des-Neiges-Notre-Dame-de-Grâce"),
    ("Côte-des-Neiges", "Côte-des-Neiges-Notre-Dame-de-Grâce"),
    ("Notre-Dame-de-Grâce", "Côte-des-Neiges-Notre-Dame-de-Grâce"),
    ("L'Île-Bizard-Sainte-Geneviève", "L'Île-Bizard-Sainte-Geneviève"),
    ("Île-Bizard", "L'Île-Bizard-Sainte-Geneviève"),
    ("Senneville", "L'Île-Bizard-Sainte-Geneviève"),
    ("LaSalle", "LaSalle"),
    ("Lachine", "Lachine"),
    ("Le Plateau-Mont-Royal", "Le Plateau-Mont-Royal"),
    ("Plateau-Mont-Royal", "Le Plateau-Mont-Royal"),
    ("Le Sud-Ouest", "Le Sud-Ouest"),
    ("Sud-Ouest", "Le Sud-Ouest"),
    ("Mercier-Hochelaga-Maisonneuve", MHM),
    ("Hochelaga-Maisonneuve", MHM),
    ("Souligny", MHM),
    ("La Fontaine", MHM),
    ("Honoré-Beaugrand", MHM),
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
    ("Cavendish", "St-Laurent"),
    ("Montréal-Nord", "Montréal-Nord"),
    ("Verdun", "Verdun"),
    ("Île des Sœurs", "Verdun"),
    ("Ile des Soeurs", "Verdun"),
    ("Nuns' Island", "Verdun"),
    ("Pont Clément", "Verdun"),
    ("Ville-Marie", "Ville-Marie"),
    ("tunnel Viger", "Ville-Marie"),
    ("Saint-Urbain", "Ville-Marie"),
    ("Villeray-Saint-Michel-Parc-Extension", "Villeray-Saint-Michel-Parc-Extension"),
    ("Parc-Extension", "Villeray-Saint-Michel-Parc-Extension"),
    ("Villeray", "Villeray-Saint-Michel-Parc-Extension"),
    ("Saint-Michel", "Villeray-Saint-Michel-Parc-Extension"),
)


def fold_key(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text or "")
    without = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without.lower().replace("'", "").replace("’", "").replace("–", "-").replace("—", "-")


def prop(props: dict, *names: str) -> str:
    for name in names:
        value = props.get(name)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def extract_borough(*texts: str) -> str:
    key = fold_key(" ".join(texts))
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


def walk_pairs(coords):
    if not coords:
        return
    if isinstance(coords[0], (int, float)):
        if len(coords) >= 2:
            yield coords
        return
    for item in coords:
        yield from walk_pairs(item)


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
        if gtype == "MultiLineString" and ring and not isinstance(ring[0], (int, float)):
            mid = ring[len(ring) // 2]
            return float(mid[1]), float(mid[0])
        if ring and not isinstance(ring[0], (int, float)):
            xs = [pair[0] for pair in ring if isinstance(pair, (list, tuple)) and len(pair) >= 2]
            ys = [pair[1] for pair in ring if isinstance(pair, (list, tuple)) and len(pair) >= 2]
            if xs:
                return sum(ys) / len(ys), sum(xs) / len(xs)
    pair = first_pair(coords)
    if pair and len(pair) >= 2:
        return float(pair[1]), float(pair[0])
    return None, None


def in_island_bbox(lat: float, lng: float) -> bool:
    if lat == 0 and lng == 0:
        return False
    return LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX


def geometry_on_island(geometry: dict | None) -> bool:
    if not geometry:
        return False
    for pair in walk_pairs(geometry.get("coordinates")):
        if len(pair) >= 2 and in_island_bbox(float(pair[1]), float(pair[0])):
            return True
    return False


def mentions_island_or_approach(*texts: str) -> bool:
    key = fold_key(" ".join(texts))
    return any(needle in key for needle in ISLAND_TEXT)


def route_label(raw: str) -> str:
    number = (raw or "").strip()
    if not number:
        return ""
    return f"A-{number}" if number in AUTOROUTES else f"R-{number}"


def to_iso(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return ""
    for fmt in ("%Y/%m/%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text[:19], fmt).isoformat()
        except ValueError:
            continue
    return text


def download_geojson() -> dict:
    request = urllib_request.Request(SOURCE_URL, headers={"User-Agent": BROWSER_UA})
    try:
        with urllib_request.urlopen(request, timeout=180) as response:
            raw = response.read()
    except urllib_error.HTTPError as exc:
        raise SystemExit(f"Download failed with HTTP {exc.code}. A browser User-Agent is required.") from exc
    except urllib_error.URLError as exc:
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
    geometry = feature.get("geometry") or {}
    if not geometry_on_island(geometry):
        return None
    lat, lng = representative_point(geometry)
    if lat is None or lng is None or (lat == 0 and lng == 0) or not in_island_bbox(lat, lng):
        lat, lng = None, None
    ident = prop(props, "identifiant", "id")
    works = prop(props, "identificationDesTravaux", "identification_des_travaux")
    localisation = prop(props, "localisation")
    description_fr = prop(props, "descriptionFrancais", "description_francais")
    if not mentions_island_or_approach(localisation, description_fr, works):
        return None
    route = route_label(prop(props, "routeAutoroute", "route_autoroute", "route"))
    title = " — ".join(part for part in (route, works or localisation) if part)
    description_en = prop(props, "descriptionAnglais", "description_anglais")
    detour = prop(props, "detoursEtItinerairesFacultatifs", "detours_et_itineraires_facultatifs")
    lanes = prop(props, "entrave")
    return {
        "id": f"mtq:{ident}" if ident else f"mtq:{index}",
        "chantier": prop(props, "identifiantChantier", "identifiant_chantier"),
        "title": title or localisation or works,
        "route": route,
        "work": works,
        "localisation": localisation,
        "direction": prop(props, "direction"),
        "restriction": prop(props, "entraveType", "entrave_type"),
        "lanes": lanes,
        "detour": detour,
        "start": to_iso(prop(props, "debut", "date_debut")),
        "end": to_iso(prop(props, "fin", "date_fin")),
        "updated": to_iso(prop(props, "miseAJour", "mise_a_jour")),
        "url": prop(props, "urlFrancais", "url_francais") or HUMAN_URL,
        "description_fr": description_fr,
        "description_en": description_en,
        "borough": extract_borough(localisation, description_fr, works, title),
        "lat": lat,
        "lng": lng,
        "geometry": geometry,
        "geometry_type": geometry.get("type") or "",
    }


def main() -> None:
    collection = download_geojson()
    features = [item for item in (collection.get("features") or []) if isinstance(item, dict)]
    rows = []
    for index, feature in enumerate(features):
        row = project_feature(feature, index)
        if row:
            rows.append(row)

    if not rows:
        raise SystemExit("No MTQ roadwork features were found on Montréal island or its approaches.")

    payload = {
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "source_url": SOURCE_URL,
        "source_page": SOURCE_PAGE,
        "human_url": HUMAN_URL,
        "license": "CC-BY-4.0",
        "count": len(rows),
        "province_count": len(features),
        "note": (
            "Québec 511 / Transports Québec highway, tunnel, and bridge lane closures "
            "on Montréal island and its approaches. Not City streets."
        ),
        "rows": rows,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    located = sum(1 for row in rows if row["lat"] is not None and row["lng"] is not None)
    lined = sum(1 for row in rows if "Line" in (row["geometry_type"] or ""))
    print(f"Wrote {OUT_PATH}")
    print(
        f"rows={len(rows)} province={len(features)} with_coords={located} "
        f"lines={lined} bbox={LNG_MIN},{LAT_MIN},{LNG_MAX},{LAT_MAX}"
    )


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
