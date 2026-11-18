// SafeConnect accounts (P45): Firebase App, Auth and Firestore, one pinned version from gstatic.
// Load this file only with import(), and only after a tap (opening sign-in or "Open my account") or on reset.html,
// which the person opened from their password-reset email (and only after that page shows 999):
// help (999, send location, area numbers) must never wait for it and works with no internet.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, reload, sendPasswordResetEmail, signOut, verifyPasswordResetCode, confirmPasswordReset,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, collection, getDocs, writeBatch, query, where, orderBy, limit, increment,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Emails from Firebase (password reset) in the site language.
export function setLang(lang) { auth.languageCode = lang; }

export const watchUser = (callback) => onAuthStateChanged(auth, callback);
// Waits until Firebase knows whether someone is signed in on this phone, then gives that user (or null).
export const currentUser = async () => { await auth.authStateReady(); return auth.currentUser; };
// Popup only: a redirect breaks on phones, because github.io and firebaseapp.com are different sites.
export const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signInEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
// A new email account gets a verification email at once: reports need a verified email (issue #117).
export const createAccount = async (email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  try { await sendEmailVerification(cred.user); } catch { /* the report window can send it again */ }
  return cred;
};
export const resendVerify = () => sendEmailVerification(auth.currentUser);
// Has this person verified their email (maybe in another tab)? Refreshes the sign-in token so the rules see it too.
// The rules read the token's email_verified claim, which can be older than the user object after a reload.
export async function isVerified() {
  const u = auth.currentUser;
  if (!u) return false;
  if ((await u.getIdTokenResult()).claims.email_verified) return true;
  await reload(u);
  if (!auth.currentUser.emailVerified) return false;
  return !!(await auth.currentUser.getIdTokenResult(true)).claims.email_verified;
}
// The link in the reset email opens the "action URL" set in the Firebase console, not an address in this code.
// TODO (NEEDS JERIN, issue #74): Firebase console -> Authentication -> Templates -> Password reset -> "Customize action URL"
// -> https://jerin101.github.io/safe-connect/reset.html . Until then the email opens Firebase's own default page.
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
// reset.html (issue #74): check the code from the email link (gives the account's email), then save the new password.
export const verifyResetCode = (code) => verifyPasswordResetCode(auth, code);
export const confirmReset = (code, password) => confirmPasswordReset(auth, code, password);
export const signOutNow = () => signOut(auth);

// First sign-in: create users/{uid} with exactly the fields firestore.rules allow.
async function ensureProfile(user, lang) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const profile = { name: (user.displayName || '').slice(0, 60), lang, createdAt: serverTimestamp(), role: 'user' };
  if (user.email) profile.email = user.email;
  await setDoc(ref, profile);
  return { role: 'user' };
}

// Only an admin may read admins/{uid}; for everyone else the rules answer "permission-denied".
async function isAdmin(user) {
  try {
    return (await getDoc(doc(db, 'admins', user.uid))).exists();
  } catch (err) {
    if (err.code === 'permission-denied') return false;
    throw err;
  }
}

// The workspace this account may open: 'admin', 'volunteer' or 'user'.
export async function roleOf(user, lang) {
  const profile = await ensureProfile(user, lang);
  if (await isAdmin(user)) return 'admin';
  return profile.role === 'volunteer' ? 'volunteer' : 'user';
}

// Family numbers copy (P35, issue #78). Only when the person turns on "Keep a copy in my account".
// The phone list (localStorage "sc-family", at most 3) is the real list; the account keeps a copy in
// family/{uid}/people/p1..p3 with exactly the fields firestore.rules allow: name, relation (optional), phone.
const FAMILY_IDS = ['p1', 'p2', 'p3'];
const familyRef = (uid, id) => doc(db, 'family', uid, 'people', id);
// The copy in the account, in order: [{ name, relation, phone }].
export async function readFamily(uid) {
  const snap = await getDocs(collection(db, 'family', uid, 'people'));
  return snap.docs.filter((d) => FAMILY_IDS.includes(d.id)).sort((a, b) => a.id.localeCompare(b.id)).map((d) => d.data());
}
// Replace the copy with this list (already cleaned by js/workspace.js), in one batch.
export async function saveFamily(uid, people) {
  const batch = writeBatch(db);
  FAMILY_IDS.forEach((id, i) => { if (people[i]) batch.set(familyRef(uid, id), people[i]); else batch.delete(familyRef(uid, id)); });
  await batch.commit();
}
// Turning the copy off deletes every document in it (also any not made by this version).
export async function deleteFamily(uid) {
  const snap = await getDocs(collection(db, 'family', uid, 'people'));
  const batch = writeBatch(db);
  const ids = new Set([...FAMILY_IDS, ...snap.docs.map((d) => d.id)]);
  for (const id of ids) batch.delete(familyRef(uid, id));
  await batch.commit();
}

