// Test page logic for preview.html (P23, P26). The real site (index.html, pages/) is built in P20-P36.
import { DISTRICTS, loadAll, upazilas, localAreas, areaContacts, search, norm } from './data.js';
import { loadLocations, getPosition, nearestPlace, mapsLink } from './location.js';

const T = {
  bn: {
    pilot: 'নোয়াখালী ও কক্সবাজার', lang: 'English', sos: 'বিপদে আগে ৯৯৯-এ কল করুন: পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স',
    whereEyebrow: 'আপনার এলাকার সরকারি নম্বর', where: 'আপনি কোথায় আছেন?', district: 'জেলা', upazila: 'উপজেলা',
    area: 'ইউনিয়ন বা পৌরসভা', wholeUpazila: 'পুরো উপজেলা', quick: 'দ্রুত বাছাই:', search: 'নাম, অফিস বা নম্বর দিয়ে খুঁজুন',
    loading: 'সরকারি তথ্য লোড হচ্ছে…', results: (n) => `${n}টি ফলাফল`, none: 'কিছু পাওয়া যায়নি। অন্য বানানে খুঁজুন।',
    call: 'কল', copy: 'কপি', copied: 'কপি হয়েছে', source: 'সরকারি উৎস', checked: 'যাচাই', ward: 'ওয়ার্ড',
    showAll: (n) => `সবাই দেখুন (${n})`, fallback: 'এই উপজেলার নম্বর প্রকাশিত নেই, তাই জেলার নম্বর দেখানো হচ্ছে।',
    noNumbers: 'এই ইউনিয়নের প্রতিনিধিদের নম্বর সরকারি সাইটে প্রকাশিত নেই। থানা, ইউএনও বা ৩৩৩-এ কল করুন।',
    groups: {
      emergency: ['জরুরি সেবা', 'সবার আগে'], police: ['পুলিশ', 'ফাঁড়ি ও থানা'], tourist_police: ['ট্যুরিস্ট পুলিশ', 'কক্সবাজার'],
      village_police: ['গ্রাম পুলিশ', 'ওয়ার্ড অনুযায়ী'], local: ['ইউনিয়ন পরিষদ', 'চেয়ারম্যান ও সদস্য'], town: ['পৌরসভা', 'প্রশাসক ও কর্মকর্তা'],
      coast: ['উপকূল ও নৌপথ', ''], administration: ['উপজেলা প্রশাসন', 'ইউএনও'], health: ['স্বাস্থ্য', 'হাসপাতাল'],
      fire: ['ফায়ার সার্ভিস', ''], women_children: ['নারী ও শিশু', 'সহায়তা'], disaster: ['দুর্যোগ', 'সতর্কবার্তা'], helplines: ['জাতীয় হেল্পলাইন', ''],
      info333: ['৩৩৩ তথ্য ও সেবা', 'অন্য নম্বর না পেলে'],
    },
    flags: { number_not_published: 'নম্বর প্রকাশিত নেই', source_older_than_2_years: 'পুরোনো তথ্য হতে পারে', older_union_page: 'পুরোনো পাতা',
      administrator_not_elected: 'প্রশাসক', number_shared_by_several_records: 'অফিস নম্বর', needs_manual_check: 'আবার যাচাই দরকার' },
    foot1: 'প্রতিটি নম্বর সরকারি *.gov.bd ওয়েবসাইট থেকে নেওয়া এবং ২২ অক্টোবর ২০২৬-এ আবার যাচাই করা। প্রতিটি কার্ডে উৎসের লিংক আছে।',
    foot2: 'SafeConnect প্রিভিউ · jerin101 ও tasmintoshi · বিপদে প্রথমে ৯৯৯।',
    foot3: 'ম্যাপ তথ্য: উপজেলার সীমানা ও ইউনিয়ন/পৌরসভার কেন্দ্রবিন্দু বাংলাদেশ পরিসংখ্যান ব্যুরো (BBS), OCHA HDX-এর মাধ্যমে (CC BY-IGO)। BBS-এর নাম না মিললে টুলগুলো OpenStreetMap-এর বিন্দু যোগ করতে পারে (© OpenStreetMap contributors, ODbL)।',
    locate: 'আমার কাছের সাহায্য দেখুন', locating: 'আপনার অবস্থান খোঁজা হচ্ছে…', orChoose: 'অথবা নিচে নিজে এলাকা বাছাই করুন',
    found: (name) => `আপনার এলাকা: ${name}। ভুল হলে নিচে বদলান।`, outside: 'আপনি নোয়াখালী বা কক্সবাজারের বাইরে আছেন। বিপদে ৯৯৯-এ কল করুন।',
    denied: 'লোকেশনের অনুমতি নেই। ফোনের সেটিংসে লোকেশন চালু করুন, অথবা নিচে এলাকা বাছাই করুন।',
    unavailable: 'লোকেশন পাওয়া যায়নি। খোলা জায়গায় গিয়ে আবার চেষ্টা করুন, অথবা নিচে এলাকা বাছাই করুন।',
    timeout: 'লোকেশন পেতে দেরি হচ্ছে। আবার চাপুন, অথবা নিচে এলাকা বাছাই করুন।', unsupported: 'এই ব্রাউজারে লোকেশন নেই। নিচে এলাকা বাছাই করুন।',
    myLoc: 'আমার অবস্থান', openMap: 'ম্যাপ', copyLoc: 'অবস্থান কপি', tell999: '৯৯৯-কে এই অবস্থান বলুন বা পরিবারকে পাঠান।',
    testTitle: 'পরীক্ষার জন্য অবস্থান (আপনি সেখানে না থাকলেও):', simulated: 'পরীক্ষামূলক অবস্থান',
    testNames: { chowmuhani: 'চৌমুহনী', inani: 'ইনানী সৈকত (জালিয়াপালং)', hatiya: 'হাতিয়া' },
  },
  en: {
    pilot: "Noakhali & Cox's Bazar", lang: 'বাংলা', sos: 'In danger, call 999 first: police, fire service, ambulance',
    whereEyebrow: 'Official numbers for your area', where: 'Where are you?', district: 'District', upazila: 'Upazila',
    area: 'Union or town', wholeUpazila: 'Whole upazila', quick: 'Quick picks:', search: 'Search by name, office or number',
    loading: 'Loading official data…', results: (n) => `${n} results`, none: 'Nothing found. Try another spelling.',
    call: 'Call', copy: 'Copy', copied: 'Copied', source: 'Official source', checked: 'Checked', ward: 'Ward',
    showAll: (n) => `Show all (${n})`, fallback: 'No number is published for this upazila, so district contacts are shown.',
    noNumbers: "This union's representatives have no published numbers. Call the police station, the UNO or 333.",
    groups: {
      emergency: ['Emergency', 'First'], police: ['Police', 'Outpost and station'], tourist_police: ['Tourist Police', "Cox's Bazar"],
      village_police: ['Village police', 'By ward'], local: ['Union council', 'Chairman and members'], town: ['Municipality', 'Administrator and officers'],
      coast: ['Coast and river', ''], administration: ['Upazila administration', 'UNO'], health: ['Health', 'Hospital'],
      fire: ['Fire service', ''], women_children: ['Women and children', 'Support'], disaster: ['Disaster', 'Warnings'], helplines: ['National helplines', ''],
      info333: ['333 information and services', 'If no other number works'],
    },
    flags: { number_not_published: 'Number not published', source_older_than_2_years: 'May be outdated', older_union_page: 'Older page',
      administrator_not_elected: 'Administrator', number_shared_by_several_records: 'Office number', needs_manual_check: 'Needs re-check' },
    foot1: 'Every number comes from an official *.gov.bd website and was re-checked on 22 October 2026. Each card links to its source.',
    foot2: 'SafeConnect preview · jerin101 & tasmintoshi · In danger, call 999 first.',
    foot3: 'Map data: upazila boundaries and union/town centre points from the Bangladesh Bureau of Statistics (BBS) via OCHA HDX (CC BY-IGO). Where BBS names do not match, the tools can add OpenStreetMap points (© OpenStreetMap contributors, ODbL).',
    locate: 'Find help near me', locating: 'Finding your location…', orChoose: 'Or choose your area below',
    found: (name) => `Your area: ${name}. If this is wrong, change it below.`, outside: "You're outside Noakhali and Cox's Bazar. In danger, call 999.",
    denied: 'Location is not allowed. Turn on location in your phone settings, or choose your area below.',
    unavailable: 'Could not get your location. Move to an open place and try again, or choose your area below.',
    timeout: 'Location is taking too long. Tap again, or choose your area below.', unsupported: 'This browser has no location. Choose your area below.',
    myLoc: 'My location', openMap: 'Map', copyLoc: 'Copy location', tell999: 'Tell 999 this location or send it to family.',
    testTitle: "Test location (even if you're not there):", simulated: 'Test location',
    testNames: { chowmuhani: 'Chowmuhani', inani: 'Inani beach (Jaliapalong)', hatiya: 'Hatiya' },
  },
};
const VISIBLE = { police: 6, tourist_police: 4, health: 4, administration: 4, fire: 3, local: 13, village_police: 12, helplines: 6 };

