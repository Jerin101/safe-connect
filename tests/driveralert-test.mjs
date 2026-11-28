// #365: the driver's new-call alert (js/driveralert.js), the rider presence helper (js/ride.js riderPresence) and the new strings.
// Run: node --test tests/driveralert-test.mjs (no browser, no network; sound, vibration and notifications are faked).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCallAlert, BEEP, VIBRATE } from '../src/js/driveralert.js';
import { riderPresence, PRESENCE_ONLINE_MS, PRESENCE_AWAY_MS } from '../src/js/ride.js';

function fakeEnv({ permission = 'granted', hidden = true, audio = true, wake = true } = {}) {
  const log = { osc: 0, vibrate: [], notes: [], released: 0 };
  class Ctx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createOscillator() { log.osc++; return { frequency: {}, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: {}, connect() {} }; }
    resume() { return Promise.resolve(); }
  }
  class Notif {
    constructor(title, o) { log.notes.push({ title, ...o }); }
    static async requestPermission() { Notif.permission = 'granted'; return 'granted'; }
  }
  Notif.permission = permission;
  const document = { title: 'SafeConnect', hidden };
  const navigator = { vibrate: (p) => { log.vibrate.push(p); return true; },
    ...(wake ? { wakeLock: { request: async () => ({ release() { log.released++; }, addEventListener() {} }) } } : {}) };
  return { env: { navigator, document, AudioContext: audio ? Ctx : null, Notification: Notif }, log, document };
}
const req = (id) => ({ id, type: 'cng', pickup: { label: 'মাইজদী' } });

test('first list is the baseline; only a later new request alerts (sound, vibration, title, notification)', async () => {
  const { env, log, document } = fakeEnv();
  const a = createCallAlert(env);
  const st = await a.arm();
  assert.deepEqual([st.sound, st.notifications, st.screenOn], [true, true, true]);
  assert.deepEqual(a.check([req('r1')], { title: 'New call' }).map((r) => r.id), [], 'already on the page: not announced');
  assert.equal(log.vibrate.length, 0);
  const fresh = a.check([req('r1'), req('r2')], { title: 'New call', body: (r) => `cng: ${r.pickup.label}` });
  assert.deepEqual(fresh.map((r) => r.id), ['r2']);
  assert.deepEqual(log.vibrate, [VIBRATE]);
  assert.equal(log.osc, BEEP.filter(([hz]) => hz).length);
  assert.equal(document.title, '(1) New call');
  assert.equal(log.notes.length, 1);
  assert.equal(log.notes[0].body, 'cng: মাইজদী');
});

test('the same request never alerts twice; an answered one is forgotten', async () => {
  const { env, log } = fakeEnv();
  const a = createCallAlert(env); await a.arm(); a.check([]);
  assert.equal(a.check([req('x')]).length, 1);
  assert.equal(a.check([req('x')]).length, 0);
  a.check([]);
  assert.equal(a.check([req('x')]).length, 1, 'if it came back it is new again');
  assert.equal(log.vibrate.length, 2);
});

test('not armed (driver is offline): nothing sounds or vibrates, but nothing is lost', () => {
  const { env, log } = fakeEnv();
  const a = createCallAlert(env);
  a.check([]);
  assert.equal(a.check([req('a')]).length, 1);
  assert.equal(log.vibrate.length, 0); assert.equal(log.osc, 0); assert.equal(log.notes.length, 0);
});

test('disarm restores the title, releases the screen lock and starts a new baseline', async () => {
  const { env, log, document } = fakeEnv();
  const a = createCallAlert(env); await a.arm(); a.check([]); a.check([req('a')], { title: 'Call' });
  assert.match(document.title, /^\(1\)/);
  a.disarm();
  assert.equal(document.title, 'SafeConnect'); assert.equal(log.released, 1); assert.equal(a.state().armed, false);
});

test('degrades safely: no sound, no wake lock, notification blocked, vibrate throws', async () => {
  const { env, log } = fakeEnv({ permission: 'denied', audio: false, wake: false });
  env.navigator.vibrate = () => { throw new Error('no'); };
  const a = createCallAlert(env);
  const st = await a.arm();
  assert.deepEqual([st.sound, st.notifications, st.screenOn], [false, false, false]);
  a.check([]);
  assert.doesNotThrow(() => a.check([req('z')]));
  assert.equal(log.notes.length, 0);
});

