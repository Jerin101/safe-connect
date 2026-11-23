// Security-rule tests for live location sharing and Safe Commute (SRS FR09–FR11): live_shares/{shareId} and
// shareLimits/{uid}. Same emulator and fake "demo-" project as the other rule tests: no real data, test uids only.
// Run: npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { newShareId, SHARE_ID, parseTrack, plateOk, pointFrom, lowBattery, DURATIONS } from '../../js/track.js';

const ADMIN = 'admin-uid', RINA = 'rina-uid', KARIM = 'karim-uid';
let env;
const db = (uid) => (uid ? env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }) : env.unauthenticatedContext()).firestore();
const dbUnverified = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: false }).firestore();
const today = () => Math.floor(Date.now() / 86400000);
const POINT = { lat: 23.76561, lon: 90.35861, speed: 5.6, heading: 120, battery: 64 };

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-safeconnect-track', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins', ADMIN), { since: new Date(), addedBy: 'console' }); });
});

async function readAs(...path) { let d = null; await env.withSecurityRulesDisabled(async (ctx) => { const x = await getDoc(doc(ctx.firestore(), ...path)); d = x.exists() ? x.data() : null; }); return d; }
async function patchAs(path, data) { await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), ...path), data); }); }
// Exactly what js/firebase.js startShare writes: the share and shareLimits/{uid} in one batch.
async function start(f, uid, { id = newShareId(), minutes = 60, extra = {}, lim } = {}) {
  const old = await readAs('shareLimits', uid);
  const b = writeBatch(f);
  b.set(doc(f, 'live_shares', id), { uid, ...POINT, status: 'active', startedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + minutes * 60000), ...extra });
  if (lim !== false) b.set(doc(f, 'shareLimits', uid), { day: today(), count: old && old.day === today() ? old.count + 1 : 1, lastAt: serverTimestamp(), lastShare: id });
  await b.commit();
  return id;
}
async function aMinuteLater(uid) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const r = doc(ctx.firestore(), 'shareLimits', uid); const x = await getDoc(r);
    if (x.exists()) await setDoc(r, { ...x.data(), lastAt: new Date(Date.now() - 120000) });
  });
}
const later = (id, s = 10) => patchAs(['live_shares', id], { updatedAt: new Date(Date.now() - s * 1000) });
const expire = (id) => patchAs(['live_shares', id], { expiresAt: new Date(Date.now() - 60000) });

describe('the page helpers (js/track.js)', () => {
  test('ids are long and random; links parse; durations are 15 min, 1 h, 8 h', () => {
    const a = newShareId(), b = newShareId();
    assert.ok(SHARE_ID.test(a) && a.length === 32 && a !== b);
    assert.equal(parseTrack(`#/track/${a}`), a);
    assert.equal(parseTrack('#/track/short'), null);
    assert.deepEqual(DURATIONS, [15, 60, 480]);
  });
  test('number plates in Bangla or English; never a phone number; points and battery', () => {
    assert.ok(plateOk('ঢাকা মেট্রো-থ ১১-২৩৪৫') && plateOk('Dhaka Metro-Th 11-2345'));
    assert.ok(!plateOk('01711223344') && !plateOk('x') && !plateOk('<script>'));
    assert.deepEqual(pointFrom({ latitude: 23.765612, longitude: 90.358612, speed: 5.55, heading: null }, 0.08), { lat: 23.76561, lon: 90.35861, speed: 5.6, heading: null, battery: 8 });
    assert.ok(lowBattery(9) && !lowBattery(10) && !lowBattery(null));
  });
});

describe('starting a share (TRK-01)', () => {
  test('a verified person starts one with the limits entry; unverified, signed out or without limits: refused', async () => {
    await assertSucceeds(start(db(RINA), RINA));
    await assertFails(start(dbUnverified(KARIM), KARIM));
    await assertFails(start(db(null), RINA));
    await assertFails(start(db(KARIM), KARIM, { lim: false }));
  });
  test('at most 8 hours; never in the past; a short id, a point outside Bangladesh, another uid or extra fields: refused', async () => {
    await assertFails(start(db(RINA), RINA, { minutes: 9 * 60 }));
    await assertFails(start(db(RINA), RINA, { minutes: -5 }));
    await assertFails(start(db(RINA), RINA, { id: 'abc123' }));
    await assertFails(start(db(RINA), RINA, { extra: { lat: 40, lon: 91 } }));
    await assertFails(start(db(RINA), RINA, { extra: { uid: KARIM } }));
    await assertFails(start(db(RINA), RINA, { extra: { phone: '01711223344' } }));
    await assertFails(start(db(RINA), RINA, { extra: { status: 'ended' } }));
    await assertFails(start(db(RINA), RINA, { extra: { battery: 150 } }));
    await assertSucceeds(start(db(RINA), RINA, { minutes: 480 }));
  });
  test('a second share within 60 s is refused (20 a day)', async () => {
    await start(db(RINA), RINA);
    await assertFails(start(db(RINA), RINA));
    await aMinuteLater(RINA);
    await assertSucceeds(start(db(RINA), RINA));
  });
});

