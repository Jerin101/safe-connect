// Directions inside the site (no jump to Google Maps): a road route drawn on our own Leaflet map, and a small live
// map whose markers move when a position changes (the rider coming closer, the customer waiting).
// The road route comes from the free OSRM demo server (OpenStreetMap data) and is asked for ONLY when the person taps
// "Show route": the two points are sent to that server then. If it is offline or fails, the straight line stays.

const OSRM = 'https://router.project-osrm.org/route/v1/driving';

// { coords: [[lat, lon], ...], metres, secs } or null
export async function roadRoute(a, b) {
  if (!navigator.onLine) return null;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(`${OSRM}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`, { signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json(); const x = j.routes && j.routes[0];
    if (!x || !x.geometry || !Array.isArray(x.geometry.coordinates)) return null;
    return { coords: x.geometry.coordinates.map(([lon, lat]) => [lat, lon]), metres: x.distance, secs: x.duration };
  } catch { return null; } finally { clearTimeout(t); }
}

// Draw a road route on an existing Leaflet map; returns the layer (remove it with layer.remove()).
export function drawRoad(L, map, route, color = '#0B6E73') {
  const line = L.polyline(route.coords, { color, weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);
  map.fitBounds(line.getBounds(), { padding: [36, 36], maxZoom: 17 });
  return line;
}

// A small live map: you, the goal, and (optional) the other person, joined by a dashed line.
// update({ you, goal, other }) moves the markers; the map refits only when a point leaves the view.
export function createLiveMap(L, box, { el, tiles = true } = {}) {
  const map = L.map(box, { zoomControl: true, tap: true }).setView([23.7, 90.4], 12);
  if (tiles) L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  const marks = {}, pinGroup = L.layerGroup().addTo(map); let line = null, road = null, fitted = false, lastPins = -1;
  const icons = {
    you: () => L.divIcon({ className: 'mk-wrap', html: el('span', 'mk-me'), iconSize: [22, 22], iconAnchor: [11, 11] }),
    goal: () => L.divIcon({ className: 'mk-wrap', html: el('span', 'mk-pin near'), iconSize: [34, 40], iconAnchor: [17, 38] }),
    other: () => L.divIcon({ className: 'mk-wrap', html: el('span', 'mk-pin'), iconSize: [34, 40], iconAnchor: [17, 38] }),
  };
  function put(key, p, label) {
    if (!p) { if (marks[key]) { marks[key].remove(); delete marks[key]; } return; }
    if (marks[key]) marks[key].setLatLng([p.lat, p.lon]);
    else marks[key] = L.marker([p.lat, p.lon], { icon: icons[key](), keyboard: false, title: label || '' }).addTo(map).bindTooltip(el('span', null, label || ''), { direction: 'top', offset: [0, -30] });
  }
  return {
    map,
    // pins: [{ lat, lon, label }] extra points (open calls, active rides) shown as pins
    update({ you, goal, other, pins = [], labels = {} }) {
      put('you', you, labels.you); put('goal', goal, labels.goal); put('other', other, labels.other);
      pinGroup.clearLayers();
      for (const q of pins) L.marker([q.lat, q.lon], { icon: icons.other(), keyboard: false, title: q.label || '' }).addTo(pinGroup).bindTooltip(el('span', null, q.label || ''), { direction: 'top', offset: [0, -30] });
      const a = you || other;
      if (line) { line.remove(); line = null; }
      if (a && goal && !road) line = L.polyline([[a.lat, a.lon], [goal.lat, goal.lon]], { color: '#1F7A4F', weight: 4, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(map);
      const pts = [...Object.values(marks).map((m) => m.getLatLng()), ...pins.map((q) => L.latLng(q.lat, q.lon))];
      if (pts.length && (!fitted || pins.length !== lastPins || !map.getBounds().pad(-0.1).contains(pts[pts.length - 1]))) {
        if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16, animate: false }); else map.setView(pts[0], 15);
        fitted = pts.length > 1; lastPins = pins.length;
      }
    },
    showRoad(route) { if (road) road.remove(); if (line) { line.remove(); line = null; } road = drawRoad(L, map, route); },
    clearRoad() { if (road) { road.remove(); road = null; } },
    destroy() { map.stop(); map.remove(); },
  };
}
