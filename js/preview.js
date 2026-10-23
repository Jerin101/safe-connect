// Logic for preview.html: the portal design (issues #38, #42; rules in docs/DESIGN.md). The real site (index.html, pages/) is built in P20-P36.
// Location is read only after a tap (CLAUDE.md rule 5). The area search lives in data.js (issue #36).
import { DISTRICTS, loadAll, upazilas, localAreas, areaContacts, norm, areaIndex as buildAreaIndex, findAreas } from './data.js';
import { loadLocations, getPosition, nearestPlace, mapsLink } from './location.js';

const T = {
  bn: {
    lang: 'EN', hello1: 'বিপদে আছেন?', hello2: 'শান্ত থাকুন। আপনার এলাকার সরকারি নম্বর এখানেই আছে।',
    eyebrow: 'নোয়াখালী ও কক্সবাজারের সরকারি নম্বর', h999: '৯৯৯',
    lead: 'আপনার ইউনিয়নের থানা, চেয়ারম্যান, গ্রাম পুলিশ ও হাসপাতালের সরকারি নম্বর। সব সরকারি ওয়েবসাইট থেকে নেওয়া, প্রতি সপ্তাহে উৎস আবার মিলিয়ে দেখা হয়।',
    distAll: 'সব জেলা',
    stats: ['সরকারি নম্বর', 'ইউনিয়ন ও পৌরসভা', 'উপজেলা', 'যাচাই করা হয়েছে'],
    quickEyebrow: 'দ্রুত যান', quickTitle: 'পরিচিত জায়গা', quickText: 'এক চাপে সেই এলাকার থানা ও জরুরি নম্বর দেখুন।',
    places: { chowmuhani: ['চৌমুহনী', 'বেগমগঞ্জ, নোয়াখালী'], inani: ['ইনানী সৈকত', 'উখিয়া, কক্সবাজার'], hatiya: ['হাতিয়া', 'দ্বীপ উপজেলা, নোয়াখালী'], coxtown: ['কক্সবাজার শহর', 'পৌরসভা'] },
    call999: '৯৯৯-এ কল করুন', call999Sub: 'পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স · বিনা খরচে',
    locate: 'আমার কাছের সাহায্য', locateSub: 'আপনার এলাকার থানা, চেয়ারম্যান ও গ্রাম পুলিশের নম্বর · পাতা খোলা থাকলে ইন্টারনেট ছাড়াও চলে',
    locating: 'আপনার অবস্থান খোঁজা হচ্ছে…', or: 'অথবা',
    areaLabel: 'এলাকার নাম লিখুন', areaHint: 'গ্রাম, ইউনিয়ন, পৌরসভা বা উপজেলা, বাংলা বা ইংরেজিতে, যেকোনো বানানে। যেমন: চৌমুহনী, Hatiya, ইনানী',
    noMatch: 'এই নামে কোনো জায়গা তালিকায় নেই। তবুও সাহায্য পাবেন:', didYouMean: 'কাছাকাছি নাম', noExact: 'ঠিক এই বানানে পাইনি। নিচের কোনোটি কি আপনার জায়গা?', tellUs: 'আপনার জায়গার নাম তালিকায় না থাকলে নিচের "ভুল নম্বর জানান" দিয়ে জানান (GitHub অ্যাকাউন্ট লাগবে)।',
    pickUpazila: 'আপনার উপজেলা বেছে নিন। থানা ও ইউএনও-র নম্বর সেখানেই পাবেন।',
    kinds: { municipality: 'পৌরসভা', place: 'জায়গা', union: 'ইউনিয়ন', village: 'গ্রাম', upazila: 'উপজেলা', local: 'স্থানীয় নাম',
      'market and post office': 'হাট ও ডাকঘর', market: 'হাট-বাজার', 'post office': 'ডাকঘর' }, recent: (n) => `আগের এলাকা: ${n}`,
    denied: 'লোকেশনের অনুমতি নেই। ফোনের সেটিংসে লোকেশন চালু করুন, অথবা নিচে এলাকার নাম লিখুন।',
    unavailable: 'লোকেশন পাওয়া যায়নি। খোলা জায়গায় গিয়ে আবার চাপুন, অথবা নিচে এলাকার নাম লিখুন।',
    timeout: 'লোকেশন পেতে দেরি হচ্ছে। আবার চাপুন, অথবা নিচে এলাকার নাম লিখুন।',
    unsupported: 'এই ব্রাউজারে লোকেশন নেই। নিচে এলাকার নাম লিখুন।',
    demo: 'পরীক্ষা (ডেমো): ধরে নিন আপনি এখানে আছেন। আসল ব্যবহারে এই অংশ থাকবে না।',
    back: '← শুরুতে ফিরুন', youAreIn: 'আপনি আছেন', change: 'এলাকা বদলান', town: 'পৌরসভা', wholeUpazila: 'পুরো উপজেলা',
    shareTitle: 'পরিবারকে আপনার অবস্থান পাঠান', shareText: 'একটি চাপেই ম্যাপ লিংকসহ বার্তা যাবে। ৯৯৯-কেও এই অবস্থান বলতে পারেন।',
    shareMsg: (link) => `আমি বিপদে আছি। আমার অবস্থান: ${link}`, copy: 'কপি', copied: 'কপি হয়েছে', map: 'ম্যাপ',
    outsideTitle: 'আপনার অবস্থান', outside: 'আপনি নোয়াখালী বা কক্সবাজারের বাইরে আছেন। SafeConnect এখন শুধু এই দুই জেলার স্থানীয় নম্বর দেখায়। নিচের জাতীয় নম্বরগুলো সারা দেশে কাজ করে।',
    firstCalm: 'ওপর থেকে নিচে কল করুন। প্রথম নম্বরে কেউ না ধরলে পরেরটিতে কল করুন।', first: 'আগে এদের কল করুন', more: 'আরও সাহায্য', showAll: (n) => `সবাইকে দেখুন (${n})`,
    call: 'কল', ward: 'ওয়ার্ড', source: 'সরকারি উৎস', checked: 'যাচাই',
    what: { emergency: 'জরুরি সেবা', police: 'পুলিশ', local: 'ইউনিয়ন পরিষদ', town: 'পৌরসভা', administration: 'উপজেলা নির্বাহী অফিসার', tourist_police: 'ট্যুরিস্ট পুলিশ' },
    groups: { police: 'পুলিশ', tourist_police: 'ট্যুরিস্ট পুলিশ', village_police: 'গ্রাম পুলিশ (ওয়ার্ড অনুযায়ী)', local: 'চেয়ারম্যান ও মেম্বার', town: 'পৌরসভা',
      coast: 'উপকূল ও নৌপথ', administration: 'উপজেলা প্রশাসন (ইউএনও)', health: 'হাসপাতাল ও স্বাস্থ্য', fire: 'ফায়ার সার্ভিস', women_children: 'নারী ও শিশু সহায়তা',
      disaster: 'দুর্যোগ', helplines: 'জাতীয় হেল্পলাইন', info333: 'তথ্য ও সেবা (৩৩৩)' },
    fallback: 'এই উপজেলার নম্বর প্রকাশিত নেই, তাই জেলার নম্বর দেখানো হচ্ছে।',
    noNumbers: 'এই ইউনিয়নের প্রতিনিধিদের নম্বর সরকারি সাইটে নেই। থানা বা ইউএনও-কে কল করুন।',
    flags: { number_not_published: 'নম্বর প্রকাশিত নেই', source_older_than_2_years: 'পুরোনো তথ্য হতে পারে', needs_manual_check: 'যাচাই বাকি',
      administrator_not_elected: 'প্রশাসক' },
    credit: 'ম্যাপ তথ্য: উপজেলার সীমানা ও ইউনিয়ন/পৌরসভার কেন্দ্রবিন্দু বাংলাদেশ পরিসংখ্যান ব্যুরো (BBS), OCHA HDX-এর মাধ্যমে (CC BY-IGO)। BBS-এর নাম না মিললে টুলগুলো OpenStreetMap-এর বিন্দু যোগ করতে পারে (© OpenStreetMap contributors, ODbL)।',
    testsLink: 'সার্চ টেস্ট (ডেভেলপারদের জন্য)',
    foot1: 'সব নম্বর সরকারি *.gov.bd ওয়েবসাইট থেকে নেওয়া। প্রতিটি নম্বরের নিচে উৎসের লিংক আছে। বিপদে প্রথমে ৯৯৯।',
    sosBtn: 'প্রিয়জনকে লোকেশন পাঠান', sosBtnSubNone: 'লগইন লাগবে না · একবার একটি নম্বর সেভ করুন', sosBtnSub: 'এক চাপে পাঠান · SMS ইন্টারনেট ছাড়াও যায়',
    sosTitle: 'প্রিয়জনকে লোকেশন পাঠান', sit: 'কী হয়েছে?', loc: 'আপনার অবস্থান', send: 'কাকে পাঠাবেন?', msgT: 'বার্তা (চাইলে বদলান)',
    sits: { danger: ['বিপদে আছি', 'আমি বিপদে আছি, এখনই সাহায্য দরকার।'], followed: ['কেউ পিছু নিয়েছে', 'কেউ আমার পিছু নিয়েছে, আমি ভয় পাচ্ছি।'],
      accident: ['দুর্ঘটনা', 'আমার দুর্ঘটনা হয়েছে।'], sick: ['অসুস্থ', 'আমি অসুস্থ, সাহায্য দরকার।'], lost: ['পথ হারিয়েছি', 'আমি পথ হারিয়েছি।'] },
    urgent: 'জরুরি!', area: (n) => `আমার এলাকা: ${n}।`, mapLine: (l) => `ম্যাপ: ${l}`, noLoc: 'আমার লোকেশন পাওয়া যায়নি, এখনই আমাকে ফোন করো।',
    timeLine: (x) => `সময়: ${x}`, sign: '(SafeConnect থেকে পাঠানো)',
    gettingLoc: 'লোকেশন নেওয়া হচ্ছে…', gotLoc: (n, m) => `${n}${m ? ` (প্রায় ${m} মিটার)` : ''}`, outsideLoc: 'আপনার লোকেশন পাওয়া গেছে (ম্যাপ লিংক বার্তায় আছে)',
    noLocYet: 'লোকেশন ছাড়াই পাঠাতে পারেন। বার্তায় ফোন করতে বলা আছে।',
    sosDenied: 'লোকেশনের অনুমতি নেই (ফোনের সেটিংসে চালু করুন)।', sosNoLoc: 'লোকেশন পাওয়া যায়নি।',
    sms: 'SMS পাঠান', smsAll: (n) => `সবাইকে SMS (${n} জন)`, wa: 'WhatsApp', other: 'অন্য অ্যাপে', copyMsg: 'বার্তা কপি', call: 'কল',
    smsHint: 'SMS-এ ইন্টারনেট লাগে না। পাঠানোর বোতাম চাপলে ফোনের মেসেজ অ্যাপ খুলবে, সেখানে Send চাপুন।',
    people: 'আমার প্রিয়জন', addTitle: 'নতুন নম্বর যোগ করুন', name: 'নাম', rel: 'সম্পর্ক (যেমন: মা)', phone: 'মোবাইল নম্বর', save: 'সেভ করুন', remove: 'মুছুন',
    noPeople: 'এখনো কোনো নম্বর সেভ করা নেই। নিচে মা, বাবা বা কাছের কারো নম্বর সেভ করুন। পরে এক চাপেই পাঠাতে পারবেন।',
    badPhone: 'সঠিক মোবাইল নম্বর দিন, যেমন ০১৭১২৩৪৫৬৭৮।', needName: 'নাম লিখুন।', maxPeople: 'সর্বোচ্চ ৩ জন সেভ করা যায়।',
    privacy: 'নম্বরগুলো শুধু আপনার এই ফোনে সেভ থাকে। কোথাও পাঠানো হয় না, লগইনও লাগে না।', sendFamily: 'প্রিয়জনকে পাঠান',
  },
  en: {
    lang: 'বাং', hello1: 'Need help?', hello2: 'Stay calm. The official numbers for your area are right here.',
    eyebrow: "Official numbers for Noakhali & Cox's Bazar", h999: '999',
    lead: 'Police station, chairman, village police and hospital numbers for your union. All from official government websites; the sources are re-checked every week.',
    distAll: 'All districts',
    stats: ['official numbers', 'unions and towns', 'upazilas', 'last checked'],
    quickEyebrow: 'Quick go', quickTitle: 'Known places', quickText: "One tap shows that area's police and emergency numbers.",
    places: { chowmuhani: ['Chowmuhani', 'Begumganj, Noakhali'], inani: ['Inani beach', "Ukhia, Cox's Bazar"], hatiya: ['Hatiya', 'Island upazila, Noakhali'], coxtown: ["Cox's Bazar town", 'Municipality'] },
    call999: 'Call 999', call999Sub: 'Police, fire service, ambulance · free',
    locate: 'Find help near me', locateSub: 'Numbers for your police station, chairman and village police · works offline once the page is open',
    locating: 'Finding your location…', or: 'or',
    areaLabel: 'Type your area', areaHint: 'Village, union, town or upazila, in Bangla or English, any spelling. For example: Chowmuhani, হাতিয়া, Inani',
    noMatch: 'This name is not in our list yet. You can still get help:', didYouMean: 'Similar names', noExact: 'Not found with this exact spelling. Is it one of these?', tellUs: 'If your place is missing, tell us with "Report a wrong number" below (needs a GitHub account).',
    pickUpazila: 'Pick your upazila. Its police station and UNO numbers are there.',
    kinds: { municipality: 'town', place: 'place', union: 'union', village: 'village', upazila: 'upazila', local: 'local name',
      'market and post office': 'market and post office', market: 'market', 'post office': 'post office' }, recent: (n) => `Last area: ${n}`,
    denied: 'Location is not allowed. Turn on location in your phone settings, or type your area below.',
    unavailable: 'Could not get your location. Move to an open place and tap again, or type your area below.',
    timeout: 'Location is taking too long. Tap again, or type your area below.',
    unsupported: 'This browser has no location. Type your area below.',
    demo: 'Test (demo): pretend you are here. Real users will not see this part.',
    back: '← Back to start', youAreIn: 'You are in', change: 'Change area', town: 'town', wholeUpazila: 'whole upazila',
    shareTitle: 'Send your location to family', shareText: 'One tap sends a message with a map link. You can also tell 999 this location.',
    shareMsg: (link) => `I am in danger. My location: ${link}`, copy: 'Copy', copied: 'Copied', map: 'Map',
    outsideTitle: 'Your location', outside: "You are outside Noakhali and Cox's Bazar. SafeConnect shows local numbers only for these two districts for now. The national numbers below work everywhere.",
    firstCalm: 'Call from top to bottom. If one does not answer, try the next.', first: 'Call these first', more: 'More help', showAll: (n) => `Show all (${n})`,
    call: 'Call', ward: 'Ward', source: 'Official source', checked: 'Checked',
    what: { emergency: 'Emergency', police: 'Police station', local: 'Union council', town: 'Municipality', administration: 'Upazila officer (UNO)', tourist_police: 'Tourist Police' },
    groups: { police: 'Police', tourist_police: 'Tourist Police', village_police: 'Village police (by ward)', local: 'Chairman and members', town: 'Municipality',
      coast: 'Coast and river', administration: 'Upazila administration (UNO)', health: 'Hospital and health', fire: 'Fire service', women_children: 'Women and children',
      disaster: 'Disaster', helplines: 'National helplines', info333: 'Information and services (333)' },
    fallback: 'No number is published for this upazila, so district numbers are shown.',
    noNumbers: "This union's representatives have no published numbers. Call the police station or the UNO.",
    flags: { number_not_published: 'Number not published', source_older_than_2_years: 'May be outdated', needs_manual_check: 'Not checked yet',
      administrator_not_elected: 'Administrator' },
    credit: 'Map data: upazila boundaries and union/town centre points from the Bangladesh Bureau of Statistics (BBS) via OCHA HDX (CC BY-IGO). Where BBS names do not match, the tools can add OpenStreetMap points (© OpenStreetMap contributors, ODbL).',
    testsLink: 'Search tests (for developers)',
    foot1: 'All numbers come from official *.gov.bd websites. Each number links to its source. In danger, call 999 first.',
    sosBtn: 'Send my location to family', sosBtnSubNone: 'No login · save one number once', sosBtnSub: 'One tap · SMS works without internet',
    sosTitle: 'Send my location to family', sit: 'What happened?', loc: 'Your location', send: 'Send to', msgT: 'Message (you can change it)',
    sits: { danger: ['In danger', 'I am in danger and need help now.'], followed: ['Being followed', 'Someone is following me and I am scared.'],
      accident: ['Accident', 'I had an accident.'], sick: ['Feeling ill', 'I am ill and need help.'], lost: ['Lost', 'I am lost.'] },
    urgent: 'URGENT!', area: (n) => `My area: ${n}.`, mapLine: (l) => `Map: ${l}`, noLoc: 'I could not get my location. Call me now.',
    timeLine: (x) => `Time: ${x}`, sign: '(sent from SafeConnect)',
    gettingLoc: 'Getting your location…', gotLoc: (n, m) => `${n}${m ? ` (about ${m} m)` : ''}`, outsideLoc: 'Location found (the map link is in the message)',
    noLocYet: 'You can send without a location. The message asks them to call you.',
    sosDenied: 'Location is not allowed (turn it on in phone settings).', sosNoLoc: 'Could not get your location.',
    sms: 'Send SMS', smsAll: (n) => `SMS everyone (${n})`, wa: 'WhatsApp', other: 'Other app', copyMsg: 'Copy message', call: 'Call',
    smsHint: 'SMS needs no internet. The button opens your messages app; tap Send there.',
    people: 'My people', addTitle: 'Add a number', name: 'Name', rel: 'Relation (e.g. mother)', phone: 'Mobile number', save: 'Save', remove: 'Remove',
    noPeople: 'No number saved yet. Save your mother, father or a close friend below. Next time it is one tap.',
    badPhone: 'Enter a valid mobile number, like 01712345678.', needName: 'Enter a name.', maxPeople: 'You can save up to 3 people.',
    privacy: 'These numbers are saved only on this phone. They are never sent anywhere, and no login is needed.', sendFamily: 'Send to family',
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

/* ---------- area search: any spelling, Bangla or English, never a dead end (search code in data.js) ---------- */
function itemLabel(h) {
  const p = { ...h.place };
  const named = h.named && (lang === 'bn' ? h.named.name_bn : h.named.name_en || h.named.name_bn);
  if (named) p.label = named;
  const kindWord = (h.kind === 'local' && t().kinds[h.named?.type]) || t().kinds[h.kind] || '';   // "হাসান হাট (হাট ও ডাকঘর)"
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
  const only = $('distSel').value;
  const { hits, close } = findAreas(areaIndex, q, { district: only });
  if (hits.length) { box.replaceChildren(...hits.map(suggestButton)); box.hidden = false; return; }
  // Never a dead end: similar names, then the upazila list, then GPS and 999.
  const s = t();
  const parts = [el('li', 'none', close.length ? s.noExact : s.noMatch)];
  if (close.length) { parts.push(el('li', 'group', s.didYouMean)); close.forEach((h) => parts.push(suggestButton(h))); }
  const ups = el('li', 'fallback-box');
  ups.append(el('p', null, s.pickUpazila));
  const chips = el('div', 'chips');
  for (const d of DISTRICTS) {
    if (only && d.key !== only) continue;
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
  const row = el('div', 'first-row glass');
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
    const fam = el('button', 'btn violet', t().sendFamily); fam.type = 'button';
    fam.addEventListener('click', () => openSos(current.pos));
    $('shareBtns').replaceChildren(fam, wa, sms, copy, map);
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
  $('sos').hidden = name !== 'sos';
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
function resolvePlace(pos) {
  const found = locations && nearestPlace(locations, pos);
  if (!found) return { outside: true };
  const place = { district: found.district, upazila: found.upazila, area: found.area };
  const doc = data.docs[found.district];
  const named = found.area && (doc.places || []).find((x) => norm(x.union_bn) === found.area.bn);
  if (named) place.placeId = named.id;
  if (found.area) {
    const full = localAreas(doc, found.upazila).find((a) => a.type === found.area.type && a.bn === found.area.bn);
    if (full) place.area = full;
  }
  return place;
}
function applyPosition(pos) { lastFix = { pos, at: Date.now() }; openArea(resolvePlace(pos), pos); }
function demoPicks() {
  if (!locations) return [];
  const picks = [
    [locations.municipalities.find((m) => m.municipality_bn.includes('চৌমুহনী')), { bn: 'চৌমুহনী', en: 'Chowmuhani' }],
    [locations.unions.find((u) => u.union_en === 'Jaliapalong'), { bn: 'ইনানী সৈকত', en: 'Inani beach' }],
    [locations.unions.find((u) => u.district === 'Noakhali' && u.upazila_en === 'Hatiya'), { bn: 'হাতিয়া', en: 'Hatiya' }],
    [{ lat: 23.8103, lon: 90.4125 }, { bn: 'ঢাকা (জেলার বাইরে)', en: 'Dhaka (outside)' }],
  ].filter(([p]) => p);
  return picks;
}
function fillDemo(box, textEl, chipsEl, onPick) {
  if (!locations) return;
  textEl.textContent = t().demo;
  chipsEl.replaceChildren(...demoPicks().map(([p, name]) => {
    const b = el('button', 'chip', name[lang]); b.type = 'button';
    b.addEventListener('click', () => onPick({ lat: p.lat + 0.004, lon: p.lon - 0.003, accuracy: 20 }));
    return b;
  }));
  box.hidden = false;
}
function showDemo() { fillDemo($('demo'), $('demoText'), $('demoChips'), applyPosition); }
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

/* ---------- send location to family (no login) ---------- */
let lastFix = null;          // { pos, at }
let sos = { situation: 'danger', pos: null, place: null, state: 'idle', edited: false };
const toAscii = (s) => String(s).replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d));
function normPhone(raw) {
  let d = toAscii(raw).replace(/\D/g, '');
  if (d.startsWith('880')) d = d.slice(2);
  else if (d.startsWith('88') && d.length === 13) d = d.slice(2);
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}
function getPeople() { try { return JSON.parse(store.get('sc-family') || '[]').filter((p) => p && normPhone(p.phone)); } catch { return []; } }
function setPeople(list) { store.set('sc-family', JSON.stringify(list)); }

function renderHomeSos() {
  const people = getPeople();
  const sub = $('sosBtnSub');
  sub.replaceChildren();
  if (!people.length) { sub.textContent = t().sosBtnSubNone; return; }
  sub.textContent = t().sosBtnSub;
  const chips = el('span', 'who-list');
  people.forEach((p) => chips.append(el('span', null, p.rel || p.name)));
  sub.append(chips);
}

function sosMessage() {
  const s = t();
  const lines = [`${s.urgent} ${s.sits[sos.situation][1]}`];
  if (sos.place && !sos.place.outside) lines.push(s.area(`${placeTitle(sos.place)}, ${placeSub(sos.place)}`));
  lines.push(sos.pos ? s.mapLine(mapsLink(sos.pos)) : s.noLoc);
  const time = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { hour: 'numeric', minute: '2-digit' }).format(new Date());
  lines.push(`${s.timeLine(time)} ${s.sign}`);
  return lines.join('\n');
}
function refreshMessage() { if (!sos.edited) $('sosMsg').value = sosMessage(); renderSend(); }

function renderSituations() {
  $('situations').replaceChildren(...Object.entries(t().sits).map(([k, [label]]) => {
    const b = el('button', 'chip', label); b.type = 'button';
    b.setAttribute('aria-pressed', String(k === sos.situation));
    b.addEventListener('click', () => { sos.situation = k; sos.edited = false; renderSituations(); refreshMessage(); });
    return b;
  }));
}
function renderLoc() {
  const line = $('sosLoc');
  line.className = 'locline';
  if (sos.state === 'getting') line.textContent = t().gettingLoc;
  else if (sos.pos && sos.place && !sos.place.outside) {
    line.classList.add('ok');
    const acc = sos.pos.accuracy ? digits(Math.round(sos.pos.accuracy)) : '';
    line.textContent = t().gotLoc(`${placeTitle(sos.place)}, ${placeSub(sos.place)}`, acc);
  } else if (sos.pos) { line.classList.add('ok'); line.textContent = t().outsideLoc; }
  else { line.classList.add('bad'); line.textContent = `${sos.error === 'denied' ? t().sosDenied : t().sosNoLoc} ${t().noLocYet}`; }
}
function setSosPos(pos) {
  sos.pos = pos; sos.place = resolvePlace(pos); sos.state = 'done';
  lastFix = { pos, at: Date.now() };
  $('sosDemo').hidden = true;
  renderLoc(); refreshMessage();
}
function renderSend() {
  const people = getPeople();
  const body = () => $('sosMsg').value;
  const list = $('sendList');
  list.replaceChildren();
  if (!people.length) {
    list.append(el('p', 'msg plain', t().noPeople));
    $('peopleBox').open = true;
  }
  for (const p of people) {
    const row = el('div', 'contact');
    const av = el('span', 'avatar', (p.name || '?').trim().charAt(0).toUpperCase());
    const info = el('div');
    info.append(el('b', null, p.rel ? `${p.name} (${p.rel})` : p.name), el('span', 'num', digits(p.phone)));
    const sendRow = el('div', 'send-row');
    const sms = el('a', 'send'); sms.href = `sms:${p.phone}?&body=${encodeURIComponent(body())}`;
    sms.append(document.createTextNode(t().sms), el('small', null, lang === 'bn' ? 'ইন্টারনেট লাগে না' : 'no internet needed'));
    const wa = el('a', 'send alt', t().wa); wa.href = `https://wa.me/88${p.phone}?text=${encodeURIComponent(body())}`; wa.target = '_blank'; wa.rel = 'noopener';
    const call = el('a', 'send alt', t().call); call.href = `tel:${p.phone}`;
    const pair = el('div', 'pair'); pair.append(wa, call);
    sendRow.append(sms, pair);
    row.append(av, info, sendRow);
    list.append(row);
  }
  const tools = $('sendTools');
  tools.replaceChildren();
  if (people.length > 1) {
    const all = el('a', 'btn', t().smsAll(digits(people.length)));
    all.href = `sms:${people.map((p) => p.phone).join(',')}?&body=${encodeURIComponent(body())}`;
    tools.append(all);
  }
  const copy = el('button', 'btn', t().copyMsg); copy.type = 'button';
  copy.addEventListener('click', () => navigator.clipboard?.writeText(body()).then(() => { copy.textContent = t().copied; }, () => { $('sosMsg').select(); }));
  tools.append(copy);
  if (navigator.share) {
    const other = el('button', 'btn', t().other); other.type = 'button';
    other.addEventListener('click', () => navigator.share({ text: body() }).catch(() => {}));
    tools.append(other);
  }
}
function renderPeople() {
  const people = getPeople();
  $('peopleCount').textContent = digits(people.length);
  $('savedList').replaceChildren(...people.map((p, i) => {
    const row = el('div', 'saved');
    row.append(el('span', null, `${p.name}${p.rel ? ` (${p.rel})` : ''} · ${digits(p.phone)}`));
    const rm = el('button', 'linkbtn', t().remove); rm.type = 'button';
    rm.addEventListener('click', () => { const l = getPeople(); l.splice(i, 1); setPeople(l); renderPeople(); renderSend(); renderHomeSos(); });
    row.append(rm);
    return row;
  }));
  $('addForm').hidden = people.length >= 3;
}
async function openSos(pos) {
  sos = { situation: sos.situation || 'danger', pos: null, place: null, state: 'getting', edited: false, error: null };
  renderSituations(); renderPeople();
  showView('sos');
  const fresh = pos || (lastFix && Date.now() - lastFix.at < 120000 ? lastFix.pos : null);
  if (fresh) { setSosPos(fresh); return; }
  renderLoc(); refreshMessage();
  try { setSosPos(await getPosition()); }
  catch (err) {
    sos.state = 'failed'; sos.error = err.code;
    renderLoc(); refreshMessage();
    fillDemo($('sosDemo'), $('sosDemoText'), $('sosDemoChips'), setSosPos);
  }
}
$('sosBtn').addEventListener('click', () => openSos(null));
$('sosBack').addEventListener('click', goHome);
$('sosMsg').addEventListener('input', () => { sos.edited = true; renderSend(); });
$('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('formErr');
  const name = $('pName').value.trim();
  const phone = normPhone($('pPhone').value);
  const people = getPeople();
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  if (people.length >= 3) return fail(t().maxPeople);
  if (!name) return fail(t().needName);
  if (!phone) return fail(t().badPhone);
  err.hidden = true;
  people.push({ name, rel: $('pRel').value.trim(), phone });
  setPeople(people);
  $('pName').value = ''; $('pRel').value = ''; $('pPhone').value = '';
  renderPeople(); renderSend(); renderHomeSos();
});

