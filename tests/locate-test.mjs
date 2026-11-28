// M1.3: js/locate.js, the five location rules, on the real boundary layers. Run: node --test tests/locate-test.mjs (no browser, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createAreaPolygons } from '../src/js/areapoly.js';
import { locateArea, NEAR_M, inCountryBox } from '../src/js/locate.js';

const master = JSON.parse(readFileSync('src/data/master_areas.json', 'utf8'));
const disk = async (url) => (existsSync('src/' + url) ? new Response(readFileSync('src/' + url, 'utf8')) : new Response('', { status: 404 }));
const offline = async () => { throw new TypeError('Failed to fetch'); };
const svc = () => createAreaPolygons({ fetchFn: disk });
const pointOf = (upazila) => { const u = master.unions.find((x) => x.derived_upazila === upazila); return [u.lat, u.lon]; };

test('rule 1, inside: a union point of Hatiya is inside Hatiya, with its edge distance and no neighbour within 3 km', async () => {
  const r = await locateArea(...pointOf('BD20750036'), svc());
  assert.ok(['inside', 'near-boundary'].includes(r.kind));
  assert.equal(r.areas[0].name_en, 'Hatiya'); assert.equal(r.areas[0].inside, true); assert.equal(r.upazila.level, 'upazila');
  assert.equal(typeof r.edge_m, 'number');
});

test('rule 2, near boundary: next to a border both sides are returned, nearest first, within 3 km', async () => {
  const s = svc(); const idx = await s.getIndex();
  const [w, so, e, n] = idx.districts.find((d) => d.code === 'BD2075').bbox;
  let found = null;
  for (let i = 1; i < 90 && !found; i++) for (let j = 1; j < 90 && !found; j++) {
    const lat = so + ((n - so) * i) / 90, lon = w + ((e - w) * j) / 90;
    const r = await locateArea(lat, lon, s);
    if (r.kind === 'near-boundary') found = r;
  }
  assert.ok(found, 'a near-boundary position exists in Noakhali');
  assert.ok(found.areas.length >= 2); assert.equal(found.areas[0].inside, true);
  for (const a of found.areas.slice(1)) assert.ok(a.distance_m <= NEAR_M && a.inside === false);
  assert.deepEqual(found.areas.slice(1).map((a) => a.distance_m), [...found.areas.slice(1).map((a) => a.distance_m)].sort((a, b) => a - b));
});

test('rule 3, no boundary but inside the country box (sea, a strip, a 2026 area): "no-polygon", never called sea', async () => {
  const s = svc(); const idx = await s.getIndex(); let seen = null;
  for (const d of idx.districts) { for (const [lat, lon] of [[d.bbox[1] + 0.003, d.bbox[0] + 0.003], [d.bbox[1] + 0.003, d.bbox[2] - 0.003]]) {
    const r = await locateArea(lat, lon, s); if (r.kind === 'no-polygon') seen = r; } }
  assert.ok(seen); assert.deepEqual(seen.areas, []); assert.equal('sea' in seen, false);
  assert.ok(Array.isArray(seen.nearest));
  const far = await locateArea(21.0, 90.0, s);     // open water south of Bhola, in the box, far from any unit
  assert.equal(far.kind, 'no-polygon'); assert.deepEqual(far.nearest, []);
});

test('rule 4, outside Bangladesh: clearly outside the country box', async () => {
  for (const [lat, lon] of [[0, 0], [28.6, 77.2], [13.7, 100.5], [27.5, 90.0]]) assert.equal((await locateArea(lat, lon, svc())).kind, 'outside-bangladesh', `${lat},${lon}`);
  assert.equal(inCountryBox(23.8, 90.4), true); assert.equal(inCountryBox(30, 90), false);
});

test('rule 5, otherwise unknown: bad numbers are invalid, missing files are unavailable', async () => {
  for (const bad of [[NaN, 90], [null, null], [undefined, 90], ['x', 'y']]) assert.equal((await locateArea(...bad, svc())).kind, 'invalid');
  assert.equal((await locateArea(22.1, 91.0, createAreaPolygons({ fetchFn: offline }))).kind, 'unavailable');
  const half = async (u) => (u.includes('index.json') ? disk(u) : offline());
  assert.equal((await locateArea(22.1, 91.0, createAreaPolygons({ fetchFn: half }))).kind, 'unavailable', 'index only, no district file');
});

test('a city corporation position is a city corporation (not a union, not a thana)', async () => {
  const cc = master.upazilas.find((u) => u.kind === 'city_corporation' && /Dhaka North/.test(u.name_en));
  const s = svc(); const idx = await s.getIndex();
  const doc = JSON.parse(readFileSync('src/' + idx.districts.find((d) => d.code === cc.district).file, 'utf8'));
  const u = doc.unions.find((x) => x[0].startsWith('BD3026'));
  const r = await locateArea(u[3], u[4], s);
  assert.ok(['inside', 'near-boundary'].includes(r.kind));
  assert.equal(r.areas[0].level, 'upazila');                       // the unit level; its kind says city_corporation
});

test('answers carry no union, no exact flag and no position', async () => {
  const r = await locateArea(...pointOf('BD20750036'), svc());
  const text = JSON.stringify(r);
  assert.doesNotMatch(text, /"union"|exact/i); assert.equal(text.includes(String(pointOf('BD20750036')[0])), false);
});

test('the module is listed for offline use and does not touch storage, network or geolocation', () => {
  const src = readFileSync('src/js/locate.js', 'utf8');
  assert.doesNotMatch(src, /localStorage|sessionStorage|\bfetch\(|XMLHttpRequest|navigator\.geolocation|sendBeacon/);
  assert.ok(readFileSync('src/service-worker.js', 'utf8').includes("'js/locate.js'"));
});
