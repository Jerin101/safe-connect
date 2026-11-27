// সেবা ডাকুন on the real site (R3 of plan v4, #267): the rider asks (service, pickup, destination) → nearby approved
// providers of that service in the district see it → one accepts → both see each other on the map until the trip ends
// → the provider ends it and the bill is worked out from the admin's rates (js/ride.js; firestore.rules check the same
// arithmetic) → cash, "টাকা পেয়েছি", receipt, rating.
// Privacy: the pickup and destination are rounded to about 100 m in the ride record; live positions exist only from
// "accepted" to the end of the trip, only for those two people, and are deleted at the end. Nothing is sent before the
// person taps the button, and Firebase loads only then. Everything is built with createElement + textContent.
import { icon } from './icons.js';
import { locate } from './geo.js';

const TYPE_IC = { ambulance: 'amb', cng: 'car', bike: 'bike', technician: 'wrench', help: 'hands', errand: 'basket', pickup: 'bag', towing: 'car',
  easybike: 'car', rickshaw: 'bike', van: 'bus' };
// the live-share vehicle type of a ride type (live_shares allows rickshaw, easybike, cng, bus, other)
const SHARE_VEHICLE = { cng: 'cng', easybike: 'easybike', rickshaw: 'rickshaw' };
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const r3 = (x) => Math.round(x * 1e3) / 1e3;          // stored ride points: about 100 m (the rules refuse more exact ones)
const RSTEPS = ['requested', 'accepted', 'arrived', 'on_trip', 'completed', 'paid'];

