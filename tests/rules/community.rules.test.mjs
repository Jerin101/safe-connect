// Security-rule tests for the community features (impact plan): problems ("সমস্যা জানান"), "আমিও", and place
// status ("এখন খোলা? তেল আছে?"). Same emulator and fake "demo-" project as firestore.rules.test.mjs: no real data.
// Run: npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, writeBatch, serverTimestamp, increment, query, where, deleteDoc } from 'firebase/firestore';
import { issueFields, checkIssue, issueAuditFields, nextPlaceStatus, placeStatusText } from '../../js/community.js';

const ADMIN = 'admin-uid', RINA = 'rina-uid', KARIM = 'karim-uid';
let env;
const db = (uid) => (uid ? env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }) : env.unauthenticatedContext()).firestore();
const dbUnverified = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: false }).firestore();
const today = () => Math.floor(Date.now() / 86400000);
const draft = (extra = {}) => ({ category: 'drain', district: 'Noakhali', upazila: 'Noakhali Sadar', union: 'নিয়াজপুর ইউনিয়ন',
  landmark: 'কাশেম বাজার', text: 'বাজারের সামনে বৃষ্টির পানি জমে থাকে, হাঁটা যায় না।', ...extra });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-safeconnect-community', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admins', ADMIN), { since: new Date(), addedBy: 'console' });
    await setDoc(doc(ctx.firestore(), 'issues', 'i1'), { ...issueFields(draft()), createdAt: new Date(), updatedAt: new Date() });
  });
});

async function readAs(path) {
  let d = null;
  await env.withSecurityRulesDisabled(async (ctx) => { const x = await getDoc(doc(ctx.firestore(), ...path)); d = x.exists() ? x.data() : null; });
  return d;
}
// Exactly what js/firebase.js sendIssue writes: the problem, its owner entry and issueLimits/{uid}, in one batch.
async function sendIssue(f, uid, fields, { id, lim, owner } = {}) {
  const ref = id ? doc(f, 'issues', id) : doc(collection(f, 'issues'));
  const old = await readAs(['issueLimits', uid]);
  const b = writeBatch(f);
  b.set(ref, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (owner !== false) b.set(doc(f, 'issueOwners', ref.id), { uid: owner || uid, at: serverTimestamp() });
  if (lim !== false) b.set(doc(f, 'issueLimits', uid), lim || { day: today(), count: old && old.day === today() ? old.count + 1 : 1, lastAt: serverTimestamp(), lastIssue: ref.id });
  await b.commit();
  return ref.id;
}
async function aMinuteLater(uid, patch = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const r = doc(ctx.firestore(), 'issueLimits', uid); const x = await getDoc(r);
    if (x.exists()) await setDoc(r, { ...x.data(), lastAt: new Date(Date.now() - 120000), ...patch });
  });
}
async function meToo(f, uid, issueId, by = 1) {
  const b = writeBatch(f);
  b.set(doc(f, 'issues', issueId, 'metoo', uid), { at: serverTimestamp() });
  b.update(doc(f, 'issues', issueId), { metoo: increment(by) });
  return b.commit();
}
async function setStatus(f, uid, issueId, from, to, note) {
  const b = writeBatch(f), a = doc(collection(f, 'audit'));
  b.set(a, { ...issueAuditFields(uid, issueId, from, to), at: serverTimestamp() });
  const upd = { status: to, updatedAt: serverTimestamp(), lastAuditId: a.id };
  if (note) upd.statusNote = note;
  b.update(doc(f, 'issues', issueId), upd);
  return b.commit();
}
async function vote(f, uid, placeId, value, n) {
  const b = writeBatch(f);
  b.set(doc(f, 'placeStatus', placeId), { value, n, at: serverTimestamp() });
  b.set(doc(f, 'placeStatus', placeId, 'by', uid), { value, at: serverTimestamp() });
  return b.commit();
}

