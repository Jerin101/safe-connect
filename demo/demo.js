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
  { id: 'health', n: 'হাসপাতাল ও ক্লিনিক' }, { id: 'pharmacy', n: 'ফার্মেসি' }, { id: 'fuel', n: 'ফিলিং স্টেশন' }, { id: 'shop', n: 'দোকান ও সুপারশপ' },
  { id: 'bazar', n: 'বাজার' }, { id: 'atm', n: 'ব্যাংক/ATM' }, { id: 'workshop', n: 'ওয়ার্কশপ' }, { id: 'ghat', n: 'যাতায়াত: বাস, ঘাট, রেল' },
  { id: 'police', n: 'থানা ও ফায়ার' }, { id: 'post', n: 'পোস্ট অফিস' }, { id: 'spot', n: 'দর্শনীয় স্থান' }, { id: 'stay', n: 'হোটেল ও খাবার' },
  { id: 'edu', n: 'স্কুল-কলেজ' }, { id: 'worship', n: 'উপাসনালয়' }, { id: 'shelter', n: 'আশ্রয়কেন্দ্র' }, { id: 'union', n: 'ইউনিয়ন পরিষদ' },
  { id: 'other', n: 'অন্যান্য সেবা' },
];
const GQ = { health: 'hospital', pharmacy: 'pharmacy', fuel: 'filling station petrol pump', atm: 'ATM bank', workshop: 'workshop mechanic', shelter: 'cyclone shelter', shop: 'shop', ghat: 'bus stand ghat', bazar: 'bazar', edu: 'school', spot: 'tourist spot', union: 'union parishad', police: 'police station', other: 'service', post: 'post office', stay: 'hotel restaurant', worship: 'mosque temple' };
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
  ghat: (p) => ['bus_station', 'ferry_terminal', 'railway_station'].includes(p.subcategory),
  police: (p) => p.category === 'public_offices' && p.subcategory !== 'post_office',
  post: (p) => p.subcategory === 'post_office',
  spot: (p) => p.category === 'tourism',
  stay: (p) => p.category === 'stay_food',
  edu: (p) => p.category === 'education',
  worship: (p) => p.category === 'worship',
  shelter: (p) => p.category === 'shelter',
  other: (p) => p.category === 'other_services',
};
const SUBBN = { hospital: 'হাসপাতাল', clinic: 'ক্লিনিক', doctors: 'ডাক্তারের চেম্বার', pharmacy: 'ফার্মেসি', chemist: 'ফার্মেসি', fuel: 'পেট্রোল/সিএনজি পাম্প',
  bank: 'ব্যাংক', atm: 'এটিএম', supermarket: 'সুপারশপ', convenience: 'মুদি দোকান', general: 'দোকান', mall: 'শপিং মল', marketplace: 'বাজার',
  bus_station: 'বাস স্ট্যান্ড', ferry_terminal: 'ঘাট', police: 'থানা বা ফাঁড়ি', fire_station: 'ফায়ার সার্ভিস', car_repair: 'গাড়ি মেরামত',
  motorcycle_repair: 'মোটরসাইকেল মেরামত', motorcycle: 'মোটরসাইকেলের দোকান', bicycle: 'সাইকেল', mobile_phone: 'মোবাইলের দোকান',
  electronics_repair: 'ইলেকট্রনিক্স মেরামত', mobile_phone_repair: 'মোবাইল মেরামত', shoemaker: 'জুতা মেরামত', tailor: 'দর্জি', railway_station: 'রেলস্টেশন', post_office: 'পোস্ট অফিস', attraction: 'দর্শনীয় স্থান', viewpoint: 'ভিউপয়েন্ট',
  beach: 'সৈকত', museum: 'জাদুঘর', park: 'পার্ক', zoo: 'চিড়িয়াখানা', theme_park: 'বিনোদন পার্ক', picnic_site: 'পিকনিক স্পট', waterfall: 'ঝরনা', island: 'দ্বীপ',
  hotel: 'হোটেল', guest_house: 'গেস্ট হাউস', resort: 'রিসোর্ট', motel: 'মোটেল', restaurant: 'রেস্টুরেন্ট', cafe: 'ক্যাফে', fast_food: 'ফাস্ট ফুড',
  school: 'স্কুল', college: 'কলেজ', university: 'বিশ্ববিদ্যালয়', madrasa: 'মাদ্রাসা', mosque: 'মসজিদ', temple: 'মন্দির', church: 'গির্জা',
  pagoda: 'প্যাগোডা', place_of_worship: 'উপাসনালয়', shelter: 'আশ্রয়কেন্দ্র', cyclone_shelter: 'ঘূর্ণিঝড় আশ্রয়কেন্দ্র' };
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
        pid: p.id, lat: c ? c.lat : null, lon: c ? c.lon : null, approx: !!c, noLoc: !c, q: `${p.name_en || 'filling station'} ${upb || ''} ${here.dBn}`.trim(), official: true, badge: p.list.badge_bn });
    }
    for (const p of here.places) if (OSMCAT[cat](p) && p.source !== 'official') out.push({ name: placeName(p), sub: `${SUBBN[p.subcategory] || p.subcategory}${p.upazila ? ' · ' + (UPBN[p.upazila] || UPBN_ALL[`${p.district}|${p.upazila}`] || p.upazila) : ''}`, src: p.source_url, lat: p.lat, lon: p.lon, osm: true, pid: p.id });
  }
  for (const p of out) p.km = p.noLoc ? null : hav(here, p);
  // Official rows only when they are near (the pilot lists cover two districts). Places with no location (an official
  // list that names only the district) come after the ones with a distance.
  const withLoc = out.filter((p) => !p.noLoc && (!p.off || p.km < 60)).sort((a, b) => a.km - b.km);
  return [...withLoc, ...out.filter((p) => p.noLoc)].slice(0, 30);
}

