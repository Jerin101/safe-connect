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
  const [national, manual, ...files] = await Promise.all([
    getJSON(`${base}national_hotlines.json`),
    getJSON(`${base}manual_additions.json`).catch(() => noManual),
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
  return { national: nationalCards, docs, missing };
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
  return [...seen].map(([en, bn]) => ({ en, bn })).sort((a, b) => a.en.localeCompare(b.en));
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

// ---------- Area search: Bangla or English, any common spelling ----------
// Village names exist only in Bangla, and people spell places in many ways (হাসানপুর / হাছানপুর / Hasanpur).
// So both the name and the typed text become a "sound key" made of the main consonants:
// হাসানপুর -> hsnpr, Hasanpur -> hsnpr. Vowels are left out, similar letters count as one.

const BN_SOUND = {
  'ক': 'k', 'খ': 'k', 'গ': 'g', 'ঘ': 'g', 'ঙ': 'ng', 'চ': 'c', 'ছ': 'c', 'জ': 'j', 'ঝ': 'j', 'ঞ': 'n', 'ট': 't', 'ঠ': 't',
  'ড': 'd', 'ঢ': 'd', 'ণ': 'n', 'ত': 't', 'থ': 't', 'দ': 'd', 'ধ': 'd', 'ন': 'n', 'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'b',
  'ম': 'm', 'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 's', 'ষ': 's', 'স': 's', 'হ': 'h', 'ৎ': 't', 'ং': 'ng', 'ঋ': 'r', 'ৃ': 'r',
};
const collapse = (s) => s.replace(/(.)\1+/g, '$1');

function bnSound(word, chho) {
  const w = norm(word).replace(/[ডঢ]়/g, 'র').replace(/য়/g, '');   // ড় ঢ় -> r, য় -> (vowel)
  let out = '';
  for (const ch of w) out += ch === 'ছ' ? chho : (BN_SOUND[ch] || '');
  return collapse(out);
}

function enSound(word) {
  let s = word.toLowerCase().replace(/[^a-z]/g, '');
  s = s.replace(/chh|ch/g, 'C').replace(/sh/g, 's').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/th/g, 't')
    .replace(/dh/g, 'd').replace(/ph/g, 'f').replace(/bh/g, 'b').replace(/jh/g, 'j')
    .replace(/x/g, 'ks').replace(/q/g, 'k').replace(/z/g, 'j').replace(/v/g, 'b').replace(/c/g, 'k').replace(/C/g, 'c')
    .replace(/[aeiouwy]/g, '');
  return collapse(s);
}

// All sound keys of a text (ছ is read as "ch" and as "s", because both spellings are used for the same names).
export function soundKeys(text) {
  const words = norm(text).split(/[\s,()\-–]+/).filter(Boolean);
  const keys = new Set();
  for (const chho of ['c', 's']) {
    const parts = words.map((w) => (/[ঀ-৿]/.test(w) ? bnSound(w, chho) : enSound(w))).filter(Boolean);
    if (parts.length) { keys.add(parts.join('')); parts.forEach((p) => keys.add(` ${p}`)); }   // " x" = one word
  }
  return [...keys];
}

// Ward texts, house names, and a direction word alone ("পূর্ব" = east) are not village names.
const NOT_A_VILLAGE = new RegExp(`${norm('ওয়ার্ড|নং|বাড়ি|বাড়ী')}|^[\\s০-৯0-9]+$|^${norm('(পূর্ব|পশ্চিম|উত্তর|দক্ষিণ|দক্ষিন|মধ্য)')}$`);

// Every searchable place in the loaded districts: upazilas, unions, towns, named places and villages.
export function areaIndex(data) {
  const items = [];
  const push = (kind, place, nameBn, nameEn, extra = {}) => {
    const text = norm(`${nameBn || ''} ${nameEn || ''}`).toLowerCase();
    items.push({ kind, place, name_bn: norm(nameBn), name_en: nameEn || null, text, keys: soundKeys(`${nameBn || ''}`).concat(nameEn ? soundKeys(nameEn) : []), ...extra });
  };
  for (const d of DISTRICTS) {
    const doc = data.docs[d.key];
    if (!doc) continue;
    const ups = upazilas(doc);
    const upByBn = new Map(ups.map((u) => [norm(u.bn), u.en]));
    for (const u of ups) {
      push('upazila', { district: d.key, upazila: u.en, area: null }, u.bn, u.en);
      for (const a of localAreas(doc, u.en)) {
        push(a.type === 'municipality' ? 'town' : 'union', { district: d.key, upazila: u.en, area: a }, a.bn.split(/[,،]/)[0], a.en);
      }
    }
    for (const p of doc.places || []) {
      const upz = upByBn.get(norm(p.upazila_bn));
      if (upz) push('place', { district: d.key, upazila: upz, area: { type: 'union', bn: norm(p.union_bn) }, placeId: p.id }, p.name_bn, p.name_en);
    }
    const seen = new Set();
    for (const v of doc.villages || []) {
      const name = norm(v.village_bn);
      const upz = upByBn.get(norm(v.upazila_bn));
      const id = `${name}|${norm(v.union_bn)}`;
      if (!upz || NOT_A_VILLAGE.test(name) || seen.has(id)) continue;
      seen.add(id);
      const area = localAreas(doc, upz).find((a) => a.type === 'union' && a.bn === norm(v.union_bn)) || { type: 'union', bn: norm(v.union_bn), en: v.union_en };
      push('village', { district: d.key, upazila: upz, area }, name, null, { ward: v.ward_no, union_bn: norm(v.union_bn), union_en: v.union_en });
    }
  }
  return items;
}

const KIND_ORDER = { upazila: 0, town: 1, union: 2, place: 3, village: 4 };

// Best matches for what the person typed, in Bangla or English. [] if nothing fits.
export function findAreas(index, query, limit = 10) {
  const q = norm(query).toLowerCase();
  if (q.length < 2) return [];
  const qKeys = soundKeys(q).filter((k) => !k.startsWith(' ') && k.length >= 2);   // 2 letters: exact match only
  const longKeys = qKeys.filter((k) => k.length >= 3);                              // 3+ letters: also "starts with"
  const scored = [];
  for (const item of index) {
    let score = null;
    if (item.text.split(/\s+/).some((w) => w.startsWith(q))) score = 0;
    else if (item.text.includes(q)) score = 1;
    else if (qKeys.length) {
      if (item.keys.some((k) => qKeys.includes(k.trim()))) score = 2;
      else if (item.keys.some((k) => longKeys.some((qk) => k.trim().startsWith(qk)))) score = 3;
    }
    if (score !== null) scored.push({ item, score });
  }
  scored.sort((a, b) => a.score - b.score || KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind]);
  return scored.slice(0, limit).map((s) => s.item);
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
