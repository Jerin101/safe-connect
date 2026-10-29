// Security-rule tests for firestore.rules (P17). They run only on the laptop, in the free
// Firestore emulator, with a fake "demo-" project: no real data, no real accounts.
// Run: npm run test:rules
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import assert from 'node:assert/strict';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where, orderBy, limit } from 'firebase/firestore';
import { reportFields, auditFields, PROBLEMS, REPORT_DISTRICTS, NOTE_MAX } from '../../js/reports.js';
import { roleAuditFields, SITE_ROLES } from '../../js/admin.js';

const ADMIN = 'admin-uid';
const ADMIN2 = 'admin2-uid';
const RINA = 'rina-uid';
const KARIM = 'karim-uid';
const VOL = 'vol-uid';
let env;

const db = (uid) => (uid ? env.authenticatedContext(uid, { email: `${uid}@example.com` }) : env.unauthenticatedContext()).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-safeconnect',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'admins', ADMIN), { since: new Date(), addedBy: 'console' });
    await setDoc(doc(f, 'admins', ADMIN2), { since: new Date(), addedBy: 'console' });
    await setDoc(doc(f, 'users', ADMIN), { name: 'Admin', email: 'admin-uid@example.com', lang: 'bn', createdAt: new Date(), role: 'user' });
    await setDoc(doc(f, 'users', VOL), { name: 'Vol', email: 'vol-uid@example.com', lang: 'bn', createdAt: new Date(), role: 'volunteer' });
    await setDoc(doc(f, 'users', RINA), { name: 'Rina', email: 'rina-uid@example.com', lang: 'bn', createdAt: new Date(), role: 'user' });
    await setDoc(doc(f, 'users', KARIM), { name: 'Karim', email: 'karim-uid@example.com', lang: 'bn', createdAt: new Date(), role: 'user' });
    await setDoc(doc(f, 'reports', 'r1'), { uid: RINA, recordId: 'noakhali-up-123', district: 'noakhali', area: 'Sharifpur', problem: 'off', note: '', status: 'open', createdAt: new Date(), updatedAt: new Date() });
  });
});

