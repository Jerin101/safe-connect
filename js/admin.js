// Admin workspace (P44, issue #65): dashboard cards, users and roles, audit log. Rules: firestore.rules
// ("users", "admins", "audit"), docs/SYSTEM_DESIGN.md §4-5, docs/ROLES.md §3. Shown only when admins/{uid} exists;
// the rules check that again on every read and write, so hiding the sections is never the only protection.
// The top part has no browser code, so tests/rules/firestore.rules.test.mjs can check the exact documents.

// The only roles the site can set. New admins are added only in the Firebase console (admins/{uid}).
export const SITE_ROLES = ['user', 'volunteer'];
export const AUDIT_ACTIONS = ['ROLE_CHANGED', 'REPORT_STATUS_CHANGED'];
const ID_OK = /^[A-Za-z0-9_-]{1,128}$/;   // the same check as firestore.rules

// The audit entry written in the same batch as a role change (js/firebase.js adds "at").
// null when the change is not allowed: your own role, "admin", no real change, or an unknown role.
export function roleAuditFields(actorUid, uid, from, to) {
  if (!actorUid || !ID_OK.test(String(uid || '')) || actorUid === uid) return null;
  if (!SITE_ROLES.includes(from) || !SITE_ROLES.includes(to) || from === to) return null;
  return { actorUid, action: 'ROLE_CHANGED', entity: 'users', entityId: uid, meta: { from, to } };
}

/* ---------- the admin sections (browser only; opened by js/workspace.js) ---------- */
// h: helpers from js/workspace.js (ctx, acct, render, visible, card, button, icon, select, note, stateNotes, reloadBtn, show, reports)
let h = null;
let users = null, usersBusy = false, usersErr = null;
let admins = new Set();
let uFilter = { role: '', find: '' };
let uChoice = {};      // the role picked in each row, not saved yet
let uMsg = null;       // { id, key } under one row
const uSaving = new Set();
let audit = null, auditBusy = false, auditErr = null;
let aFilter = { action: '', actor: '', from: '', to: '' };
let aMsg = null;       // key in auth.ws under the audit filters
let verify;            // undefined: not loaded yet; null: no report found; object: data/verify_report.json
const USERS_MAX = 200; // the same limit as listUsers() in js/firebase.js
const DAY = 86400000;

export const ADMIN_ICON = {
  users: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z',
  audit: 'M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 11v2h8v-2H8Zm0 4v2h8v-2H8Z',
  apps: 'M4 4h16v4H4V4Zm0 6h16v10H4V10Zm3 3v2h6v-2H7Z',
  check: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6Z',
};

