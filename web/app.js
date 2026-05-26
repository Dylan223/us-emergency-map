// U.S. Emergency Map — frontend logic
// Loads web/data/events.geojson and renders an interactive Leaflet map.

const DATA_URL = "data/events.geojson";

// --------------------------------------------------------------------------- //
// Color palette by category and severity                                      //
// --------------------------------------------------------------------------- //
const CATEGORY_META = {
  tornado:      { color: "#ef4444", label: "Tornado" },
  hurricane:    { color: "#a855f7", label: "Hurricane / Tropical" },
  severe_storm: { color: "#f59e0b", label: "Severe Storm" },
  flood:        { color: "#3b82f6", label: "Flood" },
  fire_weather: { color: "#f97316", label: "Fire Weather" },
  winter:       { color: "#7dd3fc", label: "Winter" },
  heat:         { color: "#dc2626", label: "Heat" },
  weather:      { color: "#94a3b8", label: "Other Weather" },
  earthquake:   { color: "#10b981", label: "Earthquake" },
};

const SEVERITY_META = {
  extreme:  { color: "#dc2626", label: "Extreme" },
  severe:   { color: "#f97316", label: "Severe" },
  moderate: { color: "#facc15", label: "Moderate" },
  minor:    { color: "#10b981", label: "Minor" },
  unknown:  { color: "#94a3b8", label: "Unknown" },
};

// --------------------------------------------------------------------------- //
// State                                                                       //
// --------------------------------------------------------------------------- //
const state = {
  features: [],
  enabledCategories: new Set(),
  enabledSeverities: new Set(),
  layers: { points: null, polygons: null },
};

// --------------------------------------------------------------------------- //
// Map init                                                                    //
// --------------------------------------------------------------------------- //
const map = L.map("map", {
  center: [39.5, -98.5], // continental US center
  zoom: 4,
  minZoom: 3,
  worldCopyJump: true,
  zoomControl: false,
});
L.control.zoom({ position: "bottomright" }).addTo(map);

// CartoDB Dark Matter — free, attribution-only.
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' +
      ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }
).addTo(map);

state.layers.polygons = L.layerGroup().addTo(map);
state.layers.points = L.markerClusterGroup({
  disableClusteringAtZoom: 8,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: 50,
}).addTo(map);

// --------------------------------------------------------------------------- //
// Load + render                                                               //
// --------------------------------------------------------------------------- //
fetch(DATA_URL, { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw new Error(`Failed to load ${DATA_URL}: ${r.status}`);
    return r.json();
  })
  .then((fc) => {
    state.features = fc.features || [];
    document.getElementById("last-updated").textContent =
      formatRelative(fc.generated_at);

    buildFilters();
    renderEvents();
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("last-updated").textContent = "load failed";
    document.getElementById("event-count").textContent = "0";
    alert(
      "Could not load events.geojson. If you just deployed, the first ingest " +
      "may not have run yet — trigger the GitHub Action manually under " +
      "Actions → Refresh emergency data → Run workflow."
    );
  });

// --------------------------------------------------------------------------- //
// Filter UI                                                                   //
// --------------------------------------------------------------------------- //
function buildFilters() {
  const catCounts = countBy(state.features, (f) => f.properties.category);
  const sevCounts = countBy(state.features, (f) => f.properties.severity);

  const catContainer = document.getElementById("category-filters");
  catContainer.innerHTML = "";
  // Show every category that has at least one event, sorted by count.
  Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      state.enabledCategories.add(cat);
      catContainer.appendChild(
        filterRow({
          key: cat,
          color: CATEGORY_META[cat]?.color || "#94a3b8",
          label: CATEGORY_META[cat]?.label || cat,
          count,
          set: state.enabledCategories,
        })
      );
    });

  const sevContainer = document.getElementById("severity-filters");
  sevContainer.innerHTML = "";
  ["extreme", "severe", "moderate", "minor", "unknown"].forEach((sev) => {
    if (!(sev in sevCounts)) return;
    state.enabledSeverities.add(sev);
    sevContainer.appendChild(
      filterRow({
        key: sev,
        color: SEVERITY_META[sev].color,
        label: SEVERITY_META[sev].label,
        count: sevCounts[sev],
        set: state.enabledSeverities,
      })
    );
  });
}

