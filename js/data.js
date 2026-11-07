// SafeConnect data module: loads the data files and answers
// "who should I call here?" in fallback-chain order (docs/BUILD_PLAN.md §4).

export const DISTRICTS = [
  { key: 'noakhali', file: 'contacts_noakhali.json', en: 'Noakhali', bn: 'নোয়াখালী' },
  { key: 'coxsbazar', file: 'contacts_coxsbazar.json', en: "Cox's Bazar", bn: 'কক্সবাজার' },
];

// Government pages store some Bangla letters (e.g. য়) in two different ways.
export const norm = (s) => (s || '').normalize('NFC').trim();
const toAsciiDigits = (s) => s.replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d));
const wardNumber = (r) => parseInt(toAsciiDigits(r.ward_no || ''), 10) || 99;

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.json();
}

// Hand-entered records are optional: the site still works if the file is missing.
const noManual = { records: [], places: [] };

// A district file that fails to load is left out (listed in `missing`), so the
// national hotlines and the other district still work.
export async function loadAll(base = 'data/') {
  const [national, manual, villages, aliases, thanas, ...files] = await Promise.all([
    getJSON(`${base}national_hotlines.json`),
    getJSON(`${base}manual_additions.json`).catch(() => noManual),
    getJSON(`${base}villages.json`).catch(() => ({ unions: [] })),       // official village lists (optional)
    getJSON(`${base}aliases.json`).catch(() => ({ aliases: [] })),       // local names added by the team (optional)
    getJSON(`${base}thanas.json`).catch(() => ({ thanas: [] })),         // thana -> upazila, official sources (#153, optional)
    ...DISTRICTS.map((d) => getJSON(base + d.file).catch(() => null)),
  ]);
  const docs = {};
  const missing = [];
  DISTRICTS.forEach((d, i) => {
    const doc = files[i];
    if (!doc) { missing.push(d.key); return; }
    doc.records = doc.records.concat(manual.records.filter((r) => r.district === doc.district));
    doc.places = (manual.places || []).filter((p) => p.district === doc.district);
    for (const r of doc.records) r._text = searchText(r, d);
    docs[d.key] = doc;
  });
  const nationalCards = national.records.map((r) => nationalCard(r, national.retrieved_on));
  for (const c of nationalCards) c._text = norm([c.name_bn, c.name_en, c.designation_bn, ...c.phones].join(' ')).toLowerCase();
  // villages.json lists the villages per union: [[village_bn, ward_no], ...] with one source page per union.
  const officialVillages = (villages.unions || []).flatMap((u) => u.villages.map(([name, ward]) => ({
    district: u.district, upazila_bn: u.upazila_bn, union_bn: u.union_bn, union_en: u.union_en,
    village_bn: name, ward_no: ward, source_url: u.source_url })));
  return { national: nationalCards, docs, missing, villages: officialVillages, aliases: aliases.aliases || [], thanas: thanas.thanas || [] };
}

function nationalCard(r, checkedOn) {
  return {
    id: r.id, kind: 'national', category: r.category, name_bn: r.name_bn, name_en: r.name_en,
    designation_bn: r.summary_en, office_bn: '', phones: r.numbers, flags: [],
    source_url: r.source_url, checked_on: checkedOn, toll_free: r.toll_free, hours: r.hours,
  };
}

function searchText(r, district) {
  return norm([r.name_bn, r.designation_bn, r.office_bn, r.union_bn, r.union_en, r.upazila_bn, r.upazila_en,
    r.municipality_bn, district.en, district.bn, ...(r.phones || [])].join(' ')).toLowerCase();
}

export function upazilas(doc) {
  const seen = new Map();
  for (const u of doc.unions) seen.set(u.upazila_en, norm(u.upazila_bn));
  for (const r of doc.records) if (r.upazila_en && !seen.has(r.upazila_en)) seen.set(r.upazila_en, norm(r.upazila_bn));
  // Sadar upazilas are always "… সদর", never just the district's name ("নোয়াখালী সদর", #151; the data says "নোয়াখালী").
  const sadar = (en, bn) => (/ Sadar$/.test(en) && !bn.includes(norm('সদর')) ? `${bn} ${norm('সদর')}` : bn);
  return [...seen].map(([en, bn]) => ({ en, bn: sadar(en, bn) })).sort((a, b) => a.en.localeCompare(b.en));
}

// Unions and municipalities (towns) inside one upazila.
export function localAreas(doc, upazilaEn) {
  const unions = doc.unions.filter((u) => u.upazila_en === upazilaEn)
    .map((u) => ({ type: 'union', bn: norm(u.union_bn), en: u.union_en }));
  const towns = doc.municipalities.filter((m) => m.upazila_en === upazilaEn)
    .map((m) => ({ type: 'municipality', bn: norm(m.municipality_bn), en: null }));
  return [...towns, ...unions.sort((a, b) => (a.en || '').localeCompare(b.en || ''))];
}

