"""Paid My Places: $2 CAD / month, up to 5 favourites, email alerts.

Paid includes alerts for new closures / no-parking near saved places
(or along a saved route), plus a Sunday weekly summary.
Free users save one place locally and do not receive email.
Preferences live on the Stripe subscription so they survive a restart.
"""

from __future__ import annotations

import json
import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from places import PAID_MAX, PLACE_KINDS as SAVED_KINDS

ROOT = Path(__file__).resolve().parent
SNAPSHOT_PATH = ROOT / "data" / "digest_snapshot.json"
PRICE_CENTS = 200
ALERTS = ("closure", "parking", "new", "ending", "dates", "status", "who", "reason")
PAID_ALERTS = ("closure", "parking")
FREQUENCIES = ("weekly",)
LANGS = ("fr", "en", "both")
PLACE_TYPES = (*SAVED_KINDS, "near_me")
MAX_PLACES = PAID_MAX
ROUTE_RADIUS_M = 100
ADDRESS_RADIUS_M = 100
INTERSECTION_RADIUS_M = 100
PROD_ORIGIN = "https://info-route-mtl.onrender.com"
LOCAL_ORIGIN = re.compile(r"^http://(localhost|127\.0\.0\.1):\d+$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,80}$")

router = APIRouter(prefix="/api")


class PlaceIn(BaseModel):
    type: str = "street"
    kind: str = ""
    query: str = ""
    via: str = ""
    label: str = ""
    lat: float | None = None
    lng: float | None = None
    end_lat: float | None = None
    end_lng: float | None = None


class CheckoutBody(BaseModel):
    email: str
    alerts: list[str] = Field(default_factory=list)
    frequency: str = "weekly"
    language: str = "fr"
    borough: str = ""
    street: str = ""
    places: list[PlaceIn] = Field(default_factory=list)
    origin_url: str = ""


class UpdateBody(BaseModel):
    token: str
    alerts: list[str] = Field(default_factory=list)
    frequency: str = "weekly"
    language: str = "fr"
    borough: str = ""
    street: str = ""
    places: list[PlaceIn] = Field(default_factory=list)


class PreviewBody(BaseModel):
    borough: str = ""
    alerts: list[str] = Field(default_factory=list)
    places: list[PlaceIn] = Field(default_factory=list)
    street: str = ""


def _stripe():
    import stripe

    key = (os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="payments_off")
    stripe.api_key = key
    return stripe


def _origin(origin: str) -> str:
    origin = (origin or "").rstrip("/")
    allowed = {PROD_ORIGIN}
    extra = (os.environ.get("APP_ORIGIN") or "").rstrip("/")
    if extra:
        allowed.add(extra)
    if origin in allowed or LOCAL_ORIGIN.match(origin):
        return origin
    return extra or PROD_ORIGIN


def _clean_place(raw: PlaceIn | dict) -> dict:
    if isinstance(raw, PlaceIn):
        raw = raw.model_dump()
    kind = (raw.get("kind") or raw.get("type") or "street").strip()
    if kind not in PLACE_TYPES:
        raise HTTPException(status_code=400, detail="bad_place")
    query = (raw.get("query") or "").strip()[:120]
    via = (raw.get("via") or "").strip()[:120]
    if not query:
        raise HTTPException(status_code=400, detail="place_not_found")
    if kind in {"route", "intersection"} and not via:
        raise HTTPException(status_code=400, detail="place_not_found")
    import server

    if kind == "near_me":
        point = server.parse_coord_pair(query)
        if point is None:
            raise HTTPException(status_code=400, detail="outside_montreal")
        label = via or f"{point['lat']},{point['lng']}"
        return {
            "type": kind,
            "query": f"{point['lat']},{point['lng']}",
            "via": label[:120],
        }
    if kind == "street":
        if not server.street_tokens(query) and server.geocode(query) is None:
            raise HTTPException(status_code=400, detail="place_not_found")
    elif kind in {"address", "home", "car", "work"}:
        if server.geocode(query) is None and not (
            isinstance(raw.get("lat"), (int, float)) and isinstance(raw.get("lng"), (int, float))
        ):
            raise HTTPException(status_code=400, detail="place_not_found")
    elif kind == "intersection":
        joined = f"{query} et {via}"
        if server.geocode(joined) is None and not (server.street_tokens(query) and server.street_tokens(via)):
            raise HTTPException(status_code=400, detail="place_not_found")
    else:
        start = server.geocode(query)
        end = server.geocode(via)
        if start is None or end is None:
            raise HTTPException(status_code=400, detail="place_not_found")
        if server.haversine(start["lat"], start["lng"], end["lat"], end["lng"]) < 80:
            raise HTTPException(status_code=400, detail="place_not_found")
        return {
            "type": kind,
            "query": query,
            "via": via,
            "label": (raw.get("label") or f"{query} → {via}")[:120],
            "lat": start["lat"],
            "lng": start["lng"],
            "end_lat": end["lat"],
            "end_lng": end["lng"],
        }
    point = None
    if isinstance(raw.get("lat"), (int, float)) and isinstance(raw.get("lng"), (int, float)):
        point = {"lat": float(raw["lat"]), "lng": float(raw["lng"])}
    elif kind in {"address", "home", "car", "work"}:
        point = server.geocode(query)
    packed = {
        "type": kind,
        "query": query,
        "via": via,
        "label": (raw.get("label") or via or query)[:120],
    }
    if point:
        packed["lat"] = point["lat"]
        packed["lng"] = point["lng"]
    if isinstance(raw.get("end_lat"), (int, float)) and isinstance(raw.get("end_lng"), (int, float)):
        packed["end_lat"] = float(raw["end_lat"])
        packed["end_lng"] = float(raw["end_lng"])
    return packed


