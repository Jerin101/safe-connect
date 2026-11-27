// M1.2 stages B-D: national district layers (src/data/polygons), the loader (js/areapoly.js), the nearest union centre
// (js/unioncentre.js) and their offline wiring in the service worker. Run: node --test tests/areapoly-test.mjs
// No browser, no network: a fake fetch reads the real files from disk, or fails/damages them on purpose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createAreaPolygons, districtsAt, validDistrict, validIndex, INDEX_URL } from '../src/js/areapoly.js';
import { nearestUnionCentre, describePosition, distanceM, MAX_DISTANCE_M } from '../src/js/unioncentre.js';

const read = (p) => JSON.parse(readFileSync('src/' + p, 'utf8'));
const index = read(INDEX_URL);
const master = JSON.parse(readFileSync('src/data/master_areas.json', 'utf8'));
const layer = (code) => read(index.districts.find((d) => d.code === code).file);

function diskFetch(log = []) {
  return async (url) => {
    log.push(url);
    if (!existsSync('src/' + url)) return new Response('', { status: 404 });
    return new Response(readFileSync('src/' + url, 'utf8'), { status: 200 });
  };
}
const offline = async () => { throw new TypeError('Failed to fetch'); };
// an official union point whose derived parent is the named pilot upazila
const PARENT = { Hatiya: 'BD20750036' };
const pointOf = (name) => { const u = master.unions.find((x) => x.derived_upazila === PARENT[name]); return [u.lat, u.lon]; };

// ---------- A. the layers through the loader ----------
test('index and every district layer pass the loader validation', () => {
  assert.ok(validIndex(index)); assert.equal(index.districts.length, 64);
  for (const d of index.districts) assert.ok(validDistrict(read(d.file), d.code), d.code);
});

test('districtsAt: a district border tries both sides; outside Bangladesh and bad numbers try nothing', () => {
  assert.deepEqual(districtsAt(NaN, 90, index), []);
  assert.deepEqual(districtsAt(0, 0, index), []);
  assert.deepEqual(districtsAt(95, 90, index), []);
  const [a, b] = [index.districts[0], index.districts[1]];
  assert.ok(districtsAt((a.bbox[1] + a.bbox[3]) / 2, (a.bbox[0] + a.bbox[2]) / 2, index).includes(a.code));
  assert.ok(b);
});

test('a position is found in its upazila, loading only the files it needs', async () => {
  const log = [];
  const svc = createAreaPolygons({ fetchFn: diskFetch(log) });
  const [lat, lon] = pointOf('Hatiya');
  const r = await svc.locate(lat, lon);
  assert.equal(r.status, 'inside'); assert.equal(r.upazila.level, 'upazila'); assert.equal(r.upazila.name_en, 'Hatiya');
  assert.ok(log.length <= 3, 'index + at most two district files, got ' + log.join(','));
  assert.equal('union' in r.upazila, false);
});

test('every official union point with a known derived parent is found by the loader (national, informational floor 95 %)', async () => {
  const svc = createAreaPolygons({ fetchFn: diskFetch() });
  let ok = 0, tot = 0;
  for (const d of index.districts) {
    const l = layer(d.code);
    const byLp = new Map(l.upazilas.filter((u) => u.lp).map((u) => [u.lp, u.code]));
    for (const row of l.unions) {
      const want = byLp.get(row[6]);
      if (!want) continue;
      tot++;
      const r = await svc.locate(row[3], row[4]);
      if (r.status === 'inside' && r.upazila.code === want) ok++;
    }
  }
  assert.ok(tot > 4800, 'tested ' + tot);
  assert.ok(ok / tot > 0.95, `agreement ${ok}/${tot}`);
  assert.ok(ok < tot, 'honest: some derived parents really disagree and are not hidden');
});

test('no polygon: the sea, outside Bangladesh and the 2026 upazilas give no_polygon, never an invented answer', async () => {
  const svc = createAreaPolygons({ fetchFn: diskFetch() });
  assert.equal((await svc.locate(0, 0)).status, 'no_polygon');
  assert.equal((await svc.locate(NaN, 90)).status, 'invalid_position');
  assert.equal((await svc.locate(undefined, undefined)).status, 'invalid_position');
  // a point inside a district box but outside every polygon exists (coast / sea); it must say no_polygon
  let seen = false;
  for (const d of index.districts) for (const [lat, lon] of [[d.bbox[1] + 0.003, d.bbox[0] + 0.003], [d.bbox[1] + 0.003, d.bbox[2] - 0.003]]) {
    if ((await svc.locate(lat, lon)).status === 'no_polygon') seen = true;
  }
  assert.ok(seen);
  for (const x of index.not_in_source) assert.match(x.evidence, /news report only/);
});