/* ---------- home extras ---------- */
const ICONS = {
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  map: 'M15 4 9 2 3 4v18l6-2 6 2 6-2V2l-6 2Zm-1 15.3-4-1.3V4.7l4 1.3v13.3Z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L21 7.5l-1.4-1.4z',
  open: 'M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v8H3V5h2Z',
};
const svg = (d) => { const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); n.setAttribute('viewBox', '0 0 24 24'); n.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d); n.append(p); return n; };
function renderStats() {
  const docs = Object.values(data.docs);
  const numbers = docs.reduce((n, d) => n + d.records.filter(withPhone).length, 0) + data.national.length;
  const areas = docs.reduce((n, d) => n + d.unions.length + d.municipalities.length, 0);
  const upz = docs.reduce((n, d) => n + upazilas(d).length, 0);
  const checked = docs.map((d) => d.records.find((r) => r.script_check?.on)?.script_check.on).find(Boolean) || docs[0]?.retrieved_on;
  const fmt = (n) => digits(new Intl.NumberFormat('en-US').format(n));
  const vals = [[fmt(numbers), ICONS.phone], [fmt(areas), ICONS.map], [fmt(upz), ICONS.pin], [checked ? fmtDate(checked) : '', ICONS.check]];
  $('stats').replaceChildren(...vals.map(([v, ic], i) => {
    const d = el('div', 'stat');
    const icon = el('span', 'ic'); icon.append(svg(ic));
    d.append(icon, el('b', null, v), el('span', null, t().stats[i]));
    return d;
  }));
}
function quickPlaces() {
  const find = (fn) => areaIndex.find(fn);
  return [
    ['chowmuhani', 'town', find((x) => x.place.area?.type === 'municipality' && x.place.area.bn.includes('চৌমুহনী'))],
    ['inani', 'beach', find((x) => x.named && x.named.id === 'place-inani-beach')],
    ['hatiya', 'island', find((x) => !x.place.area && x.place.upazila === 'Hatiya')],
    ['coxtown', 'city', find((x) => x.place.district === 'coxsbazar' && x.place.area?.type === 'municipality')],
  ].filter(([, , item]) => item);
}
function renderPlaces() {
  $('places').replaceChildren(...quickPlaces().map(([key, art, item]) => {
    const [name, sub] = t().places[key];
    const b = el('button', 'place'); b.type = 'button';
    const label = el('span', 'label'); label.append(el('b', null, name), el('small', null, sub));
    const corner = el('span', 'corner'); corner.append(svg(ICONS.open));
    b.append(el('span', `art ${art}`), corner, label);
    b.addEventListener('click', () => { const p = { ...item.place }; if (item.named) p.label = lang === 'bn' ? item.named.name_bn : item.named.name_en; openArea(p, null); });
    return b;
  }));
}
function saveNumbers() { openSos(null); $('peopleBox').open = true; setTimeout(() => $('peopleBox').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }


const SITE = {
  repo: 'https://github.com/Jerin101/safe-connect',
  report: 'https://github.com/Jerin101/safe-connect/issues/new?labels=data-gap&title=Wrong%20number',
};
const PAGE = {
  bn: {
    greet: { morning: 'শুভ সকাল', noon: 'শুভ দুপুর', evening: 'শুভ সন্ধ্যা', night: 'রাতেও ৯৯৯ চালু থাকে, বিনা খরচে।' },
    greetTail: 'সাহায্য দরকার হলে নম্বর নিচেই আছে।',
    trust: ['শুধু সরকারি নম্বর', 'লগইন লাগে না', 'বিনা খরচে ব্যবহার', 'বাংলা ও English'],
    welcomeTitle: 'স্বাগতম! প্রথমবার এসেছেন? তিনটি কথা জেনে রাখুন:',
    welcomeSteps: ['বিপদে সবার আগে ৯৯৯-এ কল করুন।', '"আমার কাছের সাহায্য" চাপলে আপনার এলাকার থানা আর চেয়ারম্যানের নম্বর আসবে।', 'প্রিয়জনের নম্বর এখনই সেভ করে রাখুন, বিপদে সহজেই লোকেশন পাঠাতে পারবেন।'],
    welcomeOk: 'বুঝেছি', welcomeSave: 'নম্বর সেভ করুন',
    icons: { 'national-emergency-999': 'জরুরি সেবা', 'fire-service-102': 'ফায়ার সার্ভিস', 'health-call-centre-16263': 'স্বাস্থ্য বাতায়ন',
      'women-children-violence-109': 'নারী ও শিশু', 'child-helpline-1098': 'শিশু সহায়তা', 'tourist-police-helpline': 'ট্যুরিস্ট পুলিশ', 'info-service-333': 'তথ্য সেবা', 'disaster-warning-1090': 'দুর্যোগের আগাম বার্তা' },
    iconSend: 'লোকেশন পাঠান', iconSendSub: 'প্রিয়জনকে', iconNear: 'কাছের সাহায্য', iconNearSub: 'থানা ও চেয়ারম্যান',
    iconSrc: 'এই নম্বরগুলোর সরকারি উৎস ও যাচাইয়ের তারিখ',
    findTitle: 'আপনার এলাকা কোথায়?', findText: 'গ্রাম, ইউনিয়ন, পৌরসভা বা উপজেলার নাম লিখুন, বাংলা বা ইংরেজিতে, যেকোনো বানানে।',
    guideTitle: 'কী হয়েছে?', guideText: 'পরিস্থিতি বেছে নিন। কাকে ফোন করবেন, আমরা দেখিয়ে দেব।',
    guides: [
      ['night', 'রাতে বা পথে বিপদে', 'আগে ৯৯৯-এ কল করুন। তারপর প্রিয়জনকে আপনার লোকেশন পাঠান।', 'লোকেশন পাঠান', 'sos'],
      ['lost', 'কিছু হারিয়েছে বা চুরি হয়েছে', 'কাছের থানায় সাধারণ ডায়েরি (জিডি) করুন। আপনার এলাকার থানার নম্বর এখানে পাবেন।', 'থানার নম্বর খুঁজুন', 'find'],
      ['storm', 'ঝড়, বন্যা বা আগুন', (n) => (n ? `ফায়ার সার্ভিস ${n.fire}, দুর্যোগের আগাম বার্তা ${n.warn}। আপনার উপজেলার নম্বরও দেখুন।` : 'ফায়ার সার্ভিস, দুর্যোগ ও আপনার উপজেলার নম্বর দেখুন।'), 'আমার কাছের সাহায্য', 'locate']],
    duo: [
      ['send', 'প্রিয়জনের নম্বর সেভ করুন', 'বিপদে নম্বর খোঁজার সময় থাকে না। একবার সেভ করলে সহজেই লোকেশন পাঠাতে পারবেন। লগইন লাগে না।', 'নম্বর সেভ করুন'],
      ['flag', 'ভুল নম্বর পেয়েছেন?', 'জানান (GitHub অ্যাকাউন্ট লাগবে)। আমরা সরকারি উৎস মিলিয়ে দেখব, ভুল হলে ঠিক করব।', 'ভুল নম্বর জানান']],
    helpTitle: 'কীভাবে সাহায্য করতে পারি?', help: ['প্রশ্ন ও উত্তর', 'তথ্যের উৎস', 'প্রাইভেসি', 'ভুল নম্বর জানান'],
    netTitle: 'দুর্বল নেটওয়ার্কের জন্য তৈরি',
    net: [['ok', 'পাতা খোলা থাকলে লোকেশন দিয়ে এলাকা খুঁজতে ইন্টারনেট লাগে না'], ['ok', 'SMS-এ প্রিয়জনকে লোকেশন পাঠাতে ইন্টারনেট লাগে না'],
      ['ok', 'সব নম্বর সরকারি ওয়েবসাইট থেকে, উৎসের লিংকসহ'], ['soon', 'ফোনে ইনস্টল করে পুরো অফলাইনে চালানো: শীঘ্রই']],
    nav: { home: 'হোম', numbers: 'জরুরি নম্বর', area: 'এলাকা খুঁজুন', send: 'প্রিয়জনকে লোকেশন', guide: 'কী হয়েছে?', about: 'আমাদের সম্পর্কে', faq: 'প্রশ্ন ও উত্তর' },
    about: { eyebrow: 'আমাদের সম্পর্কে', title: 'SafeConnect কী?',
      text: 'বিপদের সময় কাকে ফোন করবেন, খুঁজতেই সময় চলে যায়। SafeConnect আপনার অবস্থান দেখে কাছের থানা, ইউনিয়ন পরিষদ, গ্রাম পুলিশ ও হাসপাতালের সরকারি নম্বর ঠিক ক্রমে দেখায়। এখন নোয়াখালী ও কক্সবাজারে, পরে সারা দেশে।',
      points: [['check', 'শুধু সরকারি নম্বর', 'প্রতিটি নম্বর সরকারি *.gov.bd ওয়েবসাইট থেকে নেওয়া, উৎসের লিংকসহ। প্রতি সপ্তাহে উৎস আবার মিলিয়ে দেখা হয়।'],
        ['signal', 'দুর্বল নেটওয়ার্কের জন্য তৈরি', 'পাতা খোলা থাকলে লোকেশন দিয়ে এলাকা খোঁজা যায় আর SMS-এ লোকেশন পাঠানো যায়, ইন্টারনেট ছাড়াই। পুরো অফলাইন অ্যাপ তৈরি হচ্ছে।'],
        ['lock', 'লগইন লাগে না', 'প্রিয়জনের নম্বর শুধু আপনার ফোনে থাকে। আমরা কোনো ব্যক্তিগত তথ্য সংগ্রহ করি না।']] },
    faq: { eyebrow: 'প্রশ্ন ও উত্তর', title: 'যা জানতে চান',
      items: [['source', 'নম্বরগুলো কোথা থেকে আসে?', 'জেলা, উপজেলা, ইউনিয়ন ও পৌরসভার সরকারি ওয়েবসাইট (*.gov.bd) থেকে। প্রতিটি নম্বরের নিচে উৎসের লিংক ও যাচাইয়ের তারিখ আছে।'],
        ['wrong', 'কোনো নম্বর ভুল হলে কী করব?', 'নিচের "ভুল নম্বর জানান" লিংকে জানান। আমরা সরকারি উৎস মিলিয়ে ঠিক করি। জরুরি হলে আগে ৯৯৯-এ কল করুন।'],
        ['offline', 'ইন্টারনেট না থাকলে কাজ করবে?', 'আংশিক। পাতাটি আগে থেকে খোলা থাকলে লোকেশন দিয়ে এলাকা খোঁজা আর SMS পাঠানো ইন্টারনেট ছাড়াই হয়। পুরো সাইট অফলাইনে চালানোর সুবিধা তৈরি হচ্ছে।'],
        ['privacy', 'আমার তথ্য কোথায় যায়?', 'কোথাও না। প্রিয়জনের নম্বর ও শেষ দেখা এলাকা শুধু আপনার ফোনের ব্রাউজারে থাকে। লোকেশন যায় শুধু আপনি পাঠালে।'],
        ['districts', 'অন্য জেলা কবে আসবে?', 'এখন নোয়াখালী ও কক্সবাজার। তথ্য যাচাই শেষ হলে ধাপে ধাপে বাকি জেলা আসবে। ৯৯৯, ১০৯, ৩৩৩-এর মতো জাতীয় নম্বর সারা দেশে কাজ করে।']] },
    foot: { tagline: 'আপনার এলাকার সরকারি জরুরি নম্বর। লগইন ছাড়া।', small: 'নোয়াখালী ও কক্সবাজার দিয়ে শুরু।',
      services: ['সেবা', ['৯৯৯-এ কল', 'প্রিয়জনকে লোকেশন', 'কাছের সাহায্য', 'এলাকা খুঁজুন']],
      areas: ['এলাকা', ['নোয়াখালী', 'কক্সবাজার', 'চৌমুহনী', 'ইনানী সৈকত']],
      info: ['তথ্য', ['আমাদের সম্পর্কে', 'প্রশ্ন ও উত্তর', 'ভুল নম্বর জানান', 'উৎস ও যাচাই']],
      helpTitle: 'সাহায্য দরকার?', helpText: 'সরকারি কোনো সেবার তথ্য জানতে ৩৩৩-এ কল করুন। এই প্রকল্প নিয়ে কিছু বলতে চাইলে GitHub-এ লিখুন।',
      copy: '© ২০২৬ SafeConnect · jerin101 ও tasmintoshi', bottom: ['প্রাইভেসি', 'উৎস', 'GitHub', 'সার্চ টেস্ট'],
      credit: 'নম্বর: সরকারি *.gov.bd ওয়েবসাইট। ম্যাপ: উপজেলার সীমানা ও ইউনিয়ন/পৌরসভার কেন্দ্রবিন্দু বাংলাদেশ পরিসংখ্যান ব্যুরো (BBS), OCHA HDX-এর মাধ্যমে (CC BY-IGO)। BBS-এর নাম না মিললে টুলগুলো OpenStreetMap-এর বিন্দু যোগ করতে পারে (© OpenStreetMap contributors, ODbL)।' },
  },
  en: {
    greet: { morning: 'Good morning', noon: 'Good afternoon', evening: 'Good evening', night: '999 works all night too, and it is free.' },
    greetTail: 'If you need help, the numbers are right below.',
    trust: ['Official numbers only', 'No login', 'Free to use', 'বাংলা & English'],
    welcomeTitle: 'Welcome! First time here? Three things to know:',
    welcomeSteps: ['In danger, call 999 first.', 'Tap "Find help near me" to see the numbers of your police station and chairman.', "Save your family's numbers now, so you can send your location quickly."],
    welcomeOk: 'Got it', welcomeSave: 'Save numbers',
    icons: { 'national-emergency-999': 'Emergency', 'fire-service-102': 'Fire service', 'health-call-centre-16263': 'Health line',
      'women-children-violence-109': 'Women & children', 'child-helpline-1098': 'Child helpline', 'tourist-police-helpline': 'Tourist Police', 'info-service-333': 'Info service', 'disaster-warning-1090': 'Disaster warning' },
    iconSend: 'Send location', iconSendSub: 'to family', iconNear: 'Help near me', iconNearSub: 'police station & chairman',
    iconSrc: 'Official source and check date of these numbers',
    findTitle: 'Which area are you in?', findText: 'Type your village, union, town or upazila, in Bangla or English, any spelling.',
    guideTitle: 'What happened?', guideText: 'Pick your situation and we will show you who to call.',
    guides: [
      ['night', 'In danger at night or on the road', 'Call 999 first. Then send your location to your family.', 'Send location', 'sos'],
      ['lost', 'Something lost or stolen', 'File a General Diary (GD) at the nearest police station. Find your police station number here.', 'Find police station number', 'find'],
      ['storm', 'Storm, flood or fire', (n) => (n ? `Fire service ${n.fire}, disaster warning ${n.warn}. See your upazila numbers too.` : 'See the fire service, disaster and upazila numbers.'), 'Find help near me', 'locate']],
    duo: [
      ['send', "Save your family's numbers", 'In an emergency there is no time to look for numbers. Save them once and you can send your location quickly. No login.', 'Save numbers'],
      ['flag', 'Found a wrong number?', 'Tell us (needs a GitHub account). We check it against the official source and fix it if it is wrong.', 'Report a wrong number']],
    helpTitle: 'How can we help?', help: ['Questions', 'Sources', 'Privacy', 'Report a wrong number'],
    netTitle: 'Made for weak networks',
    net: [['ok', 'Once the page is open, finding your area from your location needs no internet'], ['ok', 'Sending your location by SMS needs no internet'],
      ['ok', 'Every number from an official website, with its source'], ['soon', 'Install on your phone and use fully offline: coming soon']],
    nav: { home: 'Home', numbers: 'Emergency numbers', area: 'Find area', send: 'Send location', guide: 'What happened?', about: 'About', faq: 'Questions' },
    about: { eyebrow: 'About', title: 'What is SafeConnect?',
      text: 'In an emergency, finding the right number takes time you do not have. SafeConnect uses your location to show the official numbers for your police station, union council, village police and hospital, in the order to call them. Noakhali and Cox\'s Bazar now, the whole country later.',
      points: [['check', 'Official numbers only', 'Every number comes from an official *.gov.bd website, with its source link. The sources are re-checked every week.'],
        ['signal', 'Made for weak networks', 'Once the page is open, you can find your area from your location and send it by SMS, with no internet. A full offline app is being built.'],
        ['lock', 'No login', 'Your family\'s numbers stay on your phone. We collect no personal data.']] },
    faq: { eyebrow: 'Questions', title: 'Good to know',
      items: [['source', 'Where do the numbers come from?', 'From the official websites (*.gov.bd) of districts, upazilas, unions and municipalities. Each number shows its source link and check date.'],
        ['wrong', 'What if a number is wrong?', 'Tell us with "Report a wrong number" below. We fix it against the official source. In an emergency, call 999 first.'],
        ['offline', 'Does it work without internet?', 'Partly. If the page is already open, finding your area from your location and sending SMS work without internet. Full offline use is being built.'],
        ['privacy', 'Where does my data go?', 'Nowhere. Your family\'s numbers and last area stay in your phone\'s browser. Your location is sent only when you send it.'],
        ['districts', 'When will other districts come?', 'Noakhali and Cox\'s Bazar now. More districts come step by step once their data is checked. National numbers like 999, 109 and 333 work everywhere.']] },
    foot: { tagline: 'Official emergency numbers for your area. No login.', small: "Starting with Noakhali and Cox's Bazar.",
      services: ['Services', ['Call 999', 'Send location', 'Find help near me', 'Find area']],
      areas: ['Areas', ['Noakhali', "Cox's Bazar", 'Chowmuhani', 'Inani beach']],
      info: ['Information', ['About', 'Questions', 'Report a wrong number', 'Sources and checks']],
      helpTitle: 'Need a little help?', helpText: 'For information about any government service, call 333. To tell us about this project, write on GitHub.',
      copy: '© 2026 SafeConnect · jerin101 & tasmintoshi', bottom: ['Privacy', 'Sources', 'GitHub', 'Search tests'],
      credit: 'Numbers: official *.gov.bd websites. Map: upazila boundaries and union/town centre points from the Bangladesh Bureau of Statistics (BBS) via OCHA HDX (CC BY-IGO). Where BBS names do not match, the tools can add OpenStreetMap points (© OpenStreetMap contributors, ODbL).' },
  },
};
const P = () => PAGE[lang];
const MORE_ICONS = {
  signal: 'M2 9.5a15 15 0 0 1 20 0l-1.4 1.4a13 13 0 0 0-17.2 0L2 9.5Zm3.5 3.5a10 10 0 0 1 13 0l-1.4 1.4a8 8 0 0 0-10.2 0L5.5 13Zm3.5 3.5a5 5 0 0 1 6 0L12 19.5l-3-3Z',
  lock: 'M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3Z',
};
function goTo(id) { goHome(); setTimeout(() => $(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); }
function findArea(district) { goHome(); $('distSel').value = district || ''; setTimeout(() => { $('areaInput').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('areaInput').focus({ preventScroll: true }); }, 30); renderSuggest(); }
function openFaq(key) { goTo('faq'); const d = document.querySelector(`#faqList details[data-key="${key}"]`); if (d) d.open = true; }
function openQuick(key) { const q = quickPlaces().find(([k]) => k === key); if (!q) return; const [, , item] = q; const p = { ...item.place }; if (item.named) p.label = lang === 'bn' ? item.named.name_bn : item.named.name_en; openArea(p, null); }
const textBtn = (label, fn) => { const b = el('button', null, label); b.type = 'button'; b.addEventListener('click', fn); return b; };
const extLink = (label, href) => { const a = el('a', null, `${label} ↗`); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };

// Second header row: one button per home section, in page order (DESIGN.md §3).
const NAV = [
  ['home', () => { goHome(); window.scrollTo(0, 0); }],
  ['numbers', () => goTo('iconRow')],
  ['area', () => findArea('')],
  ['send', () => openSos(null)],
  ['guide', () => goTo('guideCards')],
  ['about', () => goTo('about')],
  ['faq', () => goTo('faq')],
];
function renderNav() {
  $('nav').replaceChildren(...NAV.map(([key, fn]) => textBtn(P().nav[key], fn)));
}
function renderAbout() {
  const a = P().about;
  $('aboutEyebrow').textContent = a.eyebrow; $('aboutTitle').textContent = a.title; $('aboutText').textContent = a.text;
  $('points').replaceChildren(...a.points.map(([ic, title, text]) => {
    const d = el('div', 'point'); const i = el('span', 'ic'); i.append(svg(MORE_ICONS[ic] || ICONS[ic]));
    d.append(i, el('b', null, title), el('span', null, text)); return d;
  }));
}
function renderFaq() {
  const f = P().faq;
  $('faqEyebrow').textContent = f.eyebrow; $('faqTitle').textContent = f.title;
  $('faqList').replaceChildren(...f.items.map(([key, q, a]) => {
    const d = el('details'); d.dataset.key = key; d.append(el('summary', null, q), el('p', null, a)); return d;
  }));
}
function renderFooter() {
  const f = P().foot;
  const brand = el('div', 'foot-brand');
  const logo = $('homeBtn').cloneNode(true); logo.removeAttribute('id'); logo.addEventListener('click', () => { goHome(); window.scrollTo(0, 0); });
  brand.append(logo, el('p', null, f.tagline), el('small', null, f.small));
  const col = (title, items) => { const c = el('div', 'foot-col'); c.append(el('h3', null, title), ...items); return c; };
  const [sT, s] = f.services, [aT, a] = f.areas, [iT, i] = f.info;
  const call = el('a', null, s[0]); call.href = 'tel:999';
  const help = el('div', 'foot-col foot-help');
  help.append(el('h3', null, f.helpTitle), el('p', null, f.helpText), extLink('github.com/Jerin101/safe-connect', SITE.repo));
  $('footGrid').replaceChildren(brand,
    col(sT, [call, textBtn(s[1], () => openSos(null)), textBtn(s[2], () => { goHome(); locate(); }), textBtn(s[3], () => findArea(''))]),
    col(aT, [textBtn(a[0], () => findArea('noakhali')), textBtn(a[1], () => findArea('coxsbazar')), textBtn(a[2], () => openQuick('chowmuhani')), textBtn(a[3], () => openQuick('inani'))]),
    col(iT, [textBtn(i[0], () => goTo('about')), textBtn(i[1], () => goTo('faq')), extLink(i[2], SITE.report), textBtn(i[3], () => openFaq('source'))]),
    help);
  const nav = el('nav'); nav.setAttribute('aria-label', 'Footer');
  const tests = el('a', null, f.bottom[3]); tests.href = 'tests/search-test.html';
  nav.append(textBtn(f.bottom[0], () => openFaq('privacy')), textBtn(f.bottom[1], () => openFaq('source')), extLink(f.bottom[2], SITE.repo), tests);
  $('footBottom').replaceChildren(el('span', null, f.copy), nav, el('p', 'credit', f.credit));
}
const GP_ICONS = {
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  fire: 'M13.5 2s1 3.5-1.5 6.5c-1.6 1.9-4 3.4-4 6.6A6 6 0 0 0 20 15c0-3-1.4-4.6-2.6-6-.4 1.6-1.3 2.6-2.4 3 .9-3.6-.2-7.4-1.5-10Z',
  health: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z',
  woman: 'M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-1 10h2a5 5 0 0 1 5 5v1h-3v4h-6v-4H6v-1a5 5 0 0 1 5-5Z',
  child: 'M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-4 8h8l-1 6h-2v4h-2v-4H9l-1-6Z',
  bag: 'M9 3h6a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V4a1 1 0 0 1 1-1Zm1 3h4V5h-4v1Z',
  info: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 8v7h2v-7h-2Zm0-4v2h2V6h-2Z',
  send: 'M2.5 11.2 20.6 3.4c.8-.34 1.6.46 1.26 1.26L14.1 22.8c-.37.86-1.62.78-1.87-.12l-1.9-6.98-6.98-1.9c-.9-.25-.98-1.5-.12-1.87Zm8.7 3.2 1.3 4.8 5.5-12.8-6.8 8Zm-1.2-1.2 8-6.8-12.8 5.5 4.8 1.3Z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z',
  flag: 'M5 3h2v18H5V3Zm3 1h11l-2.5 4L19 12H8V4Z',
  question: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 14v2h2v-2h-2Zm1-10a4 4 0 0 0-4 4h2a2 2 0 1 1 3 1.7c-1.2.7-2 1.6-2 3.3h2c0-1 .4-1.4 1.2-1.9A4 4 0 0 0 12 6Z',
  db: 'M12 2c4.4 0 8 1.3 8 3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5c0-1.7 3.6-3 8-3Zm6 6.2C16.5 9 14.4 9.5 12 9.5S7.5 9 6 8.2V11c0 .6 2.4 1.6 6 1.6s6-1 6-1.6V8.2Zm0 6c-1.5.8-3.6 1.3-6 1.3s-4.5-.5-6-1.3V17c0 .6 2.4 1.6 6 1.6s6-1 6-1.6v-2.8Z',
  lock: 'M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3Z',
  arrow: 'M13.2 5.3 20 12l-6.8 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z',
};
const ICON_ROW = [['national-emergency-999', 'phone', 'c-red'], ['fire-service-102', 'fire', 'c-orange'], ['health-call-centre-16263', 'health', 'c-green'],
  ['women-children-violence-109', 'woman', 'c-pink'], ['child-helpline-1098', 'child', 'c-blue'], ['tourist-police-helpline', 'bag', 'c-teal'], ['info-service-333', 'info', 'c-slate']];
// Numbers that appear inside card text (situation cards); listed with their sources too.
const TEXT_NUMBERS = ['disaster-warning-1090'];
function iconCircle(path, cls) { const c = el('span', `circle ${cls}`); c.append(svg(path)); return c; }
// Round icon row: national numbers from data/national_hotlines.json (tap = call), plus "send location" and "help near me".
// Under it, the official source and check date of each number (DESIGN.md §5).
function renderIconRow() {
  const items = [], shown = [];
  if (data) {
    for (const [id, ic, cls] of ICON_ROW) {
      const n = data.national.find((x) => x.id === id);
      if (!n || !withPhone(n)) continue;
      const a = el('a', 'icon-item'); a.href = `tel:${n.phones[0]}`;
      a.append(iconCircle(GP_ICONS[ic], cls), el('b', null, P().icons[id]), el('small', null, digits(n.phones[0])));
      items.push(a); shown.push(n);
    }
    for (const id of TEXT_NUMBERS) { const n = data.national.find((x) => x.id === id); if (n && withPhone(n)) shown.push(n); }
  }
  const act = (label, sub, ic, cls, fn) => { const b = el('button', 'icon-item'); b.type = 'button'; b.append(iconCircle(GP_ICONS[ic], cls), el('b', null, label), el('small', null, sub)); b.addEventListener('click', fn); return b; };
  items.splice(1, 0, act(P().iconSend, P().iconSendSub, 'send', 'c-violet', () => openSos(null)), act(P().iconNear, P().iconNearSub, 'pin', 'c-amber', () => locate()));
  $('iconRow').replaceChildren(...items);
  $('iconSrc').hidden = !shown.length;
  $('iconSrcTitle').textContent = P().iconSrc;
  $('iconSrcList').replaceChildren(...shown.map((n) => {
    const line = el('p', 'src');
    const a = el('a', null, `${t().source} ↗`); a.href = n.source_url; a.target = '_blank'; a.rel = 'noopener';
    line.append(`${P().icons[n.id]} (${digits(n.phones[0])}): `, a, ` · ${t().checked} ${fmtDate(n.checked_on)}`);
    return line;
  }));
}

function primaryBtn(label, fn, href) {
  const b = el(href ? 'a' : 'button', 'btn-primary');
  if (href) { b.href = href; b.target = '_blank'; b.rel = 'noopener'; } else { b.type = 'button'; b.addEventListener('click', fn); }
  b.append(document.createTextNode(label), svg(GP_ICONS.arrow));
  return b;
}
// "What happened?" cards. Numbers in the text come from data/national_hotlines.json, never typed in (CLAUDE.md rule 1).
function renderGuides() {
  $('guideTitle').textContent = P().guideTitle; $('guideText').textContent = P().guideText;
  const num = (id) => data?.national.find((x) => x.id === id)?.phones?.[0];
  const n = num('fire-service-102') && num('disaster-warning-1090') ? { fire: digits(num('fire-service-102')), warn: digits(num('disaster-warning-1090')) } : null;
  const actions = { sos: () => openSos(null), find: () => findArea(''), locate: () => { goHome(); window.scrollTo(0, 0); locate(); } };
  $('guideCards').replaceChildren(...P().guides.map(([art, title, text, btn, act]) => {
    const c = el('article', 'card');
    const body = el('div', 'body');
    body.append(el('h3', null, title), el('p', null, typeof text === 'function' ? text(n) : text), primaryBtn(btn, actions[act]));
    c.append(el('div', `art ${art}`), body);
    return c;
  }));
}

// Two side cards: save family numbers · report a wrong number.
function renderDuo() {
  const [[ic1, t1, p1, b1], [ic2, t2, p2, b2]] = P().duo;
  const card = (ic, cls, title, text, btn) => {
    const c = el('div', 'duo-card'); const d = el('div');
    d.append(el('h3', null, title), el('p', null, text), btn);
    const badge = el('span', `badge-ic ${cls}`); badge.append(svg(GP_ICONS[ic]));
    c.append(d, badge); return c;
  };
  $('duoCards').replaceChildren(card(ic1, 'c-violet', t1, p1, primaryBtn(b1, saveNumbers)), card(ic2, 'c-amber', t2, p2, primaryBtn(b2, null, SITE.report)));
}
function renderHelp() {
  $('helpTitle').textContent = P().helpTitle;
  const [q, src, priv, rep] = P().help;
  const item = (label, ic, fn, href) => {
    const b = el(href ? 'a' : 'button', 'help-item');
    if (href) { b.href = href; b.target = '_blank'; b.rel = 'noopener'; } else { b.type = 'button'; b.addEventListener('click', fn); }
    const c = el('span', 'circle'); c.append(svg(GP_ICONS[ic])); b.append(c, el('span', null, label)); return b;
  };
  $('helpRow').replaceChildren(item(q, 'question', () => goTo('faq')), item(src, 'db', () => openFaq('source')), item(priv, 'lock', () => openFaq('privacy')), item(rep, 'flag', null, SITE.report));
}
// Weak-network band: only what works today gets a tick; the rest says "coming soon" (DESIGN.md §2).
function renderNet() {
  $('netTitle').textContent = P().netTitle;
  $('netList').replaceChildren(...P().net.map(([k, text]) => el('li', k === 'soon' ? 'soon' : null, text)));
}

// Warm opening (DESIGN.md §2): greeting by time of day, trust ticks, a one-time welcome that never covers 999.
function renderWarm() {
  const h = new Date().getHours();
  const part = h >= 21 || h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'noon' : 'evening';
  const dot = el('span', 'dot', part === 'night' ? '☾' : '☀');
  dot.setAttribute('aria-hidden', 'true');
  $('greet').replaceChildren(dot, document.createTextNode(part === 'night' ? P().greet.night : `${P().greet[part]}! ${P().greetTail}`));
  $('trust').replaceChildren(...P().trust.map((x) => el('li', null, x)));
  const w = $('welcome');
  w.hidden = store.get('sc-welcomed') === '1';
  if (w.hidden) return;
  const close = () => { store.set('sc-welcomed', '1'); w.hidden = true; };
  const ok = el('button', 'btn', P().welcomeOk); ok.type = 'button';
  ok.addEventListener('click', close);
  const save = el('button', 'btn violet', P().welcomeSave); save.type = 'button';
  save.addEventListener('click', () => { close(); saveNumbers(); });
  const ol = el('ol'); P().welcomeSteps.forEach((x) => ol.append(el('li', null, x)));
  const row = el('div', 'row'); row.append(save, ok);
  const title = el('h2', null, P().welcomeTitle); title.id = 'welcomeTitle';
  w.replaceChildren(title, ol, row);
}
function renderPage() {
  renderWarm(); renderIconRow(); renderGuides(); renderDuo(); renderHelp(); renderNet(); renderNav(); renderAbout(); renderFaq(); renderFooter();
  $('findTitle').textContent = P().findTitle; $('findText').textContent = P().findText;
}

/* ---------- text ---------- */
function setText() {
  const s = t();
  document.documentElement.lang = lang;
  $('langBtn').textContent = s.lang;
  $('hello1').textContent = s.hello1; $('hello2').textContent = s.hello2;
  $('eyebrow').textContent = s.eyebrow; $('lead').textContent = s.lead; $('h999Text').textContent = s.h999;
  $('quickEyebrow').textContent = s.quickEyebrow; $('quickTitle').textContent = s.quickTitle; $('quickText').textContent = s.quickText;
  const dv = $('distSel').value;
  $('distSel').replaceChildren(...[['', s.distAll], ...DISTRICTS.map((d) => [d.key, lang === 'bn' ? d.bn : d.en])].map(([v, l]) => { const o = el('option', null, l); o.value = v; return o; }));
  $('distSel').value = dv;
  $('call999Title').textContent = s.call999; $('call999Sub').textContent = s.call999Sub;
  $('locateTitle').textContent = s.locate; $('locateSub').textContent = s.locateSub;
  $('orText').textContent = s.or;
  $('areaLabel').textContent = s.areaLabel; $('areaHint').textContent = s.areaHint; $('areaInput').placeholder = s.areaLabel; $('areaInput').setAttribute('aria-label', s.areaLabel);
  $('backBtn').textContent = s.back; $('changeBtn').textContent = s.change;
  $('shareTitle').textContent = s.shareTitle; $('shareText').textContent = s.shareText;
  $('firstTitle').textContent = s.first; $('firstCalm').textContent = s.firstCalm; $('moreTitle').textContent = s.more;
  $('sosBtnTitle').textContent = s.sosBtn;
  $('sosBack').textContent = s.back; $('sosTitle').textContent = s.sosTitle;
  $('sitTitle').textContent = s.sit; $('locTitle').textContent = s.loc; $('sendTitle').textContent = s.send; $('msgTitle').textContent = s.msgT;
  $('smsHint').textContent = s.smsHint; $('peopleTitle').textContent = s.people;
  $('lblName').textContent = s.name; $('lblRel').textContent = s.rel; $('lblPhone').textContent = s.phone; $('saveBtn').textContent = s.save;
  $('privacy').textContent = s.privacy;
  renderHomeSos();
  renderPage();
}

$('locateBtn').addEventListener('click', locate);
$('areaInput').addEventListener('input', renderSuggest);
$('distSel').addEventListener('change', renderSuggest);
$('backBtn').addEventListener('click', goHome);
$('homeBtn').addEventListener('click', goHome);
$('changeBtn').addEventListener('click', () => { goHome(); $('areaInput').focus(); });
$('langBtn').addEventListener('click', () => {
  lang = lang === 'bn' ? 'en' : 'bn';
  store.set('sc-lang', lang);
  setText();
  if (!$('demo').hidden) showDemo();
  if (data) { renderRecent(); renderSuggest(); renderStats(); renderPlaces(); if (current) renderArea(); }
  if (!$('sos').hidden) { renderSituations(); renderLoc(); renderPeople(); refreshMessage(); if (!$('sosDemo').hidden) fillDemo($('sosDemo'), $('sosDemoText'), $('sosDemoChips'), setSosPos); }
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
  renderRecent(); renderStats(); renderPlaces(); renderIconRow(); renderGuides();
} catch (err) {
  msg(`${err.message}. Please reload the page.`);
}
