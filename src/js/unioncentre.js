// M1.2: the NEAREST UNION CENTRE to a position, from the official BBS union centre points of one district file
// (data/polygons/<district>.json, field "unions"). This is NOT union detection: there is no official union boundary, and the
// nearest centre is often not the union the person is standing in. Every result says so (exact: false, a distance, and
// "ambiguous" when a second centre is almost as near). The upazila parent (field lp) is DERIVED from 2020 codes.
// Rows without usable coordinates are skipped, never guessed. Text for people comes from lang files by labelKey.

export const MAX_DISTANCE_M = 30000;      // farther than this: no answer (the fallback is better than a far-away centre)
export const AMBIGUOUS_GAP_M = 500;       // a second centre within this much of the nearest -> ambiguous
const KINDS = { u: 'union', p: 'pourashava', w: 'ward' };

export function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371008.8, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// row = [code, name_en, name_bn, lat, lon, kind, lp]
function usable(row) {
  return Array.isArray(row) && row.length >= 7 && Number.isFinite(row[3]) && Number.isFinite(row[4])
    && row[3] >= -90 && row[3] <= 90 && row[4] >= -180 && row[4] <= 180 && typeof row[1] === 'string' && row[1] !== '';
}

// upazila = result.upazila from areapoly.locate() (optional). With it, only centres whose derived parent is that upazila are
// considered when there are any; otherwise (new upazila, city corporation) all centres of the district are considered.
// -> { status:'ok', labelKey:'nearest_union_centre', exact:false, ... } or { status:'none'|'invalid_position', reason }
export function nearestUnionCentre(lat, lon, districtDoc, upazila = null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { status: 'invalid_position', exact: false };
  const rows = (districtDoc?.unions || []).filter(usable);
  if (!rows.length) return { status: 'none', reason: 'no_centres_with_coordinates', exact: false };
  let pool = rows, restricted = false;
  if (upazila?.lp) {
    const own = rows.filter((r) => r[6] === upazila.lp);
    if (own.length) { pool = own; restricted = true; }
  }
  const ranked = pool.map((r) => ({ r, d: distanceM(lat, lon, r[3], r[4]) })).sort((a, b) => a.d - b.d);
  const best = ranked[0];
  if (best.d > MAX_DISTANCE_M) return { status: 'none', reason: 'too_far', nearest_distance_m: Math.round(best.d), exact: false };
  const second = ranked[1];
  return {
    status: 'ok', labelKey: 'nearest_union_centre', exact: false,
    code: best.r[0], name_en: best.r[1], name_bn: best.r[2] || '', kind: KINDS[best.r[5]] || 'union',
    distance_m: Math.round(best.d),
    second_distance_m: second ? Math.round(second.d) : null,
    ambiguous: !!second && second.d - best.d <= AMBIGUOUS_GAP_M,
    limited_to_upazila: restricted,     // false: the upazila had no centres of its own, all centres of the district were used
    upazila_code: upazila?.code || null,
    parent_is_derived: restricted,      // the upazila of a centre comes from 2020 codes (derived, not an official 2023 link)
  };
}

// One call for a page: upazila polygon answer + nearest union centre + honest status words.
// service = createAreaPolygons() from areapoly.js
export async function describePosition(lat, lon, service) {
  const where = await service.locate(lat, lon);
  if (where.status !== 'inside') return { status: where.status, upazila: null, union_centre: null, exact_union: false };
  const centre = nearestUnionCentre(lat, lon, where.districtDoc, where.upazila);
  return { status: 'inside', upazila: where.upazila, district: where.district, union_centre: centre.status === 'ok' ? centre : null, union_centre_status: centre.status, exact_union: false };
}