const has = (r, ...words) => words.some((w) => norm(r.designation_bn).includes(norm(w)));
const withPhone = (r) => r.phones && r.phones.length > 0;

// Upazila portals sometimes list the heads of other offices among their own officers
// (e.g. Eidgaon lists its police station OC). Put those people in the right group.
function categoryOf(r) {
  if (r.category !== 'administration' || r.level !== 'upazila') return r.category;
  if (has(r, 'ইনচার্জ') && r.phones.some((p) => p.startsWith('01320'))) return 'police';
  if (has(r, 'স্বাস্থ্য', 'মেডিকেল')) return 'health';
  if (has(r, 'মহিলা বিষয়ক')) return 'women_children';
  if (has(r, 'প্রকল্প বাস্তবায়ন')) return 'disaster';
  return 'administration';
}

// Lower rank = shown first.
function policeRank(r, placeWord) {
  if (placeWord && norm(r.designation_bn).includes(placeWord)) return 0;
  if (has(r, 'ইনচার্জ')) return 1;
  if (has(r, 'ডিউটি')) return 2;
  if (has(r, 'ফাঁড়ি', 'ফাড়ি')) return 3;
  if (has(r, 'পরিদর্শক', 'ইন্সপেক্টর')) return 4;
  return 5;
}

function localRank(r) {
  if (has(r, 'চেয়ারম্যান', 'প্রশাসক')) return 0;
  if (has(r, 'মেম্বার', 'সদস্য')) return 1;
  if (r.category === 'union_office') return 2;
  return 3;
}

const keyFirst = (a, b) => (b.key_contact === true) - (a.key_contact === true);
const phoneFirst = (a, b) => withPhone(b) - withPhone(a);

/**
 * Contacts for one place, grouped in the order a person in danger should call.
 * place = { district, upazila, area: { type: 'union' | 'municipality', bn } | null }
 */
export function areaContacts(data, place) {
  const doc = data.docs[place.district];
  const R = doc.records;
  const nat = (id) => data.national.filter((n) => n.id === id);
  const inUpazila = (r) => r.upazila_en === place.upazila && r.level === 'upazila';
  const district = (cat) => R.filter((r) => r.level === 'district' && r.category === cat && r.key_contact && withPhone(r));
  const area = place.area;
  const placeWord = area ? norm(area.bn).split(/[\s,]/)[0] : '';
  const groups = [];
  const add = (id, items, extra = {}) => { if (items.length) groups.push({ id, items, ...extra }); };

  add('emergency', nat('national-emergency-999'));

  const police = R.filter((r) => inUpazila(r) && categoryOf(r) === 'police' && withPhone(r))
    .sort((a, b) => policeRank(a, placeWord) - policeRank(b, placeWord));
  add('police', police.length ? police : district('police'), { fallback: !police.length });

  if (place.district === 'coxsbazar') {
    const tourist = R.filter((r) => r.category === 'tourist_police').sort(keyFirst);
    add('tourist_police', [...nat('tourist-police-helpline'), ...tourist]);
  }

  if (area && area.type === 'union') {
    const inUnion = R.filter((r) => r.level === 'union' && norm(r.union_bn) === area.bn);
    const vp = inUnion.filter((r) => r.category === 'village_police').sort((a, b) => wardNumber(a) - wardNumber(b));
    add('village_police', vp);
    const local = inUnion.filter((r) => ['local_representative', 'union_office'].includes(r.category))
      .sort((a, b) => phoneFirst(a, b) || localRank(a) - localRank(b) || wardNumber(a) - wardNumber(b));
    add('local', local, { noNumbers: !local.some(withPhone) });
    add('coast', inUnion.filter((r) => r.category === 'coast_river'));
  }
  if (area && area.type === 'municipality') {
    add('town', R.filter((r) => r.level === 'municipality' && norm(r.municipality_bn) === area.bn).sort(keyFirst));
  }

  const upz = (cat) => R.filter((r) => inUpazila(r) && categoryOf(r) === cat && withPhone(r)).sort(keyFirst);
  const admin = upz('administration');
  add('administration', admin.length ? admin : district('administration'), { fallback: !admin.length });
  const health = upz('health');
  add('health', [...(health.length ? health : district('health')), ...nat('health-call-centre-16263')], { fallback: !health.length });
  const fire = upz('fire');
  add('fire', [...(fire.length ? fire : district('fire')), ...nat('fire-service-102')], { fallback: !fire.length });
  add('women_children', [...upz('women_children'), ...nat('women-children-violence-109'), ...nat('child-helpline-1098')]);
  add('disaster', [...upz('disaster'), ...nat('disaster-warning-1090'), ...nat('coast-guard-16111')]);

  const shown = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
  add('helplines', data.national.filter((n) => !shown.has(n.id) && n.id !== 'info-service-333'));
  // Last step of the fallback chain (BUILD_PLAN §4): 333 gives the numbers of officials and representatives.
  add('info333', nat('info-service-333'));
  return groups;
}

