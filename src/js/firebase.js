// SafeConnect accounts (P45): Firebase App, Auth and Firestore, one pinned version from gstatic.
// Load this file only with import(), and only after a tap (opening sign-in or "Open my account") or on reset.html,
// which the person opened from their password-reset email (and only after that page shows 999):
// help (999, send location, area numbers) must never wait for it and works with no internet.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, updateProfile, reload, sendPasswordResetEmail, signOut, verifyPasswordResetCode, confirmPasswordReset,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, collection, getDocs, writeBatch, query, where, orderBy, limit,
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
// Registration (SRS FR01): name, email and password. The name goes on the account at once, so users/{uid} gets it.
export const createAccount = async (email, password, name = '') => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const clean = String(name || '').trim().slice(0, 60);
  if (clean) { try { await updateProfile(cred.user, { displayName: clean }); } catch { /* the profile page can set it later */ } }
  try { await sendEmailVerification(cred.user); } catch { /* the report window can send it again */ }
  return cred;
};
// Profile & Preferences (SRS FR02): the owner may change only name and language (firestore.rules users/{uid}).
// The theme (light/dark) stays on this phone (localStorage), like the area.
export async function saveProfile({ name, lang }) {
  const user = me(), upd = {};
  if (name !== undefined) { const n = String(name).trim().slice(0, 60); if (!n) throw err('name-empty'); upd.name = n; }
  if (lang !== undefined) upd.lang = lang === 'en' ? 'en' : 'bn';
  await updateDoc(doc(db, 'users', user.uid), upd);
  if (upd.name) { try { await updateProfile(user, { displayName: upd.name }); } catch { /* the stored name is what counts */ } }
}
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

// Place status ("এখন কেমন?"): js/community.js builds the next value; here only the server time is added. Public reads.
// Place status: the public summary and this person's own answer, in one batch.
// Community status "Ekhon Kemon?" (SRS FR05): stored as { status, n, at } (ER diagram); "value" is kept in what this
// returns so older pages still read it.
export async function readPlaceStatus(placeId) {
  const snap = await getDoc(doc(db, 'placeStatus', placeId));
  if (!snap.exists()) return null;
  const x = snap.data(), status = x.status || x.value;
  return { ...x, status, value: status };
}
export async function sendPlaceStatus(placeId, value, next) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('signed-out'), { code: 'signed-out' });
  const batch = writeBatch(db);
  batch.set(doc(db, 'placeStatus', placeId), { status: value, n: next.n, at: serverTimestamp(), ...(next.prev ? { prev: next.prev } : {}) });
  batch.set(doc(db, 'placeStatus', placeId, 'by', user.uid), { status: value, at: serverTimestamp() });
  await batch.commit();
}

// "ডাকুন" (service engine, v5): providers, rates, requests, the two live positions and the bill. js/ride.js has the
// fare and status logic; firestore.rules check every step (who, in which order, and that the fare matches the rates).
const err = (code) => Object.assign(new Error(code), { code });
const me = () => { const u = auth.currentUser; if (!u) throw err('signed-out'); return u; };
const asRide = (d) => { const x = d.data(); const out = { id: d.id, ...x };
  for (const k of ['createdAt', 'updatedAt', 'acceptedAt', 'arrivedAt', 'startedAt', 'endedAt', 'paidAt', 'riderSeenAt']) out[k] = millis(x[k]);
  return out; };