def _clean_places(places: list[PlaceIn] | None, street: str = "") -> list[dict]:
    cleaned = []
    for item in places or []:
        cleaned.append(_clean_place(item))
        if len(cleaned) > MAX_PLACES:
            raise HTTPException(status_code=400, detail="too_many_places")
    leftover = (street or "").strip()[:120]
    if leftover and not cleaned:
        cleaned.append(_clean_place({"type": "street", "query": leftover, "via": ""}))
    if len(cleaned) > MAX_PLACES:
        raise HTTPException(status_code=400, detail="too_many_places")
    return cleaned


def _pack_places(places: list[dict]) -> dict:
    packed = {"places_n": str(len(places)), "street": places[0]["query"] if places else ""}
    for index, place in enumerate(places):
        lat = place.get("lat")
        lng = place.get("lng")
        extra = f"|{lat}|{lng}" if isinstance(lat, (int, float)) and isinstance(lng, (int, float)) else ""
        packed[f"w{index}"] = (
            f"{place['type']}|{place['query'].replace('|', '/')}|{place['via'].replace('|', '/')}"
            f"|{(place.get('label') or '').replace('|', '/')}{extra}"
        )
    for index in range(len(places), MAX_PLACES):
        packed[f"w{index}"] = ""
    return packed


def _unpack_places(meta: dict) -> list[dict]:
    places = []
    count = int(meta.get("places_n") or 0) if str(meta.get("places_n") or "").isdigit() else 0
    for index in range(min(count, MAX_PLACES)):
        raw = (meta.get(f"w{index}") or "").strip()
        if not raw:
            continue
        parts = raw.split("|")
        kind = parts[0] if parts and parts[0] in PLACE_TYPES else "street"
        query = parts[1] if len(parts) > 1 else ""
        via = parts[2] if len(parts) > 2 else ""
        label = parts[3] if len(parts) > 3 else ""
        place = {"type": kind, "query": query, "via": via, "label": label or query}
        if len(parts) >= 6:
            try:
                place["lat"] = float(parts[4])
                place["lng"] = float(parts[5])
            except ValueError:
                pass
        if query:
            places.append(place)
    if not places and (meta.get("street") or "").strip():
        places.append({"type": "street", "query": meta["street"].strip(), "via": ""})
    return places[:MAX_PLACES]


def _place_label(place: dict) -> str:
    if place["type"] == "route":
        return f"{place['query']} → {place['via']}"
    if place["type"] == "intersection":
        return f"{place['query']} × {place['via']}"
    if place["type"] == "near_me":
        return place["via"] or place["query"]
    return place["query"]