test('a visible page does not also pop a system notification', async () => {
  const { env, log } = fakeEnv({ hidden: false });
  const a = createCallAlert(env); await a.arm(); a.check([]); a.check([req('q')]);
  assert.equal(log.notes.length, 0); assert.equal(log.vibrate.length, 1);
});

test('bad input is ignored', async () => {
  const a = createCallAlert(fakeEnv().env); await a.arm();
  assert.deepEqual(a.check(null), []); assert.deepEqual(a.check([null, {}, undefined]), []);
});

test('riderPresence: online, recent, away, unknown, never a guess', () => {
  const now = 1_000_000_000_000;
  assert.deepEqual(riderPresence(now - 20000, now), { state: 'online', minutes: 0 });
  assert.equal(riderPresence(now - PRESENCE_ONLINE_MS, now).state, 'online');
  assert.deepEqual(riderPresence(now - 120000, now), { state: 'recent', minutes: 2 });
  assert.equal(riderPresence(now - PRESENCE_AWAY_MS, now).state, 'recent');
  assert.deepEqual(riderPresence(now - 10 * 60000, now), { state: 'away', minutes: 10 });
  for (const bad of [null, undefined, 0, -5, NaN, 'x']) assert.equal(riderPresence(bad, now).state, 'unknown');
  assert.equal(riderPresence(now + 5000, now).state, 'online', 'a clock a little ahead is not "away"');
});

test('strings: the new provide keys exist in Bangla and English, with the same placeholders', () => {
  const en = JSON.parse(readFileSync('src/js/lang/en.json', 'utf8')).page.provide, bn = JSON.parse(readFileSync('src/js/lang/bn.json', 'utf8')).page.provide;
  const keys = ['newCallTitle', 'newCallBody', 'alertFull', 'alertSoundOnly', 'alertScreenOnly', 'alertLimit', 'riderOnline', 'riderRecent', 'riderGone', 'riderUnknown',
    'privTitle', 'privIntro', 'privMissing', 'privSave', 'privSaved', 'nidLabel', 'nidPh', 'nidBad', 'famName', 'famNameBad', 'famRel', 'famPhone', 'famPhoneBad',
    'consentLabel', 'consentNeed', 'showPriv', 'noPriv', 'checkedLabel', 'needChecked'];
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of keys) { assert.ok(en[k] && bn[k], k); assert.equal(ph(en[k]), ph(bn[k]), k); }
  assert.deepEqual(Object.keys(en.relations).sort(), Object.keys(bn.relations).sort());
  for (const k of ['alertLimit', 'privIntro', 'riderGone', 'consentLabel']) assert.match(bn[k], /[ঀ-৿]/, k);
});

test('privacy: no logging, storage, link-building or innerHTML around the NID and family details', () => {
  const src = readFileSync('src/js/provide.js', 'utf8') + readFileSync('src/js/driveralert.js', 'utf8');
  assert.doesNotMatch(src, /console\.(log|info|debug)/);
  assert.doesNotMatch(src, /localStorage|sessionStorage|location\.hash\s*=|searchParams/);
  assert.doesNotMatch(src, /innerHTML/);
});

test('service worker lists the new script and the version is above production', () => {
  const sw = readFileSync('src/service-worker.js', 'utf8');
  assert.ok(sw.includes("'js/driveralert.js'"));
  assert.ok(Number(sw.match(/VERSION = 'v(\d+)-/)[1]) >= 82);
});

test('#369: silent check remembers requests without sounding; driverwatch is listed offline and has Bangla strings', async () => {
  const { env, log } = fakeEnv();
  const a = createCallAlert(env); await a.arm(); a.check([]);
  assert.equal(a.check([req('s1')], { silent: true }).length, 1);
  assert.equal(log.vibrate.length, 0); assert.equal(log.osc, 0);
  assert.equal(a.check([req('s1')]).length, 0, 'not announced again when the driver leaves the provide page');
  assert.ok(readFileSync('src/service-worker.js', 'utf8').includes("'js/driverwatch.js'"));
  const bn = JSON.parse(readFileSync('src/js/lang/bn.json', 'utf8')).page.provide;
  for (const k of ['watchCalls', 'watchIdle', 'watchOpen', 'watchSound']) assert.match(bn[k], /[ঀ-৿]/, k);
});
