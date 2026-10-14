"""Monthly roadwork digest. $2 CAD, chosen alert types, chosen frequency.

Preferences live on the Stripe subscription so they survive a server restart.
Change detection uses a local snapshot of the last import.
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

ROOT = Path(__file__).resolve().parent
SNAPSHOT_PATH = ROOT / "data" / "digest_snapshot.json"
PRICE_CENTS = 200
ALERTS = ("new", "ending", "dates", "status", "who", "reason")
FREQUENCIES = ("daily", "weekly", "biweekly", "monthly")
LANGS = ("fr", "en", "both")
PROD_ORIGIN = "https://info-route-mtl.onrender.com"
LOCAL_ORIGIN = re.compile(r"^http://(localhost|127\.0\.0\.1):\d+$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,80}$")

router = APIRouter(prefix="/api")


class CheckoutBody(BaseModel):
    email: str
    alerts: list[str] = Field(default_factory=list)
    frequency: str = "weekly"
    language: str = "fr"
    borough: str = ""
    street: str = ""
    origin_url: str = ""


class UpdateBody(BaseModel):
    token: str
    alerts: list[str] = Field(default_factory=list)
    frequency: str = "weekly"
    language: str = "fr"
    borough: str = ""
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


def _clean_choices(alerts: list[str], frequency: str, language: str, borough: str, street: str) -> dict:
    import server

    chosen = []
    for alert in alerts:
        if alert in ALERTS and alert not in chosen:
            chosen.append(alert)
    if not chosen:
        raise HTTPException(status_code=400, detail="pick_alert")
    if frequency not in FREQUENCIES:
        raise HTTPException(status_code=400, detail="bad_frequency")
    if language not in LANGS:
        language = "fr"
    borough = (borough or "").strip()
    street = (street or "").strip()[:200]
    if borough:
        names = {item["name"] for item in _boroughs()}
        if borough not in names:
            raise HTTPException(status_code=400, detail="bad_borough")
    if street and not server.street_tokens(street) and server.geocode(street) is None:
        raise HTTPException(status_code=400, detail="street_not_found")
    return {
        "alerts": ",".join(chosen),
        "frequency": frequency,
        "language": language,
        "borough": borough,
        "street": street,
    }


def _boroughs() -> list[dict]:
    import server

    store = server.load_store()
    names = sorted({(row.get(server.BOROUGH_FIELD) or "") for row in store.get("rows", []) if row.get(server.BOROUGH_FIELD)})
    return [{"name": name} for name in names]


def _scope(borough: str, street: str) -> list[dict]:
    import server

    works = server.all_works()
    if borough:
        works = [work for work in works if work["borough"] == borough]
    street = (street or "").strip()
    if not street:
        return works
    tokens = server.street_tokens(street)
    place = server.geocode(street)
    chosen = []
    for work in works:
        folded = server.fold(work["street"])
        street_hit = bool(tokens) and all(token in folded for token in tokens)
        nearby = False
        if place and work["lat"] is not None and work["lng"] is not None:
            nearby = server.haversine(place["lat"], place["lng"], work["lat"], work["lng"]) <= server.NEARBY_RADIUS_M
        if street_hit or nearby:
            chosen.append(work)
    return chosen


def _fingerprint(work: dict) -> dict:
    return {
        "street": work.get("street") or "",
        "borough": work.get("borough") or "",
        "reason": work.get("reason") or "",
        "organization": work.get("organization") or "",
        "submitter": work.get("submitter") or "",
        "status": work.get("status") or "",
        "start": work.get("start") or "",
        "end": work.get("end") or "",
    }


def ensure_snapshot() -> None:
    if SNAPSHOT_PATH.is_file():
        return
    import server

    try:
        works = server.all_works()
    except HTTPException:
        return
    payload = {work["id"]: _fingerprint(work) for work in works if work.get("id")}
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _load_snapshot() -> dict:
    ensure_snapshot()
    if not SNAPSHOT_PATH.is_file():
        return {}
    return json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))


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
    if _ending_soon(work):
        kinds.append("ending")
    return kinds


def changes_for(borough: str, street: str, alerts: list[str]) -> list[dict]:
    import server

    current = {work["id"]: work for work in _scope(borough, street) if work.get("id")}
    previous = _load_snapshot()
    tokens = server.street_tokens(street) if street else []
    scoped_ids = set(current)
    for pid, row in previous.items():
        if borough and row.get("borough") != borough:
            continue
        if tokens:
            folded = server.fold(row.get("street") or "")
            if not all(token in folded for token in tokens):
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
    return {
        "email": meta.get("email") or "",
        "alerts": alerts,
        "frequency": meta.get("frequency") if meta.get("frequency") in FREQUENCIES else "weekly",
        "language": meta.get("language") if meta.get("language") in LANGS else "fr",
        "borough": meta.get("borough") or "",
        "street": meta.get("street") or "",
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


@router.get("/subscribe/preview")
def subscribe_preview(
    borough: str = "",
    q: str = "",
    alerts: str = ",".join(ALERTS),
):
    chosen = [item for item in alerts.split(",") if item in ALERTS] or list(ALERTS)
    borough = borough.strip()
    if borough and borough not in {item["name"] for item in _boroughs()}:
        raise HTTPException(status_code=400, detail="bad_borough")
    works = _scope(borough, q.strip())
    samples = [
        {"id": work["id"], "street": work["street"], "borough": work["borough"], "reason": work["reason"]}
        for work in works[:6]
    ]
    return {
        "count": len(works),
        "samples": samples,
        "changes": changes_for(borough, q.strip(), chosen)[:8],
    }


@router.post("/subscribe/checkout")
def subscribe_checkout(body: CheckoutBody):
    email = body.email.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="bad_email")
    choices = _clean_choices(body.alerts, body.frequency, body.language, body.borough, body.street)
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
    return {
        "paid": paid,
        "email": meta.get("email") or "",
        "alerts": alerts,
        "frequency": meta.get("frequency") or "weekly",
        "language": meta.get("language") or "fr",
        "borough": meta.get("borough") or "",
        "street": meta.get("street") or "",
        "manage_token": meta.get("manage_token") or "",
    }


@router.get("/subscribe")
def subscribe_get(token: str = Query(..., min_length=20, max_length=80)):
    sub = _find_subscription(token)
    public = _public_sub(sub)
    public["changes"] = changes_for(public["borough"], public["street"], public["alerts"])
    return public


@router.patch("/subscribe")
def subscribe_patch(body: UpdateBody):
    sub = _find_subscription(body.token)
    choices = _clean_choices(body.alerts, body.frequency, body.language, body.borough, body.street)
    meta = dict(sub.metadata or {})
    meta.update(choices)
    stripe = _stripe()
    try:
        updated = stripe.Subscription.modify(sub.id, metadata=meta)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="checkout_failed") from exc
    public = _public_sub(updated)
    public["changes"] = changes_for(public["borough"], public["street"], public["alerts"])
    return public
