// SafeConnect location module: phone GPS -> nearest union / town / upazila.
// Works offline: GPS needs no internet, and data/locations.json holds the official upazila
// boundaries and union / town centre points (Bangladesh Bureau of Statistics, via OCHA HDX).

import { DISTRICTS, norm } from './data.js';

const TOWN_RADIUS_KM = 2.5;   // closer than this to a town centre -> use the town
const UNION_MAX_KM = 6;       // farther than this from every union centre in the upazila -> show the whole upazila
const PILOT_MAX_KM = 45;      // farther than this -> outside Noakhali / Cox's Bazar

export async function loadLocations(base = 'data/') {
  const res = await fetch(`${base}locations.json`);
  if (!res.ok) throw new Error(`Could not load locations.json (${res.status})`);
  return res.json();
}

// 'granted' | 'prompt' | 'denied' | 'unknown' – lets the app locate automatically on open
// when the person already allowed it before, without showing a prompt.
export async function permissionState() {
  try {
    const s = await navigator.permissions.query({ name: 'geolocation' });
    return s.state;
  } catch {
    return 'unknown';
  }
}

// Resolves { lat, lon, accuracy } or rejects with Error whose .code is
// 'unsupported' | 'denied' | 'unavailable' | 'timeout'.
export function getPosition({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const fail = (code) => { const e = new Error(code); e.code = code; reject(e); };
    if (!('geolocation' in navigator)) return fail('unsupported');
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (err) => fail(['unavailable', 'denied', 'unavailable', 'timeout'][err.code] || 'unavailable'),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    );
  });
}

export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const districtKey = (name) => (DISTRICTS.find((d) => d.en === name) || {}).key;

// Ray casting on [lon, lat] rings.
function insideRing(pos, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    if ((y1 > pos.lat) !== (y2 > pos.lat) && pos.lon < ((x2 - x1) * (pos.lat - y1)) / (y2 - y1) + x1) hit = !hit;
  }
  return hit;
}

// Which upazila is this position in? Uses the official BBS boundary; near the sea or a
// border (outside every shape) it takes the closest upazila centre within PILOT_MAX_KM.
function upazilaAt(locations, pos) {
  const hit = locations.upazilas.find((u) => u.polygons.some((poly) => poly.some((ring) => insideRing(pos, ring))));
  if (hit) return hit;
  const near = locations.upazilas
    .map((u) => ({ u, km: distanceKm(pos, { lat: u.center[0], lon: u.center[1] }) }))
    .sort((a, b) => a.km - b.km)[0];
  return near && near.km <= PILOT_MAX_KM ? near.u : null;
}

// Nearest place for the app's area picker, or null when outside the pilot districts.
// Returns { district, upazila, area, distanceKm }.
export function nearestPlace(locations, pos) {
  const upz = upazilaAt(locations, pos);
  if (!upz) return null;
  const district = districtKey(upz.district);
  const closest = (points) => points
    .map((p) => ({ p, km: distanceKm(pos, p) }))
    .sort((a, b) => a.km - b.km)[0];

  const town = closest(locations.municipalities.filter((m) => m.district === upz.district));
  if (town && town.km <= TOWN_RADIUS_KM) {
    return { district, upazila: town.p.upazila_en, area: { type: 'municipality', bn: norm(town.p.municipality_bn) }, distanceKm: town.km };
  }
  const union = closest(locations.unions.filter((u) => u.district === upz.district && u.upazila_en === upz.upazila_en));
  if (union && union.km <= UNION_MAX_KM) {
    return { district, upazila: upz.upazila_en, area: { type: 'union', bn: norm(union.p.union_bn) }, distanceKm: union.km };
  }
  return { district, upazila: upz.upazila_en, area: null, distanceKm: union ? union.km : 0 };
}

// Link a family member or the 999 operator can open.
export const mapsLink = (pos) => `https://maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lon.toFixed(5)}`;
