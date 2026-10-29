// User workspace behind #/account (P35, issue #78). Rules: docs/ROLES.md §2-3, docs/SYSTEM_DESIGN.md §4.
// Opened by js/auth.js only after a tap and a sign-in, so Firebase is already loaded here.
// Offline first: family numbers ("sc-family") and saved areas ("sc-places") live on this phone and work with no internet.
// The copy in the account is optional and off by default: only when the person turns it on are the numbers copied
// to family/{uid}/people (fields allowed by firestore.rules: name, relation, phone). Turning it off deletes that copy.
// "My reports" and the admin list "Check reports" (P18, issue #79) read reports with the only queries the rules allow:
// a user lists only their own (uid == their uid); "check" is shown only to admins, and the rules check admins/{uid} again.
import { STATUSES, REPORT_DISTRICTS, auditFields } from './reports.js';

const WORK = ['dash', 'family', 'places', 'reports'];
export const SYNC = 'sc-family-sync';     // "1" while the copy in the account is on (this phone only; cleared at sign-out)
const PLACES = 'sc-places';        // saved areas, the same shape as "sc-last"
const MAX_PEOPLE = 3;
const MAX_PLACES = 5;
// Keys removed when the person chooses "also remove from this phone" at sign-out.
export const LOCAL_KEYS = ['sc-family', PLACES, 'sc-last', SYNC];
const ICON = {
  dash: 'M12 3 2 11h3v9h6v-6h2v6h6v-9h3L12 3Z',
  family: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6H1Zm17 0c0-2-.8-3.8-2.2-5.1 3 .4 5.2 2.4 5.2 5.1h-3Z',
  places: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z',
  reports: 'M5 21V4h10l1 2h4v10h-7l-1-2H7v7H5Z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 5v-2l-2.4-.6a7 7 0 0 0-.7-1.7l1.3-2.1-1.4-1.4-2.1 1.3a7 7 0 0 0-1.7-.7L13 3h-2l-.6 2.4a7 7 0 0 0-1.7.7L6.6 4.8 5.2 6.2l1.3 2.1a7 7 0 0 0-.7 1.7L3 11v2l2.4.6c.2.6.4 1.2.7 1.7l-1.3 2.1 1.4 1.4 2.1-1.3c.5.3 1.1.5 1.7.7L11 21h2l.6-2.4c.6-.2 1.2-.4 1.7-.7l2.1 1.3 1.4-1.4-1.3-2.1c.3-.5.5-1.1.7-1.7L21 13Z',
  out: 'M10 3H4v18h6v-2H6V5h4V3Zm6 4-1.4 1.4 2.6 2.6H9v2h8.2l-2.6 2.6L16 17l5-5-5-5Z',
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  send: 'M2 21 23 12 2 3v7l15 2-15 2v7Z',
  check: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6Z',
};

let ctx = null;        // helpers from auth.js / preview.js
let acct = null;       // { user, fb, role, mismatch, letter } while the workspace is open this visit
let section = 'dash';
let syncBusy = false;
let syncMsg = null;    // key in auth.ws for the line under the switch
let formErr = null;    // text under the add-number form
let placeMsg = null;   // key in auth.ws under the saved areas
let cardN = 0;         // numbers the card headings of one render (for aria-labelledby)
let want = null;       // the section to open next (e.g. "reports" after sending a report)
// Reports are kept only in memory while the workspace is open; null = not loaded yet.
let mine = null, mineBusy = false, mineErr = null;
let all = null, allBusy = false, allErr = null;
let filter = { status: '', district: '' };
let choice = {};       // admin: the status picked in each row, not saved yet
let rowMsg = null;     // admin: { id, key } under one row

const W = () => ctx.texts().auth.ws;
const U = () => ctx.texts().ui;
const $ = (id) => ctx.$(id);
const online = () => navigator.onLine;
const visible = () => acct && !$('ws').hidden;
export const syncOn = (store) => store.get(SYNC) === '1';
const sections = () => (acct && acct.role === 'admin' ? [...WORK, 'check', 'settings'] : [...WORK, 'settings']);

