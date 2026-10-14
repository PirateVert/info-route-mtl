"""Email alerts for paid My Places: new closures, plus a Sunday summary.

Requires STRIPE_SECRET_KEY and SMTP_* environment variables.

    python send_alerts.py           # new closure / no-parking alerts
    python send_alerts.py --weekly  # force the Sunday summary
"""

from __future__ import annotations

import argparse
import json
import os
import smtplib
import ssl
import sys
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / "data" / "alert_state.json"
DISCLAIMER_FR = "La signalisation dans la rue a toujours préséance."
DISCLAIMER_EN = "Street signs always take precedence."
TZ = ZoneInfo("America/Toronto")


def _load_env() -> None:
    path = ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _state() -> dict:
    if not STATE_PATH.is_file():
        return {}
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def _save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _smtp_ready() -> bool:
    return bool((os.environ.get("SMTP_HOST") or "").strip() and (os.environ.get("ALERT_FROM") or os.environ.get("SMTP_USER") or "").strip())


def _send(to_email: str, subject: str, body: str) -> None:
    if not _smtp_ready():
        print(f"SMTP not configured; skip {to_email}: {subject}")
        return
    host = os.environ.get("SMTP_HOST") or ""
    port = int(os.environ.get("SMTP_PORT") or "587")
    user = os.environ.get("SMTP_USER") or ""
    password = os.environ.get("SMTP_PASSWORD") or ""
    from_addr = os.environ.get("ALERT_FROM") or user
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = from_addr
    message["To"] = to_email
    message.set_content(body)
    context = ssl.create_default_context()
    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.starttls(context=context)
        if user:
            smtp.login(user, password)
        smtp.send_message(message)


def _iter_subs():
    from subscriptions import _public_sub, _stripe

    stripe = _stripe()
    starting_after = None
    for _ in range(20):
        page = stripe.Subscription.list(status="active", limit=100, starting_after=starting_after)
        for sub in page.data:
            yield _public_sub(sub), sub
        if not page.has_more or not page.data:
            break
        starting_after = page.data[-1].id


def _status_lines(places: list[dict], lang: str) -> list[str]:
    from places import place_status
    import server

    sites = server.all_sites()
    lots = server.load_snow_store().get("rows") or []
    lines = []
    for place in places:
        status = place_status(place, sites, lots, lang)
        lines.append(status.get("headline") or "")
    return [line for line in lines if line]


def _new_hits(places: list[dict], seen: set[str]) -> list[dict]:
    from places import match_sites
    import server

    sites = server.all_sites()
    found = []
    for place in places:
        for site in match_sites(place, sites):
            if not site.get("closes"):
                continue
            kinds = []
            if site.get("no_parking"):
                kinds.append("parking")
            if site.get("street_closed") or site.get("lane_closed") or site.get("sidewalk_closed"):
                kinds.append("closure")
            if not kinds:
                continue
            key = f"{place.get('query')}|{site.get('id')}|{','.join(kinds)}"
            if key in seen:
                continue
            found.append({"key": key, "place": place, "site": site, "kinds": kinds})
    return found


def _body(lang: str, intro: str, lines: list[str]) -> str:
    disclaimer = DISCLAIMER_FR if lang != "en" else DISCLAIMER_EN
    never = (
        "Ce n'est pas une garantie contre le remorquage."
        if lang != "en"
        else "This is not a guarantee against towing."
    )
    return "\n".join([intro, "", *lines, "", disclaimer, never])


def main() -> int:
    _load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--weekly", action="store_true")
    args = parser.parse_args()
    today = datetime.now(TZ)
    weekly = args.weekly or today.weekday() == 6
    state = _state()

    try:
        subs = list(_iter_subs())
    except Exception as exc:
        print(f"No paid subscribers loaded: {exc}")
        return 0

    for public, sub in subs:
        email = public.get("email") or ""
        if not email:
            continue
        lang = public.get("language") or "fr"
        if lang == "both":
            langs = ["fr", "en"]
        else:
            langs = [lang if lang in {"fr", "en"} else "fr"]
        key = (sub.id if hasattr(sub, "id") else email)
        row = state.get(key) or {"seen": [], "last_weekly": ""}
        seen = set(row.get("seen") or [])
        hits = _new_hits(public.get("places") or [], seen)
        # Paid plan always emails new closure / no-parking on saved places.
        hits = [hit for hit in hits if any(kind in {"closure", "parking"} for kind in hit["kinds"])]
        if hits:
            for use_lang in langs:
                lines = []
                for hit in hits:
                    from places import headline_for
                    label = hit["place"].get("label") or hit["place"].get("query") or ""
                    lines.append(f"{label}: {headline_for(hit['site'], use_lang)}")
                subject = "Info-Route MTL — nouvelle fermeture" if use_lang == "fr" else "Info-Route MTL — new closure"
                intro = (
                    "Une nouvelle fermeture ou interdiction de stationner touche un de vos endroits."
                    if use_lang == "fr"
                    else "A new closure or no-parking rule affects one of your places."
                )
                _send(email, subject, _body(use_lang, intro, lines))
            for hit in hits:
                seen.add(hit["key"])
        if weekly and row.get("last_weekly") != today.date().isoformat():
            for use_lang in langs:
                lines = _status_lines(public.get("places") or [], use_lang)
                if not lines:
                    lines = ["OK"]
                subject = "Info-Route MTL — résumé du dimanche" if use_lang == "fr" else "Info-Route MTL — Sunday summary"
                intro = (
                    "Voici le résumé de vos endroits pour la semaine."
                    if use_lang == "fr"
                    else "Here is this week's summary for your places."
                )
                _send(email, subject, _body(use_lang, intro, lines))
            row["last_weekly"] = today.date().isoformat()
        row["seen"] = list(seen)[-400:]
        state[key] = row

    _save_state(state)
    print(f"alerts processed subscribers={len(subs)} weekly={weekly}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