def _clean_choices(alerts: list[str], frequency: str, language: str, borough: str, street: str, places: list[PlaceIn] | None) -> dict:
    # Paid product is 5 favourites + emails for those places. Client checkboxes are ignored.
    chosen = list(PAID_ALERTS)
    if frequency not in FREQUENCIES:
        frequency = "weekly"
    if language not in LANGS:
        language = "fr"
    borough = (borough or "").strip()
    if borough:
        names = {item["name"] for item in _boroughs()}
        if borough not in names:
            raise HTTPException(status_code=400, detail="bad_borough")
    cleaned = _clean_places(places, street)
    packed = _pack_places(cleaned)
    packed.update({
        "alerts": ",".join(chosen),
        "frequency": frequency,
        "language": language,
        "borough": borough,
    })
    return packed


def _boroughs() -> list[dict]:
    import server

    store = server.load_store()
    names = sorted({(row.get(server.BOROUGH_FIELD) or "") for row in store.get("rows", []) if row.get(server.BOROUGH_FIELD)})
    return [{"name": name} for name in names]


def _distance_to_segment(lat: float, lng: float, start: dict, end: dict) -> float:
    import math

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


def _tokens_hit(folded_street: str, query: str) -> bool:
    import server

    tokens = server.street_tokens(query)
    return bool(tokens) and all(token in folded_street for token in tokens)


def _nearby(work: dict, place: dict | None, radius: float) -> bool:
    import server

    if not place or work["lat"] is None or work["lng"] is None:
        return False
    return server.haversine(place["lat"], place["lng"], work["lat"], work["lng"]) <= radius


def _match_place(works: list[dict], place: dict) -> list[dict]:
    import server

    kind = place["type"]
    query = place["query"]
    via = place["via"]
    chosen = []
    if kind == "street":
        point = server.geocode(query) if not server.street_tokens(query) else None
        for work in works:
            folded = server.fold(work["street"])
            if _tokens_hit(folded, query) or _nearby(work, point, server.NEARBY_RADIUS_M):
                chosen.append(work)
        return chosen
    if kind == "near_me":
        point = server.parse_coord_pair(query)
        return [work for work in works if _nearby(work, point, server.NEARBY_RADIUS_M)]
    if kind in {"address", "home", "car", "work"}:
        point = None
        if isinstance(place.get("lat"), (int, float)) and isinstance(place.get("lng"), (int, float)):
            point = {"lat": float(place["lat"]), "lng": float(place["lng"])}
        else:
            point = server.geocode(query)
        return [work for work in works if _nearby(work, point, ADDRESS_RADIUS_M)]
    if kind == "intersection":
        point = server.geocode(f"{query} et {via}")
        for work in works:
            folded = server.fold(work["street"])
            both = _tokens_hit(folded, query) and _tokens_hit(folded, via)
            if both or _nearby(work, point, INTERSECTION_RADIUS_M):
                chosen.append(work)
        return chosen
    start = server.geocode(query)
    end = server.geocode(via)
    if start is None or end is None:
        return []
    for work in works:
        folded = server.fold(work["street"])
        on_names = _tokens_hit(folded, query) or _tokens_hit(folded, via)
        on_line = False
        if work["lat"] is not None and work["lng"] is not None:
            on_line = _distance_to_segment(work["lat"], work["lng"], start, end) <= ROUTE_RADIUS_M
        if on_names or on_line:
            chosen.append(work)
    return chosen


def _scope(borough: str, street: str = "", places: list[dict] | None = None) -> list[dict]:
    import server

    works = server.all_sites()
    if borough:
        works = [work for work in works if work["borough"] == borough]
    cleaned = places if places is not None else _clean_places([], street)
    if not cleaned:
        return works
    found: dict[str, dict] = {}
    for place in cleaned:
        for work in _match_place(works, place):
            found[work["id"]] = work
    return list(found.values())


def _fingerprint(work: dict) -> dict:
    return {
        "street": work.get("street") or work.get("title") or "",
        "borough": work.get("borough") or "",
        "reason": work.get("reason") or "",
        "organization": work.get("organization") or "",
        "submitter": work.get("submitter") or "",
        "status": work.get("status") or "",
        "start": work.get("start") or "",
        "end": work.get("end") or "",
        "street_closed": bool(work.get("street_closed")),
        "lane_closed": bool(work.get("lane_closed")),
        "sidewalk_closed": bool(work.get("sidewalk_closed")),
        "no_parking": bool(work.get("no_parking")),
        "closes": bool(work.get("closes")),
    }


def ensure_snapshot() -> None:
    if SNAPSHOT_PATH.is_file():
        return
    import server

    try:
        works = [*server.all_works(), *server.all_mtq()]
        payload = {work["id"]: _fingerprint(work) for work in works if work.get("id")}
        SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    except Exception:
        return


