// A list that fails to load (#170): the search says so and keeps working with what it has.
// Run: node --test tests/partial-load-test.mjs (no browser, no network: fetch reads data/ from disk).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAll, areaIndex, findAreas } from '../js/data.js';

// fetch reads the repo's data/ folder; the names in `fail` answer 503 like a broken connection would.
const withFetch = (fail) => {
  globalThis.fetch = async (url) => {
    if (fail.some((f) => url.endsWith(f))) return { ok: false, status: 503, json: async () => ({}) };
    try { const body = readFileSync(url, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; }
    catch { return { ok: false, status: 404, json: async () => ({}) }; }
  };
};
const LANG = (l) => JSON.parse(readFileSync(`js/lang/${l}.json`, 'utf8')).ui;

test('everything loads: nothing is listed as partial', async () => {
  withFetch([]);
  const data = await loadAll('data/');
  assert.deepEqual(data.partial, []);
  assert.ok(data.villages.length > 100);
});

test('the village list fails: it is listed, and unions, upazilas and thanas are still found', async () => {
  withFetch(['villages.json']);
  const data = await loadAll('data/');
  assert.deepEqual(data.partial, ['villages']);
  assert.equal(data.villages.length, 0);
  assert.deepEqual(data.missing, []);
  const idx = areaIndex(data);
  assert.equal(findAreas(idx, 'hatiya').hits[0]?.place.upazila, 'Hatiya');
  assert.equal(findAreas(idx, 'নিয়াজপুর').hits[0]?.kind, 'union');
  assert.equal(findAreas(idx, 'sudharam').hits[0]?.kind, 'thana');
});

test('the landmark lists fail: listed once, the rest still works', async () => {
  withFetch(['landmarks/noakhali.json', 'landmarks/coxsbazar.json']);
  const data = await loadAll('data/');
  assert.deepEqual(data.partial, ['landmarks']);
  assert.equal(findAreas(areaIndex(data), 'teknaf').hits[0]?.place.upazila, 'Teknaf');
});

test('the calm note exists in both languages', () => {
  for (const l of ['bn', 'en']) assert.ok(LANG(l).partialNote && LANG(l).partialNote.length > 20, l);
});