// Wrong-number reports (P18, issue #79). js/reports.js builds the fields (reportFields, auditFields) in exactly the
// shape firestore.rules allow; here only the server times are added.
const millis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : null);
const asReport = (d) => { const x = d.data(); return { id: d.id, ...x, createdAt: millis(x.createdAt), updatedAt: millis(x.updatedAt) }; };
const newest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
// The report and limits/{uid} are written in one batch; firestore.rules check both (issue #117): at most 10 per
// day (UTC day number, as in the rules) and 60 s between two. A limit we can predict gets its own code, so the window
// can say why. Admins are exempt: for them the report alone is accepted.
export const REPORT_LIMIT = { perDay: 10, gapMs: 60000 };
const dayNumber = (ms) => Math.floor(ms / 86400000);
export async function sendReport(fields) {
  const ref = doc(collection(db, 'reports'));
  const report = { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const limRef = doc(db, 'limits', fields.uid);
  let old = null;
  try { const snap = await getDoc(limRef); old = snap.exists() ? snap.data() : null; }
  catch { /* the live rules may not know limits/ yet: treat as no counter */ }
  const now = Date.now(), today = dayNumber(now);
  let code = null;
  if (old && millis(old.lastAt) && now < millis(old.lastAt) + REPORT_LIMIT.gapMs) code = 'limit-wait';
  else if (old && old.day === today && old.count >= REPORT_LIMIT.perDay) code = 'limit-day';
  if (code) {
    try { await setDoc(ref, report); return ref.id; }               // works only for an admin
    catch { throw Object.assign(new Error(code), { code }); }
  }
  const batch = writeBatch(db);
  batch.set(ref, report);
  batch.set(limRef, { day: today, count: old && old.day === today ? old.count + 1 : 1, lastAt: serverTimestamp(), lastReport: ref.id });
  try { await batch.commit(); }
  catch (e) {
    // Until the new firestore.rules are deployed, the live rules refuse limits/: send the report alone, as before.
    // With the new rules this works only for admins, so the limits cannot be skipped.
    if (e && e.code === 'permission-denied') { await setDoc(ref, report); return ref.id; }
    throw e;
  }
  return ref.id;
}
// The person's own reports: the only list query the rules allow a user (uid == their own uid). Sorted here, so no index is needed.
export async function myReports(uid) {
  const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', uid)));
  return snap.docs.map(asReport).sort(newest);
}
// Admins only (the rules check admins/{uid}): the newest 100 reports.
export async function allReports() {
  const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100)));
  return snap.docs.map(asReport);
}
// Admins only: the new status and its audit entry in one batch (the rules refuse a change without it).
export async function setReportStatus(reportId, audit, status) {
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, 'audit'));
  batch.set(auditRef, { ...audit, at: serverTimestamp() });
  batch.update(doc(db, 'reports', reportId), { status, updatedAt: serverTimestamp(), lastAuditId: auditRef.id });
  await batch.commit();
}

