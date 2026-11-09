// Bangla, English and Banglish search on the real index (js/phonetic.js wired into js/data.js; kit from Claude chat, 9 Nov).
// Run: node --test tests/phonetic/phonetic-test.mjs (no browser, no network: fetch reads data/ from disk).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAll, areaIndex, findAreas, norm } from '../../js/data.js';

globalThis.fetch = async (url) => {
  try { const body = readFileSync(url, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; }
  catch { return { ok: false, status: 404, json: async () => ({}) }; }
};
const index = areaIndex(await loadAll('data/'));
const N = (s) => norm(s).replace(/\s*(ইউনিয়ন|পৌরসভা)$/, '');
const nameOf = (h) => N(h.village || h.named?.name_bn || h.place.area?.bn || '');
const placeOf = (h) => `${h.place.district}|${h.place.upazila}|${N(h.place.area?.bn || '')}`;
const hits = (q) => findAreas(index, q).hits;

// The kit's 51 queries: the Bangla name must be among the real results (not only "similar names").
const KIT = [
  ['sahapur', 'সাহাপুর'], ['shahapur', 'সাহাপুর'], ['himchari', 'হিমছড়ি'], ['himchori', 'হিমছড়ি'], ['krishnapur', 'কৃষ্ণপুর'],
  ['karimpur', 'করিমপুর'], ['dharmapur', 'ধর্মপুর'], ['dhormopur', 'ধর্মপুর'], ['neyajpur', 'নিয়াজপুর'], ['niazpur', 'নিয়াজপুর'],
  ['chowmuhani', 'চৌমুহনী'], ['choumuhoni', 'চৌমুহনী'], ['maijdee', 'মাইজদী'], ['maijdi', 'মাইজদী'], ['hatiya', 'হাতিয়া'], ['hatia', 'হাতিয়া'],
  ['teknaf', 'টেকনাফ'], ['ukhia', 'উখিয়া'], ['maheshkhali', 'মহেশখালী'], ['moheshkhali', 'মহেশখালী'], ['kutubdia', 'কুতুবদিয়া'],
  ['chakaria', 'চকরিয়া'], ['chokoria', 'চকরিয়া'], ['pekua', 'পেকুয়া'], ['ramu', 'রামু'], ['senbagh', 'সেনবাগ'], ['sonaimuri', 'সোনাইমুড়ী'],
  ['companiganj', 'কোম্পানীগঞ্জ'], ['kabirhat', 'কবিরহাট'], ['subarnachar', 'সুবর্ণচর'], ['chatkhil', 'চাটখিল'], ['begumganj', 'বেগমগঞ্জ'],
  ['noakhali', 'নোয়াখালী'], ['coxsbazar', 'কক্সবাজার'], ['koksbajar', 'কক্সবাজার'], ['jaliapalong', 'জালিয়াপালং'], ['ratnapalong', 'রত্নাপালং'],
  ['rotnapalong', 'রত্নাপালং'], ['sabrang', 'সাবরাং'], ['baharchhara', 'বাহারছড়া'], ['baharchora', 'বাহারছড়া'], ['khuniapalong', 'খুনিয়াপালং'],
  ['matarbari', 'মাতারবাড়ী'], ['dhalghata', 'ধলঘাটা'], ['kutubjom', 'কুতুবজোম'], ['amtoli', 'আমতলী'], ['amtali', 'আমতলী'], ['katakhali', 'কাটাখালী'],
  ['inani', 'ইনানী'], ['shahporir dwip', 'শাহপরীর'], ['saint martin', 'সেন্ট মার্টিন'], ['hnila', 'হ্নীলা'], ['whykong', 'হোয়াইক্যং'],
];
// Upazilas are named in English in the index; their Bangla names come from the district files.
const UPAZILA_BN = new Map();
for (const d of ['noakhali', 'coxsbazar']) for (const u of JSON.parse(readFileSync(`data/contacts_${d}.json`, 'utf8')).unions) UPAZILA_BN.set(u.upazila_en, norm(u.upazila_bn));
const textOf = (h) => norm([nameOf(h), h.place.area?.bn, UPAZILA_BN.get(h.place.upazila), h.place.upazila, ...(h.names || [])].filter(Boolean).join(' '));

test(`the kit's ${KIT.length} Banglish/English queries find their place`, () => {
  const miss = KIT.filter(([q, want]) => !hits(q).some((h) => textOf(h).includes(norm(want))));
  assert.deepEqual(miss, []);
});

test('sahapur: both সাহাপুর places, in English, Banglish and Bangla', () => {
  for (const q of ['sahapur', 'shahapur', 'সাহাপুর']) {
    const h = hits(q).filter((x) => nameOf(x) === norm('সাহাপুর'));
    assert.ok(h.some((x) => x.kind === 'union' && x.place.upazila === 'Chatkhil'), `${q}: Chatkhil union`);
    assert.ok(h.some((x) => x.kind === 'village' && x.place.upazila === 'Noakhali Sadar' && N(x.place.area.bn) === norm('নিয়াজপুর')), `${q}: Niazpur village`);
  }
});

test('sahapur noakhali sadar: the নিয়াজপুর village first', () => {
  const [first] = hits('sahapur noakhali sadar');
  assert.equal(first?.kind, 'village');
  assert.equal(N(first.place.area.bn), norm('নিয়াজপুর'));
});

test('krishnapur: both কৃষ্ণপুর villages', () => {
  const ups = new Set(hits('krishnapur').filter((h) => h.kind === 'village' && nameOf(h).endsWith(norm('কৃষ্ণপুর'))).map((h) => h.place.upazila));
  assert.ok(ups.has('Noakhali Sadar') && ups.has('Sonaimuri'), [...ups].join(','));
});

test('himchari and himchori find হিমছড়ি', () => {
  for (const q of ['himchari', 'himchori']) assert.equal(nameOf(hits(q)[0] || { place: {} }), norm('হিমছড়ি'), q);
});

// Kolatoli (Cox's Bazar) is not in our data yet; today only কালিতলা (a Chatkhil mosque) sounds like it. Step 3 adds the
// tourist spots from the official portals; then this must pass.
test('kolatoli: nothing from Noakhali first', { todo: 'Kolatoli is added with the tourist spots (coverage fix, step 3)' }, () => {
  for (const q of ['kolatoli', 'কলাতলী']) assert.notEqual(hits(q)[0]?.place.district, 'noakhali', q);
});

test('every Bangla name of a village, union and town finds itself', () => {
  const miss = [...new Set(index.filter((h) => ['village', 'union', 'municipality'].includes(h.kind)).map(nameOf))]
    .filter((n) => n.length >= 2 && !hits(n).some((h) => nameOf(h) === n));
  assert.deepEqual(miss, []);
});

test('bazar, char and hat alone find nothing', () => {
  for (const q of ['bazar', 'বাজার', 'char', 'চর', 'hat', 'হাট']) assert.equal(hits(q).length, 0, q);
});

// A plain Banglish spelling of a Bangla name, written the way people type it (not the search's own key code).
const ROMAN = { 'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou', 'া': 'a', 'ি': 'i', 'ী': 'i',
  'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou', 'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng', 'চ': 'ch', 'ছ': 'chh',
  'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n', 'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n', 'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n', 'প': 'p',
  'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm', 'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'r', 'য়': 'y',
  'ৎ': 't', 'ং': 'ng', 'ঃ': '', 'ঁ': '', '্': '' };
// ড়, ঢ় and য় are stored as a letter + nukta (NFC keeps them in two parts), so they become R/Y first.
const roman = (bn) => bn.normalize('NFC').replace(/[ডঢ]়|[ড়ঢ়]/g, 'R').replace(/য়|য়/g, 'Y')
  .replace(/([ক-হRY])(?![া-ৌ্ঁংঃ])/g, '$1a')                       // a consonant without a vowel sign says "a"
  .replace(/./gu, (c) => (c === 'R' ? 'r' : c === 'Y' ? 'y' : c in ROMAN ? ROMAN[c] : c))
  .replace(/a(?=\s|$)/g, '').replace(/\s+/g, ' ').trim();

// Every name used in more than one place (villages, unions, towns): each place shows, in Bangla and in Banglish.
const places = new Map();
for (const h of index) {
  if (!['village', 'union', 'municipality'].includes(h.kind)) continue;
  const n = nameOf(h);
  if (!places.has(n)) places.set(n, new Set());
  places.get(n).add(placeOf(h));
}
const MULTI = [...places].filter(([, p]) => p.size > 1);

for (const [label, typed] of [['Bangla', (n) => n], ['Banglish', roman]]) {
  test(`all ${MULTI.length} names used in more than one place show every place (${label})`, () => {
    const miss = [];
    for (const [n, p] of MULTI) {
      const got = new Set(hits(typed(n)).filter((h) => nameOf(h) === n).map(placeOf));
      for (const x of p) if (!got.has(x)) miss.push(`${typed(n)} (${n}) @ ${x}`);
    }
    assert.deepEqual(miss, []);
  });
}