// ---------- Area search: any spelling, Bangla or English, never a dead end (issue #36) ----------
// From the latest design. Sound key: Bangla and typed English both become a consonant skeleton, so
// "hasanhat", "hason haat" and "হাসান হাট" all become "hsnht", and "Hasanpur" / "হাছানপুর" become "hsnpr".
// A real match is the same text, or the same sound with 4+ letters. A close spelling is only a
// "similar name": it must start with the same sound and match the whole name, never one word inside it
// (so "maijdee" does not find "দক্ষিন চর মজিদ", and "babunagar" does not find "মনিনগর").

const BN_LAT = { 'ক': 'k', 'খ': 'k', 'গ': 'g', 'ঘ': 'g', 'ঙ': 'ng', 'চ': 'c', 'ছ': 's', 'জ': 'j', 'ঝ': 'j', 'ঞ': 'n', 'ট': 't', 'ঠ': 't',
  'ড': 'd', 'ঢ': 'd', 'ণ': 'n', 'ত': 't', 'থ': 't', 'দ': 'd', 'ধ': 'd', 'ন': 'n', 'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'b', 'ম': 'm',
  'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 's', 'ষ': 's', 'স': 's', 'হ': 'h', 'ৎ': 't', 'ং': 'ng' };
const BN_VOWEL = { 'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
  'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou' };
// Words that only say what kind of place it is. Built with norm(), because the data stores য় in two parts.
const GENERIC = new RegExp(`(${norm('ইউনিয়ন|পৌরসভা|পৌর|উপজেলা|জেলা|গ্রাম')}|\\bunion\\b|\\bup\\b|pourashava|paurashava|pourasava|`
  + 'municipality|upazila|upozila|\\bzila\\b|\\bdistrict\\b|\\bgram\\b|\\bvillage\\b|\\btown\\b)', 'gi');

// Bangla letters to plain Latin letters (য় is a vowel sound; ড় ঢ় sound like র; ক্ষ like ক).
// ব-ফলা (্ব) after a consonant is spoken as w or not at all: "দ্বীপ" = "dwip", not "dbip" (#151 review).
const bnToLatin = (w, withVowels) => w.replace(/(?<=[ক-হ])্ব/g, '').replace(/য়/g, withVowels ? 'y' : '').replace(/[ডঢ]়/g, 'র').replace(/ক্ষ/g, 'ক')
  .replace(/[ঀ-৿]/g, (ch) => BN_LAT[ch] ?? (withVowels ? BN_VOWEL[ch] ?? '' : ''));

export function wordKey(w) {
  const lead = /^[aeiouঅ-ঔ]/.test(w) ? '@' : '';   // a word that starts with a vowel keeps a marker: "inani", "ইনানী" -> "@n"
  let s = bnToLatin(w, false);
  s = s.replace(/c(?=[aou])/g, 'k');                          // English "cox": c before a/o/u sounds like k
  s = s.replace(/ch/g, 'c').replace(/sh/g, 's').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/th/g, 't').replace(/dh/g, 'd')
    .replace(/bh/g, 'b').replace(/ph/g, 'f').replace(/x/g, 'ks').replace(/z/g, 'j').replace(/q/g, 'k').replace(/v/g, 'b');
  s = s.replace(/[^a-z]/g, '').replace(/[aeiouwy]/g, '');
  return lead + s.replace(/(.)\1+/g, '$1');                   // "kks" -> "ks"
}