// ---------- B. offline and invalid data ----------
test('offline before the first visit: unavailable (the page keeps its district fallback)', async () => {
  const r = await createAreaPolygons({ fetchFn: offline }).locate(22.1, 91.0);
  assert.equal(r.status, 'unavailable');
});

test('index loads but a district file is missing offline: unavailable, not a wrong answer', async () => {
  const [lat, lon] = pointOf('Hatiya');
  const f = async (url) => (url === INDEX_URL ? new Response(readFileSync('src/' + url, 'utf8')) : offline());
  assert.equal((await createAreaPolygons({ fetchFn: f }).locate(lat, lon)).status, 'unavailable');
});

test('same session, then offline: layers already in memory still answer', async () => {
  let up = true;
  const base = diskFetch();
  const svc = createAreaPolygons({ fetchFn: (u, o) => (up ? base(u, o) : offline()) });
  const [lat, lon] = pointOf('Hatiya');
  assert.equal((await svc.locate(lat, lon)).status, 'inside');
  up = false;
  assert.equal((await svc.locate(lat, lon)).upazila.name_en, 'Hatiya');
});

test('invalid data: damaged index or district files are never half used', async () => {
  const [lat, lon] = pointOf('Hatiya');
  const dcode = index.districts.find((d) => lat >= d.bbox[1] && lat <= d.bbox[3] && lon >= d.bbox[0] && lon <= d.bbox[2]).code;
  const good = (u) => readFileSync('src/' + u, 'utf8');
  const damages = {
    'truncated json': (t) => t.slice(0, t.length / 2),
    'not json': () => '<html>captive portal</html>',
    'licence removed': (t) => JSON.stringify({ ...JSON.parse(t), meta: { ...JSON.parse(t).meta, licence: '' } }),
    'wrong district code': (t) => JSON.stringify({ ...JSON.parse(t), district: { code: 'BD9999' } }),
    'odd ring length': (t) => { const j = JSON.parse(t); j.upazilas[0].rings[0][0].push(5); return JSON.stringify(j); },
    'ring not integers': (t) => { const j = JSON.parse(t); j.upazilas[0].rings[0][0][0] = 'x'; return JSON.stringify(j); },
    'upazilas not a list': (t) => JSON.stringify({ ...JSON.parse(t), upazilas: 'none' }),
  };
  for (const [name, dmg] of Object.entries(damages)) {
    const f = async (u) => new Response(u.includes(dcode) ? dmg(good(u)) : good(u));
    const r = await createAreaPolygons({ fetchFn: f }).locate(lat, lon);
    assert.notEqual(r.status, 'inside', name);
    assert.ok(['unavailable', 'no_polygon'].includes(r.status), name + ' -> ' + r.status);
  }
  for (const bad of ['{}', '{"districts":[]}', '{"districts":[{"code":1}]}', 'nope']) {
    assert.equal((await createAreaPolygons({ fetchFn: async () => new Response(bad) }).locate(lat, lon)).status, 'unavailable');
  }
});

test('a failed index is retried next time (recovers when the network returns)', async () => {
  let up = false;
  const base = diskFetch();
  const svc = createAreaPolygons({ fetchFn: (u, o) => (up ? base(u, o) : offline()) });
  const [lat, lon] = pointOf('Hatiya');
  assert.equal((await svc.locate(lat, lon)).status, 'unavailable');
  up = true;
  assert.equal((await svc.locate(lat, lon)).status, 'inside');
});

