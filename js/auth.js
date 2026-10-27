// Sign-in with three options, account button and sign-out (P45, issue #66). Rules: docs/ROLES.md §1-2.
// Help never waits for an account: Firebase (js/firebase.js) is loaded with import() only when someone opens
// sign-in or was signed in before, so with no internet only this part shows a calm line and the rest works.
// The phone keeps one flag, "sc-signed-in" = "1", and no personal data. Sign-out never touches other keys
// (the family numbers in "sc-family" and the last area in "sc-last" stay on the phone).
const ROLES = ['user', 'volunteer', 'admin'];
const FLAG = 'sc-signed-in';
const ICON = {
  user: 'M12 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm-8 9c0-4.4 3.6-7 8-7s8 2.6 8 7H4Z',
  volunteer: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z',
  admin: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6Z',
};
// Firebase error code -> key in auth.err of js/lang/*.json.
const ERR = {
  'auth/invalid-credential': 'wrong', 'auth/wrong-password': 'wrong', 'auth/user-not-found': 'wrong',
  'auth/invalid-email': 'badEmail', 'auth/missing-email': 'needEmail', 'auth/weak-password': 'weak',
  'auth/email-already-in-use': 'inUse', 'auth/popup-closed-by-user': 'popup', 'auth/cancelled-popup-request': 'popup',
  'auth/network-request-failed': 'network', 'unavailable': 'network', 'auth/too-many-requests': 'tooMany',
};

let ctx = null;          // helpers from preview.js: $, el, store, fill, lang(), texts(), showView, goHome, openSos, locate
let fbLoad = null;       // the import('./firebase.js') promise, started once
let fb = null;           // the module, once loaded
let user = null;         // the signed-in Firebase user (only in memory)
let wsRole = null;       // the workspace that is open: 'user', 'volunteer' or 'admin'
let pick = 'user';       // the option chosen on the sign-in page
let mismatch = null;     // the option that did not match, for the short note
let busy = false;

const A = () => ctx.texts().auth;
const $ = (id) => ctx.$(id);
const signedIn = () => Boolean(user) || ctx.store.get(FLAG) === '1';
function clearFlag() { try { localStorage.removeItem(FLAG); } catch {} }

function icon(d) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  n.setAttribute('viewBox', '0 0 24 24'); n.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d);
  n.append(p);
  return n;
}

/* ---------- Firebase, loaded only when needed ---------- */
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
      });
      return mod;
    }).catch((err) => { fbLoad = null; throw err; });
  }
  return fbLoad;
}

/* ---------- header button ---------- */
function renderButton() {
  const b = $('acctBtn');
  const on = signedIn();
  b.replaceChildren(icon(ICON.user), ctx.el('span', 'acct-text', on ? A().account : A().signIn));
  b.setAttribute('aria-label', on ? A().accountLabel : A().signIn);
}

