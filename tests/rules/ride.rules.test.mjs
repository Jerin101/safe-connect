// Security-rule tests for "ডাকুন" (service engine): providers, rates, online, rides, live positions, bills.
// Same emulator and fake "demo-" project as the other rules tests: no real data, no real accounts.
// Run: npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { DEFAULT_RATES, fare, cancelFee, estimateMetres, trackAdd, billLooksRight } from '../../js/ride.js';

const ADMIN = 'admin-uid', RINA = 'rina-uid', KARIM = 'karim-uid', DRIVER = 'driver-uid', DRIVER2 = 'driver2-uid', PENDING = 'pending-uid', BIKER = 'biker-uid', FENI = 'feni-uid', HELPER = 'helper-uid', RUNNER = 'runner-uid', COURIER = 'courier-uid', TOWER = 'tower-uid';
let env;
const db = (uid) => (uid ? env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }) : env.unauthenticatedContext()).firestore();
const dbUnverified = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: false }).firestore();
const today = () => Math.floor(Date.now() / 86400000);
const MAIJDEE = { lat: 22.87, lon: 91.099, label: 'মাইজদী বাজার' };
const HOSPITAL = { lat: 22.86, lon: 91.095, label: 'জেনারেল হাসপাতাল' };
const prov = (type, district, approved, name = 'রহিম', vehicle = 'নোয়াখালী-থ-১২৩৪') => ({ name, type, vehicle, district, approved, createdAt: new Date(), updatedAt: new Date() });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-safeconnect-ride', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'admins', ADMIN), { since: new Date(), addedBy: 'console' });
    for (const [t, r] of Object.entries(DEFAULT_RATES)) await setDoc(doc(f, 'rates', t), { ...r, updatedAt: new Date() });
    await setDoc(doc(f, 'providers', DRIVER), prov('cng', 'noakhali', true));
    await setDoc(doc(f, 'providers', DRIVER2), prov('cng', 'noakhali', true, 'করিম', 'নোয়াখালী-থ-৫৫৫৫'));
    await setDoc(doc(f, 'providers', PENDING), prov('cng', 'noakhali', false));
    await setDoc(doc(f, 'providers', BIKER), prov('bike', 'noakhali', true));
    await setDoc(doc(f, 'providers', RUNNER), prov('errand', 'noakhali', true, 'বাবু', 'বাইক, ডেলিভারি'));
    await setDoc(doc(f, 'providers', COURIER), prov('pickup', 'noakhali', true, 'সুমন', 'বাইক, পিকআপ'));
    await setDoc(doc(f, 'providers', TOWER), prov('towing', 'noakhali', true, 'জামাল', 'নোয়াখালী-ট-৫৫'));
    await setDoc(doc(f, 'providers', FENI), prov('cng', 'feni', true));
    await setDoc(doc(f, 'providers', HELPER), prov('help', 'noakhali', true, 'স্বেচ্ছাসেবক রুমা', 'প্রাথমিক চিকিৎসা'));
    await setDoc(doc(f, 'providers', KARIM), prov('cng', 'noakhali', true, 'কারিম', 'নোয়াখালী-থ-৯৯৯৯'));
  });
});

const ERRAND = { items: 'নাপা এক্সট্রা ২ পাতা, ওরস্যালাইন ৫টা', maxItems: 500 };
async function readAs(...path) { let d = null; await env.withSecurityRulesDisabled(async (ctx) => { const x = await getDoc(doc(ctx.firestore(), ...path)); d = x.exists() ? x.data() : null; }); return d; }
async function patchAs(path, data) { await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), ...path), data); }); }
const rideFields = (uid, extra = {}) => ({ riderUid: uid, type: 'cng', district: 'noakhali', pickup: MAIJDEE, drop: HOSPITAL,
  estM: estimateMetres(MAIJDEE, HOSPITAL), estFare: fare(DEFAULT_RATES.cng, estimateMetres(MAIJDEE, HOSPITAL)), status: 'requested', ...extra });
