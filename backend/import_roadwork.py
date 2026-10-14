"""Download City of Montreal roadwork + occupancy-impact CSVs.

Joins impacts onto permits by request id (impacts.id_request = roadwork.id).
The open-data server refuses downloads that do not look like a browser, so this
script always sends a normal browser User-Agent.

Run once a day:

    python import_roadwork.py
"""

from __future__ import annotations

import csv
import io
import json
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from impacts import empty_flags, impact_payload, merge_impact_row

SOURCE_URL = (
    "https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d"
    "/resource/cc41b532-f12d-40fb-9f55-eb58c9a2b12b/download/entraves-travaux-en-cours.csv"
)
IMPACTS_URL = (
    "https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d"
    "/resource/a2bc8014-488c-495d-941b-e7ae1999d1bd/download/impacts-entraves-travaux-en-cours.csv"
)
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
BOROUGH_FIELD = "boroughid"
MHM = "Mercier-Hochelaga-Maisonneuve"
OUT_PATH = Path(__file__).resolve().parent / "data" / "roadwork.json"


def download_csv(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA})
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"Download failed with HTTP {exc.code}. A browser User-Agent is required.") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Download failed: {exc.reason}") from exc

    head = raw[:400].lstrip().lower()
    if head.startswith(b"<!doctype") or head.startswith(b"<html") or b"<html" in head:
        raise SystemExit("The server returned a web page instead of the CSV. Check the User-Agent header.")

    return raw.decode("utf-8-sig")


def read_rows(text: str) -> list[dict]:
    rows = []
    for row in csv.DictReader(io.StringIO(text)):
        cleaned = {key: (value.strip() if isinstance(value, str) else value) for key, value in row.items()}
        rows.append(cleaned)
    return rows


def join_impacts(works: list[dict], impact_rows: list[dict]) -> None:
    by_id: dict[str, list[dict]] = defaultdict(list)
    for row in impact_rows:
        key = (row.get("id_request") or "").strip()
        if key:
            by_id[key].append(row)

    matched = 0
    for work in works:
        flags = empty_flags()
        related = by_id.get(work.get("id") or "", [])
        if not related:
            permit = (work.get("permit_permit_id") or "").strip()
            related = by_id.get(permit, [])
        for row in related:
            merge_impact_row(flags, row)
        work["impact"] = impact_payload(flags)
        if related:
            matched += 1
    return matched


def main() -> None:
    work_text = download_csv(SOURCE_URL)
    rows = read_rows(work_text)
    if not rows:
        raise SystemExit("The CSV did not contain any roadwork rows.")
    if BOROUGH_FIELD not in rows[0]:
        raise SystemExit(f"Expected a {BOROUGH_FIELD} column in the CSV.")

    impact_rows = read_rows(download_csv(IMPACTS_URL))
    matched = join_impacts(rows, impact_rows)
    closing = sum(1 for row in rows if (row.get("impact") or {}).get("closes"))

    payload = {
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "source_url": SOURCE_URL,
        "impacts_url": IMPACTS_URL,
        "license": "CC-BY-4.0",
        "borough_field": BOROUGH_FIELD,
        "count": len(rows),
        "impacts_count": len(impact_rows),
        "impacts_matched": matched,
        "closing_count": closing,
        "rows": rows,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    mhm = sum(1 for row in rows if row.get(BOROUGH_FIELD) == MHM)
    print(f"Wrote {OUT_PATH}")
    print(
        f"rows={len(rows)} impacts={len(impact_rows)} matched={matched} "
        f"closing={closing} borough_field={BOROUGH_FIELD} mhm={mhm}"
    )


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