function filterRow({ key, color, label, count, set }) {
  const row = document.createElement("label");
  row.className = "filter-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) set.add(key);
    else set.delete(key);
    renderEvents();
  });

  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = color;

  const labelEl = document.createElement("span");
  labelEl.className = "label";
  labelEl.textContent = label;

  const countEl = document.createElement("span");
  countEl.className = "count";
  countEl.textContent = count;

  row.append(checkbox, dot, labelEl, countEl);
  return row;
}

// --------------------------------------------------------------------------- //
// Render events                                                               //
// --------------------------------------------------------------------------- //
function renderEvents() {
  state.layers.points.clearLayers();
  state.layers.polygons.clearLayers();

  let shown = 0;
  for (const feat of state.features) {
    const p = feat.properties;
    if (!state.enabledCategories.has(p.category)) continue;
    if (!state.enabledSeverities.has(p.severity)) continue;

    addFeature(feat);
    shown++;
  }
  document.getElementById("event-count").textContent = shown.toLocaleString();
}

function addFeature(feat) {
  const p = feat.properties;
  const color = CATEGORY_META[p.category]?.color || "#94a3b8";
  const sevColor = SEVERITY_META[p.severity]?.color || "#94a3b8";
  const geom = feat.geometry;

  // Polygon outlines.
  if (geom && (geom.type === "Polygon" || geom.type === "MultiPolygon")) {
    const poly = L.geoJSON(geom, {
      style: {
        color: color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.18,
      },
    });
    poly.bindPopup(() => popupHtml(p));
    state.layers.polygons.addLayer(poly);
  }

  // Marker (representative point).
  const rep = p.rep_point || (geom.type === "Point" ? geom.coordinates : null);
  if (!rep) return;
  const [lng, lat] = rep;

  const radius = sizeFor(p);
  const marker = L.circleMarker([lat, lng], {
    radius,
    color: "#0e1117",
    weight: 1,
    fillColor: color,
    fillOpacity: 0.9,
  });
  marker.bindPopup(() => popupHtml(p), { maxWidth: 360 });
  state.layers.points.addLayer(marker);
}

function sizeFor(p) {
  // Earthquakes scale by magnitude.
  if (p.category === "earthquake" && typeof p.magnitude === "number") {
    return Math.max(4, Math.min(18, 3 + p.magnitude * 2));
  }
  // Others scale by severity.
  return { extreme: 10, severe: 8, moderate: 6, minor: 5, unknown: 5 }[
    p.severity
  ] || 5;
}

function popupHtml(p) {
  const catMeta = CATEGORY_META[p.category] || { color: "#94a3b8", label: p.category };
  const sevMeta = SEVERITY_META[p.severity] || { color: "#94a3b8", label: p.severity };

  const desc = (p.description || "").slice(0, 1200);
  const time = p.started_at ? new Date(p.started_at).toLocaleString() : "";

  return `
    <div class="popup-title">${escapeHtml(p.title || p.event_type || "Event")}</div>
    <div class="popup-badges">
      <span class="badge" style="background:${catMeta.color}26;color:${catMeta.color};">${catMeta.label}</span>
      <span class="badge" style="background:${sevMeta.color}26;color:${sevMeta.color};">${sevMeta.label}</span>
      <span class="badge" style="background:#1f2937;color:#b1bccc;">${escapeHtml(p.source || "")}</span>
    </div>
    ${p.area ? `<div class="popup-area">${escapeHtml(p.area)}</div>` : ""}
    ${time ? `<div class="popup-area">Started ${escapeHtml(time)}</div>` : ""}
    ${desc ? `<div class="popup-desc">${escapeHtml(desc)}</div>` : ""}
    ${p.url ? `<a class="popup-link" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">View source →</a>` : ""}
  `;
}

// --------------------------------------------------------------------------- //
// Helpers                                                                     //
// --------------------------------------------------------------------------- //
function countBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item);
    if (!k) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/javascript:/gi, "");
}

function formatRelative(iso) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// --------------------------------------------------------------------------- //
// Sidebar toggle (mobile) + repo link                                         //
// --------------------------------------------------------------------------- //
document.getElementById("sidebar-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// Auto-populate the "View source" footer link with the GitHub repo URL
// inferred from window.location (works on GitHub Pages and Vercel).
(() => {
  const a = document.getElementById("repo-link");
  const host = window.location.hostname;
  if (host.endsWith("github.io")) {
    const user = host.split(".")[0];
    const path = window.location.pathname.split("/").filter(Boolean);
    if (path.length) a.href = `https://github.com/${user}/${path[0]}`;
  }
})();