// Exactly what js/firebase.js requestRide writes: the ride and rideLimits/{uid} in one batch.
async function request(f, uid, fields, { id, lim } = {}) {
  const ref = id ? doc(f, 'rides', id) : doc(collection(f, 'rides'));
  const old = await readAs('rideLimits', uid);
  const b = writeBatch(f);
  b.set(ref, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (lim !== false) b.set(doc(f, 'rideLimits', uid), lim || { day: today(), count: old && old.day === today() ? old.count + 1 : 1, lastAt: serverTimestamp(), lastRide: ref.id });
  await b.commit();
  return ref.id;
}
const step = (f, id, data) => updateDoc(doc(f, 'rides', id), { ...data, updatedAt: serverTimestamp() });
const accept = (f, id, name = 'রহিম', vehicle = 'নোয়াখালী-থ-১২৩৪', uid = DRIVER) => step(f, id, { status: 'accepted', providerUid: uid, providerName: name, vehicle, acceptedAt: serverTimestamp() });
// A minute later (the rules allow one request per 60 s): move the last request time back, as if the person waited.
async function aMinuteLater(uid) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const r = doc(ctx.firestore(), 'rideLimits', uid); const x = await getDoc(r);
    if (x.exists()) await setDoc(r, { ...x.data(), lastAt: new Date(Date.now() - 120000) });
  });
}
async function rideTo(status, type = 'cng') {
  await aMinuteLater(RINA);
  const id = await request(db(RINA), RINA, rideFields(RINA, { type, estFare: fare(DEFAULT_RATES[type], 1200), ...(type === 'errand' ? ERRAND : {}) }));
  const who = type === 'help' ? HELPER : type === 'bike' ? BIKER : type === 'errand' ? RUNNER : DRIVER, name = type === 'help' ? 'স্বেচ্ছাসেবক রুমা' : type === 'errand' ? 'বাবু' : 'রহিম', veh = type === 'help' ? 'প্রাথমিক চিকিৎসা' : type === 'errand' ? 'বাইক, ডেলিভারি' : 'নোয়াখালী-থ-১২৩৪';
  if (status === 'requested') return id;
  await accept(db(who), id, name, veh, who); if (status === 'accepted') return id;
  await step(db(who), id, { status: 'arrived', arrivedAt: serverTimestamp() }); if (status === 'arrived') return id;
  await step(db(who), id, { status: 'on_trip', startedAt: serverTimestamp() }); if (status === 'on_trip') return id;
  const r = await readAs('rides', id);
  await step(db(who), id, { status: 'completed', endedAt: serverTimestamp(), distM: 1500, waitMin: 0, fare: fare(DEFAULT_RATES[type], 1500, 0), ...(type === 'errand' ? { itemsCost: 240 } : {}), payStatus: 'pending' });
  if (status === 'completed') return id;
  await step(db(who), id, { status: 'paid', payStatus: 'paid', paidAt: serverTimestamp() }); return id;
}
async function audited(f, uid, entity, entityId, action, meta) {
  const b = writeBatch(f), a = doc(collection(f, 'audit'));
  b.set(a, { actorUid: uid, action, entity, entityId, at: serverTimestamp(), ...(meta ? { meta } : {}) });
  return { b, a };
}

describe('the fare helpers (js/ride.js)', () => {
  test('fare: minimum, per km, free 3 minutes of waiting, rounded up to 5 taka', () => {
    const r = DEFAULT_RATES.cng;
    assert.equal(fare(r, 0, 0), 60);                 // minimum
    assert.equal(fare(r, 3000, 0), 100);             // 40 + 20×3
    assert.equal(fare(r, 3100, 0), 105);             // 102 → 105
    assert.equal(fare(r, 3000, 8), 110);             // + 2 × (8 − 3)
    assert.equal(fare(DEFAULT_RATES.help, 5000, 30), 0);
    assert.equal(cancelFee(r, 'arrived'), 20); assert.equal(cancelFee(r, 'accepted'), 0);
    assert.ok(billLooksRight(r, 3000, 0, 100) && !billLooksRight(r, 3000, 0, 200));
  });
  test('tracking ignores GPS jitter and impossible jumps', () => {
    let t = trackAdd(null, { lat: 22.8696, lon: 91.0994, at: 0 });
    t = trackAdd(t, { lat: 22.86961, lon: 91.0994, at: 5000 });         // ~1 m: ignored
    assert.equal(Math.round(t.m), 0);
    t = trackAdd(t, { lat: 22.8706, lon: 91.0994, at: 60000 });         // ~110 m in 60 s: counted
    assert.ok(t.m > 100 && t.m < 120);
    const before = t.m; t = trackAdd(t, { lat: 23.8706, lon: 91.0994, at: 61000 }); // 110 km in 1 s: ignored
    assert.equal(t.m, before);
  });
});

