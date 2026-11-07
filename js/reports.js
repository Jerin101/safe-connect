// Wrong-number reports (P18, issue #79). Rules: firestore.rules ("reports", "audit"), docs/SYSTEM_DESIGN.md §6.
// A report never changes a number on the site: an admin checks it against the official page, and a fix goes
// through tools/ and a pull request (CLAUDE.md rule 1).
// The top part has no browser code, so tests/rules/firestore.rules.test.mjs can check the exact documents.
export const PROBLEMS = ['off', 'other_person', 'changed', 'other'];
export const MISSING = 'missing_place';   // "জায়গাটা যোগ করতে বলুন" (#159)
export const STATUSES = ['open', 'review', 'fixed', 'same'];
export const REPORT_DISTRICTS = ['noakhali', 'coxsbazar'];
export const NOTE_MAX = 300;   // the rules allow 500; 300 keeps Bangla notes well inside it
const AREA_MAX = 80;
const ID_MAX = 120;

const cut = (s, n) => [...String(s || '').trim()].slice(0, n).join('');
// A Bangladeshi mobile number anywhere in a text: English or Bangla digits; spaces, dashes, dots, slashes or brackets
// between digits; with or without +88 / 88; not part of a longer digit string (years like "2019 2020", account numbers).
// Notes must not carry phone numbers (CLAUDE.md rule 5); firestore.rules noPhone() uses the same pattern (issue #123).
const PHONE_IN_TEXT = /(?<![0-9০-৯])(?:\+?[8৮][8৮][- \u00a0./()\u2013]*)?[0০][- \u00a0./()\u2013]*[1১][- \u00a0./()\u2013]*[3-9৩-৯](?:[- \u00a0./()\u2013]*[0-9০-৯]){8}(?![0-9০-৯])/u;
export const hasPhone = (text) => PHONE_IN_TEXT.test(String(text || ''));

// The new report, with exactly the fields firestore.rules allow (js/firebase.js adds createdAt and updatedAt).
// No name, phone number or address of the person: only who sent it (uid), which record, and what is wrong.
export function reportFields(uid, draft) {
  if (!uid || !draft || !PROBLEMS.includes(draft.problem) || !REPORT_DISTRICTS.includes(draft.district)) return null;
  const recordId = String(draft.recordId || '');
  if (!recordId || recordId.length > ID_MAX) return null;
  const d = { uid, recordId, district: draft.district, problem: draft.problem, status: 'open' };
  const area = cut(draft.area, AREA_MAX);
  if (area) d.area = area;
  const note = cut(draft.note, NOTE_MAX);
  if (hasPhone(note)) return null;
  if (note) d.note = note;
  return d;
}
// A request to add a place the search did not know (#159): the name the person typed, the upazila (an upazila_en
// from our data) and, if known, the union. No record and no phone number; same limits as every report.
export function missingFields(uid, draft) {
  if (!uid || !draft || !REPORT_DISTRICTS.includes(draft.district)) return null;
  const place = cut(draft.place, AREA_MAX), upazila = cut(draft.upazila, 60), union = cut(draft.union, AREA_MAX);
  if ([...place].length < 2 || [...upazila].length < 2 || hasPhone(place) || hasPhone(union)) return null;
  const d = { uid, recordId: 'missing-place', district: draft.district, problem: MISSING, status: 'open', place, upazila };
  if (union) d.union = union;
  return d;
}
// The audit entry that must be written in the same batch as an admin's status change (js/firebase.js adds "at").
export function auditFields(actorUid, reportId, from, to) {
  return { actorUid, action: 'REPORT_STATUS_CHANGED', entity: 'reports', entityId: reportId, meta: { from, to } };
}

/* ---------- the 3-step form (a dialog over the area page) ---------- */
const STEPS = 3;
let ctx = null;      // helpers from auth.js / preview.js
let draft = null;    // { recordId, district, area, record, place, problem, note, step, busy, err }
let opener = null;

const R = () => ctx.texts().report;
const $ = (id) => ctx.$(id);
const dlg = () => $('repDialog');

