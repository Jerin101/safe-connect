// লাইভ লোকেশন শেয়ার, Safe Commute and the family view (SRS FR09–FR11, UC-10/11/12; plan PR-2).
// #/live: a signed-in, verified person shares their position for 15 minutes, 1 hour or 8 hours (js/track.js DURATIONS).
// The phone sends a point every 8 s while sharing (live_shares/{id}; firestore.rules check owner, time and place);
// "আমি নিরাপদে পৌঁছেছি" or the end of the time deletes the document at once. Safe Commute adds the number plate,
// vehicle type and destination. #/track/<id>: anyone with the link (no sign-in) sees the moving point on a map with
// the vehicle, destination, battery, speed, last update and minutes left; ended or expired → a clear message.
// Only the share id is kept on this phone (to end it after a reload), never a position. createElement + textContent.
import { icon } from './icons.js';

const SITE = 'https://jerin101.github.io/safe-connect/';
const KEY = 'sc-live';                         // { id, expiresAt } of this phone's active share (no position)

export function initLive(ctx) {
  const { el, store } = ctx;
  const T = () => ctx.texts();
  const num = (s) => ctx.digits(s);
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (all, k) => (k in v ? v[k] : all));
  let TR = null, FB = null;
  // the active share on this phone
  let share = null, watchId = null, last = null, lastSent = 0, sendTimer = null, endTimer = null, battery = null, minutes = 60;
  // the family view
  let trackUnsub = null, map = null, marker = null, tickTimer = null;
  let view = null;
  let pendingCommute = null;                   // from সেবা ডাকুন: the ride's vehicle and destination

  const load = async () => { if (!TR) TR = await import('./track.js'); if (!FB) FB = await import('./firebase.js'); return [FB, TR]; };
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
    try { [fb] = await load(); } catch { v.replaceChildren(card(note(T().err.offline))); return; }
    const h = el('h1', 'page-title', T().title); h.id = 'liveTitle'; h.tabIndex = -1;
    const head = card(h, el('p', 'muted', T().intro));
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
    view.replaceChildren(head, card(el('h2', null, T().howLong), ride, opts, start, el('p', 'small', T().privacy), msg(), pendingCommute ? null : pills(commute)));
  }
  async function startShare() {
    const [fb, tr] = await load();
    if (!navigator.geolocation) return say(T().noGps);
    say(T().finding);
    try { const b = await navigator.getBattery?.(); battery = b ? b : null; } catch { battery = null; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const id = tr.newShareId();
      try {
        const commute = pendingCommute && tr.plateOk(pendingCommute.vehicleNo) ? pendingCommute : pendingCommute ? { vehicleType: pendingCommute.vehicleType, ...(pendingCommute.destination ? { destination: pendingCommute.destination } : {}) } : {};
        if (commute.destination && !tr.destinationOk(commute.destination)) delete commute.destination;
        await fb.startShare(id, minutes, tr.pointFrom(pos.coords, battery?.level), commute);
        pendingCommute = null;
        share = { id, expiresAt: Date.now() + minutes * 60000 };
        store.set(KEY, JSON.stringify({ id, expiresAt: share.expiresAt }));
        last = pos.coords; lastSent = Date.now();
        startWatch();
        paintActive();
      } catch (e) { say(errText(e)); }
    }, () => say(T().allowLocation), { enableHighAccuracy: true, timeout: 20000 });   // UC-10 5.2
  }
  function startWatch() {
    if (watchId != null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition((p) => { last = p.coords; }, () => say(T().allowLocation), { enableHighAccuracy: true, maximumAge: 4000, timeout: 30000 });
    clearInterval(sendTimer);
    sendTimer = setInterval(sendPoint, TR.SEND_EVERY_MS);
    clearTimeout(endTimer);
    endTimer = setTimeout(() => finish(false), Math.max(0, share.expiresAt - Date.now()));   // TRK-05: the time is over
    addEventListener('beforeunload', warnLeave);
  }
  async function sendPoint() {
    if (!share || !last) return;
    if (Date.now() >= share.expiresAt) return finish(false);
    try { await FB.updateShare(share.id, TR.pointFrom(last, battery?.level)); lastSent = Date.now(); const s = view?.querySelector('.live-sent'); if (s) s.textContent = fill(T().lastSent, { t: time(lastSent) }); }
    catch (e) { if (e && e.code === 'permission-denied') finish(false); }
  }
  function warnLeave(e) { if (share) { e.preventDefault(); e.returnValue = T().leaveWarn; return T().leaveWarn; } return undefined; }
  function stopWatch() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null;
    clearInterval(sendTimer); clearTimeout(endTimer); sendTimer = endTimer = null;
    removeEventListener('beforeunload', warnLeave);
  }
  async function finish(reached) {
    const id = share?.id; stopWatch(); share = null;
    try { localStorage.removeItem(KEY); } catch { /* fine */ }
    if (id) { try { await (await load())[0].endShare(id); } catch { /* the rules let it expire anyway */ } }
    if (!view?.isConnected) { ctx.toast(reached ? T().endedReached : T().endedTime); return; }
    const h = el('h1', 'page-title', T().title); h.id = 'liveTitle'; h.tabIndex = -1;
    const kids = [card(h, el('p', 'muted', reached ? T().endedReached : T().endedTime))];
    if (reached) kids.push(card(el('h2', null, T().tellReached), pills(...sendButtons(T().reachedText))));
    kids.push(pills(btn('btn solid', T().again, 'locate', () => show(view))));
    view.replaceChildren(...kids);
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
    head = head || (() => { const h = el('h1', 'page-title', T().title); h.id = 'liveTitle'; h.tabIndex = -1; return card(h, el('p', 'muted', T().intro)); })();
    const left = TR.minutesLeft(share.expiresAt, Date.now());
    const status = card(el('p', 'live-on', T().sharingNow), el('p', 'muted', fill(T().endsIn, { m: num(left) })),
      el('p', 'small live-sent', lastSent ? fill(T().lastSent, { t: time(lastSent) }) : T().waitingFix),
      btn('btn solid big live-reached', T().reached, 'check', () => finish(true)));
    const text = fill(T().linkText, { link: linkOf(share.id) });
    const link = card(el('h2', null, T().sendLink), el('p', 'small live-link', linkOf(share.id)), pills(...sendButtons(text)),
      ctx.people().length ? null : el('p', 'small', T().noFamily));
    view.replaceChildren(head, status, link, commuteCard(), msg());
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
    return card(el('h2', null, T().safeCommute), el('p', 'muted', T().commuteText), ...f('lvPlate', T().plate, T().platePh, 30), sl, sel,
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
    if (!s || s.expiresAt <= Date.now()) {   // UC-12 3.1
      clearInterval(tickTimer); if (map) { map.remove(); map = null; marker = null; }
      info.replaceChildren(note(T().ended, 'alert')); mapBox.replaceChildren(); mapBox.hidden = true; return;
    }
    mapBox.hidden = false;
    const row = (label, value, cls) => { const d = el('div', cls); d.append(el('span', null, label), el('b', null, value)); return d; };
    const bill = el('div', 'bill');
    if (s.vehicleNo || s.vehicleType) bill.append(row(T().vehicle, [s.vehicleType ? T().vehicles[s.vehicleType] : '', s.vehicleNo || ''].filter(Boolean).join(' · ')));
    if (s.destination) bill.append(row(T().destination, s.destination));
    const sp = TR.kmh(s.speed);
    bill.append(row(T().speed, sp == null ? T().unknown : `${num(sp)} ${T().kmh}`));
    bill.append(row(T().battery, s.battery == null ? T().batteryUnknown : `${num(s.battery)}%`, TR.lowBattery(s.battery) ? 'warn' : ''));
    bill.append(row(T().updated, time(s.updatedAt)));
    const leftRow = row(T().left, fill(T().minutes, { m: num(TR.minutesLeft(s.expiresAt, Date.now())) }));
    bill.append(leftRow);
    clearInterval(tickTimer);
    tickTimer = setInterval(() => { leftRow.lastChild.textContent = fill(T().minutes, { m: num(TR.minutesLeft(s.expiresAt, Date.now())) }); if (s.expiresAt <= Date.now()) paintTrack(null, info, mapBox); }, 30000);
    const kids = [el('p', 'live-on', T().liveNow), bill];
    if (TR.lowBattery(s.battery)) kids.splice(1, 0, note(T().lowBattery, 'alert'));
    const g = el('a', 'btn', T().openMaps); g.href = `https://www.google.com/maps/search/?api=1&query=${Number(s.lat)},${Number(s.lon)}`; g.target = '_blank'; g.rel = 'noopener noreferrer'; g.prepend(icon('nav', { size: 'sm' }));
    kids.push(pills(g));
    info.replaceChildren(...kids);
    if (!navigator.onLine) { mapBox.replaceChildren(el('p', 'note', T().mapOffline)); return; }
    let L; try { L = await ctx.near.loadLeaflet(); } catch { mapBox.replaceChildren(el('p', 'note', T().mapFailed)); return; }
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