const newProfile = (uid, role = 'user') => ({ name: 'Test', email: `${uid}@example.com`, lang: 'bn', createdAt: serverTimestamp(), role });
const newReport = (uid, extra = {}) => ({ uid, recordId: 'noakhali-up-123', district: 'noakhali', area: 'Sharifpur', problem: 'off', note: 'tried twice', status: 'open',
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
const auditEntry = (actorUid, action, entity, entityId) => ({ actorUid, action, entity, entityId, at: serverTimestamp(), meta: {} });

describe('signed out', () => {
  test('cannot read profiles or reports', async () => {
    await assertFails(getDoc(doc(db(null), 'users', RINA)));
    await assertFails(getDoc(doc(db(null), 'reports', 'r1')));
  });
  test('cannot create a report', async () => {
    await assertFails(setDoc(doc(db(null), 'reports', 'x'), newReport('nobody')));
  });
});

describe('profiles and roles', () => {
  test('a new user can create their own profile as "user"', async () => {
    await assertSucceeds(setDoc(doc(db('new-uid'), 'users', 'new-uid'), newProfile('new-uid')));
  });
  test('a new user cannot make themselves admin or volunteer', async () => {
    await assertFails(setDoc(doc(db('new-uid'), 'users', 'new-uid'), newProfile('new-uid', 'admin')));
    await assertFails(setDoc(doc(db('new-uid'), 'users', 'new-uid'), newProfile('new-uid', 'volunteer')));
  });
  test('nobody can create a profile for someone else', async () => {
    await assertFails(setDoc(doc(db(RINA), 'users', 'other-uid'), newProfile('other-uid')));
  });
  test('a user can change their name and language', async () => {
    await assertSucceeds(updateDoc(doc(db(RINA), 'users', RINA), { name: 'Rina Akter', lang: 'en' }));
  });
  test('a user cannot change their own role', async () => {
    await assertFails(updateDoc(doc(db(RINA), 'users', RINA), { role: 'admin' }));
    await assertFails(updateDoc(doc(db(RINA), 'users', RINA), { role: 'volunteer' }));
  });
  test('a user cannot read another user\'s profile', async () => {
    await assertFails(getDoc(doc(db(RINA), 'users', KARIM)));
  });
  test('an admin can read profiles', async () => {
    await assertSucceeds(getDoc(doc(db(ADMIN), 'users', RINA)));
  });
  test('nobody can add themselves to admins from the site', async () => {
    await assertFails(setDoc(doc(db(RINA), 'admins', RINA), { since: new Date() }));
    await assertFails(setDoc(doc(db(ADMIN), 'admins', RINA), { since: new Date() }));
  });
  test('only admins can read the admin list', async () => {
    await assertFails(getDoc(doc(db(RINA), 'admins', ADMIN)));
    await assertSucceeds(getDoc(doc(db(ADMIN), 'admins', ADMIN)));
  });
});

describe('admin role change needs an audit entry', () => {
  test('works with an audit entry in the same batch', async () => {
    const f = db(ADMIN); const b = writeBatch(f);
    // Since #65 the entry must also say the old and the new role.
    b.set(doc(f, 'audit', 'a1'), { ...auditEntry(ADMIN, 'ROLE_CHANGED', 'users', KARIM), meta: { from: 'user', to: 'volunteer' } });
    b.update(doc(f, 'users', KARIM), { role: 'volunteer', lastAuditId: 'a1' });
    await assertSucceeds(b.commit());
  });
  test('fails without an audit entry', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), 'users', KARIM), { role: 'volunteer', lastAuditId: 'missing' }));
  });
  test('fails when the audit entry is about another person', async () => {
    const f = db(ADMIN); const b = writeBatch(f);
    b.set(doc(f, 'audit', 'a2'), auditEntry(ADMIN, 'ROLE_CHANGED', 'users', RINA));
    b.update(doc(f, 'users', KARIM), { role: 'volunteer', lastAuditId: 'a2' });
    await assertFails(b.commit());
  });
  test('an admin cannot make anyone admin from the site', async () => {
    const f = db(ADMIN); const b = writeBatch(f);
    b.set(doc(f, 'audit', 'a3'), auditEntry(ADMIN, 'ROLE_CHANGED', 'users', KARIM));
    b.update(doc(f, 'users', KARIM), { role: 'admin', lastAuditId: 'a3' });
    await assertFails(b.commit());
  });
});

describe('family numbers (sync is optional)', () => {
  test('the owner can save a valid number', async () => {
    await assertSucceeds(setDoc(doc(db(RINA), 'family', RINA, 'people', 'p1'), { name: 'Ma', relation: 'mother', phone: '01712345678' }));
  });
  test('a wrong phone number is refused', async () => {
    await assertFails(setDoc(doc(db(RINA), 'family', RINA, 'people', 'p1'), { name: 'Ma', relation: 'mother', phone: '12345' }));
  });
  test('no extra fields such as a home address', async () => {
    await assertFails(setDoc(doc(db(RINA), 'family', RINA, 'people', 'p1'), { name: 'Ma', phone: '01712345678', address: 'house 5' }));
  });
  test('nobody else can read or write them, not even an admin', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'family', RINA, 'people', 'p1'), { name: 'Ma', relation: 'mother', phone: '01712345678' }));
    await assertFails(getDoc(doc(db(KARIM), 'family', RINA, 'people', 'p1')));
    await assertFails(getDoc(doc(db(ADMIN), 'family', RINA, 'people', 'p1')));
    await assertFails(setDoc(doc(db(KARIM), 'family', RINA, 'people', 'p2'), { name: 'X', phone: '01712345678' }));
  });
});