describe('the family view (TRK-04): read by id, no sign-in, never listed', () => {
  test('anyone with the link reads an active share; nobody lists shares; an expired one is unreadable', async () => {
    const id = await start(db(RINA), RINA);
    await assertSucceeds(getDoc(doc(db(null), 'live_shares', id)));
    await assertSucceeds(getDoc(doc(db(KARIM), 'live_shares', id)));
    await assertFails(getDocs(collection(db(null), 'live_shares')));
    await assertFails(getDocs(collection(db(KARIM), 'live_shares')));
    await assertFails(getDocs(query(collection(db(RINA), 'live_shares'), where('uid', '==', RINA))));
    await expire(id);
    await assertFails(getDoc(doc(db(null), 'live_shares', id)));
  });
});

describe('updates and Safe Commute (TRK-02, TRK-03)', () => {
  test('the owner sends a new point after 4 s; sooner, by someone else, or changing the time or owner: refused', async () => {
    const id = await start(db(RINA), RINA);
    const upd = (f, x) => updateDoc(doc(f, 'live_shares', id), { ...x, updatedAt: serverTimestamp() });
    await assertFails(upd(db(RINA), { lat: 23.7657 }));   // within 4 s
    await later(id);
    await assertFails(upd(db(KARIM), { lat: 23.7657 }));
    await assertFails(upd(db(RINA), { lat: 23.7657, expiresAt: new Date(Date.now() + 9 * 3600000) }));
    await assertFails(upd(db(RINA), { lat: 23.7657, uid: KARIM }));
    await assertSucceeds(upd(db(RINA), { lat: 23.7657, lon: 90.3587, speed: 7, heading: 90, battery: 9 }));
  });
  test('Safe Commute: number plate, vehicle type and destination; no phone numbers, only known types', async () => {
    const id = await start(db(RINA), RINA);
    const commute = (x) => updateDoc(doc(db(RINA), 'live_shares', id), { ...x, updatedAt: serverTimestamp() });
    await later(id);
    await assertFails(commute({ vehicleNo: 'ড্রাইভার ০১৭১১২২৩৩৪৪', vehicleType: 'cng', destination: 'মিরপুর ১০' }));
    await assertFails(commute({ vehicleNo: 'ঢাকা মেট্রো-থ ১১-২৩৪৫', vehicleType: 'plane', destination: 'মিরপুর ১০' }));
    await assertSucceeds(commute({ vehicleNo: 'ঢাকা মেট্রো-থ ১১-২৩৪৫', vehicleType: 'cng', destination: 'মিরপুর ১০' }));
    const d = await readAs('live_shares', id);
    assert.equal(d.vehicleNo, 'ঢাকা মেট্রো-থ ১১-২৩৪৫');
  });
  test('after expiry the owner can no longer update it', async () => {
    const id = await start(db(RINA), RINA);
    await later(id); await expire(id);
    await assertFails(updateDoc(doc(db(RINA), 'live_shares', id), { lat: 23.7657, updatedAt: serverTimestamp() }));
  });
});

describe('ending (TRK-05) and cleanup', () => {
  test('"I Have Reached Safely": the owner deletes it at once; nobody else can', async () => {
    const id = await start(db(RINA), RINA);
    await assertFails(deleteDoc(doc(db(KARIM), 'live_shares', id)));
    await assertFails(deleteDoc(doc(db(ADMIN), 'live_shares', id)));   // an admin cannot touch an active share
    await assertSucceeds(deleteDoc(doc(db(RINA), 'live_shares', id)));
    assert.equal(await readAs('live_shares', id), null);
  });
  test('an admin lists and deletes only shares whose time is over', async () => {
    const id = await start(db(RINA), RINA);
    await assertFails(getDocs(collection(db(ADMIN), 'live_shares')));
    await expire(id);
    const q = query(collection(db(ADMIN), 'live_shares'), where('expiresAt', '<', new Date()));
    await assertSucceeds(getDocs(q));
    await assertSucceeds(deleteDoc(doc(db(ADMIN), 'live_shares', id)));
  });
});
