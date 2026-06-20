// U.S. Emergency Map  ·  v5  (fixed)
// CARTO Dark Matter tiles (no API key) + animated ocean canvas behind the map.

const DATA_URL = "data/events.geojson";

const CATEGORY_META = {
  tornado:      { color: "#ef4444", label: "Tornado",        short: "Tornado"  }, // vivid red
  hurricane:    { color: "#8b5cf6", label: "Hurricane",      short: "Tropical" },
  severe_storm: { color: "#f59e0b", label: "Severe storm",   short: "Severe"   }, // amber
  flood:        { color: "#0ea5e9", label: "Flood",          short: "Flood"    }, // blue
  fire_weather: { color: "#f97316", label: "Fire weather",   short: "Fire"     }, // orange
  winter:       { color: "#60a5fa", label: "Winter",         short: "Winter"   }, // icy blue
  heat:         { color: "#dc2626", label: "Heat",           short: "Heat"     }, // dark red
  weather:      { color: "#64748b", label: "Other weather",  short: "Other"    }, // slate
  earthquake:   { color: "#10b981", label: "Earthquake",     short: "Quake"    }, // emerald
};

const SEVERITY_META = {
  extreme:  { color: "#ff4d6d", label: "Extreme",  tier: "extreme",  rank: 4 },
  severe:   { color: "#fbbf24", label: "Severe",   tier: "severe",   rank: 3 },
  moderate: { color: "#00d4ff", label: "Moderate", tier: "moderate", rank: 2 },
  minor:    { color: "#34d399", label: "Minor",    tier: "minor",    rank: 1 },
  unknown:  { color: "#6b7884", label: "Unknown",  tier: "unknown",  rank: 0 },
};

const SEVERITY_ORDER = ["extreme", "severe", "moderate", "minor", "unknown"];

const state = {
  features: [],
  enabledCategories: new Set(),
  enabledSeverities: new Set(),
  layers: { points: null, polygons: null },
  generatedAt: null,
};

// --------------------------------------------------------------------------
// Map — CARTO Dark Matter (no API key)
// Map container background is transparent so the ocean canvas behind shows.
// --------------------------------------------------------------------------
const map = L.map("map", {
  center: [39.5, -98.5],
  zoom: 4,
  minZoom: 3,
  worldCopyJump: true,
  zoomControl: false,
  attributionControl: false,
});

L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.attribution({ position: "bottomright", prefix: false })
  .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>')
  .addTo(map);

// CARTO Dark Matter — proven to work without a key. Land tiles.
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
  { subdomains: "abcd", maxZoom: 19, className: "tile-land" }
).addTo(map);

// City / country labels on top
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
  { subdomains: "abcd", maxZoom: 19, opacity: 0.55, className: "tile-labels" }
).addTo(map);

state.layers.polygons = L.layerGroup().addTo(map);

state.layers.points = L.markerClusterGroup({
  disableClusteringAtZoom: 8,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 48,
  showCoverageOnHover: false,
  iconCreateFunction: (cluster) => {
    const n = cluster.getChildCount();
    const size = n < 10 ? 30 : n < 100 ? 36 : 44;
    return L.divIcon({
      html: `<div>${n}</div>`,
      className: `marker-cluster marker-cluster-${n < 10 ? "small" : n < 100 ? "medium" : "large"}`,
      iconSize: [size, size],
    });
  },
}).addTo(map);

// --------------------------------------------------------------------------
// Data
// --------------------------------------------------------------------------
fetch(DATA_URL, { cache: "no-store" })
  .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
  .then((fc) => {
    state.features = fc.features || [];
    state.generatedAt = fc.generated_at || null;
    updateLastUpdated();
    buildFilters();
    renderEvents();
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("last-updated").textContent = "load failed";
    document.getElementById("event-count").textContent = "0";
  });

setInterval(updateLastUpdated, 30000);
setInterval(updateClock, 1000);
updateClock();