// The workspace copy (issue #78): "Keep a copy in my account" writes family/{uid}/people/p1..p3 in one batch,
// reads the list when the workspace opens, and deletes every document when the person turns it off.
// No rule changed for this; these tests show the existing rules allow exactly that and nothing more.
const ma = { name: 'Ma', relation: 'mother', phone: '01712345678' };
const people = (uid) => collection(db(uid), 'family', uid, 'people');
const person = (as, owner, id) => doc(db(as), 'family', owner, 'people', id);
const seedCopy = () => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'family', RINA, 'people', 'p1'), ma));
describe('family copy in the account (workspace, issue #78)', () => {
  test('the owner can write the whole copy in one batch (set p1, p2; delete p3) and read the list', async () => {
    const f = db(RINA);
    const b = writeBatch(f);
    b.set(doc(f, 'family', RINA, 'people', 'p1'), ma);
    b.set(doc(f, 'family', RINA, 'people', 'p2'), { name: 'Baba', phone: '01812345678' });
    b.delete(doc(f, 'family', RINA, 'people', 'p3'));
    await assertSucceeds(b.commit());
    await assertSucceeds(getDocs(people(RINA)));
  });
  test('the owner can turn the copy off (delete every document)', async () => {
    await seedCopy();
    const f = db(RINA);
    const b = writeBatch(f);
    for (const id of ['p1', 'p2', 'p3']) b.delete(doc(f, 'family', RINA, 'people', id));
    await assertSucceeds(b.commit());
  });
  test('signed out: cannot read, list, write or delete a copy', async () => {
    await seedCopy();
    await assertFails(getDoc(person(null, RINA, 'p1')));
    await assertFails(getDocs(collection(db(null), 'family', RINA, 'people')));
    await assertFails(setDoc(person(null, RINA, 'p2'), ma));
    await assertFails(deleteDoc(person(null, RINA, 'p1')));
  });
  test('another user cannot list, change or delete the copy', async () => {
    await seedCopy();
    await assertFails(getDocs(collection(db(KARIM), 'family', RINA, 'people')));
    await assertFails(setDoc(person(KARIM, RINA, 'p1'), ma));
    await assertFails(deleteDoc(person(KARIM, RINA, 'p1')));
    await assertFails(getDocs(collection(db(ADMIN), 'family', RINA, 'people')));
  });
  test('an empty name, a too long name or relation, and wrong types are refused', async () => {
    await assertFails(setDoc(person(RINA, RINA, 'p1'), { ...ma, name: '' }));
    await assertFails(setDoc(person(RINA, RINA, 'p1'), { ...ma, name: 'x'.repeat(41) }));
    await assertFails(setDoc(person(RINA, RINA, 'p1'), { ...ma, relation: 'x'.repeat(21) }));
    await assertFails(setDoc(person(RINA, RINA, 'p1'), { ...ma, phone: 1712345678 }));
    await assertFails(setDoc(person(RINA, RINA, 'p1'), { ...ma, name: 42 }));
    await assertFails(setDoc(person(RINA, RINA, 'p1'), { name: 'Ma', relation: 'mother' }));
    await assertFails(setDoc(person(RINA, RINA, 'p1'), { ...ma, phone: '+8801712345678' }));
  });
  test('a batch with one bad document is refused as a whole', async () => {
    const f = db(RINA);
    const b = writeBatch(f);
    b.set(doc(f, 'family', RINA, 'people', 'p1'), ma);
    b.set(doc(f, 'family', RINA, 'people', 'p2'), { ...ma, address: 'house 5' });
    await assertFails(b.commit());
  });
  test('turning on the copy does not let the owner change their own role', async () => {
    const f = db(RINA);
    const b = writeBatch(f);
    b.set(doc(f, 'family', RINA, 'people', 'p1'), ma);
    b.update(doc(f, 'users', RINA), { role: 'admin' });
    await assertFails(b.commit());
  });
});

describe('saved places', () => {
  test('the owner can save an area', async () => {
    await assertSucceeds(setDoc(doc(db(RINA), 'places', RINA, 'saved', 's1'), { district: 'noakhali', upazila: 'Begumganj', area: 'Sharifpur' }));
  });
  test('another user cannot read them', async () => {
    await assertFails(getDoc(doc(db(KARIM), 'places', RINA, 'saved', 's1')));
  });
});

