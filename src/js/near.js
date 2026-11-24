// Categories near the person (R1 of plan v4, #267): 12 categories in all 64 districts, a map inside the page with the
// nearest place in green, the list, and a place page ("ফ্রি সহায়তা" first). Data: data/places/ (OpenStreetMap, ODbL;
// official fuel lists) and data/upazila_centres.json. The area is kept on this phone as names only, never as a position;
// a GPS position stays in memory for distances and is never stored or sent (CLAUDE.md rule 5).
// Everything is built with createElement + textContent; Leaflet loads only when a map is shown.
import { icon } from './icons.js';
import { locate } from './geo.js';

export const CATS = [
  { id: 'hospital', ic: 'health', match: (p) => p.category === 'health' && ['hospital', 'clinic', 'doctors'].includes(p.subcategory) },
  { id: 'pharmacy', ic: 'pill', match: (p) => ['pharmacy', 'chemist'].includes(p.subcategory) },
  { id: 'police', ic: 'shield', match: (p) => ['police', 'fire_station'].includes(p.subcategory) },
  { id: 'fuel', ic: 'fuel', match: (p) => p.subcategory === 'fuel' || p.source === 'official' },
  { id: 'transport', ic: 'bus', match: (p) => ['bus_station', 'ferry_terminal', 'railway_station'].includes(p.subcategory) },
  { id: 'bank', ic: 'bank', match: (p) => p.category === 'money' },
  { id: 'market', ic: 'basket', match: (p) => p.category === 'shops' },
  { id: 'repair', ic: 'wrench', match: (p) => ['car_repair', 'motorcycle_repair', 'motorcycle', 'bicycle'].includes(p.subcategory) },
  { id: 'food', ic: 'bed', match: (p) => p.category === 'stay_food' },
  { id: 'post', ic: 'mail', match: (p) => p.subcategory === 'post_office' },
  { id: 'tourism', ic: 'wave', match: (p) => p.category === 'tourism' },
  { id: 'shelter', ic: 'shelter', match: (p) => p.category === 'shelter' },
];
const AREA_KEY = 'sc-near-area';          // { district, upazila } names only
const LIST_MAX = 40;
const R = 6371, rad = Math.PI / 180;
export const km = (a, b) => {
  const dLa = (b.lat - a.lat) * rad, dLo = (b.lon - a.lon) * rad;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

// Sunrise and sunset for a place, worked out on the phone (the sunrise equation, en.wikipedia.org/wiki/Sunrise_equation).
// The day is the date in Bangladesh (UTC+6). Accurate to about a minute; no weather and no outside service.
export function sunTimes(lat, lon, now = new Date()) {
  const r = Math.PI / 180;
  const day = new Date(now.getTime() + 6 * 3600000);
  const noon = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 6);   // 12:00 in Bangladesh
  const n = Math.round(noon / 86400000 + 2440587.5 - 2451545 + 0.0008 - 0.5);
  const J = n - lon / 360;
  const M = (357.5291 + 0.98560028 * J) % 360;
  const C = 1.9148 * Math.sin(M * r) + 0.02 * Math.sin(2 * M * r) + 0.0003 * Math.sin(3 * M * r);
  const L = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545 + J + 0.0053 * Math.sin(M * r) - 0.0069 * Math.sin(2 * L * r);
  const dec = Math.asin(Math.sin(L * r) * Math.sin(23.4397 * r));
  const cosW = (Math.sin(-0.833 * r) - Math.sin(lat * r) * Math.sin(dec)) / (Math.cos(lat * r) * Math.cos(dec));
  if (Math.abs(cosW) > 1) return null;
  const w = Math.acos(cosW) / r / 360;
  const toDate = (j) => new Date((j - 2440587.5) * 86400000);
  return { rise: toDate(transit - w), set: toDate(transit + w) };
}

