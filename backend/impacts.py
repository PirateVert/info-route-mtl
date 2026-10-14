"""Classify City occupancy impacts into plain-language closures.

Join key: impacts.id_request = roadwork.id (the permit request id).
"""

from __future__ import annotations

import re
import unicodedata

NONE = "none"
STREET = "street"
LANE = "lane"
SIDEWALK = "sidewalk"
PARKING = "parking"

CLOSURE_KINDS = (STREET, LANE, SIDEWALK, PARKING)

WEEKDAYS = {
    "mon": {"fr": "lundi", "en": "Monday"},
    "tue": {"fr": "mardi", "en": "Tuesday"},
    "wed": {"fr": "mercredi", "en": "Wednesday"},
    "thu": {"fr": "jeudi", "en": "Thursday"},
    "fri": {"fr": "vendredi", "en": "Friday"},
    "sat": {"fr": "samedi", "en": "Saturday"},
    "sun": {"fr": "dimanche", "en": "Sunday"},
}

DAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

TYPE_PREFIX = re.compile(
    r"^(rue|voie|avenue|av\.?|boul\.?|boulevard|route|autoroute|chemin|ch\.?|"
    r"place|impasse|ruelle|cote|côte|rang|montee|montée|promenade|"
    r"terrasse|terrace|pont|carre|carré|square)\s+",
    re.I,
)
ARTICLE_PREFIX = re.compile(r"^(de la|de l'|de l|des|du|de|la|le|l')\s+", re.I)
SEGMENT_KEYS = (
    "name",
    "shortname",
    "streetid",
    "fromname",
    "toname",
    "fromshortname",
    "toshortname",
)


def fold(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text or "")
    without = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without.lower().replace("'", "").replace("’", "").replace("–", "-").replace("—", "-")