describe('wrong-number reports', () => {
  test('a user can send a report as themselves', async () => {
    await assertSucceeds(setDoc(doc(db(KARIM), 'reports', 'r2'), newReport(KARIM)));
  });
  test('a report cannot pretend to come from someone else', async () => {
    await assertFails(setDoc(doc(db(KARIM), 'reports', 'r2'), newReport(RINA)));
  });
  test('a new report cannot start as "fixed"', async () => {
    await assertFails(setDoc(doc(db(KARIM), 'reports', 'r2'), newReport(KARIM, { status: 'fixed' })));
  });
  test('a very long note is refused', async () => {
    await assertFails(setDoc(doc(db(KARIM), 'reports', 'r2'), newReport(KARIM, { note: 'x'.repeat(501) })));
  });
  test('the reporter and admins can read it, other users cannot', async () => {
    await assertSucceeds(getDoc(doc(db(RINA), 'reports', 'r1')));
    await assertSucceeds(getDoc(doc(db(ADMIN), 'reports', 'r1')));
    await assertFails(getDoc(doc(db(KARIM), 'reports', 'r1')));
  });
  test('the reporter cannot change the status', async () => {
    await assertFails(updateDoc(doc(db(RINA), 'reports', 'r1'), { status: 'fixed', updatedAt: serverTimestamp() }));
  });
  test('an admin changes the status with an audit entry', async () => {
    const f = db(ADMIN); const b = writeBatch(f);
    b.set(doc(f, 'audit', 'a4'), auditEntry(ADMIN, 'REPORT_STATUS_CHANGED', 'reports', 'r1'));
    b.update(doc(f, 'reports', 'r1'), { status: 'review', updatedAt: serverTimestamp(), lastAuditId: 'a4' });
    await assertSucceeds(b.commit());
  });
  test('an admin cannot change the status without an audit entry', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), 'reports', 'r1'), { status: 'fixed', updatedAt: serverTimestamp() }));
  });
  test('reports cannot be deleted', async () => {
    await assertFails(deleteDoc(doc(db(RINA), 'reports', 'r1')));
    await assertFails(deleteDoc(doc(db(ADMIN), 'reports', 'r1')));
  });
});

describe('audit log is append-only', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'audit', 'old'), { actorUid: ADMIN, action: 'ROLE_CHANGED', entity: 'users', entityId: KARIM, at: new Date(), meta: {} }));
  });
  test('admins can read it, users cannot', async () => {
    await assertSucceeds(getDoc(doc(db(ADMIN), 'audit', 'old')));
    await assertFails(getDoc(doc(db(RINA), 'audit', 'old')));
  });
  test('nobody can edit or delete an entry, not even an admin', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), 'audit', 'old'), { action: 'REPORT_STATUS_CHANGED' }));
    await assertFails(deleteDoc(doc(db(ADMIN), 'audit', 'old')));
  });
  test('a user cannot write audit entries', async () => {
    await assertFails(setDoc(doc(db(RINA), 'audit', 'fake'), auditEntry(RINA, 'ROLE_CHANGED', 'users', RINA)));
  });
  test('an admin cannot write an entry in someone else\'s name', async () => {
    await assertFails(setDoc(doc(db(ADMIN), 'audit', 'fake'), auditEntry('someone-else', 'ROLE_CHANGED', 'users', RINA)));
  });
});

describe('everything else is closed until P38', () => {
  test('volunteer applications cannot be written yet', async () => {
    await assertFails(setDoc(doc(db(RINA), 'applications', 'x'), { uid: RINA }));
    await assertFails(getDoc(doc(db(ADMIN), 'confirmations', 'code')));
  });
});

