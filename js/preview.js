// Logic for preview.html: the team's design (issue #38). The real site (index.html, pages/) is built in P20-P36.
// Location is read only after a tap (CLAUDE.md rule 5). The area search lives in data.js (issue #36).
import { DISTRICTS, loadAll, upazilas, localAreas, areaContacts, norm, areaIndex as buildAreaIndex, findAreas } from './data.js';
import { loadLocations, getPosition, nearestPlace, mapsLink } from './location.js';

const T = {
  bn: {
    lang: 'EN', hello1: 'বিপদে আছেন?', hello2: 'আপনার এলাকার সরকারি নম্বর এক জায়গায়',
    eyebrow: 'নোয়াখালী · কক্সবাজার · লোকেশন খুঁজতে ইন্টারনেট লাগে না', h999: '৯৯৯',
    lead: 'প্রতিটি ইউনিয়নের থানা, চেয়ারম্যান, গ্রাম পুলিশ ও হাসপাতালের নম্বর, সব সরকারি ওয়েবসাইট থেকে নেওয়া।',
    distAll: 'সব জেলা',
    stats: ['সরকারি নম্বর', 'ইউনিয়ন ও পৌরসভা', 'উপজেলা', 'যাচাই করা হয়েছে'],
    quickEyebrow: 'দ্রুত যান', quickTitle: 'পরিচিত জায়গা', quickText: 'এক চাপে সেই এলাকার থানা ও জরুরি নম্বর দেখুন।',
    places: { chowmuhani: ['চৌমুহনী', 'বেগমগঞ্জ, নোয়াখালী'], inani: ['ইনানী সৈকত', 'উখিয়া, কক্সবাজার'], hatiya: ['হাতিয়া', 'দ্বীপ উপজেলা, নোয়াখালী'], coxtown: ['কক্সবাজার শহর', 'পৌরসভা'] },
    ctaEyebrow: 'আগে থেকে প্রস্তুত থাকুন', ctaTitle: 'প্রিয়জনের নম্বর এখনই সেভ করে রাখুন',
    ctaText: 'বিপদের সময় নম্বর খোঁজার সময় থাকে না। একবার সেভ করলে এক চাপেই আপনার অবস্থান তাদের কাছে যাবে। লগইন লাগে না।', ctaBtn: 'নম্বর সেভ করুন',
    call999: '৯৯৯-এ কল করুন', call999Sub: 'পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স · বিনা খরচে',
    locate: 'আমার কাছের সাহায্য', locateSub: 'আপনার এলাকার থানা, চেয়ারম্যান ও গ্রাম পুলিশের নম্বর · ইন্টারনেট ছাড়াও চলে',
    locating: 'আপনার অবস্থান খোঁজা হচ্ছে…', or: 'অথবা',
    areaLabel: 'এলাকার নাম লিখুন', areaHint: 'গ্রাম, ইউনিয়ন, পৌরসভা বা উপজেলা, বাংলা বা ইংরেজিতে, যেকোনো বানানে। যেমন: চৌমুহনী, Hatiya, ইনানী',
    noMatch: 'এই নামে কোনো জায়গা তালিকায় নেই। তবুও সাহায্য পাবেন:', didYouMean: 'কাছাকাছি নাম', noExact: 'ঠিক এই বানানে পাইনি। নিচের কোনোটি কি আপনার জায়গা?', tellUs: 'আপনার জায়গার নাম তালিকায় না থাকলে নিচের "ভুল নম্বর জানান" দিয়ে জানান, আমরা যোগ করব।',
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
    lang: 'বাং', hello1: 'Need help?', hello2: 'Official numbers for your area, in one place',
    eyebrow: "Noakhali · Cox's Bazar · finding your location needs no internet", h999: '999',
    lead: 'Police station, chairman, village police and hospital numbers for every union, all taken from official government websites.',
    distAll: 'All districts',
    stats: ['official numbers', 'unions and towns', 'upazilas', 'last checked'],
    quickEyebrow: 'Quick go', quickTitle: 'Known places', quickText: "One tap shows that area's police and emergency numbers.",
    places: { chowmuhani: ['Chowmuhani', 'Begumganj, Noakhali'], inani: ['Inani beach', "Ukhia, Cox's Bazar"], hatiya: ['Hatiya', 'Island upazila, Noakhali'], coxtown: ["Cox's Bazar town", 'Municipality'] },
    ctaEyebrow: 'Be ready before you need it', ctaTitle: 'Save your family\'s numbers now',
    ctaText: 'In an emergency there is no time to look for numbers. Save them once and your location reaches them in one tap. No login.', ctaBtn: 'Save numbers',
    call999: 'Call 999', call999Sub: 'Police, fire service, ambulance · free',
    locate: 'Find help near me', locateSub: 'Numbers for your police station, chairman and village police · works without internet',
    locating: 'Finding your location…', or: 'or',
    areaLabel: 'Type your area', areaHint: 'Village, union, town or upazila, in Bangla or English, any spelling. For example: Chowmuhani, হাতিয়া, Inani',
    noMatch: 'This name is not in our list yet. You can still get help:', didYouMean: 'Similar names', noExact: 'Not found with this exact spelling. Is it one of these?', tellUs: 'If your place is missing, tell us with "Report a wrong number" below and we will add it.',
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
$('ctaBtn').addEventListener('click', () => { openSos(null); $('peopleBox').open = true; setTimeout(() => $('peopleBox').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); });


const PAGE = {
  bn: { nav: ['হোম', 'এলাকা খুঁজুন', 'প্রিয়জনকে লোকেশন'] },
  en: { nav: ['Home', 'Find area', 'Send location'] },
};
const P = () => PAGE[lang];
function findArea(district) { goHome(); $('distSel').value = district || ''; setTimeout(() => { $('areaInput').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('areaInput').focus({ preventScroll: true }); }, 30); renderSuggest(); }
const textBtn = (label, fn) => { const b = el('button', null, label); b.type = 'button'; b.addEventListener('click', fn); return b; };

function renderNav() {
  const [home, area, send] = P().nav;
  $('nav').replaceChildren(textBtn(home, goHome), textBtn(area, () => findArea('')), textBtn(send, () => openSos(null)));
}
function renderPage() { renderNav(); }

/* ---------- text ---------- */
function setText() {
  const s = t();
  document.documentElement.lang = lang;
  $('langBtn').textContent = s.lang;
  $('hello1').textContent = s.hello1; $('hello2').textContent = s.hello2;
  $('eyebrow').textContent = s.eyebrow; $('lead').textContent = s.lead; $('h999Text').textContent = s.h999;
  $('quickEyebrow').textContent = s.quickEyebrow; $('quickTitle').textContent = s.quickTitle; $('quickText').textContent = s.quickText;
  $('ctaEyebrow').textContent = s.ctaEyebrow; $('ctaTitle').textContent = s.ctaTitle; $('ctaText').textContent = s.ctaText; $('ctaBtnText').textContent = s.ctaBtn;
  const dv = $('distSel').value;
  $('distSel').replaceChildren(...[['', s.distAll], ...DISTRICTS.map((d) => [d.key, lang === 'bn' ? d.bn : d.en])].map(([v, l]) => { const o = el('option', null, l); o.value = v; return o; }));
  $('distSel').value = dv;
  $('call999Title').textContent = s.call999; $('call999Sub').textContent = s.call999Sub;
  $('locateTitle').textContent = s.locate; $('locateSub').textContent = s.locateSub;
  $('orText').textContent = s.or;
  $('areaLabel').textContent = s.areaLabel; $('areaHint').textContent = s.areaHint; $('areaInput').placeholder = s.areaLabel; $('areaInput').setAttribute('aria-label', s.areaLabel);
  $('backBtn').textContent = s.back; $('changeBtn').textContent = s.change;
  $('shareTitle').textContent = s.shareTitle; $('shareText').textContent = s.shareText;
  $('firstTitle').textContent = s.first; $('moreTitle').textContent = s.more;
  $('sosBtnTitle').textContent = s.sosBtn;
  $('sosBack').textContent = s.back; $('sosTitle').textContent = s.sosTitle;
  $('sitTitle').textContent = s.sit; $('locTitle').textContent = s.loc; $('sendTitle').textContent = s.send; $('msgTitle').textContent = s.msgT;
  $('smsHint').textContent = s.smsHint; $('peopleTitle').textContent = s.people;
  $('lblName').textContent = s.name; $('lblRel').textContent = s.rel; $('lblPhone').textContent = s.phone; $('saveBtn').textContent = s.save;
  $('privacy').textContent = s.privacy;
  $('foot1').textContent = s.foot1; $('foot2').textContent = s.credit; $('testsLink').textContent = s.testsLink;
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
  renderRecent(); renderStats(); renderPlaces();
} catch (err) {
  msg(`${err.message}. Please reload the page.`);
}
