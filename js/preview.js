// Logic for preview.html (P23, P26): home with two big actions + area search, area page with a call-first list.
// The real site (index.html, pages/) is built in P20-P36. Location is read only after a tap (CLAUDE.md rule 5).
import { DISTRICTS, loadAll, upazilas, localAreas, areaContacts, norm, areaIndex as buildAreaIndex, findAreas } from './data.js';
import { loadLocations, getPosition, nearestPlace, mapsLink } from './location.js';

const T = {
  bn: {
    lang: 'English', hello: 'বিপদে আছেন?',
    call999: '৯৯৯-এ কল করুন', call999Sub: 'পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স · বিনা খরচে',
    locate: 'আমার কাছের সাহায্য', locateSub: 'আপনার এলাকার থানা, চেয়ারম্যান ও গ্রাম পুলিশের নম্বর · ইন্টারনেট ছাড়াও চলে',
    locating: 'আপনার অবস্থান খোঁজা হচ্ছে…', or: 'অথবা',
    areaLabel: 'এলাকার নাম লিখুন', areaHint: 'গ্রাম, ইউনিয়ন, পৌরসভা বা উপজেলা — বাংলা বা ইংরেজিতে, যেকোনো বানানে। যেমন: চৌমুহনী, Hatiya, ইনানী',
    noMatch: 'এই নামে কোনো জায়গা তালিকায় নেই। তবুও সাহায্য পাবেন:', didYouMean: 'কাছাকাছি নাম', noExact: 'ঠিক এই বানানে পাইনি। নিচের কোনোটি কি আপনার জায়গা?',
    tellUs: 'আপনার জায়গার নাম তালিকায় না থাকলে আমাদের জানান, আমরা যোগ করব।', pickUpazila: 'আপনার উপজেলা বেছে নিন। থানা ও ইউএনও-র নম্বর সেখানেই পাবেন।',
    call999: '৯৯৯-এ কল', kinds: { municipality: 'পৌরসভা', place: 'জায়গা', union: 'ইউনিয়ন', village: 'গ্রাম', upazila: 'উপজেলা', local: 'স্থানীয় নাম' },
    recent: (n) => `আগের এলাকা: ${n}`,
    denied: 'লোকেশনের অনুমতি নেই। ফোনের সেটিংসে লোকেশন চালু করুন, অথবা নিচে এলাকার নাম লিখুন।',
    unavailable: 'লোকেশন পাওয়া যায়নি। খোলা জায়গায় গিয়ে আবার চাপুন, অথবা নিচে এলাকার নাম লিখুন।',
    timeout: 'লোকেশন পেতে দেরি হচ্ছে। আবার চাপুন, অথবা নিচে এলাকার নাম লিখুন।',
    unsupported: 'এই ব্রাউজারে লোকেশন নেই। নিচে এলাকার নাম লিখুন।',
    demo: 'পরীক্ষা (ডেমো): ধরে নিন আপনি এখানে আছেন। আসল ব্যবহারে এই অংশ থাকবে না।',
    back: '← শুরুতে ফিরুন', youAreIn: 'আপনি আছেন', change: 'এলাকা বদলান', town: 'পৌরসভা', wholeUpazila: 'পুরো উপজেলা',
    shareTitle: 'পরিবারকে আপনার অবস্থান পাঠান', shareText: 'একটি চাপেই ম্যাপ লিংকসহ বার্তা যাবে। ৯৯৯-কেও এই অবস্থান বলতে পারেন।',
    shareMsg: (link) => `আমি বিপদে আছি। আমার অবস্থান: ${link}`, copy: 'কপি', copied: 'কপি হয়েছে', map: 'ম্যাপ',
    outsideTitle: 'আপনার অবস্থান', outside: 'আপনি নোয়াখালী বা কক্সবাজারের বাইরে আছেন। SafeConnect এখন শুধু এই দুই জেলার স্থানীয় নম্বর দেখায়। নিচের জাতীয় নম্বরগুলো সারা দেশে কাজ করে।',
    first: 'আগে এদের কল করুন', more: 'আরও সাহায্য', showAll: (n) => `সবাইকে দেখুন (${n})`,
    call: 'কল', ward: 'ওয়ার্ড', source: 'সরকারি উৎস', checked: 'যাচাই',
    what: { emergency: 'জরুরি সেবা', police: 'পুলিশ', local: 'ইউনিয়ন পরিষদ', town: 'পৌরসভা', administration: 'উপজেলা নির্বাহী অফিসার', tourist_police: 'ট্যুরিস্ট পুলিশ' },
    groups: { police: 'পুলিশ', tourist_police: 'ট্যুরিস্ট পুলিশ', village_police: 'গ্রাম পুলিশ (ওয়ার্ড অনুযায়ী)', local: 'চেয়ারম্যান ও মেম্বার', town: 'পৌরসভা',
      coast: 'উপকূল ও নৌপথ', administration: 'উপজেলা প্রশাসন (ইউএনও)', health: 'হাসপাতাল ও স্বাস্থ্য', fire: 'ফায়ার সার্ভিস', women_children: 'নারী ও শিশু সহায়তা',
      disaster: 'দুর্যোগ', helplines: 'জাতীয় হেল্পলাইন', info333: 'তথ্য ও সেবা (৩৩৩)' },
    fallback: 'এই উপজেলার নম্বর প্রকাশিত নেই, তাই জেলার নম্বর দেখানো হচ্ছে।',
    noNumbers: 'এই ইউনিয়নের প্রতিনিধিদের নম্বর সরকারি সাইটে নেই। থানা বা ইউএনও-কে কল করুন।',
    flags: { number_not_published: 'নম্বর প্রকাশিত নেই', source_older_than_2_years: 'পুরোনো তথ্য হতে পারে', needs_manual_check: 'যাচাই বাকি',
      administrator_not_elected: 'প্রশাসক' },
    foot1: 'সব নম্বর সরকারি *.gov.bd ওয়েবসাইট থেকে নেওয়া। প্রতিটি নম্বরের নিচে উৎসের লিংক আছে। বিপদে প্রথমে ৯৯৯।',
    foot2: 'ম্যাপ তথ্য: উপজেলার সীমানা ও ইউনিয়ন/পৌরসভার কেন্দ্রবিন্দু বাংলাদেশ পরিসংখ্যান ব্যুরো (BBS), OCHA HDX-এর মাধ্যমে (CC BY-IGO)। BBS-এর নাম না মিললে টুলগুলো OpenStreetMap-এর বিন্দু যোগ করতে পারে (© OpenStreetMap contributors, ODbL)।',
    testsLink: 'সার্চ টেস্ট (ডেভেলপারদের জন্য)',
  },
  en: {
    lang: 'বাংলা', hello: 'Need help?',
    call999: 'Call 999', call999Sub: 'Police, fire service, ambulance · free',
    locate: 'Find help near me', locateSub: 'Numbers for your police station, chairman and village police · works without internet',
    locating: 'Finding your location…', or: 'or',
    areaLabel: 'Type your area', areaHint: 'Village, union, town or upazila, in Bangla or English. For example: Chowmuhani, হাতিয়া, Inani',
    noMatch: 'This name is not in our list yet. You can still get help:', didYouMean: 'Similar names', noExact: 'Not found with this exact spelling. Is it one of these?',
    tellUs: 'If your place is missing, tell us and we will add it.', pickUpazila: 'Pick your upazila. Its police station and UNO numbers are there.',
    call999: 'Call 999', kinds: { municipality: 'town', place: 'place', union: 'union', village: 'village', upazila: 'upazila', local: 'local name' },
    recent: (n) => `Last area: ${n}`,
    denied: 'Location is not allowed. Turn on location in your phone settings, or type your area below.',
    unavailable: 'Could not get your location. Move to an open place and tap again, or type your area below.',
    timeout: 'Location is taking too long. Tap again, or type your area below.',
    unsupported: 'This browser has no location. Type your area below.',
    demo: 'Test (demo): pretend you are here. Real users will not see this part.',
    back: '← Back to start', youAreIn: 'You are in', change: 'Change area', town: 'town', wholeUpazila: 'whole upazila',
    shareTitle: 'Send your location to family', shareText: 'One tap sends a message with a map link. You can also tell 999 this location.',
    shareMsg: (link) => `I am in danger. My location: ${link}`, copy: 'Copy', copied: 'Copied', map: 'Map',
    outsideTitle: 'Your location', outside: "You are outside Noakhali and Cox's Bazar. SafeConnect shows local numbers only for these two districts for now. The national numbers below work everywhere.",
    first: 'Call these first', more: 'More help', showAll: (n) => `Show all (${n})`,
    call: 'Call', ward: 'Ward', source: 'Official source', checked: 'Checked',
    what: { emergency: 'Emergency', police: 'Police station', local: 'Union council', town: 'Municipality', administration: 'Upazila officer (UNO)', tourist_police: 'Tourist Police' },
    groups: { police: 'Police', tourist_police: 'Tourist Police', village_police: 'Village police (by ward)', local: 'Chairman and members', town: 'Municipality',
      coast: 'Coast and river', administration: 'Upazila administration (UNO)', health: 'Hospital and health', fire: 'Fire service', women_children: 'Women and children',
      disaster: 'Disaster', helplines: 'National helplines', info333: 'Information and services (333)' },
    fallback: 'No number is published for this upazila, so district numbers are shown.',
    noNumbers: "This union's representatives have no published numbers. Call the police station or the UNO.",
    flags: { number_not_published: 'Number not published', source_older_than_2_years: 'May be outdated', needs_manual_check: 'Not checked yet',
      administrator_not_elected: 'Administrator' },
    foot1: 'All numbers come from official *.gov.bd websites. Each number links to its source. In danger, call 999 first.',
    foot2: 'Map data: upazila boundaries and union/town centre points from the Bangladesh Bureau of Statistics (BBS) via OCHA HDX (CC BY-IGO). Where BBS names do not match, the tools can add OpenStreetMap points (© OpenStreetMap contributors, ODbL).',
    testsLink: 'Search tests (for developers)',
  },
};
const NATIONAL_EVERYWHERE = ['national-emergency-999', 'women-children-violence-109', 'child-helpline-1098', 'health-call-centre-16263', 'fire-service-102', 'info-service-333'];
const VISIBLE = 6;

