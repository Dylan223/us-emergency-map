"""
NOAA / National Weather Service active alerts.

API: https://api.weather.gov/alerts/active?status=actual&country=US
No API key required, but NOAA REQUIRES a descriptive User-Agent with a
contact method. Set CONTACT_EMAIL env var, or override below.
"""

from __future__ import annotations

import os
from typing import Iterable

import requests

CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "you@example.com")
USER_AGENT = f"us-emergency-map (https://github.com/, {CONTACT_EMAIL})"

NWS_URL = "https://api.weather.gov/alerts/active"

# NOAA severity values, ordered roughly by impact.
SEVERITY_ORDER = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"]


def fetch() -> list[dict]:
    """Return a list of normalized event dicts."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/geo+json",
    }
    resp = requests.get(
        NWS_URL,
        params={"status": "actual", "message_type": "alert,update"},
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    payload = resp.json()

    return list(_normalize(payload.get("features", [])))


def _normalize(features: Iterable[dict]) -> Iterable[dict]:
    """Convert NWS alert features into our unified schema."""
    for feat in features:
        props = feat.get("properties") or {}
        geom = feat.get("geometry")

        event_type = props.get("event") or "Weather Alert"
        severity = (props.get("severity") or "Unknown").strip() or "Unknown"
        if severity not in SEVERITY_ORDER:
            severity = "Unknown"

        yield {
            "id": f"nws:{props.get('id') or feat.get('id')}",
            "source": "NOAA NWS",
            "category": _category_for(event_type),
            "event_type": event_type,
            "severity": severity.lower(),
            "title": props.get("headline") or event_type,
            "description": props.get("description") or "",
            "instruction": props.get("instruction") or "",
            "area": props.get("areaDesc") or "",
            "url": props.get("@id") or "",
            "sender": props.get("senderName") or "",
            "started_at": props.get("effective") or props.get("sent"),
            "ended_at": props.get("expires") or props.get("ends"),
            "geometry": geom,  # Polygon / MultiPolygon, or None
        }


# Lightweight categorization so the frontend can color/group events.
_FIRE = {"Red Flag Warning", "Fire Weather Watch", "Fire Warning"}
_FLOOD = {"Flood Warning", "Flood Watch", "Flood Advisory", "Flash Flood Warning",
          "Flash Flood Watch", "Coastal Flood Warning", "Coastal Flood Advisory",
          "Coastal Flood Watch"}
_TORNADO = {"Tornado Warning", "Tornado Watch"}
_WINTER = {"Winter Storm Warning", "Winter Storm Watch", "Winter Weather Advisory",
           "Blizzard Warning", "Ice Storm Warning"}
_HEAT = {"Excessive Heat Warning", "Excessive Heat Watch", "Heat Advisory"}
_SEVERE = {"Severe Thunderstorm Warning", "Severe Thunderstorm Watch",
           "Severe Weather Statement"}
_HURRICANE = {"Hurricane Warning", "Hurricane Watch", "Tropical Storm Warning",
              "Tropical Storm Watch", "Storm Surge Warning", "Storm Surge Watch"}


def _category_for(event_type: str) -> str:
    if event_type in _TORNADO:
        return "tornado"
    if event_type in _HURRICANE:
        return "hurricane"
    if event_type in _SEVERE:
        return "severe_storm"
    if event_type in _FLOOD:
        return "flood"
    if event_type in _FIRE:
        return "fire_weather"
    if event_type in _WINTER:
        return "winter"
    if event_type in _HEAT:
        return "heat"
    return "weather"