// "Cox's" -> "coxs": an apostrophe is not a word break.
const keyWords = (text) => norm(text).toLowerCase().replace(/['’]/g, '').replace(GENERIC, ' ').split(/[\s,.\-–()]+/).filter(Boolean);

export function soundKey(text) {
  return keyWords(text).map(wordKey).join('').replace(/(.)\1+/g, '$1');   // "coxs bazar" and "কক্সবাজার" -> "ksbjr"
}

// The name with its vowels, only to put same-sounding names in order (হাসানপুর before হোসেনপুর for "hasanpur").
function vowelForm(text) {
  return keyWords(text).map((w) => bnToLatin(w, true).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1')).join('');
}

export function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 9;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// Ward texts, numbers, a bare direction word ("পূর্ব" = east) or a bare "গ্রাম" are not village names.
const NOT_A_VILLAGE = new RegExp(`${norm('ওয়ার্ড|নং|বাড়ি|বাড়ী')}|[0-9০-৯]|^${norm('(পূর্ব|পশ্চিম|উত্তর|দক্ষিণ|দক্ষিন|মধ্য|গ্রাম)')}$`);

// Every searchable place: upazilas, unions, towns, named places, local names (data/aliases.json) and villages
// (official lists from data/villages.json first, then names from representatives' addresses).
export function areaIndex(data) {
  const items = [];
  const add = (item, names) => {
    names = names.filter(Boolean);
    item.words = norm(names.join(' ')).toLowerCase();
    const parts = names.flatMap((n) => [n, ...norm(n).split(/\s+/)]);
    item.keys = [...new Set(parts.map(soundKey).filter((k) => k.length >= 2))];       // whole names and single words
    item.fullKeys = [...new Set(names.map(soundKey).filter((k) => k.length >= 2))];   // whole names only
    item.vowels = names.map(vowelForm);
    item.names = names;
    items.push(item);
  };
  for (const d of DISTRICTS) {
    const doc = data.docs[d.key];
    if (!doc) continue;
    const ups = upazilas(doc);
    // Village and place lists name the upazila as the data does ("নোয়াখালী"), the site says "নোয়াখালী সদর": both lead to it.
    const upByBn = new Map(ups.flatMap((u) => [[norm(u.bn), u.en], [norm(u.bn.replace(/\s*সদর$/, '')), u.en]]));
    const areaOf = (upz, type, bn) => localAreas(doc, upz).find((a) => a.type === type && a.bn === norm(bn));
    for (const u of ups) {
      add({ kind: 'upazila', place: { district: d.key, upazila: u.en, area: null } }, [u.bn, u.en]);
      for (const a of localAreas(doc, u.en)) add({ kind: a.type, place: { district: d.key, upazila: u.en, area: a } }, [a.bn.split(/[,،]/)[0], a.en || '']);
    }
    for (const p of doc.places || []) {
      const upz = upByBn.get(norm(p.upazila_bn));
      if (upz) add({ kind: 'place', place: { district: d.key, upazila: upz, area: { type: 'union', bn: norm(p.union_bn) }, placeId: p.id }, named: p }, [p.name_bn, p.name_en]);
    }
    for (const th of (data.thanas || []).filter((x) => x.district === doc.district)) {
      if (!ups.some((u) => u.en === th.upazila_en)) continue;
      const core = norm(th.name_bn).replace(new RegExp(`\\s*(${norm('মডেল')}\\s*)?${norm('থানা')}$`), '');
      add({ kind: 'thana', place: { district: d.key, upazila: th.upazila_en, area: null }, named: th }, [th.name_bn, core, th.name_en || '']);
    }
    for (const a of (data.aliases || []).filter((x) => x.district === doc.district)) {
      // A local name links to its union or town only when that was confirmed; otherwise to the whole upazila.
      const area = (a.municipality_bn && areaOf(a.upazila_en, 'municipality', a.municipality_bn))
        || (a.union_bn && areaOf(a.upazila_en, 'union', a.union_bn)) || null;
      add({ kind: 'local', place: { district: d.key, upazila: a.upazila_en, area }, named: a }, [a.name_bn, a.name_en, ...(a.also || [])]);   // other spellings too (#149)
    }
    const seen = new Set();
    const official = (data.villages || []).filter((v) => v.district === doc.district);
    for (const v of official.concat(doc.villages || [])) {
      const name = norm(v.village_bn);
      const upz = upByBn.get(norm(v.upazila_bn));
      const area = upz && areaOf(upz, 'union', v.union_bn);
      const id = `${name}|${norm(v.union_bn)}`;
      if (!area || NOT_A_VILLAGE.test(name) || seen.has(id)) continue;
      seen.add(id);
      add({ kind: 'village', village: name, ward: v.ward_no || null, place: { district: d.key, upazila: upz, area } }, [name]);
    }
  }
  return items;
}

// Lower score = better. 0-2 text match, 3 same sound, 4 sound starts the same: these are real matches.
// 5+ is only a close spelling: shown under "Similar names", never as if it were the place.
export function scoreItem(item, s, key) {
  const w = item.words.split(/\s+/);
  if (w.some((x) => x === s)) return 0;
  if (w.some((x) => x.startsWith(s))) return 1;
  if (item.words.includes(s)) return 2;
  if (key.length < 2) return null;
  let best = null;
  const take = (sc) => { best = Math.min(best ?? 99, sc); };
  const strong = key.replace('@', '').length >= 4;               // short names sound alike too easily
  for (const k of item.keys) {
    if (strong && k === key) take(3);
    else if (strong && k.startsWith(key)) take(4);
  }
  for (const k of item.fullKeys) {                               // close spellings: whole name, same first sound
    if (k[0] !== key[0]) continue;
    if (k === key) take(5);
    else if (key.length >= 3) {
      const d = editDistance(key, k);
      if (d > Math.max(1, Math.floor(key.length / 3))) continue;
      const a = stripCommon(key), b = stripCommon(k);
      const common = a !== key || b !== k;
      if (common && (Math.min(a.length, b.length) < 3 ? a !== b : editDistance(a, b) > Math.max(1, Math.floor(a.length / 3)))) continue;
      take(5 + d);
    }
  }
  return best;
}

// Common place words (bazar, hat, para, char, school): a close spelling must match on the rest of the name too,
// so "kasehmbazar" never suggests "কক্সবাজার" just because both end in "bazar" (#145). "গ্রাম/gram" is already dropped.
const COMMON_KEYS = [...new Set(['বাজার', 'bazar', 'bajar', 'হাট', 'hat', 'পাড়া', 'para', 'চর', 'char', 'স্কুল', 'school', 'skul'].map(soundKey))]
  .sort((a, b) => b.length - a.length);
const stripCommon = (k) => { const c = COMMON_KEYS.find((x) => k.length > x.length && k.endsWith(x)); return c ? k.slice(0, -c.length) : k; };

const KIND_ORDER = { municipality: 0, local: 1, place: 1, union: 2, village: 3, upazila: 4, thana: 4 };

// { hits: real matches (best first), close: similar names } for one place name.
function matchName(index, q, { district = '' } = {}) {
  const s = norm(q).toLowerCase().trim();
  if (s.length < 2) return { hits: [], close: [] };
  const key = soundKey(s);
  const typed = vowelForm(s);
  const out = [];
  for (const item of index) {
    if (district && item.place.district !== district) continue;
    const sc = scoreItem(item, s, key);
    if (sc != null) out.push({ item, sc, near: Math.min(...item.vowels.map((v) => editDistance(typed, v))) });
  }
  out.sort((a, b) => a.sc - b.sc || a.near - b.near || (KIND_ORDER[a.item.kind] ?? 3) - (KIND_ORDER[b.item.kind] ?? 3));
  const seen = new Set();
  const uniq = out.filter(({ item }) => {
    const k = `${item.kind}|${item.village || ''}|${item.place.district}|${item.place.upazila}|${item.place.area?.bn || ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const hits = uniq.filter((x) => x.sc <= 4);
  const close = uniq.filter((x) => x.sc > 4);
  // A clear slip in a long name ("kasehmbazar"): one letter off, and nothing else that close, counts as the place (#151).
  if (!hits.length && close[0]?.sc === 6 && key.replace('@', '').length >= 6 && !(close[1]?.sc <= 6)) hits.push(close.shift());
  const top = hits.slice(0, 8);
  return { hits: top.map((x) => x.item), close: close.slice(0, 3).map((x) => x.item), scores: new Map(top.map((x) => [x.item, x.sc])) };
}

/* ---------- query understanding (#151) ---------- */
// Filler words say nothing about the place; common place words never match on their own.
const words = (list) => new Set(list.map((w) => norm(w).toLowerCase()));
const FILLER = words(['জেলা', 'উপজেলা', 'থানা', 'ইউনিয়ন', 'পৌরসভা', 'গ্রাম', 'এর', 'কাছে', 'কাছাকাছি', 'পাশে', 'er', 'kache', 'kase', 'kachhe',
  'near', 'nearby', 'zila', 'zilla', 'district', 'upazila', 'upozila', 'thana', 'union', 'village', 'gram', 'pourashava', 'municipality',
  'police', 'station', 'ps', 'পুলিশ', 'স্টেশন']);
const COMMON = words(['বাজার', 'bazar', 'bajar', 'হাট', 'hat', 'পাড়া', 'para', 'চর', 'char', 'স্কুল', 'school', 'skul', 'দ্বীপ', 'dwip', 'dip', 'island']);
// Direction words: part of a village name ("উত্তর শরীফপুর"), never a place on their own (#152 review 4)
const DIRECTION = words(['উত্তর', 'দক্ষিণ', 'দক্ষিন', 'পূর্ব', 'পশ্চিম', 'মধ্য', 'uttar', 'dakkhin', 'dakshin', 'purba', 'paschim', 'poschim', 'moddho', 'madhya', 'north', 'south', 'east', 'west', 'middle']);
const CTX_RANK = { district: 0, upazila: 1, thana: 1, municipality: 2, union: 3 };   // how precise a context is
const ctxCache = new WeakMap();
// Every name that can be context, by sound key and by exact text, with EVERY place of that name
// (two unions can share a name: নরোত্তমপুর in Begumganj and in Kabirhat).
function contextKeys(index) {
  if (ctxCache.has(index)) return ctxCache.get(index);
  const map = new Map();
  const put = (k, item) => { if (!k) return; if (!map.has(k)) map.set(k, []); if (!map.get(k).includes(item)) map.get(k).push(item); };
  const text = (n) => `=${norm(n).toLowerCase()}`;            // exact names, for short ones like "হাতিয়া" (sound key "ht")
  const strong = (k) => (k.replace('@', '').length >= 3 ? k : '');
  for (const d of DISTRICTS) {
    const it = { kind: 'district', place: { district: d.key, upazila: null, area: null } };
    for (const n of [d.bn, d.en]) { put(strong(soundKey(n)), it); put(text(n), it); }
  }
  // "পেকুয়া ইউনিয়ন" is also "পেকুয়া": a short Bangla union name is found by its text without the kind word (#152 review)
  const bare = (n) => { const w = norm(n).toLowerCase().split(/\s+/); return w.length > 1 && FILLER.has(w[w.length - 1]) ? w.slice(0, -1).join(' ') : ''; };
  for (const item of index) if (item.kind in CTX_RANK) {
    for (const k of item.fullKeys) put(strong(k), item);
    for (const n of item.names) { put(text(n), item); if (bare(n)) put(text(bare(n)), item); }
  }
  ctxCache.set(index, map);
  return map;
}
// Is this place inside that area? A thana counts as its upazila.
export function inContext(item, ctx) {
  const a = item.place, c = ctx.place;
  if (a.district !== c.district) return false;
  if (ctx.kind === 'district') return true;
  if (a.upazila !== c.upazila) return false;
  return ctx.kind === 'upazila' || ctx.kind === 'thana' || a.area?.bn === c.area?.bn;
}
// Split what the person typed: area words (each with all the places of that name), the place name, and filler.
export function understand(index, q) {
  const all = norm(q).toLowerCase().replace(/[,،।;]/g, ' ').split(/\s+/).filter(Boolean);
  const keys = contextKeys(index);
  const used = new Array(all.length).fill(false);
  const runs = [];                                                      // [[candidates of one area word], …]
  for (let i = 0; i < all.length; i++) {
    for (let n = Math.min(3, all.length - i); n >= 1; n--) {               // the longest name first: "নোয়াখালী সদর", then "নোয়াখালী"
      const run = all.slice(i, i + n);
      if (run.some((w) => FILLER.has(w)) || (n === 1 && COMMON.has(run[0]))) continue;
      // a word with almost no sound of its own ("Noannoi" -> "n") must not melt into a longer name ("… Noakhali Sadar")
      if (n > 1 && run.some((w) => wordKey(w).replace('@', '').length < 2)) continue;
      const said = run.join(' ');
      const key = soundKey(said);
      // exact text and sound together: an English name can be spelled oddly in the data ("Narottampurup1")
      const hit = [...new Set([...(keys.get(`=${said}`) || []), ...((key.replace('@', '').length >= 3 && keys.get(key)) || [])])];
      if (!hit.length) continue;
      runs.push(Object.assign(hit, { at: Array.from({ length: n }, (_, j) => i + j) }));
      for (let j = i; j < i + n; j++) used[j] = true;
      i += n - 1;
      break;
    }
  }
  const rest = all.filter((w, i) => !used[i] && !FILLER.has(w));
  return { all, runs, context: contextOf(runs), place: rest.join(' '), onlyCommon: rest.length > 0 && rest.every((w) => COMMON.has(w)) };
}
// Context = the places of the most precise area word that fit every other area word typed:
// "narottampur kabirhat" -> Narottampur union in Kabirhat only. If nothing fits, the broadest word alone.
function contextOf(runs) {
  if (!runs.length) return [];
  const rank = (c) => Math.max(...c.map((x) => CTX_RANK[x.kind]));
  const order = [...runs].sort((a, b) => rank(b) - rank(a));
  const fits = (x) => order.every((c) => c === order[0] || c.some((y) => y === x || inContext(x, y)));
  const ctx = order[0].filter(fits);
  if (ctx.length) return ctx;
  // the broadest word alone; "clash" when no reading of the words fits together (শরীফপুর union in Begumganj + কক্সবাজার)
  const near = (x, c) => c.some((y) => y === x || inContext(x, y) || inContext(y, x));
  const clash = !runs.some((r) => r.some((x) => runs.every((c) => c === r || near(x, c))));
  return clash ? Object.assign([...order[order.length - 1]], { clash }) : order[order.length - 1];
}

// A kind word in the query ("… ইউনিয়ন", "pekua union", "noakhali pourashava") puts results of that kind first.
const KIND_WORDS = [['union', ['ইউনিয়ন', 'union', 'up']], ['municipality', ['পৌরসভা', 'পৌর', 'pourashava', 'paurashava', 'municipality', 'town']],
  ['upazila', ['উপজেলা', 'upazila', 'upozila']], ['thana', ['থানা', 'thana', 'police', 'station']]]
  .map(([kind, list]) => [kind, new Set(list.map((w) => norm(w).toLowerCase()))]);
// { hits, close, context?, missing?, elsewhere? } for what the person typed (#151).
export function findAreas(index, q, opts = {}) {
  const r = findAreasRaw(index, q, opts);
  const said = norm(q).toLowerCase().replace(/[,،।;]/g, ' ').split(/\s+/);
  const want = KIND_WORDS.find(([, ws]) => said.some((w) => ws.has(w)))?.[0];
  if (!want || r.hits.length < 2) return r;
  return { ...r, hits: [...r.hits.filter((h) => h.kind === want), ...r.hits.filter((h) => h.kind !== want)] };
}
function findAreasRaw(index, q, opts = {}) {
  const { all, runs, context, place, onlyCommon } = understand(index, q);
  const words = all.filter((w) => !FILLER.has(w));
  const exactly = (r) => r.hits.filter((h) => (h.names || []).some((n) => norm(n).toLowerCase() === words.join(' ')));
  if (!context.length) {
    if (!onlyCommon) return matchName(index, place || q, opts);
    // "bazar" alone is no place; but a place NAMED only with such words ("বাজার পাড়া") is found when written exactly
    return words.length > 1 ? { hits: exactly(matchName(index, words.join(' '), opts)), close: [] } : { hits: [], close: [] };
  }
  // 1) The whole text as one name first: a village like "উত্তর বড়ঘোপ" or "পশ্চিম পালংখালী" contains an area word,
  //    but it is still one place (#151 review). Whole-name matches (text or the full sound) win over any split.
  const whole = matchName(index, words.join(' '), opts);
  const weak = words.some((w) => wordKey(w).replace('@', '').length < 2);   // "Noannoi": its sound melts into the next word
  const wholeHits = whole.hits.filter((h) => whole.scores.get(h) <= (weak ? 2 : 3));
  // 1b) A place name with area words around it ("উত্তর শরীফপুর নোয়াখালী সদর", "হাজী পাড়া চকরিয়া"): the longest run of
  //     words that is one whole name and lies inside the area the other words name. A part of the name must not be
  //     taken as an area word on its own ("শরীফপুর" union, "হাজী পাড়া" ~ হাজীপুর) (#152 review).
  //     If that name is only in another area ("বাহাদুর পুর কক্সবাজার"), it comes with the note, unless something
  //     inside the area matches at least as well (#152 review 4).
  const span = wholeInside(index, words, weak, place ? null : runs.map((r) => r.at.map((i) => all[i]).join(' ')), opts);
  const away = span?.elsewhere ? span : null;
  const beats = (sc) => !away || sc <= away.score;
  if (wholeHits.length && beats(Math.min(...wholeHits.map((h) => whole.scores.get(h))))) {
    // the better match first (exact text before same sound); inside the area words only breaks a tie
    const inside = (h) => (context.some((c) => inContext(h, c)) ? 0 : 1);
    const ranked = [...wholeHits].sort((x, y) => whole.scores.get(x) - whole.scores.get(y) || inside(x) - inside(y));
    return { hits: [...ranked, ...whole.hits.filter((h) => !ranked.includes(h))], close: whole.close };
  }
  if (span && !away) return span;
  if (!place) {
    // "হাজী পাড়া নোয়াখালী": "হাজী পাড়া" only sounds like হাজীপুর union; the village of that exact name is elsewhere
    if (away && (context.clash || away.score < areaScore(index, away.name, opts))) return away;
    // Only area words. One word ("begumganj", "char jabbar"): the normal search, so the upazila, its union and the
    // thana all show. Several ("narottampur kabirhat"): the places that fit all of them, then the normal results.
    const r = matchName(index, q, opts);
    if (runs.length < 2) return r.hits.length ? r : { hits: context.filter((c) => c.kind !== 'district'), close: r.close };
    const best = context.filter((c) => c.kind !== 'district');
    const rest = r.hits.filter((h) => !best.includes(h) && context.some((c) => inContext(h, c)));
    return best.length || rest.length ? { hits: [...best, ...rest], close: [] } : r;
  }
  // (only common words left, e.g. "dwip": the retry below gives the area words back before saying "not found")
  // 2) Split: the place inside the area words. If it is not there, the most precise area word may be part of the
  //    place's own name ("shahporir dwip teknaf": "shahporir" is not the union সাহাপুর): give it back and try again.
  let active = [...runs];
  let first = null, last = null;
  while (active.length) {
    const ctx = contextOf(active);
    const used = new Set(active.flatMap((r) => r.at));
    const name = all.filter((w, i) => !used.has(i) && !FILLER.has(w)).join(' ');
    // a leftover direction word ("উত্তর") is no name; nor is anything searched inside area words that do not fit
    // together ("শরীফপুর" union in Begumganj + "কক্সবাজার"): that would show a wrong place as the answer (#152 review 4)
    if (ctx.clash || !name || name.split(' ').every((w) => COMMON.has(w) || DIRECTION.has(w))) { if (name && !last) last = { ctx, name }; } else {
      const r = matchName(index, name, opts);
      const inside = r.hits.filter((h) => ctx.some((c) => inContext(h, c)));
      // with the whole name known elsewhere, only a close match inside the area may beat it (#152 review 4)
      if (inside.length && beats(r.scores.get(inside[0]))) return { hits: [...inside, ...r.hits.filter((h) => !inside.includes(h))], close: r.close };
      if (!first && r.hits.length) first = { r, ctx, name };
      if (!last || !r.hits.length) last = last || { ctx, name };
    }
    const rank = (c) => Math.max(...c.map((x) => CTX_RANK[x.kind]));
    active = [...active].sort((a, b) => rank(b) - rank(a)).slice(1);   // drop the most precise area word
  }
  // 3) Nothing inside the area: say so. Places of that name elsewhere come with a note, never as if they were there;
  //    if nothing anywhere, "<নাম> পাইনি, তবে <এলাকা> পেয়েছি" with the area that is left after giving words back.
  if (span) return span;                                           // the whole name, in another area, with the note
  if (first) return { hits: first.r.hits, close: first.r.close, elsewhere: first.ctx[0] };
  const all2 = matchName(index, words.join(' '), opts);            // "shahporir dwip": the whole text, no area
  if (all2.hits.length) return all2;
  if (last) return { hits: [], close: all2.close, context: last.ctx[0], missing: last.name };
  return all2;
}

// areaRuns: when every word was read as an area word, the texts of those words; a place is then taken only from one
// whole area word that is a better match as a place than as an area ("হাজী পাড়া" read as হাজীপুর)
// How well a name matches as an area (union, upazila, …): its best score, 99 if not at all.
function areaScore(index, name, opts) {
  if (DISTRICTS.some((d) => [d.bn, d.en].some((n) => norm(n).toLowerCase() === name))) return 0;   // a district name
  const m = matchName(index, name, opts);
  return Math.min(99, ...m.hits.filter((h) => h.kind in CTX_RANK).map((h) => m.scores.get(h)));
}
function wholeInside(index, words, weak, areaRuns, opts) {
  let away = null;                                                // the longest whole name found outside the area
  for (let n = words.length - 1; n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const name = words.slice(i, i + n);
      if (areaRuns && !areaRuns.includes(name.join(' '))) continue;
      const u = understand(index, [...words.slice(0, i), ...words.slice(i + n)].join(' '));
      if (u.place || !u.context.length || u.context.clash) continue;  // every other word: area words that fit together
      if (name.every((w) => DIRECTION.has(w))) continue;            // "উত্তর" alone is no place
      const m = matchName(index, name.join(' '), opts);
      // a name made only of common words ("বাজার পাড়া") counts only when written exactly
      const onlyCommon = name.every((w) => COMMON.has(w));
      const fits = (h) => (onlyCommon ? (h.names || []).some((x) => norm(x).toLowerCase() === name.join(' ')) : m.scores.get(h) <= (weak ? 2 : 3));
      const top = m.hits.length ? m.scores.get(m.hits[0]) : 0;      // an exact name elsewhere beats a same sound here
      const hits = m.hits.filter((h) => fits(h) && m.scores.get(h) <= top && u.context.some((c) => inContext(h, c)));
      if (!hits.length) {
        const out = onlyCommon ? m.hits.filter(fits) : m.hits;
        if (!away && (areaRuns || n >= 2) && out.length) away = { hits: out, close: [], elsewhere: u.context[0], score: Math.min(...out.map((h) => m.scores.get(h))), name: name.join(' ') };
        continue;
      }
      if (areaRuns && (hits[0].kind in CTX_RANK || m.hits.some((h) => h.kind in CTX_RANK && m.scores.get(h) <= m.scores.get(hits[0]) && u.context.some((c) => inContext(h, c) || inContext(c, h))))) continue;
      return { hits, close: [] };
    }
  }
  return away;
}

export function search(data, query, limit = 40) {
  const q = norm(toAsciiDigits(query)).toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const match = (t) => words.every((w) => t.includes(w));
  const out = data.national.filter((n) => match(n._text));
  for (const doc of Object.values(data.docs)) {
    for (const r of doc.records) {
      if (withPhone(r) && match(r._text)) out.push(r);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