/* ---------- sign-in view ---------- */
function canTry() { return navigator.onLine && !busy; }
function renderOnline() {
  const off = !navigator.onLine || (!fb && !fbLoad);
  $('siOffline').hidden = !off;
  for (const id of ['siGoogle', 'siSubmit', 'siCreate', 'siForgot']) $(id).disabled = off || busy;
}
function say(key, plain = false) {
  const m = $('siMsg');
  m.textContent = key ? (plain ? A()[key] : A().err[key]) : '';
  m.classList.toggle('plain', plain);
  m.hidden = !key;
}
function renderSignin() {
  const a = A(), u = ctx.texts().ui;
  $('siBack').textContent = u.back;
  $('noLoginTitle').textContent = a.noLoginTitle;
  $('noLoginText').textContent = a.noLoginText;
  // The red box uses the same offline-safe actions as the home page.
  const call = ctx.el('a', 'btn red', u.call999); call.href = 'tel:999';
  const send = ctx.el('button', 'btn', u.sosBtn); send.type = 'button'; send.addEventListener('click', () => ctx.openSos(null));
  const near = ctx.el('button', 'btn', u.locate); near.type = 'button'; near.addEventListener('click', () => { ctx.goHome(); ctx.locate(); });
  $('noLoginBtns').replaceChildren(call, send, near);
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
  $('siOffline').textContent = a.offline;
  $('siGoogle').textContent = a.google;
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
function openSignin() {
  say(null);
  const loading = navigator.onLine ? loadFirebase().catch(() => {}) : null;
  renderSignin();
  ctx.showView('signin');
  if (loading) loading.finally(renderOnline);
}

/* ---------- after sign-in ---------- */
async function enter(u) {
  const role = await fb.roleOf(u, ctx.lang());
  const ok = pick === 'user' || pick === role;
  mismatch = ok ? null : pick;
  openWorkspace(ok ? pick : 'user');
}
async function run(action) {
  if (!canTry()) { renderOnline(); return; }
  busy = true; say(null); renderSignin();
  try {
    await loadFirebase();
    const cred = await action();
    if (cred && cred.user) { $('siPass').value = ''; await enter(cred.user); }
  } catch (err) {
    say(ERR[err.code] || (navigator.onLine ? 'other' : 'network'));
  } finally {
    busy = false;
    if (!$('signin').hidden) renderSignin();
  }
}
function fields(needPassword) {
  const email = $('siEmail').value.trim(), password = $('siPass').value;
  if (!email || (needPassword && !password)) { say(needPassword ? 'needBoth' : 'needEmail'); return null; }
  return { email, password };
}

/* ---------- workspace placeholder (part 2 builds the real one) ---------- */
function renderWorkspace() {
  const a = A();
  $('wsBack').textContent = ctx.texts().ui.back;
  $('wsEyebrow').textContent = a.eyebrow;
  $('wsTitle').textContent = a.roles[wsRole].name;
  $('wsNote').textContent = mismatch ? a.mismatch[mismatch] : '';
  $('wsNote').hidden = !mismatch;
  const who = user ? (user.email || user.displayName || '') : '';
  $('wsWho').textContent = who ? ctx.fill(a.wsSignedAs, { who }) : '';
  $('wsWho').hidden = !who;
  $('wsSoon').textContent = a.wsSoon;
  $('wsOut').textContent = a.signOut;
}
function openWorkspace(role) {
  wsRole = role;
  renderWorkspace();
  ctx.showView('ws');
}
// Header button when already signed in: open the workspace this account may use.
async function openAccount() {
  try {
    await loadFirebase();
    if (!user) { openSignin(); return; }
    if (!wsRole) { mismatch = null; wsRole = await fb.roleOf(user, ctx.lang()); }
    openWorkspace(wsRole);
  } catch {
    openSignin();
  }
}

/* ---------- sign out ---------- */
function askSignOut() {
  const a = A();
  $('outTitle').textContent = a.outTitle;
  $('outText').textContent = a.outText;
  $('outYes').textContent = a.outYes;
  $('outNo').textContent = a.outNo;
  $('outDialog').returnValue = '';
  $('outDialog').showModal();
}
async function signOut() {
  try { if (fb) await fb.signOutNow(); } catch {}
  user = null; wsRole = null; mismatch = null;
  clearFlag();
  renderButton();
  ctx.goHome();
  toast(A().outDone);
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
  $('acctBtn').addEventListener('click', () => (signedIn() ? openAccount() : openSignin()));
  $('siBack').addEventListener('click', ctx.goHome);
  $('wsBack').addEventListener('click', ctx.goHome);
  $('siGoogle').addEventListener('click', () => run(() => fb.signInGoogle()));
  $('siForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = fields(true); if (f) run(() => fb.signInEmail(f.email, f.password));
  });
  $('siCreate').addEventListener('click', () => { const f = fields(true); if (f) run(() => fb.createAccount(f.email, f.password)); });
  $('siForgot').addEventListener('click', () => {
    const f = fields(false);
    if (f) run(async () => { await fb.resetPassword(f.email); say('resetSent', true); });
  });
  $('wsOut').addEventListener('click', askSignOut);
  $('outDialog').addEventListener('close', () => { if ($('outDialog').returnValue === 'yes') signOut(); });
  const onNet = () => { if (!$('signin').hidden) { if (navigator.onLine && !fb) loadFirebase().catch(() => {}).finally(renderOnline); renderOnline(); } };
  window.addEventListener('online', onNet);
  window.addEventListener('offline', onNet);
  renderButton();
  // Signed in before: load Firebase in the background to know the account; help does not wait for it.
  if (signedIn()) loadFirebase().catch(() => {});
  return {
    setText() {
      renderButton();
      if (fb) fb.setLang(ctx.lang());
      if (!$('signin').hidden) renderSignin();
      if (!$('ws').hidden) renderWorkspace();
    },
  };
}
