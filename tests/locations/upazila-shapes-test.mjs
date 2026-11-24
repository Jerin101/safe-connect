// GPS -> upazila (#221): the upazila shapes in data/locations.json are real (not collapsed), and the site's own
// lookup (js/location.js nearestPlace) puts known points into the right upazila.
// Run: node --test tests/locations/upazila-shapes-test.mjs
// Live check after a merge: LOCATIONS=<path to a downloaded live locations.json> node --test tests/locations/upazila-shapes-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nearestPlace } from '../../src/js/location.js';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const loc = read(process.env.LOCATIONS || 'src/data/locations.json');
const upazilaOf = (lat, lon) => nearestPlace(loc, { lat, lon })?.upazila ?? null;

test('every upazila ring is a real closed shape (at least 4 points, first = last)', () => {
  assert.equal(loc.upazilas.length, 18);
  for (const u of loc.upazilas) {
    assert.ok(u.polygons.length > 0, `${u.upazila_en}: no shape`);
    for (const poly of u.polygons) {
      const ring = poly[0];
      assert.ok(ring.length >= 4, `${u.upazila_en}: ring of ${ring.length} points (collapsed)`);
      assert.deepEqual(ring[0], ring[ring.length - 1], `${u.upazila_en}: ring not closed`);
      assert.ok(new Set(ring.map((p) => p.join(','))).size >= 3, `${u.upazila_en}: ring has fewer than 3 different points`);
    }
  }
});

// Known disagreements between the two official BBS sources (not guessed away; docs/DATA_GAPS.md §14):
const KNOWN = new Set([
  'Mohammadpur (Subarnachar) -> Hatiya',     // BBS's own union point lies inside BBS's Hatiya boundary (a char)
]);

test('every BBS union point is found in its own upazila', () => {
  const wrong = loc.unions.filter((u) => u.src === 'bbs')
    .map((u) => ({ u, got: upazilaOf(u.lat, u.lon) }))
    .filter(({ u, got }) => got !== u.upazila_en);
  const total = loc.unions.filter((u) => u.src === 'bbs').length;
  assert.ok(total > 100, `only ${total} BBS union points`);
  assert.deepEqual(wrong.map(({ u, got }) => `${u.union_en} (${u.upazila_en}) -> ${got}`).filter((w) => !KNOWN.has(w)), []);
});

test('every upazila is found for at least one point inside it', () => {
  for (const u of loc.upazilas) {
    const pts = loc.unions.filter((x) => x.district === u.district && x.upazila_en === u.upazila_en);
    if (!pts.length) continue;                        // e.g. Kabirhat: its unions are still filed under the old upazila
    assert.ok(pts.some((p) => upazilaOf(p.lat, p.lon) === u.upazila_en), `${u.upazila_en}: no point lands in it`);
  }
});

test('OSM places in the pilot districts mostly agree with the OSM upazila', () => {
  // OSM has no boundary for Sonaimuri, Kabirhat and Eidgaon (they are inside the old upazila's OSM boundary), so
  // places there may disagree; everything else should match closely.
  const carved = new Set(['Sonaimuri', 'Kabirhat', 'Eidgaon']);
  let n = 0;
  let same = 0;
  for (const f of ['src/data/places/noakhali.json', 'src/data/places/coxsbazar.json']) {
    for (const p of read(f).places) {
      if (!p.upazila) continue;
      const got = upazilaOf(p.lat, p.lon);
      if (carved.has(got)) continue;
      n += 1;
      if (got === p.upazila) same += 1;
    }
  }
  assert.ok(n > 300, `only ${n} places compared`);
  assert.ok(same / n >= 0.95, `only ${same}/${n} (${(100 * same / n).toFixed(1)}%) agree`);
});