describe('rates', () => {
  test('anyone reads; only an admin with an audit entry writes; help is always free', async () => {
    await assertSucceeds(getDoc(doc(db(null), 'rates', 'cng')));
    await assertFails(setDoc(doc(db(RINA), 'rates', 'cng'), { base: 1, perKm: 1, perMin: 1, minFare: 1, updatedAt: serverTimestamp() }));
    const fa = db(ADMIN);
    let { b, a } = await audited(fa, ADMIN, 'rates', 'cng', 'RATES_CHANGED');
    b.set(doc(fa, 'rates', 'cng'), { base: 50, perKm: 22, perMin: 2, minFare: 70, updatedAt: serverTimestamp(), lastAuditId: a.id });
    await assertSucceeds(b.commit());
    ({ b, a } = await audited(fa, ADMIN, 'rates', 'help', 'RATES_CHANGED'));
    b.set(doc(fa, 'rates', 'help'), { base: 10, perKm: 0, perMin: 0, minFare: 0, updatedAt: serverTimestamp(), lastAuditId: a.id });
    await assertFails(b.commit());
    await assertFails(setDoc(doc(db(ADMIN), 'rates', 'cng'), { base: 50, perKm: 22, perMin: 2, minFare: 70, updatedAt: serverTimestamp() }));
  });
});

describe('providers', () => {
  test('a verified person applies (not approved); cannot approve themself; unverified cannot apply', async () => {
    const app = { name: 'সালমা', type: 'technician', vehicle: 'ইলেকট্রিশিয়ান', district: 'noakhali', approved: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db(RINA), 'providers', RINA), app));
    await assertFails(updateDoc(doc(db(RINA), 'providers', RINA), { approved: true, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(dbUnverified('x-uid'), 'providers', 'x-uid'), app));
    await assertFails(setDoc(doc(db('y-uid'), 'providers', 'y-uid'), { ...app, approved: true }));
    await assertFails(setDoc(doc(db('z-uid'), 'providers', 'z-uid'), { ...app, vehicle: 'ফোন 01711223344' }));
  });
  test('an admin approves with an audit entry; nobody else reads a provider', async () => {
    const fa = db(ADMIN);
    const { b, a } = await audited(fa, ADMIN, 'providers', PENDING, 'PROVIDER_APPROVED', { from: 'false', to: 'true' });
    b.update(doc(fa, 'providers', PENDING), { approved: true, updatedAt: serverTimestamp(), lastAuditId: a.id });
    await assertSucceeds(b.commit());
    await assertFails(updateDoc(doc(db(ADMIN), 'providers', DRIVER), { approved: false, updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db(RINA), 'providers', DRIVER)));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'providers', DRIVER)));
  });
  test('an approved provider cannot change their own name or vehicle (an admin checked them)', async () => {
    await assertFails(updateDoc(doc(db(DRIVER), 'providers', DRIVER), { vehicle: 'অন্য গাড়ি', updatedAt: serverTimestamp() }));
  });
});

describe('online', () => {
  test('an approved provider goes online with their own type and district; others cannot', async () => {
    const pos = { type: 'cng', district: 'noakhali', at: serverTimestamp() };
    await assertFails(setDoc(doc(db(DRIVER), 'online', DRIVER), { ...pos, lat: 22.87, lon: 91.1 }));   // no position, not even a rough one
    await assertSucceeds(setDoc(doc(db(DRIVER), 'online', DRIVER), pos));
    await assertFails(setDoc(doc(db(PENDING), 'online', PENDING), pos));
    await assertFails(setDoc(doc(db(DRIVER), 'online', DRIVER), { ...pos, type: 'ambulance' }));
    await assertFails(setDoc(doc(db(RINA), 'online', DRIVER), pos));
    await assertSucceeds(getDocs(collection(db(RINA), 'online')));
    await assertFails(getDocs(collection(db(null), 'online')));
    await assertSucceeds(deleteDoc(doc(db(DRIVER), 'online', DRIVER)));
  });
});