describe('the page helpers (js/community.js)', () => {
  test('checkIssue accepts a good draft and refuses a phone number, a missing landmark, a short text', () => {
    assert.equal(checkIssue(draft()).ok, true);
    assert.equal(checkIssue(draft({ text: 'ফোন করুন ০১৭১১২২৩৩৪৪, পানি জমে আছে' })).ok, false);
    assert.equal(checkIssue(draft({ landmark: '' })).ok, false);
    assert.equal(checkIssue(draft({ text: 'জল' })).ok, false);
    assert.equal(checkIssue(draft({ category: 'x' })).ok, false);
  });
  test('issueFields names no person; district becomes a key', () => {
    const f = issueFields(draft({ district: "Cox's Bazar" }));
    assert.equal(f.district, 'coxsbazar');
    assert.ok(!('uid' in f) && !('email' in f));
    assert.equal(f.status, 'open'); assert.equal(f.metoo, 0);
  });
  test('place status text: count, value, age; nothing after 6 hours', () => {
    const now = Date.now();
    assert.match(placeStatusText({ value: 'fuel_yes', n: 3, at: new Date(now - 20 * 60000) }, now), /3 জন বলেছেন: তেল আছে · 20 মিনিট আগে/);
    assert.equal(placeStatusText({ value: 'open', n: 1, at: new Date(now - 7 * 3600000) }, now), null);
    assert.deepEqual(nextPlaceStatus({ value: 'open', n: 2, at: new Date(now - 60000) }, 'open', now), { value: 'open', n: 3 });
    assert.deepEqual(nextPlaceStatus({ value: 'open', n: 2, at: new Date(now - 60000) }, 'closed', now), { value: 'closed', n: 1 });
  });
});

describe('problems: reading', () => {
  test('anyone, even signed out, can read a problem and list an upazila', async () => {
    await assertSucceeds(getDoc(doc(db(null), 'issues', 'i1')));
    await assertSucceeds(getDocs(query(collection(db(null), 'issues'), where('district', '==', 'noakhali'), where('upazila', '==', 'Noakhali Sadar'))));
  });
  test('who reported it is not public: only that person and admins read issueOwners', async () => {
    const id = await sendIssue(db(RINA), RINA, issueFields(draft()));
    await assertSucceeds(getDoc(doc(db(RINA), 'issueOwners', id)));
    await assertSucceeds(getDoc(doc(db(ADMIN), 'issueOwners', id)));
    await assertFails(getDoc(doc(db(KARIM), 'issueOwners', id)));
    await assertFails(getDoc(doc(db(null), 'issueOwners', id)));
  });
});

