// Sign-in with three options, account button and sign-out (P45, issue #66). Rules: docs/ROLES.md §1-2.
// Sign-in is a modal over the current page (issue #73). Help never waits for an account.
// Privacy: Firebase (js/firebase.js) is loaded with import() ONLY after a tap (opening the sign-in modal, or
// "Open my account"), never on page load, a link, reload or Back. The phone keeps one flag, "sc-signed-in" = "1",
// and no personal data. Sign-out keeps "sc-family", "sc-places" and "sc-last" on the phone, unless the person
// ticks "also remove from this phone" (issue #78). The workspace itself is js/workspace.js.
import { initWorkspace, LOCAL_KEYS, SYNC, syncOn } from './workspace.js';
import { initReports } from './reports.js';

const ROLES = ['user', 'volunteer', 'admin'];
const FLAG = 'sc-signed-in';
export const ICON = {
  user: 'M12 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm-8 9c0-4.4 3.6-7 8-7s8 2.6 8 7H4Z',
  volunteer: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z',
  admin: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6Z',
};
// Firebase error code -> key in auth.err of js/lang/*.json (calm, short texts in Bangla and English).
const ERR = {
  'auth/invalid-credential': 'wrong', 'auth/invalid-login-credentials': 'wrong', 'auth/wrong-password': 'wrong', 'auth/user-not-found': 'wrong',
  'auth/invalid-email': 'badEmail', 'auth/missing-email': 'needEmail', 'auth/missing-password': 'needBoth', 'auth/weak-password': 'weak',
  'auth/email-already-in-use': 'inUse',
  'auth/popup-closed-by-user': 'popup', 'auth/cancelled-popup-request': 'popup', 'auth/user-cancelled': 'popup',
  'auth/popup-blocked': 'popupBlocked',
  'auth/account-exists-with-different-credential': 'otherWay', 'auth/credential-already-in-use': 'otherWay',
  'auth/user-disabled': 'disabled',
  'auth/operation-not-allowed': 'notAllowed', 'auth/admin-restricted-operation': 'notAllowed',
  'auth/unauthorized-domain': 'domain', 'auth/invalid-api-key': 'domain',
  'auth/network-request-failed': 'network', 'unavailable': 'network', 'auth/internal-error': 'other',
  'auth/too-many-requests': 'tooMany',
};
// The text key for an error. With no internet it is always "network"; unknown codes get "other".
// "Referer blocked" and "API key not valid" come with the address inside the code, so they are matched by pattern.
export function errKey(code, online = true) {
  if (!online) return 'network';
  if (ERR[code]) return ERR[code];
  if (/^auth\/requests-from-referer-.*-are-blocked/.test(code || '') || /^auth\/api-key-not-valid/.test(code || '')) return 'domain';
  return 'other';
}

let ctx = null;          // helpers from preview.js: $, el, store, fill, lang(), texts(), showView, goHome, openSos, locate, go
let fbLoad = null;       // the import('./firebase.js') promise, started once (only after a tap)
let fb = null;           // the module, once loaded
let user = null;         // the signed-in Firebase user (only in memory)
let wsRole = null;       // the workspace that is open: 'user', 'volunteer' or 'admin'
let pick = 'user';       // the option chosen in the sign-in modal
let mismatch = null;     // the option that did not match, for the short note
let busy = false;        // a sign-in is running in the modal
let gateBusy = false;    // "Open my account" is loading
let gateErr = null;      // error key shown on the account page
let opener = null;       // the button that opened the modal; focus goes back to it
let ws = null;           // the workspace (js/workspace.js)
let rep = null;          // the wrong-number form (js/reports.js)
let pending = null;      // { onUser, onCancel }: what to do after a sign-in that the report form asked for

const A = () => ctx.texts().auth;
const $ = (id) => ctx.$(id);
const dlg = () => $('signin');
const hasFlag = () => ctx.store.get(FLAG) === '1';
const signedIn = () => Boolean(user) || hasFlag();
const onAccount = () => /^#\/account\/?$/.test(location.hash);
function clearFlag() { try { localStorage.removeItem(FLAG); } catch {} }

function icon(d) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  n.setAttribute('viewBox', '0 0 24 24'); n.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d);
  n.append(p);
  return n;
}

/* ---------- Firebase, loaded only after a tap ---------- */
function loadFirebase() {
  if (!fbLoad) {
    fbLoad = import('./firebase.js').then(async (mod) => {
      fb = mod;
      fb.setLang(ctx.lang());
      user = await fb.currentUser();
      fb.watchUser((u) => {
        user = u;
        if (u) ctx.store.set(FLAG, '1'); else clearFlag();
        renderButton();
        if (!$('acct').hidden) renderGate();
      });
      return mod;
    }).catch((err) => { fbLoad = null; throw err; });
  }
  return fbLoad;
}

