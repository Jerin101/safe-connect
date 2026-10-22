// Area search tests (issue #36). Every test word from the team, including names that must NOT match.
// Open tests/search-test.html through a local server; each row shows PASS, FAIL or PENDING.
import { loadAll, areaIndex, findAreas, norm } from '../js/data.js';

const N = (s) => norm(s);
const name = (i) => i.village || i.named?.name_bn || i.place.area?.bn || i.place.upazila;
const label = (i) => `${i.kind}: ${name(i)}${i.place.area && i.kind === 'village' ? ` (${i.place.area.bn})` : ''}`;

// expect(result) -> true when the test passes. result = { hits, close } from findAreas.
const first = (test) => (r) => r.hits.length > 0 && test(r.hits[0]);
const nowhere = (bad) => (r) => ![...r.hits, ...r.close].some((i) => N(name(i)).includes(N(bad)));
const both = (...tests) => (r) => tests.every((t) => t(r));
const isHasanpur = (i) => i.kind === 'village' && i.village === N('হাসানপুর') && i.place.area?.bn === N('নিয়াজপুর ইউনিয়ন');
const isNiazpur = (i) => i.kind === 'union' && i.place.area?.bn === N('নিয়াজপুর ইউনিয়ন');
const isMaijdee = (i) => i.kind === 'local' && i.named?.name_en === 'Maijdee' && i.place.area?.bn === N('নোয়াখালী পৌরসভা');
const noMatch = (r) => r.hits.length === 0;

const TESTS = [
  // Hasanpur village, Niazpur union (official village list)
  ...['hasanpur', 'hason pur', 'হাসানপুর', 'হাছানপুর'].map((q) => [q, 'Hasanpur village, Niazpur union first', first(isHasanpur)]),
  // Hasan Hat is a different place: waiting for the team to confirm where it is (data/aliases.json)
  ...['hasanhat', 'hasan hat', 'hason haat', 'হাসানহাট', 'হাসান হাট'].map((q) => [q, 'Hasan Hat first', null, 'PENDING: add Hasan Hat to data/aliases.json once its union is confirmed']),
  ['hasanhat', 'must NOT show Hasanpur first', (r) => !(r.hits[0] && isHasanpur(r.hits[0]))],
  // Unions, towns, upazilas, places
  ...['niazpur', 'neaj pur', 'newajpur', 'নিয়াজপুর'].map((q) => [q, 'Niazpur union first', first(isNiazpur)]),
  ['chowmuhani', 'Chowmuhani town first', first((i) => i.kind === 'municipality' && N(name(i)).includes(N('চৌমুহনী')))],
  ['coxs bazar', "Cox's Bazar first", first((i) => i.words.includes(N('কক্সবাজার')) || i.words.includes("cox's bazar"))],
  ["cox's bazar", "Cox's Bazar first", first((i) => i.words.includes(N('কক্সবাজার')) || i.words.includes("cox's bazar"))],
  ['hatiya', 'Hatiya upazila first', first((i) => i.kind === 'upazila' && i.place.upazila === 'Hatiya')],
  ['inani', 'Inani beach first', first((i) => i.kind === 'place' && N(i.named?.name_bn).includes(N('ইনানী'))),
    (data) => (Object.values(data.docs).some((d) => d.places.length) ? null : 'PENDING: Inani beach comes with data/manual_additions.json (P10)')],
  // Local names (data/aliases.json)
  ['maijdee', 'Maijdee -> Noakhali municipality first', first(isMaijdee)],
  ['মাইজদী', 'Maijdee -> Noakhali municipality first', first(isMaijdee)],
  // Must NOT match
  ['maijdee', 'must NOT show "দক্ষিন চর মজিদ"', nowhere('দক্ষিন চর মজিদ')],
  // বাবুনগর is a real village of Sharifpur union (official village list); মনিনগর is a different place.
  ['babunagar', 'Babunagar village, Sharifpur union first', first((i) => i.kind === 'village' && i.village === N('বাবুনগর') && i.place.area?.bn === N('শরীফপুর ইউনিয়ন'))],
  ['babunagar', 'must NOT show "মনিনগর"', nowhere('মনিনগর')],
  ['blorptanq', 'nonsense -> no match, 999 fallback', both(noMatch, (r) => r.close.length === 0)],
  ['qwzx', 'nonsense -> no match, 999 fallback', both(noMatch, (r) => r.close.length === 0)],
];

const data = await loadAll('../data/');
const index = areaIndex(data);
const rows = document.getElementById('rows');
const count = { PASS: 0, FAIL: 0, PENDING: 0 };
for (const [q, expected, test, when] of TESTS) {
  const pending = typeof when === 'function' ? when(data) : when;   // some tests wait for data that is not merged yet
  const r = findAreas(index, q);
  const result = pending ? 'PENDING' : (test(r) ? 'PASS' : 'FAIL');
  count[result]++;
  const tr = document.createElement('tr');
  const got = [...r.hits.slice(0, 3).map(label), ...r.close.map((i) => `similar → ${label(i)}`)].join(' | ') || '(nothing: 999 fallback)';
  for (const [text, cls] of [[result, result], [q], [pending || expected], [got]]) {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    tr.append(td);
  }
  rows.append(tr);
}
document.getElementById('summary').textContent = `${count.PASS} passed, ${count.FAIL} failed, ${count.PENDING} pending`;
document.title = `${count.FAIL ? 'FAIL' : 'PASS'}: search tests`;