const $ = (id) => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
let lang = store.get('sc-lang') || 'bn';
let data = null, locations = null, current = null, areaIndex = [];
const t = () => T[lang];
const digits = (s) => (lang === 'bn' ? String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : String(s));
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const withPhone = (r) => r.phones && r.phones.length > 0;
const fmtDate = (iso) => { try { return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)); } catch { return iso; } };

/* ---------- names ---------- */
const districtOf = (key) => DISTRICTS.find((d) => d.key === key);
function upazilaName(dkey, en) {
  const u = upazilas(data.docs[dkey]).find((x) => x.en === en);
  return lang === 'bn' && u ? u.bn : en;
}
function areaName(a) {
  if (!a) return '';
  if (lang === 'en' && a.en) return a.en;
  return a.type === 'municipality' ? a.bn.split(/[,،]/)[0].trim() : a.bn;
}
function placeTitle(p) {
  if (p.label) return p.label;
  return p.area ? areaName(p.area) : `${upazilaName(p.district, p.upazila)} (${t().wholeUpazila})`;
}
function placeSub(p) {
  const d = districtOf(p.district);
  const parts = p.area ? [upazilaName(p.district, p.upazila)] : [];
  parts.push(lang === 'bn' ? d.bn : d.en);
  return parts.join(', ');
}

