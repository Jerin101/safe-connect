// SafeConnect accounts (P45): Firebase App, Auth and Firestore, one pinned version from gstatic.
// Load this file only with import(), and only after a tap (opening sign-in or "Open my account") or on reset.html,
// which the person opened from their password-reset email (and only after that page shows 999):
// help (999, send location, area numbers) must never wait for it and works with no internet.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, verifyPasswordResetCode, confirmPasswordReset,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
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
export const createAccount = (email, password) => createUserWithEmailAndPassword(auth, email, password);
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