export function initDakun(ctx) {
  const { el, store } = ctx;
  const T = () => ctx.texts();
  const num = (s) => ctx.digits(s);
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (all, k) => (k in v ? v[k] : all));
  let RM = null, HP = null, FBM = null;                 // js/ride.js, hasPhone, [firebase, community]
  let rates = null;                                     // { type: {base, perKm, perMin, minFare} } from Firestore
  let here = null;                                      // { district, label, lat, lon } from js/near.js
  const form = { type: 'cng', pick: null, drop: null, pickLabel: '', dropLabel: '', picking: 'drop', online: null, items: '', maxItems: '', area: '' };
  let quick = [];
  let ride = null, rideUnsub = null, liveUnsub = null, other = null, mine = null, geoId = null, lastSent = null;
  let view = null, map = null, mk = {}, lines = null, lastFit = null;

  /* ---------- small helpers ---------- */
  const tk = (n) => fill(T().taka, { n: num(n) });
  const dist = (m) => (m < 1000 ? `${num(Math.round(m / 10) * 10)} ${T().metres}` : `${num((m / 1000).toFixed(1))} ${T().km}`);
  const name = (t) => T().names[t] || t;
  const who = (t) => T().who[t] || t;
  const typeOf = (t) => (RM ? RM.typeOf(t) : { dest: true });
  const noRates = () => !rates || !Object.keys(rates).length;
  const btn = (cls, text, ic, onClick) => {
    const b = el('button', cls, text); b.type = 'button';
    if (ic) b.prepend(icon(ic, { size: 'sm' }));
    if (onClick) b.addEventListener('click', onClick);
    return b;
  };
  const note = (text, ic = 'info') => { const n = el('div', 'note dk-note'); n.append(icon(ic, { size: 'sm' }), el('p', null, text)); return n; };
  const card = (...kids) => { const c = el('section', 'card'); c.append(...kids.filter(Boolean)); return c; };
  const errText = (e) => (e && T().err[e.code]) || (navigator.onLine ? T().err.generic : T().err.unavailable);
  async function load() {
    if (!FBM) FBM = await Promise.all([import('./firebase.js'), import('./community.js')]);
    if (!RM) { RM = await import('./ride.js'); HP = (await import('./reports.js')).hasPhone; }
    return FBM;
  }
  const loadRide = () => (RM ? Promise.resolve(RM) : import('./ride.js').then((m) => { RM = m; return m; }));

  /* ---------- sign in (the site's own modal) ---------- */
  // The signed-in person with a checked email, or null after showing why and a sign-in button in `box`.
  async function needUser(box, why) {
    const [fb] = await load();
    const u = await fb.currentUser();
    if (!u) {
      const b = btn('btn solid', T().signIn, 'user', (e) => ctx.signIn(e.currentTarget));
      box.replaceChildren(note(why), b);
      return null;
    }
    if (!(await fb.isVerified())) throw { code: 'unverified' };
    return u;
  }

  /* ---------- the map (Leaflet from vendor/, OpenStreetMap tiles; straight lines, no routing service) ---------- */
  const pinIcon = (cls, ic) => { const s = el('span', 'mpin-in'); s.append(icon(ic, { size: 'sm' }));
    return window.L.divIcon({ className: `mpin ${cls}`, html: s, iconSize: [34, 42], iconAnchor: [17, 41], tooltipAnchor: [0, -38] }); };
  const meIcon = () => { const w = el('span'); w.append(el('span', 'mme-pulse'), el('span', 'mme-dot'));
    return window.L.divIcon({ className: 'mme', html: w, iconSize: [22, 22], iconAnchor: [11, 11], tooltipAnchor: [0, -12] }); };
  const vehIcon = (type) => { const w = el('span'); const rot = el('span', 'mveh-rot'); rot.append(el('span', 'mveh-arrow'));
    const inn = el('span', 'mveh-in'); inn.append(icon(TYPE_IC[type] || 'car', { size: 'sm' })); w.append(rot, inn);
    return window.L.divIcon({ className: 'mveh', html: w, iconSize: [54, 54], iconAnchor: [27, 27], tooltipAnchor: [0, -28] }); };
  const tip = (text) => el('span', null, text);
  const bearing = (a, b) => { const r = Math.PI / 180, dl = (b.lng - a.lng) * r;
    const y = Math.sin(dl) * Math.cos(b.lat * r), x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dl);
    return (Math.atan2(y, x) / r + 360) % 360; };
  // move a marker smoothly (about 1 s), turning a vehicle toward where it goes
  function glide(m, to) {
    const from = m.getLatLng(); if (Math.abs(from.lat - to[0]) < 1e-7 && Math.abs(from.lng - to[1]) < 1e-7) return;
    const rot = m.getElement()?.querySelector('.mveh-rot');
    if (rot && Math.abs(from.lat - to[0]) + Math.abs(from.lng - to[1]) > 2e-5) rot.style.transform = `rotate(${Math.round(bearing(from, { lat: to[0], lng: to[1] }))}deg)`;
    cancelAnimationFrame(m.glideId);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { m.setLatLng(to); return; }
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 950), e = k * (2 - k);
      m.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]); if (k < 1) m.glideId = requestAnimationFrame(step); };
    m.glideId = requestAnimationFrame(step);
  }
  function chip(text) {
    const box = view?.querySelector('.dk-mapwrap'); if (!box) return;
    let c = box.querySelector('.mchip');
    if (!text) { if (c) c.hidden = true; return; }
    if (!c) { c = el('div', 'mchip'); c.setAttribute('role', 'status'); box.append(c); }
    c.hidden = false; c.textContent = text;
  }
  function closeMap() { if (map) { map.stop(); map.remove(); map = null; } mk = {}; lines = null; lastFit = null; }
  async function drawMap() {
    closeMap();
    const box = view?.querySelector('.dk-map'); if (!box) return;
    if (!navigator.onLine) { box.replaceChildren(el('p', 'note', T().mapOffline)); return; }
    let L;
    try { L = await ctx.near.loadLeaflet(); } catch { box.replaceChildren(el('p', 'note', T().mapFailed)); return; }
    if (!box.isConnected || map) return;
    const r = ride || { pickup: form.pick };
    const c = r.pickup || here;
    map = L.map(box).setView([c.lat, c.lon], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    if (!ride) map.on('click', (e) => {
      const p = { lat: r5(e.latlng.lat), lon: r5(e.latlng.lng) };
      if (!RM || !RM.inBangladesh(p.lat, p.lon)) return;
      const t = typeOf(form.type);
      if (form.picking === 'pick' || !t.dest) { form.pick = p; if (t.shop && !form.pickLabel) { form.pickLabel = T().mapShopPicked; syncInputs(); } }
      else { form.drop = p; if (!form.dropLabel) { form.dropLabel = T().mapPicked; syncInputs(); } }
      paintMarkers(); paintEst();
    });
    paintMarkers(true);
  }
  function setMk(key, p, makeIcon, label) {
    if (!map) return;
    if (!p) { if (mk[key]) { mk[key].remove(); delete mk[key]; } return; }
    if (mk[key]) { glide(mk[key], [p.lat, p.lon]); return; }
    mk[key] = window.L.marker([p.lat, p.lon], { icon: makeIcon(), keyboard: false, zIndexOffset: key === 'prov' ? 1000 : key === 'me' ? 900 : 0 })
      .addTo(map).bindTooltip(tip(label), { permanent: key === 'prov', direction: 'auto', className: 'mtip' });
  }
  function paintMarkers(fit) {
    if (!map || !RM) return;
    const L = window.L;
    const r = ride || { pickup: form.pick, drop: form.drop, type: form.type };
    const live = ride && RM.LIVE.includes(ride.status);
    const shop = !!typeOf(r.type).shop;
    setMk('pick', r.pickup, () => pinIcon('pick', shop ? 'basket' : 'pin'), shop ? T().mk.shop : T().mk.pick);
    setMk('drop', r.drop, () => pinIcon('drop', 'flag'), shop ? T().mk.dropShop : T().mk.drop);
    setMk('prov', live ? other : null, () => vehIcon(r.type), `${who(r.type)}${ride?.providerName ? ': ' + ride.providerName : ''}`);
    setMk('me', live && ride.status !== 'on_trip' ? mine : null, meIcon, T().mk.you);
    // dashed straight lines and the chip: how far, about how many minutes
    if (!lines) lines = L.layerGroup().addTo(map);
    lines.clearLayers();
    const css = getComputedStyle(document.documentElement);
    const ok = css.getPropertyValue('--ok').trim() || '#1F7A4F', brand = css.getPropertyValue('--accent').trim() || '#0B4A4E';
    const dash = (a, b, color) => L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color, weight: 4, opacity: 0.9, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(lines);
    const st = ride ? ride.status : 'new';
    const prov = live ? other : null;
    if (prov && r.pickup && ['accepted', 'arrived'].includes(st)) dash(prov, r.pickup, ok);
    if (r.pickup && r.drop && ['new', 'requested', 'accepted', 'arrived'].includes(st)) dash(r.pickup, r.drop, brand);
    if (prov && r.drop && st === 'on_trip') dash(prov, r.drop, brand);
    const eta = (m) => `${dist(m)} · ~${num(RM.etaMinutes(m * RM.ROAD_FACTOR, r.type))} ${T().min}`;
    chip(prov && st === 'accepted' ? fill(T().chipAway, { who: who(r.type), d: eta(RM.metres(prov, r.pickup)) })
      : st === 'arrived' ? fill(T().chipArrived, { who: who(r.type) })
      : prov && r.drop && st === 'on_trip' ? fill(T().chipDest, { d: eta(RM.metres(prov, r.drop)) })
      : !ride && r.pickup && r.drop ? fill(T().chipStraight, { a: dist(RM.metres(r.pickup, r.drop)), b: dist(RM.estimateMetres(r.pickup, r.drop)) }) : '');
    const pts = Object.values(mk).map((m) => m.getLatLng());
    const inner = map.getBounds().pad(-0.12);
    if (pts.length > 1 && (fit || st !== lastFit || pts.some((p) => !inner.contains(p)))) {
      map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 40], paddingBottomRight: [40, 70], maxZoom: 16, animate: false });
      lastFit = st;
    }
  }

  /* ---------- the form ---------- */
  function syncInputs() {
    const p = view?.querySelector('#dkPick'), d = view?.querySelector('#dkDrop');
    if (p) p.value = form.pickLabel; if (d) d.value = form.dropLabel;
  }
  function readInputs() {
    const v = (id) => view?.querySelector(id)?.value;
    if (v('#dkPick') != null) form.pickLabel = v('#dkPick');
    if (v('#dkDrop') != null) form.dropLabel = v('#dkDrop');
    if (v('#dkItems') != null) form.items = v('#dkItems');
    if (v('#dkMax') != null) form.maxItems = v('#dkMax');
  }
  function field(id, label, value, { ph = '', max = 80, area = false, tel = false } = {}) {
    const l = el('label', null, label); l.htmlFor = id;
    const i = el(area ? 'textarea' : 'input'); i.id = id; i.maxLength = max; i.value = value || ''; i.placeholder = ph;
    if (area) i.rows = 3; else { i.type = tel ? 'tel' : 'search'; if (tel) i.inputMode = 'numeric'; }
    i.addEventListener('input', readInputs);
    return [l, i];
  }
  function pills(...kids) { const p = el('div', 'pills'); p.append(...kids); return p; }
  async function quickPicks() {
    const er = typeOf(form.type).shop;
    const cats = er ? ['pharmacy', 'market'] : form.type === 'ambulance' ? ['hospital'] : form.type === 'towing' ? ['repair', 'fuel'] : ['market', 'transport'];
    try { quick = (await ctx.near.nearby(cats, er ? 3 : 2)).slice(0, er ? 6 : 4); } catch { quick = []; }
  }
  function formPage() {
    const t = typeOf(form.type), shop = !!t.shop, errand = !!t.errand;
    const top = card();
    const h = el('h1', 'page-title', T().title); h.id = 'dakunTitle'; h.tabIndex = -1;
    top.append(el('p', 'eyebrow', `${T().tab} · ${here.label}`), h, el('p', 'muted', T().intro),
      pills(btn('btn', ctx.provideTexts().signInDriver, 'wrench', () => ctx.go('provide'))));   // drivers and helpers sign in here
    // the eight services
    const grid = el('div', 'tgrid');
    for (const x of RM.RIDE_TYPES) {
      const b = el('button', 'tcard'); b.type = 'button'; b.dataset.type = x.id; b.setAttribute('aria-pressed', String(x.id === form.type));
      const sq = el('span', 'cat-ic sm'); sq.append(icon(TYPE_IC[x.id]));
      b.append(sq, el('span', null, T().short[x.id] || name(x.id)));
      b.addEventListener('click', () => chooseType(x.id));
      grid.append(b);
    }
    const what = card(el('h2', null, T().need), grid, el('p', 'dk-chosen', name(form.type)),
      ['ambulance', 'help'].includes(form.type) ? warn999() : null);
    // where
    const where = card(el('h2', null, T().where));
    where.append(...field('dkPick', shop ? (errand ? T().pickErrand : T().pickPickup) : form.type === 'towing' ? T().pickTow : T().pick, form.pickLabel,
      { ph: shop ? T().pickPhShop : T().pickPh }));
    if (shop && quick.length) where.append(pills(...quick.map((p) => btn('pill', `${p.name} · ${dist(p.km * 1000)}`, null, () => {
      form.pick = { lat: r5(p.lat), lon: r5(p.lon) }; form.pickLabel = p.name.slice(0, 80); syncInputs(); paintMarkers(true); paintEst();
    }))));
    const gps = btn('btn', shop ? T().myLocShop : T().myLoc, 'locate', useGps);
    const modes = t.dest ? [['pick', shop ? T().mapShop : T().mapPick], ['drop', shop ? T().mapMe : T().mapDrop]].map(([k, label]) => {
      const b = btn('pill', label, null, () => { form.picking = k; readInputs(); modesBox.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mode === k))); });
      b.dataset.mode = k; b.setAttribute('aria-pressed', String(form.picking === k)); return b;
    }) : [];
    const modesBox = pills(gps, ...modes);
    where.append(modesBox);
    if (t.dest) {
      where.append(...field('dkDrop', shop ? T().dropShop : T().drop, form.dropLabel, { ph: shop ? T().dropPhShop : T().dropPh }));
      if (!shop && quick.length) where.append(pills(...quick.map((p) => btn('pill', p.name, null, () => {
        form.drop = { lat: r5(p.lat), lon: r5(p.lon) }; form.dropLabel = p.name.slice(0, 80); syncInputs(); paintMarkers(true); paintEst();
      }))));
    } else where.append(el('p', 'small', fill(T().comes, { who: who(form.type) })));
    if (shop && !errand) where.append(...field('dkItems', T().itemsPickup, form.items, { ph: T().itemsPickupPh, max: 300, area: true }), note(T().pickupNote));
    if (errand) where.append(...field('dkItems', T().itemsErrand, form.items, { ph: T().itemsErrandPh, max: 300, area: true }),
      ...field('dkMax', T().maxItems, form.maxItems, { ph: T().maxPh, max: 5, tel: true }), note(T().errandNote));
    const mapWrap = el('div', 'dk-mapwrap'); const mapBox = el('div', 'dk-map'); mapBox.setAttribute('role', 'region'); mapBox.setAttribute('aria-label', T().mapLabel);
    mapWrap.append(mapBox);
    const est = el('div', 'dk-est');
    const go = btn('btn solid big dk-go', shop ? (errand ? T().goErrand : T().goPickup) : fill(T().go, { who: who(form.type) }), TYPE_IC[form.type], callGo);
    const msg = el('div', 'small dk-msg'); msg.setAttribute('role', 'status');
    where.append(mapWrap, est, go, msg);
    // earlier calls
    const hist = el('div', 'dk-hist');
    const histHead = el('div', 'sec-head'); histHead.append(el('h2', null, T().history), btn('linkbtn', T().showHistory, null, () => showHistory(hist)));
    // সেবা দিতে চান? → the provider page (R4)
    const P = ctx.provideTexts();
    const give = card(el('h2', null, P.wantToProvide), pills(btn('btn', P.iProvide, 'wrench', () => ctx.go('provide'))));
    const fallback = el('section', 'card dk-fallback');
    view.replaceChildren(top, what, where, fallback, card(histHead, hist), give);
    paintFallback();
    paintEst();
    drawMap();
  }
  const warn999 = () => { const n = el('div', 'note dk-note'); n.append(icon('alert', { size: 'sm' }));
    const p = el('p'); const a = el('a', null, T().n999); a.href = 'tel:999'; p.append(T().warn999a, a, T().warn999b); n.append(p); return n; };
  // "never stranded" (SRS FR12, UC-13 3.1): nobody online (or not known yet) → 999, the area's official numbers and the
  // nearest hospital and bus stand or ghat; the request can still be sent. Hidden while someone is online.
  let fbRun = 0;
  async function paintFallback() {
    const box = view?.querySelector('.dk-fallback'); if (!box) return;
    if (form.online && form.online.length) { box.hidden = true; return; }
    box.hidden = false;
    const run = ++fbRun;
    const call = el('a', 'btn red', T().n999); call.href = 'tel:999'; call.prepend(icon('phone', { size: 'sm' }));
    const kids = [el('h2', null, form.online ? fill(T().noneTitle, { who: who(form.type) }) : T().ifNobody), el('p', 'muted', T().fallbackText), pills(call)];
    const a = await ctx.near.area();
    const rows = a ? ctx.officialRows(a) : null;
    if (rows && rows.length) { const list = el('div', 'first'); list.append(...rows.slice(0, 4)); kids.push(el('h3', null, T().officialHere), list); }
    const near = [];
    for (const [cats, label] of [[['hospital'], T().nearHospital], [['transport'], T().nearStand]]) {
      const [p] = await ctx.near.nearby(cats, 1);
      if (!p) continue;
      const row = el('div', 'r near-row'); const sq = el('span', 'cat-ic sm'); sq.append(icon(cats[0] === 'hospital' ? 'health' : 'bus', { size: 'sm' }));
      const b = el('div'); b.append(el('div', 't', label), el('div', 'm', `${p.name} · ${dist(p.km * 1000)}`));
      const acts = el('div', 'acts'); const g = el('a', 'btn', T().mapLink); g.href = `#/c/${p.cat}/${encodeURIComponent(p.id)}`;
      g.prepend(icon('nav', { size: 'sm' })); acts.append(g);
      row.append(sq, b, acts); near.push(row);
    }
    if (near.length) { const rs = el('div', 'rows'); rs.append(...near); kids.push(rs); }
    if (run === fbRun && box.isConnected) box.replaceChildren(...kids);
  }
  function paintEst() {
    const box = view?.querySelector('.dk-est'); if (!box || !RM) return;
    const t = RM.typeOf(form.type), rt = rates && rates[form.type];
    if (!rates) { box.replaceChildren(el('div', 'skeleton')); return; }
    if (!rt) { box.replaceChildren(note(T().err.norates)); return; }
    const rateLine = fill(T().rateLine, { base: tk(rt.base), perKm: tk(rt.perKm), min: tk(rt.minFare) });
    // how many providers of this service work in the district now: shown before the destination is chosen too
    const on = form.online == null ? '' : form.online.length ? fill(T().online, { n: num(form.online.length), who: who(form.type) }) : fill(T().noneOnline, { who: who(form.type) });
    const onLine = on ? el('p', 'small dk-online', on) : null;
    if (t.shop && !form.pick) { box.replaceChildren(...[onLine, el('p', 'small', `${T().needShopEst} ${rateLine}`)].filter(Boolean)); return; }
    if (t.dest && !form.drop) { box.replaceChildren(...[onLine, el('p', 'small', `${T().needDropEst} ${rateLine}`)].filter(Boolean)); return; }
    const m = t.dest ? RM.estimateMetres(form.pick, form.drop) : 0, f = RM.fare(rt, m, 0);
    const bill = el('div', 'bill');
    const row = (a, b, cls) => { const d = el('div', cls); d.append(el('span', null, a), el('b', null, b)); bill.append(d); };
    let after;
    if (form.type === 'pickup') { row(T().itemsPrice, T().itemsPaid); row(fill(T().deliveryFare, { d: dist(m) }), tk(f)); after = T().pickupPay; }
    else if (t.errand) { row(T().itemsPrice, T().itemsReceipt); row(fill(T().deliveryFare, { d: dist(m) }), tk(f)); after = T().errandPay; }
    else {
      row(T().estFare, form.type === 'help' ? T().free : tk(f));
      if (t.dest) { row(T().distRoad, dist(m)); row(T().time, `${num(RM.etaMinutes(m, form.type))} ${T().min}`); }
      after = T().finalNote;
    }
    box.replaceChildren(bill, el('p', 'small', on ? `${on} · ${after}` : after));
  }
  async function chooseType(id) {
    readInputs();
    const was = !!typeOf(form.type).shop, now = !!typeOf(id).shop;
    form.type = id; form.online = null;
    // a shop job turns the two points round (pickup = the shop, drop = the person), so start them again
    if (was !== now) {
      const me = here ? { lat: r5(here.lat), lon: r5(here.lon) } : null;
      Object.assign(form, now ? { pick: null, drop: me, pickLabel: '', dropLabel: here.label.slice(0, 80), picking: 'pick' }
        : { pick: me, drop: null, pickLabel: here.label.slice(0, 80), dropLabel: '', picking: 'drop' });
    }
    if (!typeOf(id).dest) form.drop = null;
    await quickPicks();
    formPage(); refreshOnline();
  }
  function useGps() {
    const m = view.querySelector('.dk-msg');
    if (!navigator.geolocation) { m.textContent = T().noGps; return; }
    m.textContent = T().finding;
    locate((p) => {
      const la = r5(p.coords.latitude), lo = r5(p.coords.longitude);
      if (!RM.inBangladesh(la, lo)) { m.textContent = T().outsideBd; return; }
      if (typeOf(form.type).shop) { form.drop = { lat: la, lon: lo }; m.textContent = T().gpsDrop; }
      else { form.pick = { lat: la, lon: lo }; m.textContent = T().gpsPick; }
      paintMarkers(true); paintEst();
    }, (e) => { m.textContent = e && e.code === 1 ? T().gpsDenied : T().gpsFailed; }, { precise: false, timeout: 15000 });
  }
  async function refreshOnline() {
    try {
      const [fb, cm] = await load(); if (!(await fb.currentUser())) return;
      form.online = await fb.onlineCount(form.type, cm.districtKey(here.district)); paintEst(); paintFallback();
    } catch { /* not checked yet, or offline: the line is just not shown */ }
  }

  async function callGo() {
    const msg = view.querySelector('.dk-msg'); msg.textContent = '';
    readInputs();
    const t = RM.typeOf(form.type);
    form.pickLabel = form.pickLabel.trim(); form.dropLabel = form.dropLabel.trim();
    const say = (k, focus) => { msg.textContent = T().check[k]; if (focus) view.querySelector(focus)?.focus(); };
    try { if (!(await needUser(msg, T().whyCall))) return; } catch (e) { msg.textContent = errText(e); return; }
    if (noRates() || !rates[form.type]) { try { const [fb, cm] = await load(); rates = await fb.readRates(cm.districtKey(here.district)); paintEst(); } catch { /* said below */ } }
    const rt = rates && rates[form.type];
    if (!rt) { msg.textContent = T().err.norates; return; }
    if (form.pickLabel.length < 2) return say(t.shop ? 'shopName' : 'pickName', '#dkPick');
    if (t.dest && !form.drop) return say('needDrop');
    if (t.dest && form.dropLabel.length < 2) return say('dropName', '#dkDrop');
    if ([form.pickLabel, form.dropLabel].some(HP)) return say('noPhone');
    let maxItems = 0;
    if (t.shop) {
      if (!form.pick) return say('needShop');
      form.items = form.items.trim();
      if (form.items.length < 2) return say(t.errand ? 'itemsErrand' : 'itemsPickup', '#dkItems');
      if (HP(form.items)) return say('noPhone');
    }
    if (t.errand) {
      maxItems = Number(String(form.maxItems).trim().replace(/[০-৯]/g, (x) => '০১২৩৪৫৬৭৮৯'.indexOf(x)));
      if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > RM.ITEMS_MAX) { msg.textContent = fill(T().check.maxRange, { max: num(RM.ITEMS_MAX) }); view.querySelector('#dkMax')?.focus(); return; }
    }
    if (!form.pick) return say('pickName');
    msg.textContent = T().sending;
    try {
      const [fb, cm] = await load();
      const pk = { lat: r3(form.pick.lat), lon: r3(form.pick.lon) }, dp = t.dest ? { lat: r3(form.drop.lat), lon: r3(form.drop.lon) } : null;
      const estM = t.dest ? RM.estimateMetres(pk, dp) : 0;
      const f = { type: form.type, district: cm.districtKey(here.district), pickup: { ...pk, label: form.pickLabel.slice(0, 80) }, estM, estFare: RM.fare(rt, estM, 0) };
      if (t.dest) f.drop = { ...dp, label: form.dropLabel.slice(0, 80) };
      if (t.shop) f.items = form.items.slice(0, 300);
      if (t.errand) f.maxItems = maxItems;
      const id = await fb.requestRide(f);
      store.set('sc-ride', id);
      ride = { id, ...f, status: 'requested' };
      ridePage();
      follow(id);
    } catch (e) { msg.textContent = errText(e); }
  }

  /* ---------- the ride: one live page ---------- */
  async function follow(id) {
    const [fb] = await load();
    stopRide();
    if (noRates()) { try { rates = await fb.readRates(ride?.district); } catch { rates = {}; } }
    rideUnsub = fb.watchRide(id, onRide, (e) => {
      // A ride this account may not read (it was made by another account on this phone) or that cannot be found: forget it
      // and show the form. Before, this left the grey loading box for ever.
      if (e && e.code === 'permission-denied') { stopRide(); ride = null; store.set('sc-ride', ''); if (view?.isConnected) show(view); return; }
      const m = view?.querySelector('.dk-ridemsg'); if (m) m.textContent = errText(e);
    });
  }
  async function onRide(r) {
    const [fb] = await load();
    const was = ride ? ride.status : null;
    ride = r;
    if (!r) { stopRide(); store.set('sc-ride', ''); if (view?.isConnected) show(view); return; }
    const live = RM.LIVE.includes(r.status);
    if (live && !liveUnsub) liveUnsub = fb.watchLive(r.id, 'provider', (p) => { other = p; paint(); }, () => {});
    if (live) startGeo(); else { stopGeo(); if (liveUnsub) { liveUnsub(); liveUnsub = null; } other = null; }
    if (['completed', 'paid', 'cancelled'].includes(r.status) && was && RM.LIVE.includes(was)) fb.clearLive(r.id).catch(() => {});
    if (was && was !== r.status) ctx.toast(T().status[r.status] || r.status);
    paint(true);
  }
  function paint(changed) {
    if (!view?.isConnected || !ride) return;
    const panel = view.querySelector('.dk-panel');
    if (!panel) { ridePage(); return; }
    if (changed || ride.status === 'accepted') panel.replaceChildren(...riderPanel());
    paintMarkers();
  }
  function stopGeo() { if (geoId != null) navigator.geolocation.clearWatch(geoId); geoId = null; }
  function stopRide() { stopGeo(); if (rideUnsub) rideUnsub(); if (liveUnsub) liveUnsub(); rideUnsub = liveUnsub = null; other = mine = null; lastSent = null; }
  // our own position while the ride is live: sent at most every 8 s and only after 25 m, or once a minute
  function startGeo() {
    if (geoId != null || !navigator.geolocation) return;
    geoId = navigator.geolocation.watchPosition((p) => gotPos(r5(p.coords.latitude), r5(p.coords.longitude)), () => {
      const m = view?.querySelector('.dk-ridemsg'); if (m) m.textContent = T().gpsLost;
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  async function gotPos(lat, lon) {
    if (!ride || !RM.inBangladesh(lat, lon)) return;
    const p = { lat, lon, at: Date.now() };
    mine = p;
    if (ride.status === 'on_trip') { paintMarkers(); return; }     // in the vehicle: the provider's point shows both
    const due = !lastSent || (p.at - lastSent.at >= 8000 && RM.metres(lastSent, p) >= 25) || p.at - lastSent.at >= 60000;
    if (due) { lastSent = p; try { const [fb] = await load(); await fb.sendLive(ride.id, 'rider', lat, lon); } catch { /* the next point tries again */ } }
    paintMarkers();
  }
  function ridePage() {
    const top = card();
    const h = el('h1', 'page-title', name(ride.type)); h.id = 'dakunTitle'; h.tabIndex = -1;
    const panel = el('div', 'dk-panel'); panel.append(...riderPanel());
    top.append(el('p', 'eyebrow', T().tab), h, panel);
    const mapWrap = el('div', 'dk-mapwrap'); const mapBox = el('div', 'dk-map'); mapBox.setAttribute('role', 'region'); mapBox.setAttribute('aria-label', T().mapLabel);
    mapWrap.append(mapBox);
    view.replaceChildren(top, card(mapWrap));
    drawMap();
  }
  function stepper(st) {
    if (st === 'cancelled') return el('span', 'badge', T().status.cancelled);
    const k = RSTEPS.indexOf(st), ol = el('ol', 'dk-steps'); ol.setAttribute('aria-label', T().stepsLabel);
    RSTEPS.forEach((x, i) => ol.append(el('li', i < k ? 'done' : i === k ? 'now' : '', T().steps[x])));
    return ol;
  }
  function provLine(r) {
    const row = el('div', 'r near-row'); const sq = el('span', 'cat-ic sm'); sq.append(icon(TYPE_IC[r.type]));
    const b = el('div'); b.append(el('div', 't', r.providerName || ''), el('div', 'm', r.vehicle || '')); row.append(sq, b);
    const rows = el('div', 'rows'); rows.append(row); return rows;
  }
  function billBox(r) {
    const rt = rates && rates[r.type];
    if (!rt) return [el('div', 'okbox', `${T().total}: ${tk(RM.billTotal(r))}`)];
    const p = RM.fareParts(rt, r.distM || 0, r.waitMin || 0);
    const odd = !RM.billLooksRight(rt, r.distM || 0, r.waitMin || 0, r.fare || 0) || RM.distanceSuspicious(r.estM || 0, r.distM || 0);
    const bill = el('div', 'bill');
    const row = (a, b, cls) => { const d = el('div', cls); d.append(el('span', null, a), el('b', null, b)); bill.append(d); };
    const er = r.type === 'errand';
    if (r.type === 'pickup') row(T().itemsPrice, T().itemsPaid);
    if (er) row(fill(T().itemsRow, { t: tk(r.maxItems || 0) }), tk(r.itemsCost || 0));
    row(er ? T().deliveryStart : T().start, tk(p.base));
    row(fill(T().distRow, { km: num(p.km.toFixed(1)), per: tk(rt.perKm) }), tk(p.distance));
    row(fill(T().waitRow, { n: num(r.waitMin || 0) }), tk(p.waiting));
    if (er) { row(fill(T().deliveryRow, { min: tk(rt.minFare) }), tk(r.fare || 0)); row(T().total, tk(RM.billTotal(r)), 'total'); }
    else row(fill(T().totalRound, { min: tk(rt.minFare) }), tk(r.fare || 0), 'total');
    return [bill, odd ? note(T().odd, 'alert') : null].filter(Boolean);
  }
  function itemsBox(r) {
    const b = el('div', 'okbox'); b.append(icon(TYPE_IC[r.type], { size: 'sm' }), ` ${r.items || ''}`, el('br'),
      el('span', 'small', `${r.type === 'errand' ? fill(T().maxLine, { t: tk(r.maxItems || 0) }) : T().itemsPaid} · ${fill(T().fromShop, { place: r.pickup.label })}`));
    return b;
  }
  const cancelBtn = (fee) => pills(btn('btn ghost', `${T().cancel} ${fee ? fill(T().charge, { f: tk(fee) }) : T().noCharge}`, null, () => act('cancel')));
  function riderPanel() {
    const r = ride; if (!r || !RM) return [el('div', 'skeleton')];
    const t = RM.typeOf(r.type), rt = rates && rates[r.type], w = who(r.type);
    const out = [stepper(r.status)];
    const far = (goal) => (other ? RM.metres(other, goal) : null);
    const etaText = (m) => (m == null ? T().posComing : fill(T().away, { d: dist(m), m: num(RM.etaMinutes(m * RM.ROAD_FACTOR, r.type)) }));
    if (t.shop && ['requested', 'accepted', 'arrived', 'on_trip'].includes(r.status)) {
      if (r.status === 'requested') out.push(el('h2', null, T().searchingRider), itemsBox(r), el('p', 'muted', `${fill(T().estDelivery, { f: tk(r.estFare) })}${r.type === 'errand' ? T().plusItems : ''}`), cancelBtn(0));
      else if (r.status === 'accepted') out.push(el('h2', null, T().toShop), provLine(r), el('p', 'muted', `${r.pickup.label}: ${etaText(far(r.pickup))}`), itemsBox(r), cancelBtn(0));
      else if (r.status === 'arrived') out.push(el('h2', null, r.type === 'errand' ? T().buying : T().collecting), provLine(r), itemsBox(r),
        r.type === 'errand' ? el('p', 'small', fill(T().receiptLimit, { t: tk(r.maxItems || 0) })) : null, cancelBtn(rt ? RM.cancelFee(rt, 'arrived') : 0));
      else out.push(el('h2', null, T().bringing), provLine(r), el('p', 'muted', etaText(far(r.drop))), itemsBox(r));
    } else if (r.status === 'requested') {
      out.push(el('h2', null, fill(T().searching, { who: w })),
        el('p', 'muted', `${r.pickup.label}${r.drop ? ' → ' + r.drop.label : ''} · ${T().estShort} ${r.type === 'help' ? T().free : tk(r.estFare)}`),
        el('p', 'small', fill(T().willShow, { what: ['technician', 'help'].includes(r.type) ? T().whatId : T().whatVehicle })), cancelBtn(0));
    } else if (r.status === 'accepted' || r.status === 'arrived') {
      out.push(el('h2', null, fill(r.status === 'arrived' ? T().arrived : T().coming, { who: w })), provLine(r),
        el('p', 'muted', r.status === 'accepted' ? etaText(far(r.pickup)) : fill(T().waiting, { place: r.pickup.label })),
        pills(shareBtn(r)), cancelBtn(r.status === 'arrived' && rt ? RM.cancelFee(rt, 'arrived') : 0));
    } else if (r.status === 'on_trip') {
      const fam = el('div', 'dk-family');
      out.push(el('h2', null, r.type === 'technician' ? T().working : r.type === 'help' ? T().helping : T().onTrip), provLine(r),
        r.drop ? el('p', 'muted', fill(T().toward, { place: r.drop.label })) : null,
        pills(shareBtn(r), btn('btn', T().family, 'msg', () => familyMsg(fam))), fam);
    } else if (r.status === 'completed') {
      out.push(el('h2', null, T().bill), provLine(r), ...billBox(r), el('p', 'muted', fill(T().payCash, { who: w, t: tk(RM.billTotal(r)) })),
        'billOk' in r ? el('p', 'small', `${T().youSaid}: ${r.billOk ? T().billOk : T().billWrong}`)
          : pills(btn('btn', T().billOk, 'check', () => act('billOk', true)), btn('btn ghost', T().billWrong, null, () => act('billOk', false))));
    } else if (r.status === 'paid') {
      const txt = RM.receiptText(r, (x) => num(x));
      const stars = el('div', 'dk-stars');
      if (!('rating' in r)) [1, 2, 3, 4, 5].forEach((n) => { const s = btn('dk-star', '★', null, () => act('rate', n)); s.setAttribute('aria-label', fill(T().stars, { n: num(n) })); stars.append(s); });
      out.push(el('h2', null, T().paid), el('pre', 'okbox dk-receipt', txt),
        pills(btn('btn', T().copy, 'copy', () => copy(txt)), btn('btn', T().share, 'share', () => share(txt))),
        'rating' in r ? el('p', 'small', `${T().yourRating}: ${'★'.repeat(r.rating)}`) : el('p', 'muted', fill(T().howWas, { who: w })),
        'rating' in r ? null : stars,
        'billOk' in r ? null : pills(btn('btn ghost', T().billWrong, null, () => act('billOk', false))),
        pills(btn('btn solid', T().newCall, null, () => act('new'))));
    } else {
      out.push(el('h2', null, T().cancelled), el('p', 'muted', `${r.cancelledBy === 'provider' ? fill(T().byProvider, { who: w }) : r.cancelledBy === 'stale' ? T().byStale : T().byYou}${r.cancelFee ? ' ' + fill(T().feeCash, { f: tk(r.cancelFee) }) : ''}`),
        pills(btn('btn solid', T().newCall, null, () => act('new'))));
    }
    // no change for 3 hours (12 once the trip started): the rider may close it, so the page is never stuck on it
    const quiet = ['accepted', 'arrived', 'on_trip', 'completed'].includes(r.status) && r.updatedAt && Date.now() - r.updatedAt > (['accepted', 'arrived'].includes(r.status) ? 3 : 12) * 3600000;
    if (quiet) out.push(note(T().stuck), pills(btn('btn', T().closeStale, null, () => act('stale'))));
    const m = el('div', 'small dk-ridemsg'); m.setAttribute('role', 'status'); out.push(m);
    return out.filter(Boolean);
  }
  async function act(what, arg) {
    const m = view.querySelector('.dk-ridemsg');
    try {
      const [fb] = await load();
      if (what === 'cancel') {
        const fee = ride.status === 'arrived' && rates?.[ride.type] ? RM.cancelFee(rates[ride.type], 'arrived') : 0;
        if (fee && !confirm(fill(T().confirmFee, { who: who(ride.type), f: tk(fee) }))) return;
        await fb.cancelRide(ride.id, 'rider', fee); if (RM.LIVE.includes(ride.status)) await fb.clearLive(ride.id); return;
      }
      if (what === 'billOk') { await fb.billOk(ride.id, arg); ctx.toast(T().thanksTold); return; }
      if (what === 'rate') { await fb.rateRide(ride.id, arg); ctx.toast(T().thanks); return; }
      if (what === 'stale') { await fb.closeStale(ride.id); await fb.clearLive(ride.id); return; }
      if (what === 'new') { stopRide(); ride = null; store.set('sc-ride', ''); form.drop = null; form.dropLabel = ''; show(view); }
    } catch (e) { if (m) m.textContent = errText(e); }
  }
  // "পরিবারকে লাইভ দেখান": a live share with this ride's vehicle and destination (Safe Commute filled in)
  const shareBtn = (r) => btn('btn solid', T().shareLive, 'locate', () => ctx.shareRide({
    vehicleNo: String(r.vehicle || '').slice(0, 30), vehicleType: SHARE_VEHICLE[r.type] || 'other',
    ...(r.drop && r.drop.label ? { destination: String(r.drop.label).slice(0, 60) } : {}),
  }));
  function familyMsg(box) {
    const r = ride;
    const text = fill(T().familyText, { what: name(r.type), from: r.pickup.label, to: r.drop ? fill(T().familyTo, { place: r.drop.label }) : '', who: who(r.type), name: r.providerName || '', veh: r.vehicle || '' });
    const a = el('a', 'btn solid', T().openSms); a.href = `sms:?body=${encodeURIComponent(text)}`; a.prepend(icon('msg', { size: 'sm' }));
    box.replaceChildren(el('div', 'okbox', text), pills(a, btn('btn', T().copy, 'copy', () => copy(text))));
  }
  async function copy(text) { try { await navigator.clipboard.writeText(text); ctx.toast(T().copied); } catch { ctx.toast(T().copyFailed); } }
  async function share(text) { try { if (navigator.share) await navigator.share({ text }); else await copy(text); } catch { /* closed */ } }
  async function showHistory(box) {
    box.replaceChildren(el('div', 'skeleton'));
    try {
      if (!(await needUser(box, T().whyHistory))) return;
      const [fb] = await load(); const list = (await fb.myRides('rider')).slice(0, 10);
      if (!list.length) { box.replaceChildren(el('p', 'muted', T().noHistory)); return; }
      const rows = el('div', 'rows');
      for (const r of list) {
        const row = el('div', 'r near-row'); const sq = el('span', 'cat-ic sm'); sq.append(icon(TYPE_IC[r.type] || 'car'));
        const b = el('div');
        b.append(el('div', 't', `${T().short[r.type] || name(r.type)} · ${r.pickup?.label || ''}${r.drop ? ' → ' + r.drop.label : ''}`),
          el('div', 'm', `${T().status[r.status] || r.status}${r.fare != null ? ' · ' + tk(r.fare) : ''}`));
        row.append(sq, b);
        if (r.status === 'paid') { const acts = el('div', 'acts'); acts.append(btn('btn ghost', T().receipt, null, () => copy(RM.receiptText(r, (x) => num(x))))); row.append(acts); }
        rows.append(row);
      }
      box.replaceChildren(rows);
    } catch (e) { box.replaceChildren(el('p', 'note', errText(e))); }
  }

  /* ---------- the page ---------- */
  async function show(v) {
    view = v;
    closeMap();
    v.replaceChildren(el('div', 'skeleton'));
    try { await loadRide(); HP = HP || (await import('./reports.js')).hasPhone; } catch { v.replaceChildren(el('p', 'note', T().err.unavailable)); return; }
    here = await ctx.near.here();
    if (!view.isConnected) return;
    if (!here) {
      const h = el('h1', 'page-title', T().title); h.id = 'dakunTitle'; h.tabIndex = -1;
      const b = btn('btn solid', T().chooseArea, 'pin', () => ctx.pickArea());
      v.replaceChildren(card(h, el('p', 'muted', T().needArea), b));
      return;
    }
    if (ride) { ridePage(); return; }
    // a ride left open on this phone (another tab, a reload): only when signed in, so Firebase loads only then
    const open = store.get('sc-ride');
    if (open) { try { const [fb] = await load(); if (await fb.currentUser()) { follow(open); v.replaceChildren(el('div', 'skeleton')); return; } } catch { /* signed out */ } }
    if (form.area !== here.label) {
      const me = { lat: r5(here.lat), lon: r5(here.lon) };
      const shop = !!typeOf(form.type).shop;
      Object.assign(form, { area: here.label, pick: shop ? null : me, drop: shop ? me : null, pickLabel: shop ? '' : here.label.slice(0, 80), dropLabel: shop ? here.label.slice(0, 80) : '' });
    }
    await quickPicks();
    formPage();
    // the rates and the online count come in the background; the form works meanwhile
    (async () => { if (noRates()) { try { const [fb, cm] = await load(); rates = await fb.readRates(cm.districtKey(here.district)); } catch { rates = {}; } paintEst(); } refreshOnline(); })();
  }
  // From a place page: "এখানে যেতে ডাকুন" (pickup = the area, destination = the place), an ambulance to a hospital,
  // "কিনে এনে দিন" from a shop, or a tow to a workshop. The person can still change everything on the form.
  function callTo(p, mode) {
    const at = { lat: r5(p.lat), lon: r5(p.lon) }, label = String(p.name || '').slice(0, 80);
    const set = mode === 'errand' ? { type: 'errand', pick: at, pickLabel: label, picking: 'pick' }
      : { type: mode === 'amb' ? 'ambulance' : mode === 'tow' ? 'towing' : 'cng', drop: at, dropLabel: label, picking: 'drop' };
    form.area = '';                       // fill the area's own point again on show()
    pendingSet = set;
    ctx.go('dakun');
  }
  let pendingSet = null;
  const showOuter = show;
  async function showWithPending(v) {
    if (pendingSet && !ride) {
      const set = pendingSet; pendingSet = null;
      form.type = set.type;
      await showOuter(v);
      if (ride || !here) return;
      const me = { lat: r5(here.lat), lon: r5(here.lon) };
      if (set.type === 'errand') Object.assign(form, { pick: set.pick, pickLabel: set.pickLabel, drop: me, dropLabel: here.label.slice(0, 80), picking: 'pick' });
      else Object.assign(form, { pick: me, pickLabel: here.label.slice(0, 80), drop: set.drop, dropLabel: set.dropLabel, picking: 'drop' });
      formPage(); refreshOnline();
      return;
    }
    return showOuter(v);
  }
  return { show: showWithPending, close: closeMap, callTo, title: () => (ride ? name(ride.type) : T().tab) };
}