function icon(d) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  n.setAttribute('viewBox', '0 0 24 24'); n.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d);
  n.append(p);
  return n;
}
function button(text, cls, onClick, id) {
  const b = ctx.el('button', cls, text); b.type = 'button';
  if (id) b.id = id;
  b.addEventListener('click', onClick);
  return b;
}
function withIcon(node, d, text) { node.append(icon(d), ctx.el('span', null, text)); return node; }

/* ---------- data on this phone ---------- */
function readPlaces() {
  try { const l = JSON.parse(ctx.store.get(PLACES) || '[]'); return Array.isArray(l) ? l.filter((p) => p && p.district && p.upazila) : []; } catch { return []; }
}
function writePlaces(list) { ctx.store.set(PLACES, JSON.stringify(list)); }
function lastPlace() { try { const p = JSON.parse(ctx.store.get('sc-last') || 'null'); return p && !p.outside && p.district && p.upazila ? p : null; } catch { return null; } }
const placeKey = (p) => [p.district, p.upazila, p.area ? p.area.bn : '', p.placeId || ''].join('|');

/* ---------- the copy in the account (only when it is on) ---------- */
// Exactly the fields firestore.rules allow, with their size limits.
function toCloud(p) {
  const d = { name: String(p.name || '').trim().slice(0, 40), phone: p.phone };
  const rel = String(p.rel || '').trim().slice(0, 20);
  if (rel) d.relation = rel;
  return d;
}
const cloudList = () => ctx.people.get().map(toCloud).filter((d) => d.name).slice(0, MAX_PEOPLE);
function fromCloud(list) {
  return list.map((d) => ({ name: String(d.name || '').slice(0, 40), rel: String(d.relation || '').slice(0, 20), phone: ctx.people.norm(String(d.phone || '')) }))
    .filter((p) => p.name && p.phone).slice(0, MAX_PEOPLE);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b.map(toCloud));
function setSync(on) { if (on) ctx.store.set(SYNC, '1'); else { try { localStorage.removeItem(SYNC); } catch {} } }

// On opening (with internet): a phone with no numbers gets them back from the account's copy. Numbers are sent
// only while the copy is on for this phone (the flag is cleared at sign-out), never because another account
// that signs in here has a copy: the numbers on this phone may belong to someone else.
async function checkCloud() {
  if (!acct || !online() || syncBusy) return;
  const { fb, user } = acct;
  try {
    const cloud = await fb.readFamily(user.uid);
    const local = ctx.people.get();
    if (!local.length && cloud.length) {
      ctx.people.set(fromCloud(cloud)); ctx.people.changed();
      setSync(true); syncMsg = 'syncRestored';
    } else if (syncOn(ctx.store) && !same(cloudList(), fromCloud(cloud))) {
      await fb.saveFamily(user.uid, cloudList());
    }
  } catch { if (syncOn(ctx.store)) syncMsg = 'syncErr'; }
  if (visible()) render();
}
// After a change on this phone: update the copy if it is on. With no internet the change waits (see "online").
async function pushCopy() {
  if (!acct || !syncOn(ctx.store)) return;
  if (!online()) { syncMsg = 'syncNet'; return; }
  try { await acct.fb.saveFamily(acct.user.uid, cloudList()); syncMsg = null; } catch { syncMsg = 'syncErr'; }
  if (visible()) render();
}
async function toggleSync(on) {
  if (syncBusy) return;
  if (!online()) { syncMsg = 'syncNet'; render(); return; }
  syncBusy = true; syncMsg = null; render();
  const { fb, user } = acct;
  try {
    if (on) {
      const cloud = await fb.readFamily(user.uid);
      if (!ctx.people.get().length && cloud.length) { ctx.people.set(fromCloud(cloud)); ctx.people.changed(); }
      else await fb.saveFamily(user.uid, cloudList());
      setSync(true); syncMsg = 'syncOn';
    } else {
      await fb.deleteFamily(user.uid);
      setSync(false); syncMsg = 'syncOff';
    }
  } catch { syncMsg = 'syncErr'; }
  syncBusy = false;
  render();
  $('wsSync')?.focus();
}

