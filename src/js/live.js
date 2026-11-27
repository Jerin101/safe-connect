// লাইভ লোকেশন শেয়ার, Safe Commute and the family view (SRS FR09–FR11, UC-10/11/12; plan PR-2).
// #/live: a signed-in, verified person shares their position for 15 minutes, 1 hour or 8 hours (js/track.js DURATIONS).
// The phone sends a point every 8 s while sharing (live_shares/{id}; firestore.rules check owner, time and place);
// "আমি নিরাপদে পৌঁছেছি" or the end of the time deletes the document at once. Safe Commute adds the number plate,
// vehicle type and destination. #/track/<id>: anyone with the link (no sign-in) sees the moving point on a map with
// the vehicle, destination, battery, speed, last update and minutes left; ended or expired → a clear message.
// Only the share id is kept on this phone (to end it after a reload), never a position. createElement + textContent.
import { icon } from './icons.js';
import { locate, locateBest } from './geo.js';
import { loadUpazilaCentres, nearestUpazilaCentre } from './location.js';

const SITE = 'https://jerin101.github.io/safe-connect/';
const ARRIVE = 'sc-arrive';                     // time (ms) when a share ended without "I arrived": the next visit asks once
const KEY = 'sc-live';                         // { id, expiresAt } of this phone's active share (no position)
let centreDataPromise = null;
async function approximateUpazila(pos) {
  if (!centreDataPromise) centreDataPromise = loadUpazilaCentres().catch(() => []);
  return nearestUpazilaCentre(await centreDataPromise, pos);
}

