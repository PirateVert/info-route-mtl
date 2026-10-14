"""Saved places: 100 m match, resident headlines, snow hook."""

from __future__ import annotations

import math
import os
from datetime import datetime, timezone

from impacts import LANE, NONE, PARKING, SIDEWALK, STREET, resident_primary

PLACE_RADIUS_M = 100
ROUTE_RADIUS_M = 100
SNOW_LOT_RADIUS_M = 2000
# Free: see and save one place (or route) at a time — not view-only.
# Paid ($2/month): up to 5 favourites + email alerts.
FREE_MAX = 1
PAID_MAX = 5
FREE_PLACE_LIMIT = FREE_MAX
PAID_PLACE_LIMIT = PAID_MAX
PLACE_KINDS = ("home", "car", "work", "route", "street", "intersection", "address")
LEGACY_KINDS = ("near_me",)


def place_cap(paid: bool) -> int:
    return PAID_MAX if paid else FREE_MAX


def snow_enabled() -> bool:
    return (os.environ.get("SNOW_ENABLED") or "").strip().lower() in {"1", "true", "yes", "on"}


def _distance_to_segment(lat: float, lng: float, start: dict, end: dict) -> float:
    lat0 = start["lat"]
    lng0 = start["lng"]
    m_lat = 111_320
    m_lng = 111_320 * math.cos(math.radians(lat0))
    bx = (end["lng"] - lng0) * m_lng
    by = (end["lat"] - lat0) * m_lat
    px = (lng - lng0) * m_lng
    py = (lat - lat0) * m_lat
    length = bx * bx + by * by
    if length == 0:
        return math.hypot(px, py)
    t = max(0.0, min(1.0, (px * bx + py * by) / length))
    return math.hypot(px - t * bx, py - t * by)


def _hours_phrase(site: dict, lang: str) -> str:
    hours = site.get("hours") or []
    if not hours:
        return ""
    from impacts import WEEKDAYS

    starts = {(item.get("start") or "") for item in hours}
    ends = {(item.get("end") or "") for item in hours}
    all_day = all(item.get("all_day") for item in hours)
    days = [item["day"] for item in hours if item.get("day")]
    if all_day or (len(hours) == 7 and not any(item.get("start") for item in hours)):
        return ""
    time_bit = ""
    if len(starts) == 1 and len(ends) == 1:
        start = next(iter(starts))
        end = next(iter(ends))
        if start and end:
            time_bit = _clock(start, end, lang)
    day_bit = ""
    if days:
        if days == ["mon", "tue", "wed", "thu", "fri"]:
            day_bit = "en semaine" if lang == "fr" else "weekdays"
        elif len(days) == 1:
            day_bit = WEEKDAYS[days[0]][lang]
        else:
            names = [WEEKDAYS[day][lang] for day in days if day in WEEKDAYS]
            conj = " et " if lang == "fr" else " and "
            day_bit = conj.join(filter(None, [", ".join(names[:-1]), names[-1]])) if names else ""
    if day_bit and time_bit:
        return f"{day_bit} {time_bit}"
    return day_bit or time_bit


def _clock(start: str, end: str, lang: str) -> str:
    def fmt(value: str) -> str:
        parts = (value or "").split(":")
        try:
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
        except ValueError:
            return value
        if lang == "fr":
            return f"{hour} h" if minute == 0 else f"{hour} h {minute:02d}"
        suffix = "a.m." if hour < 12 else "p.m."
        hour12 = hour % 12 or 12
        if minute:
            return f"{hour12}:{minute:02d} {suffix}"
        return f"{hour12} {suffix}"

    return f"{fmt(start)}–{fmt(end)}"