/* ---------- header button ---------- */
// First letter of the name (or email), kept whole for Bangla letters with signs.
function initial(u) {
  const name = (u.displayName || u.email || '').trim();
  if (!name) return '';
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter().segment(name)][0].segment.toUpperCase();
  return name[0].toUpperCase();
}
// Signed in: the Google photo, loaded straight from Google and never stored; no photo or offline -> the initial.
function avatar(u) {
  const letter = () => (initial(u) ? ctx.el('span', 'av', initial(u)) : icon(ICON.user));
  if (!u.photoURL) return letter();
  const img = document.createElement('img');
  img.className = 'av'; img.alt = ''; img.width = 20; img.height = 20;
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => img.replaceWith(letter()), { once: true });
  img.src = u.photoURL;
  return img;
}
function renderButton() {
  const b = $('acctBtn');
  const on = signedIn();
  b.replaceChildren(user ? avatar(user) : icon(ICON.user), ctx.el('span', 'acct-text', on ? A().account : A().signIn));
  b.setAttribute('aria-label', on ? A().accountLabel : A().signIn);
}
// Any "Sign in" button: signed in before -> the account page (a tap, so it may load Firebase); else the modal.
function tapSignIn(button) {
  if (signedIn()) ctx.go('account', { tap: true }); else openModal(button);
}

/* ---------- sign-in modal ---------- */
function canTry() { return navigator.onLine && !busy; }
function renderOnline() {
  const off = !navigator.onLine || (!fb && !fbLoad);
  $('siOffline').textContent = navigator.onLine ? A().err.network : A().offline;
  $('siOffline').hidden = !off;
  for (const id of ['siGoogle', 'siSubmit', 'siCreate', 'siForgot']) $(id).disabled = off || busy;
}
// One message at a time: Google errors next to the Google button, email errors under the form.
function say(key, plain = false, where = 'email') {
  for (const id of ['siMsg', 'siGMsg']) { $(id).textContent = ''; $(id).hidden = true; }
  if (!key) return;
  const m = $(where === 'google' ? 'siGMsg' : 'siMsg');
  m.textContent = plain ? A()[key] : A().err[key];
  m.classList.toggle('plain', plain);
  m.hidden = false;
}
function renderSignin() {
  const a = A(), u = ctx.texts().ui;
  $('si999Text').textContent = u.h999;
  $('siClose').setAttribute('aria-label', a.close);
  $('noLoginTitle').textContent = a.noLoginTitle;
  $('noLoginText').textContent = a.noLoginText;
  // The red box uses the same offline-safe actions as the home page; the modal closes first.
  const call = ctx.el('a', 'btn red', u.call999); call.href = 'tel:999';
  const send = ctx.el('button', 'btn', u.sosBtn); send.type = 'button';
  send.addEventListener('click', () => { closeModal(false); ctx.openSos(null); });
  const near = ctx.el('button', 'btn', u.locate); near.type = 'button';
  near.addEventListener('click', () => { closeModal(false); ctx.goHome(); ctx.locate(); });
  $('noLoginBtns').replaceChildren(call, send, near);
  $('addsTitle').textContent = a.addsTitle;
  $('addsList').replaceChildren(...a.adds.map((x) => ctx.el('li', null, x)));
  $('addsSoon').textContent = a.addsSoon;
  $('siEyebrow').textContent = a.eyebrow;
  $('siT1').textContent = a.title1;
  $('siT2').textContent = a.title2;
  $('rolePick').setAttribute('aria-label', a.pickLabel);
  $('rolePick').replaceChildren(...ROLES.map((r) => {
    const b = ctx.el('button', 'role-opt'); b.type = 'button';
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(r === pick));
    const i = ctx.el('span', 'ico'); i.append(icon(ICON[r]));
    b.append(i, ctx.el('b', null, a.roles[r].name), ctx.el('small', null, a.roles[r].desc), ctx.el('span', 'tag', a.roles[r].tag));
    b.addEventListener('click', () => { pick = r; say(null); renderSignin(); });
    return b;
  }));
  $('siFormTitle').textContent = a.roles[pick].form;
  $('siGoogleText').textContent = a.google;
  $('siOr').textContent = a.or;
  $('siEmailL').textContent = a.email;
  $('siPassL').textContent = a.password;
  $('siSubmit').textContent = busy ? a.wait : a.submit;
  $('siCreate').textContent = a.create;
  $('siForgot').textContent = a.forgot;
  $('siNote').textContent = a.roles[pick].note;
  const extra = $('siExtra'); extra.replaceChildren();
  if (pick === 'volunteer') {
    const b = ctx.el('button', 'linkbtn', a.asUser); b.type = 'button';
    b.addEventListener('click', () => { pick = 'user'; renderSignin(); });
    extra.append(b);
  }
  renderOnline();
}
// Opened only by a tap. This is the moment Firebase may start loading (with internet only).
function openModal(from) {
  opener = from || document.activeElement;
  say(null);
  const loading = navigator.onLine ? loadFirebase().catch(() => {}) : null;
  renderSignin();
  if (!dlg().open) dlg().showModal();
  document.body.classList.add('modal-open');
  $('siTitle').focus();
  if (loading) loading.finally(() => { if (dlg().open) renderOnline(); });
}
// returnFocus = false when the next page moves the focus itself.
function closeModal(returnFocus = true) {
  if (!returnFocus) opener = null;
  if (dlg().open) dlg().close();
}
function onModalClosed() {
  document.body.classList.remove('modal-open');
  if (pending) { const p = pending; pending = null; p.onCancel(); }
  const o = opener; opener = null;
  if (o && o.isConnected && !o.closest('[hidden]')) o.focus();
}

