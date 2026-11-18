// Demo data: official numbers for the two pilot districts (data.json, copied from data/ on 14 Nov 2026), and the
// site's own nationwide files: upazila centres (471) and places from OpenStreetMap (64 districts), read from ../data/.
const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };
const [D, CEN, PIDX, ALI] = await Promise.all([getJSON('data.json'), getJSON('../data/upazila_centres.json'), getJSON('../data/places/index.json'),
  getJSON('../data/aliases.json').catch(() => ({ aliases: [] }))]);
const PILOT = new Set(['Noakhali', "Cox's Bazar"]);
const DISTBN = Object.fromEntries(PIDX.districts.map((d) => [d.district_en, d.district_bn]));
const UPBN_ALL = Object.fromEntries(CEN.centres.map((c) => [`${c.district}|${c.upazila_en}`, c.upazila_bn]));
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bn = (x) => String(x).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const UPBN = { 'Begumganj': 'বেগমগঞ্জ', 'Chatkhil': 'চাটখিল', 'Companiganj': 'কোম্পানীগঞ্জ', 'Hatiya': 'হাতিয়া', 'Kabirhat': 'কবিরহাট', 'Noakhali Sadar': 'নোয়াখালী সদর', 'Senbagh': 'সেনবাগ', 'Sonaimuri': 'সোনাইমুড়ী', 'Subarnachar': 'সুবর্ণচর', 'Chakaria': 'চকরিয়া', "Cox's Bazar Sadar": 'কক্সবাজার সদর', 'Eidgaon': 'ঈদগাঁও', 'Kutubdia': 'কুতুবদিয়া', 'Maheshkhali': 'মহেশখালী', 'Pekua': 'পেকুয়া', 'Ramu': 'রামু', 'Teknaf': 'টেকনাফ', 'Ukhia': 'উখিয়া' };
const DBN = { 'Noakhali': 'নোয়াখালী', "Cox's Bazar": 'কক্সবাজার' };
const PRESETS = [
  { n: 'মাইজদী (নোয়াখালী সদর)', lat: 22.8696, lon: 91.0994 },
  { n: 'চৌমুহনী (বেগমগঞ্জ)', lat: 22.9365, lon: 91.0937 },
  { n: 'হাতিয়া (ওছখালী)', lat: 22.3880, lon: 91.1205 },
  { n: 'কক্সবাজার শহর', lat: 21.4272, lon: 92.0058 },
  { n: 'ইনানী সৈকত (উখিয়া)', lat: 21.2360, lon: 92.0450 },
  { n: 'টেকনাফ', lat: 20.8640, lon: 92.2980 },
];

/* ---------- where am I ---------- */
const hav = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
let here = null;   // { lat, lon, union, up, d, label }
function locate(lat, lon, label) {
  // Nearest upazila centre anywhere in Bangladesh; in the two pilot districts, the nearest union (official numbers).
  let ctr = null, cd = 1e9;
  for (const x of CEN.centres) { const k = hav({ lat, lon }, x); if (k < cd) { cd = k; ctr = x; } }
  let best = null;
  if (PILOT.has(ctr.district)) { let bd = 1e9; for (const u of D.unions) { const k = hav({ lat, lon }, u); if (k < bd) { bd = k; best = u; } } }
  const upBn = best ? UPBN[best.up] : ctr.upazila_bn, d = best ? best.d : ctr.district;
  here = { lat, lon, union: best, up: best ? best.up : ctr.upazila_en, d, ctr, upBn, dBn: DISTBN[d] || d, places: null,
    label: label || (best ? `${best.bn}, ${upBn}` : `${upBn}, ${DISTBN[d] || d}`) };
  loadPlaces(here);
  // Remember only an area picked from a list (a public centre), never a GPS point: coordinates are never stored.
  if (label) store.set('demo-here', JSON.stringify({ lat, lon, label: here.label })); else store.set('demo-here', '');
  $('#areaTxt').textContent = here.label; const st = $('#areaTxt2'); if (st) st.textContent = here.label;
  render();
}
function distTxt(km) { if (km < 1) return `${bn(Math.round(km * 1000 / 10) * 10)} মিটার`; return `${bn(km.toFixed(1))} কিমি`; }
function walkTxt(km) { const m = Math.round(km / 5 * 60); return m <= 60 ? `হেঁটে ${bn(m)} মিনিট` : `গাড়িতে ${bn(Math.max(5, Math.round(km / 25 * 60)))} মিনিট`; }
const CON = () => (here && D.upazilas[here.up] ? D.upazilas[here.up].contacts : {});
const dirLink = (p) => (p.approx || p.noLoc) && p.q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.q)}` : dirLink0(p);
const dirLink0 = (p) => p.lat ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.q)}`;

/* ---------- sunrise / sunset (NOAA formula, on the phone) ---------- */
function sunTimes(lat, lon, date = new Date()) {
  const rad = Math.PI / 180, day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 864e5);
  const g = 2 * Math.PI / 365 * (day - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec)) / rad;
  const toBD = (minUTC) => { let m = Math.round(minUTC + 360); m = (m + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return `${bn(h > 12 ? h - 12 : h)}:${bn(String(mm).padStart(2, '0'))}`; };
  return { rise: toBD(720 - 4 * (lon + ha) - eq), set: toBD(720 - 4 * (lon - ha) - eq) };
}

/* ---------- sound key search (Bangla / English / Banglish) ---------- */
const BNMAP = { 'অ':'a','আ':'a','ই':'a','ঈ':'a','উ':'a','ঊ':'a','ঋ':'ri','এ':'a','ঐ':'a','ও':'a','ঔ':'a','া':'a','ি':'a','ী':'a','ু':'a','ূ':'a','ৃ':'ri','ে':'a','ৈ':'a','ো':'a','ৌ':'a',
  'ক':'k','খ':'k','গ':'g','ঘ':'g','ঙ':'ng','চ':'C','ছ':'C','জ':'j','ঝ':'j','ঞ':'n','ট':'t','ঠ':'t','ড':'d','ঢ':'d','ণ':'n','ত':'t','থ':'t','দ':'d','ধ':'d','ন':'n',
  'প':'p','ফ':'p','ব':'b','ভ':'b','ম':'m','য':'j','র':'r','ল':'l','শ':'s','ষ':'s','স':'s','হ':'h','ৎ':'t','ং':'ng','ঃ':'','ঁ':'','্':'' };
