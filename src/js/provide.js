// সেবা দিন (R4 of plan v4, #267): the provider's page on the real site, and, for an admin, approvals and rates.
// An approved provider (driver, repair person, volunteer, delivery rider) sees open calls of their service in their
// district, accepts one, sends a live position only while the job is live (the rider sees it on the map), and ends it
// with a bill worked out from the admin's rates (firestore.rules check the same arithmetic). Being "online" stores no
// position at all: riders only see how many providers work in the district. Built with createElement + textContent.
import { icon } from './icons.js';
import { createLiveMap, roadRoute } from './routemap.js';
import { createCallAlert } from './driveralert.js';

const TYPE_IC = { ambulance: 'amb', cng: 'car', bike: 'bike', technician: 'wrench', help: 'hands', errand: 'basket', pickup: 'bag', towing: 'car' };
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const toInt = (s) => Number(String(s).trim().replace(/[০-৯]/g, (x) => '০১২৩৪৫৬৭৮৯'.indexOf(x)));

export function initProvide(ctx) {
  const { el, store } = ctx;
  const T = () => ctx.texts();
  const D = () => ctx.dakunTexts();
  const num = (s) => ctx.digits(s);
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (all, k) => (k in v ? v[k] : all));
  let RM = null, HP = null, FBM = null;
  let view = null, here = null, user = null, prov, isAdm = false, pend = null, rates = null;
  let ovUnsub = null, allRides = [], ovMap = null, reqMap = null;
  let reqs = [], reqUnsub = null, myJobs = null, online = false, onlineTimer = null;
  const alerts = createCallAlert();                     // new-call sound / vibration / message while online and the page is open (#365)
  let alertNote = '';                                   // what the browser allowed after "go online": shown under the button
  let privOk = null, privDraft = null;                  // does this applicant already have NID + family details saved? (#365)
  let job = null, jobUnsub = null, liveUnsub = null, other = null, mine = null, geoId = null, lastSent = null, track = null, itemsDraft = '';

  const tk = (n) => fill(D().taka, { n: num(n) });
  const dist = (m) => (m < 1000 ? `${num(Math.round(m / 10) * 10)} ${D().metres}` : `${num((m / 1000).toFixed(1))} ${D().km}`);
  const name = (t) => D().names[t] || t;
  const btn = (cls, text, ic, onClick) => {
    const b = el('button', cls, text); b.type = 'button';
    if (ic) b.prepend(icon(ic, { size: 'sm' }));
    if (onClick) b.addEventListener('click', onClick);
    return b;
  };
  const card = (...kids) => { const c = el('section', 'card'); c.append(...kids.filter(Boolean)); return c; };
  const pills = (...kids) => { const p = el('div', 'pills'); p.append(...kids.filter(Boolean)); return p; };
  const note = (text, ic = 'info') => { const n = el('div', 'note dk-note'); n.append(icon(ic, { size: 'sm' }), el('p', null, text)); return n; };
  const msgBox = () => { const m = el('div', 'small dk-msg'); m.setAttribute('role', 'status'); return m; };
  const errText = (e) => (e && D().err[e.code]) || (navigator.onLine ? D().err.generic : D().err.unavailable);
  const say = (text) => { const m = view?.querySelector('.dk-msg'); if (m) m.textContent = text; else ctx.toast(text); };
  async function load() {
    if (!FBM) FBM = await Promise.all([import('./firebase.js'), import('./community.js')]);
    if (!RM) { RM = await import('./ride.js'); HP = (await import('./reports.js')).hasPhone; }
    return FBM;
  }
  function field(id, label, value, { ph = '', max = 60, tel = false } = {}) {
    const l = el('label', null, label); l.htmlFor = id;
    const i = el('input'); i.id = id; i.maxLength = max; i.value = value || ''; i.placeholder = ph; i.type = tel ? 'tel' : 'text'; if (tel) i.inputMode = 'numeric';
    return [l, i];
  }
  const val = (id) => view.querySelector(`#${id}`)?.value || '';

  /* ---------- the page ---------- */
  async function show(v) {
    view = v;
    v.replaceChildren(el('div', 'skeleton'));
    try {
      const [fb] = await load();
      user = await fb.currentUser();
      here = await ctx.near.here();   // also loads the district list
      if (!view.isConnected) return;
      const h = el('h1', 'page-title', T().title); h.id = 'provideTitle'; h.tabIndex = -1;
      const head = card(el('p', 'eyebrow', T().eyebrow), h, el('p', 'muted', T().intro));
      if (!user) {
        const b = btn('btn solid', T().signInDriver, 'user', (e) => ctx.signIn(e.currentTarget));
        v.replaceChildren(head, card(note(T().whySignIn), b));
        return;
      }
      if (!(await fb.isVerified())) { v.replaceChildren(head, card(note(D().err.unverified))); return; }
      prov = await fb.myProvider();
      if (prov && !prov.approved && !prov.rejected) privOk = await fb.hasProviderPrivate(); else privOk = null;
      if (!rates) { try { rates = await fb.readRates(prov?.district); } catch { rates = {}; } }
      isAdm = (await fb.roleOf(user, ctx.lang())) === 'admin';
      if (isAdm && !ovUnsub) ovUnsub = fb.watchAllRides((l) => { allRides = l; paintOverview(); }, () => {});
      if (isAdm) { try { pend = await fb.pendingProviders(); } catch { pend = []; } try { rateTable = await fb.readRateTable(); } catch { rateTable = []; } }
      if (prov?.approved) {
        if (!reqUnsub) reqUnsub = fb.watchRequests(prov, (list) => { reqs = list; alerts.check(list, { title: T().newCallTitle, body: (r) => fill(T().newCallBody, { s: name(r.type), p: r.pickup.label }) }); paintReqs(); }, (e) => { const b = view?.querySelector('.pv-reqs'); if (b) b.replaceChildren(el('p', 'note', errText(e))); });
        myJobs = await fb.myRides('provider');
        const act = myJobs.find((r) => ['accepted', 'arrived', 'on_trip', 'completed'].includes(r.status));
        if (act && (!job || job.id !== act.id)) { job = act; follow(act.id); }
      }
      paint(head);
    } catch (e) { v.replaceChildren(card(el('p', 'note', errText(e)))); }
  }
  function paint(head) {
    if (!view?.isConnected) return;
    destroyJobMap(); destroyOvMap(); destroyReqMap();
    head = head || view.querySelector('section.card');
    const parts = [head];
    if (prov === null) parts.push(applyCard());
    else if (prov && !prov.approved && prov.rejected) parts.push(card(el('h2', null, T().rejectedTitle), el('p', 'muted', `${prov.name} · ${name(prov.type)} · ${prov.vehicle}`),
      el('p', 'muted', T().rejectedText), pills(btn('btn solid', T().withdraw, null, () => act('withdraw'))), msgBox()));
    else if (prov && !prov.approved) parts.push(card(el('h2', null, T().pendingTitle), el('p', 'muted', `${prov.name} · ${name(prov.type)} · ${prov.vehicle}`),
      el('p', 'muted', T().pendingText), ...(privOk === false ? [note(T().privMissing, 'shield'), ...privForm(), pills(btn('btn solid', T().privSave, null, () => act('savepriv')))] : []),
      pills(btn('btn solid', T().checkAgain, null, () => show(view)), btn('btn ghost', T().withdraw, null, () => act('withdraw'))), msgBox()));
    else if (prov) {
      const status = card();
      const sh = el('div', 'sec-head'); sh.append(el('h2', null, prov.name), el('span', 'badge b-ok', T().approved));
      status.append(sh, el('p', 'muted', `${name(prov.type)} · ${prov.vehicle} · ${prov.district}`),
        pills(btn(online ? 'btn' : 'btn solid', online ? T().goOffline : T().goOnline, null, () => act('online'))),
        el('p', 'small', online ? T().onlineNote : T().offlineNote), online ? el('p', 'small pv-alertnote', `${alertNote || T().alertScreenOnly} ${T().alertLimit}`) : null);
      parts.push(status);
      if (job && ['accepted', 'arrived', 'on_trip', 'completed'].includes(job.status)) {
        const jp = el('div', 'pv-job'); jp.append(...jobPanel());
        if (job.status !== 'completed') { const mb = el('div', 'near-map pv-map'); mb.setAttribute('role', 'region'); mb.setAttribute('aria-label', T().route); jp.append(mb); setTimeout(() => mountJobMap(mb), 0); }
        parts.push(card(el('p', 'eyebrow', T().nowJob), jp));
      } else {
        const rb = el('div', 'pv-reqs'), rm = el('div', 'near-map pv-map rq-map'); rm.hidden = true; rm.setAttribute('role', 'region'); rm.setAttribute('aria-label', T().callsMap);
        parts.push(card(el('h2', null, T().newCalls), rm, rb, msgBox()));
      }
      parts.push(card(el('h2', null, T().earnings), earnBox()));
    }
    if (isAdm) parts.splice(1, 0, ...adminCards());   // admins see the approvals first, right under the title
    view.replaceChildren(...parts);
    paintReqs(); paintOverview();
    const ob = view.querySelector('.ov-map'), rb2 = view.querySelector('.rq-map');
    if (ob) setTimeout(() => mountMap(ob, (m) => { ovMap = m; paintOverview(); }), 0);
    if (rb2) setTimeout(() => mountMap(rb2, (m) => { reqMap = m; paintReqs(); }), 0);
  }

  /* ---------- NID and family details, for the admin who approves (#365) ---------- */
  const latin = (x) => String(x).trim().replace(/[০-৯]/g, (c) => '০১২৩৪৫৬৭৮৯'.indexOf(c)).replace(/[\s-]/g, '');
  const RELATIONS = ['father', 'mother', 'spouse', 'brother', 'sister', 'son', 'daughter', 'other'];
  // -> { data } or { error: text }. The same checks as firestore.rules, so a wrong entry is explained before it is sent.
  function readPriv() {
    const nid = latin(val('pvNid')), phone = latin(val('pvFamPhone')), famName = val('pvFamName').trim(), rel = val('pvFamRel') || 'other';
    if (!/^([0-9]{10}|[0-9]{13}|[0-9]{17})$/.test(nid)) return { error: T().nidBad };
    if (famName.length < 2 || HP(famName)) return { error: T().famNameBad };
    if (!RELATIONS.includes(rel)) return { error: T().famNameBad };
    if (!/^01[3-9][0-9]{8}$/.test(phone)) return { error: T().famPhoneBad };
    if (!view.querySelector('#pvConsent')?.checked) return { error: T().consentNeed };
    return { data: { nid, familyName: famName, familyRelation: rel, familyPhone: phone } };
  }
  function privForm() {
    const rel = el('select'); rel.id = 'pvFamRel';
    for (const r of RELATIONS) { const o = el('option', null, T().relations[r]); o.value = r; rel.append(o); }
    const rl = el('label', null, T().famRel); rl.htmlFor = 'pvFamRel';
    const nid = field('pvNid', T().nidLabel, '', { ph: T().nidPh, max: 20, tel: true });
    const ph = field('pvFamPhone', T().famPhone, '', { ph: '01XXXXXXXXX', max: 14, tel: true });
    const cb = el('input'); cb.type = 'checkbox'; cb.id = 'pvConsent';
    const cl = el('label', 'check'); cl.htmlFor = 'pvConsent'; cl.append(cb, ' ', T().consentLabel);
    return [el('h3', null, T().privTitle), note(T().privIntro, 'shield'), ...nid, ...field('pvFamName', T().famName, '', { max: 60 }), rl, rel, ...ph, cl];
  }

  /* ---------- apply ---------- */
  function applyCard() {
    const sel = el('select'); sel.id = 'pvType';
    for (const x of RM.RIDE_TYPES) { const o = el('option', null, name(x.id)); o.value = x.id; sel.append(o); }
    const l = el('label', null, T().serviceType); l.htmlFor = 'pvType';
    const district = here ? here.label : T().noArea;
    return card(el('h2', null, T().applyTitle), el('p', 'muted', fill(T().applyText, { area: district })), l, sel,
      ...field('pvName', T().yourName, '', { ph: T().namePh }), ...field('pvVeh', T().vehicle, '', { ph: T().vehiclePh, max: 40 }),
      ...privForm(), pills(btn('btn solid', T().apply, null, () => act('apply'))), msgBox());
  }

  /* ---------- open calls ---------- */
  function paintReqs() {
    const box = view?.querySelector('.pv-reqs'); if (!box) return;
    const from = mine || (here ? { lat: here.lat, lon: here.lon } : null);
    const mapEl = view?.querySelector('.rq-map'); if (mapEl) mapEl.hidden = !reqs.length;
    if (!reqs.length) { box.replaceChildren(el('p', 'muted', T().noCalls)); return; }
    const sorted = from ? [...reqs].sort((x, y) => RM.metres(from, x.pickup) - RM.metres(from, y.pickup)) : reqs;   // nearest first
    if (reqMap) reqMap.update({ you: from, pins: sorted.map((r) => ({ lat: r.pickup.lat, lon: r.pickup.lon, label: r.pickup.label })), labels: { you: T().meLabel } });
    const rows = el('div', 'rows');
    for (const r of sorted) {
      const row = el('div', 'r near-row'); const sq = el('span', 'cat-ic sm'); sq.append(icon(TYPE_IC[r.type] || 'car'));
      const b = el('div');
      b.append(el('div', 't', `${r.pickup.label}${r.drop ? ' → ' + r.drop.label : ''}`),
        el('div', 'm', [from ? fill(T().away, { d: dist(RM.metres(from, r.pickup)) }) : '', r.drop ? dist(r.estM) : '', r.type === 'help' ? D().free : `${D().estShort} ${tk(r.estFare)}`].filter(Boolean).join(' · ')));
      if (r.items) b.append(el('div', 'm', `${r.items} · ${r.type === 'errand' ? fill(D().maxLine, { t: tk(r.maxItems || 0) }) : D().itemsPaid}`));
      b.append(presenceLine(r));
      const acts = el('div', 'acts'); acts.append(btn('btn solid', T().accept, null, () => act('accept', r)));
      row.append(sq, b, acts); rows.append(row);
    }
    box.replaceChildren(rows);
  }

  // Is the person who asked still on their page? From what their phone reported (riderSeenAt), never a guess (#365).
  function presenceLine(r) {
    const pr = RM.riderPresence(r.riderSeenAt);
    const text = pr.state === 'online' ? T().riderOnline : pr.state === 'recent' ? fill(T().riderRecent, { m: num(pr.minutes) })
      : pr.state === 'away' ? fill(T().riderGone, { m: num(pr.minutes) }) : T().riderUnknown;
    return el('div', `small pv-presence pv-${pr.state}`, text);
  }

  /* ---------- the job ---------- */
  // Directions inside the site: the live map above shows both of you; this draws the road to the goal (asked for on tap only)
  const goalOf = (r) => (r.status === 'on_trip' && r.drop ? r.drop : r.pickup);
  function navLink(r) {
    const b = btn('btn', T().route, 'nav', async () => {
      const from = mine || here; if (!from || !liveMap) return;
      const goal = (r.status !== 'on_trip' && other) || goalOf(r);
      b.disabled = true; const route = await roadRoute(from, goal); b.disabled = false;
      if (!route) { say(T().routeFail); return; }
      liveMap.showRoad(route);
      const d = view?.querySelector('.pv-dist'); if (d) d.textContent = `${dist(route.metres)} · ~${num(Math.max(1, Math.round(route.secs / 60)))} ${D().min || ''}`.trim();
    });
    return b;
  }
  // the live map: you (blue), the customer's live point (green line), the pickup pin; it moves as the positions arrive
  let liveMap = null;
  function destroyJobMap() { if (liveMap) { liveMap.destroy(); liveMap = null; } }
  function paintJobMap() {
    if (!liveMap || !job) return;
    const goal = goalOf(job), toRider = job.status !== 'on_trip' && other;
    liveMap.update({ you: mine, goal: toRider ? other : goal, other: toRider ? goal : null,
      labels: { you: T().meLabel, goal: toRider ? T().riderNow : (goal.label || ''), other: goal.label || '' } });
  }
  async function mountJobMap(box) {
    if (!navigator.onLine) { box.replaceChildren(el('p', 'note', T().mapOff)); return; }
    let L; try { L = await ctx.near.loadLeaflet(); } catch { box.replaceChildren(el('p', 'note', T().mapOff)); return; }
    if (!box.isConnected) return;
    destroyJobMap(); liveMap = createLiveMap(L, box, { el }); paintJobMap();
  }
  function jobPanel() {
    const r = job, t = RM.typeOf(r.type);
    const where = el('p', 'muted', `${r.pickup.label}${r.drop ? ` → ${r.drop.label} (${dist(r.estM)})` : ''}`);
    const far = el('p', 'small pv-dist', jobDist());
    const cancel = btn('btn ghost', D().cancel, null, () => act('cancel'));
    const out = [stepper(r.status)];
    const list = r.items ? (() => { const b = el('div', 'okbox'); b.append(icon(TYPE_IC[r.type], { size: 'sm' }), ` ${r.items}`, el('br'),
      el('span', 'small', t.errand ? fill(T().errandLimit, { t: tk(r.maxItems || 0) }) : T().pickupPaid)); return b; })() : null;
    if (t.shop && ['accepted', 'arrived', 'on_trip'].includes(r.status)) {
      if (r.status === 'accepted') out.push(el('h2', null, T().toShop), where, list, far, pills(btn('btn solid', T().atShop, null, () => act('arrived')), navLink(r), cancel));
      else if (r.status === 'arrived') out.push(el('h2', null, t.errand ? T().buy : T().collect), list, t.errand ? el('p', 'small', T().takeReceipt) : null,
        pills(btn('btn solid', t.errand ? T().boughtGo : T().collectedGo, null, () => act('start')), cancel));
      else {
        const cost = t.errand ? field('pvCost', T().receiptAmount, itemsDraft, { ph: T().receiptPh, max: 5, tel: true }) : [];
        cost[1]?.addEventListener('input', (e) => { itemsDraft = e.target.value; });
        out.push(el('h2', null, T().deliver), where, list, far, ...cost, pills(btn('btn solid', T().deliveredBill, null, () => act('end')), navLink(r)));
      }
    } else if (r.status === 'accepted') out.push(el('h2', null, T().toRider), where, far, pills(btn('btn solid', T().arrived, null, () => act('arrived')), navLink(r), cancel));
    else if (r.status === 'arrived') out.push(el('h2', null, T().waitRider), where, el('p', 'small', fill(T().waitNote, { t: tk(rates?.[r.type]?.perMin || 0) })),
      pills(btn('btn solid', t.dest ? T().startTrip : T().startWork, null, () => act('start')), cancel));
    else if (r.status === 'on_trip') out.push(el('h2', null, t.dest ? D().onTrip : D().working), where, far,
      pills(btn('btn solid', t.dest ? T().endTrip : T().endWork, null, () => act('end')), t.dest ? navLink(r) : null));
    else if (r.status === 'completed') out.push(el('h2', null, fill(T().takeCash, { t: tk(RM.billTotal(r)) })), ...billBox(r),
      'billOk' in r ? el('p', 'small', `${T().riderSaid}: ${r.billOk ? D().billOk : D().billWrong}`) : null,
      pills(btn('btn solid', T().gotMoney, 'check', () => act('paid'))));
    out.push(msgBox());
    return out.filter(Boolean);
  }
  function jobDist() {
    if (!job) return '';
    if (job.status === 'on_trip' && track) return fill(T().sofar, { d: dist(track.m) });
    if (job.status === 'accepted' && mine) return fill(T().riderAway, { d: dist(RM.metres(mine, other || job.pickup)) });
    return '';
  }
  function stepper(st) {
    const steps = ['requested', 'accepted', 'arrived', 'on_trip', 'completed', 'paid'], k = steps.indexOf(st);
    const ol = el('ol', 'dk-steps'); ol.setAttribute('aria-label', D().stepsLabel);
    steps.forEach((x, i) => ol.append(el('li', i < k ? 'done' : i === k ? 'now' : '', D().steps[x])));
    return ol;
  }
  function billBox(r) {
    const rt = rates?.[r.type]; if (!rt) return [];
    const p = RM.fareParts(rt, r.distM || 0, r.waitMin || 0);
    const bill = el('div', 'bill');
    const row = (a, b, cls) => { const d = el('div', cls); d.append(el('span', null, a), el('b', null, b)); bill.append(d); };
    if (r.type === 'errand') row(fill(D().itemsRow, { t: tk(r.maxItems || 0) }), tk(r.itemsCost || 0));
    row(D().start, tk(p.base));
    row(fill(D().distRow, { km: num(p.km.toFixed(1)), per: tk(rt.perKm) }), tk(p.distance));
    row(fill(D().waitRow, { n: num(r.waitMin || 0) }), tk(p.waiting));
    row(D().total, tk(RM.billTotal(r)), 'total');
    return [bill];
  }
  function earnBox() {
    if (!myJobs) return el('div', 'skeleton');
    const paid = myJobs.filter((r) => r.status === 'paid'), day = new Date(); day.setHours(0, 0, 0, 0);
    const today = paid.filter((r) => (r.paidAt || 0) >= day.getTime());
    const sum = (l) => l.reduce((s, r) => s + (r.fare || 0), 0);
    const b = el('div', 'bill');
    const row = (a, x) => { const d = el('div'); d.append(el('span', null, a), el('b', null, x)); b.append(d); };
    row(fill(T().today, { n: num(today.length) }), tk(sum(today)));
    row(fill(T().allTime, { n: num(paid.length) }), tk(sum(paid)));
    return b;
  }

  /* ---------- following the job: the ride, the rider's live point, our own GPS ---------- */
  async function follow(id) {
    const [fb] = await load();
    stopJob(false);
    jobUnsub = fb.watchRide(id, async (r) => {
      const was = job ? job.status : null; job = r;
      if (!r) { stopJob(); paint(); return; }
      const live = RM.LIVE.includes(r.status);
      if (live && !liveUnsub) liveUnsub = fb.watchLive(r.id, 'rider', (p) => { other = p; const d = view?.querySelector('.pv-dist'); if (d) d.textContent = jobDist(); paintJobMap(); }, () => {});
      if (live) startGeo(); else stopGeo();
      if (['completed', 'paid', 'cancelled'].includes(r.status) && was && RM.LIVE.includes(was)) fb.clearLive(r.id).catch(() => {});
      if (r.status === 'cancelled') {
        ctx.toast(r.cancelledBy === 'rider' ? fill(T().riderCancelled, { f: r.cancelFee ? tk(r.cancelFee) : '' }) : r.cancelledBy === 'stale' ? T().staleClosed : D().cancelled);
        stopJob(); try { myJobs = await fb.myRides('provider'); } catch { /* keep the old list */ }
      }
      if (r.status === 'paid') { stopJob(); try { myJobs = await fb.myRides('provider'); } catch { /* keep */ } }
      if (!was || was !== r.status) paint();
    }, (e) => say(errText(e)));
  }
  function stopGeo() { if (geoId != null) navigator.geolocation.clearWatch(geoId); geoId = null; }
  function stopJob(clear = true) {
    stopGeo(); destroyJobMap(); if (jobUnsub) jobUnsub(); if (liveUnsub) liveUnsub(); jobUnsub = liveUnsub = null; other = null; lastSent = null;
    if (clear) { job = null; track = null; }
  }
  function startGeo() {
    if (geoId != null || !navigator.geolocation) return;
    geoId = navigator.geolocation.watchPosition((p) => gotPos(r5(p.coords.latitude), r5(p.coords.longitude)),
      () => say(T().gpsLost), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  async function gotPos(lat, lon) {
    if (!job || !RM.inBangladesh(lat, lon)) return;
    const p = { lat, lon, at: Date.now() }; mine = p;
    if (job.status === 'on_trip') track = RM.trackAdd(track, p);
    const due = !lastSent || (p.at - lastSent.at >= 8000 && RM.metres(lastSent, p) >= 25) || p.at - lastSent.at >= 60000;
    if (due) { lastSent = p; try { const [fb] = await load(); await fb.sendLive(job.id, 'provider', lat, lon); } catch { /* the next point tries again */ } }
    const d = view?.querySelector('.pv-dist'); if (d) d.textContent = jobDist();
    paintJobMap();
  }
  function keepOnline() {
    clearInterval(onlineTimer); onlineTimer = null;
    if (online && prov) onlineTimer = setInterval(() => { load().then(([fb]) => fb.goOnline(prov)).catch(() => {}); }, 10 * 60000);
  }
  addEventListener('pagehide', () => { if (online) load().then(([fb]) => fb.goOffline()).catch(() => {}); });

  /* ---------- actions ---------- */
  async function act(what, arg) {
    try {
      const [fb, cm] = await load();
      if (what === 'apply') {
        const nm = val('pvName').trim(), veh = val('pvVeh').trim(), type = val('pvType');
        if (!here) return say(T().noArea);
        if (nm.length < 2 || veh.length < 2) return say(T().needNameVehicle);
        if (HP(nm) || HP(veh)) return say(D().check.noPhone);
        const pv = readPriv(); if (pv.error) return say(pv.error);
        await fb.applyProvider({ name: nm, type, vehicle: veh, district: cm.districtKey(here.district) });
        try { await fb.saveProviderPrivate(pv.data); } catch { ctx.toast(T().applied); privOk = false; return show(view); }   // the pending card asks again
        ctx.toast(T().applied); privOk = true; return show(view);
      }
      if (what === 'savepriv') { const pv = readPriv(); if (pv.error) return say(pv.error); await fb.saveProviderPrivate(pv.data); privOk = true; ctx.toast(T().privSaved); return show(view); }
      if (what === 'withdraw') { await fb.withdrawProvider(); prov = null; privOk = null; return paint(); }
      if (what === 'online') {
        if (online) { await fb.goOffline(); online = false; alerts.disarm(); alertNote = ''; keepOnline(); return paint(); }
        await fb.goOnline(prov); online = true; ctx.toast(T().nowOnline); keepOnline();
        const st = await alerts.arm();                        // this tap lets the browser play sound and ask about notifications
        alertNote = st.notifications && st.sound ? T().alertFull : st.sound ? T().alertSoundOnly : T().alertScreenOnly;
        return paint();
      }
      if (what === 'accept') {
        try { await fb.acceptRide(arg.id, prov); } catch (e) { if (e.code === 'permission-denied') throw { code: 'taken' }; throw e; }
        ctx.toast(T().accepted);
        job = { ...arg, status: 'accepted' }; follow(arg.id); return paint();
      }
      if (what === 'arrived') { await fb.arrived(job.id); return; }
      if (what === 'start') { track = null; await fb.startTrip(job.id); return; }
      if (what === 'end') {
        const r = job, tp = RM.typeOf(r.type), rt = rates[r.type];
        const max = (r.estM || 0) * 3 + 5000;
        const distM = tp.dest ? Math.min(max, Math.round(track && track.m > 50 ? track.m : r.estM || 0)) : 0;
        const waitMin = r.arrivedAt && r.startedAt ? Math.max(0, Math.floor((r.startedAt - r.arrivedAt) / 60000)) : 0;
        let itemsCost;
        if (tp.errand) {
          const raw = val('pvCost') || itemsDraft; itemsCost = toInt(raw);
          if (!String(raw).trim() || !Number.isInteger(itemsCost) || itemsCost < 0) return say(T().needReceipt);
          if (itemsCost > r.maxItems) return say(fill(T().overLimit, { t: tk(r.maxItems) }));
        }
        await fb.completeRide(r.id, { distM, waitMin, fare: RM.fare(rt, distM, waitMin), itemsCost }); itemsDraft = ''; return;
      }
      if (what === 'paid') { await fb.markPaid(job.id); ctx.toast(T().paidDone); return; }
      if (what === 'cancel') { await fb.cancelRide(job.id, 'provider', 0); await fb.clearLive(job.id); stopJob(); ctx.toast(D().cancelled); return paint(); }
      if (what === 'approve') {
        if (!view.querySelector(`#chk-${arg}`)?.checked) return say(T().needChecked);
        await fb.approveProvider(arg, true); pend = await fb.pendingProviders(); ctx.toast(T().approvedDone); if (arg === user?.uid) return show(view); return paint();
      }
      if (what === 'reject') { await fb.rejectProvider(arg); pend = await fb.pendingProviders(); ctx.toast(T().rejectedDone); return paint(); }
      if (what === 'clean') { const n = await fb.cleanExpiredShares(); ctx.toast(fill(T().cleaned, { n: num(n) })); say(fill(T().cleaned, { n: num(n) })); return; }
      if (what === 'rates' || what === 'defaults') {
        const list = what === 'defaults' ? Object.entries(RM.DEFAULT_RATES)
          : [[val('rtType'), { base: toInt(val('rtBase')), perKm: toInt(val('rtKm')), perMin: toInt(val('rtMin')), minFare: toInt(val('rtMinF')) }]];
        const district = what === 'defaults' ? 'default' : (val('rtDistrict') || 'default');
        for (const [k, r] of list) {
          if (![r.base, r.perKm, r.perMin, r.minFare].every((x) => Number.isInteger(x) && x >= 0)) return say(T().wholeNumbers);
          await fb.setRates(k, k === 'help' ? { base: 0, perKm: 0, perMin: 0, minFare: 0 } : r, district);
        }
        rates = await fb.readRates(prov?.district); rateTable = await fb.readRateTable(); ctx.toast(T().ratesSaved); return paint();
      }
    } catch (e) { say(errText(e)); }
  }

  /* ---------- admin: approvals, rates per district, expired shares ---------- */
  let rateTable = null, rateDistrict = 'default';
  // admin overview: today's numbers and where the active rides are, live (the rules let only an admin read all rides)
  function destroyOvMap() { if (ovMap) { ovMap.destroy(); ovMap = null; } }
  function destroyReqMap() { if (reqMap) { reqMap.destroy(); reqMap = null; } }
  async function mountMap(box, set) {
    if (!navigator.onLine) { box.replaceChildren(el('p', 'note', T().mapOff)); return; }
    let L; try { L = await ctx.near.loadLeaflet(); } catch { box.replaceChildren(el('p', 'note', T().mapOff)); return; }
    if (!box.isConnected) return;
    set(createLiveMap(L, box, { el }));
  }
  function paintOverview() {
    const box = view?.querySelector('.ov-box'); if (!box) return;
    const day = new Date(); day.setHours(0, 0, 0, 0); const t0 = day.getTime();
    const today = allRides.filter((r) => (r.createdAt || 0) >= t0);
    const waiting = allRides.filter((r) => r.status === 'requested'), active = allRides.filter((r) => RM.LIVE.includes(r.status));
    const done = today.filter((r) => ['completed', 'paid'].includes(r.status)), cancelled = today.filter((r) => r.status === 'cancelled');
    const money = today.filter((r) => r.status === 'paid').reduce((x, r) => x + (r.fare || 0), 0);
    const stat = (n, label) => { const d = el('div', 'ov-stat'); d.append(el('b', null, num(n)), el('span', null, label)); return d; };
    const O = T().ov, stats = el('div', 'ov-stats');
    stats.append(stat(waiting.length, O.waiting), stat(active.length, O.active), stat(done.length, O.done), stat(cancelled.length, O.cancelled), stat(money, O.money), stat((pend || []).filter((p) => !p.rejected).length, O.pending));
    const rows = el('div', 'rows');
    for (const r of [...waiting, ...active].slice(0, 12)) {
      const row = el('div', 'r near-row'); const sq = el('span', 'cat-ic sm'); sq.append(icon(TYPE_IC[r.type] || 'car', { size: 'sm' }));
      const b = el('div'); b.append(el('div', 't', `${name(r.type)} · ${O.status[r.status] || r.status}`), el('div', 'm', `${r.pickup.label}${r.providerName ? ` · ${r.providerName}` : ''} · ${r.district}`));
      row.append(sq, b); rows.append(row);
    }
    box.replaceChildren(stats, rows.childElementCount ? rows : el('p', 'muted', O.none));
    if (ovMap) ovMap.update({ pins: [...waiting, ...active].map((r) => ({ lat: r.pickup.lat, lon: r.pickup.lon, label: `${name(r.type)} · ${O.status[r.status] || r.status}` })) });
  }
  function adminCards() {
    const ov = card(el('p', 'eyebrow', T().admin), el('h2', null, T().ov.title), el('div', 'ov-box', null), (() => { const m = el('div', 'near-map pv-map ov-map'); m.setAttribute('role', 'region'); m.setAttribute('aria-label', T().ov.title); return m; })());
    const ap = card(el('p', 'eyebrow', T().admin), el('h2', null, T().waitingApproval));
    const waiting = (pend || []).filter((p) => !p.rejected);
    if (!pend) ap.append(el('div', 'skeleton'));
    else if (!waiting.length) ap.append(el('p', 'muted', T().nobodyWaiting));
    else {
      const rows = el('div', 'rows');
      for (const p of waiting) {
        const row = el('div', 'r near-row'); const sq = el('span', 'cat-ic sm'); sq.append(icon(TYPE_IC[p.type] || 'car'));
        const b = el('div'); b.append(el('div', 't', `${p.name} · ${name(p.type)}`), el('div', 'm', `${p.vehicle} · ${p.district}`));
        const acts = el('div', 'acts');
        if (p.id === user?.uid) b.append(el('div', 'small', T().selfNote));   // the rules do not let an admin approve their own application
        else {
          const det = el('div', 'small pv-priv'); det.hidden = true;
          b.append(btn('btn ghost', T().showPriv, 'shield', async (e) => {
            try {
              const [fb2] = await load(); const d = await fb2.readProviderPrivate(p.id);
              det.replaceChildren(...(d ? [el('div', null, `${T().nidLabel}: ${d.nid}`), el('div', null, `${T().famName}: ${d.familyName} (${T().relations[d.familyRelation] || d.familyRelation})`), el('div', null, `${T().famPhone}: ${d.familyPhone}`)] : [el('div', null, T().noPriv)]));
              det.hidden = false; e.currentTarget.hidden = true;
            } catch (err) { say(errText(err)); }
          }), det);
          const cb = el('input'); cb.type = 'checkbox'; cb.id = `chk-${p.id}`;
          const cl = el('label', 'check small'); cl.htmlFor = cb.id; cl.append(cb, ' ', T().checkedLabel); b.append(cl);
          acts.append(btn('btn solid', T().approve, 'check', () => act('approve', p.id)), btn('btn ghost', T().reject, null, () => act('reject', p.id)));
        }
        row.append(sq, b, acts); rows.append(row);
      }
      ap.append(rows);
    }
    // rates (SRS FR16): nationwide ("default") or one district's own; a district without its own uses the nationwide one
    const dsel = el('select'); dsel.id = 'rtDistrict';
    const dl = el('label', null, T().rateDistrict); dl.htmlFor = 'rtDistrict';
    const all = el('option', null, T().wholeCountry); all.value = 'default'; dsel.append(all);
    for (const d of ctx.near.districts()) { const o = el('option', null, ctx.lang() === 'bn' ? d.bn : d.en); o.value = d.key; dsel.append(o); }
    dsel.value = rateDistrict;
    const sel = el('select'); sel.id = 'rtType';
    for (const x of RM.RIDE_TYPES.filter((y) => y.id !== 'help')) { const o = el('option', null, name(x.id)); o.value = x.id; sel.append(o); }
    const l = el('label', null, T().service); l.htmlFor = 'rtType';
    const has = (d, t) => (rateTable || []).find((r) => r.district === d && r.serviceType === t);
    const missing = RM.RIDE_TYPES.filter((x) => !has('default', x.id)).map((x) => name(x.id));
    const grid = el('div', 'pv-rates');
    grid.append(...[['rtBase', T().rBase], ['rtKm', T().rKm], ['rtMin', T().rMin], ['rtMinF', T().rMinFare]].map(([id, label]) => { const d = el('div'); d.append(...field(id, label, '', { max: 5, tel: true })); return d; }));
    const which = el('p', 'small');
    const fillForm = () => {
      rateDistrict = dsel.value;
      const own = has(rateDistrict, sel.value), base = has('default', sel.value);
      const r = own || base || RM.DEFAULT_RATES[sel.value];
      which.textContent = rateDistrict === 'default' ? (base ? T().rateCountry : T().rateNotSet) : own ? T().rateOwn : base ? T().rateFromCountry : T().rateNotSet;
      const set = (id, x) => { const i = grid.querySelector(`#${id}`); if (i) i.value = num(x); };
      set('rtBase', r.base); set('rtKm', r.perKm); set('rtMin', r.perMin); set('rtMinF', r.minFare);
    };
    dsel.addEventListener('change', fillForm); sel.addEventListener('change', fillForm);
    // every stored rate, as a table
    const table = el('div', 'rows pv-ratetable');
    for (const r of (rateTable || []).slice().sort((a, b) => (a.district === 'default' ? -1 : 0) - (b.district === 'default' ? -1 : 0) || a.district.localeCompare(b.district) || a.serviceType.localeCompare(b.serviceType))) {
      const row = el('div', 'r near-row'); const sq = el('span', 'cat-ic sm'); sq.append(icon(TYPE_IC[r.serviceType] || 'car', { size: 'sm' }));
      const b = el('div');
      b.append(el('div', 't', `${name(r.serviceType)} · ${r.district === 'default' ? T().wholeCountry : (ctx.near.districts().find((d) => d.key === r.district)?.[ctx.lang()] || r.district)}`),
        el('div', 'm', fill(T().rateLine, { base: num(r.base), km: num(r.perKm), min: num(r.perMin), mf: num(r.minFare) })));
      row.append(sq, b); table.append(row);
    }
    const rc = card(el('p', 'eyebrow', T().admin), el('h2', null, T().ratesTitle),
      missing.length ? note(fill(T().missingRates, { list: missing.join(', ') })) : null,
      dl, dsel, l, sel, which, grid,
      pills(btn('btn solid', T().saveRates, null, () => act('rates')), btn('btn ghost', T().sampleRates, null, () => act('defaults'))),
      msgBox(),
      el('h3', null, fill(T().allRates, { n: num((rateTable || []).length) })), rateTable ? table : el('div', 'skeleton'));
    queueMicrotask(fillForm);
    // live shares whose time is over (the rules let an admin list and delete only those)
    const sh = card(el('p', 'eyebrow', T().admin), el('h2', null, T().sharesTitle), el('p', 'muted', T().sharesText),
      pills(btn('btn', T().cleanShares, null, () => act('clean'))));
    return [ap, ov, rc, sh];
  }

  return {
    show,
    close() { /* the job keeps running in the background; the page is redrawn when opened again */ },
    title: () => T().title,
  };
}
