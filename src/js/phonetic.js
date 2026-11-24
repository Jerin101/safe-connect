// SafeConnect phonetic search key (kit by Claude chat, 9 Nov 2026; wired into js/data.js as an extra key).
// One sound key for Bangla, English and Banglish, so "sahapur", "shahapur" and "সাহাপুর" meet.
// Idea: write both scripts as plain Latin consonants, merge letters that sound alike, drop vowels
// (except a leading one, written "a"), drop y/w, and collapse repeats.

// Bangla letters → rough Latin. Vowel signs and vowels become "a" (dropped later except at the start).
const BN = {
  'অ':'a','আ':'a','ই':'a','ঈ':'a','উ':'a','ঊ':'a','ঋ':'ri','এ':'a','ঐ':'a','ও':'a','ঔ':'a',
  'া':'a','ি':'a','ী':'a','ু':'a','ূ':'a','ৃ':'ri','ে':'a','ৈ':'a','ো':'a','ৌ':'a',
  'ক':'k','খ':'k','গ':'g','ঘ':'g','ঙ':'ng','চ':'C','ছ':'C','জ':'j','ঝ':'j','ঞ':'n',
  'ট':'t','ঠ':'t','ড':'d','ঢ':'d','ণ':'n','ত':'t','থ':'t','দ':'d','ধ':'d','ন':'n',
  'প':'p','ফ':'p','ব':'b','ভ':'b','ম':'m','য':'j','র':'r','ল':'l','শ':'s','ষ':'s','স':'s','হ':'h',
  'ড়':'r','ঢ়':'r','য়':'','ৎ':'t','ং':'ng','ঃ':'','ঁ':'','্':'',
};
// Bangla written with combining nukta (ড + ়) is normalised first.
// ড়, ঢ় and য় come in two Unicode forms (one letter, or letter + nukta ়); both are handled here.
const fixBn = (s) => s.normalize('NFC')
  .replace(/\u09A1\u09BC|\u09DC/g, 'র').replace(/\u09A2\u09BC|\u09DD/g, 'র').replace(/\u09AF\u09BC|\u09DF/g, '')
  .replace(/্য/g, '')            // ya-phala (ব্যাংক) is a vowel colour, not a "j"
  .replace(/(?<!র)্ব/g, '')      // ba-phala (দ্বীপ, বিশ্বাস) is usually silent; র্ব (পূর্ব, reph over ব) is a real "rb"
  .replace(/\u09BC/g, '');      // any other nukta

function latinOf(s) {
  let out = '';
  for (const ch of fixBn(s)) out += ch in BN ? BN[ch] : ch;
  return out;
}