describe('requesting', () => {
  test('a verified person requests (ride + limits in one batch)', async () => {
    await assertSucceeds(request(db(RINA), RINA, rideFields(RINA)));
  });
  test('signed out, unverified, without limits, for someone else: refused', async () => {
    await assertFails(request(db(null), RINA, rideFields(RINA)));
    await assertFails(request(dbUnverified(RINA), RINA, rideFields(RINA)));
    await assertFails(request(db(RINA), RINA, rideFields(RINA), { lim: false }));
    await assertFails(request(db(RINA), RINA, rideFields(KARIM)));
  });
  test('outside Bangladesh, a phone number in a place name, a wrong status or type: refused', async () => {
    await assertFails(request(db(RINA), RINA, rideFields(RINA, { pickup: { lat: 40, lon: 91, label: 'x y' } })));
    await assertFails(request(db(RINA), RINA, rideFields(RINA, { drop: { ...HOSPITAL, label: 'কল 01711223344' } })));
    await assertFails(request(db(RINA), RINA, rideFields(RINA, { status: 'accepted' })));
    await assertFails(request(db(RINA), RINA, rideFields(RINA, { type: 'helicopter' })));
    await assertFails(request(db(RINA), RINA, rideFields(RINA, { providerUid: DRIVER })));
  });
  test('60 seconds between two requests', async () => {
    await assertSucceeds(request(db(RINA), RINA, rideFields(RINA)));
    await assertFails(request(db(RINA), RINA, rideFields(RINA)));
  });
});

describe('who sees a request', () => {
  test('the rider; an approved provider of the same type and district while it waits; not others', async () => {
    const id = await request(db(RINA), RINA, rideFields(RINA));
    await assertSucceeds(getDoc(doc(db(RINA), 'rides', id)));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'rides', id)));
    await assertSucceeds(getDocs(query(collection(db(DRIVER), 'rides'), where('status', '==', 'requested'), where('district', '==', 'noakhali'), where('type', '==', 'cng'))));
    await assertFails(getDoc(doc(db(FENI), 'rides', id)));
    await assertFails(getDoc(doc(db(BIKER), 'rides', id)));
    await assertFails(getDoc(doc(db(PENDING), 'rides', id)));
    await assertFails(getDoc(doc(db('stranger-uid'), 'rides', id)));
    await assertFails(getDocs(collection(db(RINA), 'rides')));
    await assertSucceeds(getDocs(query(collection(db(RINA), 'rides'), where('riderUid', '==', RINA))));
  });
  test('after it is accepted, other providers no longer see it', async () => {
    const id = await rideTo('accepted');
    await assertFails(getDoc(doc(db(DRIVER2), 'rides', id)));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'rides', id)));
  });
});

describe('accepting', () => {
  test('an approved provider accepts with their own name and vehicle; a second provider cannot take it', async () => {
    const id = await request(db(RINA), RINA, rideFields(RINA));
    await assertSucceeds(accept(db(DRIVER), id));
    await assertFails(accept(db(DRIVER2), id, 'করিম', 'নোয়াখালী-থ-৫৫৫৫', DRIVER2));
  });
  test('wrong type or district, pending, a false name, the rider themself: refused', async () => {
    const id = await request(db(RINA), RINA, rideFields(RINA));
    await assertFails(accept(db(BIKER), id, 'রহিম', 'নোয়াখালী-থ-১২৩৪', BIKER));
    await assertFails(accept(db(FENI), id, 'রহিম', 'নোয়াখালী-থ-১২৩৪', FENI));
    await assertFails(accept(db(PENDING), id, 'রহিম', 'নোয়াখালী-থ-১২৩৪', PENDING));
    await assertFails(accept(db(DRIVER), id, 'অন্য নাম'));
    await assertFails(accept(db(DRIVER2), id, 'রহিম', 'নোয়াখালী-থ-১২৩৪', DRIVER));
    const own = await request(db(KARIM), KARIM, rideFields(KARIM));
    await assertFails(accept(db(KARIM), own, 'কারিম', 'নোয়াখালী-থ-৯৯৯৯', KARIM));
  });
});