// Issue #79: the exact documents js/reports.js and js/firebase.js write must pass the existing rules,
// and wrong shapes must be refused. Test accounts only (fake uids), nothing real.
describe('report form and lists (issue #79)', () => {
  const draft = { recordId: '966c0c478a', district: 'noakhali', area: 'শরীফপুর ইউনিয়ন', problem: 'changed', note: 'গতকাল তিনবার চেষ্টা করেছি' };
  const written = (uid, d = draft) => ({ ...reportFields(uid, d), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  test('the site builds only the allowed fields, and nothing for a bad draft', () => {
    assert.deepEqual(Object.keys(reportFields(KARIM, draft)).sort(), ['area', 'district', 'note', 'problem', 'recordId', 'status', 'uid']);
    assert.equal(reportFields(KARIM, draft).status, 'open');
    assert.deepEqual(Object.keys(reportFields(KARIM, { ...draft, note: '  ', area: '' })).sort(), ['district', 'problem', 'recordId', 'status', 'uid']);
    assert.equal(reportFields(KARIM, { ...draft, problem: 'missing' }), null);
    assert.equal(reportFields(KARIM, { ...draft, district: 'dhaka' }), null);
    assert.equal(reportFields(null, draft), null);
    assert.equal([...reportFields(KARIM, { ...draft, note: 'ক'.repeat(NOTE_MAX + 50) }).note].length, NOTE_MAX);
  });
  test('the exact report the site sends is accepted (with and without note and area)', async () => {
    await assertSucceeds(setDoc(doc(collection(db(KARIM), 'reports')), written(KARIM)));
    await assertSucceeds(setDoc(doc(collection(db(KARIM), 'reports')), written(KARIM, { ...draft, note: '', area: '' })));
  });
  test('the longest Bangla note and area the site allows are accepted', async () => {
    const long = { ...draft, note: 'ক্ষ'.repeat(NOTE_MAX), area: 'ক'.repeat(200) };
    await assertSucceeds(setDoc(doc(collection(db(KARIM), 'reports')), written(KARIM, long)));
  });
  test('every problem choice is accepted, in both districts', async () => {
    for (const problem of PROBLEMS) for (const district of REPORT_DISTRICTS) {
      await assertSucceeds(setDoc(doc(collection(db(KARIM), 'reports')), written(KARIM, { ...draft, problem, district })));
    }
  });
  test('wrong shapes are refused: extra fields, unknown problem, other district, browser time, signed out', async () => {
    const f = db(KARIM); const ref = () => doc(collection(f, 'reports'));
    await assertFails(setDoc(ref(), { ...written(KARIM), phone: '01712345678' }));
    await assertFails(setDoc(ref(), { ...written(KARIM), address: 'house 1' }));
    await assertFails(setDoc(ref(), { ...written(KARIM), problem: 'missing' }));
    await assertFails(setDoc(ref(), { ...written(KARIM), district: 'dhaka' }));
    await assertFails(setDoc(ref(), { ...written(KARIM), createdAt: new Date() }));
    await assertFails(setDoc(ref(), { ...written(KARIM), recordId: 7 }));
    await assertFails(setDoc(doc(collection(db(null), 'reports')), written('nobody')));
  });
  test('"My reports": a user can list only their own reports', async () => {
    const mine = await assertSucceeds(getDocs(query(collection(db(RINA), 'reports'), where('uid', '==', RINA))));
    assert.equal(mine.size, 1);
    await assertFails(getDocs(collection(db(RINA), 'reports')));
    await assertFails(getDocs(query(collection(db(KARIM), 'reports'), where('uid', '==', RINA))));
  });
  test('admin list: an admin can list the newest reports, a user cannot', async () => {
    const snap = await assertSucceeds(getDocs(query(collection(db(ADMIN), 'reports'), orderBy('createdAt', 'desc'), limit(100))));
    assert.equal(snap.size, 1);
    await assertFails(getDocs(query(collection(db(RINA), 'reports'), orderBy('createdAt', 'desc'), limit(100))));
  });
  test('admin status change: the exact batch the site writes is accepted for every status', async () => {
    let from = 'open';
    for (const to of ['review', 'fixed', 'same', 'open']) {
      const f = db(ADMIN); const b = writeBatch(f);
      const auditRef = doc(collection(f, 'audit'));
      b.set(auditRef, { ...auditFields(ADMIN, 'r1', from, to), at: serverTimestamp() });
      b.update(doc(f, 'reports', 'r1'), { status: to, updatedAt: serverTimestamp(), lastAuditId: auditRef.id });
      await assertSucceeds(b.commit());
      from = to;
    }
  });
  test('a status change by a user, an unknown status or an audit entry about another report is refused', async () => {
    const tryBatch = async (uid, to, entityId) => {
      const f = db(uid); const b = writeBatch(f);
      const auditRef = doc(collection(f, 'audit'));
      b.set(auditRef, { ...auditFields(uid, entityId, 'open', to), at: serverTimestamp() });
      b.update(doc(f, 'reports', 'r1'), { status: to, updatedAt: serverTimestamp(), lastAuditId: auditRef.id });
      return b.commit();
    };
    await assertFails(tryBatch(RINA, 'fixed', 'r1'));
    await assertFails(tryBatch(ADMIN, 'deleted', 'r1'));
    await assertFails(tryBatch(ADMIN, 'fixed', 'r2'));
  });
});

// Issue #65 (P44): admin workspace. Users and roles, audit log. Fake uids only, nothing real.
// A role change is one batch: users/{uid} { role, lastAuditId } + audit/{id} with meta { from, to }.
describe('admin workspace: users and roles (issue #65)', () => {
  const roleBatch = (as, target, from, to, opts = {}) => {
    const f = db(as); const b = writeBatch(f);
    const auditRef = doc(collection(f, 'audit'));
    const entry = opts.entry || { actorUid: as, action: 'ROLE_CHANGED', entity: 'users', entityId: target, meta: { from, to } };
    if (!opts.noAudit) b.set(auditRef, { ...entry, at: serverTimestamp(), ...(opts.extra || {}) });
    if (!opts.noChange) b.update(doc(f, 'users', opts.changeId || target), { role: to, lastAuditId: opts.lastAuditId || auditRef.id, ...(opts.more || {}) });
    return b.commit();
  };
  test('the site builds the audit entry only for a real change by someone else', () => {
    assert.deepEqual(SITE_ROLES, ['user', 'volunteer']);
    assert.deepEqual(roleAuditFields(ADMIN, KARIM, 'user', 'volunteer'),
      { actorUid: ADMIN, action: 'ROLE_CHANGED', entity: 'users', entityId: KARIM, meta: { from: 'user', to: 'volunteer' } });
    assert.equal(roleAuditFields(ADMIN, ADMIN, 'user', 'volunteer'), null);
    assert.equal(roleAuditFields(ADMIN, KARIM, 'user', 'admin'), null);
    assert.equal(roleAuditFields(ADMIN, KARIM, 'user', 'user'), null);
    assert.equal(roleAuditFields(ADMIN, KARIM, 'admin', 'user'), null);
    assert.equal(roleAuditFields(null, KARIM, 'user', 'volunteer'), null);
    assert.equal(roleAuditFields(ADMIN, 'a/b', 'user', 'volunteer'), null);
  });
  test('the exact batch the site writes is accepted (user -> volunteer -> user)', async () => {
    let from = 'user';
    for (const to of ['volunteer', 'user']) {
      const f = db(ADMIN); const b = writeBatch(f);
      const auditRef = doc(collection(f, 'audit'));
      b.set(auditRef, { ...roleAuditFields(ADMIN, KARIM, from, to), at: serverTimestamp() });
      b.update(doc(f, 'users', KARIM), { role: to, lastAuditId: auditRef.id });
      await assertSucceeds(b.commit());
      from = to;
    }
    await env.withSecurityRulesDisabled(async (ctx) => {
      assert.equal((await getDoc(doc(ctx.firestore(), 'users', KARIM))).data().role, 'user');
    });
  });
  test('a role change without its audit entry in the same batch is refused', async () => {
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'volunteer', { noAudit: true }));
    await assertFails(updateDoc(doc(db(ADMIN), 'users', KARIM), { role: 'volunteer' }));
  });
  test('an old audit entry cannot be used again', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'audit', 'old1'), { actorUid: ADMIN, action: 'ROLE_CHANGED', entity: 'users', entityId: KARIM, at: new Date(), meta: { from: 'user', to: 'volunteer' } }));
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'volunteer', { noAudit: true, lastAuditId: 'old1' }));
  });
  test('an audit entry about another target is refused', async () => {
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'volunteer', { changeId: RINA }));
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'volunteer', { entry: { actorUid: ADMIN, action: 'REPORT_STATUS_CHANGED', entity: 'reports', entityId: 'r1', meta: { from: 'open', to: 'review' } } }));
  });
  test('an audit entry with no change in the same batch is refused', async () => {
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'volunteer', { noChange: true }));
    await assertFails(setDoc(doc(db(ADMIN), 'audit', 'lone'), { actorUid: ADMIN, action: 'REPORT_STATUS_CHANGED', entity: 'reports', entityId: 'r1', at: serverTimestamp(), meta: { from: 'open', to: 'fixed' } }));
  });
  test('the audit entry must tell the truth: old and new role, and a real change', async () => {
    await assertFails(roleBatch(ADMIN, KARIM, 'volunteer', 'volunteer'));
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'user'));
    const f = db(ADMIN); const b = writeBatch(f); const a = doc(collection(f, 'audit'));
    b.set(a, { actorUid: ADMIN, action: 'ROLE_CHANGED', entity: 'users', entityId: KARIM, at: serverTimestamp(), meta: { from: 'user', to: 'user' } });
    b.update(doc(f, 'users', KARIM), { role: 'volunteer', lastAuditId: a.id });
    await assertFails(b.commit());
    const f2 = db(ADMIN); const b2 = writeBatch(f2); const a2 = doc(collection(f2, 'audit'));
    b2.set(a2, { actorUid: ADMIN, action: 'ROLE_CHANGED', entity: 'users', entityId: KARIM, at: serverTimestamp() });
    b2.update(doc(f2, 'users', KARIM), { role: 'volunteer', lastAuditId: a2.id });
    await assertFails(b2.commit());
  });
  test('an admin cannot change the role of another admin (review of PR #93)', async () => {
    await assertFails(roleBatch(ADMIN2, ADMIN, 'user', 'volunteer'));
    await assertSucceeds(roleBatch(ADMIN2, KARIM, 'user', 'volunteer'));
  });
  test('nobody can change their own role, not even an admin', async () => {
    await assertFails(roleBatch(ADMIN, ADMIN, 'user', 'volunteer'));
    await assertFails(roleBatch(RINA, RINA, 'user', 'volunteer'));
    await assertFails(roleBatch(VOL, VOL, 'volunteer', 'user'));
  });
  test('self-promotion is refused: no "admin" role, no admins/{uid} from the site', async () => {
    await assertFails(roleBatch(RINA, RINA, 'user', 'admin'));
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'admin'));
    const f = db(RINA); const b = writeBatch(f);
    b.set(doc(f, 'admins', RINA), { since: new Date(), addedBy: RINA });
    b.set(doc(f, 'audit', 'self'), { actorUid: RINA, action: 'ROLE_CHANGED', entity: 'users', entityId: RINA, at: serverTimestamp(), meta: { from: 'user', to: 'volunteer' } });
    await assertFails(b.commit());
    await assertFails(setDoc(doc(db(ADMIN), 'admins', KARIM), { since: new Date(), addedBy: ADMIN }));
    await assertFails(deleteDoc(doc(db(ADMIN), 'admins', ADMIN2)));
  });
  test('a normal user, a volunteer or someone signed out cannot change a role', async () => {
    await assertFails(roleBatch(RINA, KARIM, 'user', 'volunteer'));
    await assertFails(roleBatch(VOL, KARIM, 'user', 'volunteer'));
    await assertFails(updateDoc(doc(db(null), 'users', KARIM), { role: 'volunteer', lastAuditId: 'x' }));
  });
  test('a role change cannot change anything else (name, email)', async () => {
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'volunteer', { more: { email: 'new@example.com' } }));
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'volunteer', { more: { name: 'X' } }));
  });
  test('field whitelist, types and sizes of the audit entry', async () => {
    const base = { actorUid: ADMIN, action: 'ROLE_CHANGED', entity: 'users', entityId: KARIM, meta: { from: 'user', to: 'volunteer' } };
    const bad = [
      { ...base, note: 'extra field' },
      { ...base, entity: 'reports' },
      { ...base, action: 'USER_DELETED' },
      { ...base, actorUid: ADMIN2 },
      { ...base, meta: { from: 'user', to: 'volunteer', email: 'x@example.com' } },
      { ...base, meta: 'user -> volunteer' },
      { ...base, meta: { from: 1, to: 'volunteer' } },
    ];
    for (const entry of bad) await assertFails(roleBatch(ADMIN, KARIM, 'user', 'volunteer', { entry }));
    await assertFails(roleBatch(ADMIN, KARIM, 'user', 'volunteer', { extra: { at: new Date() } }));
    const long = 'k'.repeat(129);
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users', long), { name: 'L', lang: 'bn', createdAt: new Date(), role: 'user' }));
    await assertFails(roleBatch(ADMIN, long, 'user', 'volunteer'));
  });
  test('an admin can list users and the admin list; others cannot', async () => {
    const q = (uid) => query(collection(db(uid), 'users'), orderBy('createdAt', 'desc'), limit(200));
    const snap = await assertSucceeds(getDocs(q(ADMIN)));
    assert.equal(snap.size, 4);
    await assertSucceeds(getDocs(collection(db(ADMIN), 'admins')));
    for (const uid of [RINA, VOL, null]) {
      await assertFails(getDocs(q(uid)));
      await assertFails(getDocs(collection(db(uid), 'admins')));
    }
  });
});