/* ---------- shell: sidebar, phone section bar, top bar ---------- */
function navButton(key) {
  const b = withIcon(button(null, 'navitem', () => show(key, true)), ICON[key], W().nav[key]);
  b.dataset.sec = key;
  if (key === section) b.setAttribute('aria-current', 'page');
  return b;
}
function group(title, items) {
  const g = ctx.el('div', 'navgroup');
  g.append(ctx.el('small', null, title), ...items);
  return g;
}
function helpItems(cls) {
  const call = withIcon(ctx.el('a', `${cls} red`), ICON.phone, U().call999); call.href = 'tel:999';
  const send = withIcon(button(null, cls, () => ctx.openSos(null)), ICON.send, U().sosBtn);
  const near = withIcon(button(null, cls, () => { ctx.goHome(); ctx.locate(); }), ICON.places, U().locate);
  return [call, send, near];
}
function renderSide() {
  const w = W(), a = ctx.texts().auth;
  const me = ctx.el('div', 'me');
  const who = ctx.el('div');
  who.append(ctx.el('b', null, acct.who || a.accountLabel), ctx.el('small', null, a.roles[acct.role].name));
  me.append(ctx.el('span', 'avatar', acct.letter || '•'), who);
  const out = withIcon(button(null, 'navitem', ctx.askSignOut), ICON.out, a.signOut);
  $('wsSide').setAttribute('aria-label', w.side);
  $('wsSide').replaceChildren(me,
    group(w.groupWork, sections().filter((k) => k !== 'settings').map(navButton)),
    group(w.groupAccount, [navButton('settings'), out]),
    group(w.groupHelp, helpItems('navitem')));
  $('wsMob').setAttribute('aria-label', w.sections);
  $('wsMob').replaceChildren(...sections().map(navButton));
}
function renderHead() {
  const w = W(), a = ctx.texts().auth;
  const name = acct.user && acct.user.displayName ? acct.user.displayName.trim() : '';
  $('wsEyebrow').textContent = a.roles[acct.role].name;
  $('wsTitle').textContent = section === 'dash' ? (name ? ctx.fill(w.welcome, { name }) : w.welcomeNoName) : w.nav[section];
  $('wsLead').textContent = w[`${section}Text`];
  $('wsCrumb').replaceChildren(ctx.el('span', null, `${a.roles[acct.role].name} / `), ctx.el('b', null, w.nav[section]));
  $('wsOut').replaceChildren(icon(ICON.out), ctx.el('span', null, a.signOut));
  const note = acct.mismatch ? a.mismatch[acct.mismatch] : acct.role !== 'user' ? w.roleSoon[acct.role] : '';
  $('wsNote').textContent = note; $('wsNote').hidden = !note;
  const who = acct.user ? (acct.user.email || acct.user.displayName || '') : '';
  $('wsWho').textContent = who ? ctx.fill(a.wsSignedAs, { who }) : '';
  $('wsWho').hidden = !who;
}