/* ---------- area search: any spelling, Bangla or English, never a dead end (design; search code in data.js) ---------- */
function itemLabel(h) {
  const p = { ...h.place };
  const named = h.named && (lang === 'bn' ? h.named.name_bn : h.named.name_en || h.named.name_bn);
  if (named) p.label = named;
  const kindWord = t().kinds[h.kind] || '';
  let title;
  if (h.kind === 'village') title = h.village;
  else if (named) title = named;
  else if (h.place.area) title = areaName(h.place.area);
  else title = upazilaName(p.district, p.upazila);
  if (h.kind === 'village') p.label = `${h.village} (${kindWord})`;
  const where = (h.kind === 'village' || h.kind === 'local') && h.place.area ? `${areaName(h.place.area)}, ` : '';
  const ward = h.ward ? ` · ${t().ward} ${digits(h.ward)}` : '';
  return { p, title: `${title} (${kindWord})`, sub: where + placeSub(p) + ward };
}
function suggestButton(h) {
  const li = el('li');
  const b = el('button'); b.type = 'button';
  const { p, title, sub } = itemLabel(h);
  b.append(el('b', null, title), el('span', null, sub));
  b.addEventListener('click', () => openArea(p, null));
  li.append(b);
  return li;
}
function renderSuggest() {
  const q = $('areaInput').value;
  const box = $('suggest');
  if (norm(q).length < 2) { box.hidden = true; return; }
  const { hits, close } = findAreas(areaIndex, q);
  if (hits.length) { box.replaceChildren(...hits.map(suggestButton)); box.hidden = false; return; }
  // Never a dead end: similar names, then the upazila list, then GPS and 999.
  const s = t();
  const parts = [el('li', 'none', close.length ? s.noExact : s.noMatch)];
  if (close.length) { parts.push(el('li', 'group', s.didYouMean)); close.forEach((h) => parts.push(suggestButton(h))); }
  const ups = el('li', 'fallback-box');
  ups.append(el('p', null, s.pickUpazila));
  const chips = el('div', 'chips');
  for (const d of DISTRICTS) {
    const doc = data.docs[d.key]; if (!doc) continue;
    for (const u of upazilas(doc)) {
      const c = el('button', 'chip', lang === 'bn' ? u.bn : u.en); c.type = 'button';
      c.addEventListener('click', () => openArea({ district: d.key, upazila: u.en, area: null }, null));
      chips.append(c);
    }
  }
  ups.append(chips);
  const row = el('div', 'tools');
  const gps = el('button', 'btn violet', s.locate); gps.type = 'button'; gps.addEventListener('click', locate);
  const call = el('a', 'btn', s.call999); call.href = 'tel:999';
  row.append(gps, call);
  ups.append(row, el('p', 'privacy', s.tellUs));
  parts.push(ups);
  box.replaceChildren(...parts);
  box.hidden = false;
}

