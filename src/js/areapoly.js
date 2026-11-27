// M1.2: which UPAZILA boundary is a position inside? Per-district layers made from BBS COD-AB v03 (OCHA HDX, CC BY-IGO,
// simplified 100 m; see data/polygons/index.json for the source and the modification notice).
// Only upazila (and city corporation) boundaries exist in the official data. There is NO union boundary, so this file
// never says "exact union"; see unioncentre.js for "nearest union centre". Nothing leaves the phone (CLAUDE.md rule 5):
// the position is only compared with files that were downloaded to the phone.
// Offline: every layer is in the service worker file list (service-worker.js), so after one online visit they open offline.
// A position with no polygon (new 2026 upazilas, the sea, outside Bangladesh) gets status 'no_polygon': the caller keeps its
// district / upazila-centre fallback. Nothing is invented. No global variables: createAreaPolygons() keeps its own memory.

export const INDEX_URL = 'data/polygons/index.json';

// ring: flat integers (degrees x scale), first pair absolute, then differences. Returns [[lon, lat], ...] closed.
export function decodeRing(flat, scale) {
  const pts = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) { x += flat[i]; y += flat[i + 1]; pts.push([x / scale, y / scale]); }
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

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const evenInts = (a) => Array.isArray(a) && a.length >= 6 && a.length % 2 === 0 && a.every((v) => Number.isInteger(v));

// A district file is used only if it looks right; a damaged file is treated as "not available", never half-used.
export function validDistrict(doc, code) {
  if (!doc || doc.district?.code !== code || !isNum(doc.meta?.scale) || !doc.meta?.licence || !doc.meta?.modification_notice) return false;
  if (!Array.isArray(doc.upazilas) || !Array.isArray(doc.unions)) return false;
  return doc.upazilas.every((u) => u && typeof u.code === 'string' && Array.isArray(u.bbox) && u.bbox.length === 4 && u.bbox.every(isNum)
    && Array.isArray(u.rings) && u.rings.length > 0 && u.rings.every((poly) => Array.isArray(poly) && poly.length > 0 && poly.every(evenInts)));
}

export function validIndex(idx) {
  return !!idx && Array.isArray(idx.districts) && idx.districts.length > 0
    && idx.districts.every((d) => typeof d.code === 'string' && typeof d.file === 'string' && (d.bbox === null || (Array.isArray(d.bbox) && d.bbox.length === 4 && d.bbox.every(isNum))));
}

// District codes whose box contains the position (small margin, so a point on a district border tries both sides).
export function districtsAt(lat, lon, index, margin = 0.02) {
  if (!isNum(lat) || !isNum(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return [];
  return index.districts.filter((d) => d.bbox && lon >= d.bbox[0] - margin && lon <= d.bbox[2] + margin && lat >= d.bbox[1] - margin && lat <= d.bbox[3] + margin).map((d) => d.code);
}

function prepareDistrict(doc) {
  const scale = doc.meta.scale;
  return doc.upazilas.map((u) => ({ code: u.code, name_en: u.name_en, name_bn: u.name_bn || '', kind: u.kind, lp: u.lp || '', bbox: u.bbox,
    polygons: u.rings.map((poly) => poly.map((r) => decodeRing(r, scale))) }));
}

// Distance in metres from a position to the nearest edge of the polygon it is inside (outer ring and holes).
// The boundaries are simplified (100 m), so any answer closer to an edge than that is uncertain.
export function edgeDistanceM(lat, lon, poly) {
  const mx = 111320 * Math.cos((lat * Math.PI) / 180), my = 110574;
  let best = Infinity;
  for (const ring of poly) {
    for (let i = 0; i < ring.length - 1; i++) {
      const ax = (ring[i][0] - lon) * mx, ay = (ring[i][1] - lat) * my;
      const bx = (ring[i + 1][0] - lon) * mx, by = (ring[i + 1][1] - lat) * my;
      const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

function findIn(prepared, lat, lon) {
  for (const f of prepared) {
    const [w, s, e, n] = f.bbox;
    if (lon < w || lon > e || lat < s || lat > n) continue;
    for (const poly of f.polygons) {
      if (inRing(lon, lat, poly[0]) && !poly.slice(1).some((h) => inRing(lon, lat, h))) return { f, poly };
    }
  }
  return null;
}

// io = { fetchFn } so tests run without a browser. Returns { locate, getDistrict, getIndex }.
export function createAreaPolygons(io = {}) {
  const fetchFn = io.fetchFn || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const memory = new Map();
  let indexPromise = null;

  async function getJson(url) {
    if (!fetchFn) return null;
    try {
      const res = await fetchFn(url, { cache: 'no-cache' });
      return res && res.ok ? await res.json() : null;
    } catch { return null; }
  }
  function getIndex() {
    if (!indexPromise) {
      indexPromise = getJson(INDEX_URL).then((i) => {
        if (!validIndex(i)) { indexPromise = null; return null; }   // a failed or damaged index is retried next time
        return i;
      });
    }
    return indexPromise;
  }
  async function getDistrict(code) {
    if (memory.has(code)) return memory.get(code);
    const idx = await getIndex();
    const entry = idx?.districts.find((d) => d.code === code);
    if (!entry) return null;
    const doc = await getJson(entry.file);
    if (!validDistrict(doc, code)) return null;
    const val = { doc, prepared: prepareDistrict(doc) };
    memory.set(code, val);
    return val;
  }
  // -> { status: 'inside', upazila: {code,name_en,name_bn,kind,lp,level:'upazila'}, district: code, edge_m (metres to the nearest boundary), districtDoc }
  //  | { status: 'no_polygon', districts }   files loaded, the position is in no polygon (sea, outside, 2026 upazila): use the fallback
  //  | { status: 'unavailable' }  nothing could be loaded (offline before the first visit, damaged file): use the fallback
  //  | { status: 'invalid_position' }
  async function locate(lat, lon) {
    if (!isNum(lat) || !isNum(lon)) return { status: 'invalid_position' };
    const idx = await getIndex();
    if (!idx) return { status: 'unavailable' };
    const tried = districtsAt(lat, lon, idx);
    if (!tried.length) return { status: 'no_polygon', districts: [] };
    let loaded = 0;
    for (const code of tried) {
      const d = await getDistrict(code);
      if (!d) continue;
      loaded++;
      const hit = findIn(d.prepared, lat, lon);
      if (hit) {
        const f = hit.f;
        return { status: 'inside', upazila: { code: f.code, name_en: f.name_en, name_bn: f.name_bn, kind: f.kind, lp: f.lp, level: 'upazila' }, district: code,
          edge_m: Math.round(edgeDistanceM(lat, lon, hit.poly)), districtDoc: d.doc };
      }
    }
    return loaded ? { status: 'no_polygon', districts: tried } : { status: 'unavailable' };
  }
  return { locate, getDistrict, getIndex };
}
