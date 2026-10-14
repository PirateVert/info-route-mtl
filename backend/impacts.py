"""Classify City occupancy impacts into plain-language closures.

Join key: impacts.id_request = roadwork.id (the permit request id).
"""

from __future__ import annotations

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


def fold(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text or "")
    without = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without.lower().replace("'", "").replace("’", "").replace("–", "-").replace("—", "-")


def _blocked(value: str) -> bool:
    key = fold(value)
    if not key or "aucun impact" in key or "non applicable" in key:
        return False
    return True


def classify_street_impact(value: str) -> dict[str, bool]:
    key = fold(value)
    flags = {"street_closed": False, "lane_closed": False, "no_parking": False}
    if not _blocked(value):
        return flags
    if "rue barree" in key:
        flags["street_closed"] = True
        return flags
    if "stationnement" in key:
        flags["no_parking"] = True
    if "circulation" in key:
        flags["lane_closed"] = True
    if not flags["no_parking"] and not flags["lane_closed"]:
        flags["lane_closed"] = True
    return flags


def empty_flags() -> dict:
    return {
        "street_closed": False,
        "lane_closed": False,
        "sidewalk_closed": False,
        "no_parking": False,
        "streets": [],
        "raw_types": [],
    }


def merge_impact_row(flags: dict, row: dict) -> dict:
    street_flags = classify_street_impact(row.get("streetimpacttype") or "")
    flags["street_closed"] = flags["street_closed"] or street_flags["street_closed"]
    flags["lane_closed"] = flags["lane_closed"] or street_flags["lane_closed"]
    flags["no_parking"] = flags["no_parking"] or street_flags["no_parking"]
    if _blocked(row.get("sidewalk_blockedtype") or "") or _blocked(row.get("backsidewalk_blockedtype") or ""):
        flags["sidewalk_closed"] = True
    name = (row.get("name") or row.get("shortname") or row.get("streetid") or "").strip()
    if name and name not in flags["streets"]:
        flags["streets"].append(name)
    raw = (row.get("streetimpacttype") or "").strip()
    if raw and raw not in flags["raw_types"]:
        flags["raw_types"].append(raw)
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
