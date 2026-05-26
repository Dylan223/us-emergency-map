# ⚡ U.S. Emergency Map

An interactive map of live U.S. weather alerts, earthquakes, and emergency
events. Data is pulled from official government feeds (NOAA NWS, USGS) every
15 minutes by a GitHub Actions cron and rendered with Leaflet on a static
frontend.

> Inspired by [InfraMap](https://inframap.org) — the goal is the same: take
> data that's scattered across a dozen government portals and put it on one
> map where students, journalists, and citizens can actually use it.

**Live demo:** _add your GitHub Pages URL here once deployed_

---

## What it shows

| Source | Data | Refresh |
|---|---|---|
| [NOAA / NWS](https://www.weather.gov/) | Active weather alerts: tornadoes, floods, severe storms, fire weather, winter storms, heat, hurricanes | Every 15 min |
| [USGS](https://earthquake.usgs.gov/) | Earthquakes in the past 24 hours, magnitude 2.5+, U.S. region | Every 15 min |

The map shows polygons (NWS alert regions) and markers (earthquake epicenters)
color-coded by event type, with severity-based sizing. Click any marker or
polygon for the full alert text and a link to the source.

---

## How it works

```
GitHub Actions cron (every 15 min)
        │
        ▼
ingest/main.py
        │
        ├── ingest/sources/noaa_nws.py   ← fetches NOAA active alerts
        ├── ingest/sources/usgs.py       ← fetches USGS past-day quakes
        │
        ▼
ingest/normalize.py
        │
        ▼
web/data/events.geojson  ← committed back to the repo
        │
        ▼
GitHub Pages (free static hosting)
        │
        ▼
web/index.html + Leaflet  ← what users see
```

No backend server, no database hosting, no API keys, **$0/month forever**.
The entire pipeline runs inside GitHub.

---

## Repository layout

```
.
├── ingest/                     Python data pipeline
│   ├── main.py                 Orchestrator
│   ├── normalize.py            Convert sources → unified GeoJSON
│   └── sources/
│       ├── noaa_nws.py         NOAA NWS active alerts
│       └── usgs.py             USGS earthquakes
├── web/                        Static frontend (served by GitHub Pages)
│   ├── index.html
│   ├── style.css
│   ├── app.js                  Leaflet map + filters
│   └── data/events.geojson     Auto-generated, committed by Actions
├── .github/workflows/
│   └── ingest.yml              Cron + manual workflow
├── requirements.txt
└── README.md
```

---

## Deployment guide

### 1. Create the repo on GitHub

1. Go to https://github.com/new
2. Name it something like `us-emergency-map`
3. **Public**, no README / .gitignore / license (leave empty)
4. Create

### 2. Push this code

```bash
unzip us-emergency-map.zip
cd us-emergency-map
git init
git branch -M main
git add .
git commit -m "Initial commit: emergency map scaffold"
git remote add origin https://github.com/YOUR_USERNAME/us-emergency-map.git
git push -u origin main
```

### 3. Enable GitHub Pages

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/web`
4. Save.
5. After ~1 minute, your site is live at `https://YOUR_USERNAME.github.io/us-emergency-map/`

### 4. (Optional but recommended) Set a contact email

NOAA's API asks for a contact in the `User-Agent` header. Without one,
requests usually still work, but they may rate-limit you during high traffic.

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Name: `CONTACT_EMAIL`, value: your email
3. Save.

### 5. Trigger the first data refresh

The cron runs every 15 minutes, but the first time you want to populate the
map immediately:

1. Repo → **Actions** → **Refresh emergency data**
2. Click **Run workflow** → **Run workflow**
3. Wait ~30 seconds; you'll see a new commit appear (`auto: refresh emergency data ...`)
4. Refresh your GitHub Pages site — events should now be on the map

---

## Running it locally

```bash
pip install -r requirements.txt
python -m ingest.main          # writes web/data/events.geojson

# Serve the frontend (any static server works)
cd web && python -m http.server 8000
# → open http://localhost:8000
```

---

## Architecture decisions

### Why a static site with a cron job, not a server?

Live-data maps usually use a backend that proxies APIs in real time. That
adds hosting cost, an attack surface, and rate-limit risk. Instead, this
project uses the **"static site that updates itself"** pattern: a cron job
fetches the data, commits the file, and the frontend just reads a JSON file
like any other static asset. Costs nothing, scales to any traffic level
GitHub Pages handles (a lot), and has no secrets to leak.

The trade-off is freshness — data is at most ~15 minutes stale. For most
emergency-awareness use cases that's fine. For a true "right now" view
(e.g. lightning strikes, tornado-on-the-ground), you'd want WebSockets and a
backend, which is out of scope here.

### Why GeoJSON, not a database?

Every entity on the map is a feature with geometry and properties — that's
literally what GeoJSON is for. The whole dataset (a few thousand active
events at peak weather) is small enough to ship as one file (~1-5 MB
uncompressed, much smaller after gzip). The frontend filters and renders
client-side, so the user gets instant interactivity with no backend round-trips.

If the data ever grew too large for a single file (historical archive,
nationwide outages), the right next step is to **partition by time and
geography** — e.g. one file per state per day — and load tiles on demand.
The schema doesn't have to change.

### Why CARTO Dark Matter tiles?

Free, attribution-only, look great. Mapbox would be more flexible (custom
styles) but starts costing money past 50k loads/month, which a popular open
project can hit fast. The two are interchangeable — swap one URL in `app.js`.

---

## Adding new data sources

Each source is its own file under `ingest/sources/`. To add one:

1. Create `ingest/sources/your_source.py` with a `fetch()` function that
   returns a list of event dicts in the unified schema. The fields are
   documented in `ingest/normalize.py`; the only hard requirement is a
   GeoJSON-shaped `geometry` field on each event.
2. Add it to the `SOURCES` list in `ingest/main.py`.
3. (Optional) Add a new category and color in `web/app.js` under
   `CATEGORY_META`.

Good candidates:

- **OpenFEMA** — disaster declarations (historical, daily refresh enough)
- **InciWeb** — active wildfires (RSS feed)
- **PurpleAir** — air quality sensors (free API key)
- **GDELT** — global news events with lat/lng, for an "events people are
  talking about" overlay
- **EIA Open Data** — power outages by state
- **Local 911 / CAD feeds** — for any city that publishes them

---

## Roadmap

- [ ] Time slider (scrub back 24h / 7d / 30d)
- [ ] Historical archive (commit a snapshot daily to `archive/YYYY-MM-DD.geojson`)
- [ ] Email / RSS subscribe by area
- [ ] OpenFEMA + InciWeb layers
- [ ] Severity-based marker animation (pulsing for active extreme alerts)

---

## License

MIT. Built as an open-source portfolio project. Data is from public
government APIs and remains under their respective terms (NOAA, USGS).