/* ---------- after sign-in ---------- */
async function enter(u) {
  // Do not wait for watchUser: it may come a moment later than the sign-in answer.
  user = u; ctx.store.set(FLAG, '1'); renderButton();
  const role = await fb.roleOf(u, ctx.lang());
  const ok = pick === 'user' || pick === role;
  mismatch = ok ? null : pick;
  wsRole = ok ? pick : 'user';
  // The report form asked for this sign-in: go back to it (it sends the report), not to the account page.
  if (pending) { const p = pending; pending = null; closeModal(); p.onUser({ fb, user: u }); return; }
  // Closed (Esc, ×) or moved to another page while signing in: stay where the person is now.
  if (!dlg().open) return;
  closeModal(false);
  ctx.go('account');
}
async function run(action, where = 'email') {
  if (!canTry()) { renderOnline(); return; }
  busy = true; say(null); renderSignin();
  try {
    await loadFirebase();
    const cred = await action();
    if (cred && cred.user) { $('siPass').value = ''; await enter(cred.user); }
  } catch (err) {
    if (dlg().open) say(errKey(err && err.code, navigator.onLine), false, where);
  } finally {
    busy = false;
    if (dlg().open) renderSignin();
  }
}
function fields(needPassword) {
  const email = $('siEmail').value.trim(), password = $('siPass').value;
  if (!email || (needPassword && !password)) { say(needPassword ? 'needBoth' : 'needEmail'); return null; }
  return { email, password };
}

/* ---------- wrong-number report (P18, issue #79): sign-in only when the person taps "Send" ---------- */
// Signed in on this phone before: Firebase loads now (after the tap) and the report goes at once.
// Otherwise the sign-in modal opens over the form; onCancel runs if it is closed without signing in.
async function withUser(button, onUser, onCancel) {
  try { if (!user && hasFlag() && navigator.onLine) await loadFirebase(); } catch {}
  if (user && fb) { onUser({ fb, user }); return; }
  pending = { onUser, onCancel };
  openModal(button);
}
function openMine() { ws.want('reports'); ctx.go('account', { tap: true }); }

/* ---------- account page (#/account): never loads Firebase by itself ---------- */
function renderGate() {
  const a = A(), hint = signedIn();
  $('acctEyebrow').textContent = a.eyebrow;
  $('acctTitle').textContent = a.accountLabel;
  $('acctText').textContent = hint ? a.acctHint : a.acctOut;
  $('acctGo').textContent = gateBusy ? a.wait : hint ? a.openAccount : a.signIn;
  $('acctGo').disabled = gateBusy;
  $('acctOffline').textContent = a.offline;
  $('acctOffline').hidden = navigator.onLine;
  $('acctMsg').textContent = gateErr ? a.err[gateErr] : '';
  $('acctMsg').hidden = !gateErr;
}
function showGate() {
  renderGate();
  ctx.showView('acct');
}
// "Open my account" (a tap): load Firebase, then the workspace. After every wait, check that the person
// is still on #/account, so nothing is shown over a page they moved to on a slow network.
async function openAccount() {
  if (gateBusy) return;
  gateErr = null;
  if (!navigator.onLine) { renderGate(); return; }
  gateBusy = true; renderGate();
  try {
    await loadFirebase();
    if (!onAccount()) return;
    if (!user) { gateBusy = false; renderGate(); openModal($('acctGo')); return; }
    if (!wsRole) { mismatch = null; wsRole = await fb.roleOf(user, ctx.lang()); }
    if (!onAccount()) return;
    openWorkspace(wsRole);
    $('wsTitle').focus({ preventScroll: true });
  } catch (err) {
    gateErr = errKey(err && err.code, navigator.onLine);
  } finally {
    gateBusy = false;
    if (!$('acct').hidden) renderGate();
  }
}