/* ---------- own icon set (inline SVG, 24×24, stroke) ---------- */
const P = {
  bed: '<path d="M3 19V7"/><path d="M3 15h18v4"/><path d="M21 15v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="12" r="2"/>',
  dome: '<path d="M5 20v-8a7 7 0 0 1 14 0v8"/><path d="M3 20h18"/><path d="M12 5V3"/><path d="M10 20v-4a2 2 0 0 1 4 0v4"/>',
  mail: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>',
  train: '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12"/><path d="M8 20l2-4M16 20l-2-4"/><path d="M9 13.5v.1M15 13.5v.1"/>',
  hands: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
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
const CI = { health: ['health', 't-ok'], union: ['gov', ''], bazar: ['basket', 't-sun'], edu: ['cap', ''], spot: ['wave', 't-ok'], pharmacy: ['pill', 't-ok'],
  fuel: ['fuel', 't-sun'], atm: ['bank', ''], workshop: ['wrench', 't-sun'], shelter: ['shelter', 't-sos'], shop: ['store', 't-sun'], ghat: ['bus', ''], police: ['shield', ''], other: ['wrench', ''], post: ['mail', ''], stay: ['bed', 't-sun'], worship: ['dome', ''] };
const sq = (c, size = '') => `<span class="sq ${CI[c] ? CI[c][1] : ''}">${icon(CI[c] ? CI[c][0] : 'pin', size)}</span>`;

/* ---------- rendering ---------- */
let tab = 'today', cat = 'health', svc = null, situ = null;
const TABS = [
  { id: 'today', n: 'আজ', ic: 'home' }, { id: 'near', n: 'কাছে', ic: 'pin' }, { id: 'call', n: 'ডাকুন', ic: 'car' }, { id: 'issues', n: 'সমস্যা', ic: 'flag' },
  { id: 'services', n: 'সেবা', ic: 'gov' }, { id: 'sos', n: 'বিপদে', ic: 'alert' },
];
const ext = 'target="_blank" rel="noopener noreferrer"';
const callBtn = (p, solid = true) => p ? `<a class="btn ${solid ? 'solid' : ''}" href="tel:${esc(p)}">${icon('phone', 'sm')}<span class="num">${bn(p)}</span></a>` : '';
const srcLink = (s) => s ? `<a class="btn ghost" href="${esc(s)}" ${ext}>উৎস ${icon('ext', 'sm')}</a>` : '';
const srcTag = (p) => p.official ? `<span class="badge off">সরকারি তালিকা</span>${p.badge ? `<span class="badge sample">${esc(p.badge)}</span>` : ''}` : p.osm ? '<span class="badge osm">OpenStreetMap, যাচাই করা হয়নি</span>' : p.off ? '<span class="badge off">সরকারি উৎস</span>' : '';

let lastItems = [];
function placeRow(p, i) {
  return `<div class="r">${sq(p.cat)}
    <div><div class="t">${esc(p.name)}${srcTag(p)}</div><div class="m">${esc(p.sub || '')}</div></div>
    <div class="dist">${p.noLoc ? '<small>অবস্থান জানা নেই</small>' : p.approx ? `${p.km < 1.5 ? 'এই উপজেলায়' : '~' + distTxt(p.km)}<small>আনুমানিক অবস্থান</small>` : `${distTxt(p.km)}<small>${walkTxt(p.km)}</small>`}</div>
    <div class="acts">${callBtn(p.phone)}<a class="btn" href="${esc(dirLink(p))}" ${ext}>${icon('nav', 'sm')}${p.noLoc ? 'Google Maps-এ খুঁজুন' : 'পথ দেখান'}</a>
      <button class="btn" type="button" data-share="${esc(p.name + (p.phone ? ' ' + p.phone : ''))}">${icon('share', 'sm')}শেয়ার</button>${srcLink(p.src)}
      ${p.noLoc || i === undefined ? '' : `<button class="btn ghost" type="button" data-dest="${i}">${cat === 'spot' ? 'গন্তব্য দেখুন' : 'বিস্তারিত'} ${icon('chev', 'sm')}</button>`}</div></div>`;
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
  const NEEDS = ['health', 'pharmacy', 'fuel', 'shop', 'bazar', 'atm', 'workshop', 'ghat', 'police', 'post', 'stay', 'spot'];
  return `<section class="card hero"><p class="small">${hi} · ${esc(here.label)}</p><h1>আজ আপনার এলাকায়</h1>
      <div class="bento">
        <div class="cell"><span>${icon('sunrise', 'sm')}সূর্যোদয়</span><b>${s.rise}</b></div>
        <div class="cell"><span>${icon('sunset', 'sm')}সূর্যাস্ত</span><b>${s.set}</b></div>
        <div class="cell"><span>${icon('cloud', 'sm')}আবহাওয়া</span><b>৩০°</b><span>নমুনা</span></div>
        <div class="cell"><span>${icon('flag', 'sm')}ঘূর্ণিঝড় সংকেত</span><b>—</b><span>শীঘ্রই আসছে</span></div>
      </div>
      <p class="small">সূর্যোদয়-সূর্যাস্ত ফোনেই হিসাব হয়, ইন্টারনেট লাগে না। আবহাওয়া আর সংকেত আসবে আবহাওয়া অধিদপ্তর থেকে (পর্ব ৩)।</p></section>
    <section class="card"><div class="sec-head"><h2>${esc(here.dBn)} জেলা</h2><button class="link" type="button" data-open-area>জেলা বদলান${icon('chev', 'sm')}</button></div>
      <p class="muted">৬৪ জেলার যেকোনোটা বেছে নিন: সেখানকার দরকারি জায়গা, দর্শনীয় স্থান আর সাহায্যের নম্বর দেখাবে।</p>
      <div class="pills"><button class="pill" type="button" data-cat="spot">${icon('wave', 'sm')}এই জেলার দর্শনীয় স্থান</button><button class="pill" type="button" data-tab-go="help">${icon('hands', 'sm')}সাহায্য ও হেল্পলাইন</button></div></section>
    <section class="card"><div class="sec-head"><h2>কী দরকার?</h2><button class="link" type="button" data-tab-go="near">সব বিভাগ${icon('chev', 'sm')}</button></div>
      <div class="needs">${NEEDS.map((id) => { const k = CATS.find((x) => x.id === id); return `<button class="need" type="button" data-cat="${id}">${sq(id)}${k.n}</button>`; }).join('')}</div></section>
    <section class="card"><div class="sec-head"><h2>সরকারি সেবা সহজে</h2><button class="link" type="button" data-tab-go="services">সব সেবা${icon('chev', 'sm')}</button></div>
      <div class="pills">${SERVICES.slice(0, 5).map((x) => `<button class="pill" type="button" data-svc="${x.id}">${esc(x.n)}</button>`).join('')}</div></section>
    <section class="card"><div class="sec-head"><h2>এলাকার সমস্যা</h2><button class="link" type="button" data-tab-go="issues">সব দেখুন${icon('chev', 'sm')}</button></div>
      <p class="muted">রাস্তা ভাঙা, জলাবদ্ধতা, নষ্ট সড়কবাতি? জানান। স্বেচ্ছাসেবক যাচাই করে অফিসকে জানাবেন, আর সমাধান পর্যন্ত সবাই অবস্থা দেখবেন।</p>
      <div class="pills"><button class="btn solid" type="button" data-issue-new>${icon('flag', 'sm')}সমস্যা জানান</button><button class="btn" type="button" data-tab-go="issues">"আমিও" দিন</button></div></section>
    <section class="card"><h2>নিরাপদে পৌঁছানো</h2><p class="muted">রওনা দিন, কতক্ষণ লাগবে বলুন। পরিবার একটা লিংক পাবে: সময় পার হলেও "পৌঁছেছি" না এলে তাদের ফোনে লাল সতর্কতা দেখাবে।</p>
      <div class="pills"><button class="btn solid" type="button" data-trip="start">${icon('bus', 'sm')}রওনা দিলাম</button><button class="btn" type="button" data-trip="arrived">${icon('check', 'sm')}পৌঁছেছি</button></div></section>
    <section class="card"><div class="sec-head"><h2>এলাকার জরুরি নম্বর</h2><button class="link" type="button" data-tab-go="sos">সব নম্বর${icon('chev', 'sm')}</button></div>
      ${contactRows([{ label: `${here.upBn} থানা`, c: c.police, ic: 'shield' }, { label: 'উপজেলা স্বাস্থ্য কমপ্লেক্স', c: c.health, ic: 'health' }])}</section>`;
}

let mapOn = false;
function viewNear() {
  if (!here) return needHere();
  const k = CATS.find((x) => x.id === cat), osmCat = !!OSMCAT[cat], loading = osmCat && !here.places;
  const items = loading ? [] : nearby(cat).map((p) => ({ ...p, cat }));
  const pilotOnly = cat === 'union' && !here.union;
  const gq = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${GQ[cat] || k.n} ${here.upBn} ${here.dBn}`)}`;
  const empty = `<div class="note">${icon('info')}<p>${pilotOnly ? 'এই তথ্য এখন শুধু নোয়াখালী আর কক্সবাজারের জন্য আছে; বাকি জেলায় আসছে।'
    : cat === 'shelter' && !items.length ? 'এই এলাকার আশ্রয়কেন্দ্রের তালিকা এখনো নেই; সরকারি তালিকা (দুর্যোগ ব্যবস্থাপনা অধিদপ্তর) আসছে। দুর্যোগের আগাম বার্তা: ১০৯০।'
    : `${esc(here.upBn)}-এর কাছে এখনো কোনো ${esc(k.n)} আমাদের তালিকায় নেই। OpenStreetMap-এ এই এলাকার তথ্য কম; সরকারি তালিকা আর স্বেচ্ছাসেবকদের তথ্য যোগ হচ্ছে।`}</p></div>`;
  return `<section class="card"><p class="eyebrow">আমার কাছে · ${esc(here.dBn)}</p><h1>${esc(k.n)}</h1><p class="muted">${esc(here.label)} থেকে দূরত্ব, কাছেরটা আগে। দূরত্ব ফোনেই হিসাব হয়, লোকেশন কোথাও যায় না।</p>
      <div class="scroller" role="group" aria-label="বিভাগ">${CATS.map((x) => `<button class="pill" type="button" data-cat="${x.id}" aria-pressed="${x.id === cat}">${icon(CI[x.id][0], 'sm')}${x.n}</button>`).join('')}</div>
      <div class="pills"><button class="btn ${mapOn ? 'solid' : ''}" type="button" data-map>${icon('pin', 'sm')}${mapOn ? 'ম্যাপ লুকান' : 'ম্যাপে দেখুন'}</button>
      <a class="btn ghost" href="${esc(gq)}" ${ext}>Google Maps-এ আরও দেখুন ${icon('ext', 'sm')}</a></div></section>
    ${mapOn ? `<section class="card"><div class="mapwrap"><div id="map" role="region" aria-label="ম্যাপ"></div></div><p class="small">ম্যাপ দেখতে ইন্টারনেট লাগে; ম্যাপের ছবি OpenStreetMap থেকে আসে। নিচের তালিকা নেট ছাড়াও চলে।</p></section>` : ''}
    <section class="card">${loading ? '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>'
      : items.length ? `<div class="rows">${(lastItems = items).map((p, i) => placeRow(p, i)).join('')}</div>` : empty}
      ${['bazar', 'edu', 'spot'].includes(cat) && items.some((p) => p.approx) ? '<p class="small">"আনুমানিক": জায়গাটার নিজের অবস্থান এখনো নেই, তাই তার ইউনিয়ন বা উপজেলার কেন্দ্র থেকে দূরত্ব দেখানো হচ্ছে।</p>' : ''}
      ${items.some((p) => p.official) ? '<p class="small">ফিলিং স্টেশন: পদ্মা অয়েল (২০১৯) আর মেঘনা পেট্রোলিয়ামের (২০২৫) সরকারি ডিলার তালিকা। তালিকায় অবস্থান নেই, তাই উপজেলার কেন্দ্র থেকে আনুমানিক দূরত্ব; উপজেলা জানা না থাকলে "অবস্থান জানা নেই"। যমুনা অয়েলের তালিকা এখনো যোগ হয়নি।</p>' : ''}
      ${items.some((p) => p.osm) ? '<p class="small">জায়গা © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL), ১৩ নভেম্বর ২০২৬-এর তথ্য। ফোন নম্বর রাখা হয়নি, কারণ সেগুলো সরকারি উৎসের না।</p>' : ''}</section>`;
}

const HELPGROUPS = [
  ['এখনই বিপদ', ['emergency', 'fire', 'police']], ['নারী ও শিশু', ['women_children']], ['স্বাস্থ্য', ['health']],
  ['দুর্যোগ, নদী ও সাগর', ['disaster', 'coast_river']], ['পর্যটক', ['tourist_police']], ['আইনি সহায়তা', ['legal']],
  ['তথ্য ও সরকারি সেবা', ['information', 'anti_corruption']],
];
function viewHelp() {
  const row = (r) => `<div class="r"><span class="sq ${['emergency', 'fire'].includes(r.c) ? 't-sos' : ''}">${icon(r.c === 'health' ? 'health' : r.c === 'fire' ? 'alert' : 'phone')}</span>
    <div><div class="t">${esc(r.n)}<span class="badge off">সরকারি উৎস</span></div></div><span></span><div class="acts">${callBtn(r.p, ['emergency'].includes(r.c))}${srcLink(r.s)}</div></div>`;
  return `<section class="card"><p class="eyebrow">সাহায্য</p><h1>সাহায্য ও হেল্পলাইন</h1><p class="muted">সব নম্বর সরকারি পাতা থেকে, প্রতিটার পাশে উৎস। বেশিরভাগ বিনা খরচে, ২৪ ঘণ্টা।</p></section>
    ${HELPGROUPS.map(([g, cs]) => { const rs = D.national.filter((r) => cs.includes(r.c)); return rs.length ? `<section class="card"><h2>${esc(g)}</h2><div class="rows">${rs.map(row).join('')}</div></section>` : ''; }).join('')}
    ${here ? `<section class="card"><h2>${esc(here.upBn)}-এর সরকারি নম্বর</h2>${contactRows(localContacts())}</section>` : ''}
    <section class="card"><h2>কাছের সাহায্যের জায়গা</h2><div class="pills">${['health', 'pharmacy', 'police', 'shelter'].map((k) => `<button class="pill" type="button" data-cat="${k}">${icon(CI[k][0], 'sm')}${CATS.find((x) => x.id === k).n}</button>`).join('')}</div></section>`;
}

// ---- Destination page: one place (a tourist spot, or any place) with what is around it ----
let dest = null;
const AROUND = [['stay', 'থাকা ও খাওয়া'], ['health', 'হাসপাতাল ও ক্লিনিক'], ['pharmacy', 'ফার্মেসি'], ['atm', 'ব্যাংক/ATM'], ['fuel', 'ফিলিং স্টেশন'], ['police', 'থানা'], ['ghat', 'যাতায়াত']];
function aroundDest(d, k, km = 5) {
  if (!here.places || !OSMCAT[k]) return [];
  return here.places.filter((p) => OSMCAT[k](p) && p.lat != null && p.source !== 'official').map((p) => ({ name: placeName(p), sub: SUBBN[p.subcategory] || '', lat: p.lat, lon: p.lon, src: p.source_url, osm: true, cat: k, km: hav(d, p) }))
    .filter((p) => p.km <= km && p.km > 0.01).sort((a, b) => a.km - b.km).slice(0, 3);
}
function viewDest() {
  if (!dest) { tab = 'near'; return viewNear(); }
  const d = dest, groups = AROUND.map(([k, n]) => [k, n, aroundDest(d, k)]).filter((g) => g[2].length);
  const trip = `রওনা দিলাম ${d.name}-এর দিকে (${here.dBn})। পৌঁছে জানাব।`;
  return `<button class="link" type="button" data-tab-go="near">${icon('back', 'sm')}তালিকায় ফিরুন</button>
    <section class="card"><p class="eyebrow">${d.cat === 'spot' ? 'গন্তব্য' : 'জায়গা'} · ${esc(here.dBn)}</p><h1>${esc(d.name)}</h1>
      <p class="muted">${esc(d.sub || '')}</p><div>${srcTag(d)}</div>
      <p><b>${d.approx ? '~' : ''}${distTxt(d.km)}</b> <span class="muted">${esc(here.label)} থেকে${d.approx ? ' (আনুমানিক)' : ''}</span></p>
      <div class="pills"><a class="btn solid" href="${esc(dirLink(d))}" ${ext}>${icon('nav', 'sm')}পথ দেখান</a>
        <button class="btn" type="button" data-share="${esc(d.name + ', ' + here.dBn)}">${icon('share', 'sm')}শেয়ার</button>
        <button class="btn" type="button" data-trip-dest="${esc(trip)}">${icon('bus', 'sm')}এখানে যাচ্ছি (পরিবারকে SMS)</button>${srcLink(d.src)}</div></section>
    ${d.pid ? `<section class="card"><h2>এখন কেমন?</h2><p class="muted" id="pstText">মানুষের জানানো খবর দেখা হচ্ছে…</p>
      <div class="pills">${(d.cat === 'fuel' ? ['fuel_yes', 'fuel_no', 'open_night'] : ['open', 'closed', 'open_night']).map((v) => `<button class="pill" type="button" data-pst="${v}">${esc(PV[v])}</button>`).join('')}</div>
      <p class="small" id="pstMsg">আপনি এখানে থাকলে জানান: অন্যরা কাজে লাগাবে। সাইন ইন লাগে; আপনার নাম কেউ দেখবে না।</p></section>` : ''}
    <section class="card"><div class="mapwrap"><div id="map" role="region" aria-label="গন্তব্যের ম্যাপ"></div></div><p class="small">ম্যাপ দেখতে ইন্টারনেট লাগে; ম্যাপের ছবি OpenStreetMap থেকে আসে।</p></section>
    <section class="card"><h2>এর কাছে (৫ কিমির মধ্যে)</h2>
      ${groups.length ? groups.map(([k, n, xs]) => `<h3>${esc(n)}</h3><div class="rows">${xs.map((p) => `<div class="r">${sq(k)}<div><div class="t">${esc(p.name)}</div><div class="m">${esc(p.sub)}</div></div><div class="dist">${distTxt(p.km)}<small>গন্তব্য থেকে</small></div>
        <div class="acts"><a class="btn" href="${esc(dirLink(p))}" ${ext}>${icon('nav', 'sm')}পথ দেখান</a></div></div>`).join('')}</div>`).join('')
        : `<div class="note">${icon('info')}<p>এর কাছে থাকা-খাওয়া, হাসপাতাল বা ATM-এর তথ্য এখনো আমাদের তালিকায় নেই।</p></div>`}
      <p class="small">জায়গা © OpenStreetMap contributors (ODbL), যাচাই করা হয়নি। বিপদে ৯৯৯; পর্যটক হলে ট্যুরিস্ট পুলিশ ০১৩২০২২২২২২।</p></section>`;
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
        <h3>কী লাগবে <span class="small">(যা আছে টিক দিন)</span></h3><div class="checks">${s.docs.map((d, i) => `<label class="check"><input type="checkbox" id="ck${i}"> ${esc(d)}</label>`).join('')}</div>
        ${s.link ? `<a class="btn solid" href="${esc(s.link)}" ${ext}>${icon('globe', 'sm')}অনলাইনে আবেদন: ${esc(s.link.replace('https://', ''))}</a>` : '<p class="small">এই সেবার অনলাইন আবেদন নেই, অফিসে গিয়ে করতে হয়।</p>'}
        <div class="note">${icon('info')}<p>সাধারণ তথ্য। ফি আর কাগজের সর্বশেষ তালিকা আবেদনের আগে সরকারি পাতায় বা অফিসে মিলিয়ে নিন। দালালের কাছে যাবেন না।</p></div></section>`;
  }
  return `<section class="card"><div class="sec-head"><h2>কিছু হারিয়েছে?</h2><span class="sq t-sun">${icon('doc')}</span></div>
      <p class="muted">মোবাইল, NID, কার্ড বা কাগজ হারালে থানায় সাধারণ ডায়েরি (জিডি) করতে হয়। কয়েকটা প্রশ্নের উত্তর দিন, আবেদনের খসড়া তৈরি হবে। সব ফোনেই থাকে, কোথাও যায় না।</p>
      <div><button class="btn solid" type="button" data-tab-go="gd">${icon('doc', 'sm')}জিডির খসড়া বানান</button></div></section>
    <section class="card"><p class="eyebrow">সরকারি সেবা সহজে</p><h1>কোথায় যাবেন, কী লাগবে</h1><p class="muted">অনলাইনে হয় কি না, আর আপনার এলাকার অফিসের নম্বর।</p>
      <div>${SERVICES.map((x) => `<button class="hit" type="button" data-svc="${x.id}"><span class="sq">${icon(SVC_IC[x.id])}</span><span><span class="t w600">${esc(x.n)}</span><br><span class="small">${x.where === 'union' ? 'ইউনিয়ন পরিষদ' : 'উপজেলা অফিস'}${x.link ? ' · অনলাইনেও' : ''}</span></span>${icon('chev', 'chev')}</button>`).join('')}</div></section>
    <section class="card"><div class="sec-head"><h2>সাহায্য ও হেল্পলাইন</h2><button class="link" type="button" data-tab-go="help">সব ${bn(D.national.length)}টা${icon('chev', 'sm')}</button></div>
      <p class="muted">নারী ও শিশু, স্বাস্থ্য, আইনি সহায়তা, দুর্যোগ, পর্যটক, পাসপোর্ট, ভূমি, বিদ্যুৎ…</p></section>
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
    <section class="card"><h2>পরিবারকে এক চাপে জানান</h2><p class="muted">ঘূর্ণিঝড়, বন্যা বা যেকোনো বিপদে: SMS যায় আপনার ফোন থেকে, নেট লাগে না।</p>
      <div class="pills"><button class="btn solid" type="button" data-safe="ok">${icon('check', 'sm')}আমি নিরাপদ</button><button class="btn danger" type="button" data-safe="help">${icon('alert', 'sm')}সাহায্য দরকার</button><button class="btn" type="button" data-safe="shelter">${icon('shelter', 'sm')}আশ্রয়কেন্দ্রে যাচ্ছি</button></div></section>
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
const VIEWS = { today: viewToday, near: viewNear, services: viewServices, sos: viewSos, search: viewSearch, help: viewHelp, dest: viewDest };
const navHtml = () => TABS.map((t) => `<button class="navbtn ${t.id === 'sos' ? 'sos' : ''}" type="button" data-tab="${t.id}" aria-current="${t.id === tab || (t.id === 'near' && tab === 'dest') || (t.id === 'services' && (tab === 'help' || tab === 'gd')) || (t.id === 'today' && (tab === 'tripset' || tab === 'trip')) || (t.id === 'call' && tab === 'drive') ? 'page' : 'false'}">${icon(t.ic)}<span>${t.n}</span></button>`).join('');
let mapObj = null;
function render() {
  if (mapObj) { mapObj.remove(); mapObj = null; }
  if (rideMap) { rideMap.remove(); rideMap = null; }
  $('#view').innerHTML = VIEWS[tab]();
  if (tab === 'near' && mapOn) drawMap();
  if (tab === 'dest') { drawDestMap(); loadPlaceStatus(); }
  if (tab === 'issues') loadIssues();
  if (tab === 'trip') tickTrip();
  if (tab === 'call') callMount();
  if (tab === 'drive') driveMount();
  for (const b of document.querySelectorAll('[data-tab="search"].hsearch')) b.setAttribute('aria-current', String(tab === 'search'));
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
  if (t.dataset.dest) { dest = lastItems[Number(t.dataset.dest)]; if (dest) { tab = 'dest'; render(); window.scrollTo(0, 0); } return; }
  if (t.dataset.tripDest) { situ = null; tab = 'sos'; render(); $('#sosOut').innerHTML = smsBlock(t.dataset.tripDest); return; }
  if (t.id === 'goUp') { const c = CEN.centres[Number($('#upSel').value)]; if (c) { $('#areaDlg').close(); locate(c.lat, c.lon, `${c.upazila_bn}, ${DISTBN[c.district]}`); } return; }
  if ('openArea' in t.dataset) return $('#areaDlg').showModal();
  if (t.dataset.trip) {
    if (!here) return $('#areaDlg').showModal();
    if (t.dataset.trip === 'start') { tab = 'tripset'; render(); window.scrollTo(0, 0); return; }
    situ = null; tab = 'sos'; render(); $('#sosOut').innerHTML = smsBlock('নিরাপদে পৌঁছেছি। চিন্তা কোরো না।'); return;
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
$('#areaDlg').addEventListener('click', (e) => { if (e.target.id === 'areaDlg') e.target.close(); });

function drawDestMap() {
  const el = $('#map'); if (!el || !window.L || !dest) return;
  if (!navigator.onLine) { el.textContent = 'ইন্টারনেট নেই, তাই ম্যাপ দেখানো যাচ্ছে না।'; return; }
  mapObj = L.map(el).setView([dest.lat, dest.lon], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(mapObj);
  const css = getComputedStyle(document.documentElement), brand = css.getPropertyValue('--brand').trim() || '#0b4a4e', sun = css.getPropertyValue('--sun').trim() || '#b86e0a';
  const pts = [[dest.lat, dest.lon]];
  for (const [k] of AROUND) for (const p of aroundDest(dest, k)) {
    const b = document.createElement('b'); b.textContent = p.name;
    L.circleMarker([p.lat, p.lon], { radius: 6, color: brand, weight: 2, fillColor: brand, fillOpacity: 0.35 }).addTo(mapObj).bindPopup(b); pts.push([p.lat, p.lon]);
  }
  const t = document.createElement('b'); t.textContent = dest.name;
  L.circleMarker([dest.lat, dest.lon], { radius: 10, color: '#ffffff', weight: 3, fillColor: sun, fillOpacity: 1 }).addTo(mapObj).bindPopup(t).openPopup();
  if (pts.length > 1) mapObj.fitBounds(pts, { padding: [28, 28], maxZoom: 15 });
}

/* ===================== v4: features that help people act (impact plan) ===================== */
// Firebase loads only after a tap that needs it (the site's own js/firebase.js and js/community.js); help, lists,
// the GD draft, trips and the SMS buttons never wait for it and work with no internet.
let fbP = null;
const FB = () => (fbP ||= Promise.all([import('../js/firebase.js'), import('../js/community.js')]));
const PV = { open: 'এখন খোলা', closed: 'এখন বন্ধ', fuel_yes: 'তেল আছে', fuel_no: 'তেল নেই', open_night: 'রাতেও খোলা' };
const FBERR = { 'permission-denied': 'নিরাপত্তা নিয়মে কাজটা আটকেছে। পাতাটা রিলোড দিয়ে আবার চেষ্টা করুন; না হলে অ্যাডমিনকে জানান।',
  'limit-wait': '১ মিনিট পর আবার চেষ্টা করুন।', 'limit-day': 'আজ ১০টা জানানো হয়ে গেছে, কাল আবার।', already: 'আপনি আগেই "আমিও" দিয়েছেন। ধন্যবাদ!',
  unverified: 'আগে ইমেইল যাচাই করুন (Google দিয়ে সাইন ইন করলে লাগে না)।', unavailable: 'ইন্টারনেট লাগবে। নেট এলে আবার চেষ্টা করুন।' };
const errText = (e) => FBERR[e && e.code] || (navigator.onLine ? 'কাজটা হয়নি। একটু পর আবার চেষ্টা করুন।' : FBERR.unavailable);
const agoBn = (ms) => { const m = Math.max(1, Math.round((Date.now() - ms) / 60000)); return m < 60 ? `${bn(m)} মিনিট আগে` : m < 1440 ? `${bn(Math.round(m / 60))} ঘণ্টা আগে` : `${bn(Math.round(m / 1440))} দিন আগে`; };
// The signed-in person with a verified email, or null after showing a sign-in button in `box`.
const WHY = {
  report: 'এটা জানাতে সাইন ইন লাগে, যাতে কেউ ভুয়া খবর না দিতে পারে। আপনার নাম বা ইমেইল কেউ দেখবে না।',
  call: 'ডাকতে সাইন ইন লাগে, যাতে যিনি আসবেন তিনি জানেন ডাকটা আসল। যিনি নেবেন তিনি আপনার নাম বা ইমেইল দেখবেন না; দেখবেন কোথা থেকে কোথায় যাবেন, আর ডাক নেওয়ার পর থেকে যাত্রা শেষ পর্যন্ত আপনার লাইভ অবস্থান।',
  history: 'আপনার আগের ডাক দেখতে সাইন ইন লাগে।',
  drive: 'সেবা দিতে (চালক, কারিগর, স্বেচ্ছাসেবক) বা অ্যাডমিনের কাজে সাইন ইন লাগে।',
};
// Why a Google sign-in did not happen, said plainly next to the button (a toast alone is gone in 2 seconds).
const INAPP = /FBAN|FBAV|FB_IAB|Instagram|Messenger|WhatsApp|Line\/|; wv\)/i.test(navigator.userAgent);
const SIGNIN_ERR = {
  'auth/popup-blocked': 'ব্রাউজার পপআপ আটকে দিয়েছে। ঠিকানার ঘরের পাশে "পপআপ আটকানো" চিহ্নে চাপ দিয়ে এই সাইটের পপআপ চালু করুন, তারপর আবার চাপুন।',
  'auth/popup-closed-by-user': 'সাইন ইনের জানালা বন্ধ হয়ে গেছে। আবার চাপুন, তারপর Google অ্যাকাউন্ট বাছুন।',
  'auth/cancelled-popup-request': 'আগের সাইন ইন জানালা এখনো খোলা। সেটা শেষ করুন বা বন্ধ করে আবার চাপুন।',
  'auth/unauthorized-domain': 'এই ঠিকানা থেকে সাইন ইনের অনুমতি Firebase-এ দেওয়া নেই। অ্যাডমিনকে জানান।',
  'auth/operation-not-supported-in-this-environment': 'এই ব্রাউজারে Google সাইন ইন চলে না। Chrome বা Firefox-এ পাতাটা খুলুন।',
  'auth/web-storage-unsupported': 'ব্রাউজারের কুকি বা স্টোরেজ বন্ধ। সেটিংসে চালু করুন, অথবা Chrome-এ খুলুন।',
  'auth/network-request-failed': 'ইন্টারনেট সংযোগ নেই বা দুর্বল। নেট ঠিক হলে আবার চাপুন।',
};
function signinFailed(btn, e) {
  const code = (e && e.code) || '';
  const why = INAPP ? 'Messenger, Facebook বা WhatsApp-এর ভেতরের ব্রাউজারে Google সাইন ইন চলে না। উপরের ⋮ মেনু থেকে "Chrome-এ খুলুন" বাছুন, তারপর আবার চাপুন।'
    : SIGNIN_ERR[code] || `সাইন ইন হয়নি${code ? ` (${code})` : ''}। আবার চেষ্টা করুন; না হলে Chrome-এ খুলুন।`;
  toast(why);
  const box = btn.closest('div') || btn.parentElement;
  let p = box.nextElementSibling && box.nextElementSibling.classList.contains('signin-why') ? box.nextElementSibling : null;
  if (!p) { p = document.createElement('p'); p.className = 'small signin-why'; p.setAttribute('role', 'status'); box.after(p); }
  p.textContent = why;
}
async function needUser(box, why = WHY.report) {
  const [fb] = await FB();
  const u = await fb.currentUser();
  if (!u) {
    box.innerHTML = `<div class="note">${icon('info')}<p>${esc(why)}</p></div>
      <div><button class="btn solid" type="button" data-signin>Google দিয়ে সাইন ইন</button></div>`;
    return null;
  }
  if (!(await fb.isVerified())) throw { code: 'unverified' };
  return u;
}

/* ---- "এখন কেমন?" on a place's page ---- */
async function loadPlaceStatus() {
  const el = $('#pstText'); if (!el || !dest || !dest.pid) return;
  if (!navigator.onLine) { el.textContent = 'ইন্টারনেট নেই, তাই মানুষের জানানো খবর দেখা যাচ্ছে না।'; return; }
  try {
    const [fb, cm] = await FB(); const st = await fb.readPlaceStatus(dest.pid);
    if (!$('#pstText')) return;
    $('#pstText').textContent = cm.placeStatusText(st, Date.now(), bn) || 'গত ৬ ঘণ্টায় কেউ জানায়নি। আপনি জানালে অন্যরা উপকৃত হবেন।';
    dest.st = st;
  } catch (e) { if ($('#pstText')) $('#pstText').textContent = 'খবর দেখা যায়নি: ' + errText(e); }
}
const placeSent = new Map();   // this visit only: person|place -> when they last answered (the rules allow one per 30 min)
async function sendPlace(value) {
  const box = $('#pstMsg');
  box.textContent = 'পাঠানো হচ্ছে…';
  try {
    const u = await needUser(box); if (!u) return;
    const key = `${u.uid}|${dest.pid}`;
    if (Date.now() - (placeSent.get(key) || 0) < 30 * 60000) { box.textContent = 'আপনি এইমাত্র জানিয়েছেন। ৩০ মিনিট পর আবার জানাতে পারবেন।'; return; }
    const [fb, cm] = await FB();
    const old = dest.st || await fb.readPlaceStatus(dest.pid);
    await fb.sendPlaceStatus(dest.pid, value, cm.nextPlaceStatus(old, value, Date.now()));
    placeSent.set(key, Date.now()); box.textContent = 'ধন্যবাদ! আপনার খবর যোগ হয়েছে।'; await loadPlaceStatus();
  } catch (e) { box.textContent = e && e.code === 'permission-denied' ? 'জানানো যায়নি: গত ৩০ মিনিটে এই জায়গার খবর দিয়ে থাকলে একটু পরে আবার চেষ্টা করুন।' : errText(e); }
}

/* ---- "সমস্যা জানান, সমাধান দেখুন" ---- */
let issuesState = { key: '', list: null, err: '', form: false };
const STEPS = ['open', 'verified', 'sent', 'working', 'solved'];
const STEPBN = { open: 'জানানো', verified: 'যাচাই', sent: 'অফিসে', working: 'কাজ চলছে', solved: 'সমাধান' };
function stepper(st) {
  if (st === 'closed') return '<span class="badge sample">বন্ধ (কারণ লেখা আছে)</span>';
  const k = STEPS.indexOf(st);
  return `<ol class="stepper" aria-label="অবস্থা">${STEPS.map((x, i) => `<li class="${i < k ? 'done' : i === k ? 'now' : ''}">${STEPBN[x]}</li>`).join('')}</ol>`;
}
function viewIssues() {
  if (!here) return needHere();
  const st = issuesState;
  const cats = ISSUE_CATS.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
  const form = st.form ? `<section class="card" id="issueForm"><h2>নতুন সমস্যা জানান</h2>
      <p class="muted">${esc(here.upBn)}, ${esc(here.dBn)} · নাম, ফোন নম্বর বা বাড়ির ঠিকানা লিখবেন না: সবার জন্য খোলা পাতায় দেখাবে।</p>
      <label for="isCat">কী সমস্যা</label><select id="isCat">${cats}</select>
      <label for="isUnion">ইউনিয়ন বা ওয়ার্ড (জানা থাকলে)</label><input type="search" id="isUnion" maxlength="80" placeholder="নিশ্চিত না হলে খালি রাখুন">
      <label for="isLand">কাছের চেনা জায়গা</label><input type="search" id="isLand" placeholder="যেমন: কাশেম বাজারের মোড়, প্রাইমারি স্কুলের সামনে" maxlength="80">
      <label for="isText">কী হয়েছে, কবে থেকে</label><textarea id="isText" rows="3" maxlength="300" placeholder="যেমন: দুই সপ্তাহ ধরে রাস্তায় হাঁটুপানি, স্কুলের বাচ্চারা যেতে পারছে না।"></textarea>
      <div class="pills"><button class="btn solid" type="button" data-issue-send>জমা দিন</button><button class="btn ghost" type="button" data-issue-cancel>বাদ দিন</button></div>
      <div id="issueMsg" class="small" role="status"></div></section>` : '';
  const list = st.err ? `<div class="note">${icon('info')}<p>${esc(st.err)}</p></div><div><button class="btn" type="button" data-issue-reload>আবার চেষ্টা</button></div>`
    : !st.list ? '<div class="skeleton"></div><div class="skeleton"></div>'
    : !st.list.length ? `<p class="muted">${esc(here.upBn)}-এ এখনো কোনো সমস্যা জানানো হয়নি। প্রথম জন হোন।</p>`
    : `<div class="rows">${st.list.map((x) => `<div class="r issue"><span class="sq ${x.status === 'solved' ? 't-ok' : 't-sun'}">${icon('flag')}</span>
        <div><div class="t">${esc(ISSUE_BN[x.category] || x.category)} · ${esc(x.landmark)}</div><div class="m">${esc(x.union ? x.union + ' · ' : '')}${x.createdAt ? agoBn(x.createdAt) : ''}</div>
        <p class="issue-text">${esc(x.text)}</p>${stepper(x.status)}${x.statusNote ? `<p class="small">${icon('info', 'sm')} ${esc(x.statusNote)}</p>` : ''}</div><span></span>
        <div class="acts"><button class="btn" type="button" data-metoo="${esc(x.id)}">${icon('hands', 'sm')}আমিও (${bn(x.metoo || 0)})</button>
        <button class="btn ghost" type="button" data-share="${esc(`${ISSUE_BN[x.category] || ''}: ${x.landmark}, ${here.upBn} — SafeConnect-এ "আমিও" দিন`)}">${icon('share', 'sm')}শেয়ার</button></div></div>`).join('')}</div>`;
  return `<section class="card"><p class="eyebrow">সমস্যা জানান, সমাধান দেখুন</p><h1>${esc(here.upBn)}-এর সমস্যা</h1>
      <p class="muted">জানানো → স্বেচ্ছাসেবকের যাচাই → অফিসে → কাজ চলছে → সমাধান। প্রতিটা ধাপ সবাই দেখে। একই সমস্যা আগে থাকলে নতুন না লিখে "আমিও" দিন।</p>
      ${st.form ? '' : `<div class="pills"><button class="btn solid" type="button" data-issue-new>${icon('flag', 'sm')}নতুন সমস্যা জানান</button><button class="link" type="button" data-open-area>উপজেলা বদলান${icon('chev', 'sm')}</button></div>`}</section>
    ${form}<section class="card"><h2>জানানো সমস্যা</h2>${list}<p class="small" id="issueRowMsg" role="status"></p></section>`;
}
const ISSUE_CATS = [['road', 'রাস্তা ভাঙা'], ['water', 'খাবার পানি'], ['drain', 'জলাবদ্ধতা বা ড্রেন'], ['light', 'সড়কবাতি নষ্ট'], ['garbage', 'ময়লা'],
  ['power', 'বিদ্যুৎ'], ['health', 'স্বাস্থ্যসেবা'], ['safety', 'নিরাপত্তা'], ['place', 'জায়গার তথ্য ভুল বা বন্ধ'], ['other', 'অন্য সমস্যা']];
const ISSUE_BN = Object.fromEntries(ISSUE_CATS);
const issueKey = () => `${here.d}|${here.up}`;
async function loadIssues(force) {
  if (!here) return;
  if (!force && issuesState.key === issueKey() && (issuesState.list || issuesState.err || issuesState.loading)) return;
  issuesState = { ...issuesState, key: issueKey(), list: null, err: '', loading: true };
  if (!navigator.onLine) { issuesState.err = 'ইন্টারনেট নেই। জানানো সমস্যার তালিকা দেখতে নেট লাগে।'; if (tab === 'issues') render(); return; }
  try { const [fb, cm] = await FB(); issuesState.list = await fb.listIssues(cm.districtKey(here.d), here.up); }
  catch (e) { issuesState.err = 'তালিকা আনা যায়নি: ' + errText(e); }
  issuesState.loading = false;
  if (tab === 'issues') render();
}
async function sendIssueNow() {
  const msg = $('#issueMsg'), [fb, cm] = await FB();
  const d = { category: $('#isCat').value, district: here.d, upazila: here.up, union: $('#isUnion').value, landmark: $('#isLand').value, text: $('#isText').value };
  const ok = cm.checkIssue(d); if (!ok.ok) { msg.textContent = ok.error; return; }
  msg.textContent = 'পাঠানো হচ্ছে…';
  try {
    if (!(await needUser(msg))) return;
    await fb.sendIssue(cm.issueFields(d));
    issuesState.form = false; toast('ধন্যবাদ! সমস্যাটা জানানো হয়েছে।'); await loadIssues(true);
  } catch (e) { msg.textContent = errText(e); }
}
async function meTooNow(id) {
  const msg = $('#issueRowMsg'); msg.textContent = '';
  try {
    if (!(await needUser(msg))) return;
    const [fb] = await FB(); await fb.meToo(id); toast('"আমিও" যোগ হয়েছে।'); await loadIssues(true);
  } catch (e) { msg.textContent = errText(e); }
}

/* ---- নিরাপদে পৌঁছানো: a link the family opens; red when the time is over (no server) ---- */
let trip = null;
function viewTripSet() {
  const opts = [[15, '১৫ মিনিট'], [30, '৩০ মিনিট'], [60, '১ ঘণ্টা'], [120, '২ ঘণ্টা'], [240, '৪ ঘণ্টা']];
  return `<button class="link" type="button" data-tab-go="today">${icon('back', 'sm')}ফিরুন</button>
    <section class="card"><p class="eyebrow">নিরাপদে পৌঁছানো</p><h1>কতক্ষণ লাগবে?</h1>
      <p class="muted">পরিবার একটা SMS পাবে, তাতে একটা লিংক থাকবে। লিংকে সময় গোনা হবে। সময় পার হলেও আপনার "পৌঁছেছি" SMS না পেলে লিংকটা লাল হয়ে বলবে: এখনই ফোন করুন।</p>
      <label for="tripTo">কোথায় যাচ্ছেন (চাইলে)</label><input type="search" id="tripTo" maxlength="40" placeholder="যেমন: মাইজদী কলেজ">
      <div class="pills">${opts.map(([m, n]) => `<button class="pill" type="button" data-trip-go="${m}">${n}</button>`).join('')}</div>
      <p class="small">লিংকে থাকে শুধু রওনার সময়, কতক্ষণ লাগবে আর আপনার লেখা জায়গার নাম। আপনার লোকেশন থাকে না।</p>
      <div id="sosOut"></div></section>`;
}
function tripFromHash() {
  const m = location.hash.match(/^#trip=(\d{10}),(\d{1,4}),([^#]{0,1500})$/);
  if (!m) return;
  let label = ''; try { label = decodeURIComponent(m[3] || '').slice(0, 80); } catch { /* a broken link: no label */ }
  trip = { start: Number(m[1]) * 1000, mins: Math.min(Number(m[2]), 1440), label };
  tab = 'trip';
}
function viewTrip() {
  if (!trip) return viewToday();
  const due = trip.start + trip.mins * 60000, left = due - Date.now(), late = left < 0;
  const hhmm = (ms) => { const d = new Date(ms), h = d.getHours(), w = h < 4 ? 'রাত' : h < 6 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
    return `${w} ${bn(h % 12 || 12)}:${bn(String(d.getMinutes()).padStart(2, '0'))}`; };
  return `<section class="card ${late ? 'trip-late' : 'hero'}"><p class="small">নিরাপদে পৌঁছানো · পরিবারের জন্য</p>
      <h1>${late ? 'সময় পার হয়ে গেছে' : 'পথে আছে'}</h1>
      <p>${esc(trip.label || 'রওনা দিয়েছে')}। রওনা ${hhmm(trip.start)}, পৌঁছানোর কথা ${hhmm(due)}।</p>
      <p class="big-count" id="tripCount">${late ? `${bn(Math.round(-left / 60000))} মিনিট দেরি` : `আর ${bn(Math.ceil(left / 60000))} মিনিট`}</p>
      ${late ? '<p>"পৌঁছেছি" SMS না পেয়ে থাকলে এখনই ফোন করুন। ফোনে না পেলে ৯৯৯।</p>' : '<p class="small">পৌঁছে গেলে সে "পৌঁছেছি" SMS পাঠাবে। এই পাতা খোলা রাখলে সময় গোনা চলবে।</p>'}</section>
    ${late ? `<a class="sosbig" href="tel:999"><span class="ring">${icon('phone', 'lg')}</span><span><b>৯৯৯-এ কল করুন</b><span>পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স · বিনা খরচে</span></span></a>` : ''}`;
}
let tripTimer = null;
function tickTrip() { clearInterval(tripTimer); tripTimer = setInterval(() => { if (tab === 'trip') render(); else clearInterval(tripTimer); }, 30000); }

/* ---- জিডির খসড়া (stays on the phone; nothing is stored or sent) ---- */
const LOST = ['মোবাইল ফোন', 'জাতীয় পরিচয়পত্র (NID)', 'পাসপোর্ট', 'ব্যাংক বা এটিএম কার্ড', 'শিক্ষাগত সার্টিফিকেট', 'ড্রাইভিং লাইসেন্স', 'অন্য কিছু'];
function viewGd() {
  const thana = here ? `${here.upBn} থানা` : '';
  return `<button class="link" type="button" data-tab-go="services">${icon('back', 'sm')}সব সেবা</button>
    <section class="card"><p class="eyebrow">কাগজ সহায়ক</p><h1>জিডির খসড়া</h1>
      <p class="muted">তথ্যগুলো শুধু এই ফোনে থাকে, কোথাও পাঠানো বা রাখা হয় না। খসড়া কপি বা প্রিন্ট করে থানায় নিয়ে যান।</p>
      <label for="gdWhat">কী হারিয়েছে</label><select id="gdWhat">${LOST.map((x) => `<option>${x}</option>`).join('')}</select>
      <label for="gdDetail">বিবরণ (চাইলে: রং, মডেল, কার্ড বা NID নম্বরের শেষ ৪ সংখ্যা)</label><input type="search" id="gdDetail" maxlength="120">
      <label for="gdWhere">কোথায় হারিয়েছে</label><input type="search" id="gdWhere" maxlength="80" placeholder="যেমন: চৌমুহনী বাসস্ট্যান্ড">
      <div class="row2"><div><label for="gdDate">কবে</label><input type="date" id="gdDate"></div><div><label for="gdTime">আনুমানিক সময়</label><input type="time" id="gdTime"></div></div>
      <label for="gdThana">কোন থানায় জমা দেবেন</label><input type="search" id="gdThana" value="${esc(thana)}" maxlength="60">
      <label for="gdName">আপনার নাম</label><input type="search" id="gdName" maxlength="60">
      <label for="gdFather">পিতা বা স্বামীর নাম</label><input type="search" id="gdFather" maxlength="60">
      <label for="gdAddr">আপনার ঠিকানা</label><input type="search" id="gdAddr" maxlength="120">
      <div><button class="btn solid" type="button" data-gd-make>${icon('doc', 'sm')}খসড়া তৈরি করুন</button></div>
      <div id="gdOut"></div>
      <div class="note">${icon('info')}<p>থানায় নিজেদের ফরম থাকলে সেটাই মানুন। জিডি করতে কোনো টাকা লাগে না। পরিচয়পত্রের কপি সাথে নিন। মোবাইল হারালে অপারেটরের হেল্পলাইনে ফোন করে সিম বন্ধ করুন।</p></div></section>`;
}
function makeGd() {
  const v = (id) => ($('#' + id).value || '').trim(), blank = '..................';
  const date = v('gdDate') ? new Date(v('gdDate')).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) : blank;
  const time = v('gdTime') ? (() => { const [h, m] = v('gdTime').split(':').map(Number); const w = h < 4 ? 'রাত' : h < 6 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত'; return `${w} ${bn(h % 12 || 12)}:${bn(String(m).padStart(2, '0'))}`; })() : blank;
  const what = v('gdWhat') + (v('gdDetail') ? ` (${v('gdDetail')})` : '');
  const text = `বরাবর,
অফিসার ইনচার্জ
${v('gdThana') || blank}${here ? ', ' + here.dBn : ''}

বিষয়: ${v('gdWhat')} হারানো প্রসঙ্গে সাধারণ ডায়েরি।

জনাব,
বিনীত নিবেদন এই যে, আমি ${v('gdName') || blank}, পিতা/স্বামী: ${v('gdFather') || blank}, ঠিকানা: ${v('gdAddr') || blank}। গত ${date} আনুমানিক ${time} সময়ে ${v('gdWhere') || blank} এলাকায় আমার ${what} হারিয়ে যায়। অনেক খোঁজাখুঁজি করেও পাওয়া যায়নি।

ভবিষ্যতে এটি নিয়ে কোনো সমস্যা হলে আইনগত সহায়তার জন্য বিষয়টি সাধারণ ডায়েরিভুক্ত করার অনুরোধ করছি।

বিনীত,
${v('gdName') || blank}
মোবাইল: ${blank}
তারিখ: ${new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  $('#gdOut').innerHTML = `<pre class="okbox gd-text">${esc(text)}</pre><div class="pills"><button class="btn solid" type="button" data-copy="${esc(text)}">${icon('copy', 'sm')}কপি</button>
    <button class="btn" type="button" data-share="${esc(text)}">${icon('share', 'sm')}শেয়ার</button><button class="btn" type="button" data-print>প্রিন্ট</button></div>
    <p class="small">"মোবাইল" লাইনে নিজের নম্বর হাতে লিখুন। ভুল থাকলে উপরে বদলে আবার "খসড়া তৈরি করুন" চাপুন।</p>`;
}

Object.assign(VIEWS, { issues: viewIssues, tripset: viewTripSet, trip: viewTrip, gd: viewGd });
document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('button, a'); if (!t) return;
  if ('issueNew' in t.dataset) { issuesState.form = true; if (tab !== 'issues') { tab = 'issues'; } render(); $('#issueForm')?.scrollIntoView({ block: 'start' }); return; }
  if ('issueCancel' in t.dataset) { issuesState.form = false; render(); return; }
  if ('issueReload' in t.dataset) { loadIssues(true); return; }
  if ('issueSend' in t.dataset) { sendIssueNow(); return; }
  if (t.dataset.metoo) { meTooNow(t.dataset.metoo); return; }
  if (t.dataset.pst) { sendPlace(t.dataset.pst); return; }
  if ('signin' in t.dataset) { try { const [fb] = await FB(); await fb.signInGoogle(); // ডাকুন pages rebuild themselves (their fields live in callF); elsewhere a half-typed form must stay as it is
      if (tab === 'call' || tab === 'drive') { toast('সাইন ইন হয়েছে।'); render(); } else toast('সাইন ইন হয়েছে। এবার আবার চাপুন।'); } catch (e) { signinFailed(t, e); } return; }
  if ('gdMake' in t.dataset) { makeGd(); return; }
  if ('print' in t.dataset) { window.print(); return; }
  if (t.dataset.tripGo) {
    const mins = Number(t.dataset.tripGo), to = ($('#tripTo').value || '').trim().slice(0, 40);
    const link = `https://jerin101.github.io/safe-connect/demo/#trip=${Math.floor(Date.now() / 1000)},${mins},${encodeURIComponent(to ? `${to}-এর দিকে, ${here ? here.label : ''} থেকে` : (here ? `${here.label} থেকে` : ''))}`;
    const msg = `রওনা দিলাম${to ? ' ' + to + '-এর দিকে' : ''}। ${bn(mins)} মিনিটের মধ্যে পৌঁছানোর কথা। পৌঁছে জানাব। এই লিংকে সময় দেখো: ${link}`;
    $('#sosOut').innerHTML = smsBlock(msg); return;
  }
  if (t.dataset.safe) {
    const where = here ? `${here.label}` : '';
    const sh = here && here.places ? nearby('shelter')[0] : null;
    const msg = { ok: `আমি নিরাপদ আছি। চিন্তা কোরো না। (${where})`,
      help: `আমার সাহায্য দরকার। এলাকা: ${where}। ফোনে না পেলে ৯৯৯-এ জানাও।`,
      shelter: `আমি আশ্রয়কেন্দ্রে যাচ্ছি${sh ? ': ' + sh.name : ''}। এলাকা: ${where}। পৌঁছে জানাব।` }[t.dataset.safe];
    const out = $('#sosOut'); if (out) { out.innerHTML = smsBlock(msg); out.scrollIntoView({ block: 'center' }); }
  }
});


/* ===================== v5: "ডাকুন" — call a vehicle, a technician or a helper; both sides on a live map; the bill ===================== */
// The rider asks (type, pickup, destination) → nearby approved providers of that type in the district see it → one
// accepts → both see each other on the map until the trip ends → the provider ends the trip, the bill is computed from
// the rates (js/ride.js; firestore.rules check the same arithmetic) → cash, "টাকা পেয়েছি", receipt, rating.
// Live positions exist only during accepted → arrived → on_trip, only for those two people, and are deleted at the end.
const RIDE = () => Promise.all([FB(), import('../js/ride.js'), import('../js/reports.js')]);
P.car = '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="16.5" cy="18.5" r="1.5"/><path d="M5 11h14"/>';
const TYPE_IC = { ambulance: 'amb', cng: 'car', bike: 'bike', technician: 'wrench', help: 'hands' };
const TYPE_TINT = { ambulance: 't-sos', cng: '', bike: 't-sun', technician: 't-sun', help: 't-ok' };
const SIM = new URLSearchParams(location.search).has('sim');   // presentation only: positions move along a line, labelled on the page
Object.assign(FBERR, { 'signed-out': 'আগে সাইন ইন করুন।', taken: 'অন্য কেউ আগেই নিয়েছেন।', 'limit-wait': '১ মিনিট পর আবার চেষ্টা করুন।',
  'limit-day': 'আজ ১০ বার ডাকা হয়ে গেছে, কাল আবার।', norates: 'এই সেবার ভাড়া এখনো অ্যাডমিন ঠিক করেননি, তাই এখন ডাকা যাচ্ছে না।' });
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const noRates = () => !rates || !Object.keys(rates).length;   // not read yet, or read before an admin set them
let RM = null, HP = null;        // js/ride.js, hasPhone
let rates = null;                // { type: {base, perKm, perMin, minFare} } from Firestore
let callF = { type: 'cng', pick: null, drop: null, pickLabel: '', dropLabel: '', picking: 'drop', online: null };
let ride = null, rideRole = null, rideUnsub = null, liveUnsub = null, other = null, mine = null;
let rideMap = null, mk = {};
let geoId = null, lastSent = null, track = null, simTimer = null, simPos = null;
let prov;                        // provider entry: undefined = not loaded yet, null = none
let reqs = [], reqUnsub = null, myJobs = null, isAdm = false, pend = null, pvOnline = false;

const tName = (t) => (RM ? RM.typeOf(t).bn : t);
const tWho = (t) => (RM ? RM.typeOf(t).who : 'সেবাদাতা');
const tk = (n) => `${bn(n)} টাকা`;
const kmTxt = (m) => (m < 1000 ? `${bn(Math.round(m / 10) * 10)} মিটার` : `${bn((m / 1000).toFixed(1))} কিমি`);
function stopGeo() { if (geoId != null) navigator.geolocation.clearWatch(geoId); geoId = null; clearInterval(simTimer); simTimer = null; }
function stopRide() { stopGeo(); if (rideUnsub) rideUnsub(); if (liveUnsub) liveUnsub(); rideUnsub = liveUnsub = null; other = mine = null; lastSent = null; track = null; simPos = null; }

/* ---------- the rider's page ---------- */
function viewCall() {
  if (!here) return needHere();
  if (ride && rideRole === 'rider') {
    return `<section class="card"><p class="eyebrow">ডাকুন · ${esc(tName(ride.type))}</p><div id="ridePanel">${riderPanel()}</div></section>
      <div class="mapwrap"><div id="rmap" class="rmap"></div></div>${SIM ? simNote() : ''}`;
  }
  const t = RM ? RM.typeOf(callF.type) : { dest: true, who: 'চালক' };
  const types = (RM ? RM.RIDE_TYPES : []).map((x) => `<button class="tcard" type="button" data-rtype="${x.id}" aria-pressed="${x.id === callF.type}">${`<span class="sq ${TYPE_TINT[x.id]}">${icon(TYPE_IC[x.id])}</span>`}<span>${esc(x.bn.split(' (')[0])}</span></button>`).join('');
  const quick = quickDrops();
  return `<section class="card hero"><p class="small">ডাকুন · ${esc(here.label)}</p><h1>যা দরকার, কাছের মানুষকে ডাকুন</h1>
      <p class="muted">গাড়ি, অ্যাম্বুলেন্স, কারিগর বা বিপদে সাহায্যকারী। কে আসছেন, কোথায় আছেন, কত ভাড়া: সব ম্যাপে আর বিলে দেখবেন। ভাড়া অ্যাডমিনের ঠিক করা হারে, আগেই আন্দাজ দেখাবে।</p></section>
    <section class="card"><h2>কী দরকার?</h2><div class="tgrid">${types || '<div class="skeleton"></div>'}</div>
      ${callF.type === 'ambulance' || callF.type === 'help' ? `<div class="note">${icon('alert')}<p>জীবন ঝুঁকিতে থাকলে আগে <a href="tel:999">৯৯৯</a>-এ কল করুন। এখানে ডাকা তার বদলে নয়, পাশাপাশি।</p></div>` : ''}</section>
    <section class="card"><h2>কোথায়?</h2>
      <label for="pickLabel">কোথা থেকে (চেনা জায়গা)</label><input type="search" id="pickLabel" maxlength="80" value="${esc(callF.pickLabel)}" placeholder="যেমন: মাইজদী বাজার, জামে মসজিদের সামনে">
      <div class="pills"><button class="btn" type="button" data-call-gps>${icon('locate', 'sm')}আমার লোকেশন</button>${t.dest ? `<button class="pill" type="button" data-pickmode="pick" aria-pressed="${callF.picking === 'pick'}">ম্যাপে: ডাকার জায়গা</button><button class="pill" type="button" data-pickmode="drop" aria-pressed="${callF.picking === 'drop'}">ম্যাপে: গন্তব্য</button>` : ''}</div>
      ${t.dest ? `<label for="dropLabel">কোথায় যাবেন</label><input type="search" id="dropLabel" maxlength="80" value="${esc(callF.dropLabel)}" placeholder="ম্যাপে চাপ দিন, বা নিচের একটা বাছুন">
      ${quick.length ? `<div class="pills">${quick.map((p, i) => `<button class="pill" type="button" data-qdrop="${i}">${esc(p.name)}</button>`).join('')}</div>` : ''}` : `<p class="small">${esc(t.who)} আপনার কাছে আসবেন; গন্তব্য লাগবে না।</p>`}
      <div class="mapwrap"><div id="rmap" class="rmap"></div></div>
      <div id="est">${estHtml()}</div>
      <button class="btn solid big" type="button" data-call-go>${icon(TYPE_IC[callF.type], 'sm')}${esc(t.who)} ডাকুন</button>
      <div id="callMsg" class="small" role="status"></div>
      <p class="small">ডাকার জায়গা আর গন্তব্য এই যাত্রার রেকর্ডে থাকে (রসিদের জন্য); দেখেন আপনি, যিনি নিলেন আর অ্যাডমিন; ডাক খোলা থাকা পর্যন্ত এই জেলার অনুমোদিত সেবাদাতারাও দেখেন। লাইভ লোকেশন শুধু যাত্রার সময় দুজনে দেখেন, শেষ হলে মুছে যায়।</p></section>
    <section class="card"><div class="sec-head"><h2>আমার আগের ডাক</h2><button class="link" type="button" data-call-hist>দেখুন${icon('chev', 'sm')}</button></div><div id="hist"></div></section>
    <section class="card"><h2>সেবা দিতে চান?</h2><p class="muted">সিএনজি, বাইক বা অ্যাম্বুলেন্স চালান, ইলেকট্রিশিয়ান-প্লাম্বার-মেকানিক, বা বিপদে মানুষের পাশে দাঁড়াতে চান? আবেদন করুন; অনুমোদনের পর কাছের ডাক পাবেন।</p>
      <div><button class="btn" type="button" data-tab-go="drive">${icon('wrench', 'sm')}আমি সেবা দিই</button></div></section>${SIM ? simNote() : ''}`;
}
const simNote = () => `<div class="note">${icon('info')}<p>প্রেজেন্টেশন মোড (?sim): ম্যাপে চলাচল নকল, আসল GPS নয়।</p></div>`;
// Destination shortcuts from the places list (ambulance: hospitals; others: bazars and bus stands).
function quickDrops() {
  try {
    const cats = callF.type === 'ambulance' ? ['health'] : ['bazar', 'ghat'];
    return cats.flatMap((c) => nearby(c).filter((p) => p.lat && !p.noLoc).slice(0, 3)).slice(0, 4);
  } catch { return []; }
}
function estHtml() {
  if (!RM) return '';
  const t = RM.typeOf(callF.type), rt = rates && rates[callF.type];
  if (!rates) return '<div class="skeleton"></div>';
  if (!rt) return `<div class="note">${icon('info')}<p>${FBERR.norates}</p></div>`;
  if (t.dest && !callF.drop) return `<p class="small">গন্তব্য বাছলে ভাড়ার আন্দাজ দেখাবে। হার: শুরু ${tk(rt.base)} + প্রতি কিমি ${tk(rt.perKm)} · সর্বনিম্ন ${tk(rt.minFare)}</p>`;
  const m = t.dest ? RM.estimateMetres(callF.pick, callF.drop) : 0, f = RM.fare(rt, m, 0);
  const on = callF.online == null ? '' : callF.online.length ? `${bn(callF.online.length)} জন ${esc(t.who)} এই জেলায় এখন কাজে আছেন` : `এই মুহূর্তে এই জেলায় কোনো ${esc(t.who)} অনলাইনে নেই; ডাকলে যিনি অনলাইনে আসবেন তিনি দেখবেন`;
  return `<div class="bill"><div><span>আনুমানিক ভাড়া</span><b>${callF.type === 'help' ? 'বিনামূল্যে' : tk(f)}</b></div>
    ${t.dest ? `<div><span>দূরত্ব (রাস্তায় আন্দাজ)</span><b>${kmTxt(m)}</b></div><div><span>সময়</span><b>${bn(RM.etaMinutes(m, callF.type))} মিনিট</b></div>` : ''}</div>
    <p class="small">${on ? on + ' · ' : ''}শেষ ভাড়া হবে আসল দূরত্ব আর অপেক্ষা (প্রথম ৩ মিনিট ফ্রি) দিয়ে। নগদে দেবেন।</p>`;
}
async function callMount() {
  try { if (!RM) { const [, rm, rp] = await RIDE(); RM = rm; HP = rp.hasPhone; if (tab === 'call') { render(); return; } } } catch (e) { $('#callMsg') && ($('#callMsg').textContent = errText(e)); return; }
  if (!callF.pick || callF.pick.area !== here.label) callF = { ...callF, pick: { lat: here.lat, lon: here.lon, area: here.label }, drop: null, dropLabel: '' };
  drawRideMap();
  if (noRates()) { try { const [[fb]] = await RIDE(); rates = await fb.readRates(); } catch { rates = {}; } if (tab === 'call' && !ride) paintEst(); }
  // a ride left open on this phone (another tab, a reload)
  if (!ride) {
    const id = store.get('sc-ride');
    if (id) { try { const [[fb]] = await RIDE(); if (await fb.currentUser()) followRide(id, 'rider'); } catch { /* signed out: nothing to show */ } }
  }
  refreshOnline();
}
async function refreshOnline() {
  try {
    const [[fb, cm]] = await RIDE(); if (!(await fb.currentUser())) return;
    callF.online = await fb.onlineCount(callF.type, cm.districtKey(here.d)); paintEst();
  } catch { /* not verified, or offline: the line is just not shown */ }
}
const paintEst = () => { const el = $('#est'); if (el) el.innerHTML = estHtml(); };

// The live map: pickup, destination, and the two people. Markers are moved in place (no re-render).
function drawRideMap() {
  const el = $('#rmap'); if (!el || !window.L) return;
  if (rideMap) { rideMap.remove(); rideMap = null; } mk = {};
  if (!navigator.onLine) { el.textContent = 'ইন্টারনেট নেই, তাই ম্যাপ দেখানো যাচ্ছে না।'; return; }
  const r = ride || { pickup: callF.pick, drop: callF.drop };
  rideMap = L.map(el).setView([r.pickup ? r.pickup.lat : here.lat, r.pickup ? r.pickup.lon : here.lon], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(rideMap);
  if (!ride) rideMap.on('click', (e) => {
    const p = { lat: r5(e.latlng.lat), lon: r5(e.latlng.lng) };
    if (!RM || !RM.inBangladesh(p.lat, p.lon)) return;
    if (callF.picking === 'pick' || !RM.typeOf(callF.type).dest) { callF.pick = { ...p, area: here.label }; } else { callF.drop = p; if (!$('#dropLabel').value.trim()) $('#dropLabel').value = 'ম্যাপে বাছাই করা জায়গা'; }
    paintMarkers(); paintEst();
  });
  paintMarkers(true);
}
const COL = () => { const c = getComputedStyle(document.documentElement); return { brand: c.getPropertyValue('--brand').trim() || '#0b4a4e', sos: c.getPropertyValue('--sos').trim() || '#cc2f2b', sun: c.getPropertyValue('--sun').trim() || '#b86e0a', ok: c.getPropertyValue('--ok').trim() || '#1f7a4f' }; };
function setMk(key, p, style, label) {
  if (!rideMap) return;
  if (!p) { if (mk[key]) { mk[key].remove(); delete mk[key]; } return; }
  if (mk[key]) { mk[key].setLatLng([p.lat, p.lon]); return; }
  // a DOM node, not a string: Leaflet puts a string in as HTML, and providerName is chosen by the provider
  const tip = document.createElement('span'); tip.textContent = label;
  mk[key] = L.circleMarker([p.lat, p.lon], { weight: 3, fillOpacity: 1, color: '#ffffff', ...style }).addTo(rideMap).bindTooltip(tip, { permanent: key === 'prov' || key === 'me', direction: 'top', offset: [0, -8] });
}
function paintMarkers(fit) {
  if (!rideMap) return;
  const c = COL(), r = ride || { pickup: callF.pick, drop: callF.drop, type: callF.type };
  const live = ride && RM && RM.LIVE.includes(ride.status);
  const provPos = rideRole === 'provider' ? mine : other, riderPos = rideRole === 'rider' ? mine : other;
  setMk('pick', r.pickup, { radius: 8, fillColor: c.brand }, 'ডাকার জায়গা');
  setMk('drop', r.drop, { radius: 8, fillColor: c.sun }, 'গন্তব্য');
  setMk('prov', live || ride?.status === 'on_trip' ? provPos : null, { radius: 11, fillColor: c.ok }, rideRole === 'provider' ? 'আপনি' : `${tWho(r.type)}${ride && ride.providerName ? ': ' + ride.providerName : ''}`);
  setMk('me', live && ride.status !== 'on_trip' ? riderPos : null, { radius: 9, fillColor: c.sos }, rideRole === 'rider' ? 'আপনি' : 'যাত্রী');
  if (fit || (ride && live)) {
    const pts = Object.values(mk).map((m) => m.getLatLng());
    if (pts.length > 1) rideMap.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 16 });
  }
}

// The rider's panel: what is happening now, and the one or two buttons that make sense at this step.
const RSTEPS = ['requested', 'accepted', 'arrived', 'on_trip', 'completed', 'paid'];
function rideStepper(st) {
  if (st === 'cancelled') return `<span class="badge sample">${RM.STATUS_BN.cancelled}</span>`;
  const k = RSTEPS.indexOf(st), lab = { requested: 'ডাকা', accepted: 'আসছেন', arrived: 'পৌঁছেছেন', on_trip: 'চলছে', completed: 'বিল', paid: 'পরিশোধ' };
  return `<ol class="stepper" aria-label="অবস্থা">${RSTEPS.map((x, i) => `<li class="${i < k ? 'done' : i === k ? 'now' : ''}">${lab[x]}</li>`).join('')}</ol>`;
}
function provLine(r) { return `<div class="rows"><div class="r"><span class="sq ${TYPE_TINT[r.type]}">${icon(TYPE_IC[r.type])}</span><div><div class="t">${esc(r.providerName || '')}</div><div class="m">${esc(r.vehicle || '')}</div></div><span></span></div></div>`; }
function billHtml(r) {
  const rt = rates && rates[r.type]; if (!rt) return `<div class="okbox">মোট ভাড়া: ${tk(r.fare || 0)}</div>`;
  const p = RM.fareParts(rt, r.distM || 0, r.waitMin || 0);
  const odd = !RM.billLooksRight(rt, r.distM || 0, r.waitMin || 0, r.fare || 0) || RM.distanceSuspicious(r.estM || 0, r.distM || 0);
  return `<div class="bill rows-bill"><div><span>শুরু</span><b>${tk(p.base)}</b></div><div><span>দূরত্ব ${bn(p.km.toFixed(1))} কিমি × ${tk(rt.perKm)}</span><b>${tk(p.distance)}</b></div>
    <div><span>অপেক্ষা ${bn(r.waitMin || 0)} মিনিট (৩ ফ্রি)</span><b>${tk(p.waiting)}</b></div><div class="total"><span>মোট (৫ টাকায় রাউন্ড, সর্বনিম্ন ${tk(rt.minFare)})</span><b>${tk(r.fare || 0)}</b></div></div>
    ${odd ? `<div class="note">${icon('alert')}<p>দূরত্ব আন্দাজের চেয়ে অনেক বেশি। ঠিক মনে না হলে "বিল ভুল" চাপুন; অ্যাডমিন দেখবেন।</p></div>` : ''}`;
}
function riderPanel() {
  const r = ride; if (!r || !RM) return '<div class="skeleton"></div>';
  const t = RM.typeOf(r.type), rt = rates && rates[r.type];
  let body = '';
  if (r.status === 'requested') body = `<h2>কাছের ${esc(t.who)} খোঁজা হচ্ছে…</h2><p class="muted">${esc(r.pickup.label)}${r.drop ? ' → ' + esc(r.drop.label) : ''} · আনুমানিক ${r.type === 'help' ? 'বিনামূল্যে' : tk(r.estFare)}</p>
    <p class="small">যিনি নেবেন তাঁর নাম আর ${r.type === 'technician' || r.type === 'help' ? 'পরিচয়' : 'গাড়ির নম্বর'} এখানে দেখাবে, আর ম্যাপে তাঁকে আসতে দেখবেন।</p>
    <div class="pills"><button class="btn ghost" type="button" data-ride-cancel>বাতিল (কোনো চার্জ নেই)</button></div>`;
  else if (r.status === 'accepted' || r.status === 'arrived') {
    const far = other ? RM.metres(other, r.pickup) : null;
    body = `<h2>${r.status === 'arrived' ? `${esc(t.who)} পৌঁছে গেছেন` : `${esc(t.who)} আসছেন`}</h2>${provLine(r)}
      ${r.status === 'accepted' ? `<p class="muted">${far == null ? 'অবস্থান আসছে…' : `${kmTxt(far)} দূরে · প্রায় ${bn(RM.etaMinutes(far * RM.ROAD_FACTOR, r.type))} মিনিট`}</p>` : `<p class="muted">${esc(r.pickup.label)}-এ অপেক্ষা করছেন। প্রথম ৩ মিনিট অপেক্ষা ফ্রি।</p>`}
      <div class="pills"><button class="btn ghost" type="button" data-ride-cancel>বাতিল${r.status === 'arrived' && rt ? ` (চার্জ ${tk(RM.cancelFee(rt, 'arrived'))})` : ' (কোনো চার্জ নেই)'}</button></div>`;
  } else if (r.status === 'on_trip') body = `<h2>${r.type === 'technician' ? 'কাজ চলছে' : r.type === 'help' ? 'সাহায্য চলছে' : 'যাত্রা চলছে'}</h2>${provLine(r)}
      ${r.drop ? `<p class="muted">${esc(r.drop.label)}-এর দিকে</p>` : ''}
      <div class="pills"><button class="btn" type="button" data-ride-family>${icon('msg', 'sm')}পরিবারকে জানান</button></div><div id="sosOut"></div>`;
  else if (r.status === 'completed') body = `<h2>বিল</h2>${provLine(r)}${billHtml(r)}<p class="muted">${esc(t.who)}কে নগদ ${tk(r.fare || 0)} দিন। তিনি "টাকা পেয়েছি" চাপলে রসিদ আসবে।</p>
      ${'billOk' in r ? `<p class="small">আপনি বলেছেন: ${r.billOk ? 'বিল ঠিক আছে' : 'বিল ভুল মনে হচ্ছে'}</p>` : `<div class="pills"><button class="btn" type="button" data-bill-ok="1">${icon('check', 'sm')}বিল ঠিক আছে</button><button class="btn ghost" type="button" data-bill-ok="0">বিল ভুল মনে হচ্ছে</button></div>`}`;
  else if (r.status === 'paid') {
    const txt = RM.receiptText(r, bn);
    body = `<h2>পরিশোধ হয়েছে · ধন্যবাদ!</h2><pre class="okbox gd-text">${esc(txt)}</pre>
      <div class="pills"><button class="btn" type="button" data-copy="${esc(txt)}">${icon('copy', 'sm')}রসিদ কপি</button><button class="btn" type="button" data-share="${esc(txt)}">${icon('share', 'sm')}শেয়ার</button></div>
      ${'rating' in r ? `<p class="small">আপনার রেটিং: ${'★'.repeat(r.rating)}</p>` : `<p class="muted">${esc(t.who)} কেমন ছিলেন?</p><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button class="star" type="button" data-rate="${n}" aria-label="${bn(n)} তারা">★</button>`).join('')}</div>`}
      ${'billOk' in r ? '' : `<div class="pills"><button class="btn ghost" type="button" data-bill-ok="0">বিল ভুল মনে হচ্ছে</button></div>`}
      <div><button class="btn solid" type="button" data-ride-new>নতুন ডাক</button></div>`;
  } else body = `<h2>বাতিল হয়েছে</h2><p class="muted">${r.cancelledBy === 'provider' ? `${esc(t.who)} বাতিল করেছেন। আবার ডাকুন, অন্য কেউ নেবেন।` : 'আপনি বাতিল করেছেন।'}${r.cancelFee ? ` চার্জ: ${tk(r.cancelFee)} (নগদ)।` : ''}</p>
      <div><button class="btn solid" type="button" data-ride-new>নতুন ডাক</button></div>`;
  return `${rideStepper(r.status)}${body}<div id="rideMsg" class="small" role="status"></div>`;
}

// Follow one ride (rider or provider): the ride document, the other person's live position, and our own GPS.
async function followRide(id, role) {
  const [[fb]] = await RIDE();
  stopRide(); rideRole = role;
  if (noRates()) { try { rates = await fb.readRates(); } catch { rates = {}; } }
  rideUnsub = fb.watchRide(id, (r) => onRide(r), (e) => { const m = $('#rideMsg') || $('#jobMsg'); if (m) m.textContent = errText(e); });
}
async function onRide(r) {
  const [[fb]] = await RIDE();
  const was = ride ? ride.status : null; ride = r;
  if (!r) { stopRide(); ride = null; store.set('sc-ride', ''); return paintRide(); }
  const live = RM.LIVE.includes(r.status);
  if (live && !liveUnsub) liveUnsub = fb.watchLive(r.id, rideRole === 'rider' ? 'provider' : 'rider', (p) => { other = p; paintRide(true); }, () => {});
  if (live) startGeo(); else { stopGeo(); if (liveUnsub) { liveUnsub(); liveUnsub = null; } other = null; }
  if (['completed', 'paid', 'cancelled'].includes(r.status) && was && RM.LIVE.includes(was)) fb.clearLive(r.id);
  if (rideRole === 'rider' && was && was !== r.status) toast(RM.STATUS_BN[r.status]);
  if (rideRole === 'provider' && ['cancelled', 'paid'].includes(r.status)) {
    if (r.status === 'cancelled' && r.cancelledBy === 'rider') toast(`যাত্রী বাতিল করেছেন${r.cancelFee ? `: চার্জ ${r.cancelFee} টাকা নিন` : ''}`);
    stopRide(); ride = null; rideRole = null; try { myJobs = await fb.myRides('provider'); } catch { /* keep the old list */ } paintDrive(); return;
  }
  paintRide(true);   // any change of the ride itself (status, bill answer, rating) redraws the panel
}
function paintRide(statusChanged) {
  if (rideRole === 'rider' && tab === 'call') {
    if (!$('#ridePanel') || !ride) { render(); return; }
    if (statusChanged || ride.status === 'accepted') $('#ridePanel').innerHTML = riderPanel();
    paintMarkers();
  } else if (rideRole === 'provider' && tab === 'drive') {
    if (!$('#jobPanel')) { paintDrive(); return; }
    if (statusChanged) $('#jobPanel').innerHTML = jobPanel(); else { const d = $('#jobDist'); if (d) d.innerHTML = jobDist(); }
    paintMarkers();
  }
}

// Our own position while the ride is live: real GPS (sent at most every 8 s and only after 25 m, or once a minute), or
// in the presentation mode a point that moves 120 m every 3 s toward where it is going.
function startGeo() {
  if (geoId != null || simTimer) return;
  if (SIM) {
    const r = ride; simPos = simPos || (rideRole === 'provider' ? { lat: r5(r.pickup.lat + 0.012), lon: r5(r.pickup.lon + 0.009) } : { lat: r.pickup.lat, lon: r.pickup.lon });
    const tick = () => {
      if (!ride || !RM.LIVE.includes(ride.status)) return stopGeo();
      if (rideRole === 'provider') {
        const goal = ride.status === 'on_trip' ? (ride.drop || ride.pickup) : ride.pickup, d = RM.metres(simPos, goal);
        if (ride.status !== 'arrived' && d > 1) { const f = Math.min(1, 120 / d); simPos = { lat: r5(simPos.lat + (goal.lat - simPos.lat) * f), lon: r5(simPos.lon + (goal.lon - simPos.lon) * f) }; }
      }
      gotPos(simPos.lat, simPos.lon, true);
    };
    tick(); simTimer = setInterval(tick, 3000); return;
  }
  if (!navigator.geolocation) return;
  geoId = navigator.geolocation.watchPosition((p) => gotPos(r5(p.coords.latitude), r5(p.coords.longitude)), () => {
    const m = $('#rideMsg') || $('#jobMsg'); if (m) m.textContent = 'লোকেশন পাওয়া যাচ্ছে না: ফোনের লোকেশন চালু করুন। ম্যাপে শুধু ডাকার জায়গা দেখাবে।';
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
async function gotPos(lat, lon, sim) {
  if (!ride || !RM.inBangladesh(lat, lon)) return;
  const p = { lat, lon, at: Date.now() };
  mine = p;
  if (rideRole === 'provider' && ride.status === 'on_trip') track = RM.trackAdd(track, p);
  // the rider stops sending once on the trip (they are in the vehicle; the provider's point shows both)
  if (rideRole === 'rider' && ride.status === 'on_trip') { paintMarkers(); return; }
  const due = !lastSent || (p.at - lastSent.at >= (sim ? 2500 : 8000) && RM.metres(lastSent, p) >= 25) || p.at - lastSent.at >= 60000;
  if (due) { lastSent = p; try { const [[fb]] = await RIDE(); await fb.sendLive(ride.id, rideRole, lat, lon); } catch { /* the next point tries again */ } }
  paintRide();
}

async function callGo() {
  const msg = $('#callMsg'); msg.textContent = '';
  const t = RM.typeOf(callF.type);
  callF.pickLabel = $('#pickLabel').value.trim(); if (t.dest) callF.dropLabel = $('#dropLabel').value.trim();
  // sign-in first (it must always be reachable), then the rates as they are now
  try { if (!(await needUser(msg, WHY.call))) return; } catch (e) { msg.textContent = errText(e); return; }
  if (noRates() || !rates[callF.type]) { try { const [[fb]] = await RIDE(); rates = await fb.readRates(); paintEst(); } catch { /* the check below says it */ } }
  const rt = rates && rates[callF.type];
  if (!rt) { msg.textContent = FBERR.norates; return; }
  if (callF.pickLabel.length < 2) { msg.textContent = 'কোথা থেকে ডাকছেন, একটা চেনা জায়গার নাম লিখুন।'; $('#pickLabel').focus(); return; }
  if (t.dest && !callF.drop) { msg.textContent = 'গন্তব্য বাছুন: ম্যাপে চাপ দিন বা একটা জায়গা বাছুন।'; return; }
  if (t.dest && callF.dropLabel.length < 2) { msg.textContent = 'গন্তব্যের নাম লিখুন।'; return; }
  if ([callF.pickLabel, callF.dropLabel].some(HP)) { msg.textContent = 'ফোন নম্বর লিখবেন না। যিনি নেবেন তিনি অ্যাপেই আপনাকে দেখবেন।'; return; }
  msg.textContent = 'পাঠানো হচ্ছে…';
  try {
    const [[fb, cm]] = await RIDE();
    const estM = t.dest ? RM.estimateMetres(callF.pick, callF.drop) : 0;
    const f = { type: callF.type, district: cm.districtKey(here.d), pickup: { lat: r5(callF.pick.lat), lon: r5(callF.pick.lon), label: callF.pickLabel.slice(0, 80) },
      estM, estFare: RM.fare(rt, estM, 0) };
    if (t.dest) f.drop = { lat: r5(callF.drop.lat), lon: r5(callF.drop.lon), label: callF.dropLabel.slice(0, 80) };
    const id = await fb.requestRide(f);
    store.set('sc-ride', id); ride = { id, ...f, status: 'requested' }; rideRole = 'rider'; render();
    await followRide(id, 'rider');
  } catch (e) { msg.textContent = errText(e); }
}
async function showHistory() {
  const box = $('#hist'); box.innerHTML = '<div class="skeleton"></div>';
  try {
    if (!(await needUser(box, WHY.history))) return;
    const [[fb]] = await RIDE(); const list = (await fb.myRides('rider')).slice(0, 10);
    box.innerHTML = list.length ? `<div class="rows">${list.map((r) => `<div class="r"><span class="sq ${TYPE_TINT[r.type]}">${icon(TYPE_IC[r.type])}</span><div><div class="t">${esc(tName(r.type).split(' (')[0])} · ${esc(r.pickup?.label || '')}${r.drop ? ' → ' + esc(r.drop.label) : ''}</div>
      <div class="m">${r.createdAt ? agoBn(r.createdAt) : ''} · ${esc(RM.STATUS_BN[r.status])}${r.fare != null ? ' · ' + tk(r.fare) : ''}</div></div>${r.status === 'paid' ? `<button class="btn ghost" type="button" data-copy="${esc(RM.receiptText(r, bn))}">রসিদ</button>` : '<span></span>'}</div>`).join('')}</div>`
      : '<p class="muted">এখনো কিছু ডাকেননি।</p>';
  } catch (e) { box.textContent = errText(e); }
}

/* ---------- the provider's page (and, for an admin, approvals and rates) ---------- */
function viewDrive() {
  if (!here) return needHere();
  return `<button class="link" type="button" data-tab-go="call">${icon('back', 'sm')}ডাকুন</button>
    <section class="card"><p class="eyebrow">সেবা দিন</p><h1>কাছের মানুষের ডাক নিন</h1>
      <p class="muted">অনুমোদিত চালক, কারিগর ও স্বেচ্ছাসেবক তাঁর জেলার ডাক দেখেন। নিলে যাত্রী আপনাকে ম্যাপে দেখবেন, আপনি তাঁকে। শেষে বিল নিজে থেকে হিসাব হয়।</p></section>
    <div id="drivePanel"><section class="card"><div class="skeleton"></div></section></div>${SIM ? simNote() : ''}`;
}
async function driveMount() {
  const box = $('#drivePanel');
  try {
    if (!RM) { const [, rm, rp] = await RIDE(); RM = rm; HP = rp.hasPhone; }
    const card = document.createElement('section'); card.className = 'card'; box.replaceChildren(card);
    const u = await needUser(card, WHY.drive); if (!u) return;
    const [[fb]] = await RIDE();
    if (noRates()) { try { rates = await fb.readRates(); } catch { rates = {}; } }
    prov = await fb.myProvider();
    isAdm = (await fb.roleOf(u, 'bn')) === 'admin';
    if (isAdm) { try { pend = await fb.pendingProviders(); } catch { pend = []; } }
    if (prov && prov.approved) {
      if (!reqUnsub) reqUnsub = fb.watchRequests(prov, (list) => { reqs = list; const el = $('#reqList'); if (el) el.innerHTML = reqHtml(); }, (e) => { const el = $('#reqList'); if (el) el.textContent = errText(e); });
      myJobs = await fb.myRides('provider');
      const act = myJobs.find((r) => ['accepted', 'arrived', 'on_trip', 'completed'].includes(r.status));
      if (act && (!ride || ride.id !== act.id)) { ride = act; await followRide(act.id, 'provider'); }
    }
    paintDrive();
  } catch (e) { box.innerHTML = `<section class="card"><p class="muted">${esc(errText(e))}</p></section>`; }
}
function paintDrive() {
  const box = $('#drivePanel'); if (!box || tab !== 'drive') return;
  const typeOpts = RM.RIDE_TYPES.map((x) => `<option value="${x.id}">${esc(x.bn)}</option>`).join('');
  let html = '';
  if (prov === null) html = `<section class="card"><h2>সেবাদাতা হিসেবে আবেদন</h2><p class="muted">জেলা: ${esc(here.dBn)} (উপরে এলাকা বদলালে বদলাবে)। ফোন নম্বর লিখবেন না: যাত্রী অ্যাপেই আপনাকে দেখবেন।</p>
      <label for="pvType">কী সেবা দেবেন</label><select id="pvType">${typeOpts}</select>
      <label for="pvName">আপনার নাম (যাত্রী দেখবেন)</label><input type="search" id="pvName" maxlength="60" placeholder="যেমন: রহিম মিয়া">
      <label for="pvVeh">গাড়ির নম্বর বা কাজের পরিচয়</label><input type="search" id="pvVeh" maxlength="40" placeholder="যেমন: নোয়াখালী-থ-১২৩৪, বা ইলেকট্রিশিয়ান">
      <div><button class="btn solid" type="button" data-pv-apply>আবেদন জমা দিন</button></div><div id="pvMsg" class="small" role="status"></div></section>`;
  else if (prov && !prov.approved) html = `<section class="card"><h2>আবেদন জমা হয়েছে</h2><p class="muted">${esc(prov.name)} · ${esc(tName(prov.type))} · ${esc(prov.vehicle)}</p>
      <p class="muted">অ্যাডমিন যাচাই করে অনুমোদন দিলে এখানেই ডাক দেখবেন।</p><div><button class="btn ghost" type="button" data-pv-withdraw>আবেদন তুলে নিন</button></div><div id="pvMsg" class="small" role="status"></div></section>`;
  else if (prov) {
    const job = ride && rideRole === 'provider' && ['accepted', 'arrived', 'on_trip', 'completed'].includes(ride.status);
    html = `<section class="card"><div class="sec-head"><h2>${esc(prov.name)}</h2><span class="badge off">অনুমোদিত</span></div><p class="muted">${esc(tName(prov.type))} · ${esc(prov.vehicle)}</p>
        <div class="pills"><button class="btn ${pvOnline ? '' : 'solid'}" type="button" data-pv-online>${pvOnline ? 'কাজ বন্ধ করুন' : 'কাজ শুরু (অনলাইন)'}</button></div>
        <p class="small">${pvOnline ? 'অনলাইনে আছেন: যাত্রীরা দেখবেন এই জেলায় কতজন কাজে আছেন (আপনার জায়গা প্রায় ১০০ মিটার ঘুরিয়ে)।' : 'অনলাইনে না থাকলেও নতুন ডাক দেখবেন; অনলাইনে থাকলে যাত্রীরা জানবেন কেউ আছেন।'}</p></section>
      ${job ? `<section class="card"><p class="eyebrow">এখনকার কাজ</p><div id="jobPanel">${jobPanel()}</div></section><div class="mapwrap"><div id="rmap" class="rmap"></div></div>`
        : `<section class="card"><h2>নতুন ডাক</h2><div id="reqList">${reqHtml()}</div><div id="jobMsg" class="small" role="status"></div></section>`}
      <section class="card"><h2>আয়</h2>${earnHtml()}</section>`;
  }
  if (isAdm) html += adminHtml();
  box.innerHTML = html;
  if (ride && rideRole === 'provider' && $('#rmap')) { drawRideMap(); }
  if (isAdm) fillRateForm();
}
function reqHtml() {
  if (!reqs.length) return `<p class="muted">এই মুহূর্তে ${esc(here.dBn)} জেলায় নতুন কোনো ডাক নেই। এই পাতা খোলা রাখুন: ডাক এলে নিজে থেকে দেখাবে।</p>`;
  const from = mine || (here ? { lat: here.lat, lon: here.lon } : null);
  return `<div class="rows">${reqs.map((r) => `<div class="r req"><span class="sq ${TYPE_TINT[r.type]}">${icon(TYPE_IC[r.type])}</span>
    <div><div class="t">${esc(r.pickup.label)}${r.drop ? ' → ' + esc(r.drop.label) : ''}</div><div class="m">${from ? kmTxt(RM.metres(from, r.pickup)) + ' দূরে · ' : ''}${r.drop ? kmTxt(r.estM) + ' যাত্রা · ' : ''}${r.type === 'help' ? 'বিনামূল্যে' : 'আনুমানিক ' + tk(r.estFare)} · ${r.createdAt ? agoBn(r.createdAt) : 'এইমাত্র'}</div></div>
    <button class="btn solid" type="button" data-pv-accept="${esc(r.id)}">নিন</button></div>`).join('')}</div>`;
}
const jobDist = () => (ride && ride.status === 'on_trip' && track ? `এ পর্যন্ত ${kmTxt(track.m)} চলেছে (GPS)` : ride && ride.status === 'accepted' && mine ? `যাত্রী ${kmTxt(RM.metres(mine, other || ride.pickup))} দূরে` : '');
function jobPanel() {
  const r = ride, t = RM.typeOf(r.type);
  const where = `<p class="muted">${icon('pin', 'sm')} ${esc(r.pickup.label)}${r.drop ? ` → ${esc(r.drop.label)} (${kmTxt(r.estM)})` : ''}</p>`;
  const nav = `<a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${r.status === 'on_trip' && r.drop ? `${r.drop.lat},${r.drop.lon}` : `${r.pickup.lat},${r.pickup.lon}`}" ${ext}>${icon('nav', 'sm')}পথ দেখান</a>`;
  let body = '';
  if (r.status === 'accepted') body = `<h2>যাত্রীর কাছে যান</h2>${where}<p class="small" id="jobDist">${jobDist()}</p><div class="pills"><button class="btn solid" type="button" data-pv-step="arrived">পৌঁছেছি</button>${nav}<button class="btn ghost" type="button" data-pv-cancel>বাতিল</button></div>`;
  else if (r.status === 'arrived') body = `<h2>যাত্রীর অপেক্ষা</h2>${where}<p class="small">প্রথম ৩ মিনিট অপেক্ষা ফ্রি, তারপর প্রতি মিনিট ${tk(rates[r.type]?.perMin || 0)}।</p><div class="pills"><button class="btn solid" type="button" data-pv-step="on_trip">${t.dest ? 'যাত্রা শুরু' : 'কাজ শুরু'}</button><button class="btn ghost" type="button" data-pv-cancel>বাতিল</button></div>`;
  else if (r.status === 'on_trip') body = `<h2>${t.dest ? 'যাত্রা চলছে' : 'কাজ চলছে'}</h2>${where}<p class="small" id="jobDist">${jobDist()}</p><div class="pills"><button class="btn solid" type="button" data-pv-end>${t.dest ? 'গন্তব্যে পৌঁছেছি: বিল করুন' : 'কাজ শেষ: বিল করুন'}</button>${t.dest ? nav : ''}</div>`;
  else if (r.status === 'completed') body = `<h2>নগদ ${tk(r.fare || 0)} নিন</h2>${billHtml(r)}${'billOk' in r ? `<p class="small">যাত্রী বলেছেন: ${r.billOk ? 'বিল ঠিক আছে' : 'বিল ভুল মনে হচ্ছে'}</p>` : ''}<div><button class="btn solid" type="button" data-pv-paid>টাকা পেয়েছি</button></div>`;
  return `${rideStepper(r.status)}${body}<div id="jobMsg" class="small" role="status"></div>`;
}
function earnHtml() {
  if (!myJobs) return '<div class="skeleton"></div>';
  const paid = myJobs.filter((r) => r.status === 'paid'), day = new Date(); day.setHours(0, 0, 0, 0);
  const today = paid.filter((r) => (r.paidAt || 0) >= day.getTime());
  const sum = (l) => l.reduce((s, r) => s + (r.fare || 0), 0);
  return `<div class="bento earn"><div class="cell"><span>আজ</span><b>${tk(sum(today))}</b><span>${bn(today.length)}টি কাজ</span></div><div class="cell"><span>মোট</span><b>${tk(sum(paid))}</b><span>${bn(paid.length)}টি কাজ</span></div></div>
    ${paid.length ? `<div class="rows">${paid.slice(0, 5).map((r) => `<div class="r"><span class="sq t-ok">${icon('check')}</span><div><div class="t">${esc(r.pickup?.label || '')}${r.drop ? ' → ' + esc(r.drop.label) : ''}</div><div class="m">${r.paidAt ? agoBn(r.paidAt) : ''}${r.rating ? ' · ' + '★'.repeat(r.rating) : ''}</div></div><span class="dist">${tk(r.fare || 0)}</span></div>`).join('')}</div>` : ''}`;
}
function adminHtml() {
  const typeOpts = RM.RIDE_TYPES.filter((x) => x.id !== 'help').map((x) => `<option value="${x.id}">${esc(x.bn.split(' (')[0])}</option>`).join('');
  const missing = RM.RIDE_TYPES.filter((x) => !rates[x.id]).map((x) => x.bn.split(' (')[0]);
  return `<section class="card"><p class="eyebrow">অ্যাডমিন</p><h2>অনুমোদনের অপেক্ষায়</h2>
      ${!pend ? '<div class="skeleton"></div>' : !pend.length ? '<p class="muted">কেউ অপেক্ষায় নেই।</p>' : `<div class="rows">${pend.map((p) => `<div class="r"><span class="sq ${TYPE_TINT[p.type]}">${icon(TYPE_IC[p.type])}</span><div><div class="t">${esc(p.name)} · ${esc(tName(p.type).split(' (')[0])}</div><div class="m">${esc(p.vehicle)} · ${esc(p.district)}</div></div><button class="btn solid" type="button" data-pv-approve="${esc(p.id)}">অনুমোদন</button></div>`).join('')}</div>`}
      <div id="admMsg" class="small" role="status"></div></section>
    <section class="card"><p class="eyebrow">অ্যাডমিন</p><h2>ভাড়ার হার</h2>${missing.length ? `<div class="note">${icon('info')}<p>এখনো হার দেওয়া হয়নি: ${esc(missing.join(', '))}। হার না থাকলে ওই সেবা ডাকা যাবে না।</p></div>` : ''}
      <label for="rtType">সেবা</label><select id="rtType">${typeOpts}</select>
      <div class="row2"><div><label for="rtBase">শুরু (টাকা)</label><input type="tel" id="rtBase" inputmode="numeric"></div><div><label for="rtKm">প্রতি কিমি</label><input type="tel" id="rtKm" inputmode="numeric"></div>
      <div><label for="rtMin">অপেক্ষা প্রতি মিনিট</label><input type="tel" id="rtMin" inputmode="numeric"></div><div><label for="rtMinF">সর্বনিম্ন ভাড়া</label><input type="tel" id="rtMinF" inputmode="numeric"></div></div>
      <div class="pills"><button class="btn solid" type="button" data-rt-save>হার সংরক্ষণ</button><button class="btn ghost" type="button" data-rt-defaults>সব সেবায় নমুনা হার দিন</button></div>
      <p class="small">প্রতিটা বদল অডিট লগে থাকে। "বিপদে সাহায্যকারী" সবসময় বিনামূল্যে।</p><div id="rtMsg" class="small" role="status"></div></section>`;
}
function fillRateForm() {
  const t = $('#rtType')?.value; if (!t) return;
  const r = rates[t] || RM.DEFAULT_RATES[t];
  $('#rtBase').value = r.base; $('#rtKm').value = r.perKm; $('#rtMin').value = r.perMin; $('#rtMinF').value = r.minFare;
}

/* ---------- provider and admin actions ---------- */
async function pvAction(t) {
  const [[fb, cm]] = await RIDE();
  const say = (sel, s) => { const m = $(sel); if (m) m.textContent = s; };
  try {
    if ('pvApply' in t.dataset) {
      const name = $('#pvName').value.trim(), veh = $('#pvVeh').value.trim(), type = $('#pvType').value;
      if (name.length < 2 || veh.length < 2) return say('#pvMsg', 'নাম আর গাড়ির নম্বর বা কাজের পরিচয় লিখুন।');
      if (HP(name) || HP(veh)) return say('#pvMsg', 'ফোন নম্বর লিখবেন না।');
      await fb.applyProvider({ name, type, vehicle: veh, district: cm.districtKey(here.d) });
      prov = await fb.myProvider(); toast('আবেদন জমা হয়েছে'); return driveMount();
    }
    if ('pvWithdraw' in t.dataset) { await fb.withdrawProvider(); prov = null; return paintDrive(); }
    if ('pvOnline' in t.dataset) {
      if (pvOnline) { await fb.goOffline(); pvOnline = false; return paintDrive(); }
      const at = await new Promise((ok) => {
        if (SIM || !navigator.geolocation) return ok({ lat: here.lat, lon: here.lon });
        navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok({ lat: here.lat, lon: here.lon }), { timeout: 10000 });
      });
      await fb.goOnline(prov, RM.coarse(at.lat), RM.coarse(at.lon)); pvOnline = true; mine = mine || { ...at, at: Date.now() }; toast('আপনি অনলাইনে আছেন'); return paintDrive();
    }
    if (t.dataset.pvAccept) {
      try { await fb.acceptRide(t.dataset.pvAccept, prov); } catch (e) { if (e.code === 'permission-denied') throw { code: 'taken' }; throw e; }
      toast('ডাক নিলেন। যাত্রী এখন আপনাকে ম্যাপে দেখছেন।');
      ride = reqs.find((r) => r.id === t.dataset.pvAccept) || null; if (ride) ride = { ...ride, status: 'accepted' };
      await followRide(t.dataset.pvAccept, 'provider'); paintDrive(); return;
    }
    if (t.dataset.pvStep === 'arrived') { await fb.arrived(ride.id); return; }
    if (t.dataset.pvStep === 'on_trip') { track = null; await fb.startTrip(ride.id); return; }
    if ('pvEnd' in t.dataset) {
      const r = ride, tp = RM.typeOf(r.type), rt = rates[r.type];
      const max = (r.estM || 0) * 3 + 5000;
      const distM = tp.dest ? Math.min(max, Math.round(track && track.m > 50 ? track.m : r.estM || 0)) : 0;
      const waitMin = r.arrivedAt && r.startedAt ? Math.max(0, Math.floor((r.startedAt - r.arrivedAt) / 60000)) : 0;
      await fb.completeRide(r.id, { distM, waitMin, fare: RM.fare(rt, distM, waitMin) }); return;
    }
    if ('pvPaid' in t.dataset) {
      await fb.markPaid(ride.id); toast('টাকা পেয়েছেন। রসিদ যাত্রীর কাছে গেছে।');
      stopRide(); ride = null; rideRole = null; myJobs = await fb.myRides('provider'); return paintDrive();
    }
    if ('pvCancel' in t.dataset) {
      await fb.cancelRide(ride.id, 'provider', 0); await fb.clearLive(ride.id);
      stopRide(); ride = null; rideRole = null; toast('বাতিল হয়েছে'); return paintDrive();
    }
    if (t.dataset.pvApprove) { await fb.approveProvider(t.dataset.pvApprove, true); pend = await fb.pendingProviders(); toast('অনুমোদন দেওয়া হয়েছে'); return paintDrive(); }
    if ('rtSave' in t.dataset || 'rtDefaults' in t.dataset) {
      const list = 'rtDefaults' in t.dataset ? Object.entries(RM.DEFAULT_RATES) : [[$('#rtType').value, { base: +$('#rtBase').value, perKm: +$('#rtKm').value, perMin: +$('#rtMin').value, minFare: +$('#rtMinF').value }]];
      for (const [k, r] of list) {
        if (![r.base, r.perKm, r.perMin, r.minFare].every((x) => Number.isInteger(x) && x >= 0)) return say('#rtMsg', 'শুধু পূর্ণ সংখ্যা (০ বা বেশি) লিখুন।');
        await fb.setRates(k, k === 'help' ? { base: 0, perKm: 0, perMin: 0, minFare: 0 } : r);
      }
      rates = await fb.readRates(); toast('হার সংরক্ষণ হয়েছে'); return paintDrive();
    }
  } catch (e) {
    const m = $('#jobMsg') || $('#pvMsg') || $('#admMsg') || $('#rtMsg');
    if (m) m.textContent = errText(e); else toast(errText(e));
  }
}
async function riderAction(t) {
  const [[fb]] = await RIDE();
  const m = $('#rideMsg');
  try {
    if ('rideCancel' in t.dataset) {
      const fee = ride.status === 'arrived' && rates[ride.type] ? RM.cancelFee(rates[ride.type], 'arrived') : 0;
      if (fee && !confirm(`${tWho(ride.type)} পৌঁছে গেছেন। এখন বাতিল করলে ${fee} টাকা দিতে হবে। বাতিল করবেন?`)) return;
      await fb.cancelRide(ride.id, 'rider', fee); if (RM.LIVE.includes(ride.status)) await fb.clearLive(ride.id); return;
    }
    if (t.dataset.billOk) { await fb.billOk(ride.id, t.dataset.billOk === '1'); toast('ধন্যবাদ, জানানো হয়েছে'); return; }
    if (t.dataset.rate) { await fb.rateRide(ride.id, Number(t.dataset.rate)); toast('ধন্যবাদ!'); return; }
    if ('rideNew' in t.dataset) { stopRide(); ride = null; rideRole = null; store.set('sc-ride', ''); callF.drop = null; callF.dropLabel = ''; render(); return; }
    if ('rideFamily' in t.dataset) {
      const msg = `${tName(ride.type).split(' (')[0]}-এ যাচ্ছি: ${ride.pickup.label}${ride.drop ? ' থেকে ' + ride.drop.label : ''}। ${tWho(ride.type)}: ${ride.providerName} (${ride.vehicle})। পৌঁছে জানাব।`;
      $('#sosOut').innerHTML = smsBlock(msg); return;
    }
  } catch (e) { if (m) m.textContent = errText(e); }
}

Object.assign(VIEWS, { call: viewCall, drive: viewDrive });
document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('button, a'); if (!t) return;
  const d = t.dataset;
  if (d.rtype) { callF.type = d.rtype; callF.online = null; if (!RM.typeOf(d.rtype).dest) callF.drop = null; callF.pickLabel = $('#pickLabel')?.value || callF.pickLabel; render(); refreshOnline(); return; }
  if (d.pickmode) { callF.picking = d.pickmode; callF.pickLabel = $('#pickLabel').value; callF.dropLabel = $('#dropLabel')?.value || ''; document.querySelectorAll('[data-pickmode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pickmode === d.pickmode))); return; }
  if (d.qdrop) { const p = quickDrops()[Number(d.qdrop)]; if (p) { callF.drop = { lat: p.lat, lon: p.lon }; $('#dropLabel').value = p.name.slice(0, 80); paintMarkers(true); paintEst(); } return; }
  if ('callGps' in d) {
    const m = $('#callMsg'); if (!navigator.geolocation) { m.textContent = 'এই ব্রাউজারে লোকেশন নেই। ম্যাপে চাপ দিয়ে ডাকার জায়গা বাছুন।'; return; }
    m.textContent = 'লোকেশন খোঁজা হচ্ছে…';
    navigator.geolocation.getCurrentPosition((p) => {
      const la = r5(p.coords.latitude), lo = r5(p.coords.longitude);
      if (!RM.inBangladesh(la, lo)) { m.textContent = 'আপনি বাংলাদেশের বাইরে আছেন বলে মনে হচ্ছে।'; return; }
      callF.pick = { lat: la, lon: lo, area: here.label }; m.textContent = 'ডাকার জায়গা: আপনার এখনকার লোকেশন।'; paintMarkers(true); paintEst();
    }, () => { m.textContent = 'লোকেশন পাওয়া যায়নি। ম্যাপে চাপ দিয়ে ডাকার জায়গা বাছুন।'; }, { timeout: 15000, enableHighAccuracy: true });
    return;
  }
  if ('callGo' in d) { callGo(); return; }
  if ('callHist' in d) { showHistory(); return; }
  if (['rideCancel', 'billOk', 'rate', 'rideNew', 'rideFamily'].some((k) => k in d)) { riderAction(t); return; }
  if (Object.keys(d).some((k) => /^(pv|rt)[A-Z]/.test(k))) { pvAction(t); return; }
});
document.addEventListener('change', (ev) => { if (ev.target.id === 'rtType') fillRateForm(); });

// Start (last, so every page above exists): a family trip link opens its page; otherwise the saved area.
tripFromHash();
try { const h = JSON.parse(store.get('demo-here') || 'null'); if (h) locate(h.lat, h.lon, h.label); else locate(PRESETS[0].lat, PRESETS[0].lon, PRESETS[0].n); } catch { locate(PRESETS[0].lat, PRESETS[0].lon, PRESETS[0].n); }
render();