describe('the steps and the bill', () => {
  test('only the assigned provider moves the ride, and only in order', async () => {
    const id = await rideTo('accepted');
    await assertFails(step(db(DRIVER), id, { status: 'on_trip', startedAt: serverTimestamp() }));
    await assertFails(step(db(DRIVER2), id, { status: 'arrived', arrivedAt: serverTimestamp() }));
    await assertFails(step(db(RINA), id, { status: 'arrived', arrivedAt: serverTimestamp() }));
    await assertSucceeds(step(db(DRIVER), id, { status: 'arrived', arrivedAt: serverTimestamp() }));
    await assertSucceeds(step(db(DRIVER), id, { status: 'on_trip', startedAt: serverTimestamp() }));
  });
  test('the right fare is accepted; a higher fare, a too long distance or too much waiting is refused', async () => {
    const id = await rideTo('on_trip');
    const done = (distM, waitMin, f) => step(db(DRIVER), id, { status: 'completed', endedAt: serverTimestamp(), distM, waitMin, fare: f, payStatus: 'pending' });
    await assertFails(done(1500, 0, 300));
    await assertFails(done(200000, 0, fare(DEFAULT_RATES.cng, 200000)));
    await assertFails(done(1500, 20, fare(DEFAULT_RATES.cng, 1500, 20)));
    await assertSucceeds(done(1500, 0, fare(DEFAULT_RATES.cng, 1500, 0)));
  });
  test('real waiting is billed: 10 minutes between arriving and starting allows 10 minutes', async () => {
    const id = await rideTo('arrived');
    await patchAs(['rides', id], { arrivedAt: new Date(Date.now() - 10 * 60000) });
    await step(db(DRIVER), id, { status: 'on_trip', startedAt: serverTimestamp() });
    await assertSucceeds(step(db(DRIVER), id, { status: 'completed', endedAt: serverTimestamp(), distM: 2000, waitMin: 10, fare: fare(DEFAULT_RATES.cng, 2000, 10), payStatus: 'pending' }));
    assert.equal((await readAs('rides', id)).fare, 95);
  });
  test('the rider confirms the bill once; the provider marks it paid; the rider rates 1 to 5 once', async () => {
    const id = await rideTo('completed');
    await assertFails(step(db(DRIVER), id, { billOk: true }));
    await assertSucceeds(step(db(RINA), id, { billOk: true }));
    await assertFails(step(db(RINA), id, { billOk: false }));
    await assertFails(step(db(RINA), id, { status: 'paid', payStatus: 'paid', paidAt: serverTimestamp() }));
    await assertSucceeds(step(db(DRIVER), id, { status: 'paid', payStatus: 'paid', paidAt: serverTimestamp() }));
    await assertFails(step(db(RINA), id, { rating: 6 }));
    await assertSucceeds(step(db(RINA), id, { rating: 5 }));
    await assertFails(step(db(RINA), id, { rating: 4 }));
  });
  test('a nearby helper ("help") is never billed', async () => {
    const id = await rideTo('on_trip', 'help');
    await assertFails(step(db(HELPER), id, { status: 'completed', endedAt: serverTimestamp(), distM: 900, waitMin: 0, fare: 50, payStatus: 'pending' }));
    await assertSucceeds(step(db(HELPER), id, { status: 'completed', endedAt: serverTimestamp(), distM: 900, waitMin: 0, fare: 0, payStatus: 'pending' }));
  });
  test('nobody deletes a ride', async () => {
    const id = await rideTo('paid');
    await assertFails(deleteDoc(doc(db(RINA), 'rides', id)));
    await assertFails(deleteDoc(doc(db(ADMIN), 'rides', id)));
  });
});