// Admin workspace (P44, issue #65). Every call here is refused by firestore.rules unless admins/{uid} exists.
// js/admin.js builds the audit entry (roleAuditFields); here only the server time is added.
const asUser = (d) => { const x = d.data(); return { id: d.id, name: x.name || '', email: x.email || '', role: x.role || 'user', createdAt: millis(x.createdAt) }; };
// The newest 200 accounts (a single-field order: no extra index). Only name, email, role and the join date are used.
export async function listUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(200)));
  return snap.docs.map(asUser);
}
// The uids in admins/ (added only in the Firebase console).
export async function listAdmins() {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map((d) => d.id);
}
// The new role and its audit entry in one batch (the rules refuse a change without it, or about yourself).
export async function setUserRole(uid, audit, role) {
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, 'audit'));
  batch.set(auditRef, { ...audit, at: serverTimestamp() });
  batch.update(doc(db, 'users', uid), { role, lastAuditId: auditRef.id });
  await batch.commit();
}
// The newest 100 audit entries, filtered on the server. Type and person use the indexes in firestore.indexes.json;
// the date range is on "at", the field the list is ordered by. from / to: times in milliseconds (to is not included).
export async function listAudit({ action, actorUid, from, to } = {}) {
  const parts = [];
  if (action) parts.push(where('action', '==', action));
  if (actorUid) parts.push(where('actorUid', '==', actorUid));
  if (from) parts.push(where('at', '>=', new Date(from)));
  if (to) parts.push(where('at', '<', new Date(to)));
  const snap = await getDocs(query(collection(db, 'audit'), ...parts, orderBy('at', 'desc'), limit(100)));
  return snap.docs.map((d) => { const x = d.data(); return { id: d.id, ...x, at: millis(x.at) }; });
}

// Community features (impact plan): problems with "আমিও", and place status. js/community.js builds the fields in
// exactly the shape firestore.rules allow; here only the server times are added. Reads are public (no person in them).
export const ISSUE_LIMIT = { perDay: 10, gapMs: 60000 };
const asIssue = (d) => { const x = d.data(); return { id: d.id, ...x, createdAt: millis(x.createdAt), updatedAt: millis(x.updatedAt) }; };
// A new problem, its owner entry and issueLimits/{uid} in one batch (the rules check all three).
export async function sendIssue(fields) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('signed-out'), { code: 'signed-out' });
  const ref = doc(collection(db, 'issues'));
  const limRef = doc(db, 'issueLimits', user.uid);
  const snap = await getDoc(limRef);
  const old = snap.exists() ? snap.data() : null, now = Date.now(), today = dayNumber(now);
  if (old && millis(old.lastAt) && now < millis(old.lastAt) + ISSUE_LIMIT.gapMs) throw Object.assign(new Error('limit-wait'), { code: 'limit-wait' });
  if (old && old.day === today && old.count >= ISSUE_LIMIT.perDay) throw Object.assign(new Error('limit-day'), { code: 'limit-day' });
  const batch = writeBatch(db);
  batch.set(ref, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db, 'issueOwners', ref.id), { uid: user.uid, at: serverTimestamp() });
  batch.set(limRef, { day: today, count: old && old.day === today ? old.count + 1 : 1, lastAt: serverTimestamp(), lastIssue: ref.id });
  await batch.commit();
  return ref.id;
}
// Problems in one upazila (an equality filter only: no index needed), newest first, at most 30 reads.
export async function listIssues(district, upazila) {
  const snap = await getDocs(query(collection(db, 'issues'), where('district', '==', district), where('upazila', '==', upazila), limit(30)));
  return snap.docs.map(asIssue).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
// "আমিও": this person's own marker and +1 on the problem, in one batch; a second "আমিও" is refused by the rules.
export async function meToo(issueId) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('signed-out'), { code: 'signed-out' });
  const mark = doc(db, 'issues', issueId, 'metoo', user.uid);
  if ((await getDoc(mark)).exists()) throw Object.assign(new Error('already'), { code: 'already' });
  const batch = writeBatch(db);
  batch.set(mark, { at: serverTimestamp() });
  batch.update(doc(db, 'issues', issueId), { metoo: increment(1) });
  await batch.commit();
}
// Admins only: the new status and its audit entry in one batch.
export async function setIssueStatus(issueId, audit, status, statusNote = '') {
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, 'audit'));
  batch.set(auditRef, { ...audit, at: serverTimestamp() });
  const upd = { status, updatedAt: serverTimestamp(), lastAuditId: auditRef.id };
  if (statusNote) upd.statusNote = statusNote;
  batch.update(doc(db, 'issues', issueId), upd);
  await batch.commit();
}
// Place status: the public summary and this person's own answer, in one batch.
export async function readPlaceStatus(placeId) {
  const snap = await getDoc(doc(db, 'placeStatus', placeId));
  return snap.exists() ? snap.data() : null;
}
export async function sendPlaceStatus(placeId, value, next) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('signed-out'), { code: 'signed-out' });
  const batch = writeBatch(db);
  batch.set(doc(db, 'placeStatus', placeId), { value, n: next.n, at: serverTimestamp() });
  batch.set(doc(db, 'placeStatus', placeId, 'by', user.uid), { value, at: serverTimestamp() });
  await batch.commit();
}