function button(text, cls, onClick, id) {
  const b = ctx.el('button', cls, text); b.type = 'button';
  if (id) b.id = id;
  b.addEventListener('click', onClick);
  return b;
}
function review(rows) {
  const dl = ctx.el('dl', 'review');
  for (const [k, v] of rows) { const d = ctx.el('div'); d.append(ctx.el('dt', null, k), ctx.el('dd', null, v)); dl.append(d); }
  return dl;
}
function stepper() {
  const r = R();
  const ol = $('repSteps');
  ol.setAttribute('aria-label', ctx.fill(r.stepOf, { n: ctx.digits(Math.min(draft.step, STEPS - 1) + 1) }));
  ol.replaceChildren(...r.steps.map((name, i) => {
    const done = i < draft.step;
    const li = ctx.el('li', `step${done ? ' done' : i === draft.step ? ' on' : ''}`);
    if (i === draft.step) li.setAttribute('aria-current', 'step');
    li.append(ctx.el('i', null, done ? '✓' : ctx.digits(i + 1)), ctx.el('span', null, name));
    return li;
  }));
}
function who() {
  const r = R(), rec = draft.record;
  const name = [rec.name_bn, rec.designation_bn].filter(Boolean).join(', ') || rec.office_bn || '—';
  const rows = [[r.kName, name]];
  if (rec.office_bn && rec.office_bn !== name) rows.push([r.kOffice, rec.office_bn]);
  rows.push([r.kArea, draft.areaLabel], [r.kNumbers, (rec.phones || []).map(ctx.digits).join(', ')]);
  return rows;
}
const actions = (...items) => { const d = ctx.el('div', 'wactions'); d.append(...items.filter(Boolean)); return d; };

function stepNumber() {
  const r = R();
  return [ctx.el('p', null, r.s1Text), review(who()), ctx.el('p', 'si-note', r.noChange),
    actions(button(r.next, 'btn violet', () => go(1), 'repNext'))];
}
function stepProblem() {
  const r = R();
  const set = ctx.el('fieldset', 'choices');
  set.append(ctx.el('legend', null, r.kProblem));
  for (const key of PROBLEMS) {
    const l = ctx.el('label', 'choice');
    const i = document.createElement('input');
    i.type = 'radio'; i.name = 'repProblem'; i.value = key; i.checked = draft.problem === key;
    i.addEventListener('change', () => { draft.problem = key; draft.err = null; $('repErr').hidden = true; });
    l.append(i, ctx.el('span', null, r.problems[key]));
    set.append(l);
  }
  const err = ctx.el('p', 'err', draft.err ? r[draft.err] : ''); err.id = 'repErr'; err.hidden = !draft.err; err.setAttribute('role', 'alert');
  const field = ctx.el('label', 'field');
  const ta = document.createElement('textarea');
  ta.id = 'repNote'; ta.rows = 3; ta.maxLength = NOTE_MAX; ta.value = draft.note; ta.placeholder = r.notePh;
  ta.setAttribute('aria-describedby', draft.err === 'notePhone' ? 'repNoteHint repErr' : 'repNoteHint');
  ta.addEventListener('input', () => { draft.note = ta.value; });
  const hint = ctx.el('small', null, ctx.fill(r.noteHint, { n: ctx.digits(NOTE_MAX) })); hint.id = 'repNoteHint';
  field.append(ctx.el('span', null, r.noteLabel), ta, hint);
  return [set, err, field, actions(button(r.back, 'btn', () => go(0)), button(r.next, 'btn violet', () => go(2), 'repNext'))];
}
function stepCheck() {
  const r = R(), online = navigator.onLine;
  const note = cut(draft.note, NOTE_MAX);
  const out = [review([...who(), [r.kProblem, r.problems[draft.problem]], [r.kNote, note || r.noNote], [r.kNextStep, r.noChange]])];
  if (!online) { const m = ctx.el('p', 'offline-note', r.offline); m.setAttribute('role', 'status'); out.push(m); }
  else if (!ctx.knownUser()) out.push(ctx.el('p', 'si-note', r.signNeeded));
  if (draft.err) { const m = ctx.el('p', 'err', r[draft.err]); m.setAttribute('role', 'alert'); out.push(m); }
  // Email not verified yet (issue #117): a button sends the verification email again.
  if (draft.err === 'verify' && draft.fb) {
    out.push(button(r.resend, 'btn', resend, 'repResend'));
    const st = ctx.el('p', 'si-note', draft.resent === true ? r.resent : draft.resent === false ? r.err : '');
    st.setAttribute('role', 'status'); out.push(st);
  }
  const send = button(draft.busy ? ctx.texts().auth.wait : r.send, 'btn violet', trySend, 'repSend');
  send.disabled = !online || draft.busy;
  out.push(actions(button(r.back, 'btn', () => go(1)), send));
  return out;
}
function stepSent() {
  const r = R();
  const box = ctx.el('div', 'success');
  box.append(ctx.el('span', 'big', '✓'), ctx.el('h2', null, r.sentTitle), ctx.el('p', null, r.sentText));
  box.append(actions(button(r.toMine, 'btn violet', toMine, 'repMine'), button(r.close, 'btn', () => close())));
  return [box];
}

