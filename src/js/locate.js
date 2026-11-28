// M1.3: one answer for "which area is this position in?" with the five rules of workstream D, on top of the official BBS
// boundaries (js/areapoly.js). It never invents an area and never names a union (see unioncentre.js for "nearest union centre").
//   inside              the position is inside one upazila / city corporation boundary and no other is within NEAR_M
//   near-boundary       within about 3 km of a boundary: BOTH sides are returned, nearest first, so the page can show both
//   no-polygon          inside the country's box but in no boundary and none within 3 km: sea, a border strip, or an area created
//                       after 2023. The official data has no sea zone, so this is "unknown", NOT claimed to be sea
//   outside-bangladesh  clearly outside the country's box (20.5-26.7 N, 88.0-92.7 E, a generous box)
//   invalid / unavailable   not numbers / the boundary files could not be read (offline before the first visit): the caller uses its fallback
// Everything runs on the phone against files saved on the phone; the position is never stored or sent (CLAUDE.md rule 5).
import { edgeDistanceM, districtsAt } from './areapoly.js';

export const NEAR_M = 3000;
export const BOX = { south: 20.5, north: 26.7, west: 88.0, east: 92.7 };
export const inCountryBox = (lat, lon) => lat >= BOX.south && lat <= BOX.north && lon >= BOX.west && lon <= BOX.east;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const brief = (u, extra = {}) => ({ code: u.code, name_en: u.name_en, name_bn: u.name_bn || '', kind: u.kind, level: 'upazila', ...extra });

// Units of the districts around the position whose box is within NEAR_M, with the distance to their nearest edge.
async function candidates(lat, lon, service, idx, insideCode) {
  const pad = (NEAR_M / 111000) + 0.01;
  const out = [];
  for (const code of districtsAt(lat, lon, idx, pad)) {
    const d = await service.getDistrict(code);
    if (!d) continue;
    for (const f of d.prepared) {
      const [w, s, e, n] = f.bbox;
      if (lon < w - pad || lon > e + pad || lat < s - pad || lat > n + pad) continue;
      let best = Infinity;
      for (const poly of f.polygons) best = Math.min(best, edgeDistanceM(lat, lon, poly));
      if (best <= NEAR_M || f.code === insideCode) out.push({ f, distance_m: Math.round(best) });
    }
  }
  return out;
}

// service = createAreaPolygons() from areapoly.js (must expose getDistrict and getIndex)
export async function locateArea(lat, lon, service) {
  if (!isNum(lat) || !isNum(lon)) return { kind: 'invalid' };
  if (!inCountryBox(lat, lon)) return { kind: 'outside-bangladesh' };
  const here = await service.locate(lat, lon);
  if (here.status === 'unavailable') return { kind: 'unavailable' };
  const idx = await service.getIndex();
  if (!idx) return { kind: 'unavailable' };
  const near = await candidates(lat, lon, service, idx, here.status === 'inside' ? here.upazila.code : null);
  if (here.status === 'inside') {
    const mine = { ...here.upazila, distance_m: 0, inside: true };
    const others = near.filter((c) => c.f.code !== here.upazila.code).map((c) => brief(c.f, { distance_m: c.distance_m, inside: false })).sort((a, b) => a.distance_m - b.distance_m);
    const close = others.filter((o) => o.distance_m <= NEAR_M);
    // "inside" itself is only certain when the nearest edge is far; the edge distance is kept so the page can say how close
    return close.length ? { kind: 'near-boundary', district: here.district, edge_m: here.edge_m, areas: [mine, ...close], upazila: here.upazila }
      : { kind: 'inside', district: here.district, edge_m: here.edge_m, areas: [mine], upazila: here.upazila };
  }
  const close = near.map((c) => brief(c.f, { distance_m: c.distance_m, inside: false })).sort((a, b) => a.distance_m - b.distance_m);
  return close.length ? { kind: 'no-polygon', nearest: close, areas: [] } : { kind: 'no-polygon', nearest: [], areas: [] };
}