/* ---------- contacts ---------- */
function callLink(num, label, red = false) {
  const a = el('a', `call${red ? ' red' : ''}`);
  a.href = `tel:${num}`;
  a.append(el('small', null, label), document.createTextNode(digits(num)));
  return a;
}
function personRow(r) {
  const row = el('div', 'person');
  const info = el('div');
  const nm = r.kind === 'national' && lang === 'en' ? r.name_en : r.name_bn;
  info.append(el('span', 'name', nm || r.designation_bn || r.office_bn || '—'));   // some pages give no name or post
  const role = [nm && r.designation_bn !== nm ? r.designation_bn : '', r.office_bn].filter(Boolean).join(' · ');
  if (role && r.kind !== 'national') info.append(el('span', 'role', role));
  const tags = el('div', 'tags');
  if (r.ward_no) tags.append(el('span', 'tag', `${t().ward} ${digits(r.ward_no)}`));
  for (const f of r.flags || []) if (t().flags[f]) tags.append(el('span', 'tag warn', t().flags[f]));
  if (tags.children.length) info.append(tags);
  row.append(info);
  const calls = el('div', 'calls');
  (r.phones || []).slice(0, 2).forEach((p) => calls.append(callLink(p, t().call)));
  row.append(calls);
  if (r.source_url) {
    const src = el('p', 'src');
    const a = el('a', null, `${t().source} ↗`); a.href = r.source_url; a.target = '_blank'; a.rel = 'noopener';
    src.append(a, ` · ${t().checked} ${fmtDate(r.script_check?.on || r.checked_on || r.retrieved_on)}`);
    row.append(src);
  }
  return row;
}
function firstRow(what, r, red = false) {
  const row = el('div', 'first-row');
  const info = el('div');
  info.append(el('span', 'what', what));
  const who = r.kind === 'national' ? (lang === 'en' ? r.name_en : r.name_bn) : [r.name_bn, r.designation_bn].filter(Boolean).join(', ');
  info.append(el('span', 'who', who));
  if (r.source_url) {                     // every number shows its source and check date (CLAUDE.md data rules)
    const src = el('span', 'src');
    const a = el('a', null, `${t().source} ↗`); a.href = r.source_url; a.target = '_blank'; a.rel = 'noopener';
    src.append(a, ` · ${t().checked} ${fmtDate(r.script_check?.on || r.checked_on || r.retrieved_on)}`);
    info.append(src);
  }
  row.append(info, callLink(r.phones[0], t().call, red));
  return row;
}