describe('cancelling', () => {
  test('the rider cancels for free before the provider arrives; after arriving, half the base fare', async () => {
    let id = await rideTo('accepted');
    await assertSucceeds(step(db(RINA), id, { status: 'cancelled', cancelledBy: 'rider', cancelFee: 0 }));
    id = await rideTo('arrived');
    await assertFails(step(db(RINA), id, { status: 'cancelled', cancelledBy: 'rider', cancelFee: 0 }));
    await assertSucceeds(step(db(RINA), id, { status: 'cancelled', cancelledBy: 'rider', cancelFee: cancelFee(DEFAULT_RATES.cng, 'arrived') }));
  });
  test('the arrival fee is the same in the page and the rules for every rate (bike: base 25 → 15 taka)', async () => {
    assert.equal(cancelFee(DEFAULT_RATES.bike, 'arrived'), 15);
    const id = await rideTo('arrived', 'bike');
    await assertFails(step(db(RINA), id, { status: 'cancelled', cancelledBy: 'rider', cancelFee: 10 }));
    await assertSucceeds(step(db(RINA), id, { status: 'cancelled', cancelledBy: 'rider', cancelFee: cancelFee(DEFAULT_RATES.bike, 'arrived') }));
  });
  test('a provider lists the open requests of their own type and district (the query the page makes)', async () => {
    await rideTo('requested');
    await assertSucceeds(getDocs(query(collection(db(DRIVER), 'rides'), where('status', '==', 'requested'), where('type', '==', 'cng'), where('district', '==', 'noakhali'))));
    await assertFails(getDocs(query(collection(db(DRIVER), 'rides'), where('status', '==', 'requested'), where('type', '==', 'bike'), where('district', '==', 'noakhali'))));
    await assertFails(getDocs(query(collection(db(DRIVER), 'rides'), where('type', '==', 'cng'), where('district', '==', 'noakhali'))));
    await assertSucceeds(getDocs(query(collection(db(RINA), 'rides'), where('riderUid', '==', RINA))));
    await assertSucceeds(getDocs(query(collection(db(DRIVER), 'rides'), where('providerUid', '==', DRIVER))));
    await assertFails(getDocs(query(collection(db(DRIVER), 'rides'), where('riderUid', '==', RINA))));
  });
  test('nobody cancels a ride on the way; the provider cancels only before the trip starts, without a fee', async () => {
    let id = await rideTo('on_trip');
    await assertFails(step(db(RINA), id, { status: 'cancelled', cancelledBy: 'rider', cancelFee: 0 }));
    await assertFails(step(db(DRIVER), id, { status: 'cancelled', cancelledBy: 'provider', cancelFee: 0 }));
    id = await rideTo('accepted');
    await assertFails(step(db(DRIVER), id, { status: 'cancelled', cancelledBy: 'provider', cancelFee: 50 }));
    await assertSucceeds(step(db(DRIVER), id, { status: 'cancelled', cancelledBy: 'provider', cancelFee: 0 }));
  });
});

describe('live positions', () => {
  const pos = (lat = 22.87, lon = 91.1) => ({ lat, lon, at: serverTimestamp() });
  test('each side writes only their own position while the ride is active; both read; nobody else', async () => {
    const id = await rideTo('accepted');
    await assertSucceeds(setDoc(doc(db(RINA), 'rides', id, 'live', 'rider'), pos()));
    await assertSucceeds(setDoc(doc(db(DRIVER), 'rides', id, 'live', 'provider'), pos()));
    await assertFails(setDoc(doc(db(RINA), 'rides', id, 'live', 'provider'), pos()));
    await assertFails(setDoc(doc(db(DRIVER2), 'rides', id, 'live', 'provider'), pos()));
    await assertFails(setDoc(doc(db(DRIVER), 'rides', id, 'live', 'provider'), { ...pos(), speed: 50 }));
    await assertSucceeds(getDoc(doc(db(RINA), 'rides', id, 'live', 'provider')));
    await assertSucceeds(getDoc(doc(db(DRIVER), 'rides', id, 'live', 'rider')));
    await assertFails(getDoc(doc(db('stranger-uid'), 'rides', id, 'live', 'rider')));
    await assertFails(getDoc(doc(db(null), 'rides', id, 'live', 'provider')));
  });
  test('no position before a provider accepts; after the ride, no writing, and the two can delete', async () => {
    const id0 = await rideTo('requested');
    await assertFails(setDoc(doc(db(RINA), 'rides', id0, 'live', 'rider'), pos()));
    const id = await rideTo('on_trip');
    await setDoc(doc(db(DRIVER), 'rides', id, 'live', 'provider'), pos());
    await assertFails(deleteDoc(doc(db(DRIVER), 'rides', id, 'live', 'provider')));
    await step(db(DRIVER), id, { status: 'completed', endedAt: serverTimestamp(), distM: 1500, waitMin: 0, fare: fare(DEFAULT_RATES.cng, 1500, 0), payStatus: 'pending' });
    await assertFails(setDoc(doc(db(DRIVER), 'rides', id, 'live', 'provider'), pos()));
    await assertSucceeds(deleteDoc(doc(db(DRIVER), 'rides', id, 'live', 'provider')));
  });
});