describe('admin workspace: audit log (issue #65)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const f = ctx.firestore();
      await setDoc(doc(f, 'audit', 'e1'), { actorUid: ADMIN, action: 'ROLE_CHANGED', entity: 'users', entityId: KARIM, at: new Date('2026-10-20T10:00:00Z'), meta: { from: 'user', to: 'volunteer' } });
      await setDoc(doc(f, 'audit', 'e2'), { actorUid: ADMIN2, action: 'REPORT_STATUS_CHANGED', entity: 'reports', entityId: 'r1', at: new Date('2026-10-25T10:00:00Z'), meta: { from: 'open', to: 'review' } });
    });
  });
  const listAs = (uid, ...filters) => getDocs(query(collection(db(uid), 'audit'), ...filters, orderBy('at', 'desc'), limit(100)));
  test('an admin can list it with the filters the site uses (type, person, date)', async () => {
    assert.equal((await assertSucceeds(listAs(ADMIN))).size, 2);
    assert.equal((await assertSucceeds(listAs(ADMIN, where('action', '==', 'ROLE_CHANGED')))).size, 1);
    assert.equal((await assertSucceeds(listAs(ADMIN, where('actorUid', '==', ADMIN2)))).size, 1);
    assert.equal((await assertSucceeds(listAs(ADMIN, where('at', '>=', new Date('2026-10-22T00:00:00Z')), where('at', '<', new Date('2026-10-30T00:00:00Z'))))).size, 1);
    assert.equal((await assertSucceeds(listAs(ADMIN, where('action', '==', 'ROLE_CHANGED'), where('actorUid', '==', ADMIN2)))).size, 0);
  });
  test('a user, a volunteer or someone signed out cannot read or list it', async () => {
    for (const uid of [RINA, VOL, null]) {
      await assertFails(listAs(uid));
      await assertFails(listAs(uid, where('actorUid', '==', ADMIN)));
      await assertFails(getDoc(doc(db(uid), 'audit', 'e1')));
    }
  });
  test('nobody can update or delete an entry, not even the admin who wrote it', async () => {
    await assertFails(updateDoc(doc(db(ADMIN), 'audit', 'e1'), { meta: { from: 'user', to: 'user' } }));
    await assertFails(setDoc(doc(db(ADMIN), 'audit', 'e1'), { actorUid: ADMIN, action: 'ROLE_CHANGED', entity: 'users', entityId: KARIM, at: serverTimestamp(), meta: { from: 'user', to: 'volunteer' } }));
    await assertFails(deleteDoc(doc(db(ADMIN), 'audit', 'e1')));
    await assertFails(deleteDoc(doc(db(ADMIN2), 'audit', 'e1')));
    await assertFails(deleteDoc(doc(db(RINA), 'audit', 'e1')));
  });
  test('an entry cannot be re-written inside a role-change batch either', async () => {
    const f = db(ADMIN); const b = writeBatch(f);
    b.set(doc(f, 'audit', 'e1'), { actorUid: ADMIN, action: 'ROLE_CHANGED', entity: 'users', entityId: KARIM, at: serverTimestamp(), meta: { from: 'user', to: 'volunteer' } });
    b.update(doc(f, 'users', KARIM), { role: 'volunteer', lastAuditId: 'e1' });
    await assertFails(b.commit());
  });
});