const $ = (id) => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
let lang = store.get('sc-lang') || 'bn';
let data = null;
let place = null;
let activePlaceNote = '';
let locations = null;

const t = () => T[lang];
const digits = (s) => (lang === 'bn' ? String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : String(s));
const fmtDate = (iso) => { try { return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)); } catch { return iso; } };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function setStaticText() {
  document.documentElement.lang = lang;
  const s = t();
  $('pilot').textContent = s.pilot; $('langBtn').textContent = s.lang; $('sosText').textContent = s.sos;
  $('whereEyebrow').textContent = s.whereEyebrow; $('whereTitle').textContent = s.where;
  $('lblDistrict').textContent = s.district; $('lblUpazila').textContent = s.upazila; $('lblArea').textContent = s.area;
  $('lblSearch').textContent = s.search; $('q').placeholder = s.search;
  $('call999').textContent = digits('999'); $('call999').setAttribute('aria-label', `${s.call} 999`);
  $('foot1').textContent = s.foot1; $('foot2').textContent = s.foot2; $('foot3').textContent = s.foot3;
  $('locateLabel').textContent = s.locate; $('orChoose').textContent = s.orChoose;
}

function fillSelect(sel, options, value) {
  sel.replaceChildren(...options.map(([v, label]) => { const o = el('option', null, label); o.value = v; return o; }));
  if (value != null && options.some(([v]) => v === value)) sel.value = value;
}