/* ---------- sections ---------- */
function card(title, body, action) {
  const c = ctx.el('section', 'wcard');
  const head = ctx.el('div', 'card-head');
  const h = ctx.el('h2', null, title);
  h.id = `wsCard${++cardN}`;
  c.setAttribute('aria-labelledby', h.id);
  head.append(h);
  if (action) head.append(action);
  c.append(head, ...body);
  return c;
}
function stat(key, value, sub) {
  const s = ctx.el('div', 'wstat');
  const top = ctx.el('div', 'top'); top.append(ctx.el('span', null, W().nav[key]), icon(ICON[key]));
  s.append(top, ctx.el('b', null, value), ctx.el('small', null, sub), button(W().seeAll, 'ws-more', () => show(key, true)));
  return s;
}
function personRows(withRemove) {
  const people = ctx.people.get();
  if (!people.length) return [ctx.el('p', 'wempty', U().noPeople)];
  return people.map((p, i) => {
    const row = ctx.el('div', 'wrow');
    const txt = ctx.el('div');
    txt.append(ctx.el('b', null, p.rel ? `${p.name} (${p.rel})` : p.name), ctx.el('small', null, ctx.digits(p.phone)));
    const end = ctx.el('span', 'end');
    const call = ctx.el('a', 'btn sm', U().call); call.href = `tel:${p.phone}`;
    const sms = ctx.el('a', 'btn sm', W().sms); sms.href = `sms:${p.phone}`;
    end.append(call, sms);
    if (withRemove) end.append(button(U().remove, 'btn sm', () => removePerson(i)));
    row.append(ctx.el('span', 'avatar', [...p.name][0] || '•'), txt, end);
    return row;
  });
}
function removePerson(i) {
  const l = ctx.people.get(); l.splice(i, 1); ctx.people.set(l); ctx.people.changed();
  render(); pushCopy();
}
function addPerson(e) {
  e.preventDefault();
  const name = $('wsName').value.trim();
  const phone = ctx.people.norm($('wsPhone').value);
  const people = ctx.people.get();
  formErr = people.length >= MAX_PEOPLE ? U().maxPeople : !name ? U().needName : !phone ? U().badPhone : null;
  if (formErr) { render(); $(name ? 'wsPhone' : 'wsName')?.focus(); return; }
  people.push({ name, rel: $('wsRel').value.trim(), phone });
  ctx.people.set(people); ctx.people.changed();
  for (const id of ['wsName', 'wsRel', 'wsPhone']) $(id).value = '';
  render(); $('wsName')?.focus();
  pushCopy();
}
function field(id, label, type, max) {
  const l = ctx.el('label', 'field');
  const i = document.createElement('input');
  i.id = id; i.type = type; i.maxLength = max; i.autocomplete = 'off';
  if (type === 'tel') i.inputMode = 'tel';
  l.append(ctx.el('span', null, label), i);
  return l;
}
function addForm() {
  if (ctx.people.get().length >= MAX_PEOPLE) return [ctx.el('p', 'wempty', U().maxPeople)];
  const f = ctx.el('form', 'wform'); f.id = 'wsAddForm'; f.noValidate = true;
  const row = ctx.el('div', 'wform-row');
  row.append(field('wsName', U().name, 'text', 40), field('wsRel', U().rel, 'text', 20), field('wsPhone', U().phone, 'tel', 20));
  const err = ctx.el('p', 'err', formErr || ''); err.id = 'wsFormErr'; err.hidden = !formErr; err.setAttribute('role', 'alert');
  const save = ctx.el('button', 'btn violet', W().add); save.type = 'submit';
  f.append(row, err, save);
  f.addEventListener('submit', addPerson);
  return [f];
}
function syncSwitch() {
  const w = W();
  const box = ctx.el('div', 'switch');
  const txt = ctx.el('div');
  const title = ctx.el('label', null, w.syncTitle); title.htmlFor = 'wsSync';
  const help = ctx.el('small', null, w.syncText); help.id = 'wsSyncHelp';
  txt.append(title, help);
  const t = document.createElement('input');
  t.type = 'checkbox'; t.className = 'toggle'; t.id = 'wsSync'; t.setAttribute('role', 'switch');
  t.setAttribute('aria-describedby', 'wsSyncHelp');
  t.checked = syncOn(ctx.store);
  t.disabled = syncBusy || !online();
  t.addEventListener('change', () => toggleSync(t.checked));
  box.append(txt, t);
  const key = !online() ? 'syncNet' : syncMsg;
  const out = [box];
  if (syncBusy || key) {
    const m = ctx.el('p', key === 'syncErr' || key === 'syncNet' ? 'offline-note' : 'si-note', syncBusy ? ctx.texts().auth.wait : w[key]);
    m.id = 'wsSyncMsg'; m.setAttribute('role', 'status');
    out.push(m);
  }
  return out;
}
function placeRows() {
  const list = readPlaces();
  if (!list.length) return [ctx.el('p', 'wempty', W().placesNone)];
  return list.map((p, i) => {
    const n = ctx.placeName(p) || { title: p.label || p.upazila, sub: '' };
    const row = ctx.el('div', 'wrow');
    const ic = ctx.el('span', 'avatar'); ic.append(icon(ICON.places));
    const txt = ctx.el('div'); txt.append(ctx.el('b', null, n.title), ctx.el('small', null, n.sub));
    const end = ctx.el('span', 'end');
    end.append(button(W().open, 'btn sm', () => ctx.openArea(p)), button(U().remove, 'btn sm', () => { const l = readPlaces(); l.splice(i, 1); writePlaces(l); placeMsg = null; render(); }));
    row.append(ic, txt, end);
    return row;
  });
}
function placeActions() {
  const w = W(), list = readPlaces(), last = lastPlace();
  const box = ctx.el('div', 'wactions');
  if (last && !list.some((p) => placeKey(p) === placeKey(last))) {
    const n = ctx.placeName(last);
    if (n) box.append(button(ctx.fill(w.saveLast, { place: n.title }), 'btn violet', () => {
      const l = readPlaces();
      if (l.length >= MAX_PLACES) { placeMsg = 'maxPlaces'; render(); return; }
      l.push(last); writePlaces(l); placeMsg = null; render();
    }, 'wsSaveLast'));
  }
  box.append(button(w.findArea, 'btn', () => ctx.go('area')));
  const out = [box];
  if (placeMsg) { const m = ctx.el('p', 'err', w[placeMsg]); m.setAttribute('role', 'alert'); out.push(m); }
  return out;
}
function settingRow(title, now, btn) {
  const r = ctx.el('div', 'switch');
  const txt = ctx.el('div'); txt.append(ctx.el('b', null, title), ctx.el('small', null, now));
  r.append(txt, btn);
  return r;
}
/* ---------- wrong-number reports (P18, issue #79) ---------- */
const R = () => ctx.texts().report;
function reportsSub() {
  if (mine) { const n = mine.filter((r) => r.status === 'open' || r.status === 'review').length; return n ? ctx.fill(W().statOpen, { n: ctx.digits(n) }) : W().noneYet; }
  return online() ? ctx.texts().auth.wait : W().statNet;
}
async function loadMine() {
  if (!acct || !online() || mineBusy) { if (visible()) render(); return; }
  mineBusy = true; if (visible()) render();
  const a = acct;
  try { const list = await a.fb.myReports(a.user.uid); if (acct === a) { mine = list; mineErr = null; } } catch { if (acct === a) mineErr = 'reportsErr'; }
  mineBusy = false;
  if (visible()) render();
}
async function loadAll() {
  if (!acct || acct.role !== 'admin' || !online() || allBusy) { if (visible()) render(); return; }
  allBusy = true; if (visible()) render();
  const a = acct;
  try { const list = await a.fb.allReports(); if (acct === a) { all = list; allErr = null; } } catch { if (acct === a) allErr = 'checkErr'; }
  allBusy = false;
  if (visible()) render();
}
function reloadBtn(id, fn, busy) {
  const b = button(busy ? ctx.texts().auth.wait : W().reload, 'btn sm', fn, id);
  b.disabled = busy || !online();
  return b;
}
function statusTag(st) { return ctx.el('span', `tag st-${STATUSES.includes(st) ? st : 'open'}`, R().statuses[st] || R().statuses.open); }
const recordName = (rec) => [rec.name_bn, rec.designation_bn].filter(Boolean).join(', ') || rec.office_bn || '—';
function note(cls, key) { const m = ctx.el('p', `${cls} wpad`, W()[key]); m.setAttribute('role', cls === 'err' ? 'alert' : 'status'); return m; }
function stateNotes(list, busy, err, netKey) {
  const out = [];
  if (!online()) out.push(note('offline-note', netKey));
  else if (err) out.push(note('err', err));
  if (!list && busy) out.push(ctx.el('p', 'wempty', ctx.texts().auth.wait));
  return out;
}
function reportRow(r) {
  const rec = ctx.findRecord(r.district, r.recordId);
  const row = ctx.el('div', 'wrow');
  const ic = ctx.el('span', 'avatar'); ic.append(icon(ICON.reports));
  const txt = ctx.el('div');
  const when = r.createdAt ? ctx.fill(W().sentOn, { date: ctx.fmtDate(r.createdAt) }) : '';
  txt.append(ctx.el('b', null, rec ? recordName(rec) : (r.area || r.recordId)),
    ctx.el('small', null, [rec ? r.area : '', R().problems[r.problem] || '', when].filter(Boolean).join(' · ')));
  const end = ctx.el('span', 'end'); end.append(statusTag(r.status));
  row.append(ic, txt, end);
  return row;
}
function mineRows() {
  const out = stateNotes(mine, mineBusy, mineErr, 'reportsNet');
  if (mine && !mine.length) out.push(ctx.el('p', 'wempty', W().reportsEmpty));
  if (mine) out.push(...mine.map(reportRow));
  return out;
}
// Admin list: the filters work on the loaded list (no extra index needed).
function select(id, label, options, value, onChange) {
  const l = ctx.el('label', 'field');
  const s = document.createElement('select'); s.id = id;
  for (const [v, text] of options) { const o = ctx.el('option', null, text); o.value = v; o.selected = v === value; s.append(o); }
  s.addEventListener('change', () => onChange(s.value));
  l.append(ctx.el('span', null, label), s);
  return l;
}
function filters() {
  const w = W(), r = R();
  const box = ctx.el('div', 'wfilters');
  box.append(
    select('wsFStatus', w.fStatus, [['', w.fAll], ...STATUSES.map((x) => [x, r.statuses[x]])], filter.status, (v) => { filter.status = v; render(); }),
    select('wsFDist', w.fDistrict, [['', w.fAll], ...REPORT_DISTRICTS.map((d) => [d, ctx.districtName(d)])], filter.district, (v) => { filter.district = v; render(); }));
  return box;
}
function checkRow(r) {
  const w = W(), u = ctx.texts().ui, rec = ctx.findRecord(r.district, r.recordId);
  const row = reportRow(r);
  row.classList.add('wcheck');
  const more = ctx.el('div', 'wmore');
  more.append(ctx.el('small', null, `${ctx.districtName(r.district)} · ${r.recordId}`));
  if (r.note) more.append(ctx.el('p', 'wnote', r.note));
  if (rec) {
    more.append(ctx.el('small', null, `${w.nowShown}: ${(rec.phones || []).map(ctx.digits).join(', ') || '—'}`));
    if (rec.source_url) { const a = ctx.el('a', null, `${u.source} ↗`); a.href = rec.source_url; a.target = '_blank'; a.rel = 'noopener'; more.append(a); }
  } else more.append(ctx.el('small', null, w.recordGone));
  const set = ctx.el('div', 'wset');
  set.append(select(`wsSt-${r.id}`, w.setStatus, STATUSES.map((x) => [x, R().statuses[x]]), choice[r.id] || r.status, (v) => { choice[r.id] = v; rowMsg = null; }));
  const save = button(w.saveStatus, 'btn sm violet', () => saveStatus(r), `wsSave-${r.id}`);
  save.disabled = !online();
  set.append(save);
  more.append(set);
  if (rowMsg && rowMsg.id === r.id) more.append(note(rowMsg.key === 'saveErr' ? 'err' : 'si-note', rowMsg.key));
  row.append(more);
  return row;
}
function checkRows() {
  const out = stateNotes(all, allBusy, allErr, 'checkNet');
  if (!all) return out;
  const list = all.filter((r) => (!filter.status || r.status === filter.status) && (!filter.district || r.district === filter.district));
  if (!list.length) out.push(ctx.el('p', 'wempty', W().checkNone));
  return [...out, ...list.map(checkRow)];
}
// The status and its audit entry go in one batch (firestore.rules refuse a change without it).
async function saveStatus(r) {
  const to = choice[r.id] || r.status;
  if (to === r.status || !online() || !acct || saving.has(r.id)) return;
  // One save at a time per report, so a double tap never writes two audit entries.
  saving.add(r.id); const btn = $(`wsSave-${r.id}`); if (btn) btn.disabled = true;
  try {
    await acct.fb.setReportStatus(r.id, auditFields(acct.user.uid, r.id, r.status, to), to);
    r.status = to; delete choice[r.id]; rowMsg = { id: r.id, key: 'saved' };
    if (mine) { const m = mine.find((x) => x.id === r.id); if (m) m.status = to; }
  } catch { rowMsg = { id: r.id, key: 'saveErr' }; }
  saving.delete(r.id);
  render();
  $(`wsSave-${r.id}`)?.focus({ preventScroll: true });
}
const saving = new Set();   // report ids whose status is being saved right now