def clean_name(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _none_impact(value: str) -> bool:
    key = fold(value)
    return (not key) or "aucun impact" in key or "non applicable" in key


def _only_numbers(text: str) -> bool:
    compact = re.sub(r"[\s\-–—./]", "", text or "")
    return bool(compact) and compact.isdigit()


def _unnamed(text: str) -> bool:
    key = fold(text)
    return (not key) or "non-nommee" in key or "non nommee" in key or key in {"unnamed", "sans nom"}


def _core_name(text: str) -> str:
    key = TYPE_PREFIX.sub("", fold(clean_name(text))).strip()
    return ARTICLE_PREFIX.sub("", key).strip()


def name_rank(text: str) -> int:
    """0 = unusable, 1 = typed number (autoroute 25), 2 = 12e, 3 = named street."""
    label = clean_name(text)
    if not label or _unnamed(label) or _only_numbers(label):
        return 0
    core = _core_name(label)
    if not core or _unnamed(core):
        return 0
    if re.fullmatch(r"\d+", core):
        return 1
    if re.fullmatch(r"\d+[a-z]", core):
        return 2
    return 3


def sidewalk_fully_closed(value: str) -> bool:
    """True only when the sidewalk is fully closed (Barré), not merely obstructed."""
    key = fold(value)
    if _none_impact(value):
        return False
    if "passage" in key:
        return False
    if "barre" in key:
        return True
    if "ferme" in key and "non ferme" not in key:
        return True
    return False


def classify_street_impact(value: str) -> dict[str, bool]:
    key = fold(value)
    flags = {"street_closed": False, "lane_closed": False, "no_parking": False}
    if _none_impact(value):
        return flags
    if "rue barree" in key or "rue fermee" in key:
        flags["street_closed"] = True
        return flags
    # Travel lane closed, including "parking + circulation" (a travel lane is gone).
    # "Voie de stationnement obstruée" alone is only occupying the parking strip.
    if "circulation" in key:
        flags["lane_closed"] = True
        return flags
    if (
        "stationnement interdit" in key
        or "interdiction de stationner" in key
        or "parking prohibited" in key
        or "no parking" in key
    ):
        flags["no_parking"] = True
    return flags


def empty_flags() -> dict:
    return {
        "street_closed": False,
        "lane_closed": False,
        "sidewalk_closed": False,
        "no_parking": False,
        "streets": [],
        "segments": [],
        "raw_types": [],
    }


def _segment(row: dict) -> dict:
    return {key: clean_name(row.get(key) or "") for key in SEGMENT_KEYS}


def merge_impact_row(flags: dict, row: dict) -> dict:
    street_flags = classify_street_impact(row.get("streetimpacttype") or "")
    flags["street_closed"] = flags["street_closed"] or street_flags["street_closed"]
    flags["lane_closed"] = flags["lane_closed"] or street_flags["lane_closed"]
    flags["no_parking"] = flags["no_parking"] or street_flags["no_parking"]
    if sidewalk_fully_closed(row.get("sidewalk_blockedtype") or "") or sidewalk_fully_closed(
        row.get("backsidewalk_blockedtype") or ""
    ):
        flags["sidewalk_closed"] = True
    name = clean_name(row.get("name") or row.get("shortname") or row.get("streetid") or "")
    if name and name not in flags["streets"]:
        flags["streets"].append(name)
    raw = (row.get("streetimpacttype") or "").strip()
    if raw and raw not in flags["raw_types"]:
        flags["raw_types"].append(raw)
    segment = _segment(row)
    if any(segment.values()) and segment not in flags["segments"]:
        flags["segments"].append(segment)
    return flags


def closes(flags: dict) -> bool:
    return bool(
        flags.get("street_closed")
        or flags.get("lane_closed")
        or flags.get("sidewalk_closed")
        or flags.get("no_parking")
    )


def map_primary(flags: dict) -> str:
    if flags.get("street_closed"):
        return STREET
    if flags.get("lane_closed"):
        return LANE
    if flags.get("sidewalk_closed"):
        return SIDEWALK
    if flags.get("no_parking"):
        return PARKING
    return NONE


def resident_primary(flags: dict) -> str:
    if flags.get("no_parking"):
        return PARKING
    if flags.get("street_closed"):
        return STREET
    if flags.get("lane_closed"):
        return LANE
    if flags.get("sidewalk_closed"):
        return SIDEWALK
    return NONE


def flags_from_avis(row: dict) -> dict:
    flags = empty_flags()
    kind = fold(row.get("type") or "")
    title = fold(row.get("titre") or row.get("title") or "")
    if "stationnement" in kind:
        flags["no_parking"] = True
    elif "circulation" in kind:
        if "rue barree" in title or "rue fermee" in title or "fermeture" in title:
            flags["street_closed"] = True
        else:
            flags["lane_closed"] = True
    return flags


def flags_from_mtq(row: dict) -> dict:
    flags = empty_flags()
    blob = fold(
        " ".join(
            str(row.get(key) or "")
            for key in ("restriction", "title", "work", "description_fr", "lanes")
        )
    )
    if "fermeture complete" in blob or "chaussee fermee" in blob or "pont ferme" in blob or "tunnel ferme" in blob:
        flags["street_closed"] = True
    else:
        flags["lane_closed"] = True
    return flags


def impact_payload(flags: dict) -> dict:
    kinds = []
    if flags.get("street_closed"):
        kinds.append(STREET)
    if flags.get("lane_closed"):
        kinds.append(LANE)
    if flags.get("sidewalk_closed"):
        kinds.append(SIDEWALK)
    if flags.get("no_parking"):
        kinds.append(PARKING)
    return {
        "street_closed": bool(flags.get("street_closed")),
        "lane_closed": bool(flags.get("lane_closed")),
        "sidewalk_closed": bool(flags.get("sidewalk_closed")),
        "no_parking": bool(flags.get("no_parking")),
        "closes": closes(flags),
        "kinds": kinds,
        "map_primary": map_primary(flags),
        "resident_primary": resident_primary(flags),
        "streets": list(flags.get("streets") or []),
    }


def parse_occupancy(name: str) -> tuple[str, str, str]:
    text = clean_name(name)
    match = re.match(r"^(.*?)\s+entre\s+(.*)$", text, re.I)
    if not match:
        return text, "", ""
    street = clean_name(match.group(1))
    rest = clean_name(match.group(2))
    if re.match(r"^et\b", rest, re.I):
        return street, "", clean_name(rest[2:].lstrip())
    parts = re.split(r"\s+et\s*", rest, maxsplit=1)
    if len(parts) == 2:
        return street, clean_name(parts[0]), clean_name(parts[1])
    return street, rest, ""


def occupancy_is_junk(name: str) -> bool:
    """True when occupancy_name is a number, unnamed, or a broken 'entre X et Y'."""
    text = clean_name(name)
    if not text or _only_numbers(text):
        return True
    street, frm, to = parse_occupancy(text)
    if name_rank(street) == 0:
        return True
    if re.search(r"\bentre\b", text, re.I):
        if not frm or not to:
            return True
        if fold(frm) == fold(to) or _core_name(frm) == _core_name(to):
            return True
    return False


def _as_segments(row: dict, impacts) -> list[dict]:
    if impacts:
        first = impacts[0] if impacts else None
        if isinstance(first, str):
            return [{"name": clean_name(item)} for item in impacts if clean_name(item)]
        return [_segment(item) if isinstance(item, dict) else {"name": clean_name(str(item))} for item in impacts]
    stored = row.get("impact") if isinstance(row.get("impact"), dict) else {}
    if stored.get("segments"):
        return [_segment(item) for item in stored["segments"] if isinstance(item, dict)]
    return [{"name": clean_name(item)} for item in (stored.get("streets") or []) if clean_name(item)]


def _label(segment: dict) -> str:
    for key in ("name", "streetid", "shortname"):
        value = clean_name(segment.get(key) or "")
        if name_rank(value) > 0:
            return value
    return ""


def _cross(segment: dict, full_key: str, short_key: str) -> str:
    full = clean_name(segment.get(full_key) or "")
    short = clean_name(segment.get(short_key) or "")
    if name_rank(short) >= 2:
        return short
    if name_rank(full) > 0:
        return full
    return ""


def _same_street(left: str, right: str) -> bool:
    if not left or not right:
        return False
    if fold(left) == fold(right):
        return True
    a, b = _core_name(left), _core_name(right)
    if not a or not b:
        return False
    if a == b:
        return True
    return a in b or b in a


def _title_from_impacts(row: dict, impacts) -> str:
    occupancy = clean_name(row.get("occupancy_name") or "")
    occ_street, occ_from, occ_to = parse_occupancy(occupancy)
    segments = _as_segments(row, impacts)

    primary = ""
    chosen = None
    best = 0
    if name_rank(occ_street) > 0:
        for segment in segments:
            label = _label(segment)
            if name_rank(label) > 0 and _same_street(label, occ_street):
                primary = label
                chosen = segment
                best = name_rank(label)
                break
        if best == 0:
            primary = occ_street
            best = name_rank(occ_street)
    if best == 0:
        for segment in segments:
            label = _label(segment)
            rank = name_rank(label)
            if rank > best:
                best = rank
                primary = label
                chosen = segment

    if best == 0:
        for segment in segments:
            for key in ("fromname", "toname"):
                candidate = clean_name(segment.get(key) or "")
                rank = name_rank(candidate)
                if rank > best:
                    best = rank
                    primary = candidate
                    chosen = segment
        if best == 0:
            for candidate in (occ_street, occ_from, occ_to):
                if name_rank(candidate) > 0:
                    primary = candidate
                    break

    if not primary or _only_numbers(primary):
        return ""

    frm = _cross(chosen, "fromname", "fromshortname") if chosen else ""
    to = _cross(chosen, "toname", "toshortname") if chosen else ""
    if not frm and name_rank(occ_from) > 0:
        frm = occ_from
    if not to and name_rank(occ_to) > 0:
        to = occ_to
    if _same_street(frm, primary):
        frm = ""
    if _same_street(to, primary):
        to = ""
    if frm and to and _same_street(frm, to):
        frm, to = "", ""
    if primary and frm and to:
        return f"{primary} entre {frm} et {to}"
    return primary


def fallback_title(row: dict) -> str:
    reason = clean_name(row.get("reason_category") or row.get("reason") or "")
    borough = clean_name(row.get("boroughid") or row.get("borough") or "")
    if reason and borough:
        return f"{reason} — {borough}"
    return reason or borough


def display_title(row: dict, impacts=None) -> str:
    """Human title for a City work site. Never returns a numbers-only label."""
    occupancy = clean_name(row.get("occupancy_name") or "")
    if occupancy and not occupancy_is_junk(occupancy) and not _only_numbers(occupancy):
        return occupancy

    built = _title_from_impacts(row, impacts)
    if built and not _only_numbers(built) and not _unnamed(built):
        return built

    geo = clean_name(row.get("geocoded_street") or "")
    if geo and not _unnamed(geo) and not _only_numbers(geo):
        return geo

    fallback = fallback_title(row)
    if fallback:
        return fallback
    if occupancy and not _only_numbers(occupancy) and not _unnamed(occupancy):
        return occupancy
    return fallback or ""