function areaKey(a) { return a ? `${a.type}|${a.bn}` : ''; }
const loadedDistricts = () => DISTRICTS.filter((d) => data.docs[d.key]);

// A saved place is used only if its district, upazila and area still exist in the data.
function validPlace(p) {
  const doc = p && data.docs[p.district];
  if (!doc || !upazilas(doc).some((u) => u.en === p.upazila)) return false;
  return !p.area || localAreas(doc, p.upazila).some((a) => areaKey(a) === areaKey(p.area));
}

function renderPickers() {
  fillSelect($('district'), loadedDistricts().map((d) => [d.key, lang === 'bn' ? d.bn : d.en]), place.district);
  const doc = data.docs[place.district];
  fillSelect($('upazila'), upazilas(doc).map((u) => [u.en, lang === 'bn' ? u.bn : u.en]), place.upazila);
  const areas = localAreas(doc, place.upazila);
  fillSelect($('area'), [['', t().wholeUpazila], ...areas.map((a) => [areaKey(a), a.type === 'municipality' ? `${a.bn} (${lang === 'bn' ? 'পৌরসভা' : 'town'})` : (lang === 'bn' || !a.en ? a.bn : a.en)])], areaKey(place.area));
  renderChips();
}

function quickPicks() {
  const picks = [];
  for (const d of loadedDistricts()) {
    const doc = data.docs[d.key];
    for (const p of doc.places) {
      const upz = upazilas(doc).find((u) => norm(u.bn) === norm(p.upazila_bn));
      if (upz) picks.push({ label: lang === 'bn' ? p.name_bn : p.name_en, place: { district: d.key, upazila: upz.en, area: { type: 'union', bn: norm(p.union_bn) } }, note: p });
    }
    for (const m of doc.municipalities) {
      picks.push({ label: norm(m.municipality_bn).split(/[\s,]/)[0], place: { district: d.key, upazila: m.upazila_en, area: { type: 'municipality', bn: norm(m.municipality_bn) } } });
    }
  }
  return picks;
}

function renderChips() {
  const box = $('chips');
  box.replaceChildren(el('span', 'label', t().quick));
  for (const pick of quickPicks()) {
    const b = el('button', 'chip', pick.label); b.type = 'button';
    b.setAttribute('aria-pressed', String(pick.place.district === place.district && pick.place.upazila === place.upazila && areaKey(pick.place.area) === areaKey(place.area)));
    b.addEventListener('click', () => { activePlaceNote = pick.note ? pick.note.how_to_report_bn : ''; choose(pick.place); });
    box.append(b);
  }
}

