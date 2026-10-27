// SafeConnect accounts (P45): Firebase App, Auth and Firestore, one pinned version from gstatic.
// Load this file only with import(), when someone opens sign-in or was signed in before:
// help (999, send location, area numbers) must never wait for it and works with no internet.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Emails from Firebase (password reset) in the site language.
export function setLang(lang) { auth.languageCode = lang; }

export const watchUser = (callback) => onAuthStateChanged(auth, callback);
// Popup only: a redirect breaks on phones, because github.io and firebaseapp.com are different sites.
export const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signInEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const createAccount = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
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