describe('problems: reporting', () => {
  test('a verified person can report a problem (problem + owner + limits in one batch)', async () => {
    await assertSucceeds(sendIssue(db(RINA), RINA, issueFields(draft())));
  });
  test('signed out or unverified email: refused', async () => {
    await assertFails(sendIssue(db(null), RINA, issueFields(draft())));
    await assertFails(sendIssue(dbUnverified(RINA), RINA, issueFields(draft())));
  });
  test('without the limits counter, or without the owner entry: refused', async () => {
    await assertFails(sendIssue(db(RINA), RINA, issueFields(draft()), { lim: false }));
    await assertFails(sendIssue(db(RINA), RINA, issueFields(draft()), { owner: false }));
  });
  test('the owner entry must be the person themself', async () => {
    await assertFails(sendIssue(db(RINA), RINA, issueFields(draft()), { owner: KARIM }));
  });
  test('a phone number in the text, the landmark or the union is refused (Bangla digits too)', async () => {
    await assertFails(sendIssue(db(RINA), RINA, { ...issueFields(draft()), text: 'যোগাযোগ 01711223344 এই নম্বরে' }));
    await assertFails(sendIssue(db(RINA), RINA, { ...issueFields(draft()), landmark: 'দোকান ০১৭১১-২২৩৩৪৪' }));
    await assertFails(sendIssue(db(RINA), RINA, { ...issueFields(draft()), union: '01811223344' }));
  });
  test('extra fields (a name, an email, a uid) are refused', async () => {
    await assertFails(sendIssue(db(RINA), RINA, { ...issueFields(draft()), uid: RINA }));
    await assertFails(sendIssue(db(RINA), RINA, { ...issueFields(draft()), name: 'Rina' }));
  });
  test('a new problem starts open with 0 "আমিও"; a wrong category or district is refused', async () => {
    await assertFails(sendIssue(db(RINA), RINA, { ...issueFields(draft()), status: 'solved' }));
    await assertFails(sendIssue(db(RINA), RINA, { ...issueFields(draft()), metoo: 50 }));
    await assertFails(sendIssue(db(RINA), RINA, { ...issueFields(draft()), category: 'hack' }));
    await assertFails(sendIssue(db(RINA), RINA, { ...issueFields(draft()), district: "Cox's Bazar" }));
  });
  test('60 seconds between two, and at most 10 a day', async () => {
    await assertSucceeds(sendIssue(db(RINA), RINA, issueFields(draft())));
    await assertFails(sendIssue(db(RINA), RINA, issueFields(draft())));
    await aMinuteLater(RINA);
    await assertSucceeds(sendIssue(db(RINA), RINA, issueFields(draft())));
    await aMinuteLater(RINA, { count: 10 });
    await assertFails(sendIssue(db(RINA), RINA, issueFields(draft())));
  });
  test('the counter cannot be reset or moved to another day', async () => {
    await assertSucceeds(sendIssue(db(RINA), RINA, issueFields(draft())));
    await aMinuteLater(RINA, { count: 10 });
    const id = doc(collection(db(RINA), 'issues')).id;
    await assertFails(sendIssue(db(RINA), RINA, issueFields(draft()), { id, lim: { day: today(), count: 1, lastAt: serverTimestamp(), lastIssue: id } }));
    await assertFails(sendIssue(db(RINA), RINA, issueFields(draft()), { id, lim: { day: today() + 1, count: 1, lastAt: serverTimestamp(), lastIssue: id } }));
  });
  test('nobody can edit the text, delete a problem, or edit an owner entry', async () => {
    await assertFails(updateDoc(doc(db(RINA), 'issues', 'i1'), { text: 'অন্য কিছু লিখলাম এখানে' }));
    await assertFails(deleteDoc(doc(db(ADMIN), 'issues', 'i1')));
    const id = await sendIssue(db(RINA), RINA, issueFields(draft()));
    await assertFails(updateDoc(doc(db(RINA), 'issueOwners', id), { uid: KARIM }));
  });
});

describe('"আমিও"', () => {
  test('a verified person adds one; the count goes up by exactly 1', async () => {
    await assertSucceeds(meToo(db(KARIM), KARIM, 'i1'));
    assert.equal((await readAs(['issues', 'i1'])).metoo, 1);
  });
  test('a second "আমিও" by the same person is refused', async () => {
    await assertSucceeds(meToo(db(KARIM), KARIM, 'i1'));
    await assertFails(meToo(db(KARIM), KARIM, 'i1'));
  });
  test('+2, or +1 without the marker, or a marker without +1: refused', async () => {
    await assertFails(meToo(db(KARIM), KARIM, 'i1', 2));
    await assertFails(updateDoc(doc(db(KARIM), 'issues', 'i1'), { metoo: increment(1) }));
    await assertFails(setDoc(doc(db(KARIM), 'issues', 'i1', 'metoo', KARIM), { at: serverTimestamp() }));
  });
  test('signed out, unverified, or a marker for someone else: refused', async () => {
    await assertFails(meToo(db(null), KARIM, 'i1'));
    await assertFails(meToo(dbUnverified(KARIM), KARIM, 'i1'));
    await assertFails(meToo(db(RINA), KARIM, 'i1'));
  });
  test('who pressed "আমিও" is private', async () => {
    await meToo(db(KARIM), KARIM, 'i1');
    await assertSucceeds(getDoc(doc(db(KARIM), 'issues', 'i1', 'metoo', KARIM)));
    await assertFails(getDoc(doc(db(RINA), 'issues', 'i1', 'metoo', KARIM)));
    await assertFails(getDocs(collection(db(null), 'issues', 'i1', 'metoo')));
  });
});