def _load_snapshot() -> dict:
    ensure_snapshot()
    if not SNAPSHOT_PATH.is_file():
        return {}
    try:
        return json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return {}


def _ending_soon(work: dict) -> bool:
    raw = work.get("end") or ""
    if not raw:
        return False
    try:
        when = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return False
    seconds = (when - datetime.now(timezone.utc)).total_seconds()
    return 0 <= seconds <= 14 * 86400


def _kinds(previous: dict | None, work: dict | None) -> list[str]:
    if previous is None and work is not None:
        kinds = ["new"]
        if work.get("closes"):
            kinds.append("closure")
        if work.get("no_parking"):
            kinds.append("parking")
        if _ending_soon(work):
            kinds.append("ending")
        return kinds
    if work is None and previous is not None:
        return ["ending"]
    if previous is None or work is None:
        return []
    kinds = []
    if previous.get("start") != work.get("start") or previous.get("end") != work.get("end"):
        kinds.append("dates")
    if previous.get("status") != work.get("status"):
        kinds.append("status")
    if previous.get("organization") != work.get("organization") or previous.get("submitter") != work.get("submitter"):
        kinds.append("who")
    if previous.get("reason") != work.get("reason"):
        kinds.append("reason")
    if (not previous.get("closes") and work.get("closes")) or (
        previous.get("street_closed") != work.get("street_closed")
        or previous.get("lane_closed") != work.get("lane_closed")
        or previous.get("sidewalk_closed") != work.get("sidewalk_closed")
    ):
        if work.get("closes"):
            kinds.append("closure")
    if not previous.get("no_parking") and work.get("no_parking"):
        kinds.append("parking")
    if _ending_soon(work):
        kinds.append("ending")
    return kinds


def changes_for(borough: str, street: str, alerts: list[str], places: list[dict] | None = None) -> list[dict]:
    import server

    cleaned = places if places is not None else _clean_places([], street)
    current = {
        work["id"]: work
        for work in _scope(borough, places=cleaned)
        if work.get("id") and work.get("kind") != "avis"
    }
    previous = _load_snapshot()
    scoped_ids = set(current)
    for pid, row in previous.items():
        if borough and row.get("borough") != borough:
            continue
        if cleaned:
            dummy = {
                "id": pid,
                "street": row.get("street") or "",
                "borough": row.get("borough") or "",
                "lat": None,
                "lng": None,
                "reason": row.get("reason") or "",
                "organization": "",
                "submitter": "",
                "status": "",
                "start": "",
                "end": "",
            }
            if not any(_match_place([dummy], place) for place in cleaned):
                continue
        scoped_ids.add(pid)

    found = []
    for pid in scoped_ids:
        work = current.get(pid)
        old = previous.get(pid)
        kinds = [kind for kind in _kinds(old, _fingerprint(work) if work else None) if kind in alerts]
        if not kinds:
            continue
        source = work or {}
        row = old or {}
        found.append({
            "id": pid,
            "street": source.get("street") or row.get("street") or "",
            "borough": source.get("borough") or row.get("borough") or "",
            "reason": source.get("reason") or row.get("reason") or "",
            "kinds": kinds,
        })
    found.sort(key=lambda item: (item["street"], item["borough"]))
    return found[:40]


def _public_sub(sub) -> dict:
    meta = dict(sub.metadata or {})
    alerts = [item for item in (meta.get("alerts") or "").split(",") if item in ALERTS]
    places = _unpack_places(meta)
    return {
        "email": meta.get("email") or "",
        "alerts": alerts,
        "frequency": meta.get("frequency") if meta.get("frequency") in FREQUENCIES else "weekly",
        "language": meta.get("language") if meta.get("language") in LANGS else "fr",
        "borough": meta.get("borough") or "",
        "street": places[0]["query"] if places else "",
        "places": places,
        "status": sub.status,
        "manage_token": meta.get("manage_token") or "",
    }


def _find_subscription(token: str):
    if not TOKEN_RE.match(token or ""):
        raise HTTPException(status_code=400, detail="bad_token")
    stripe = _stripe()
    try:
        found = stripe.Subscription.search(query=f"metadata['manage_token']:'{token}'", limit=1)
        if found.data:
            return found.data[0]
    except Exception:
        found = None
    starting_after = None
    for _ in range(10):
        page = stripe.Subscription.list(status="all", limit=100, starting_after=starting_after)
        for sub in page.data:
            if (sub.metadata or {}).get("manage_token") == token:
                return sub
        if not page.has_more or not page.data:
            break
        starting_after = page.data[-1].id
    raise HTTPException(status_code=404, detail="subscription_not_found")