function card(r, showWhere) {
  const c = el('article', 'card');
  const name = r.kind === 'national' && lang === 'en' ? r.name_en : r.name_bn;
  c.append(el('h3', null, name || r.designation_bn || r.office_bn || '—'));   // some pages give no name or post
  if (name && r.designation_bn && r.designation_bn !== name) c.append(el('p', 'role', r.designation_bn));
  const whereBits = [r.office_bn, showWhere && [norm(r.upazila_bn), r.union_bn ? norm(r.union_bn) : '', r.district].filter(Boolean).join(' · ')].filter(Boolean);
  if (whereBits.length) c.append(el('p', 'where-line', whereBits.join(' — ')));
  const badges = el('div', 'badges');
  if (r.ward_no) badges.append(el('span', 'badge', `${t().ward} ${digits(r.ward_no)}`));
  if (r.toll_free) badges.append(el('span', 'badge', lang === 'bn' ? 'টোল ফ্রি' : 'Toll-free'));
  if (r.hours) badges.append(el('span', 'badge', r.hours === '24/7' ? (lang === 'bn' ? '২৪ ঘণ্টা' : '24 hours') : r.hours));
  for (const f of r.flags || []) if (t().flags[f]) badges.append(el('span', `badge${f.includes('older') || f.includes('not_published') || f === 'needs_manual_check' ? ' warn' : ''}`, t().flags[f]));
  if (badges.children.length) c.append(badges);
  if (r.phones && r.phones.length) {
    const ph = el('div', 'phones');
    for (const p of r.phones) {
      const row = el('div', 'phone');
      row.append(el('span', 'num', digits(p)));
      const call = el('a', 'btn call', t().call); call.href = `tel:${p}`; row.append(call);
      const copy = el('button', 'btn', t().copy); copy.type = 'button';
      copy.addEventListener('click', () => {
        const done = () => { copy.textContent = t().copied; setTimeout(() => { copy.textContent = t().copy; }, 1400); };
        navigator.clipboard?.writeText(p).then(done, () => { const s = window.getSelection(); const rg = document.createRange(); rg.selectNodeContents(row.firstChild); s.removeAllRanges(); s.addRange(rg); });
      });
      row.append(copy);
      ph.append(row);
    }
    c.append(ph);
  }
  const src = el('p', 'src');
  const a = el('a', null, `${t().source} ↗`); a.href = r.source_url; a.target = '_blank'; a.rel = 'noopener';
  src.append(a, ` · ${t().checked} ${fmtDate(r.script_check?.on || r.checked_on || r.retrieved_on)}`);
  c.append(src);
  return c;
}

function renderGroups() {
  const out = $('results');
  out.replaceChildren();
  if (activePlaceNote) out.append(el('p', 'place-note', activePlaceNote));
  areaContacts(data, place).forEach((g, i) => {
    const sec = el('section', 'group');
    const head = el('div', 'group-head');
    const [title, sub] = t().groups[g.id];
    head.append(el('span', 'step', digits(i + 1)), el('h2', null, title));
    if (sub) head.append(el('span', 'sub', sub));
    sec.append(head);
    if (g.fallback) sec.append(el('p', 'note', t().fallback));
    if (g.noNumbers) sec.append(el('p', 'note', t().noNumbers));
    const cards = el('div', 'cards');
    const limit = VISIBLE[g.id] || 99;
    g.items.forEach((r, k) => { const c = card(r, false); if (k >= limit) c.hidden = true; cards.append(c); });
    sec.append(cards);
    if (g.items.length > limit) {
      const more = el('button', 'btn more', t().showAll(g.items.length)); more.type = 'button';
      more.addEventListener('click', () => { cards.querySelectorAll('.card[hidden]').forEach((c) => { c.hidden = false; }); more.remove(); });
      sec.append(more);
    }
    out.append(sec);
  });
  $('status').textContent = '';
}

function renderSearch(q) {
  const hits = search(data, q);
  $('status').textContent = hits.length ? t().results(digits(hits.length)) : t().none;
  const cards = el('div', 'cards');
  hits.forEach((r) => cards.append(card(r, r.kind !== 'national')));
  $('results').replaceChildren(cards);
}

function render() {
  setStaticText();
  renderPickers();
  const q = $('q').value.trim();
  if (q.length >= 2) renderSearch(q); else renderGroups();
}

function choose(next) {
  place = next;
  store.set('sc-place', JSON.stringify(place));
  $('q').value = '';
  render();
}

// ---- "Find help near me" (P26). Location is read only after a tap (CLAUDE.md rule 5),
// and the lookup happens on the phone with data/locations.json (works offline).

function showStatus(text, bad = false) {
  const st = $('locateStatus');
  st.textContent = text;
  st.classList.toggle('bad', bad);
}