function renderArea() {
  const p = current.place;
  const groups = p.outside ? null : areaContacts(data, p);
  $('youAreIn').textContent = p.outside ? t().outsideTitle : t().youAreIn;
  $('placeName').textContent = p.outside ? `${digits(current.pos.lat.toFixed(4))}, ${digits(current.pos.lon.toFixed(4))}` : placeTitle(p);
  $('placeSub').textContent = p.outside ? '' : placeSub(p);
  $('outside').hidden = !p.outside;
  $('outside').textContent = t().outside;

  const note = p.placeId && data.docs[p.district].places.find((x) => x.id === p.placeId);
  $('placeNote').hidden = !note;
  if (note) $('placeNote').textContent = note.how_to_report_bn;

  // share
  $('share').hidden = !current.pos;
  if (current.pos) {
    const link = mapsLink(current.pos);
    const msg = t().shareMsg(link);
    const wa = el('a', 'btn', 'WhatsApp'); wa.href = `https://wa.me/?text=${encodeURIComponent(msg)}`; wa.target = '_blank'; wa.rel = 'noopener';
    const sms = el('a', 'btn', 'SMS'); sms.href = `sms:?&body=${encodeURIComponent(msg)}`;
    const map = el('a', 'btn', t().map); map.href = link; map.target = '_blank'; map.rel = 'noopener';
    const copy = el('button', 'btn', t().copy); copy.type = 'button';
    copy.addEventListener('click', () => navigator.clipboard?.writeText(msg).then(() => { copy.textContent = t().copied; }, () => {}));
    $('shareBtns').replaceChildren(wa, sms, copy, map);
  }

  // call these first
  const first = $('firstList');
  first.replaceChildren();
  const nat = (id) => data.national.find((n) => n.id === id);
  first.append(firstRow(t().what.emergency, nat('national-emergency-999'), true));
  if (groups) {
    const g = (id) => groups.find((x) => x.id === id);
    const pick = (id) => (g(id)?.items || []).find((r) => withPhone(r) && r.kind !== 'national');
    const police = pick('police');
    if (police) first.append(firstRow(t().what.police, police));
    if (p.area && pick('tourist_police') && p.district === 'coxsbazar') first.append(firstRow(t().what.tourist_police, nat('tourist-police-helpline')));
    const local = p.area?.type === 'municipality' ? pick('town') : pick('local');
    if (local) first.append(firstRow(p.area?.type === 'municipality' ? t().what.town : t().what.local, local));
    else { const uno = pick('administration'); if (uno) first.append(firstRow(t().what.administration, uno)); }
  }

  // more help
  const more = $('moreList');
  more.replaceChildren();
  const list = groups
    ? groups.filter((gr) => gr.id !== 'emergency')
    : [{ id: 'helplines', items: NATIONAL_EVERYWHERE.slice(1).map(nat).filter(Boolean) }];
  for (const gr of list) {
    const items = gr.items;
    const callable = items.filter(withPhone).length;
    const d = el('details', 'cat');
    const s = el('summary');
    s.append(el('span', null, t().groups[gr.id] || gr.id), el('span', 'count', digits(callable)));
    d.append(s);
    const body = el('div', 'cat-body');
    if (gr.fallback) body.append(el('p', 'fallback', t().fallback));
    if (gr.noNumbers) body.append(el('p', 'fallback', t().noNumbers));
    const sorted = [...items].sort((a, b) => withPhone(b) - withPhone(a));
    sorted.forEach((r, i) => { const row = personRow(r); if (i >= VISIBLE) row.hidden = true; body.append(row); });
    if (sorted.length > VISIBLE) {
      const b = el('button', 'btn showall', t().showAll(digits(sorted.length))); b.type = 'button';
      b.addEventListener('click', () => { body.querySelectorAll('.person[hidden]').forEach((x) => { x.hidden = false; }); b.remove(); });
      body.append(b);
    }
    d.append(body);
    more.append(d);
  }
  if (!groups) more.firstChild.open = true;
}

/* ---------- views ---------- */
function showView(name) {
  $('home').hidden = name !== 'home';
  $('area').hidden = name !== 'area';
  window.scrollTo(0, 0);
}
function openArea(place, pos) {
  current = { place, pos };
  if (!place.outside) store.set('sc-last', JSON.stringify(place));
  renderArea();
  showView('area');
}
function goHome() {
  $('areaInput').value = '';
  $('suggest').hidden = true;
  renderRecent();
  showView('home');
}
function renderRecent() {
  let last = null;
  try { last = JSON.parse(store.get('sc-last') || 'null'); } catch {}
  const b = $('recentBtn');
  if (!last || !data.docs[last.district]) { b.hidden = true; return; }
  b.textContent = t().recent(placeTitle(last));
  b.onclick = () => openArea(last, null);
  b.hidden = false;
}

