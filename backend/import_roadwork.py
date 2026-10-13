"""Download the City of Montreal roadwork CSV and store every borough locally.

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
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = (
    "https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d"
    "/resource/cc41b532-f12d-40fb-9f55-eb58c9a2b12b/download/entraves-travaux-en-cours.csv"
)
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
BOROUGH_FIELD = "boroughid"
MHM = "Mercier-Hochelaga-Maisonneuve"
OUT_PATH = Path(__file__).resolve().parent / "data" / "roadwork.json"


def download_csv() -> str:
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
        raise SystemExit("The server returned a web page instead of the CSV. Check the User-Agent header.")

    return raw.decode("utf-8-sig")


def main() -> None:
    text = download_csv()
    rows = []
    for row in csv.DictReader(io.StringIO(text)):
        cleaned = {key: (value.strip() if isinstance(value, str) else value) for key, value in row.items()}
        rows.append(cleaned)

    if not rows:
        raise SystemExit("The CSV did not contain any roadwork rows.")
    if BOROUGH_FIELD not in rows[0]:
        raise SystemExit(f"Expected a {BOROUGH_FIELD} column in the CSV.")

    payload = {
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "source_url": SOURCE_URL,
        "license": "CC-BY-4.0",
        "borough_field": BOROUGH_FIELD,
        "count": len(rows),
        "rows": rows,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    mhm = sum(1 for row in rows if row.get(BOROUGH_FIELD) == MHM)
    print(f"Wrote {OUT_PATH}")
    print(f"rows={len(rows)} borough_field={BOROUGH_FIELD} mhm={mhm}")


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