// --------------------------------------------------------------------------
// Filters
// --------------------------------------------------------------------------
function buildFilters() {
  const catCounts = countBy(state.features, (f) => f.properties.category);
  const sevCounts = countBy(state.features, (f) => f.properties.severity);

  const catContainer = document.getElementById("category-filters");
  catContainer.innerHTML = "";
  Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    state.enabledCategories.add(cat);
    catContainer.appendChild(filterRow({
      key: cat, color: CATEGORY_META[cat]?.color || "#94a3b8",
      label: CATEGORY_META[cat]?.label || cat, count, set: state.enabledCategories,
    }));
  });

  const sevContainer = document.getElementById("severity-filters");
  sevContainer.innerHTML = "";
  SEVERITY_ORDER.forEach((sev) => {
    if (!(sev in sevCounts)) return;
    state.enabledSeverities.add(sev);
    sevContainer.appendChild(filterRow({
      key: sev, color: SEVERITY_META[sev].color,
      label: SEVERITY_META[sev].label, count: sevCounts[sev], set: state.enabledSeverities,
    }));
  });
}

function filterRow({ key, color, label, count, set }) {
  const row = document.createElement("label");
  row.className = "filter-row";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) set.add(key); else set.delete(key);
    renderEvents();
  });
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = color;
  dot.style.color = color;
  const labelEl = document.createElement("span");
  labelEl.className = "label";
  labelEl.textContent = label;
  const countEl = document.createElement("span");
  countEl.className = "count";
  countEl.textContent = count.toLocaleString();
  row.append(checkbox, dot, labelEl, countEl);
  return row;
}

// --------------------------------------------------------------------------
// Render
// --------------------------------------------------------------------------
function renderEvents() {
  state.layers.points.clearLayers();
  state.layers.polygons.clearLayers();
  const visible = state.features.filter(
    (f) => state.enabledCategories.has(f.properties.category) &&
            state.enabledSeverities.has(f.properties.severity)
  );
  for (const feat of visible) addFeature(feat);
  document.getElementById("event-count").textContent = visible.length.toLocaleString();
  updateSeverityLadder(visible);
  updateBreakdown(visible);
}

function addFeature(feat) {
  const p = feat.properties;
  const cat = CATEGORY_META[p.category] || { color: "#94a3b8" };
  const geom = feat.geometry;

  if (geom && (geom.type === "Polygon" || geom.type === "MultiPolygon")) {
    const cls = p.severity === "extreme" ? "poly-extreme" : p.severity === "severe" ? "poly-severe" : "poly-static";
    const poly = L.geoJSON(geom, {
      style: { color: cat.color, weight: 1.2, fillColor: cat.color, fillOpacity: p.severity === "extreme" ? 0.18 : 0.10, className: cls },
    });
    poly.bindPopup(() => popupHtml(p), { maxWidth: 360 });
    state.layers.polygons.addLayer(poly);
  }

  const rep = p.rep_point || (geom.type === "Point" ? geom.coordinates : null);
  if (!rep) return;
  const [lng, lat] = rep;
  const tier = SEVERITY_META[p.severity]?.tier || "unknown";
  const isQuake = p.category === "earthquake";
  const sizePx = isQuake && typeof p.magnitude === "number" ? Math.max(6, Math.min(20, 4 + p.magnitude * 2.2)) : null;
  const html = `
    <div class="event-marker tier-${tier}${isQuake ? " is-quake" : ""}"
         style="--cat:${cat.color};${sizePx ? `--size:${sizePx}px;` : ""}"
         title="${escapeAttr(p.title || p.event_type || "Event")}">
      <span class="ring"></span>
      ${tier === "extreme" ? '<span class="ring ring-2"></span>' : ""}
      <span class="core"></span>
    </div>`;
  const icon = L.divIcon({ html, className: "", iconSize: [24, 24], iconAnchor: [12, 12] });
  const marker = L.marker([lat, lng], { icon, riseOnHover: true });
  marker.bindPopup(() => popupHtml(p), { maxWidth: 360 });
  state.layers.points.addLayer(marker);
}

// --------------------------------------------------------------------------
// HUD
// --------------------------------------------------------------------------
function updateSeverityLadder(features) {
  const counts = countBy(features, (f) => f.properties.severity);
  const container = document.getElementById("severity-ladder");
  container.innerHTML = "";
  let highestActive = null;
  for (const sev of SEVERITY_ORDER) {
    if ((counts[sev] || 0) > 0 && sev !== "unknown") { highestActive = sev; break; }
  }
  for (const sev of SEVERITY_ORDER) {
    const meta = SEVERITY_META[sev];
    const count = counts[sev] || 0;
    if (count === 0 && sev !== highestActive) continue;
    const row = document.createElement("div");
    row.className = "sev-row";
    if (sev === highestActive) row.classList.add("is-active");
    row.style.color = meta.color;
    row.innerHTML = `<span class="sev-pip"></span><span class="sev-label">${meta.label}</span><span class="sev-count">${count.toLocaleString()}</span>`;
    container.appendChild(row);
  }
  if (!container.children.length) {
    container.innerHTML = `<div class="sev-row"><span></span><span class="sev-label" style="color:var(--text-faint)">No active events</span><span></span></div>`;
  }
}