export function soundKey(text) {
  // Lower-case the Latin part first; Bangla চ/ছ come out as "C" so the English "c → k" rule below leaves them alone.
  let s = latinOf(String(text || '').toLowerCase());
  s = s.replace(/['’`.\-]/g, '').replace(/[^a-zC ]+/g, ' ');
  // English/Banglish spellings → the same sounds
  s = s.replace(/x/g, 'ks').replace(/q/g, 'k')
       .replace(/chh|ch/g, 'C').replace(/c/g, 'k').replace(/C/g, 'c')   // ch = চ/ছ; other c = k (Cox)
       .replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/jh/g, 'j').replace(/z/g, 'j')
       .replace(/th/g, 't').replace(/dh/g, 'd').replace(/ph|f/g, 'p').replace(/bh|v/g, 'b')
       .replace(/sh/g, 's').replace(/rh/g, 'r').replace(/C/g, 'c');
  return s.split(/\s+/).filter(Boolean).map((w) => {
    const lead = /^[aeiou]/.test(w) ? 'a' : '';
    const cons = w.replace(/[aeiouyw]/g, '').replace(/(.)\1+/g, '$1');
    return lead + cons;
  }).join('');
}

// Words that only say what kind of place it is. Typed alone they must not match anything.
// (Checked as words, not sound keys: "hat" and "Hatiya" share the key "ht".)
export const COMMON_WORDS = new Set([
  'bazar', 'bajar', 'বাজার', 'hat', 'haat', 'হাট', 'char', 'chor', 'চর', 'para', 'pada', 'পাড়া', 'gram', 'গ্রাম',
  'union', 'ইউনিয়ন', 'sadar', 'sodor', 'সদর', 'thana', 'থানা', 'zila', 'zilla', 'district', 'জেলা', 'upazila', 'উপজেলা',
  'pourashava', 'paurashava', 'পৌরসভা', 'school', 'স্কুল', 'madrasa', 'মাদ্রাসা', 'masjid', 'mosjid', 'মসজিদ',
  'beach', 'বিচ', 'sea beach', 'সৈকত', 'ghat', 'ঘাট', 'village', 'road', 'রোড', 'more', 'মোড়',
]);

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// entries: [{ bn, en, ...}] → index with sound keys of the Bangla and English names.
// Words that only name the kind of place ("ইউনিয়ন", "থানা", "সদর", "Union"…): a name is also found without them.
const KIND_WORDS = /\s*(ইউনিয়ন|উপজেলা|থানা|মডেল থানা|পৌরসভা|জেলা|গ্রাম|union|upazila|thana|model thana|pourashava|municipality|district|village)\s*/gi;
// The sound keys of a place's names, each also without its kind words.
export function keysOf(names) {
  const forms = names.filter(Boolean).flatMap((n) => [n, n.replace(KIND_WORDS, ' ').trim()]);
  return [...new Set(forms.map(soundKey).filter((k) => k.length >= 2))];
}
// The keys of the first words of each name ("সাহাপুর বাজার" -> "সাহাপুর"): a typed name may stop at a word end,
// never inside a word ("sahapur" is not "শাহপরীর দ্বীপ").
// Returns [key, text] pairs.
export function headsOf(names) {
  const out = new Map();
  for (const n of names.filter(Boolean)) {
    const w = n.replace(KIND_WORDS, ' ').trim().split(/\s+/);
    for (let i = 1; i < w.length; i++) { const t = w.slice(0, i).join(' '); const k = soundKey(t); if (k.length >= 2 && !out.has(k)) out.set(k, t); }
  }
  return [...out];
}
export function buildIndex(entries) {
  return entries.map((e) => ({ e, keys: keysOf([e.bn, e.en]) }));
}
// How well a typed key matches a place's keys: 0 same, 0.5 its first words (4+ letters), 1 one sound off, else null.
export function keyScore(keys, q, heads = []) {
  if (keys.includes(q)) return 0;
  if (q.length >= 4 && heads.some(([k]) => k === q)) return 0.5;
  let best = 9;
  for (const k of keys) if (q.length >= 4 && k.length >= 4) best = Math.min(best, lev(k, q));
  return best <= 1 ? best : null;
}

// Returns matches, best first: exact sound key = 0, one sound off = 1 (only for keys of 4+ letters).
export function search(index, query, limit = 10) {
  const plain = String(query || '').trim().toLowerCase().normalize('NFC');
  if (COMMON_WORDS.has(plain)) return [];             // "bazar", "char" or "hat" alone never match
  const q = soundKey(query);
  if (!q || q.length < 2) return [];
  const hits = [];
  for (const it of index) {
    let best = 9;
    for (const k of it.keys) {
      if (k === q) best = Math.min(best, 0);
      else if (q.length >= 4 && k.startsWith(q)) best = Math.min(best, 0.5);
      else if (q.length >= 4 && k.length >= 4) best = Math.min(best, lev(k, q));
    }
    if (best <= 1) hits.push({ ...it.e, score: best });
  }
  return hits.sort((a, b) => a.score - b.score || a.bn.length - b.bn.length).slice(0, limit);
}