const W = () => h.ctx.texts().auth.ws;
const A = () => h.ctx.texts().auth;
const online = () => navigator.onLine;
const me = () => (h.acct() ? h.acct().user.uid : null);
const roleOf = (u) => (admins.has(u.id) ? 'admin' : SITE_ROLES.includes(u.role) ? u.role : 'user');
const roleName = (r) => (A().roles[r] ? A().roles[r].name : String(r));
const shortId = (id) => (String(id).length > 8 ? `${String(id).slice(0, 6)}…` : String(id));
function personName(uid) {
  const u = users && users.find((x) => x.id === uid);
  return u ? (u.name || u.email || shortId(uid)) : shortId(uid);
}
function when(ms) {
  try {
    return new Intl.DateTimeFormat(h.ctx.lang() === 'bn' ? 'bn-BD' : 'en-GB',
      { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
  } catch { return ''; }
}
const redraw = () => { if (h.visible()) h.render(); };

/* ---------- loading (only with internet; the rules check admins/{uid} on every read) ---------- */
async function loadUsers() {
  const a = h.acct();
  if (!a || a.role !== 'admin' || !online() || usersBusy) { redraw(); return; }
  usersBusy = true; redraw();
  try {
    const [list, ids] = await Promise.all([a.fb.listUsers(), a.fb.listAdmins()]);
    if (h.acct() === a) { users = list; admins = new Set(ids); usersErr = null; }
  } catch { if (h.acct() === a) usersErr = 'usersErr'; }
  usersBusy = false;
  redraw();
}
function auditQuery() {
  const day = (v) => (v ? new Date(`${v}T00:00`).getTime() : null);
  const from = day(aFilter.from), to = day(aFilter.to);
  return { action: aFilter.action || null, actorUid: aFilter.actor || null, from, to: to === null ? null : to + DAY };
}
async function loadAudit() {
  const a = h.acct();
  if (!a || a.role !== 'admin' || !online() || auditBusy) { redraw(); return; }
  const q = auditQuery();
  if (q.from !== null && q.to !== null && q.from >= q.to) { aMsg = 'badDates'; redraw(); return; }
  aMsg = null; auditBusy = true; redraw();
  try { const list = await a.fb.listAudit(q); if (h.acct() === a) { audit = list; auditErr = null; } } catch { if (h.acct() === a) auditErr = 'auditErr'; }
  auditBusy = false;
  redraw();
}
// The last source check: the committed data/verify_report.json of this site (saved for offline use). Never made up.
async function loadVerify() {
  try {
    const res = await fetch('data/verify_report.json');
    const j = res.ok ? await res.json() : null;
    verify = j && typeof j.checked_on === 'string' && j.counts && typeof j.counts === 'object' ? j : null;
  } catch { verify = null; }
  redraw();
}

/* ---------- dashboard cards ---------- */
function adminStat(label, d, value, sub, go, cls) {
  const s = h.ctx.el('div', 'wstat');
  const top = h.ctx.el('div', 'top'); top.append(h.ctx.el('span', null, label), h.icon(d));
  s.append(top, h.ctx.el('b', cls || null, value), h.ctx.el('small', null, sub));
  if (go) s.append(h.button(W().seeAll, 'ws-more', () => h.show(go, true)));
  return s;
}
function checkSummary() {
  const w = W(), c = h.ctx;
  if (verify === undefined) return { value: '—', sub: A().wait };
  if (!verify) return { value: '—', sub: w.lastCheckNone };
  let n = 0, removed = 0, unreach = 0;
  for (const k of Object.values(verify.counts)) {
    if (!k || typeof k !== 'object') continue;
    n += (Number(k.ok) || 0) + (Number(k.name_text_differs) || 0) + (Number(k.removed) || 0) + (Number(k.page_unreachable_kept) || 0);
    removed += Number(k.removed) || 0; unreach += Number(k.page_unreachable_kept) || 0;
  }
  return { value: c.fmtDate(verify.checked_on), sub: c.fill(w.lastCheckSub, { n: c.digits(n), removed: c.digits(removed), unreach: c.digits(unreach) }) };
}
// Applications and volunteers have no collection yet (P38): the cards say so instead of showing a made-up number.
export function dashCards(reportIcon) {
  const w = W(), c = h.ctx, all = h.reports();
  const grid = c.el('div', 'wstats');
  const open = all ? all.filter((r) => r.status === 'open').length : null;
  const review = all ? all.filter((r) => r.status === 'review').length : 0;
  const repSub = all ? c.fill(w.reviewSub, { n: c.digits(review) }) : online() ? A().wait : w.statNet;
  const last = checkSummary();
  grid.append(
    adminStat(w.openReports, reportIcon, open === null ? '—' : c.digits(open), repSub, 'check'),
    adminStat(w.waitingApps, ADMIN_ICON.apps, '—', w.notBuilt),
    adminStat(w.activeVols, ADMIN_ICON.users, '—', w.notBuilt),
    adminStat(w.lastCheck, ADMIN_ICON.check, last.value, last.sub, null, 'date'));
  return h.card(w.overview, [grid]);
}

/* ---------- users and roles ---------- */
function userMatches(u) {
  const f = uFilter.find.trim().toLowerCase();
  return (!uFilter.role || roleOf(u) === uFilter.role) && (!f || `${u.name} ${u.email}`.toLowerCase().includes(f));
}
function userRow(u) {
  const w = W(), c = h.ctx, role = roleOf(u), self = u.id === me();
  const row = c.el('div', 'wrow wcheck');
  row.dataset.uid = u.id;
  const txt = c.el('div');
  const name = u.name || w.noName;
  txt.append(c.el('b', null, self ? `${name} (${w.you})` : name),
    c.el('small', null, [u.email, u.createdAt ? c.fill(w.joined, { date: c.fmtDate(u.createdAt) }) : ''].filter(Boolean).join(' · ')));
  const end = c.el('span', 'end'); end.append(c.el('span', `tag role-${role}`, roleName(role)));
  row.append(c.el('span', 'avatar', [...(u.name || u.email || '•')][0]), txt, end);
  const more = c.el('div', 'wmore');
  if (role === 'admin') more.append(c.el('small', null, w.adminNote));
  else if (self) more.append(c.el('small', null, w.selfNote));
  else {
    const set = c.el('div', 'wset');
    set.append(h.select(`wsRole-${u.id}`, w.newRole, SITE_ROLES.map((r) => [r, roleName(r)]), uChoice[u.id] || role, (v) => { uChoice[u.id] = v; uMsg = null; }));
    const save = h.button(w.saveRole, 'btn sm violet', () => saveRole(u), `wsRoleSave-${u.id}`);
    save.disabled = !online() || uSaving.has(u.id);
    set.append(save);
    more.append(set);
    if (uMsg && uMsg.id === u.id) more.append(h.note(uMsg.key === 'roleErr' ? 'err' : 'si-note', uMsg.key));
  }
  row.append(more);
  return row;
}
function userRows() {
  const out = h.stateNotes(users, usersBusy, usersErr, 'usersNet');
  if (!users) return out;
  const list = users.filter(userMatches);
  if (!list.length) out.push(h.ctx.el('p', 'wempty', W().usersNone));
  if (users.length >= USERS_MAX) out.push(h.ctx.el('p', 'si-note wpad', h.ctx.fill(W().usersLimit, { n: h.ctx.digits(USERS_MAX) })));
  return [...out, ...list.map(userRow)];
}
// While typing only the list is drawn again, so the search box keeps its place and focus.
function drawUserList() { const box = h.ctx.$('wsUList'); if (box) box.replaceChildren(...userRows()); }
function userFilters() {
  const w = W(), c = h.ctx;
  const box = c.el('div', 'wfilters');
  const roles = [['', w.fAll], ...[...SITE_ROLES, 'admin'].map((r) => [r, roleName(r)])];
  box.append(h.select('wsURole', w.fRole, roles, uFilter.role, (v) => { uFilter.role = v; drawUserList(); }));
  const l = c.el('label', 'field');
  const i = document.createElement('input');
  i.id = 'wsUFind'; i.type = 'search'; i.maxLength = 60; i.autocomplete = 'off'; i.value = uFilter.find;
  i.addEventListener('input', () => { uFilter.find = i.value; drawUserList(); });
  l.append(c.el('span', null, w.fFind), i);
  box.append(l);
  return box;
}
// The role and its audit entry go in one batch; the rules refuse it without the entry, or for your own account.
async function saveRole(u) {
  const a = h.acct();
  const from = roleOf(u), to = uChoice[u.id] || from;
  const entry = a ? roleAuditFields(a.user.uid, u.id, from, to) : null;
  if (!entry || !online() || uSaving.has(u.id)) return;
  uSaving.add(u.id); const btn = h.ctx.$(`wsRoleSave-${u.id}`); if (btn) btn.disabled = true;
  try {
    await a.fb.setUserRole(u.id, entry, to);
    u.role = to; delete uChoice[u.id]; uMsg = { id: u.id, key: 'roleSaved' };
    audit = null;   // the log has a new entry: it is loaded again when it is opened
  } catch { uMsg = { id: u.id, key: 'roleErr' }; }
  uSaving.delete(u.id);
  h.render();
  h.ctx.$(`wsRoleSave-${u.id}`)?.focus({ preventScroll: true });
}
export function usersSection() {
  const list = h.ctx.el('div', 'wlist'); list.id = 'wsUList'; list.append(...userRows());
  return [userFilters(), h.card(W().nav.users, [list], h.reloadBtn('wsUReload', loadUsers, usersBusy))];
}

/* ---------- audit log (read only: the rules allow no edit and no delete) ---------- */
function metaText(e) {
  const m = e.meta && typeof e.meta === 'object' ? e.meta : {};
  const name = (v) => (e.action === 'ROLE_CHANGED' ? roleName(v) : (h.ctx.texts().report.statuses[v] || v));
  return m.from || m.to ? `${name(String(m.from || '—'))} → ${name(String(m.to || '—'))}` : '';
}
function auditRow(e) {
  const w = W(), c = h.ctx;
  const row = c.el('div', 'wrow');
  const ic = c.el('span', 'avatar'); ic.append(h.icon(e.action === 'ROLE_CHANGED' ? ADMIN_ICON.users : ADMIN_ICON.check));
  const txt = c.el('div');
  const about = e.entity === 'users' ? personName(e.entityId) : c.fill(w.aboutReport, { id: shortId(e.entityId) });
  txt.append(c.el('b', null, w.actions[e.action] || String(e.action || '')),
    c.el('small', null, [about, metaText(e)].filter(Boolean).join(' · ')),
    c.el('small', null, [c.fill(w.by, { who: personName(e.actorUid) }), e.at ? when(e.at) : ''].filter(Boolean).join(' · ')));
  row.append(ic, txt);
  return row;
}
function dateField(id, label, key) {
  const l = h.ctx.el('label', 'field');
  const i = document.createElement('input');
  i.id = id; i.type = 'date'; i.value = aFilter[key];
  i.addEventListener('change', () => { aFilter[key] = i.value; loadAudit(); });
  l.append(h.ctx.el('span', null, label), i);
  return l;
}
function auditFilters() {
  const w = W();
  const box = h.ctx.el('div', 'wfilters');
  const people = [...admins].map((id) => [id, personName(id)]);
  box.append(
    h.select('wsAType', w.fType, [['', w.fAll], ...AUDIT_ACTIONS.map((x) => [x, w.actions[x]])], aFilter.action, (v) => { aFilter.action = v; loadAudit(); }),
    h.select('wsAWho', w.fPerson, [['', w.fAll], ...people], aFilter.actor, (v) => { aFilter.actor = v; loadAudit(); }),
    dateField('wsAFrom', w.fFrom, 'from'), dateField('wsATo', w.fTo, 'to'));
  const out = [box];
  if (aMsg) { const m = h.ctx.el('p', 'err', w[aMsg]); m.id = 'wsAMsg'; m.setAttribute('role', 'alert'); out.push(m); }
  return out;
}
function auditRows() {
  const out = h.stateNotes(audit, auditBusy, auditErr, 'auditNet');
  if (!audit) return out;
  if (!audit.length) out.push(h.ctx.el('p', 'wempty', W().auditNone));
  return [...out, ...audit.map(auditRow)];
}
export function auditSection() {
  if (!audit && !auditBusy && !auditErr && !aMsg && online()) queueMicrotask(loadAudit);
  return [...auditFilters(), h.card(W().nav.audit, auditRows(), h.reloadBtn('wsAReload', loadAudit, auditBusy))];
}

/* ---------- life cycle ---------- */
export function initAdmin(helpers) { h = helpers; }
// The admin workspace opened (admins/{uid} exists): load what the cards and lists need.
export function openAdmin() { loadUsers(); loadAudit(); if (verify === undefined) loadVerify(); }
export function adminOnline() { if (!users) loadUsers(); if (!audit) loadAudit(); }
export function clearAdminMsg() { uMsg = null; }
// Sign-out: nothing of this account stays in memory.
export function resetAdmin() {
  users = null; usersErr = null; admins = new Set(); uFilter = { role: '', find: '' }; uChoice = {}; uMsg = null;
  audit = null; auditErr = null; aFilter = { action: '', actor: '', from: '', to: '' }; aMsg = null;
}