export function initNear(ctx) {
  const { el, $, store } = ctx;
  const T = () => ctx.texts();
  const bnLang = () => ctx.lang() === 'bn';
  const num = (s) => ctx.digits(s);
  let base = null;                         // { centres, districts: [{en, bn, files}], labels }
  const placeCache = new Map();
  let me = null;                           // a GPS point in memory only
  let memArea = null;                      // the area while "এলাকা মনে রাখবেন না" is on (memory only)
  let mapObj = null, markers = [], leaflet = null;

  /* ---------- data ---------- */
  const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); };
  async function loadBase() {
    if (base) return base;
    const [c, idx] = await Promise.all([getJSON('data/upazila_centres.json'), getJSON('data/places/index.json')]);
    base = { centres: c.centres, labels: idx.unnamed_labels || {},
      districts: idx.districts.map((d) => ({ en: d.district_en, bn: d.district_bn, files: d.files.map((f) => f.file) })) };
    return base;
  }
  async function placesOf(districtEn) {
    if (!placeCache.has(districtEn)) {
      const d = base.districts.find((x) => x.en === districtEn);
      const files = d ? d.files : [];
      const officialSlug = files.length ? files[0].replace(/(-\d+)?\.json$/, '') : '';
      placeCache.set(districtEn, Promise.all([
        Promise.all(files.map((f) => getJSON(`data/places/${f}`))).then((xs) => xs.flatMap((x) => x.places)),
        officialSlug ? getJSON(`data/places/official_${officialSlug}.json`).then((o) => o.places.map((p) => ({ ...p, list: o.lists[p.list] }))).catch(() => []) : [],
      ]).then(([a, b]) => [...a, ...b]).catch((e) => { placeCache.delete(districtEn); throw e; }));
    }
    return placeCache.get(districtEn);
  }
  // the centres call a Sadar upazila by the district's name ("Noakhali"), other lists say "Noakhali Sadar" or "Sadar"
  const centreOf = (district, upazila) => {
    const inD = base.centres.filter((c) => c.district === district);
    const bare = String(upazila || '').replace(/\s*sadar$/i, '');
    return inD.find((c) => c.upazila_en === upazila) || inD.find((c) => c.upazila_en === bare)
      || (/sadar/i.test(upazila || '') && inD.find((c) => c.upazila_en === district || /sadar/i.test(c.upazila_en))) || null;
  };
  const districtBn = (en) => (base.districts.find((d) => d.en === en) || {}).bn || en;
  // OpenStreetMap English names sometimes end with the kind of place ("Nibir Pharmacy, Pharmacy"): the card already
  // shows the kind, so that tail is dropped. Area names after a comma ("..., Dhaka") are kept.
  const KIND_TAIL = new Set(['hospital', 'pharmacy', 'gas station', 'bank', 'market', 'restaurant', 'shopping mall', 'auto repair shop',
    'post office', 'auto parts store', 'bazar', 'homeopathic pharmacy', 'motorcycle repair shop', 'supermarket', 'fire station', 'doctor',
    'private hospital', 'hotel', 'coffee shop', 'motorcycle dealer', 'car repair and maintenance service', 'motorcycle parts store',
    'gas company', 'government hospital', 'cell phone store', 'fast food restaurant', 'mobile phone repair shop', 'medical center',
    'police station', 'public sector bank', 'motorcycle shop', 'private sector bank', 'family restaurant', 'tourist attraction',
    'general hospital', 'cafe', 'hostel', 'veterinary pharmacy', 'resort hotel']);
  const withoutKind = (n) => { const i = (n || '').lastIndexOf(', '); return i > 0 && KIND_TAIL.has(n.slice(i + 2).trim().toLowerCase()) ? n.slice(0, i) : n; };
  const nameOf = (p) => {
    if (p.source === 'official' && p.name_hidden) return bnLang() ? p.list.hidden_name_label_bn : p.list.hidden_name_label_en;
    const n = bnLang() ? (p.name_bn || withoutKind(p.name_en)) : (withoutKind(p.name_en) || p.name_bn);
    return n || (base.labels[p.subcategory] || {})[ctx.lang()] || T().noName;
  };

  /* ---------- the area (names only) ---------- */
  function getArea() {
    try {
      const a = ctx.remembers() ? JSON.parse(store.get(AREA_KEY) || 'null') : memArea;
      if (a && centreOf(a.district, a.upazila)) return a;
    } catch { /* broken: ask again */ }
    const last = ctx.lastArea();                 // the site's saved area (pilot districts: key + upazila name)
    if (last && !last.outside) {
      const d = base.districts.find((x) => slug(x.en) === last.district);
      if (d && centreOf(d.en, last.upazila)) return { district: d.en, upazila: last.upazila };
    }
    return null;
  }
  const setArea = (a) => {
    memArea = { district: a.district, upazila: a.upazila };
    if (ctx.remembers()) store.set(AREA_KEY, JSON.stringify(memArea));
  };
  // the site saved a newer area (search, "find help near me", auto location): that one counts from now on
  const forget = () => { memArea = null; store.set(AREA_KEY, ''); };
  const areaLabel = (a) => {
    const c = centreOf(a.district, a.upazila);
    const d = bnLang() ? districtBn(a.district) : a.district;
    // the centres call a Sadar upazila by the district's name: "নোয়াখালী সদর, নোয়াখালী", not "নোয়াখালী, নোয়াখালী"
    const u = c.upazila_en === a.district ? `${d} ${T().sadar}` : (bnLang() ? c.upazila_bn : c.upazila_en);
    return `${u}, ${d}`;
  };
  const fromPoint = (a) => me || (() => { const c = centreOf(a.district, a.upazila); return { lat: c.lat, lon: c.lon }; })();

  function areaBar(a, onChange, { showWhere = true } = {}) {
    const bar = el('div', 'near-area');
    const where = el('p', 'near-where'); where.hidden = !showWhere;
    where.append(icon('pin', { size: 'sm' }), el('span', null, a ? areaLabel(a) : T().noArea));
    const change = el('button', 'btn', a ? T().change : T().choose); change.type = 'button';
    const gps = el('button', 'btn', T().myLocation); gps.type = 'button'; gps.prepend(icon('locate', { size: 'sm' }));
    const msg = el('p', 'small near-msg'); msg.setAttribute('role', 'status');
    const picker = el('div', 'near-picker'); picker.hidden = !!a;
    change.addEventListener('click', () => { picker.hidden = !picker.hidden; });
    gps.addEventListener('click', () => {
      if (!navigator.geolocation) { msg.textContent = T().noGps; return; }
      msg.textContent = T().finding;
      locate((pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy), at: pos.timestamp };
        let best = null, bd = Infinity;
        for (const c of base.centres) { const k = km(p, c); if (k < bd) { bd = k; best = c; } }
        if (!best || bd > 60) { msg.textContent = T().outsideBd; return; }
        me = p; setArea({ district: best.district, upazila: best.upazila_en });
        ctx.onGps(p);                          // the pilot districts: the exact union for the area numbers
        onChange();
      }, (e) => { msg.textContent = e && e.code === 1 ? T().gpsDenied : T().gpsFailed; }, { precise: false, timeout: 15000 });
    });
    // district and upazila for all 64 districts
    const dSel = el('select'); dSel.setAttribute('aria-label', T().district);
    const uSel = el('select'); uSel.setAttribute('aria-label', T().upazila);
    const ds = [...base.districts].sort((x, y) => (bnLang() ? x.bn.localeCompare(y.bn, 'bn') : x.en.localeCompare(y.en)));
    for (const d of ds) { const o = el('option', null, bnLang() ? d.bn : d.en); o.value = d.en; dSel.append(o); }
    const fillU = () => {
      uSel.replaceChildren(...base.centres.filter((c) => c.district === dSel.value)
        .sort((x, y) => (bnLang() ? x.upazila_bn.localeCompare(y.upazila_bn, 'bn') : x.upazila_en.localeCompare(y.upazila_en)))
        .map((c) => { const o = el('option', null, bnLang() ? c.upazila_bn : c.upazila_en); o.value = c.upazila_en; return o; }));
    };
    dSel.value = a ? a.district : 'Dhaka'; fillU(); if (a) uSel.value = a.upazila;
    dSel.addEventListener('change', fillU);
    const ok = el('button', 'btn solid', T().useArea); ok.type = 'button';
    ok.addEventListener('click', () => { me = null; setArea({ district: dSel.value, upazila: uSel.value }); onChange(); });
    const row = el('div', 'near-selects'); row.append(dSel, uSel);
    picker.append(row, ok);
    const acts = el('div', 'pills'); acts.append(gps, change);
    bar.append(where, acts, msg, picker);
    return bar;
  }

  /* ---------- formats and rows ---------- */
  const dist = (k) => (k < 1 ? `${num(Math.round(k * 100) * 10)} ${T().metres}` : `${num(k.toFixed(1))} ${T().km}`);
  const pointOf = (p) => {
    if (p.lat != null) return { lat: p.lat, lon: p.lon, approx: false };
    const c = p.upazila && centreOf(p.district, p.upazila);
    return c ? { lat: c.lat, lon: c.lon, approx: true } : null;      // official lists: the upazila centre, labelled
  };
  // only a place with its own position can be "nearest" or get a pin; the others are listed after it as "in this upazila"
  const exact = (it) => !!(it.pt && !it.pt.approx);
  const rank = (it) => (exact(it) ? 0 : it.pt ? 1 : 2);
  // SRS FR04: the list shows the approximate road distance (straight line × 1.3, no routing service)
  const ROAD = 1.3;
  const distText = (it) => (exact(it) ? `${T().byRoad} ${dist(it.k * ROAD)}` : it.pt ? T().inUpazila : T().noLocation);
  function badge(p) {
    const b = el('span', 'badge', p.source === 'official' ? T().officialList : T().osm);
    b.classList.add(p.source === 'official' ? 'b-ok' : 'b-osm');
    return b;
  }

  /* ---------- the map (Leaflet only when shown; tiles from OpenStreetMap) ---------- */
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leaflet) return leaflet;
    leaflet = new Promise((ok, fail) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css'; document.head.append(css);
      const s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js'; s.onload = () => ok(window.L); s.onerror = () => { leaflet = null; fail(new Error('leaflet')); };
      document.head.append(s);
    });
    return leaflet;
  }
  function closeMap() { if (mapObj) { mapObj.stop(); mapObj.remove(); mapObj = null; } markers = []; }
  async function drawMap(box, from, items, cat, onPick) {
    closeMap();
    if (!navigator.onLine) { box.replaceChildren(el('p', 'note', T().mapOffline)); return; }
    let L;
    try { L = await loadLeaflet(); } catch { box.replaceChildren(el('p', 'note', T().mapFailed)); return; }
    if (!box.isConnected) return;
    mapObj = L.map(box, { zoomControl: true, tap: true }).setView([from.lat, from.lon], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mapObj);
    const meIcon = el('span', 'mk-me');
    L.marker([from.lat, from.lon], { icon: L.divIcon({ className: 'mk-wrap', html: meIcon, iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false, zIndexOffset: 500 })
      .addTo(mapObj).bindTooltip(el('span', null, me ? T().you : T().areaCentre));
    const pts = [[from.lat, from.lon]];
    items.forEach((it, i) => {
      if (!exact(it)) return;     // no position of its own: no pin (it would sit on the area centre)
      const pin = el('span', i === 0 ? 'mk-pin near' : 'mk-pin'); pin.append(icon(cat.ic, { size: 'sm' }));
      const pop = el('div', 'mk-pop');
      const go = el('button', 'btn solid', T().details); go.type = 'button'; go.addEventListener('click', () => onPick(it));
      pop.append(el('b', null, nameOf(it.p)), el('span', 'small', `${i === 0 ? T().nearest + ' · ' : ''}${dist(it.k)}`), go);
      const m = L.marker([it.pt.lat, it.pt.lon], { icon: L.divIcon({ className: 'mk-wrap', html: pin, iconSize: [34, 40], iconAnchor: [17, 38], popupAnchor: [0, -34] }),
        title: nameOf(it.p), zIndexOffset: i === 0 ? 1000 : 0 }).addTo(mapObj).bindPopup(pop);
      if (i === 0) m.bindTooltip(el('span', null, T().nearest), { permanent: true, direction: 'top', offset: [0, -34], className: 'mk-tip' });
      markers[i] = m;
      if (i < 8) pts.push([it.pt.lat, it.pt.lon]);
    });
    if (pts.length > 1) mapObj.fitBounds(pts, { padding: [36, 36], maxZoom: 16, animate: false });
  }

  /* ---------- pages ---------- */
  async function show(view, rest) {
    view.replaceChildren(el('div', 'skeleton'));
    try { await loadBase(); } catch { view.replaceChildren(el('p', 'note', T().loadFailed)); return; }
    const [catId, placeId] = rest;
    const cat = CATS.find((c) => c.id === catId);
    if (!cat) return hub(view);
    const a = getArea();
    if (!a) return askArea(view, cat);
    let all;
    try { all = await placesOf(a.district); } catch { view.replaceChildren(el('p', 'note', T().loadFailed)); return; }
    const from = fromPoint(a);
    const items = all.filter(cat.match).map((p) => { const pt = pointOf(p); return { p, pt, k: pt ? km(from, pt) : Infinity }; })
      .sort((x, y) => rank(x) - rank(y) || x.k - y.k);
    if (placeId) {
      const it = items.find((x) => x.p.id === placeId);
      if (it) return placePage(view, cat, a, it);
    }
    return catPage(view, cat, a, items, from);
  }

  // SRS FR03 (UC-04): everyday words in Bangla, Banglish or English → the category near the person; nothing → say so
  function searchBox() {
    const S = T().search;
    const f = el('form', 'near-search'); f.setAttribute('role', 'search');
    const l = el('label', 'sr-only', S.label); l.htmlFor = 'nearSearch';
    const inp = el('input'); inp.id = 'nearSearch'; inp.type = 'search'; inp.placeholder = S.ph; inp.autocomplete = 'off'; inp.maxLength = 60;
    const go = el('button', 'btn solid', S.go); go.type = 'submit'; go.prepend(icon('search', { size: 'sm' }));
    const msg = el('p', 'small near-search-msg'); msg.setAttribute('role', 'status');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { matchCategory } = await import('./category-words.js');
      const id = matchCategory(inp.value);
      if (id) ctx.go(`c/${id}`); else msg.textContent = inp.value.trim() ? S.none : S.empty;
    });
    const row = el('div', 'near-search-row'); row.append(inp, go);
    f.append(l, row, msg);
    return f;
  }
  function hub(view) {
    closeMap();
    const a = getArea();
    const head = el('section', 'card');
    const h = el('h1', 'page-title', T().hubTitle); h.id = 'catTitle'; h.tabIndex = -1;
    head.append(h, el('p', 'muted', T().hubText), searchBox(), areaBar(a, () => ctx.rerender()));
    view.replaceChildren(head, tileGrid());
  }
  function tileGrid() {
    const grid = el('div', 'cat-grid');
    for (const c of CATS) {
      const b = el('button', 'cat-tile'); b.type = 'button'; b.dataset.cat = c.id;
      const sq = el('span', 'cat-ic'); sq.append(icon(c.ic));
      b.append(sq, el('span', null, T().cats[c.id]));
      b.addEventListener('click', () => ctx.go(`c/${c.id}`));
      grid.append(b);
    }
    return grid;
  }

  function askArea(view, cat) {
    closeMap();
    const card = el('section', 'card');
    const h = el('h1', 'page-title', T().cats[cat.id]); h.id = 'catTitle'; h.tabIndex = -1;
    card.append(h, el('p', 'muted', T().askArea), areaBar(null, () => ctx.rerender()));
    view.replaceChildren(backLink(), card);
  }

  function backLink(to = 'c', label = T().allCats) {
    const b = el('button', 'linkbtn near-back', label); b.type = 'button'; b.prepend(icon('back', { size: 'sm' }));
    b.addEventListener('click', () => ctx.go(to));
    return b;
  }

  function catPage(view, cat, a, items, from) {
    const head = el('section', 'card');
    const h = el('h1', 'page-title', T().cats[cat.id]); h.id = 'catTitle'; h.tabIndex = -1;
    head.append(h, areaBar(a, () => ctx.rerender()));
    const shown = items.slice(0, LIST_MAX);
    const mapCard = el('section', 'card near-mapcard');
    const mapBox = el('div', 'near-map'); mapBox.setAttribute('role', 'region'); mapBox.setAttribute('aria-label', T().mapLabel);
    const recenter = el('button', 'btn near-recenter', T().nearMe); recenter.type = 'button'; recenter.prepend(icon('locate', { size: 'sm' }));
    recenter.addEventListener('click', () => { if (mapObj) mapObj.setView([from.lat, from.lon], 15); });
    // the map loads only after "ম্যাপে দেখুন" (SRS UC-05): Leaflet and the tiles are fetched then
    mapBox.hidden = true; recenter.hidden = true;
    let mapOpen = null;
    const openMap = () => (mapOpen ||= (async () => { showMap.hidden = true; mapBox.hidden = false; recenter.hidden = false;
      await drawMap(mapBox, from, shown, cat, (it) => ctx.go(`c/${cat.id}/${encodeURIComponent(it.p.id)}`)); })());
    const showMap = el('button', 'btn solid near-showmap', T().showMap); showMap.type = 'button'; showMap.prepend(icon('pin', { size: 'sm' }));
    showMap.addEventListener('click', openMap);
    mapCard.append(showMap, mapBox, recenter, el('p', 'small', T().mapNote));
    const list = el('section', 'card');
    if (!shown.length) {   // UC-05 2.1: 999 and the nearest mapped police station, fire station and hospital
      const alt = el('div', 'near-empty-help');
      list.append(el('p', 'note', T().empty), alt);
      homeNums(alt, a, { titleId: 'catEmptyTitle', title: false });
    }
    else {
      list.append(el('p', 'small', me ? T().fromYou : T().fromCentre));
      const rows = el('div', 'rows');
      const open = (it) => ctx.go(`c/${cat.id}/${encodeURIComponent(it.p.id)}`);
      shown.forEach((it, i) => {
        const r = el('div', i === 0 && exact(it) ? 'r near-row nearest' : 'r near-row');
        const sq = el('span', 'cat-ic sm'); sq.append(icon(cat.ic, { size: 'sm' }));
        const body = el('div');
        const title = el('div', 't', nameOf(it.p));
        if (i === 0 && exact(it)) title.append(el('span', 'badge b-near', T().nearest));
        title.append(badge(it.p));
        body.append(title, el('div', 'm', distText(it)));
        const acts = el('div', 'acts');
        if (exact(it)) {
          const onMap = el('button', 'btn', T().onMap); onMap.type = 'button'; onMap.prepend(icon('pin', { size: 'sm' }));
          onMap.addEventListener('click', async () => { await openMap(); const m = markers[i]; if (!m || !mapObj) return; mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); mapObj.setView(m.getLatLng(), 16); m.openPopup(); });
          acts.append(onMap);
        }
        const det = el('button', 'btn solid', T().details); det.type = 'button'; det.addEventListener('click', () => open(it));
        acts.append(det);
        r.append(sq, body, acts);
        rows.append(r);
      });
      list.append(rows);
    }
    list.append(el('p', 'small', T().credit));
    view.replaceChildren(backLink(), head, mapCard, list);
  }

  /* ---------- এখন কেমন? (SRS FR05, UC-06) and ভুল জানান (FR15, UC-16) on the place page ---------- */
  const statusValues = (cat) => ['open', 'closed', 'open_night', ...(cat.id === 'fuel' ? ['fuel_yes', 'fuel_no'] : []), ...(cat.id === 'shelter' ? ['shelter_open'] : [])];
  function statusCard(p, cat) {
    const S = T().status;
    const box = el('section', 'card near-status');
    const now = el('p', 'muted near-status-now', S.loading); now.setAttribute('role', 'status');
    const msg = el('p', 'small'); msg.setAttribute('role', 'status');
    const placeId = String(p.id || '').toLowerCase();
    const show = async () => {
      try {
        const fb = await import('./firebase.js'), cm = await import('./community.js');
        const st = await fb.readPlaceStatus(placeId);
        if (!st || !(st.status || st.value)) { now.textContent = S.none; return; }
        const nowMs = Date.now(), age = Math.max(1, Math.round((nowMs - cm.toMs(st.at)) / 60000));
        const ago = age < 60 ? fill(S.minAgo, { n: num(age) }) : age < 1440 ? fill(S.hourAgo, { n: num(Math.round(age / 60)) }) : fill(S.dayAgo, { n: num(Math.round(age / 1440)) });
        now.textContent = `${fill(S.said, { n: num(st.n || 1), v: S.values[st.status || st.value] || '' })} · ${ago}${cm.isOutdated(st, nowMs) ? ` · ${S.outdated}` : ''}`;
      } catch { now.textContent = navigator.onLine ? S.none : S.offline; }
    };
    const buttons = el('div', 'pills');
    for (const v of statusValues(cat)) {
      const b = el('button', 'pill', S.values[v]); b.type = 'button';
      b.addEventListener('click', async () => {
        msg.textContent = '';
        try {
          const fb = await import('./firebase.js'), cm = await import('./community.js');
          const user = await fb.currentUser();
          if (!user) { msg.textContent = S.signIn; ctx.signIn(b); return; }          // UC-06 3.1
          if (!(await fb.isVerified())) { msg.textContent = S.verify; return; }
          const old = await fb.readPlaceStatus(placeId);
          await fb.sendPlaceStatus(placeId, v, cm.nextPlaceStatus(old, v, Date.now()));
          msg.textContent = S.thanks; show();
        } catch (e) { msg.textContent = e && e.code === 'permission-denied' ? S.wait30 : navigator.onLine ? S.failed : S.offline; }   // UC-06 5.1
      });
      buttons.append(b);
    }
    box.append(el('h2', null, S.title), now, buttons, el('p', 'small', S.note), msg);
    show();
    return box;
  }
  function reportCard(p, cat, a) {
    const R = T().report;
    const box = el('section', 'card near-report');
    const key = slug(a.district);
    const rec = { id: String(p.id || ''), name_bn: nameOf(p), office_bn: T().cats[cat.id], phones: [] };
    const wrong = el('button', 'btn', R.wrong); wrong.type = 'button'; wrong.prepend(icon('flag', { size: 'sm' }));
    wrong.addEventListener('click', () => ctx.report(rec, { district: key, area: a.upazila, areaLabel: areaLabel(a) }, wrong));
    // a place that is missing from the list (জায়গাটা যোগ করতে বলুন)
    const l = el('label', null, R.addLabel); l.htmlFor = 'nearAddPlace';
    const inp = el('input'); inp.id = 'nearAddPlace'; inp.maxLength = 80; inp.autocomplete = 'off'; inp.placeholder = R.addPh;
    const msg = el('p', 'small'); msg.setAttribute('role', 'status');
    const send = el('button', 'btn', R.addSend); send.type = 'button';
    send.addEventListener('click', () => {
      const name = inp.value.trim();
      if (name.length < 2) { msg.textContent = R.addShort; return; }
      if (/(?:\+?88)?0?1[3-9](?:[\s.-]?\d){8}|(?:\+?৮৮)?০?১[৩-৯](?:[\s.-]?[০-৯]){8}/.test(name)) { msg.textContent = R.noPhone; return; }   // UC-16 3.1
      ctx.askPlace({ district: key, upazila: a.upazila, union: '', place: name }, send, (code) => { msg.textContent = R.done[code] || R.done.err; if (code === 'sent') inp.value = ''; });
    });
    box.append(el('h2', null, R.title), el('p', 'muted', R.text), wrong, l, inp, send, msg);
    return box;
  }

  function placePage(view, cat, a, it) {
    closeMap();
    const p = it.p;
    const head = el('section', 'card');
    const h = el('h1', 'page-title', nameOf(p)); h.id = 'catTitle'; h.tabIndex = -1;
    const meta = el('p', 'muted', `${T().cats[cat.id]} · ${distText(it)}`);
    head.append(h, meta, badge(p));
    // ফ্রি সহায়তা: the place's own official number (none of our place lists has one yet), the area's official numbers, 999
    const free = el('section', 'card');
    const fh = el('div', 'sec-head'); fh.append(el('h2', null, T().freeHelp));
    const call = el('a', 'btn red', T().call999); call.href = 'tel:999'; call.prepend(icon('phone', { size: 'sm' }));
    fh.append(call);
    free.append(fh, el('p', 'note', T().noNumber));
    const rows = ctx.areaRows(a);
    const own = (rows || []).filter((r) => !r.querySelector('a[href="tel:999"]'));   // 999 is already the red button
    if (own.length) { free.append(el('h3', null, T().areaNumbers)); const box = el('div', 'rows'); box.append(...own); free.append(box); }
    else {
      const more = el('a', 'btn', T().nationalNumbers); more.href = '#/numbers';
      free.append(el('p', 'small', T().noAreaNumbers), more);
    }
    // the way there: our map first, Google Maps for turn-by-turn
    const way = el('section', 'card');
    way.append(el('h2', null, T().wayThere));
    const acts = el('div', 'pills');
    if (it.pt) {
      const g = el('a', 'btn', T().googleMaps); g.target = '_blank'; g.rel = 'noopener noreferrer'; g.prepend(icon('nav', { size: 'sm' }));
      g.href = it.pt.approx ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name_en || ''} ${a.upazila} ${a.district}`.trim())}`
        : `https://www.google.com/maps/dir/?api=1&destination=${it.pt.lat},${it.pt.lon}`;
      acts.append(g);
    }
    const share = el('button', 'btn', T().share); share.type = 'button'; share.prepend(icon('share', { size: 'sm' }));
    share.addEventListener('click', async () => {
      const text = `${nameOf(p)} (${T().cats[cat.id]}), ${areaLabel(a)}`;
      try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); ctx.toast(T().copied); } } catch { /* the person closed the share sheet */ }
    });
    acts.append(share);
    if (exact(it) && ctx.callTo) {   // সেবা ডাকুন (R3): a ride there, and the service that fits the place
      const call = (label, ic, mode) => { const b = el('button', 'btn', label); b.type = 'button'; b.prepend(icon(ic, { size: 'sm' }));
        b.addEventListener('click', () => ctx.callTo({ name: nameOf(p), lat: it.pt.lat, lon: it.pt.lon }, mode)); return b; };
      const svc = el('div', 'pills');
      svc.append(call(T().callHere, 'car', 'ride'));
      if (cat.id === 'hospital') svc.append(call(T().callAmb, 'amb', 'amb'));
      if (['pharmacy', 'market'].includes(cat.id)) svc.append(call(T().callErrand, 'basket', 'errand'));
      if (['repair', 'fuel'].includes(cat.id)) svc.append(call(T().callTow, 'car', 'tow'));
      way.append(svc);
    }
    if (/^https:\/\//.test(p.source_url || '')) { const s = el('a', 'btn ghost', T().source); s.href = p.source_url; s.target = '_blank'; s.rel = 'noopener noreferrer'; acts.append(s); }
    way.append(acts);
    if (it.pt && it.pt.approx) way.append(el('p', 'small', T().approxNote));
    view.replaceChildren(backLink(`c/${cat.id}`, T().backToList), head, free, way, statusCard(p, cat), reportCard(p, cat, a));
  }

  /* ---------- home (R2): the area card, the 12 tiles, the area's emergency numbers ---------- */
  function sunLine(a) {
    const c = centreOf(a.district, a.upazila);
    const s = c && sunTimes(c.lat, c.lon);
    if (!s) return null;
    const f = new Intl.DateTimeFormat(bnLang() ? 'bn-BD' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' });
    // Bangla: "৬:১৬", no AM/PM (the word সূর্যোদয় or সূর্যাস্ত already says it)
    const hm = (d) => (bnLang() ? f.formatToParts(d).filter((x) => x.type !== 'dayPeriod').map((x) => x.value).join('').trim() : f.format(d));
    const H = T().home;
    const line = el('p', 'home-sun');
    const part = (ic, label, d) => { const x = el('span'); x.append(icon(ic, { size: 'sm' }), el('span', null, `${label} ${hm(d)}`)); return x; };
    line.append(part('sunrise', H.sunrise, s.rise), part('sunset', H.sunset, s.set));
    return line;
  }
  // Fills the home sections; returns the area (or null) so the page can choose the numbers to show.
  async function home({ area, cats }) {
    closeMap();
    try { await loadBase(); } catch { area.replaceChildren(el('p', 'note', T().loadFailed)); cats.replaceChildren(); return null; }
    const a = getArea(), H = T().home;
    const card = el('div', 'home-card');
    const h = el('h1', 'home-place', a ? areaLabel(a) : H.pickArea); h.id = 'homeTitle'; h.tabIndex = -1;
    card.append(el('p', 'eyebrow', H.yourArea), h);
    if (a) { const s = sunLine(a); if (s) card.append(s); } else card.append(el('p', 'muted', T().askArea));
    card.append(areaBar(a, () => ctx.rerender(), { showWhere: false }));
    area.replaceChildren(card);
    const ch = el('h2', null, H.catsTitle); ch.id = 'homeCatsTitle';
    cats.replaceChildren(ch, tileGrid());
    return a;
  }
  // Outside the pilot districts: 999 first, then the nearest police station, fire station and hospital on the map.
  // No phone number is shown for them, because none comes from an official source.
  // titleId: home and জরুরি সাহায্য both show it, so each has its own heading id; title: false when the page has one
  async function homeNums(box, a, { titleId = 'homeNumsTitle', title = true } = {}) {
    const H = T().home;
    const h = el('h2', null, H.numsTitle); h.id = titleId;
    const call = el('a', 'btn red home-999', H.call999); call.href = 'tel:999'; call.prepend(icon('phone', { size: 'sm' }));
    box.replaceChildren(...[title ? h : null, call, el('p', 'note', H.noOfficial)].filter(Boolean));
    let all;
    try { all = await placesOf(a.district); } catch { box.append(el('p', 'note', T().loadFailed)); return; }
    if (!box.isConnected) return;
    const from = fromPoint(a);
    const kinds = [
      ['police', 'police', (p) => p.subcategory === 'police'],
      ['fire', 'police', (p) => p.subcategory === 'fire_station'],
      ['hospital', 'hospital', (p) => p.category === 'health' && p.subcategory === 'hospital'],
    ];
    const rows = el('div', 'rows');
    for (const [k, catId, match] of kinds) {
      let best = null, bd = Infinity;
      for (const p of all) if (p.lat != null && match(p)) { const d = km(from, p); if (d < bd) { bd = d; best = p; } }
      const r = el('div', 'r near-row');
      const sq = el('span', 'cat-ic sm'); sq.append(icon(CATS.find((c) => c.id === catId).ic, { size: 'sm' }));
      const body = el('div');
      body.append(el('div', 't', H[k]), el('div', 'm', best ? `${nameOf(best)} · ${T().byRoad} ${dist(bd * ROAD)}` : H.notListed));
      r.append(sq, body);
      if (best) {
        const acts = el('div', 'acts');
        const b = el('button', 'btn', H.onMap); b.type = 'button'; b.prepend(icon('pin', { size: 'sm' }));
        b.addEventListener('click', () => ctx.go(`c/${catId}/${encodeURIComponent(best.id)}`));
        acts.append(b); r.append(acts);
      }
      rows.append(r);
    }
    box.append(rows, el('p', 'small', me ? T().fromYou : T().fromCentre));
  }
  // Is this saved site area (pilot districts) inside the same upazila as the area?
  const sameUpazila = (last, a) => !!(base && last && a && slug(a.district) === last.district
    && centreOf(a.district, last.upazila) === centreOf(a.district, a.upazila));

  const label = (a) => (base && a && centreOf(a.district, a.upazila) ? areaLabel(a) : '');
  // the header chip: open the area picker in the home area card
  function openPicker(box) {
    const p = box.querySelector('.near-picker'); if (!p) return;
    p.hidden = false; p.scrollIntoView({ block: 'center' }); p.querySelector('select')?.focus({ preventScroll: true });
  }
  // সেবা ডাকুন (R3): the chosen area as a point, and real places near it (own position only) for quick picks
  async function here() {
    try { await loadBase(); } catch { return null; }
    const a = getArea(); if (!a) return null;
    const p = fromPoint(a);
    return { district: a.district, label: areaLabel(a), lat: p.lat, lon: p.lon };
  }
  async function nearby(catIds, max = 3) {
    const h = await here(); if (!h) return [];
    let all; try { all = await placesOf(h.district); } catch { return []; }
    const out = [];
    for (const id of catIds) {
      const c = CATS.find((x) => x.id === id); if (!c) continue;
      out.push(...all.filter((p) => p.lat != null && c.match(p)).map((p) => ({ name: nameOf(p), lat: p.lat, lon: p.lon, km: km(h, p) }))
        .sort((x, y) => x.km - y.km).slice(0, max));
    }
    return out;
  }
  const area = async () => { try { await loadBase(); } catch { return null; } return getArea(); };
  // the 64 districts with their keys (for the admin's district rates); empty until the base data is loaded
  const districts = () => (base ? base.districts.map((d) => ({ key: slug(d.en), en: d.en, bn: d.bn })).sort((a, b) => a.en.localeCompare(b.en)) : []);
  return { show, close: closeMap, home, homeNums, sameUpazila, forget, label, openPicker, here, nearby, loadLeaflet, area, districts };
}
