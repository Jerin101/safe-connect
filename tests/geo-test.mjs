// The two-step location helper (src/js/geo.js): a phone that cannot give a GPS fix in time still gets a position from the
// network, "denied" stops at once, and a browser with no location says so. No browser, no network.
// Run: node --test tests/geo-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locate, locateBest, geoCode } from '../src/js/geo.js';

const setNav = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
// A fake navigator.geolocation: `script` lists what each call does, in order: 'ok' or an error code (1, 2, 3).
function fake(script) {
  const calls = [];
  setNav({ geolocation: { getCurrentPosition(ok, bad, opts) {
    calls.push(opts);
    const step = script[calls.length - 1];
    if (step === 'ok') ok({ coords: { latitude: 22.9, longitude: 91.1, accuracy: 20 }, timestamp: 1 });
    else bad({ code: step });
  } } });
  return calls;
}
const run = (opts) => new Promise((resolve) => locate((p) => resolve({ ok: p }), (e) => resolve({ err: e }), opts));

test('precise: GPS first; a GPS timeout falls back to the network position', async () => {
  const calls = fake([3, 'ok']);
  const r = await run({ precise: true });
  assert.ok(r.ok, 'got a position');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].enableHighAccuracy, true);
  assert.equal(calls[1].enableHighAccuracy, false);
});

test('not precise: network first (fast); if it fails, GPS is tried', async () => {
  const calls = fake([2, 'ok']);
  const r = await run({ precise: false });
  assert.ok(r.ok);
  assert.equal(calls[0].enableHighAccuracy, false);
  assert.equal(calls[1].enableHighAccuracy, true);
});

test('the first try works: only one request is made', async () => {
  const calls = fake(['ok']);
  assert.ok((await run({ precise: true })).ok);
  assert.equal(calls.length, 1);
});

test('denied (code 1) is final: no second try, the error reaches the page', async () => {
  const calls = fake([1, 'ok']);
  const r = await run({ precise: true });
  assert.equal(r.err.code, 1);
  assert.equal(calls.length, 1);
  assert.equal(geoCode(r.err), 'denied');
});

test('both tries fail: the second error is reported', async () => {
  fake([3, 2]);
  const r = await run({ precise: true });
  assert.equal(geoCode(r.err), 'unavailable');
});

test('maximumAge 0 (fresh fix for SOS) is kept in both tries', async () => {
  const calls = fake([3, 'ok']);
  await run({ precise: true, maximumAge: 0 });
  assert.deepEqual(calls.map((c) => c.maximumAge), [0, 0]);
});

test('a browser without location support', async () => {
  setNav({});
  const r = await run({});
  assert.equal(geoCode(r.err), 'unsupported');
});

test('geoCode names', () => {
  assert.deepEqual([1, 2, 3].map((c) => geoCode({ code: c })), ['denied', 'unavailable', 'timeout']);
});


const rawFix = (accuracy, latitude = 22.9, longitude = 91.1) => ({
  coords: { latitude, longitude, accuracy }, timestamp: 123456
});
function fakeWatch(onStart) {
  const calls = [];
  const cleared = [];
  setNav({ geolocation: {
    watchPosition(ok, bad, options) {
      calls.push(options);
      onStart({ ok, bad });
      return 17;
    },
    clearWatch(id) { cleared.push(id); }
  } });
  return { calls, cleared };
}
const bestRun = (options) => new Promise((resolve, reject) => locateBest(resolve, reject, options));

test('SOS best-fix watch requests high accuracy and stops as soon as it gets the target', async () => {
  const watch = fakeWatch(({ ok }) => { ok(rawFix(500)); ok(rawFix(110)); ok(rawFix(35)); });
  const position = await bestRun({ timeout: 1000, targetAccuracy: 50, maximumAge: 0 });
  assert.equal(position.coords.accuracy, 35);
  assert.equal(watch.calls[0].enableHighAccuracy, true);
  assert.equal(watch.calls[0].maximumAge, 0);
  assert.deepEqual(watch.cleared, [17]);
});

test('SOS best-fix watch returns the best coarse estimate at timeout, not the first one', async () => {
  const watch = fakeWatch(({ ok }) => { ok(rawFix(500)); ok(rawFix(180)); ok(rawFix(260)); });
  const position = await bestRun({ timeout: 15, targetAccuracy: 50, maximumAge: 0 });
  assert.equal(position.coords.accuracy, 180);
  assert.deepEqual(watch.cleared, [17]);
});

test('SOS best-fix watch never reuses a coarse point after permission is denied', async () => {
  fakeWatch(({ ok, bad }) => { ok(rawFix(500)); bad({ code: 1 }); });
  await assert.rejects(bestRun({ timeout: 1000, targetAccuracy: 50 }), (error) => error.code === 1);
});