/* ---------- location ---------- */
function msg(text) { $('locMsg').textContent = text; $('locMsg').hidden = !text; }
function applyPosition(pos) {
  const found = locations && nearestPlace(locations, pos);
  if (!found) { openArea({ outside: true }, pos); return; }
  const place = { district: found.district, upazila: found.upazila, area: found.area };
  const doc = data.docs[found.district];
  const named = found.area && (doc.places || []).find((x) => norm(x.union_bn) === found.area.bn);
  if (named) place.placeId = named.id;
  if (found.area) {
    const full = localAreas(doc, found.upazila).find((a) => a.type === found.area.type && a.bn === found.area.bn);
    if (full) place.area = full;
  }
  openArea(place, pos);
}
function showDemo() {
  if (!locations) return;
  const picks = [
    [locations.municipalities.find((m) => m.municipality_bn.includes('চৌমুহনী')), { bn: 'চৌমুহনী', en: 'Chowmuhani' }],
    [locations.unions.find((u) => u.union_en === 'Jaliapalong'), { bn: 'ইনানী সৈকত', en: 'Inani beach' }],
    [locations.unions.find((u) => u.district === 'Noakhali' && u.upazila_en === 'Hatiya'), { bn: 'হাতিয়া', en: 'Hatiya' }],
    [{ lat: 23.8103, lon: 90.4125 }, { bn: 'ঢাকা (জেলার বাইরে)', en: 'Dhaka (outside)' }],
  ].filter(([p]) => p);
  $('demoText').textContent = t().demo;
  $('demoChips').replaceChildren(...picks.map(([p, name]) => {
    const b = el('button', 'chip', name[lang]); b.type = 'button';
    b.addEventListener('click', () => applyPosition({ lat: p.lat + 0.004, lon: p.lon - 0.003 }));
    return b;
  }));
  $('demo').hidden = false;
}
async function locate() {
  const btn = $('locateBtn');
  btn.setAttribute('aria-busy', 'true');
  msg(t().locating);
  try {
    const pos = await getPosition();
    msg('');
    applyPosition(pos);
  } catch (err) {
    msg(t()[err.code] || t().unavailable);
    showDemo();
  } finally {
    btn.removeAttribute('aria-busy');
  }
}

/* ---------- text ---------- */
function setText() {
  const s = t();
  document.documentElement.lang = lang;
  $('langBtn').textContent = s.lang;
  $('hello').textContent = s.hello;
  $('call999Title').textContent = s.call999; $('call999Sub').textContent = s.call999Sub;
  $('locateTitle').textContent = s.locate; $('locateSub').textContent = s.locateSub;
  $('orText').textContent = s.or;
  $('areaLabel').textContent = s.areaLabel; $('areaHint').textContent = s.areaHint; $('areaInput').placeholder = s.areaLabel;
  $('backBtn').textContent = s.back; $('changeBtn').textContent = s.change;
  $('shareTitle').textContent = s.shareTitle; $('shareText').textContent = s.shareText;
  $('firstTitle').textContent = s.first; $('moreTitle').textContent = s.more;
  $('foot1').textContent = s.foot1; $('foot2').textContent = s.foot2; $('testsLink').textContent = s.testsLink;
}

$('locateBtn').addEventListener('click', locate);
$('areaInput').addEventListener('input', renderSuggest);
$('backBtn').addEventListener('click', goHome);
$('homeBtn').addEventListener('click', goHome);
$('changeBtn').addEventListener('click', () => { goHome(); $('areaInput').focus(); });
$('langBtn').addEventListener('click', () => {
  lang = lang === 'bn' ? 'en' : 'bn';
  store.set('sc-lang', lang);
  setText();
  if (!$('demo').hidden) showDemo();
  if (data) { renderRecent(); renderSuggest(); if (current) renderArea(); }
});
$('themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
});

setText();
try {
  [data, locations] = await Promise.all([loadAll('data/'), loadLocations('data/').catch(() => null)]);
  areaIndex = buildAreaIndex(data);
  renderRecent();
} catch (err) {
  msg(`${err.message}. Please reload the page.`);
}