function showMyLocation(pos, simulated) {
  const box = $('myLoc');
  const coords = `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}`;
  const link = mapsLink(pos);
  const label = el('span', 'coords', `${simulated ? t().simulated : t().myLoc}: ${digits(coords)}`);
  const map = el('a', 'btn', t().openMap); map.href = link; map.target = '_blank'; map.rel = 'noopener';
  const copy = el('button', 'btn', t().copyLoc); copy.type = 'button';
  copy.addEventListener('click', () => {
    navigator.clipboard?.writeText(`${coords} ${link}`).then(() => { copy.textContent = t().copied; }, () => {});
  });
  box.replaceChildren(label, map, copy, el('span', 'where-line', t().tell999));
  box.hidden = false;
}

function applyPosition(pos, simulated = false) {
  showMyLocation(pos, simulated);
  const found = locations && nearestPlace(locations, pos);
  if (!found || !data.docs[found.district]) { showStatus(t().outside, true); return; }
  const doc = data.docs[found.district];
  const placeHere = found.area && doc.places.find((p) => norm(p.union_bn) === found.area.bn);
  activePlaceNote = placeHere ? placeHere.how_to_report_bn : '';
  const upz = upazilas(doc).find((u) => u.en === found.upazila);
  const name = found.area ? found.area.bn : (lang === 'bn' && upz ? upz.bn : found.upazila);
  showStatus(t().found(name));
  choose({ district: found.district, upazila: found.upazila, area: found.area });
}

// Test locations for the preview page: official centre points from data/locations.json,
// moved a few hundred metres so they act like a real GPS reading. No coordinates are typed in.
function showTestLocations() {
  if (!locations) return;
  const box = $('testLocs');
  const picks = [
    ['chowmuhani', locations.municipalities.find((m) => norm(m.municipality_bn).includes(norm('চৌমুহনী')))],
    ['inani', locations.unions.find((u) => u.union_en === 'Jaliapalong')],
    ['hatiya', locations.unions.find((u) => u.district === 'Noakhali' && u.upazila_en === 'Hatiya')],
  ].filter(([, p]) => p);
  box.replaceChildren(el('span', 'label', t().testTitle));
  for (const [key, p] of picks) {
    const b = el('button', 'chip', t().testNames[key]); b.type = 'button';
    b.addEventListener('click', () => applyPosition({ lat: p.lat + 0.004, lon: p.lon - 0.003 }, true));
    box.append(b);
  }
  box.hidden = false;
}

async function locate() {
  const btn = $('locateBtn');
  btn.setAttribute('aria-busy', 'true');
  showStatus(t().locating);
  try {
    applyPosition(await getPosition());
  } catch (err) {
    showStatus(t()[err.code] || t().unavailable, true);
  } finally {
    btn.removeAttribute('aria-busy');
  }
}

$('locateBtn').addEventListener('click', locate);

$('district').addEventListener('change', (e) => {
  activePlaceNote = '';
  const doc = data.docs[e.target.value];
  choose({ district: e.target.value, upazila: upazilas(doc)[0].en, area: null });
});
$('upazila').addEventListener('change', (e) => { activePlaceNote = ''; choose({ ...place, upazila: e.target.value, area: null }); });
$('area').addEventListener('change', (e) => {
  activePlaceNote = '';
  const [type, ...rest] = e.target.value.split('|');
  choose({ ...place, area: type ? { type, bn: rest.join('|') } : null });
});
$('q').addEventListener('input', () => { const q = $('q').value.trim(); if (q.length >= 2) renderSearch(q); else renderGroups(); });
$('langBtn').addEventListener('click', () => { lang = lang === 'bn' ? 'en' : 'bn'; store.set('sc-lang', lang); render(); showTestLocations(); });
$('themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
});

setStaticText();
$('status').textContent = t().loading;
try {
  [data, locations] = await Promise.all([loadAll('data/'), loadLocations('data/').catch(() => null)]);
  const first = loadedDistricts()[0];
  if (!first) throw new Error('No district data could be loaded');
  let saved = null;
  try { saved = JSON.parse(store.get('sc-place') || 'null'); } catch {}
  const town = data.docs.noakhali && localAreas(data.docs.noakhali, 'Begumganj').find((a) => a.type === 'municipality');
  const start = data.docs.noakhali
    ? { district: 'noakhali', upazila: 'Begumganj', area: town || null }
    : { district: first.key, upazila: upazilas(data.docs[first.key])[0].en, area: null };
  place = validPlace(saved) ? saved : start;
  render();
  showTestLocations();          // no automatic GPS on open: location only after a tap
  if (data.missing.length) $('status').textContent = `Could not load: ${data.missing.join(', ')}. Showing the rest.`;
} catch (err) {
  $('status').textContent = `${err.message}. Please reload the page.`;
}