describe('আনিয়ে দিন (errand): the list, the limit and the receipt', () => {
  const errandFields = (extra = {}) => rideFields(RINA, { type: 'errand', estFare: fare(DEFAULT_RATES.errand, 1200), ...ERRAND, ...extra });
  test('a request needs the list of things, a limit from 1 to 20,000 taka and a destination; other types carry neither', async () => {
    await assertFails(request(db(RINA), RINA, errandFields({ items: 'x' })));
    await aMinuteLater(RINA); await assertFails(request(db(RINA), RINA, errandFields({ maxItems: 0 })));
    await aMinuteLater(RINA); await assertFails(request(db(RINA), RINA, errandFields({ maxItems: 25000 })));
    await aMinuteLater(RINA); await assertFails(request(db(RINA), RINA, errandFields({ items: 'ওষুধ, ফোন 01711223344' })));
    await aMinuteLater(RINA); const { drop, ...noDrop } = errandFields(); await assertFails(request(db(RINA), RINA, noDrop));
    await aMinuteLater(RINA); await assertFails(request(db(RINA), RINA, rideFields(RINA, ERRAND)));
    await aMinuteLater(RINA); await assertSucceeds(request(db(RINA), RINA, errandFields()));
  });
  test('only an approved errand rider of the district takes it; a CNG driver does not see it', async () => {
    const id = await rideTo('requested', 'errand');
    await assertFails(getDoc(doc(db(DRIVER), 'rides', id)));
    await assertFails(accept(db(DRIVER), id));
    await assertSucceeds(accept(db(RUNNER), id, 'বাবু', 'বাইক, ডেলিভারি', RUNNER));
  });
  test('the receipt amount is required, whole taka, and never above the limit; the delivery fare still matches the rates', async () => {
    const id = await rideTo('on_trip', 'errand');
    const done = (x) => step(db(RUNNER), id, { status: 'completed', endedAt: serverTimestamp(), distM: 1500, waitMin: 0, fare: fare(DEFAULT_RATES.errand, 1500, 0), payStatus: 'pending', ...x });
    await assertFails(done({}));
    await assertFails(done({ itemsCost: 501 }));
    await assertFails(done({ itemsCost: 240.5 }));
    await assertFails(done({ itemsCost: 240, fare: 5 }));
    await assertSucceeds(done({ itemsCost: 500 }));
  });
  test('a ride that is not an errand cannot add a receipt amount', async () => {
    const id = await rideTo('on_trip', 'cng');
    await assertFails(step(db(DRIVER), id, { status: 'completed', endedAt: serverTimestamp(), distM: 1500, waitMin: 0, fare: fare(DEFAULT_RATES.cng, 1500, 0), itemsCost: 100, payStatus: 'pending' }));
  });
  test('the whole errand to paid, with the receipt text the rider gets', async () => {
    const id = await rideTo('paid', 'errand');
    const r = await readAs('rides', id);
    assert.equal(r.itemsCost, 240); assert.equal(r.status, 'paid');
  });
});

