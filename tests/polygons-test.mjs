// M1.2 pilot: the browser loader (src/js/polygons.js). Run: node --test tests/polygons-test.mjs (no browser, no network).
// Checks: decoding, point-in-polygon on official BBS reference points, "upazila never union", and the offline behaviour
// (fresh copy when online, saved copy when offline, a bad download never erases the saved copy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeRing, prepare, findUpazila, loadPolygons, POLYGON_URL, POLYGON_CACHE } from '../src/pilot/polygons.js';

const file = JSON.parse(readFileSync('src/data/pilot/upazila_polygons_pilot.json', 'utf8'));
const master = JSON.parse(readFileSync('src/data/master_areas.json', 'utf8'));
const prepared = prepare(file);

test('decodeRing: deltas back to closed degrees', () => {
  const r = decodeRing([9000000, 2200000, 100, 0, 0, 100], 100000);
  assert.deepEqual(r[0], [90, 22]); assert.deepEqual(r[2], [90.001, 22.001]); assert.deepEqual(r[3], r[0]);
});

test('every official union point of a pilot upazila is found inside that upazila, never as a union', () => {
  let tested = 0;
  for (const f of file.features) {
    for (const u of master.unions.filter((x) => x.derived_upazila === f.code)) {
      const hit = findUpazila(u.lat, u.lon, prepared);
      assert.equal(hit?.code, f.code, `${u.name_en} should be in ${f.name_en}`);
      assert.equal(hit.level, 'upazila'); assert.equal('union' in hit, false);
      tested++;
    }
  }
  assert.ok(tested >= 40, `tested ${tested} reference points`);
});

test('a point in the sea, outside Bangladesh or not a number gives null', () => {
  assert.equal(findUpazila(20.0, 90.0, prepared), null);
  assert.equal(findUpazila(0, 0, prepared), null);
  assert.equal(findUpazila(NaN, 90, prepared), null);
  assert.equal(findUpazila(undefined, undefined, prepared), null);
});

test('new upazila with unresolved unions: the polygon answers, no union is claimed', () => {
  const eid = prepared.find((f) => f.name_en === 'Eidgaon');
  const [w, s, e, n] = eid.bbox;
  const hit = findUpazila((s + n) / 2, (w + e) / 2, prepared);
  assert.ok(hit === null || hit.level === 'upazila');
});

// ---- offline behaviour with a fake Cache Storage and a fake fetch ----
function fakeCaches() {
  const stores = new Map();
  return {
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name);
      return { put: async (u, r) => { m.set(u, r); }, match: async (u) => (m.has(u) ? m.get(u).clone() : undefined) };
    },
  };
}
const okFetch = async () => new Response(JSON.stringify(file), { status: 200 });
const offlineFetch = async () => { throw new TypeError('Failed to fetch'); };

test('online: loads the file and saves a copy in its own cache', async () => {
  const cs = fakeCaches();
  const data = await loadPolygons(POLYGON_URL, { fetchFn: okFetch, cacheStorage: cs });
  assert.equal(data.features.length, 5);
  assert.ok(cs.stores.get(POLYGON_CACHE).has(POLYGON_URL));
});

test('offline after one online visit: the saved copy answers the same query', async () => {
  const cs = fakeCaches();
  await loadPolygons(POLYGON_URL, { fetchFn: okFetch, cacheStorage: cs });
  const data = await loadPolygons(POLYGON_URL, { fetchFn: offlineFetch, cacheStorage: cs });
  assert.ok(data, 'served from cache');
  const f = file.features[0]; const u = master.unions.find((x) => x.derived_upazila === f.code);
  assert.equal(findUpazila(u.lat, u.lon, prepare(data)).code, f.code);
});

test('offline and never visited: null (the site must then use the district fallback)', async () => {
  assert.equal(await loadPolygons(POLYGON_URL, { fetchFn: offlineFetch, cacheStorage: fakeCaches() }), null);
});

test('a bad or empty download never erases the saved copy', async () => {
  const cs = fakeCaches();
  await loadPolygons(POLYGON_URL, { fetchFn: okFetch, cacheStorage: cs });
  for (const bad of [async () => new Response('oops', { status: 500 }), async () => new Response('{"features":[]}', { status: 200 }), async () => new Response('not json', { status: 200 })]) {
    const data = await loadPolygons(POLYGON_URL, { fetchFn: bad, cacheStorage: cs });
    assert.equal(data.features.length, 5, 'still the saved copy');
  }
});

test('no cache storage at all (private mode): online still works', async () => {
  const data = await loadPolygons(POLYGON_URL, { fetchFn: okFetch, cacheStorage: { open: async () => { throw new Error('denied'); } } });
  assert.equal(data.features.length, 5);
});