const isDark = () => { const r = document.documentElement; return r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };

const SECTION = {
  dash() {
    const w = W(), people = ctx.people.get(), places = readPlaces();
    const strip = ctx.el('div', 'help-strip'); strip.append(...helpItems('ws-help'));
    const stats = ctx.el('div', 'wstats');
    stats.append(
      stat('family', ctx.digits(people.length), syncOn(ctx.store) ? w.onPhoneSync : w.onPhone),
      stat('places', ctx.digits(places.length), w.onPhone),
      stat('reports', mine ? ctx.digits(mine.length) : '—', reportsSub()));
    return [strip, stats, card(w.nav.family, personRows(false), button(w.seeAll, 'btn sm', () => show('family', true)))];
  },
  family() {
    const w = W();
    return [card(w.nav.family, personRows(true)), card(w.addTitle, addForm()), card(w.syncTitle, syncSwitch())];
  },
  places() { return [card(W().nav.places, placeRows()), ...placeActions()]; },
  reports() { return [card(W().nav.reports, mineRows(), reloadBtn('wsMineReload', loadMine, mineBusy))]; },
  check() { return [filters(), card(W().checkTitle, checkRows(), reloadBtn('wsAllReload', loadAll, allBusy))]; },
  settings() {
    const w = W(), dark = isDark();
    const lang = button(w.langBtn, 'btn sm', () => { ctx.$('langBtn').click(); $('wsLangBtn')?.focus(); }, 'wsLangBtn');
    lang.lang = ctx.lang() === 'bn' ? 'en' : 'bn';
    const theme = button(dark ? w.themeToDay : w.themeToNight, 'btn sm', () => { ctx.$('themeBtn').click(); render(); $('wsThemeBtn')?.focus(); }, 'wsThemeBtn');
    return [card(w.nav.settings, [settingRow(w.langTitle, w.langNow, lang), settingRow(w.themeTitle, dark ? w.themeNight : w.themeDay, theme)]),
      card(w.syncTitle, syncSwitch())];
  },
};

