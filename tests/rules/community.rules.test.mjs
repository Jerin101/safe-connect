// Security-rule tests for place status ("এখন খোলা? তেল আছে?"), and a check that the removed local-problem collections
// stay closed. Same emulator and fake "demo-" project as firestore.rules.test.mjs: no real data.
// Run: npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { nextPlaceStatus, placeStatusText, isOutdated } from '../../src/js/community.js';

const ADMIN = 'admin-uid', RINA = 'rina-uid', KARIM = 'karim-uid';
let env;
const db = (uid) => (uid ? env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }) : env.unauthenticatedContext()).firestore();
const dbUnverified = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: false }).firestore();
const today = () => Math.floor(Date.now() / 86400000);
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-safeconnect-community', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins', ADMIN), { since: new Date(), addedBy: 'console' }); });
});

async function vote(f, uid, placeId, value, n, prev) {
  const b = writeBatch(f);
  b.set(doc(f, 'placeStatus', placeId), { status: value, n, at: serverTimestamp(), ...(prev ? { prev } : {}) });
  b.set(doc(f, 'placeStatus', placeId, 'by', uid), { status: value, at: serverTimestamp() });
  return b.commit();
}

describe('the page helpers (js/community.js)', () => {
  test('place status text: count, status, age; older than 6 hours is shown as "Outdated" (SRS FR05)', () => {
    const now = Date.now();
    assert.match(placeStatusText({ status: 'fuel_yes', n: 3, at: new Date(now - 20 * 60000) }, now), /3 জন বলেছেন: তেল আছে · 20 মিনিট আগে$/);
    assert.match(placeStatusText({ status: 'open', n: 1, at: new Date(now - 7 * 3600000) }, now), /Outdated/);
    assert.ok(isOutdated({ at: new Date(now - 7 * 3600000) }, now) && !isOutdated({ at: new Date(now - 60000) }, now));
    assert.equal(placeStatusText(null, now), null);
    assert.equal(nextPlaceStatus({ status: 'open', n: 2, at: new Date(now - 60000) }, 'open', now).n, 3);
    assert.equal(nextPlaceStatus({ status: 'open', n: 2, at: new Date(now - 60000) }, 'closed', now).n, 1);
    assert.equal(nextPlaceStatus({ status: 'open', n: 2, at: new Date(now - 60000) }, 'closed', now).status, 'closed');
    assert.equal(nextPlaceStatus({ status: 'open', n: 2, at: new Date(now - 60000) }, 'closed', now).prev, 'open');   // conflict flag
    assert.equal(nextPlaceStatus({ status: 'open', n: 2, at: new Date(now - 7 * 3600000) }, 'closed', now).prev, undefined);   // old answer: no conflict
    assert.equal(nextPlaceStatus({ status: 'open', n: 2, at: new Date(now - 60000) }, 'open', now).prev, undefined);
  });
});

describe('local problems are not part of the system (removed in v8)', () => {
  test('nobody can write or read problem collections any more', async () => {
    await assertFails(setDoc(doc(db(RINA), 'issues', 'i1'), { category: 'drain', status: 'open', metoo: 0 }));
    await assertFails(setDoc(doc(db(RINA), 'issueOwners', 'i1'), { uid: RINA }));
    await assertFails(setDoc(doc(db(RINA), 'issueLimits', RINA), { day: 1, count: 1 }));
    await assertFails(getDoc(doc(db(null), 'issues', 'i1')));
    await assertFails(setDoc(doc(db(ADMIN), 'issues', 'i1'), { category: 'drain', status: 'open', metoo: 0 }));
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
  test('conflict flag: a different answer within 6 hours may carry "prev" = the earlier answer, and only that', async () => {
    await vote(db(RINA), RINA, 'osm-n200', 'open', 1);
    await assertFails(vote(db(KARIM), KARIM, 'osm-n200', 'closed', 1, 'fuel_no'));   // prev is not the earlier answer
    await assertFails(vote(db(KARIM), KARIM, 'osm-n200', 'open', 2, 'open'));        // the same answer is no disagreement
    await assertSucceeds(vote(db(KARIM), KARIM, 'osm-n200', 'closed', 1, 'open'));   // the honest conflict flag
    const st = await getDoc(doc(db(null), 'placeStatus', 'osm-n200'));
    assert.equal(st.data().prev, 'open');
  });
  test('"prev" is optional: a different answer within 6 hours without it is still accepted (older phones never send it)', async () => {
    await vote(db(RINA), RINA, 'osm-n210', 'open', 1);
    await assertSucceeds(vote(db(KARIM), KARIM, 'osm-n210', 'closed', 1));
    const st = await getDoc(doc(db(null), 'placeStatus', 'osm-n210'));
    assert.equal(st.data().status, 'closed');
    assert.equal(st.data().prev, undefined);
  });
  test('"prev" is refused when the earlier answer is older than 6 hours, but the plain answer is accepted', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'placeStatus', 'osm-n211'), { status: 'open', n: 1, at: new Date(Date.now() - 7 * 3600000) }); });
    await assertFails(vote(db(KARIM), KARIM, 'osm-n211', 'closed', 1, 'open'));   // too old for a conflict flag
    await assertSucceeds(vote(db(KARIM), KARIM, 'osm-n211', 'closed', 1));        // the answer itself is fine, so the failure above was about "prev"
  });
  test('"prev" is refused on a first answer, and with extra fields', async () => {
    await assertFails(vote(db(RINA), RINA, 'osm-n201', 'open', 1, 'closed'));
    const f = db(KARIM), b = writeBatch(f);
    b.set(doc(f, 'placeStatus', 'osm-n202'), { status: 'open', n: 1, at: serverTimestamp(), who: KARIM });
    b.set(doc(f, 'placeStatus', 'osm-n202', 'by', KARIM), { status: 'open', at: serverTimestamp() });
    await assertFails(b.commit());
  });
  test('"Shelter Open" is a status; the old field name "value" is refused (ER diagram: status)', async () => {
    await assertSucceeds(vote(db(RINA), RINA, 'osm-n777', 'shelter_open', 1));
    const f = db(KARIM), b = writeBatch(f);
    b.set(doc(f, 'placeStatus', 'osm-n778'), { value: 'open', n: 1, at: serverTimestamp() });
    b.set(doc(f, 'placeStatus', 'osm-n778', 'by', KARIM), { value: 'open', at: serverTimestamp() });
    await assertFails(b.commit());
  });
  test('the same person again within 30 minutes: refused', async () => {
    await vote(db(RINA), RINA, 'osm-n123', 'open', 1);
    await assertFails(vote(db(RINA), RINA, 'osm-n123', 'open', 2));
  });
  test('the summary alone, signed out, unverified, an unknown answer or a bad place id: refused', async () => {
    await assertFails(setDoc(doc(db(RINA), 'placeStatus', 'osm-n123'), { status: 'open', n: 1, at: serverTimestamp() }));
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