// The person's own provider entry (or null), and applying to be one (an admin approves it).
export async function myProvider() {
  const snap = await getDoc(doc(db, 'providers', me().uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export const applyProvider = ({ name, type, vehicle, district }) => setDoc(doc(db, 'providers', me().uid),
  { name, type, vehicle, district, approved: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
// NID and one family contact, for the admin who approves (#365). Private: only this person and admins can read it (firestore.rules);
// it is deleted on withdraw and on reject. Never logged, never put in a link.
export const saveProviderPrivate = ({ nid, familyName, familyRelation, familyPhone }) => setDoc(doc(db, 'providerPrivate', me().uid),
  { nid, familyName, familyRelation, familyPhone, consent: true, createdAt: serverTimestamp() });
export async function hasProviderPrivate(uid = me().uid) {
  try { return (await getDoc(doc(db, 'providerPrivate', uid))).exists(); } catch { return false; }
}
// Admins only: what the applicant gave, to check before approving (null if nothing was given).
export async function readProviderPrivate(uid) {
  const snap = await getDoc(doc(db, 'providerPrivate', uid));
  return snap.exists() ? snap.data() : null;
}
// The record goes first, then the application (the rules only let the application be deleted while it is not approved).
export async function withdrawProvider() {
  const uid = me().uid;
  try { await deleteDoc(doc(db, 'providerPrivate', uid)); } catch { /* none, or already gone */ }
  await deleteDoc(doc(db, 'providers', uid));
}
// The rider's page says "still here" while a request or trip is open; the driver sees how long ago (#365).
export const riderBeat = (id) => updateDoc(doc(db, 'rides', id), { riderSeenAt: serverTimestamp() });
// Admins only: providers waiting for approval, and approving one (with its audit entry, in one batch).
export async function pendingProviders() {
  const snap = await getDocs(query(collection(db, 'providers'), where('approved', '==', false), limit(50)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: millis(d.data().createdAt) }));
}
export async function approveProvider(uid, approved) {
  const batch = writeBatch(db), auditRef = doc(collection(db, 'audit'));
  batch.set(auditRef, { actorUid: me().uid, action: 'PROVIDER_APPROVED', entity: 'providers', entityId: uid,
    meta: { from: approved ? 'pending' : 'approved', to: approved ? 'approved' : 'pending' }, at: serverTimestamp() });
  batch.update(doc(db, 'providers', uid), { approved, rejected: false, updatedAt: serverTimestamp(), lastAuditId: auditRef.id });
  await batch.commit();
}
// Admins only: "not approved" (use case 14, 3.1). The applicant sees it and may withdraw and apply again.
export async function rejectProvider(uid) {
  const batch = writeBatch(db), auditRef = doc(collection(db, 'audit'));
  batch.set(auditRef, { actorUid: me().uid, action: 'PROVIDER_REJECTED', entity: 'providers', entityId: uid,
    meta: { from: 'pending', to: 'rejected' }, at: serverTimestamp() });
  batch.update(doc(db, 'providers', uid), { approved: false, rejected: true, updatedAt: serverTimestamp(), lastAuditId: auditRef.id });
  batch.delete(doc(db, 'providerPrivate', uid));          // a rejected applicant's NID and family details are not kept (#365)
  await batch.commit();
}

// Rates: public; an admin changes them with an audit entry. Returns { type: { base, perKm, perMin, minFare } }.
// Fare rates per district and service type (SRS FR14, FR16; ER fare_rates): fare_rates/{district}__{type} with
// baseFare, perKmRate, waitingRate, minFare. A district without its own rate uses the nationwide one (district "default").
// readRates(district) gives the page's short names { type: { base, perKm, perMin, minFare } }, the district's own winning.
const RATE_ID = (district, type) => `${district || 'default'}__${type}`;
const short = (x) => ({ base: x.baseFare, perKm: x.perKmRate, perMin: x.waitingRate, minFare: x.minFare });
export async function readRates(district) {
  const ds = district && district !== 'default' ? ['default', district] : ['default'];
  const snap = await getDocs(query(collection(db, 'fare_rates'), where('district', 'in', ds)));
  const out = {}, own = {};
  for (const d of snap.docs) { const x = d.data(); if (x.district === 'default') out[x.serviceType] = short(x); else own[x.serviceType] = short(x); }
  return { ...out, ...own };
}
// Admins: every stored rate, for the rates table ({ id, district, serviceType, base, perKm, perMin, minFare }).
export async function readRateTable() {
  const snap = await getDocs(collection(db, 'fare_rates'));
  return snap.docs.map((d) => { const x = d.data(); return { id: d.id, district: x.district, serviceType: x.serviceType, ...short(x) }; });
}
export async function setRates(type, r, district = 'default') {
  const id = RATE_ID(district, type), batch = writeBatch(db), auditRef = doc(collection(db, 'audit'));
  batch.set(auditRef, { actorUid: me().uid, action: 'RATES_CHANGED', entity: 'fare_rates', entityId: id, at: serverTimestamp() });
  batch.set(doc(db, 'fare_rates', id), { district: district || 'default', serviceType: type, baseFare: r.base, perKmRate: r.perKm,
    waitingRate: r.perMin, minFare: r.minFare, updatedAt: serverTimestamp(), lastAuditId: auditRef.id });
  await batch.commit();
}

// "আমি এখন কাজে আছি": an approved provider with a rough position (about 100 m); deleted when they stop.
// No position is stored (not even a rough one): riders only see how many are working in the district.
export const goOnline = (p) => setDoc(doc(db, 'online', me().uid), { type: p.type, district: p.district, at: serverTimestamp() });
export const goOffline = () => deleteDoc(doc(db, 'online', me().uid));
// How many providers of a type are working in a district in the last 30 minutes (equality filters only: no index).
export async function onlineCount(type, district) {
  const snap = await getDocs(query(collection(db, 'online'), where('type', '==', type), where('district', '==', district), limit(50)));
  const fresh = Date.now() - 30 * 60000;
  return snap.docs.filter((d) => (millis(d.data().at) || 0) > fresh).map((d) => d.id);
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
// Admins only (the rules check it): the 150 newest rides, live, for the admin's overview.
export const watchAllRides = (cb, onErr) => onSnapshot(query(collection(db, 'rides'), orderBy('createdAt', 'desc'), limit(150)),
  (s) => cb(s.docs.map(asRide)), onErr);
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
// itemsCost only for an errand (the shop's receipt; the rules refuse it on other types and above the rider's limit).
export const completeRide = (id, { distM, waitMin, fare, itemsCost }) => step(id, { status: 'completed', endedAt: serverTimestamp(), distM, waitMin, fare,
  ...(itemsCost === undefined ? {} : { itemsCost }), payStatus: 'pending' });
export const markPaid = (id) => step(id, { status: 'paid', payStatus: 'paid', paidAt: serverTimestamp() });
export const cancelRide = (id, by, fee) => step(id, { status: 'cancelled', cancelledBy: by, cancelFee: fee });
export const billOk = (id, ok) => step(id, { billOk: ok });
// The rider closes a ride that got no answer (3 h before the trip, 12 h after it started); the rules check the time.
export const closeStale = (id) => step(id, { status: 'cancelled', cancelledBy: 'stale', cancelFee: 0 });
export const rateRide = (id, rating) => step(id, { rating });

// Live position: rides/{id}/live/{rider|provider}, only during accepted → arrived → on_trip, only the two people.
export const sendLive = (id, who, lat, lon) => setDoc(doc(db, 'rides', id, 'live', who), { lat, lon, at: serverTimestamp() });
export const watchLive = (id, who, cb, onErr) => onSnapshot(doc(db, 'rides', id, 'live', who),
  (d) => cb(d.exists() ? { lat: d.data().lat, lon: d.data().lon, at: millis(d.data().at) } : null), onErr);
// When the ride ends, both positions are deleted (either person may do it; nothing is kept).
export async function clearLive(id) {
  await Promise.allSettled([deleteDoc(doc(db, 'rides', id, 'live', 'rider')), deleteDoc(doc(db, 'rides', id, 'live', 'provider'))]);
}

// Live location sharing and Safe Commute (SRS FR09–FR11). js/track.js has the ids, durations and checks; firestore.rules
// (live_shares, shareLimits) decide. A share and shareLimits/{uid} are one batch (20 a day, 60 s apart).
export const SHARE_LIMIT = { perDay: 20, gapMs: 60000 };
export async function startShare(id, minutes, point, commute = {}, skewMs = 0) {   // skewMs: real time minus the phone clock (js/track.js clockOffset)
  const user = me(), limRef = doc(db, 'shareLimits', user.uid);
  const snap = await getDoc(limRef);
  const old = snap.exists() ? snap.data() : null, nowMs = Date.now(), today = dayNumber(nowMs);
  if (old && millis(old.lastAt) && nowMs < millis(old.lastAt) + SHARE_LIMIT.gapMs) throw err('limit-wait');
  if (old && old.day === today && old.count >= SHARE_LIMIT.perDay) throw err('limit-day');
  const mins = Math.min(480, Math.max(1, Math.round(minutes)));
  const batch = writeBatch(db);
  batch.set(doc(db, 'live_shares', id), { uid: user.uid, ...point, ...commute, status: 'active', startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(), expiresAt: new Date(nowMs + skewMs + mins * 60000) });
  batch.set(limRef, { day: today, count: old && old.day === today ? old.count + 1 : 1, lastAt: serverTimestamp(), lastShare: id });
  await batch.commit();
}
// A new point (lat, lon, speed, heading, battery); the rules refuse points closer than 4 s apart.
export const updateShare = (id, point) => updateDoc(doc(db, 'live_shares', id), { ...point, updatedAt: serverTimestamp() });
// Safe Commute: the vehicle and destination on the active share (FR10).
export const setCommute = (id, { vehicleNo, vehicleType, destination }) => updateDoc(doc(db, 'live_shares', id),
  { vehicleNo, vehicleType, destination, updatedAt: serverTimestamp() });
// "I Have Reached Safely" or the timer: the document is deleted at once (TRK-05).
export const endShare = (id) => deleteDoc(doc(db, 'live_shares', id));
// The family view (no sign-in): one document by its id, live. null = ended, expired or never existed.
export const watchShare = (id, cb, onErr) => onSnapshot(doc(db, 'live_shares', id), (d) => {
  if (!d.exists()) return cb(null);
  const x = d.data();
  cb({ id: d.id, ...x, startedAt: millis(x.startedAt), updatedAt: millis(x.updatedAt), expiresAt: millis(x.expiresAt) });
}, (e) => (e && e.code === 'permission-denied' ? cb(null) : onErr && onErr(e)));
// Admins: delete shares whose time is over (the rules let an admin list and delete only expired ones).
export async function cleanExpiredShares() {
  const snap = await getDocs(query(collection(db, 'live_shares'), where('expiresAt', '<', new Date()), limit(100)));
  await Promise.allSettled(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}