test('service worker: version bumped and the index, 64 layers and both modules are in the offline list', () => {
  const sw = readFileSync('src/service-worker.js', 'utf8');
  assert.doesNotMatch(sw, /VERSION = 'v80-/);
  const files = [...sw.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const f of ['js/areapoly.js', 'js/unioncentre.js', INDEX_URL, ...index.districts.map((d) => d.file)]) assert.ok(files.includes(f), f + ' not in FILES');
  assert.equal(files.filter((f) => f.startsWith('data/polygons/')).length, 65);
  assert.equal(files.length, new Set(files).size, 'no file listed twice');
});

// ---------- C. nearest union centre ----------
const doc = {
  unions: [
    ['BD00000001', 'Alpha', 'আলফা', 22.0, 91.0, 'u', '01'],
    ['BD00000002', 'Beta', 'বিটা', 22.0, 91.002, 'u', '01'],   // about 200 m from Alpha
    ['BD00000003', 'Gamma', '', 22.2, 91.2, 'p', '02'],
    ['BD00000004', 'NoCoord', '', null, 91.0, 'u', '01'],
    ['BD00000005', 'Text', '', '22.0', '91.0', 'u', '01'],
    ['BD00000006', '', '', 22.0, 91.0, 'u', '01'],
    ['short'],
  ],
};

test('nearest union centre: labelled as a centre, never exact, with a distance', () => {
  const r = nearestUnionCentre(22.2, 91.2001, doc);
  assert.equal(r.status, 'ok'); assert.equal(r.labelKey, 'nearest_union_centre'); assert.equal(r.exact, false);
  assert.equal(r.name_en, 'Gamma'); assert.equal(r.kind, 'pourashava'); assert.ok(r.distance_m < 50);
  for (const k of Object.keys(r)) assert.notEqual(k, 'union', 'no field may claim "the union"');
});

test('two nearly equal centres: ambiguous is reported', () => {
  const r = nearestUnionCentre(22.0, 91.001, doc);
  assert.equal(r.ambiguous, true); assert.ok(r.second_distance_m >= r.distance_m);
  assert.equal(nearestUnionCentre(22.2, 91.2, doc).ambiguous, false);
});

test('missing or bad coordinates are skipped, never guessed', () => {
  assert.equal(nearestUnionCentre(22.0, 91.0, { unions: [['x', 'A', '', null, null, 'u', '01'], ['y', 'B', '', 'a', 'b', 'u', '01']] }).status, 'none');
  assert.equal(nearestUnionCentre(22.0, 91.0, { unions: [] }).status, 'none');
  assert.equal(nearestUnionCentre(22.0, 91.0, null).status, 'none');
  assert.equal(nearestUnionCentre(NaN, 91.0, doc).status, 'invalid_position');
  assert.equal(nearestUnionCentre(undefined, undefined, doc).status, 'invalid_position');
  const r = nearestUnionCentre(22.0, 91.0, doc);
  assert.ok(!['NoCoord', 'Text', '', undefined].includes(r.name_en));
});

test('too far: no answer instead of a far-away centre', () => {
  const r = nearestUnionCentre(24.0, 89.0, doc);
  assert.equal(r.status, 'none'); assert.equal(r.reason, 'too_far'); assert.ok(r.nearest_distance_m > MAX_DISTANCE_M);
  assert.ok(Math.abs(distanceM(22, 91, 23, 91) - 111195) < 300);
});

test('with an upazila: only its own centres, flagged derived; without own centres: whole district, flagged', () => {
  const own = nearestUnionCentre(22.1, 91.1, doc, { code: 'X', lp: '01' });
  assert.equal(own.limited_to_upazila, true); assert.equal(own.parent_is_derived, true); assert.notEqual(own.name_en, 'Gamma');
  const none = nearestUnionCentre(22.15, 91.15, doc, { code: 'Y', lp: '' });
  assert.equal(none.limited_to_upazila, false); assert.equal(none.name_en, 'Gamma');
});

test('end to end on real data: upazila answer + nearest centre, exact_union is always false', async () => {
  const svc = createAreaPolygons({ fetchFn: diskFetch() });
  const [lat, lon] = pointOf('Hatiya');
  const d = await describePosition(lat, lon, svc);
  assert.equal(d.status, 'inside'); assert.equal(d.exact_union, false);
  assert.equal(d.union_centre.exact, false); assert.equal(d.union_centre.labelKey, 'nearest_union_centre');
  assert.ok(d.union_centre.distance_m < 20000);
  const off = await describePosition(lat, lon, createAreaPolygons({ fetchFn: offline }));
  assert.equal(off.status, 'unavailable'); assert.equal(off.union_centre, null); assert.equal(off.exact_union, false);
});

test('Eidgaon (new upazila, no 2020 code): polygon answer, centres from the whole district, flagged', async () => {
  const svc = createAreaPolygons({ fetchFn: diskFetch() });
  const l = layer('BD2022'); const e = l.upazilas.find((u) => u.name_en === 'Eidgaon');
  assert.equal(e.lp, '');
  const [w, s, ee, n] = e.bbox;
  let hit = null;
  for (let i = 1; i < 10 && !hit; i++) for (let j = 1; j < 10 && !hit; j++) {
    const r = await svc.locate(s + ((n - s) * i) / 10, w + ((ee - w) * j) / 10);
    if (r.status === 'inside' && r.upazila.name_en === 'Eidgaon') hit = r;
  }
  assert.ok(hit, 'found a point inside Eidgaon');
  const c = nearestUnionCentre(s + (n - s) / 2, w + (ee - w) / 2, hit.districtDoc, hit.upazila);
  assert.equal(c.limited_to_upazila, false);
});