def _preview_payload(borough: str, alerts: list[str], places: list[dict]) -> dict:
    if borough and borough not in {item["name"] for item in _boroughs()}:
        raise HTTPException(status_code=400, detail="bad_borough")
    chosen = [item for item in alerts if item in ALERTS] or list(ALERTS)
    works = _scope(borough, places=places)
    samples = [
        {
            "id": work["id"],
            "street": work.get("street") or work.get("title") or "",
            "borough": work.get("borough") or "",
            "reason": work.get("reason") or work.get("type") or "",
        }
        for work in works[:6]
    ]
    return {
        "count": len(works),
        "samples": samples,
        "places": [{"type": place["type"], "query": place["query"], "via": place["via"], "label": _place_label(place)} for place in places],
        "changes": changes_for(borough, "", chosen, places)[:8],
    }


@router.get("/subscribe/preview")
def subscribe_preview(
    borough: str = "",
    q: str = "",
    alerts: str = ",".join(ALERTS),
):
    chosen = [item for item in alerts.split(",") if item in ALERTS] or list(ALERTS)
    places = _clean_places([], q.strip()) if q.strip() else []
    return _preview_payload(borough.strip(), chosen, places)


@router.post("/subscribe/preview")
def subscribe_preview_post(body: PreviewBody):
    places = _clean_places(body.places, body.street)
    chosen = body.alerts or list(ALERTS)
    return _preview_payload(body.borough.strip(), chosen, places)


@router.post("/subscribe/checkout")
def subscribe_checkout(body: CheckoutBody):
    email = body.email.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="bad_email")
    choices = _clean_choices(body.alerts, body.frequency, body.language, body.borough, body.street, body.places)
    token = secrets.token_urlsafe(24)
    meta = {"email": email, "manage_token": token, **choices}
    stripe = _stripe()
    origin = _origin(body.origin_url)
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=email,
            line_items=[{
                "quantity": 1,
                "price_data": {
                    "currency": "cad",
                    "unit_amount": PRICE_CENTS,
                    "recurring": {"interval": "month"},
                    "product_data": {"name": "Info-Route MTL"},
                },
            }],
            success_url=f"{origin}/subscribe/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/subscribe/cancel",
            metadata=meta,
            subscription_data={"metadata": meta},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="checkout_failed") from exc
    return {"checkout_url": session.url}


@router.get("/subscribe/session")
def subscribe_session(session_id: str = Query(..., min_length=8, max_length=120)):
    if not re.match(r"^cs_[A-Za-z0-9_]+$", session_id):
        raise HTTPException(status_code=400, detail="bad_session")
    stripe = _stripe()
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="subscription_not_found") from exc
    meta = dict(session.metadata or {})
    paid = session.payment_status == "paid" or session.status == "complete"
    alerts = [item for item in (meta.get("alerts") or "").split(",") if item in ALERTS]
    places = _unpack_places(meta)
    return {
        "paid": paid,
        "email": meta.get("email") or "",
        "alerts": alerts,
        "frequency": meta.get("frequency") or "weekly",
        "language": meta.get("language") or "fr",
        "borough": meta.get("borough") or "",
        "street": places[0]["query"] if places else "",
        "places": places,
        "manage_token": meta.get("manage_token") or "",
    }


@router.get("/subscribe")
def subscribe_get(token: str = Query(..., min_length=20, max_length=80)):
    sub = _find_subscription(token)
    public = _public_sub(sub)
    public["changes"] = changes_for(public["borough"], public["street"], public["alerts"], public["places"])
    return public


@router.patch("/subscribe")
def subscribe_patch(body: UpdateBody):
    sub = _find_subscription(body.token)
    choices = _clean_choices(body.alerts, body.frequency, body.language, body.borough, body.street, body.places)
    meta = dict(sub.metadata or {})
    meta.update(choices)
    stripe = _stripe()
    try:
        updated = stripe.Subscription.modify(sub.id, metadata=meta)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="checkout_failed") from exc
    public = _public_sub(updated)
    public["changes"] = changes_for(public["borough"], public["street"], public["alerts"], public["places"])
    return public