export function initLive(ctx) {
  const { el, store } = ctx;
  const T = () => ctx.texts();
  const num = (s) => ctx.digits(s);
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (all, k) => (k in v ? v[k] : all));
  let TR = null, FB = null;
  // the active share on this phone
  let share = null, watchId = null, last = null, lastSent = 0, sendTimer = null, endTimer = null, battery = null, minutes = 60;
  let fixInfo = null, sending = false, denied = 0;   // the kept reading's accuracy/time; a send in progress; refused sends in a row
  // the family view
  let trackUnsub = null, map = null, marker = null, tickTimer = null;
  let view = null;
  let pendingCommute = null;                   // from সেবা ডাকুন: the ride's vehicle and destination

  const load = async () => { if (!TR) TR = await import('./track.js'); if (!FB) FB = await import('./firebase.js'); return [FB, TR]; };
  // Real time minus this phone's clock (a wrong phone clock made links "expire" at once). Read from our own site's Date header.
  let clock = null, clockAt = 0;
  async function realTimeOffset() {
    if (clock !== null && Date.now() - clockAt < 600000) return clock;
    try {
      const t0 = Date.now(), r = await fetch('index.html', { method: 'HEAD', cache: 'no-store' });
      const off = TR.clockOffset(r.headers.get('date'), t0, Date.now());
      if (off !== null) { clock = off; clockAt = Date.now(); }
    } catch { /* offline: keep the last value, or trust the phone clock */ }
    return clock || 0;
  }
  const btn = (cls, text, ic, onClick) => { const b = el('button', cls, text); b.type = 'button'; if (ic) b.prepend(icon(ic, { size: 'sm' })); if (onClick) b.addEventListener('click', onClick); return b; };
  const card = (...kids) => { const c = el('section', 'card'); c.append(...kids.filter(Boolean)); return c; };
  const pills = (...kids) => { const p = el('div', 'pills'); p.append(...kids.filter(Boolean)); return p; };
  const note = (text, ic = 'info') => { const n = el('div', 'note dk-note'); n.append(icon(ic, { size: 'sm' }), el('p', null, text)); return n; };
  const msg = () => { const m = el('p', 'small dk-msg'); m.setAttribute('role', 'status'); return m; };
  const say = (t) => { const m = view?.querySelector('.dk-msg'); if (m) m.textContent = t; else ctx.toast(t); };
  const errText = (e) => (e && T().err[e.code]) || (navigator.onLine ? T().err.generic : T().err.offline);
  const linkOf = (id) => `${SITE}#/track/${id}`;
  const time = (ms) => new Intl.DateTimeFormat(ctx.lang() === 'bn' ? 'bn-BD' : 'en-GB', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(ms);
  const saved = () => { try { const x = JSON.parse(store.get(KEY) || 'null'); return x && x.id && x.expiresAt > Date.now() ? x : null; } catch { return null; } };

  /* ---------- the sharer's page ---------- */
  async function show(v) {
    view = v;
    v.replaceChildren(el('div', 'skeleton'));
    let fb;
    // A slow or broken connection must not leave an empty grey box: after 12 s the person sees the "check your connection" note.
    try { [fb] = await Promise.race([load(), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 12000))]); } catch { v.replaceChildren(card(note(T().err.offline))); return; }
    const h = el('h1', 'page-title', T().title); h.id = 'liveTitle'; h.tabIndex = -1;
    const head = card(h);
    const user = await fb.currentUser();
    if (!view.isConnected) return;
    // UC-10 2.1: not signed in → sign in first; not verified → verify first
    if (!user) { v.replaceChildren(head, card(note(T().needSignIn), btn('btn solid', T().signIn, 'user', (e) => ctx.signIn(e.currentTarget)))); return; }
    if (!(await fb.isVerified())) { v.replaceChildren(head, card(note(T().needVerify))); return; }
    if (!share) { const s = saved(); if (s) share = { id: s.id, expiresAt: s.expiresAt, resumed: true }; }
    if (share) { if (share.resumed && watchId == null) startWatch(); paintActive(head); return; }
    paintStart(head);
  }
  function paintStart(head) {
    const opts = el('div', 'pills live-durations');
    for (const m of TR.DURATIONS) {
      const b = btn('pill', T().durations[m], null, () => { minutes = m; opts.querySelectorAll('.pill').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      b.setAttribute('aria-pressed', String(m === minutes)); opts.append(b);
    }
    const start = btn('btn solid big', T().start, 'locate', startShare);
    const commute = btn('btn', T().safeCommute, 'car', () => say(T().startFirst));   // UC-11 5.2
    const ride = pendingCommute ? note(fill(T().fromRide, { v: [pendingCommute.vehicleNo, pendingCommute.destination].filter(Boolean).join(' → ') })) : null;
    view.replaceChildren(head, arrivalCard(), card(el('h2', null, T().howLong), ride, opts, start, msg(), pendingCommute ? null : pills(commute)));
  }
  // Safe Arrival check (guide section 6). A browser cannot wake itself when closed, so the question is asked when the time
  // ends (page open) and, if that was missed, the next time the person opens this page. Nothing is sent without a tap.
  const pendingArrive = () => { try { const t = Number(store.get(ARRIVE)); return t && Date.now() - t < 24 * 3600000 ? t : 0; } catch { return 0; } };
  function clearArrive() { try { localStorage.removeItem(ARRIVE); } catch { /* fine */ } }
  function arrivalCard() {
    if (!pendingArrive()) return null;
    const A = T().arrive, box = el('section', 'card'); box.setAttribute('role', 'status');
    const yes = btn('btn solid', A.yes, 'check', () => { clearArrive(); box.replaceChildren(el('h2', null, A.glad), pills(...sendButtons(T().reachedText))); });
    const no = el('a', 'btn', A.no); no.href = '#/sos'; no.prepend(icon('alert', { size: 'sm' })); no.addEventListener('click', clearArrive);
    const later = btn('linkbtn', A.dismiss, null, () => { clearArrive(); box.remove(); });
    box.append(el('h2', null, A.q), el('p', 'muted', A.note), pills(yes, no), later);
    return box;
  }
  async function startShare() {
    const [fb, tr] = await load();
    if (!navigator.geolocation) return say(T().noGps);
    say(T().finding);
    try { const b = await navigator.getBattery?.(); battery = b ? b : null; } catch { battery = null; }
    const skew = await realTimeOffset();
    if (Math.abs(skew) > TR.CLOCK_WARN_MS) ctx.toast(fill(T().clockOff, { m: num(Math.round(Math.abs(skew) / 60000)) }));
    // GPS first and never an old reading; if GPS cannot fix in 20 s (indoors), the network position is the last resort.
    const getFix = (ok, bad) => locateBest(ok, (e) => { if (e && e.code === 1) bad(e); else locate(ok, bad, { precise: false, timeout: 10000, maximumAge: 0 }); }, { timeout: 20000, targetAccuracy: 30, maximumAge: 0 });
    getFix(async (pos) => {
      const id = tr.newShareId();
      try {
        const commute = pendingCommute && tr.plateOk(pendingCommute.vehicleNo) ? pendingCommute : pendingCommute ? { vehicleType: pendingCommute.vehicleType, ...(pendingCommute.destination ? { destination: pendingCommute.destination } : {}) } : {};
        if (commute.destination && !tr.destinationOk(commute.destination)) delete commute.destination;
        await fb.startShare(id, minutes, tr.pointFrom(pos.coords, battery?.level), commute, skew);
        pendingCommute = null;
        share = { id, expiresAt: Date.now() + minutes * 60000 };
        store.set(KEY, JSON.stringify({ id, expiresAt: share.expiresAt }));
        last = pos.coords; fixInfo = { accuracy: pos.coords.accuracy, at: Date.now() }; lastSent = Date.now(); denied = 0;
        startWatch();
        paintActive();
      } catch (e) { say(errText(e)); }
    }, (e) => say(e && e.code === 1 ? T().allowLocation : T().noFix));   // UC-10 5.2
  }
  function startWatch() {
    if (watchId != null || !navigator.geolocation) return;
    // A slow GPS fix (timeout) is not an error here: the last good point keeps being sent. Only "denied" is reported.
    watchId = navigator.geolocation.watchPosition((p) => {
      const f = { accuracy: p.coords.accuracy, at: Date.now() };
      if (TR.replaceFix(fixInfo, f)) { last = p.coords; fixInfo = f; showAccuracy(); }   // a much worse reading does not replace a fresh good one
    }, (e) => { if (e && e.code === 1) say(T().allowLocation); }, { enableHighAccuracy: true, maximumAge: 0 });
    clearInterval(sendTimer);
    keepAwake();
    sendTimer = setInterval(sendPoint, TR.SEND_EVERY_MS);
    clearTimeout(endTimer);
    endTimer = setTimeout(() => finish(false), Math.max(0, share.expiresAt - Date.now()));   // TRK-05: the time is over
    addEventListener('beforeunload', warnLeave);
  }
  // One send at a time: on a weak network the old code queued several points, and when the network came back they all
  // arrived together; the rules refuse points closer than 4 s, so the whole share was ended after a few seconds.
  // Now a refused point is tried again with the next one; only 3 refusals in a row end the share, and the person is told why.
  async function sendPoint() {
    if (!share || !last || sending) return;
    if (Date.now() >= share.expiresAt) return finish(false);
    sending = true;
    try { await FB.updateShare(share.id, TR.pointFrom(last, battery?.level)); denied = 0; lastSent = Date.now(); const s = view?.querySelector('.live-sent'); if (s) s.textContent = fill(T().lastSent, { t: time(lastSent) }); }
    catch (e) { if (e && e.code === 'permission-denied' && ++denied >= 3) finish(false, true); }
    finally { sending = false; }
  }
  function showAccuracy() {
    const p = view?.querySelector('.live-acc'); if (!p || !fixInfo || !Number.isFinite(fixInfo.accuracy)) return;
    const m = Math.round(fixInfo.accuracy);
    p.textContent = fill(m > 100 ? T().accuracyRough : T().accuracy, { m: num(m) });
    p.classList.toggle('warn', m > 100);
  }
  function warnLeave(e) { if (share) { e.preventDefault(); e.returnValue = T().leaveWarn; return T().leaveWarn; } return undefined; }
  // Keep the screen on while sharing: a phone that sleeps stops the GPS and the timer, and the family sees a frozen point.
  // Not every browser has it; the page works without it, and it is asked for again when the person comes back to the page.
  let wake = null;
  async function keepAwake() {
    try { if (share && !wake && document.visibilityState === 'visible') wake = await navigator.wakeLock?.request('screen'); } catch { wake = null; }
    wake?.addEventListener?.('release', () => { wake = null; });
  }
  function letSleep() { try { wake?.release(); } catch { /* fine */ } wake = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
  function stopWatch() {
    letSleep();
    if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null;
    clearInterval(sendTimer); clearTimeout(endTimer); sendTimer = endTimer = null;
    removeEventListener('beforeunload', warnLeave);
  }
  async function finish(reached, problem = false) {
    const id = share?.id; stopWatch(); share = null;
    try { localStorage.removeItem(KEY); if (reached) clearArrive(); else store.set(ARRIVE, String(Date.now())); } catch { /* fine */ }
    if (id) { try { await (await load())[0].endShare(id); } catch { /* the rules let it expire anyway */ } }
    if (!view?.isConnected) { ctx.toast(reached ? T().endedReached : problem ? T().endedProblem : T().endedTime); return; }
    const h = el('h1', 'page-title', T().title); h.id = 'liveTitle'; h.tabIndex = -1;
    const kids = [card(h, el('p', 'muted', reached ? T().endedReached : problem ? T().endedProblem : T().endedTime))];
    if (reached) kids.push(card(el('h2', null, T().tellReached), pills(...sendButtons(T().reachedText))));
    if (!reached) kids.push(arrivalCard());
    kids.push(pills(btn('btn solid', T().again, 'locate', () => show(view))));
    view.replaceChildren(...kids.filter(Boolean));
  }
  // the link: SMS to the saved family numbers (or any number), WhatsApp, the share sheet, copy
  function sendButtons(text) {
    const people = ctx.people();
    const list = people.map((p) => p.phone).filter(Boolean).join(',');
    const sms = el('a', 'btn', T().sms); sms.href = `sms:${list}?body=${encodeURIComponent(text)}`; sms.prepend(icon('msg', { size: 'sm' }));
    const wa = el('a', 'btn', 'WhatsApp'); wa.href = `https://wa.me/?text=${encodeURIComponent(text)}`; wa.target = '_blank'; wa.rel = 'noopener noreferrer';
    const share2 = btn('btn', T().share, 'share', async () => { try { if (navigator.share) await navigator.share({ text }); else await copy(text); } catch { /* closed */ } });
    const cp = btn('btn', T().copy, 'copy', () => copy(text));
    return [sms, wa, share2, cp];
  }
  async function copy(text) { try { await navigator.clipboard.writeText(text); ctx.toast(T().copied); } catch { ctx.toast(T().copyFailed); } }
  function paintActive(head) {
    head = head || (() => { const h = el('h1', 'page-title', T().title); h.id = 'liveTitle'; h.tabIndex = -1; return card(h); })();
    const left = TR.minutesLeft(share.expiresAt, Date.now());
    const status = card(el('p', 'live-on', T().sharingNow), el('p', 'muted', fill(T().endsIn, { m: num(left) })),
      el('p', 'small live-sent', lastSent ? fill(T().lastSent, { t: time(lastSent) }) : T().waitingFix), el('p', 'small live-acc'),
      btn('btn solid big live-reached', T().reached, 'check', () => finish(true)));
    const text = fill(T().linkText, { link: linkOf(share.id) });
    const link = card(el('h2', null, T().sendLink), el('p', 'small live-link', linkOf(share.id)), pills(...sendButtons(text)),
      ctx.people().length ? null : el('p', 'small', T().noFamily));
    view.replaceChildren(head, status, link, commuteCard(), msg());
    showAccuracy();
  }
  // Safe Commute (UC-11): number plate, vehicle type, destination; missing fields are marked (5.1)
  function commuteCard() {
    const f = (id, label, ph, max) => { const l = el('label', null, label); l.htmlFor = id; const i = el('input'); i.id = id; i.type = 'text'; i.maxLength = max; i.placeholder = ph; return [l, i]; };
    const sel = el('select'); sel.id = 'lvType';
    for (const v of TR.VEHICLE_TYPES) { const o = el('option', null, T().vehicles[v]); o.value = v; sel.append(o); }
    const sl = el('label', null, T().vehicleType); sl.htmlFor = 'lvType';
    const save = btn('btn solid', T().saveCommute, 'car', async () => {
      const plate = view.querySelector('#lvPlate'), dest = view.querySelector('#lvDest');
      const bad = [[plate, TR.plateOk(plate.value)], [dest, TR.destinationOk(dest.value)]];
      bad.forEach(([i, ok]) => i.setAttribute('aria-invalid', String(!ok)));
      if (bad.some(([, ok]) => !ok)) return say(T().commuteMissing);
      try {
        await FB.setCommute(share.id, { vehicleNo: plate.value.trim(), vehicleType: sel.value, destination: dest.value.trim() });
        say(T().commuteSaved);
      } catch (e) { say(e && e.code === 'permission-denied' ? T().tooFast : errText(e)); }
    });
    return card(el('h2', null, T().safeCommute), ...f('lvPlate', T().plate, T().platePh, 30), sl, sel,
      ...f('lvDest', T().destination, T().destPh, 60), save);
  }

  /* ---------- the family view ---------- */
  async function track(v, id) {
    view = v; closeTrack();
    const h = el('h1', 'page-title', T().trackTitle); h.id = 'trackTitle'; h.tabIndex = -1;
    let fb, tr;
    try { [fb, tr] = await load(); } catch { v.replaceChildren(card(h, note(T().err.offline))); return; }
    if (!tr.SHARE_ID.test(id || '')) { v.replaceChildren(card(h, note(T().ended, 'alert')), helpCard()); return; }
    const info = el('div', 'live-info'); info.append(el('div', 'skeleton'));
    const mapBox = el('div', 'dk-map live-map'); mapBox.setAttribute('role', 'region'); mapBox.setAttribute('aria-label', T().mapLabel);
    v.replaceChildren(card(h, info), card(mapBox), helpCard());
    trackUnsub = fb.watchShare(id, (s) => paintTrack(s, info, mapBox), () => { info.replaceChildren(note(errText({ code: 'offline' }))); });
  }
  function helpCard() {
    const a = el('a', 'btn red', T().call999); a.href = 'tel:999'; a.prepend(icon('phone', { size: 'sm' }));
    const calls = ctx.people().slice(0, 3).map((p) => { const c = el('a', 'btn', fill(T().callPerson, { name: p.rel || p.name })); c.href = `tel:${p.phone}`; c.prepend(icon('phone', { size: 'sm' })); return c; });
    return card(el('h2', null, T().needHelp), pills(a, ...calls));
  }
  async function paintTrack(s, info, mapBox) {
    if (!view?.isConnected) return closeTrack();
    const off = await realTimeOffset();   // the family phone's clock may be wrong too: compare with the real time
    if (!s || s.expiresAt <= Date.now() + off) {   // UC-12 3.1
      clearInterval(tickTimer); if (map) { map.remove(); map = null; marker = null; }
      info.replaceChildren(note(T().ended, 'alert')); mapBox.replaceChildren(); mapBox.hidden = true; return;
    }
    mapBox.hidden = false;
    const row = (label, value, cls) => { const d = el('div', cls); d.append(el('span', null, label), el('b', null, value)); return d; };
    const bill = el('div', 'bill');
    const estimate = await approximateUpazila({ lat: Number(s.lat), lon: Number(s.lon) });
    if (!view?.isConnected) return closeTrack();
    if (estimate) bill.append(el('p', 'small muted', fill(T().nearCentre, {
      u: ctx.lang() === 'bn' ? estimate.upazilaBn : estimate.upazila,
      d: estimate.district,
      km: estimate.distanceKm.toFixed(1),
    })));
    if (s.vehicleNo || s.vehicleType) bill.append(row(T().vehicle, [s.vehicleType ? T().vehicles[s.vehicleType] : '', s.vehicleNo || ''].filter(Boolean).join(' · ')));
    if (s.destination) bill.append(row(T().destination, s.destination));
    const sp = TR.kmh(s.speed);
    bill.append(row(T().speed, sp == null ? T().unknown : `${num(sp)} ${T().kmh}`));
    bill.append(row(T().battery, s.battery == null ? T().batteryUnknown : `${num(s.battery)}%`, TR.lowBattery(s.battery) ? 'warn' : ''));
    bill.append(row(T().updated, time(s.updatedAt)));
    const leftRow = row(T().left, fill(T().minutes, { m: num(TR.minutesLeft(s.expiresAt, Date.now() + off)) }));
    bill.append(leftRow);
    clearInterval(tickTimer);
    tickTimer = setInterval(() => { leftRow.lastChild.textContent = fill(T().minutes, { m: num(TR.minutesLeft(s.expiresAt, Date.now() + off)) }); if (s.expiresAt <= Date.now() + off) paintTrack(null, info, mapBox); }, 30000);
    const kids = [el('p', 'live-on', T().liveNow), bill];
    if (TR.lowBattery(s.battery)) kids.splice(1, 0, note(T().lowBattery, 'alert'));
    const g = el('a', 'btn', T().openMaps); g.href = `https://www.google.com/maps/search/?api=1&query=${Number(s.lat)},${Number(s.lon)}`; g.target = '_blank'; g.rel = 'noopener noreferrer'; g.prepend(icon('nav', { size: 'sm' }));
    kids.push(pills(g));
    info.replaceChildren(...kids);
    if (!navigator.onLine) { mapBox.replaceChildren(el('p', 'note', T().mapOffline)); return; }
    let L; try { L = await ctx.near.loadLeaflet(); } catch { mapBox.replaceChildren(el('p', 'note', T().mapFailed), btn('btn', T().mapRetry, null, () => { mapBox.replaceChildren(); paintTrack(s, info, mapBox); })); return; }
    if (!map) {
      map = L.map(mapBox).setView([s.lat, s.lon], 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
      const w = el('span'); w.append(el('span', 'mme-pulse'), el('span', 'mme-dot'));
      marker = L.marker([s.lat, s.lon], { icon: L.divIcon({ className: 'mme', html: w, iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false }).addTo(map)
        .bindTooltip(el('span', null, T().here), { permanent: true, direction: 'top', className: 'mtip', offset: [0, -12] });
    } else { marker.setLatLng([s.lat, s.lon]); if (!map.getBounds().pad(-0.2).contains([s.lat, s.lon])) map.panTo([s.lat, s.lon]); }
  }
  function closeTrack() { if (trackUnsub) trackUnsub(); trackUnsub = null; clearInterval(tickTimer); if (map) { map.remove(); map = null; marker = null; } }

  return {
    show, track, close: closeTrack,
    // from a ride (সেবা ডাকুন): open #/live with the vehicle and destination ready; the person taps Start
    shareRide(commute) { pendingCommute = commute; minutes = 60; ctx.go('live'); },
    active: () => !!share,
    title: (page) => (page === 'track' ? T().trackTitle : T().title),
  };
}