def _from_day(site: dict, lang: str) -> str:
    raw = site.get("start") or ""
    try:
        when = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return ""
    today = datetime.now(timezone.utc).date()
    start_day = when.date()
    weekday = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
    names = {
        "fr": ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
        "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    }
    label = names[lang][when.weekday()]
    if start_day > today:
        return label
    return label


def headline_for(site: dict, lang: str) -> str:
    kind = site.get("resident_primary") or resident_primary(site)
    hours = _hours_phrase(site, lang)
    from_day = _from_day(site, lang)
    if kind == PARKING:
        if lang == "fr":
            return f"Stationnement interdit{(' ' + hours) if hours else ''}".strip()
        return f"No parking{(' ' + hours) if hours else ''}".strip()
    if kind == STREET:
        if lang == "fr":
            return f"Rue fermée{(' à partir de ' + from_day) if from_day else ''}"
        return f"Street closed{(' from ' + from_day) if from_day else ''}"
    if kind == LANE:
        return "Voie(s) fermée(s)" if lang == "fr" else "Lane(s) closed"
    if kind == SIDEWALK:
        return "Trottoir fermé" if lang == "fr" else "Sidewalk closed"
    return "OK"


def place_status(place: dict, sites: list[dict], lots: list[dict], lang: str) -> dict:
    nearby = match_sites(place, sites)
    ranked = sorted(
        nearby,
        key=lambda item: (
            {"parking": 0, "street": 1, "lane": 2, "sidewalk": 3, "none": 4}.get(
                item.get("resident_primary") or "none", 4
            ),
            item.get("distance_m") is None,
            item.get("distance_m") or 10**9,
        ),
    )
    worst = ranked[0] if ranked else None
    kind = (worst.get("resident_primary") if worst else NONE) or NONE
    label = place.get("label") or place.get("query") or ""
    if worst and kind != NONE:
        headline = f"{label}: {headline_for(worst, lang)}" if label else headline_for(worst, lang)
    else:
        headline = f"{label}: OK" if label else "OK"

    snow = {
        "enabled": snow_enabled(),
        "status": None,
        "note": "token_pending" if snow_enabled() else "flag_off",
    }
    near_lots = []
    point = _place_point(place)
    if point:
        import server

        for lot in lots:
            if lot.get("lat") is None or lot.get("lng") is None:
                continue
            distance = server.haversine(point["lat"], point["lng"], lot["lat"], lot["lng"])
            if distance <= SNOW_LOT_RADIUS_M:
                item = dict(lot)
                item["distance_m"] = round(distance)
                near_lots.append(item)
        near_lots.sort(key=lambda item: item["distance_m"])
        near_lots = near_lots[:3]

    return {
        "id": place.get("id") or "",
        "kind": place.get("kind") or place.get("type") or "home",
        "label": label,
        "status": kind if ranked else NONE,
        "headline": headline,
        "headline_fr": place_status_headline(place, worst, "fr"),
        "headline_en": place_status_headline(place, worst, "en"),
        "sites": ranked[:8],
        "snow": snow,
        "snow_lots": near_lots,
    }


def place_status_headline(place: dict, worst: dict | None, lang: str) -> str:
    label = place.get("label") or place.get("query") or ""
    if not worst or (worst.get("resident_primary") or NONE) == NONE:
        return f"{label}: OK" if label else "OK"
    text = headline_for(worst, lang)
    return f"{label}: {text}" if label else text


def _place_point(place: dict) -> dict | None:
    lat = place.get("lat")
    lng = place.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        return {"lat": float(lat), "lng": float(lng)}
    return None


def match_sites(place: dict, sites: list[dict]) -> list[dict]:
    import server

    kind = place.get("kind") or place.get("type") or "home"
    point = _place_point(place)
    end = None
    if isinstance(place.get("end_lat"), (int, float)) and isinstance(place.get("end_lng"), (int, float)):
        end = {"lat": float(place["end_lat"]), "lng": float(place["end_lng"])}

    found = []
    for site in sites:
        if site.get("lat") is None or site.get("lng") is None:
            continue
        distance = None
        hit = False
        if kind == "route" and point and end:
            distance = _distance_to_segment(site["lat"], site["lng"], point, end)
            hit = distance <= ROUTE_RADIUS_M
        elif point:
            distance = server.haversine(point["lat"], point["lng"], site["lat"], site["lng"])
            hit = distance <= PLACE_RADIUS_M
        if not hit:
            continue
        item = dict(site)
        item["distance_m"] = round(distance) if distance is not None else None
        found.append(item)
    return found
