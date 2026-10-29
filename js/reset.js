// Password reset page (reset.html, issue #74): the page the link in the Firebase reset email opens.
// The address brings ?mode=resetPassword&oobCode=...&lang=bn (and maybe continueUrl). The code is used only to talk
// to Firebase: it is never logged, stored or shown. The account's email is shown only masked (t•••@example.com).
// 999 is plain HTML in the page; Firebase (js/firebase.js) is loaded with import() only after the page has shown,
// and only because the person opened this link from their email. With no internet we say so and do not try.
import { errKey } from './auth.js';

const $ = (id) => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (all, key) => (key in values ? values[key] : all));
const MIN = 6;   // Firebase's shortest allowed password

const params = new URLSearchParams(location.search);
const MODE = params.get('mode');
const CODE = params.get('oobCode') || '';
// Keep the code in memory only: take it out of the address bar and the browser history.
if (CODE) { const u = new URL(location.href); u.searchParams.delete('oobCode'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
// Other kinds of Firebase email links; SafeConnect does not use them yet, so they get a short calm message.
const OTHER_MODES = ['verifyEmail', 'recoverEmail', 'verifyAndChangeEmail', 'revertSecondFactorAddition', 'signIn'];
const okLang = (l) => (l === 'bn' || l === 'en' ? l : null);
let lang = okLang(params.get('lang')) || okLang(store.get('sc-lang')) || 'bn';

// "Sign in" after success: continueUrl only when it is on this same site (never send people to another site).
function signInHref() {
  const c = params.get('continueUrl');
  if (c) { try { const u = new URL(c, location.href); if (u.origin === location.origin) return u.href; } catch {} }
  return 'preview.html#/account';
}

// Texts from js/lang/*.json, loaded when needed.
const LANG = {};
async function loadTexts(code) {
  if (!LANG[code]) {
    const res = await fetch(`js/lang/${code}.json`);
    if (!res.ok) throw new Error(`Could not load js/lang/${code}.json (${res.status})`);
    LANG[code] = await res.json();
  }
  return LANG[code];
}
const T = () => LANG[lang];
const A = () => T().auth;
const R = () => A().reset;

// state: 'checking' | 'form' | 'done' | 'bad' (link expired / used / not valid) | 'other' (another kind of link)
//        | 'error' (could not check the link: try again) | 'offline'
let state = 'checking';
let errK = null;      // key of the message shown (auth.reset.err or auth.err)
let email = '';       // masked email only
let fb = null;        // js/firebase.js, once loaded
let busy = false;     // saving the new password
let reveal = false;   // passwords shown as text

// Firebase error code -> text key. Reset-only codes first, then the shared sign-in mapping (errKey in auth.js).
const OWN = {
  'auth/expired-action-code': 'expired', 'auth/invalid-action-code': 'invalid', 'auth/user-not-found': 'invalid',
  'auth/password-does-not-meet-requirements': 'weak',
};
const SHARED = ['network', 'tooMany', 'weak', 'disabled', 'domain'];
function resetErr(err) {
  const code = err && err.code;
  if (!navigator.onLine) return 'network';
  if (OWN[code]) return OWN[code];
  const k = errKey(code);
  return SHARED.includes(k) ? k : 'other';
}
const errText = (k) => R().err[k] || A().err[k] || R().err.other;

// t•••@example.com: enough to recognise the account, not the whole address.
function mask(address) {
  const s = String(address || '');
  const at = s.lastIndexOf('@');
  return at < 1 ? '' : `${s.slice(0, 1)}•••${s.slice(at)}`;
}

/* ---------- drawing ---------- */
function link(text, href, cls) { const a = el('a', cls, text); a.href = href; return a; }
function linksFor() {
  const r = R();
  const home = link(r.home, 'preview.html', 'btn');
  if (state === 'done') return [link(r.goSignIn, signInHref(), 'btn violet')];
  if (state === 'bad') return MODE === 'resetPassword' ? [link(r.newLink, 'preview.html#/account', 'btn violet'), home] : [home];
  if (state === 'error') {
    const again = el('button', 'btn violet', r.retry); again.type = 'button';
    again.disabled = !navigator.onLine;
    again.addEventListener('click', start);
    return [again, home];
  }
  if (state === 'other' || state === 'offline') return [home];
  return [];
}
function render() {
  const u = T().ui, h = T().page.head, a = A(), r = R();
  document.documentElement.lang = lang;
  document.title = `${r.pageTitle} · SafeConnect`;
  $('homeLink').setAttribute('aria-label', h.home);
  $('h999').setAttribute('aria-label', u.call999);
  $('h999Text').textContent = u.h999;
  $('langBtn').textContent = u.lang;
  $('langBtn').setAttribute('aria-label', h.langLabel);
  $('themeBtn').setAttribute('aria-label', h.themeLabel);
  $('noLoginTitle').textContent = a.noLoginTitle;
  $('noLoginText').textContent = a.noLoginText;
  $('rsCall').textContent = u.call999;
  $('rsSend').textContent = u.sosBtn;

  $('rsEyebrow').textContent = a.eyebrow;
  $('rsTitle').textContent = state === 'done' ? r.doneTitle : state === 'bad' || state === 'other' ? r.badTitle : r.title;
  const off = !navigator.onLine && ['offline', 'checking', 'form', 'error'].includes(state);
  $('rsOffline').textContent = r.offline;
  $('rsOffline').hidden = !off;

  const status = { checking: r.checking, done: r.doneText, other: r.otherMode }[state]
    || (state === 'bad' || state === 'error' ? errText(errK) : '');
  $('rsStatus').textContent = status;
  $('rsStatus').classList.toggle('plain', ['checking', 'done', 'other'].includes(state));
  $('rsStatus').hidden = !status;

  $('rsForm').hidden = state !== 'form';
  $('rsWho').textContent = email ? fill(r.forEmail, { email }) : '';
  $('rsWho').hidden = !email;
  $('rsPassL').textContent = r.newPass;
  $('rsPass2L').textContent = r.again;
  $('rsHint').textContent = r.hint;
  $('rsShow').textContent = reveal ? r.hide : r.show;
  $('rsSave').textContent = busy ? a.wait : r.save;
  $('rsSave').disabled = busy;
  $('rsMsg').textContent = state === 'form' && errK ? errText(errK) : '';
  $('rsMsg').hidden = !(state === 'form' && errK);

  $('rsHow').textContent = r.newLinkHow;
  $('rsHow').hidden = !(state === 'bad' && MODE === 'resetPassword');
  $('rsLinks').replaceChildren(...linksFor());
}
// After a change the person did not type (link checked, saved), move focus to the heading so screen readers read it.
function announce() { $('rsTitle').focus(); }

/* ---------- the reset ---------- */
async function start(e) {
  const tapped = Boolean(e && e.type === 'click');   // "Try again": the button goes away, so focus moves to the heading
  errK = null;
  if (MODE !== 'resetPassword') { state = OTHER_MODES.includes(MODE) && CODE ? 'other' : 'bad'; errK = 'invalid'; render(); return; }
  if (!CODE) { state = 'bad'; errK = 'invalid'; render(); return; }
  if (!navigator.onLine) { state = 'offline'; render(); return; }
  state = 'checking'; render();
  try {
    // Let the browser draw the page (with 999) first; Firebase loads after that.
    if (!fb) { await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); fb = await import('./firebase.js'); }
    fb.setLang(lang);
    email = mask(await fb.verifyResetCode(CODE));
    state = 'form';
  } catch (err) {
    errK = resetErr(err);
    state = errK === 'expired' || errK === 'invalid' ? 'bad' : navigator.onLine ? 'error' : 'offline';
  }
  render();
  if (tapped) announce();
}
function clearPasswords() { $('rsPass').value = ''; $('rsPass2').value = ''; }
async function save(e) {
  e.preventDefault();
  if (busy || state !== 'form') return;
  const p1 = $('rsPass').value, p2 = $('rsPass2').value;
  const wrong = p1.length < MIN ? 'weak' : p1 !== p2 ? 'mismatch' : !navigator.onLine ? 'network' : null;
  if (wrong) { errK = wrong; render(); return; }
  busy = true; errK = null; render();
  try {
    await fb.confirmReset(CODE, p1);
    clearPasswords();
    state = 'done';
  } catch (err) {
    errK = resetErr(err);
    if (errK === 'expired' || errK === 'invalid') { clearPasswords(); state = 'bad'; }
  } finally {
    busy = false;
    render();
    if (state !== 'form') announce();
  }
}

/* ---------- start ---------- */
$('rsForm').addEventListener('submit', save);
$('rsShow').addEventListener('click', () => {
  reveal = !reveal;
  for (const id of ['rsPass', 'rsPass2']) $(id).type = reveal ? 'text' : 'password';
  render();
});
$('langBtn').addEventListener('click', async () => {
  const next = lang === 'bn' ? 'en' : 'bn';
  try { await loadTexts(next); } catch { return; }
  lang = next;
  store.set('sc-lang', lang);
  if (fb) fb.setLang(lang);
  render();
});
$('themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
});
// Internet back while waiting: check the link now (the person already asked for it by opening it).
window.addEventListener('online', () => { if (state === 'offline') start(); else render(); });
window.addEventListener('offline', () => render());

try {
  await loadTexts(lang);
} catch {
  // No texts (rare: offline and not saved yet): the 999 button in the header still works.
}
if (T()) {
  render();
  start();
}
// Offline app (P34): the same service worker as the main site, so 999 here also opens with no internet.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