describe('stored points and stuck rides (privacy and safety)', () => {
  test('pickup and destination are stored rounded to about 100 m; an exact point is refused', async () => {
    await assertFails(request(db(RINA), RINA, rideFields(RINA, { pickup: { lat: 22.8696, lon: 91.0994, label: 'মাইজদী বাজার' } })));
    await aMinuteLater(RINA);
    await assertFails(request(db(RINA), RINA, rideFields(RINA, { drop: { lat: 22.86, lon: 91.09512, label: 'হাসপাতাল' } })));
    await aMinuteLater(RINA);
    await assertSucceeds(request(db(RINA), RINA, rideFields(RINA)));
  });
  const ago = (id, h) => patchAs(['rides', id], { updatedAt: new Date(Date.now() - h * 3600000) });
  const stale = (f, id, by = 'stale') => step(f, id, { status: 'cancelled', cancelledBy: by, cancelFee: 0 });
  test('before the trip: the rider may close a ride with no change for 3 hours, not earlier', async () => {
    const id = await rideTo('arrived');
    await assertFails(stale(db(RINA), id));
    await ago(id, 2); await assertFails(stale(db(RINA), id));
    await ago(id, 4);
    await assertFails(stale(db(RINA), id, 'rider'));
    await assertFails(step(db(RINA), id, { status: 'cancelled', cancelledBy: 'stale', cancelFee: 20 }));
    await assertFails(stale(db(DRIVER), id));
    await assertSucceeds(stale(db(RINA), id));
  });
  test('on the trip or waiting for "paid": only after 12 hours', async () => {
    for (const st of ['on_trip', 'completed']) {
      const id = await rideTo(st);
      await ago(id, 5); await assertFails(stale(db(RINA), id));
      await ago(id, 13); await assertSucceeds(stale(db(RINA), id));
    }
  });
  test('a paid or already cancelled ride cannot be closed this way', async () => {
    const id = await rideTo('paid');
    await ago(id, 20); await assertFails(stale(db(RINA), id));
  });
});

describe('তৈরি অর্ডার তুলে আনুন (pickup point) and towing', () => {
  const PICK = { items: 'রহিম স্টোর: চাল ৫ কেজি, রসিদ ১২৩', };
  const pickupFields = (extra = {}) => rideFields(RINA, { type: 'pickup', estFare: fare(DEFAULT_RATES.pickup, 1200), ...PICK, ...extra });
  test('a pickup needs what to collect and a destination, and has no money limit (already paid at the shop)', async () => {
    await assertFails(request(db(RINA), RINA, pickupFields({ items: 'x' })));
    await aMinuteLater(RINA); await assertFails(request(db(RINA), RINA, pickupFields({ maxItems: 500 })));
    await aMinuteLater(RINA); await assertFails(request(db(RINA), RINA, pickupFields({ items: 'দোকানে ফোন দিন 01711223344' })));
    await aMinuteLater(RINA); const { drop, ...noDrop } = pickupFields(); await assertFails(request(db(RINA), RINA, noDrop));
    await aMinuteLater(RINA); await assertSucceeds(request(db(RINA), RINA, pickupFields()));
  });
  test('only a pickup rider takes it; the bill is the delivery fare only (no receipt amount)', async () => {
    await aMinuteLater(RINA);
    const id = await request(db(RINA), RINA, pickupFields());
    await assertFails(accept(db(RUNNER), id, 'বাবু', 'বাইক, ডেলিভারি', RUNNER));
    await assertSucceeds(accept(db(COURIER), id, 'সুমন', 'বাইক, পিকআপ', COURIER));
    await step(db(COURIER), id, { status: 'arrived', arrivedAt: serverTimestamp() });
    await step(db(COURIER), id, { status: 'on_trip', startedAt: serverTimestamp() });
    const done = (x) => step(db(COURIER), id, { status: 'completed', endedAt: serverTimestamp(), distM: 1500, waitMin: 0, fare: fare(DEFAULT_RATES.pickup, 1500, 0), payStatus: 'pending', ...x });
    await assertFails(done({ itemsCost: 200 }));
    await assertSucceeds(done({}));
  });
  test('towing: an approved tow driver takes it, the fare follows the towing rates', async () => {
    await aMinuteLater(RINA);
    const id = await request(db(RINA), RINA, rideFields(RINA, { type: 'towing', estFare: fare(DEFAULT_RATES.towing, 1200) }));
    await assertFails(getDoc(doc(db(DRIVER), 'rides', id)));
    await assertSucceeds(accept(db(TOWER), id, 'জামাল', 'নোয়াখালী-ট-৫৫', TOWER));
    await step(db(TOWER), id, { status: 'arrived', arrivedAt: serverTimestamp() });
    await step(db(TOWER), id, { status: 'on_trip', startedAt: serverTimestamp() });
    const done = (f) => step(db(TOWER), id, { status: 'completed', endedAt: serverTimestamp(), distM: 4000, waitMin: 0, fare: f, payStatus: 'pending' });
    await assertFails(done(fare(DEFAULT_RATES.cng, 4000, 0)));
    await assertSucceeds(done(fare(DEFAULT_RATES.towing, 4000, 0)));
  });
});
