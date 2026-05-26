"""
USGS earthquake feed.

API: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/
We pull "all earthquakes in the past day" and filter to the US bounding
box. No key required.
"""

from __future__ import annotations

from typing import Iterable

import requests

USGS_URL = (
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
)

# Loose bounding box for the contiguous US + Alaska + Hawaii + PR.
# (min_lng, min_lat, max_lng, max_lat). We accept anything inside this box.
US_BBOX = (-180.0, 15.0, -65.0, 72.0)


def fetch() -> list[dict]:
    resp = requests.get(USGS_URL, timeout=30)
    resp.raise_for_status()
    payload = resp.json()
    return list(_normalize(payload.get("features", [])))


def _normalize(features: Iterable[dict]) -> Iterable[dict]:
    for feat in features:
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        lng, lat = coords[0], coords[1]
        if not _in_us(lng, lat):
            continue

        props = feat.get("properties") or {}
        mag = props.get("mag")
        if mag is None:
            continue

        yield {
            "id": f"usgs:{feat.get('id')}",
            "source": "USGS",
            "category": "earthquake",
            "event_type": "Earthquake",
            "severity": _severity_for(mag),
            "title": props.get("title") or f"M{mag} earthquake",
            "description": props.get("place") or "",
            "instruction": "",
            "area": props.get("place") or "",
            "url": props.get("url") or "",
            "sender": "USGS",
            "started_at": _ms_to_iso(props.get("time")),
            "ended_at": None,
            "magnitude": mag,
            "depth_km": coords[2] if len(coords) > 2 else None,
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
        }


def _in_us(lng: float, lat: float) -> bool:
    return US_BBOX[0] <= lng <= US_BBOX[2] and US_BBOX[1] <= lat <= US_BBOX[3]


def _severity_for(mag: float) -> str:
    if mag >= 6.0:
        return "extreme"
    if mag >= 5.0:
        return "severe"
    if mag >= 4.0:
        return "moderate"
    if mag >= 3.0:
        return "minor"
    return "unknown"


def _ms_to_iso(ms: int | None) -> str | None:
    if ms is None:
        return None
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()