function render() {
  if (!draft) return;
  const r = R(), u = ctx.texts().ui;
  $('rep999Text').textContent = u.h999;
  $('repClose').setAttribute('aria-label', r.close);
  $('repEyebrow').textContent = r.eyebrow;
  $('repTitle').textContent = draft.step === STEPS ? r.sentTitle : r.title;
  $('repLead').textContent = r.lead;
  $('repLead').hidden = draft.step === STEPS;
  $('repSteps').hidden = draft.step === STEPS;
  if (draft.step < STEPS) stepper();
  const keep = document.activeElement && dlg().contains(document.activeElement) ? document.activeElement.id : '';
  $('repStep').replaceChildren(...[stepNumber, stepProblem, stepCheck, stepSent][draft.step]());
  if (keep && $(keep)) $(keep).focus({ preventScroll: true });
}
function go(step) {
  if (step === 2 && !PROBLEMS.includes(draft.problem)) { draft.err = 'pick'; render(); dlg().querySelector('input[name="repProblem"]')?.focus(); return; }
  if (step === 2 && hasPhone(draft.note)) { draft.err = 'notePhone'; render(); $('repNote')?.focus(); return; }   // issue #123
  draft.step = step; draft.err = null;
  render();
  $('repTitle').focus({ preventScroll: true });
  dlg().scrollTo?.({ top: 0 });
}

// "Send": sign-in is needed (the rules refuse a report without it). Signed out: the calm sign-in modal from #73;
// Firebase loads only now, after this tap. After signing in, the report is sent at once (the person already tapped Send).
function trySend() {
  if (!draft || draft.busy || !navigator.onLine) { render(); return; }
  draft.busy = true; draft.err = null; render();
  ctx.withUser($('repSend'), send, () => { if (draft) { draft.busy = false; render(); } });
}
async function send({ fb, user }) {
  if (!draft) return;
  const fields = reportFields(user.uid, draft);
  if (!fields) { draft.busy = false; draft.err = 'err'; render(); return; }
  try {
    // Reports need a verified email (Google sign-in is verified); limits: 10 per UTC day, one per minute (issue #117).
    if (!(await fb.isVerified())) { draft.busy = false; draft.err = 'verify'; draft.fb = fb; render(); return; }
    await fb.sendReport(fields);
    draft.busy = false; draft.step = STEPS;
    ctx.reportSent();
    render();
    $('repTitle').focus({ preventScroll: true });
  } catch (e) {
    if (!draft) return;
    draft.busy = false;
    draft.err = e && e.code === 'limit-wait' ? 'limitWait' : e && e.code === 'limit-day' ? 'limitDay' : 'err';
    render();
  }
}
async function resend() {
  if (!draft || !draft.fb) return;
  try { await draft.fb.resendVerify(); draft.resent = true; } catch { draft.resent = false; }   // keep the verify instructions
  render();
  $('repResend')?.focus();
}
function toMine() { close(false); ctx.openMine(); }

function close(returnFocus = true) {
  if (!returnFocus) opener = null;
  if (dlg().open) dlg().close();
}
function onClosed() {
  draft = null;
  document.body.classList.remove('modal-open');
  const o = opener; opener = null;
  if (o && o.isConnected && !o.closest('[hidden]')) o.focus();
}

export function initReports(helpers) {
  ctx = helpers;
  $('repClose').addEventListener('click', () => close());
  dlg().addEventListener('close', onClosed);
  dlg().addEventListener('click', (e) => { if (e.target === dlg()) close(); });
  // The sign-in modal opens over this one; when it closes, this one is still open and keeps the page still.
  $('signin').addEventListener('close', () => { if (dlg().open) document.body.classList.add('modal-open'); });
  window.addEventListener('hashchange', () => close(false));
  const onNet = () => { if (dlg().open) render(); };
  window.addEventListener('online', onNet);
  window.addEventListener('offline', onNet);
  return {
    // record: a contact from data/ (never typed by the person); district: its district key;
    // area: the Bangla area name that is saved; areaLabel: the name shown in the form.
    open(record, { district, area, areaLabel }, from) {
      if (!record || !record.id || !REPORT_DISTRICTS.includes(district)) return;
      opener = from || document.activeElement;
      draft = { recordId: record.id, district, area, areaLabel, record, problem: null, note: '', step: 0, busy: false, err: null };
      render();
      if (!dlg().open) dlg().showModal();
      document.body.classList.add('modal-open');
      $('repTitle').focus();
    },
    setText() { if (dlg().open) render(); },
    // "জায়গাটা যোগ করতে বলুন" (#159): sign in if needed (Firebase loads only after this tap), then one request with the
    // same limits as reports. done(code): 'sent' | 'verify' | 'limitWait' | 'limitDay' | 'invalid' | 'err' | 'cancel'.
    askPlace(draft, from, done) {
      if (!navigator.onLine) { done('offline'); return; }
      ctx.withUser(from, async ({ fb, user }) => {
        const fields = missingFields(user.uid, draft);
        if (!fields) { done('invalid'); return; }
        try {
          if (!(await fb.isVerified())) { done('verify'); return; }
          await fb.sendReport(fields);
          ctx.reportSent();
          done('sent');
        } catch (e) { done(e && e.code === 'limit-wait' ? 'limitWait' : e && e.code === 'limit-day' ? 'limitDay' : 'err'); }
      }, () => done('cancel'));
    },
  };
}