// "ডাকুন" (service engine, v5): providers, rates, requests, the two live positions and the bill. js/ride.js has the
// fare and status logic; firestore.rules check every step (who, in which order, and that the fare matches the rates).
const err = (code) => Object.assign(new Error(code), { code });
const me = () => { const u = auth.currentUser; if (!u) throw err('signed-out'); return u; };
const asRide = (d) => { const x = d.data(); const out = { id: d.id, ...x };
  for (const k of ['createdAt', 'updatedAt', 'acceptedAt', 'arrivedAt', 'startedAt', 'endedAt', 'paidAt']) out[k] = millis(x[k]);
  return out; };

// The person's own provider entry (or null), and applying to be one (an admin approves it).
export async function myProvider() {
  const snap = await getDoc(doc(db, 'providers', me().uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export const applyProvider = ({ name, type, vehicle, district }) => setDoc(doc(db, 'providers', me().uid),
  { name, type, vehicle, district, approved: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
export const withdrawProvider = () => deleteDoc(doc(db, 'providers', me().uid));
// Admins only: providers waiting for approval, and approving one (with its audit entry, in one batch).
export async function pendingProviders() {
  const snap = await getDocs(query(collection(db, 'providers'), where('approved', '==', false), limit(50)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: millis(d.data().createdAt) }));
}
export async function approveProvider(uid, approved) {
  const batch = writeBatch(db), auditRef = doc(collection(db, 'audit'));
  batch.set(auditRef, { actorUid: me().uid, action: 'PROVIDER_APPROVED', entity: 'providers', entityId: uid,
    meta: { from: approved ? 'pending' : 'approved', to: approved ? 'approved' : 'pending' }, at: serverTimestamp() });
  batch.update(doc(db, 'providers', uid), { approved, updatedAt: serverTimestamp(), lastAuditId: auditRef.id });
  await batch.commit();
}

// Rates: public; an admin changes them with an audit entry. Returns { type: { base, perKm, perMin, minFare } }.
export async function readRates() {
  const snap = await getDocs(collection(db, 'rates'));
  return Object.fromEntries(snap.docs.map((d) => { const x = d.data(); return [d.id, { base: x.base, perKm: x.perKm, perMin: x.perMin, minFare: x.minFare }]; }));
}
export async function setRates(type, r) {
  const batch = writeBatch(db), auditRef = doc(collection(db, 'audit'));
  batch.set(auditRef, { actorUid: me().uid, action: 'RATES_CHANGED', entity: 'rates', entityId: type, at: serverTimestamp() });
  batch.set(doc(db, 'rates', type), { base: r.base, perKm: r.perKm, perMin: r.perMin, minFare: r.minFare, updatedAt: serverTimestamp(), lastAuditId: auditRef.id });
  await batch.commit();
}

// "আমি এখন কাজে আছি": an approved provider with a rough position (about 100 m); deleted when they stop.
export const goOnline = (p, lat, lon) => setDoc(doc(db, 'online', me().uid), { type: p.type, district: p.district, lat, lon, at: serverTimestamp() });
export const goOffline = () => deleteDoc(doc(db, 'online', me().uid));
// How many providers of a type are working in a district in the last 30 minutes (equality filters only: no index).
export async function onlineCount(type, district) {
  const snap = await getDocs(query(collection(db, 'online'), where('type', '==', type), where('district', '==', district), limit(50)));
  const fresh = Date.now() - 30 * 60000;
  return snap.docs.filter((d) => (millis(d.data().at) || 0) > fresh).map((d) => ({ lat: d.data().lat, lon: d.data().lon }));
}

// A request and rideLimits/{uid} in one batch (at most 10 a day, 60 s apart; the rules check both).
export const RIDE_LIMIT = { perDay: 10, gapMs: 60000 };
export async function requestRide(fields) {
  const user = me();
  const ref = doc(collection(db, 'rides')), limRef = doc(db, 'rideLimits', user.uid);
  const snap = await getDoc(limRef);
  const old = snap.exists() ? snap.data() : null, now = Date.now(), today = dayNumber(now);
  if (old && millis(old.lastAt) && now < millis(old.lastAt) + RIDE_LIMIT.gapMs) throw err('limit-wait');
  if (old && old.day === today && old.count >= RIDE_LIMIT.perDay) throw err('limit-day');
  const batch = writeBatch(db);
  batch.set(ref, { ...fields, riderUid: user.uid, status: 'requested', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(limRef, { day: today, count: old && old.day === today ? old.count + 1 : 1, lastAt: serverTimestamp(), lastRide: ref.id });
  await batch.commit();
  return ref.id;
}
// Live updates of one ride, and of the open requests a provider may take (their type and district only).
export const watchRide = (id, cb, onErr) => onSnapshot(doc(db, 'rides', id), (d) => cb(d.exists() ? asRide(d) : null), onErr);
export const watchRequests = (p, cb, onErr) => onSnapshot(query(collection(db, 'rides'), where('status', '==', 'requested'),
  where('type', '==', p.type), where('district', '==', p.district), limit(20)), (s) => cb(s.docs.map(asRide)), onErr);
// The person's own rides (as rider or as provider), newest first; equality filter only.
export async function myRides(as = 'rider') {
  const snap = await getDocs(query(collection(db, 'rides'), where(as === 'rider' ? 'riderUid' : 'providerUid', '==', me().uid), limit(50)));
  return snap.docs.map(asRide).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

const step = (id, f) => updateDoc(doc(db, 'rides', id), { ...f, updatedAt: serverTimestamp() });
// Accepting fails for the second provider: the rules only allow it while the status is still "requested".
export const acceptRide = (id, p) => step(id, { status: 'accepted', providerUid: me().uid, providerName: p.name, vehicle: p.vehicle, acceptedAt: serverTimestamp() });
export const arrived = (id) => step(id, { status: 'arrived', arrivedAt: serverTimestamp() });
export const startTrip = (id) => step(id, { status: 'on_trip', startedAt: serverTimestamp() });
export const completeRide = (id, { distM, waitMin, fare }) => step(id, { status: 'completed', endedAt: serverTimestamp(), distM, waitMin, fare, payStatus: 'pending' });
export const markPaid = (id) => step(id, { status: 'paid', payStatus: 'paid', paidAt: serverTimestamp() });
export const cancelRide = (id, by, fee) => step(id, { status: 'cancelled', cancelledBy: by, cancelFee: fee });
export const billOk = (id, ok) => step(id, { billOk: ok });
export const rateRide = (id, rating) => step(id, { rating });

// Live position: rides/{id}/live/{rider|provider}, only during accepted → arrived → on_trip, only the two people.
export const sendLive = (id, who, lat, lon) => setDoc(doc(db, 'rides', id, 'live', who), { lat, lon, at: serverTimestamp() });
export const watchLive = (id, who, cb, onErr) => onSnapshot(doc(db, 'rides', id, 'live', who),
  (d) => cb(d.exists() ? { lat: d.data().lat, lon: d.data().lon, at: millis(d.data().at) } : null), onErr);
// When the ride ends, both positions are deleted (either person may do it; nothing is kept).
export async function clearLive(id) {
  await Promise.allSettled([deleteDoc(doc(db, 'rides', id, 'live', 'rider')), deleteDoc(doc(db, 'rides', id, 'live', 'provider'))]);
}