const fixBn = (s) => s.normalize('NFC').replace(/ড়|ড়/g, 'র').replace(/ঢ়|ঢ়/g, 'র').replace(/য়|য়/g, '').replace(/্য/g, '').replace(/্ব/g, '').replace(/়/g, '');
function soundKey(t) {
  let s = ''; for (const ch of fixBn(String(t || '').toLowerCase())) s += ch in BNMAP ? BNMAP[ch] : ch;
  s = s.replace(/['’`.\-]/g, '').replace(/[^a-zC ]+/g, ' ').replace(/x/g, 'ks').replace(/q/g, 'k').replace(/chh|ch/g, 'C').replace(/c/g, 'k').replace(/C/g, 'c')
    .replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/jh/g, 'j').replace(/z/g, 'j').replace(/th/g, 't').replace(/dh/g, 'd').replace(/ph|f/g, 'p').replace(/bh|v/g, 'b').replace(/sh/g, 's').replace(/rh/g, 'r');
  return s.split(/\s+/).filter(Boolean).map((w) => (/^[aeiou]/.test(w) ? 'a' : '') + w.replace(/[aeiouyw]/g, '').replace(/(.)\1+/g, '$1')).join('');
}
const KIND = /\s*(ইউনিয়ন|উপজেলা|থানা|পৌরসভা|জেলা|বাজার|union|upazila|thana|bazar)\s*/gi;
const COMMON = new Set(['bazar', 'bajar', 'বাজার', 'hat', 'হাট', 'char', 'চর', 'union', 'ইউনিয়ন', 'sadar', 'সদর', 'thana', 'থানা', 'school', 'স্কুল', 'beach', 'সৈকত']);
const lev = (a, b) => { if (Math.abs(a.length - b.length) > 2) return 9; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };


/* ---------- data for each tab ---------- */
const SERVICES = [
  { id: 'birth', n: 'জন্ম নিবন্ধন', en: 'jonmo nibondhon birth registration', where: 'union', link: 'https://bdris.gov.bd', docs: ['হাসপাতালের জন্ম সনদ বা টিকা কার্ড', 'বাবা ও মায়ের জন্ম নিবন্ধন বা জাতীয় পরিচয়পত্র', 'ঠিকানার প্রমাণ (যেমন হোল্ডিং ট্যাক্সের রসিদ)'] },
  { id: 'death', n: 'মৃত্যু নিবন্ধন', en: 'mrittu nibondhon death registration', where: 'union', link: 'https://bdris.gov.bd', docs: ['মৃত্যুর প্রমাণ (চিকিৎসকের সনদ, বা কবরস্থান/শ্মশানের প্রত্যয়ন)', 'মৃত ব্যক্তির জন্ম নিবন্ধন বা জাতীয় পরিচয়পত্র', 'আবেদনকারীর জাতীয় পরিচয়পত্র'] },
  { id: 'citizen', n: 'নাগরিক সনদ', en: 'nagorik sonod citizen certificate', where: 'union', link: null, docs: ['জাতীয় পরিচয়পত্র বা জন্ম নিবন্ধনের কপি', 'ছবি (চাইলে)'] },
  { id: 'heir', n: 'ওয়ারিশ সনদ', en: 'warish sonod heir certificate', where: 'union', link: null, docs: ['মৃত ব্যক্তির মৃত্যু নিবন্ধন সনদ', 'সব ওয়ারিশের জাতীয় পরিচয়পত্র বা জন্ম নিবন্ধন'] },
  { id: 'mutation', n: 'জমির নামজারি', en: 'namjari mutation land', where: 'upazila', link: 'https://mutation.land.gov.bd', docs: ['দলিলের কপি', 'আগের খতিয়ান বা পর্চা', 'জাতীয় পরিচয়পত্র', 'ভূমি উন্নয়ন করের রসিদ'] },
  { id: 'nid', n: 'জাতীয় পরিচয়পত্র সংশোধন', en: 'nid songsodhon correction', where: 'upazila', link: 'https://services.nidw.gov.bd', docs: ['বর্তমান জাতীয় পরিচয়পত্র', 'সংশোধনের প্রমাণ (যেমন সার্টিফিকেট, জন্ম নিবন্ধন)'] },
  { id: 'trade', n: 'ট্রেড লাইসেন্স', en: 'trade license byabsa', where: 'union', link: null, docs: ['জাতীয় পরিচয়পত্র', 'দোকান বা অফিসের ভাড়ার চুক্তি বা মালিকানার কাগজ', 'ছবি'] },
];
const CATS = [
  { id: 'health', n: 'স্বাস্থ্য' }, { id: 'union', n: 'ইউনিয়ন পরিষদ' }, { id: 'bazar', n: 'বাজার' },
  { id: 'edu', n: 'স্কুল-কলেজ' }, { id: 'spot', n: 'দর্শনীয় স্থান' }, { id: 'pharmacy', n: 'ফার্মেসি' },
  { id: 'fuel', n: 'ফিলিং স্টেশন' }, { id: 'atm', n: 'ব্যাংক/ATM' }, { id: 'workshop', n: 'ওয়ার্কশপ' },
  { id: 'shelter', n: 'আশ্রয়কেন্দ্র' }, { id: 'shop', n: 'দোকান' }, { id: 'ghat', n: 'ঘাট ও বাস' }, { id: 'police', n: 'থানা ও ফায়ার' }, { id: 'other', n: 'অন্যান্য সেবা' },
];
const GQ = { health: 'hospital', pharmacy: 'pharmacy', fuel: 'filling station petrol pump', atm: 'ATM bank', workshop: 'workshop mechanic', shelter: 'cyclone shelter', shop: 'shop', ghat: 'bus stand ghat', bazar: 'bazar', edu: 'school', spot: 'tourist spot', union: 'union parishad', police: 'police station', other: 'service' };
const unionOf = (name, up) => D.unions.find((u) => u.bn === name && (!up || u.up === up));

const placeCache = new Map();
async function loadPlaces(h) {
  const ent = PIDX.districts.find((x) => x.district_en === h.d);
  if (!ent) { h.places = []; return; }
  try {
    // OSM places, plus the official lists (Padma Oil's filling stations, #227) in official_<district>.json.
    const slug = ent.files[0].file.replace(/(-\d+)?\.json$/, '');
    if (!placeCache.has(h.d)) placeCache.set(h.d, Promise.all([
      Promise.all(ent.files.map((f) => getJSON('../data/places/' + f.file))).then((fs) => fs.flatMap((f) => f.places)),
      getJSON(`../data/places/official_${slug}.json`).then((o) => o.places.map((x) => ({ ...x, list: o.lists[x.list] }))).catch(() => []),
    ]).then(([a, b]) => [...a, ...b]));
    const list = await placeCache.get(h.d);
    if (here === h) { h.places = list; if (tab === 'near') render(); }
  } catch { if (here === h) { h.places = []; h.placesErr = true; if (tab === 'near') render(); } }
}
const OSMCAT = {
  health: (p) => p.category === 'health' && ['hospital', 'clinic', 'doctors'].includes(p.subcategory),
  pharmacy: (p) => ['pharmacy', 'chemist'].includes(p.subcategory),
  fuel: (p) => p.subcategory === 'fuel',
  atm: (p) => p.category === 'money',
  workshop: (p) => p.category === 'workshops',
  shop: (p) => p.category === 'shops' && p.subcategory !== 'marketplace',
  bazar: (p) => p.subcategory === 'marketplace',
  ghat: (p) => ['bus_station', 'ferry_terminal'].includes(p.subcategory),
  police: (p) => p.category === 'public_offices',
  other: (p) => p.category === 'other_services',
};
const SUBBN = { hospital: 'হাসপাতাল', clinic: 'ক্লিনিক', doctors: 'ডাক্তারের চেম্বার', pharmacy: 'ফার্মেসি', chemist: 'ফার্মেসি', fuel: 'পেট্রোল/সিএনজি পাম্প',
  bank: 'ব্যাংক', atm: 'এটিএম', supermarket: 'সুপারশপ', convenience: 'মুদি দোকান', general: 'দোকান', mall: 'শপিং মল', marketplace: 'বাজার',
  bus_station: 'বাস স্ট্যান্ড', ferry_terminal: 'ঘাট', police: 'থানা বা ফাঁড়ি', fire_station: 'ফায়ার সার্ভিস', car_repair: 'গাড়ি মেরামত',
  motorcycle_repair: 'মোটরসাইকেল মেরামত', motorcycle: 'মোটরসাইকেলের দোকান', bicycle: 'সাইকেল', mobile_phone: 'মোবাইলের দোকান',
  electronics_repair: 'ইলেকট্রনিক্স মেরামত', mobile_phone_repair: 'মোবাইল মেরামত', shoemaker: 'জুতা মেরামত', tailor: 'দর্জি' };
const placeName = (p) => p.name_bn || p.name_en || (PIDX.unnamed_labels[p.subcategory] || {}).bn || SUBBN[p.subcategory] || 'নাম জানা নেই';

// The list for one category: official numbers (pilot districts), landmarks from union pages (pilot), and places from
// OpenStreetMap (all 64 districts). Nothing invented: a category with no data shows an empty state, not samples.
function nearby(cat) {
  if (!here) return [];
  const out = [];
  if (cat === 'health') {
    for (const [up, info] of Object.entries(D.upazilas)) {
      const c = info.contacts.health; if (!c) continue;
      out.push({ name: c.o || 'উপজেলা স্বাস্থ্য কমপ্লেক্স', sub: `${UPBN[up]} · ${c.t || ''}`, phone: c.p, src: c.s, lat: info.center[0], lon: info.center[1], off: true });
    }
  } else if (cat === 'union') {
    for (const u of D.unions) { const c = u.chair || u.sec; out.push({ name: u.bn + ' পরিষদ', sub: c ? `${c.t}: ${c.n}` : 'নম্বর প্রকাশিত নেই', phone: c && c.p, src: c && c.s, lat: u.lat, lon: u.lon, off: true }); }
  } else if (cat === 'bazar' || cat === 'edu') {
    for (const l of D.landmarks) {
      if (cat === 'bazar' ? l.t !== 'bazar' : !['school', 'college', 'madrasa'].includes(l.t)) continue;
      const u = unionOf(l.u, l.up); if (!u) continue;
      out.push({ name: l.n, sub: `${l.u}, ${UPBN[l.up] || l.up}`, src: l.s, lat: u.lat, lon: u.lon, approx: true, q: `${l.n}, ${l.u}, ${UPBN[l.up] || ''}`, off: true });
    }
  } else if (cat === 'spot') {
    for (const s of D.spots) {
      const u = s.u && unionOf(s.u, s.up); const c = u ? [u.lat, u.lon] : (D.upazilas[s.up] || {}).center; if (!c) continue;
      out.push({ name: s.n, sub: `${UPBN[s.up] || s.up || ''}${s.en ? ' · ' + s.en : ''}`, src: s.s, lat: c[0], lon: c[1], approx: true, q: `${s.en || s.n}, ${DBN[s.d] || ''}`, off: true });
    }
  }
  if (OSMCAT[cat] && here.places) {
    for (const p of here.places) if (OSMCAT[cat](p) && p.source === 'official') {
      const c = p.upazila && CEN.centres.find((x) => x.district === p.district && (x.upazila_en === p.upazila || (p.upazila === 'Sadar' && (x.upazila_en === p.district || /sadar/i.test(x.upazila_en)))));
      const upb = c ? c.upazila_bn : '';
      out.push({ name: p.name_hidden ? p.list.hidden_name_label_bn : (p.name_bn || p.name_en), sub: `পেট্রোল পাম্প · ${upb || here.dBn + ' জেলা'}`, src: p.source_url,
        lat: c ? c.lat : null, lon: c ? c.lon : null, approx: !!c, noLoc: !c, q: `${p.name_en || 'filling station'} ${upb || ''} ${here.dBn}`.trim(), official: true, badge: p.list.badge_bn });
    }
    for (const p of here.places) if (OSMCAT[cat](p) && p.source !== 'official') out.push({ name: placeName(p), sub: `${SUBBN[p.subcategory] || p.subcategory}${p.upazila ? ' · ' + (UPBN[p.upazila] || UPBN_ALL[`${p.district}|${p.upazila}`] || p.upazila) : ''}`, src: p.source_url, lat: p.lat, lon: p.lon, osm: true });
  }
  for (const p of out) p.km = p.noLoc ? null : hav(here, p);
  // Official rows only when they are near (the pilot lists cover two districts). Places with no location (an official
  // list that names only the district) come after the ones with a distance.
  const withLoc = out.filter((p) => !p.noLoc && (!p.off || p.km < 60)).sort((a, b) => a.km - b.km);
  return [...withLoc, ...out.filter((p) => p.noLoc)].slice(0, 30);
}

/* ---------- own icon set (inline SVG, 24×24, stroke) ---------- */
const P = {
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  gov: '<path d="M3 9l9-5 9 5"/><path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9"/><path d="M3 20h18"/>',
  alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.2v.1"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  health: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
  pill: '<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-40 12 12)"/><path d="M9.3 9.3l5.4 5.4"/>',
  fuel: '<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15"/><path d="M4 20h11"/><path d="M7 8h5"/><path d="M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
  bank: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.1M17.5 14.5v.1"/>',
  basket: '<path d="M4 9h16l-1.6 9.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8z"/><path d="M8.5 9l3.5-5 3.5 5"/><path d="M10 13v3M14 13v3"/>',
  cap: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5V16c1.5 1.4 3.5 2 5.5 2s4-.6 5.5-2v-4.5"/><path d="M21.5 9.5V14"/>',
  wave: '<path d="M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2.5-1.5 4.5-1.5S19 15 21 15"/><path d="M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19"/><circle cx="16" cy="7" r="2.5"/>',
  wrench: '<path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L11 18.8a2.1 2.1 0 0 1-3-3l8.4-8.4"/><path d="M14.5 5.5l2.3 2.3"/>',
  shelter: '<path d="M3 11l9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9 20v-4a3 3 0 0 1 6 0v4"/>',
  store: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5 11.5V20h14v-8.5"/><path d="M10 20v-4.5h4V20"/>',
  boat: '<path d="M3 15l2 4h14l2-4z"/><path d="M6 15V9h12v6"/><path d="M12 9V4M9.5 6h5"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
  nav: '<path d="M3.5 11L20 4l-7 16.5-2-7.5z"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17.5" cy="6" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="M8.3 10.8l7-3.6M8.3 13.2l7 3.6"/>',
  ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  sunrise: '<path d="M4 18h16"/><path d="M7.5 18a4.5 4.5 0 0 1 9 0"/><path d="M12 4v5M9.5 6.5L12 4l2.5 2.5"/><path d="M4.5 13.5l1.4 1M19.5 13.5l-1.4 1"/>',
  sunset: '<path d="M4 18h16"/><path d="M7.5 18a4.5 4.5 0 0 1 9 0"/><path d="M12 9V4M9.5 6.5L12 9l2.5-2.5"/><path d="M4.5 13.5l1.4 1M19.5 13.5l-1.4 1"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-8A5.5 5.5 0 0 0 7 11a3.5 3.5 0 0 0 0 7z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  bus: '<rect x="5" y="3.5" width="14" height="14" rx="2.5"/><path d="M5 11h14"/><path d="M8 20.5v-3M16 20.5v-3"/><path d="M8.5 14.5v.1M15.5 14.5v.1"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.3 2.2 4.7-4.8"/>',
  sick: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 11v6"/>',
  amb: '<path d="M3 16V8a1 1 0 0 1 1-1h10v9"/><path d="M14 10h3.5l3.5 3.5V16h-7"/><path d="M8 9.5v4M6 11.5h4"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  bike: '<circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M5.5 16.5L9 10h6l3.5 6.5"/><path d="M12 16.5L9 10M14 6.5h2.5l-1.5 3.5"/>',
  wind: '<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 14h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 18.5h6"/>',
  locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  chev: '<path d="M9.5 6l6 6-6 6"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15.5h6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8v.1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.info}</svg>`;

/* category → icon + tint */
const CI = { health: ['health', 't-ok'], union: ['gov', ''], bazar: ['basket', 't-sun'], edu: ['cap', ''], spot: ['wave', ''], pharmacy: ['pill', 't-ok'],
  fuel: ['fuel', 't-sun'], atm: ['bank', ''], workshop: ['wrench', 't-sun'], shelter: ['shelter', 't-sos'], shop: ['store', 't-sun'], ghat: ['boat', ''], police: ['shield', ''], other: ['wrench', ''] };
const sq = (c, size = '') => `<span class="sq ${CI[c] ? CI[c][1] : ''}">${icon(CI[c] ? CI[c][0] : 'pin', size)}</span>`;

/* ---------- rendering ---------- */
let tab = 'today', cat = 'health', svc = null, situ = null;
const TABS = [
  { id: 'today', n: 'আজ', ic: 'home' }, { id: 'near', n: 'কাছে', ic: 'pin' }, { id: 'services', n: 'সেবা', ic: 'gov' },
  { id: 'search', n: 'খুঁজুন', ic: 'search' }, { id: 'sos', n: 'বিপদে', ic: 'alert' },
];
const ext = 'target="_blank" rel="noopener noreferrer"';
const callBtn = (p, solid = true) => p ? `<a class="btn ${solid ? 'solid' : ''}" href="tel:${esc(p)}">${icon('phone', 'sm')}<span class="num">${bn(p)}</span></a>` : '';
const srcLink = (s) => s ? `<a class="btn ghost" href="${esc(s)}" ${ext}>উৎস ${icon('ext', 'sm')}</a>` : '';
const srcTag = (p) => p.official ? `<span class="badge off">সরকারি তালিকা</span>${p.badge ? `<span class="badge sample">${esc(p.badge)}</span>` : ''}` : p.osm ? '<span class="badge osm">OpenStreetMap, যাচাই করা হয়নি</span>' : p.off ? '<span class="badge off">সরকারি উৎস</span>' : '';

function placeRow(p) {
  return `<div class="r">${sq(p.cat)}
    <div><div class="t">${esc(p.name)}${srcTag(p)}</div><div class="m">${esc(p.sub || '')}</div></div>
    <div class="dist">${p.noLoc ? '<small>অবস্থান জানা নেই</small>' : p.approx ? `${p.km < 1.5 ? 'এই উপজেলায়' : '~' + distTxt(p.km)}<small>আনুমানিক অবস্থান</small>` : `${distTxt(p.km)}<small>${walkTxt(p.km)}</small>`}</div>
    <div class="acts">${callBtn(p.phone)}<a class="btn" href="${esc(dirLink(p))}" ${ext}>${icon('nav', 'sm')}${p.noLoc ? 'Google Maps-এ খুঁজুন' : 'পথ দেখান'}</a>
      <button class="btn" type="button" data-share="${esc(p.name + (p.phone ? ' ' + p.phone : ''))}">${icon('share', 'sm')}শেয়ার</button>${srcLink(p.src)}</div></div>`;
}
function contactRows(list) {
  const rows = list.filter((x) => x && x.c && x.c.p);
  if (!rows.length) return here && !here.union ? '<p class="muted">এই জেলার সরকারি নম্বর আসছে (পর্ব ২)। এখন ৯৯৯ আর জাতীয় হটলাইন ব্যবহার করুন।</p>' : '<p class="muted">সরকারি পাতায় নম্বর প্রকাশিত নেই।</p>';
  return `<div class="rows">${rows.map((x) => `<div class="r"><span class="sq">${icon(x.ic || 'phone')}</span>
    <div><div class="t">${esc(x.label)}<span class="badge off">সরকারি উৎস</span></div><div class="m">${esc(x.c.n || '')}${x.c.t ? ' · ' + esc(x.c.t) : ''}</div></div><span></span>
    <div class="acts">${callBtn(x.c.p)}${srcLink(x.c.s)}</div></div>`).join('')}</div>`;
}
function localContacts() {
  const c = CON(), dist = (here.union && D.district[here.d]) || {}, u = here.union;
  return [
    { label: `${here.upBn} থানা`, c: c.police, ic: 'shield' }, { label: 'উপজেলা স্বাস্থ্য কমপ্লেক্স', c: c.health, ic: 'health' },
    { label: 'উপজেলা নির্বাহী অফিসার (ইউএনও)', c: c.uno, ic: 'gov' }, u && { label: `${u.bn}: চেয়ারম্যান`, c: u.chair, ic: 'gov' },
    here.union && { label: 'ফায়ার সার্ভিস', c: c.fire || { n: 'জাতীয় হটলাইন', p: '102' }, ic: 'alert' }, { label: 'দুর্যোগ: প্রকল্প বাস্তবায়ন কর্মকর্তা', c: c.pio, ic: 'wind' },
    { label: `জেলা প্রশাসক, ${here.dBn}`, c: dist.dc, ic: 'gov' },
  ];
}
const needHere = () => `<section class="card"><h2>প্রথমে আপনার এলাকা বাছুন</h2><p class="muted">লোকেশন দিয়ে, বা ডেমোর একটা জায়গা থেকে।</p>
  <button class="btn solid" type="button" data-open-area>${icon('locate', 'sm')}এলাকা বাছুন</button></section>`;

function viewToday() {
  if (!here) return needHere();
  const s = sunTimes(here.lat, here.lon), h = new Date().getHours();
  const hi = h < 5 ? 'শুভ রাত্রি' : h < 12 ? 'শুভ সকাল' : h < 17 ? 'শুভ দুপুর' : 'শুভ সন্ধ্যা';
  const c = CON();
  const NEEDS = ['health', 'pharmacy', 'fuel', 'shop', 'atm', 'workshop', 'ghat', 'police'];
  return `<section class="card hero"><p class="small">${hi} · ${esc(here.label)}</p><h1>আজ আপনার এলাকায়</h1>
      <div class="bento">
        <div class="cell"><span>${icon('sunrise', 'sm')}সূর্যোদয়</span><b>${s.rise}</b></div>
        <div class="cell"><span>${icon('sunset', 'sm')}সূর্যাস্ত</span><b>${s.set}</b></div>
        <div class="cell"><span>${icon('cloud', 'sm')}আবহাওয়া</span><b>৩০°</b><span>নমুনা</span></div>
        <div class="cell"><span>${icon('flag', 'sm')}ঘূর্ণিঝড় সংকেত</span><b>—</b><span>শীঘ্রই আসছে</span></div>
      </div>
      <p class="small">সূর্যোদয়-সূর্যাস্ত ফোনেই হিসাব হয়, ইন্টারনেট লাগে না। আবহাওয়া আর সংকেত আসবে আবহাওয়া অধিদপ্তর থেকে (পর্ব ৩)।</p></section>
    <section class="card"><div class="sec-head"><h2>কী দরকার?</h2><button class="link" type="button" data-tab-go="near">সব বিভাগ${icon('chev', 'sm')}</button></div>
      <div class="needs">${NEEDS.map((id) => { const k = CATS.find((x) => x.id === id); return `<button class="need" type="button" data-cat="${id}">${sq(id)}${k.n}</button>`; }).join('')}</div></section>
    <section class="card"><div class="sec-head"><h2>সরকারি সেবা সহজে</h2><button class="link" type="button" data-tab-go="services">সব সেবা${icon('chev', 'sm')}</button></div>
      <div class="pills">${SERVICES.slice(0, 5).map((x) => `<button class="pill" type="button" data-svc="${x.id}">${esc(x.n)}</button>`).join('')}</div></section>
    <section class="card"><h2>নিরাপদে পৌঁছানো</h2><p class="muted">রওনা দেওয়ার সময় আর পৌঁছে এক চাপে পরিবারকে জানান। SMS-এ যায়, ইন্টারনেট লাগে না।</p>
      <div class="pills"><button class="btn solid" type="button" data-trip="start">${icon('bus', 'sm')}রওনা দিলাম</button><button class="btn" type="button" data-trip="arrived">${icon('check', 'sm')}পৌঁছেছি</button></div></section>
    <section class="card"><div class="sec-head"><h2>এলাকার জরুরি নম্বর</h2><button class="link" type="button" data-tab-go="sos">সব নম্বর${icon('chev', 'sm')}</button></div>
      ${contactRows([{ label: `${here.upBn} থানা`, c: c.police, ic: 'shield' }, { label: 'উপজেলা স্বাস্থ্য কমপ্লেক্স', c: c.health, ic: 'health' }])}</section>`;
}

let mapOn = false;
function viewNear() {
  if (!here) return needHere();
  const k = CATS.find((x) => x.id === cat), osmCat = !!OSMCAT[cat], loading = osmCat && !here.places;
  const items = loading ? [] : nearby(cat).map((p) => ({ ...p, cat }));
  const pilotOnly = ['union', 'edu', 'spot'].includes(cat) && !here.union;
  const gq = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${GQ[cat] || k.n} ${here.upBn} ${here.dBn}`)}`;
  const empty = `<div class="note">${icon('info')}<p>${pilotOnly ? 'এই তথ্য এখন শুধু নোয়াখালী আর কক্সবাজারের জন্য আছে; বাকি জেলায় আসছে।'
    : cat === 'shelter' ? 'আশ্রয়কেন্দ্রের সরকারি তালিকা আসছে (দুর্যোগ ব্যবস্থাপনা অধিদপ্তর)।'
    : `${esc(here.upBn)}-এর কাছে এখনো কোনো ${esc(k.n)} আমাদের তালিকায় নেই। OpenStreetMap-এ এই এলাকার তথ্য কম; সরকারি তালিকা আর স্বেচ্ছাসেবকদের তথ্য যোগ হচ্ছে।`}</p></div>`;
  return `<section class="card"><p class="eyebrow">আমার কাছে · ${esc(here.dBn)}</p><h1>${esc(k.n)}</h1><p class="muted">${esc(here.label)} থেকে দূরত্ব, কাছেরটা আগে। দূরত্ব ফোনেই হিসাব হয়, লোকেশন কোথাও যায় না।</p>
      <div class="scroller" role="group" aria-label="বিভাগ">${CATS.map((x) => `<button class="pill" type="button" data-cat="${x.id}" aria-pressed="${x.id === cat}">${icon(CI[x.id][0], 'sm')}${x.n}</button>`).join('')}</div>
      <div class="pills"><button class="btn ${mapOn ? 'solid' : ''}" type="button" data-map>${icon('pin', 'sm')}${mapOn ? 'ম্যাপ লুকান' : 'ম্যাপে দেখুন'}</button>
      <a class="btn ghost" href="${esc(gq)}" ${ext}>Google Maps-এ আরও দেখুন ${icon('ext', 'sm')}</a></div></section>
    ${mapOn ? `<section class="card"><div class="mapwrap"><div id="map" role="region" aria-label="ম্যাপ"></div></div><p class="small">ম্যাপ দেখতে ইন্টারনেট লাগে; ম্যাপের ছবি OpenStreetMap থেকে আসে। নিচের তালিকা নেট ছাড়াও চলে।</p></section>` : ''}
    <section class="card">${loading ? '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>'
      : items.length ? `<div class="rows">${items.map(placeRow).join('')}</div>` : empty}
      ${['bazar', 'edu', 'spot'].includes(cat) && items.some((p) => p.approx) ? '<p class="small">"আনুমানিক": জায়গাটার নিজের অবস্থান এখনো নেই, তাই তার ইউনিয়ন বা উপজেলার কেন্দ্র থেকে দূরত্ব দেখানো হচ্ছে।</p>' : ''}
      ${items.some((p) => p.official) ? '<p class="small">ফিলিং স্টেশন: পদ্মা অয়েল (২০১৯) আর মেঘনা পেট্রোলিয়ামের (২০২৫) সরকারি ডিলার তালিকা। তালিকায় অবস্থান নেই, তাই উপজেলার কেন্দ্র থেকে আনুমানিক দূরত্ব; উপজেলা জানা না থাকলে "অবস্থান জানা নেই"। যমুনা অয়েলের তালিকা এখনো যোগ হয়নি।</p>' : ''}
      ${items.some((p) => p.osm) ? '<p class="small">জায়গা © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL), ১৩ নভেম্বর ২০২৬-এর তথ্য। ফোন নম্বর রাখা হয়নি, কারণ সেগুলো সরকারি উৎসের না।</p>' : ''}</section>`;
}

const SVC_IC = { birth: 'doc', death: 'doc', citizen: 'doc', heir: 'doc', mutation: 'gov', nid: 'doc', trade: 'store' };
function viewServices() {
  if (svc) {
    const s = SERVICES.find((x) => x.id === svc);
    let where = '';
    if (here) {
      const u = here.union, c = CON(), ctr = D.upazilas[here.up] ? D.upazilas[here.up].center : [here.ctr.lat, here.ctr.lon];
      where = s.where === 'union' && u
        ? `<p><b>${esc(u.bn)} পরিষদ</b> <span class="muted">(আপনার ইউনিয়ন)</span></p>${contactRows([{ label: 'চেয়ারম্যান', c: u.chair, ic: 'gov' }, { label: 'ইউপি সচিব', c: u.sec, ic: 'gov' }])}
           <a class="btn" href="${esc(dirLink(u))}" ${ext}>${icon('nav', 'sm')}ইউনিয়ন পরিষদের পথ</a>`
        : `<p><b>${esc(here.upBn)} উপজেলা পরিষদ</b> <span class="muted">(উপজেলা অফিস)</span></p>${contactRows([{ label: 'উপজেলা নির্বাহী অফিসার', c: c.uno, ic: 'gov' }])}
           <a class="btn" href="${esc(dirLink({ lat: ctr[0], lon: ctr[1] }))}" ${ext}>${icon('nav', 'sm')}উপজেলা অফিসের পথ</a>`;
    } else where = '<p class="muted">এলাকা বাছলে আপনার ইউনিয়ন বা উপজেলার অফিস আর নম্বর দেখাবে।</p>';
    return `<button class="link" type="button" data-svc="">${icon('back', 'sm')}সব সেবা</button>
      <section class="card"><p class="eyebrow">সরকারি সেবা</p><h1>${esc(s.n)}</h1>
        <h3>কোথায় যাবেন</h3>${where}
        <h3>কী লাগবে</h3><ol class="steps">${s.docs.map((d) => `<li>${esc(d)}</li>`).join('')}</ol>
        ${s.link ? `<a class="btn solid" href="${esc(s.link)}" ${ext}>${icon('globe', 'sm')}অনলাইনে আবেদন: ${esc(s.link.replace('https://', ''))}</a>` : '<p class="small">এই সেবার অনলাইন আবেদন নেই, অফিসে গিয়ে করতে হয়।</p>'}
        <div class="note">${icon('info')}<p>সাধারণ তথ্য। ফি আর কাগজের সর্বশেষ তালিকা আবেদনের আগে সরকারি পাতায় বা অফিসে মিলিয়ে নিন। দালালের কাছে যাবেন না।</p></div></section>`;
  }
  return `<section class="card"><p class="eyebrow">সরকারি সেবা সহজে</p><h1>কোথায় যাবেন, কী লাগবে</h1><p class="muted">অনলাইনে হয় কি না, আর আপনার এলাকার অফিসের নম্বর।</p>
      <div>${SERVICES.map((x) => `<button class="hit" type="button" data-svc="${x.id}"><span class="sq">${icon(SVC_IC[x.id])}</span><span><span class="t w600">${esc(x.n)}</span><br><span class="small">${x.where === 'union' ? 'ইউনিয়ন পরিষদ' : 'উপজেলা অফিস'}${x.link ? ' · অনলাইনেও' : ''}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div></section>
    <section class="card"><h2>আরও সরকারি হেল্পলাইন</h2><div class="rows">${D.national.filter((r) => ['16122', '333', '16445', '16999', '16699'].includes(r.p)).map((r) => `<div class="r"><span class="sq">${icon('phone')}</span><div><div class="t">${esc(r.n)}</div></div><span></span><div class="acts">${callBtn(r.p, false)}</div></div>`).join('')}</div></section>`;
}

const SITU = [
  { id: 'sick', n: 'হঠাৎ অসুস্থ', ic: 'sick', steps: ['গুরুতর হলে এখনই ৯৯৯-এ কল করে অ্যাম্বুলেন্স চান।', 'কাছের স্বাস্থ্য কমপ্লেক্সে ফোন করুন বা যান।', 'ডাক্তারের পরামর্শ: স্বাস্থ্য বাতায়ন ১৬২৬৩।', 'পরিবারকে বিপদ বার্তা পাঠান।'], cats: ['health', 'pharmacy'], keys: ['health'] },
  { id: 'accident', n: 'দুর্ঘটনা', ic: 'amb', steps: ['৯৯৯-এ কল করুন, জায়গার নাম বলুন।', 'আহতকে না সরানোই ভালো; শুধু আগুন বা গাড়ির বিপদ থাকলে সাবধানে সরান। রক্ত পড়লে পরিষ্কার কাপড় দিয়ে চেপে ধরুন।', 'কাছের স্বাস্থ্য কমপ্লেক্সে নিন।', 'থানাকে জানান।'], cats: ['health'], keys: ['health', 'police'] },
  { id: 'followed', n: 'কেউ পিছু নিয়েছে', ic: 'eye', steps: ['ভিড় বা আলোর জায়গায় যান, দোকানে ঢুকুন।', '৯৯৯-এ কল করুন।', 'পরিবারকে বিপদ বার্তা পাঠান (ফোন না, মেসেজ)।', 'থানার নম্বর হাতের কাছে রাখুন।'], cats: ['bazar'], keys: ['police'] },
  { id: 'theft', n: 'চুরি বা ছিনতাই', ic: 'bag', steps: ['আগে নিজে নিরাপদ থাকুন, বাধা দেবেন না।', 'থানায় সাধারণ ডায়েরি (জিডি) করুন।', 'মোবাইল বা কার্ড হারালে অপারেটর আর ব্যাংকের হেল্পলাইনে কল করে বন্ধ করুন।'], cats: [], keys: ['police'] },
  { id: 'lost', n: 'পথ হারিয়েছি', ic: 'compass', steps: ['যেখানে আছেন থাকুন, আশপাশের দোকান বা বাজারের নাম দেখুন।', 'পরিবারকে লোকেশন পাঠান।', 'পর্যটক হলে ট্যুরিস্ট পুলিশ: ০১৩২০২২২২২২।'], cats: ['bazar', 'spot'], keys: ['police'] },
  { id: 'breakdown', n: 'গাড়ি বা বাইক নষ্ট', ic: 'bike', steps: ['রাস্তার পাশে নিরাপদে থামুন, ইন্ডিকেটর জ্বালান।', 'কাছের ওয়ার্কশপ বা পাম্প খুঁজুন।', 'রাতে হলে থানাকে জানিয়ে রাখুন।'], cats: ['workshop', 'fuel'], keys: ['police'] },
  { id: 'cyclone', n: 'ঘূর্ণিঝড় বা বন্যা', ic: 'wind', steps: ['১০৯০-এ কল করে আগাম বার্তা শুনুন।', 'বিপদ সংকেত হলে দেরি না করে আশ্রয়কেন্দ্রে যান।', 'জরুরি ব্যাগ: পানি, শুকনো খাবার, ওষুধ, কাগজপত্র, টর্চ।', 'উপজেলা দুর্যোগ কর্মকর্তার নম্বর রাখুন।'], cats: ['shelter'], keys: ['pio'] },
];
function viewSos() {
  const people = store.get('demo-people') || '';
  let situHtml = '';
  if (situ && here) {
    const s = SITU.find((x) => x.id === situ), c = CON();
    const L = { health: ['উপজেলা স্বাস্থ্য কমপ্লেক্স', 'health'], police: [`${here.upBn} থানা`, 'shield'], pio: ['দুর্যোগ: প্রকল্প বাস্তবায়ন কর্মকর্তা', 'wind'] };
    situHtml = `<section class="card"><div class="sec-head"><h2>${esc(s.n)}: এখন যা করবেন</h2><span class="sq t-sos">${icon(s.ic)}</span></div>
      <ol class="steps">${s.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      ${contactRows(s.keys.map((k) => ({ label: L[k][0], c: c[k], ic: L[k][1] })))}
      ${s.cats.length ? `<div class="pills">${s.cats.map((k) => `<button class="pill" type="button" data-cat="${k}">${icon(CI[k][0], 'sm')}কাছের ${CATS.find((y) => y.id === k).n}</button>`).join('')}</div>` : ''}</section>`;
  }
  return `<a class="sosbig" href="tel:999"><span class="ring">${icon('phone', 'lg')}</span><span><b>৯৯৯-এ কল করুন</b><span>পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স · বিনা খরচে</span></span></a>
    <section class="card"><h2>কী হয়েছে?</h2><div class="pills">${SITU.map((x) => `<button class="pill" type="button" data-situ="${x.id}" aria-pressed="${x.id === situ}">${icon(x.ic, 'sm')}${x.n}</button>`).join('')}</div>
      ${!here ? '<p class="muted">এলাকা বাছলে সেখানকার নম্বরও দেখাবে।</p>' : ''}</section>
    ${situHtml}
    <section class="card"><h2>বিপদ বার্তা</h2><p class="muted">এক চাপে প্রিয়জনদের SMS: এলাকা, থানার নম্বর আর আপনার লোকেশনের লিংক।</p>
      <label for="people">প্রিয়জনের নম্বর (কমা দিয়ে আলাদা)</label><input type="tel" id="people" value="${esc(people)}" placeholder="০১৭XXXXXXXX, ০১৮XXXXXXXX">
      <div><button class="btn danger" type="button" id="sosMake">${icon('msg', 'sm')}বিপদ বার্তা তৈরি করুন</button></div>
      <div id="sosOut"></div></section>
    ${here ? `<section class="card"><h2>${esc(here.upBn)}-এর জরুরি নম্বর</h2>${contactRows(localContacts())}</section>` : ''}
    <section class="card"><h2>সারা দেশের হটলাইন</h2><div class="rows">${D.national.slice(0, 11).map((r) => `<div class="r"><span class="sq">${icon('phone')}</span><div><div class="t">${esc(r.n)}</div></div><span></span><div class="acts">${callBtn(r.p, false)}</div></div>`).join('')}</div></section>`;
}
let q = '';
function searchIndex() {
  if (searchIndex.v) return searchIndex.v;
  const e = [];
  for (const u of D.unions) e.push({ t: 'union', bn: u.bn, en: u.en, sub: `${UPBN[u.up]}, ${DBN[u.d]}`, go: () => locate(u.lat, u.lon, `${u.bn}, ${UPBN[u.up]}`) });
  for (const m of D.towns) e.push({ t: 'town', bn: m.bn, sub: `${UPBN[m.up]}, ${DBN[m.d]}`, go: () => locate(m.lat, m.lon, m.bn) });
  for (const [up, info] of Object.entries(D.upazilas)) e.push({ t: 'upazila', bn: UPBN[up] + ' উপজেলা', en: up, sub: DBN[info.district], go: () => locate(info.center[0], info.center[1], UPBN[up]) });
  // All 64 districts: every upazila centre from data/upazila_centres.json, and each district (its first centre).
  const seenD = new Set();
  for (const c of CEN.centres) {
    if (!PILOT.has(c.district)) e.push({ t: 'upazila', bn: c.upazila_bn + ' উপজেলা', en: c.upazila_en, sub: DISTBN[c.district], go: () => locate(c.lat, c.lon, `${c.upazila_bn}, ${DISTBN[c.district]}`) });
    if (!seenD.has(c.district)) { seenD.add(c.district); const sad = CEN.centres.find((x) => x.district === c.district && (x.upazila_en === c.district || /sadar/i.test(x.upazila_en))) || c;
      e.push({ t: 'district', bn: DISTBN[c.district] + ' জেলা', en: c.district, sub: 'জেলা', go: () => locate(sad.lat, sad.lon, `${sad.upazila_bn}, ${DISTBN[c.district]}`) }); }
  }
  for (const l of D.landmarks) { const u = unionOf(l.u, l.up); if (u) e.push({ t: l.t, bn: l.n, sub: `${l.u}, ${UPBN[l.up] || ''}`, go: () => locate(u.lat, u.lon, `${l.n} এলাকা`) }); }
  for (const s of D.spots) { const u = s.u && unionOf(s.u, s.up); const c = u ? [u.lat, u.lon] : (D.upazilas[s.up] || {}).center; if (c) e.push({ t: 'spot', bn: s.n, en: s.en, sub: `${UPBN[s.up] || ''}, ${DBN[s.d] || ''}`, go: () => locate(c[0], c[1], s.n) }); }
  // Local names and tourist spots the site knows (data/aliases.json: Laboni, Kashem Bazar, …), placed at their town,
  // union or upazila; never at a guessed point.
  for (const a of ALI.aliases || []) {
    const tn = a.municipality_bn && D.towns.find((m) => m.bn === a.municipality_bn), un = a.union_bn && D.unions.find((u) => u.bn === a.union_bn && u.up === a.upazila_en);
    const up = D.upazilas[a.upazila_en], cen = CEN.centres.find((c) => c.upazila_en === a.upazila_en);
    const at = tn ? [tn.lat, tn.lon] : un ? [un.lat, un.lon] : up ? up.center : cen ? [cen.lat, cen.lon] : null;
    if (at) e.push({ t: 'local', bn: a.name_bn, en: [a.name_en, ...(a.also || [])].filter(Boolean).join(' '), sub: [a.municipality_bn || a.union_bn, UPBN[a.upazila_en] || (cen && cen.upazila_bn)].filter(Boolean).join(', '), go: () => locate(at[0], at[1], a.name_bn) });
  }
  for (const s of SERVICES) e.push({ t: 'service', bn: s.n, en: s.en, sub: 'সরকারি সেবা', go: () => { svc = s.id; setTab('services'); } });
  for (const k of CATS) e.push({ t: 'cat', bn: k.n, en: { health: 'hospital clinic doctor', pharmacy: 'pharmacy medicine oshudh', fuel: 'petrol pump fuel', atm: 'bank atm', workshop: 'workshop mechanic garage', shelter: 'shelter cyclone ashroy', shop: 'shop dokan store', bazar: 'bazar market', edu: 'school college', spot: 'tourist beach', union: 'union parishad', ghat: 'ghat launch bus' }[k.id], sub: 'কাছের জায়গা', go: () => { cat = k.id; setTab('near'); } });
  for (const x of e) x.keys = [...new Set([x.bn, x.en, x.bn.replace(KIND, ' '), ...(x.en || '').split(' ')].filter(Boolean).map(soundKey).filter((k) => k.length >= 2))];
  return (searchIndex.v = e);
}
function runSearch(text) {
  const plain = text.trim().toLowerCase().normalize('NFC'); if (!plain || COMMON.has(plain)) return [];
  const words = plain.split(/[\s,]+/).filter((w) => !COMMON.has(w)); const qk = soundKey(words.join(' ')); if (qk.length < 2) return [];
  const hits = [];
  for (const x of searchIndex()) { let best = 9;
    if (x.bn.toLowerCase().includes(plain) || (x.en || '').toLowerCase().includes(plain)) best = -1;
    for (const k of x.keys) { if (k === qk) best = Math.min(best, 0); else if (qk.length >= 4 && k.startsWith(qk)) best = Math.min(best, 0.5); else if (qk.length >= 4 && k.length >= 4) best = Math.min(best, lev(k, qk)); }
    if (best <= 1) hits.push({ x, best }); }
  return hits.sort((a, b) => a.best - b.best || a.x.bn.length - b.x.bn.length).slice(0, 12);
}
const TNAME = { union: 'ইউনিয়ন', town: 'পৌরসভা', upazila: 'উপজেলা', bazar: 'বাজার', school: 'স্কুল', college: 'কলেজ', madrasa: 'মাদ্রাসা', spot: 'দর্শনীয় স্থান', service: 'সেবা', cat: 'বিভাগ', district: 'জেলা', local: 'জায়গা' };
let lastHits = [];
const TIC = { union: 'gov', town: 'gov', upazila: 'gov', district: 'gov', local: 'pin', bazar: 'basket', school: 'cap', college: 'cap', madrasa: 'cap', spot: 'wave', service: 'doc', cat: 'search' };
function viewSearch() {
  lastHits = runSearch(q);
  return `<section class="card"><p class="eyebrow">খুঁজুন</p><h1>জায়গা, সেবা বা দরকার</h1>
      <label for="q" class="muted w500">বাংলা, ইংরেজি বা বাংলিশে লিখুন, ভুল বানানেও পাবেন</label>
      <div class="searchbox">${icon('search')}<input type="search" id="q" value="${esc(q)}" placeholder="যেমন: hatiya, ফার্মেসি, jonmo nibondhon" autocomplete="off"></div>
      <div class="pills">${['hatiya', 'choumuhoni', 'jonmo nibondhon', 'pharmacy', 'himchori', 'namjari'].map((x) => `<button class="pill" type="button" data-q="${x}">${x}</button>`).join('')}</div></section>
    <section class="card" id="hits">${hitsHtml()}</section>`;
}
const hitsHtml = () => !q ? '<p class="muted">উপরে লিখুন, বা একটা উদাহরণে চাপ দিন।</p>' : lastHits.length
  ? `<p class="eyebrow">${bn(lastHits.length)}টা ফল</p><div>${lastHits.map((h, i) => `<button class="hit" type="button" data-hit="${i}"><span class="sq">${icon(TIC[h.x.t] || 'pin')}</span><span><span class="w600">${esc(h.x.bn)}</span><span class="badge off">${TNAME[h.x.t] || ''}</span><br><span class="small">${esc(h.x.sub || '')}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div>`
  : `<p class="muted">পাওয়া যায়নি। লোকেশন দিয়ে খুঁজুন, বা উপজেলার নাম লিখুন।</p><div><button class="btn solid" type="button" data-open-area>${icon('locate', 'sm')}লোকেশন দিয়ে খুঁজুন</button></div>`;

/* ---------- glue ---------- */
const VIEWS = { today: viewToday, near: viewNear, services: viewServices, sos: viewSos, search: viewSearch };
const navHtml = () => TABS.map((t) => `<button class="navbtn ${t.id === 'sos' ? 'sos' : ''}" type="button" data-tab="${t.id}" aria-current="${t.id === tab ? 'page' : 'false'}">${icon(t.ic)}<span>${t.n}</span></button>`).join('');
let mapObj = null;
function render() {
  if (mapObj) { mapObj.remove(); mapObj = null; }
  $('#view').innerHTML = VIEWS[tab]();
  if (tab === 'near' && mapOn) drawMap();
  $('#dockNav').innerHTML = navHtml(); $('#railNav').innerHTML = navHtml();
}
function setTab(t) { tab = t; render(); window.scrollTo(0, 0); }
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2200); }
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('কপি হয়েছে'); } catch { toast('কপি করা যায়নি'); } }
function smsBlock(text) {
  const to = (store.get('demo-people') || '').replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/[^\d,+]/g, '');
  return `<div class="okbox">${esc(text)}</div><div class="pills"><a class="btn solid" href="sms:${esc(to)}?body=${encodeURIComponent(text)}">${icon('msg', 'sm')}SMS অ্যাপ খুলুন</a><button class="btn" type="button" data-copy="${esc(text)}">${icon('copy', 'sm')}কপি</button></div>
    <p class="small">ওয়েবসাইট নিজে SMS পাঠায় না: SMS অ্যাপে Send আপনাকেই চাপতে হবে।</p>`;
}

// The map (Leaflet 1.9.4 in vendor/, OpenStreetMap tiles): only after the person taps "ম্যাপে দেখুন". It starts at the
// chosen area; the tiles show OSM's server which part of the map is open, nothing else. Popups are built with textContent.
function drawMap() {
  const el = $('#map'); if (!el || !window.L || !here) return;
  if (!navigator.onLine) { el.textContent = 'ইন্টারনেট নেই, তাই ম্যাপ দেখানো যাচ্ছে না। নিচের তালিকা ব্যবহার করুন।'; return; }
  mapObj = L.map(el).setView([here.lat, here.lon], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(mapObj);
  const css = getComputedStyle(document.documentElement), brand = css.getPropertyValue('--brand').trim() || '#0b4a4e', sos = css.getPropertyValue('--sos').trim() || '#cc2f2b';
  const pts = [[here.lat, here.lon]];
  for (const p of nearby(cat).filter((x) => !x.noLoc)) {
    const box = document.createElement('div'), b = document.createElement('b'), s = document.createElement('div'), a = document.createElement('a');
    b.textContent = p.name; s.textContent = `${p.sub || ''} · ${distTxt(p.km)}`; a.textContent = 'পথ দেখান'; a.href = dirLink(p); a.target = '_blank'; a.rel = 'noopener noreferrer';
    box.append(b, s, a);
    L.circleMarker([p.lat, p.lon], { radius: 7, color: brand, weight: 2, fillColor: brand, fillOpacity: 0.35 }).addTo(mapObj).bindPopup(box);
    pts.push([p.lat, p.lon]);
  }
  // The chosen area on top; zoom to it and the 8 nearest places (far ones stay on the map, outside the first view).
  L.circleMarker([here.lat, here.lon], { radius: 9, color: '#ffffff', weight: 3, fillColor: sos, fillOpacity: 1 }).addTo(mapObj).bindTooltip('বাছাই করা এলাকা');
  if (pts.length > 1) mapObj.fitBounds(pts.slice(0, 9), { padding: [28, 28], maxZoom: 15 });
}
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('button, a'); if (!t) return;
  if (t.dataset.tab) return setTab(t.dataset.tab);
  if (t.dataset.tabGo) return setTab(t.dataset.tabGo);
  if (t.dataset.cat) { cat = t.dataset.cat; return setTab('near'); }
  if ('svc' in t.dataset) { svc = t.dataset.svc || null; return setTab('services'); }
  if (t.dataset.situ) { situ = t.dataset.situ; render(); return; }
  if (t.dataset.q) { q = t.dataset.q; render(); return; }
  if (t.dataset.hit) { const h = lastHits[Number(t.dataset.hit)]; if (h) { h.x.go(); if (!['service', 'cat'].includes(h.x.t)) setTab('near'); } return; }
  if (t.dataset.share) return copy(t.dataset.share);
  if (t.dataset.copy) return copy(t.dataset.copy);
  if ('map' in t.dataset) { mapOn = !mapOn; render(); return; }
  if (t.id === 'goUp') { const c = CEN.centres[Number($('#upSel').value)]; if (c) { $('#areaDlg').close(); locate(c.lat, c.lon, `${c.upazila_bn}, ${DISTBN[c.district]}`); } return; }
  if ('openArea' in t.dataset) return $('#areaDlg').showModal();
  if (t.dataset.trip) {
    if (!here) return $('#areaDlg').showModal();
    const msg = t.dataset.trip === 'start' ? `রওনা দিলাম, ${here.label} থেকে। পৌঁছে জানাব। না জানালে ${CON().police ? `${here.upBn} থানা: ${CON().police.p}` : '৯৯৯-এ কল কোরো'}` : `নিরাপদে পৌঁছেছি। চিন্তা কোরো না।`;
    situ = null; tab = 'sos'; render(); $('#sosOut').innerHTML = smsBlock(msg); return;
  }
  if (t.id === 'sosMake') {
    store.set('demo-people', $('#people').value);
    if (!here) return $('#areaDlg').showModal();
    const pol = CON().police, sit = SITU.find((x) => x.id === situ);
    const link = `https://jerin101.github.io/safe-connect/#/help/${here.lat.toFixed(5)},${here.lon.toFixed(5)},${Math.floor(Date.now() / 1000)}${situ === 'followed' ? ',followed' : ''}`;
    const msg = `জরুরি! ${sit && sit.id === 'followed' ? 'কেউ আমার পিছু নিয়েছে।' : 'বিপদে আছি, এখনই সাহায্য দরকার।'}\nএলাকা: ${here.upBn}, ${here.dBn}\nআগে 999-এ কল করো।${pol ? ' থানা: ' + pol.p : ''}\nলোকেশন: ${link}`;
    $('#sosOut').innerHTML = smsBlock(msg); return;
  }
  if (t.id === 'areaBtn') return $('#areaDlg').showModal();
  if (t.id === 'areaClose') return $('#areaDlg').close();
  if (t.id === 'gpsBtn') {
    if (!navigator.geolocation) { $('#gpsMsg').textContent = 'এই ব্রাউজারে লোকেশন নেই। নিচ থেকে একটা জায়গা বাছুন।'; return; }
    $('#gpsMsg').textContent = 'লোকেশন খোঁজা হচ্ছে…';
    navigator.geolocation.getCurrentPosition((p) => {
      const { latitude: la, longitude: lo } = p.coords;
      if (la < 20.5 || la > 26.7 || lo < 88.0 || lo > 92.7) { $('#gpsMsg').textContent = 'আপনি বাংলাদেশের বাইরে আছেন বলে মনে হচ্ছে। নিচ থেকে একটা জেলা বাছুন।'; return; }
      $('#areaDlg').close(); locate(la, lo);
    }, () => { $('#gpsMsg').textContent = 'লোকেশন পাওয়া যায়নি। নিচ থেকে একটা জায়গা বাছুন।'; }, { timeout: 15000 });
  }
  if (t.dataset.preset) { const p = PRESETS[Number(t.dataset.preset)]; $('#areaDlg').close(); locate(p.lat, p.lon, p.n); }
});
document.addEventListener('input', (ev) => { if (ev.target.id === 'q') { q = ev.target.value; lastHits = runSearch(q); $('#hits').innerHTML = hitsHtml(); } });
// District and upazila pickers (all 64 districts), built with textContent.
const sadar = (c) => (c.upazila_en === c.district || /sadar/i.test(c.upazila_en) ? 1 : 0);
function fillUps() {
  const sel = $('#upSel'); sel.textContent = '';
  CEN.centres.map((c, i) => ({ c, i })).filter((x) => x.c.district === $('#distSel').value)
    .sort((a, b) => sadar(b.c) - sadar(a.c) || a.c.upazila_bn.localeCompare(b.c.upazila_bn, 'bn')).forEach(({ c, i }) => { const o = document.createElement('option'); o.value = i; o.textContent = c.upazila_bn; sel.append(o); });
}
for (const d of [...new Set(CEN.centres.map((c) => c.district))].sort((a, b) => (DISTBN[a] || a).localeCompare(DISTBN[b] || b, 'bn'))) {
  const o = document.createElement('option'); o.value = d; o.textContent = DISTBN[d] || d; $('#distSel').append(o);
}
$('#distSel').value = 'Noakhali'; fillUps();
$('#distSel').addEventListener('change', fillUps);
$('#presetList').innerHTML = PRESETS.map((p, i) => `<button class="opt" type="button" data-preset="${i}">${icon('pin','sm')}${esc(p.n)}</button>`).join('');
try { const h = JSON.parse(store.get('demo-here') || 'null'); if (h) locate(h.lat, h.lon, h.label); else locate(PRESETS[0].lat, PRESETS[0].lon, PRESETS[0].n); } catch { locate(PRESETS[0].lat, PRESETS[0].lon, PRESETS[0].n); }
render();
$('#areaDlg').addEventListener('click', (e) => { if (e.target.id === 'areaDlg') e.target.close(); });