/* ---------- render ---------- */
function render() {
  if (!acct) return;
  const keep = document.activeElement && $('ws').contains(document.activeElement) ? document.activeElement.id : '';
  const typed = {};
  for (const id of ['wsName', 'wsRel', 'wsPhone']) if ($(id)) typed[id] = $(id).value;
  cardN = 0;
  renderSide();
  renderHead();
  $('wsBody').replaceChildren(...SECTION[section]());
  for (const [id, v] of Object.entries(typed)) if ($(id)) $(id).value = v;
  if (keep && $(keep)) $(keep).focus({ preventScroll: true });
}
// A section from the sidebar or the section bar: its heading gets the focus (screen readers read it).
function show(key, focus = false) {
  section = sections().includes(key) ? key : 'dash';
  formErr = null; placeMsg = null; rowMsg = null;
  render();
  if (focus) { $('wsTitle').focus({ preventScroll: true }); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }
}

export function initWorkspace(helpers) {
  ctx = helpers;
  $('wsOut').addEventListener('click', ctx.askSignOut);
  const onNet = () => {
    if (!visible()) return;
    render();
    if (online()) { checkCloud(); if (!mine) loadMine(); if (acct.role === 'admin' && !all) loadAll(); }
  };
  window.addEventListener('online', onNet);
  window.addEventListener('offline', onNet);
  return {
    // state: { user, fb, role, mismatch, who, letter }
    open(state) {
      const first = !acct || acct.user !== state.user;
      acct = state;
      if (first) { section = 'dash'; syncMsg = null; mine = null; mineErr = null; all = null; allErr = null; choice = {}; rowMsg = null; }
      if (want) { section = want; want = null; }
      if (!sections().includes(section)) section = 'dash';
      render();
      if (first) { checkCloud(); loadMine(); if (acct.role === 'admin') loadAll(); } else if (!mine) loadMine();
    },
    // Open this section the next time the workspace opens (e.g. "My reports" after sending a report).
    want(key) { want = key; },
    // A new report was sent: load "My reports" again (now if the workspace is open, else when it opens).
    reportsChanged() { mine = null; if (visible()) loadMine(); },
    render() { if (acct) render(); },
    // Sign-out: nothing of this account stays in memory.
    close() { acct = null; section = 'dash'; syncMsg = null; formErr = null; placeMsg = null; mine = null; all = null; choice = {}; rowMsg = null; },
  };
}