function updateBreakdown(features) {
  const counts = countBy(features, (f) => f.properties.category);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries.length ? entries[0][1] : 1;
  const container = document.getElementById("breakdown-bars");
  container.innerHTML = "";
  if (!entries.length) {
    container.innerHTML = `<div class="bd-row"><span class="bd-name" style="color:var(--text-faint)">No active events</span><span></span><span></span></div>`;
    return;
  }
  for (const [cat, count] of entries) {
    const meta = CATEGORY_META[cat] || { color: "#94a3b8", short: cat };
    const pct = Math.round((count / max) * 100);
    const row = document.createElement("div");
    row.className = "bd-row";
    row.style.color = meta.color;
    row.innerHTML = `<span class="bd-name">${meta.short}</span><span class="bd-track"><span class="bd-fill" style="width:${pct}%"></span></span><span class="bd-count">${count.toLocaleString()}</span>`;
    container.appendChild(row);
  }
}

// --------------------------------------------------------------------------
// Popup
// --------------------------------------------------------------------------
function popupHtml(p) {
  const catMeta = CATEGORY_META[p.category] || { color: "#94a3b8", label: p.category };
  const sevMeta = SEVERITY_META[p.severity] || { color: "#94a3b8", label: p.severity };
  const desc = (p.description || "").slice(0, 1200);
  const time = p.started_at ? new Date(p.started_at).toLocaleString() : "";
  return `
    <div class="popup-title">${escapeHtml(p.title || p.event_type || "Event")}</div>
    <div class="popup-badges">
      <span class="badge" style="background:${catMeta.color}26;color:${catMeta.color};">${escapeHtml(catMeta.label)}</span>
      <span class="badge" style="background:${sevMeta.color}26;color:${sevMeta.color};">${escapeHtml(sevMeta.label)}</span>
      <span class="badge" style="background:#1a2330;color:#8a9bab;">${escapeHtml(p.source || "")}</span>
    </div>
    ${p.area ? `<div class="popup-area">${escapeHtml(p.area)}</div>` : ""}
    ${time ? `<div class="popup-area">Started ${escapeHtml(time)}</div>` : ""}
    ${desc ? `<div class="popup-desc">${escapeHtml(desc)}</div>` : ""}
    ${p.url ? `<a class="popup-link" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">VIEW SOURCE →</a>` : ""}`;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function countBy(arr, keyFn) {
  const out = {};
  for (const item of arr) { const k = keyFn(item); if (!k) continue; out[k] = (out[k] || 0) + 1; }
  return out;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
}
function escapeAttr(s) { return escapeHtml(s).replace(/javascript:/gi, ""); }

function updateLastUpdated() {
  const el = document.getElementById("last-updated");
  if (!state.generatedAt) { el.textContent = "—"; return; }
  const then = new Date(state.generatedAt).getTime();
  if (Number.isNaN(then)) { el.textContent = "—"; return; }
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  let s;
  if (secs < 60) s = `${secs}s ago`;
  else if (secs < 3600) s = `${Math.floor(secs / 60)}m ago`;
  else if (secs < 86400) s = `${Math.floor(secs / 3600)}h ago`;
  else s = `${Math.floor(secs / 86400)}d ago`;
  el.textContent = s;
}

function updateClock() {
  const el = document.getElementById("clock-time");
  if (!el) return;
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const tz = (d.toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop() || "").slice(0, 4);
  el.textContent = `${hh}:${mm} ${tz}`;
}

document.getElementById("sidebar-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

(() => {
  const a = document.getElementById("repo-link");
  const host = window.location.hostname;
  if (host.endsWith("github.io")) {
    const user = host.split(".")[0];
    const path = window.location.pathname.split("/").filter(Boolean);
    if (path.length) a.href = `https://github.com/${user}/${path[0]}`;
  }
})();
