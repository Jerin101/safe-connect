// M1.2 pilot: which UPAZILA boundary is a position inside? (BBS COD-AB v03 via OCHA HDX, CC BY-IGO, simplified.)
// This only answers "inside the boundary of upazila X". There is no official union boundary, so this must never be
// shown as an exact union. Nothing is wired into the pages yet; no position leaves the phone (CLAUDE.md rule 5).
// The file is kept in its own cache so it works offline after one online visit; see loadPolygons().

export const POLYGON_URL = 'data/pilot/upazila_polygons_pilot.json';
export const POLYGON_CACHE = 'safeconnect-polygons-pilot';

// ring: flat integers (degrees x scale), first pair absolute, then differences. Returns [[lon, lat], ...] closed.
export function decodeRing(flat, scale) {
  const pts = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x += flat[i]; y += flat[i + 1];
    pts.push([x / scale, y / scale]);
  }
  if (pts.length) pts.push(pts[0]);
  return pts;
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

// Decode every feature once; keep the bounding box so most polygons are skipped with four comparisons.
export function prepare(data) {
  const scale = data?.meta?.scale || 100000;
  return (data?.features || []).map((f) => ({
    code: f.code, name_en: f.name_en, district: f.district, bbox: f.bbox,
    polygons: f.rings.map((poly) => poly.map((r) => decodeRing(r, scale))),
  }));
}

// -> { code, name_en, district, level: 'upazila' } or null. Never a union.
export function findUpazila(lat, lon, prepared) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  for (const f of prepared) {
    const [w, s, e, n] = f.bbox;
    if (lon < w || lon > e || lat < s || lat > n) continue;
    for (const poly of f.polygons) {
      if (inRing(lon, lat, poly[0]) && !poly.slice(1).some((h) => inRing(lon, lat, h))) {
        return { code: f.code, name_en: f.name_en, district: f.district, level: 'upazila' };
      }
    }
  }
  return null;
}

// Network first (a fresh copy when online), then the saved copy (offline). The saved copy is replaced only by a
// good answer, so a failed or empty download can never delete the offline copy. Returns the parsed file or null.
// io = { fetchFn, cacheStorage } so tests can run without a browser.
export async function loadPolygons(url = POLYGON_URL, io = {}) {
  const fetchFn = io.fetchFn || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const storage = io.cacheStorage || (typeof caches !== 'undefined' ? caches : null);
  let cache = null;
  try { cache = storage ? await storage.open(POLYGON_CACHE) : null; } catch { cache = null; }
  try {
    if (!fetchFn) throw new Error('no fetch');
    const res = await fetchFn(url, { cache: 'no-cache' });
    if (!res || !res.ok) throw new Error('bad response');
    const copy = res.clone();
    const data = await res.json();
    if (!Array.isArray(data?.features) || !data.features.length) throw new Error('empty file');
    if (cache) { try { await cache.put(url, copy); } catch { /* storage full: still use the fresh data */ } }
    return data;
  } catch {
    try {
      const hit = cache ? await cache.match(url) : null;
      const data = hit ? await hit.json() : null;
      return Array.isArray(data?.features) && data.features.length ? data : null;
    } catch { return null; }
  }
}