describe('problem status', () => {
  test('an admin moves the status with an audit entry (old and new status)', async () => {
    await assertSucceeds(setStatus(db(ADMIN), ADMIN, 'i1', 'open', 'verified'));
    await assertSucceeds(setStatus(db(ADMIN), ADMIN, 'i1', 'verified', 'solved', 'ইউনিয়ন পরিষদ ড্রেন পরিষ্কার করেছে'));
    assert.equal((await readAs(['issues', 'i1'])).status, 'solved');
  });
  test('without an audit entry, or with a wrong "from": refused', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), 'issues', 'i1'), { status: 'solved', updatedAt: serverTimestamp() }));
    await assertFails(setStatus(db(ADMIN), ADMIN, 'i1', 'working', 'solved'));
  });
  test('a normal user cannot change the status, even with an audit entry', async () => {
    await assertFails(setStatus(db(RINA), RINA, 'i1', 'open', 'solved'));
  });
  test('an unknown status, or a phone number in the note: refused', async () => {
    await assertFails(setStatus(db(ADMIN), ADMIN, 'i1', 'open', 'done'));
    await assertFails(setStatus(db(ADMIN), ADMIN, 'i1', 'open', 'sent', 'চেয়ারম্যান 01711223344'));
  });
});

describe('place status ("এখন খোলা? তেল আছে?")', () => {
  test('anyone can read; a verified person answers (summary + own answer in one batch)', async () => {
    await assertSucceeds(vote(db(RINA), RINA, 'osm-n123', 'fuel_yes', 1));
    await assertSucceeds(getDoc(doc(db(null), 'placeStatus', 'osm-n123')));
  });
  test('the same answer from someone else counts +1; a different answer starts again at 1', async () => {
    await vote(db(RINA), RINA, 'osm-n123', 'open', 1);
    await assertFails(vote(db(KARIM), KARIM, 'osm-n123', 'open', 5));
    await assertSucceeds(vote(db(KARIM), KARIM, 'osm-n123', 'open', 2));
    await assertFails(vote(db(ADMIN), ADMIN, 'osm-n123', 'closed', 3));
    await assertSucceeds(vote(db(ADMIN), ADMIN, 'osm-n123', 'closed', 1));
  });
  test('the same person again within 30 minutes: refused', async () => {
    await vote(db(RINA), RINA, 'osm-n123', 'open', 1);
    await assertFails(vote(db(RINA), RINA, 'osm-n123', 'open', 2));
  });
  test('the summary alone, signed out, unverified, an unknown answer or a bad place id: refused', async () => {
    await assertFails(setDoc(doc(db(RINA), 'placeStatus', 'osm-n123'), { value: 'open', n: 1, at: serverTimestamp() }));
    await assertFails(vote(db(null), RINA, 'osm-n123', 'open', 1));
    await assertFails(vote(dbUnverified(RINA), RINA, 'osm-n123', 'open', 1));
    await assertFails(vote(db(RINA), RINA, 'osm-n123', 'maybe', 1));
    await assertFails(vote(db(RINA), RINA, 'Bad_Id!', 'open', 1));
  });
  test("each person's own answer is private; nobody can delete", async () => {
    await vote(db(RINA), RINA, 'osm-n123', 'open', 1);
    await assertSucceeds(getDoc(doc(db(RINA), 'placeStatus', 'osm-n123', 'by', RINA)));
    await assertFails(getDoc(doc(db(KARIM), 'placeStatus', 'osm-n123', 'by', RINA)));
    await assertFails(getDocs(collection(db(null), 'placeStatus', 'osm-n123', 'by')));
    await assertFails(deleteDoc(doc(db(RINA), 'placeStatus', 'osm-n123')));
  });
});
