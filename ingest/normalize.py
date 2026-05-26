"""
Convert source-specific event dicts into a unified GeoJSON
FeatureCollection that the frontend can consume directly.

Each Feature has either a Point geometry (single location) or a Polygon/
MultiPolygon (a region, e.g. a tornado warning area). The frontend
detects the geometry type and renders accordingly.
"""

from __future__ import annotations

from typing import Iterable


def to_feature_collection(events: Iterable[dict]) -> dict:
    features = []
    for ev in events:
        geom = ev.get("geometry")
        if not geom:
            continue
        # NWS sometimes returns null geometry for zone-only alerts; skip those.
        if geom.get("type") not in ("Point", "Polygon", "MultiPolygon"):
            continue

        # Always also include a representative point for marker rendering.
        rep = _representative_point(geom)

        props = {k: v for k, v in ev.items() if k != "geometry"}
        props["rep_point"] = rep  # [lng, lat]

        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": props,
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def _representative_point(geom: dict) -> list[float] | None:
    """Cheap centroid: works well enough for clustering / marker placement."""
    g = geom.get("type")
    coords = geom.get("coordinates")
    if g == "Point":
        return [coords[0], coords[1]]
    if g == "Polygon":
        return _ring_centroid(coords[0])
    if g == "MultiPolygon":
        # Pick the largest ring's centroid.
        biggest = max(coords, key=lambda p: len(p[0]))
        return _ring_centroid(biggest[0])
    return None


def _ring_centroid(ring: list[list[float]]) -> list[float]:
    n = len(ring)
    if n == 0:
        return [0.0, 0.0]
    x = sum(p[0] for p in ring) / n
    y = sum(p[1] for p in ring) / n
    return [x, y]
