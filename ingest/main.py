"""
Orchestrate every ingest source, normalize, and write the unified
FeatureCollection to web/data/events.geojson.

Run:
    python -m ingest.main

This is the script GitHub Actions calls on its cron schedule.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from ingest import normalize
from ingest.sources import noaa_nws, usgs

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "web" / "data" / "events.geojson"


SOURCES = [
    ("NOAA NWS", noaa_nws.fetch),
    ("USGS",     usgs.fetch),
]


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    all_events: list[dict] = []
    errors: list[str] = []

    for label, fetch_fn in SOURCES:
        try:
            events = fetch_fn()
            print(f"[{label}] {len(events)} events")
            all_events.extend(events)
        except Exception as exc:  # noqa: BLE001
            msg = f"[{label}] FAILED: {exc}"
            print(msg, file=sys.stderr)
            errors.append(msg)

    fc = normalize.to_feature_collection(all_events)
    fc["generated_at"] = datetime.now(timezone.utc).isoformat()
    fc["sources"] = [label for label, _ in SOURCES]
    fc["errors"] = errors

    OUT_PATH.write_text(json.dumps(fc, separators=(",", ":")))
    print(f"Wrote {len(fc['features'])} features → {OUT_PATH}")

    # If every source failed, exit non-zero so CI flags the run.
    if errors and not all_events:
        sys.exit(1)


if __name__ == "__main__":
    main()