/* ---------- workspace (P35, issue #78): js/workspace.js ---------- */
// Admins and volunteers see the user workspace for now (their own tools come with later issues).
function openWorkspace(role) {
  wsRole = role;
  ws.open({ user, fb, role, mismatch, who: user ? (user.displayName || user.email || '') : '', letter: user ? initial(user) : '' });
  ctx.showView('ws');
}

/* ---------- sign out ---------- */
function askSignOut() {
  const a = A();
  $('outTitle').textContent = a.outTitle;
  $('outText').textContent = a.outText;
  $('outRemoveText').textContent = a.outRemove;
  $('outRemove').checked = false;
  $('outSync').textContent = a.outSync;
  $('outSync').hidden = !syncOn(ctx.store);
  $('outYes').textContent = a.outYes;
  $('outNo').textContent = a.outNo;
  $('outDialog').returnValue = '';
  $('outDialog').showModal();
}
// removeLocal: the person ticked "also remove from this phone". Otherwise their numbers and areas stay.
// The copy in the account (if it was on) stays in the account; this phone stops updating it.
async function signOut(removeLocal) {
  try { if (fb) await fb.signOutNow(); } catch {}
  user = null; wsRole = null; mismatch = null;
  clearFlag();
  for (const key of removeLocal ? LOCAL_KEYS : [SYNC]) { try { localStorage.removeItem(key); } catch {} }
  ws.close();
  ctx.people.changed();
  renderButton();
  ctx.goHome();
  toast(removeLocal ? A().outRemoved : A().outDone);
}
let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
}

/* ---------- start ---------- */
export function initAuth(helpers) {
  ctx = helpers;
  $('acctBtn').addEventListener('click', (e) => tapSignIn(e.currentTarget));
  $('rolesSignin').addEventListener('click', (e) => tapSignIn(e.currentTarget));
  $('acctGo').addEventListener('click', (e) => { if (signedIn()) openAccount(); else openModal(e.currentTarget); });
  $('siClose').addEventListener('click', () => closeModal());
  dlg().addEventListener('close', onModalClosed);
  // A tap on the dark area around the modal (wide screens) closes it too.
  dlg().addEventListener('click', (e) => { if (e.target === dlg()) closeModal(); });
  // Moving to another page (Back, a link) closes the modal, so it never stays over the new page.
  window.addEventListener('hashchange', () => closeModal(false));
  ws = initWorkspace({ ...ctx, askSignOut });
  rep = initReports({ ...ctx, withUser, openMine, knownUser: () => Boolean(user), reportSent: () => ws.reportsChanged() });
  $('siGoogle').addEventListener('click', () => run(() => fb.signInGoogle(), 'google'));
  $('siForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = fields(true); if (f) run(() => fb.signInEmail(f.email, f.password));
  });
  $('siCreate').addEventListener('click', () => { const f = fields(true); if (f) run(() => fb.createAccount(f.email, f.password)); });
  $('siForgot').addEventListener('click', () => {
    const f = fields(false);
    if (f) run(async () => { await fb.resetPassword(f.email); say('resetSent', true); });
  });
  $('outDialog').addEventListener('close', () => { if ($('outDialog').returnValue === 'yes') signOut($('outRemove').checked); });
  const onNet = () => {
    if (dlg().open) { if (navigator.onLine && !fb) loadFirebase().catch(() => {}).finally(renderOnline); renderOnline(); }
    if (!$('acct').hidden) renderGate();
  };
  window.addEventListener('online', onNet);
  window.addEventListener('offline', onNet);
  renderButton();
  return {
    // #/account: the workspace when this visit is already signed in; otherwise the account page.
    // It loads Firebase only when the address was opened by a tap (intent.tap) and this phone was signed in before.
    open(intent) {
      if (user && wsRole) { openWorkspace(wsRole); return; }
      gateErr = null;
      showGate();
      if (user || (intent && intent.tap && hasFlag())) openAccount();
    },
    // "Report a wrong number" on a contact row (js/preview.js). Opens the form; nothing is loaded or sent yet.
    report(record, info, from) { rep.open(record, info, from); },
    setText() {
      renderButton();
      rep.setText();
      if (fb) fb.setLang(ctx.lang());
      if (dlg().open) renderSignin();
      if (!$('ws').hidden) ws.render();
      if (!$('acct').hidden) renderGate();
    },
  };
}
