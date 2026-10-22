// Runs the area search tests from tests/search-cases.json (issue #36) and shows PASS, FAIL or PENDING.
// Open tests/search-test.html through a local server (python -m http.server 8000).
import { loadAll, areaIndex, findAreas, norm } from '../js/data.js';

const N = (s) => norm(s || '');
const name = (i) => i.village || i.named?.name_bn || i.place.area?.bn || i.place.upazila;
const label = (i) => `${i.kind}: ${name(i)}${i.place.area && i.kind === 'village' ? ` (${i.place.area.bn})` : ''}`;

// Does this result look like the place described in the test? (kind, name_bn, union_bn, town_bn, upazila)
function sameAs(i, want) {
  if (!i) return false;
  if (want.kind && i.kind !== want.kind) return false;
  if (want.name_bn && N(name(i)) !== N(want.name_bn)) return false;
  if (want.union_bn && i.place.area?.bn !== N(want.union_bn)) return false;
  if (want.town_bn && i.place.area?.bn !== N(want.town_bn)) return false;
  if (want.upazila && i.place.upazila !== want.upazila) return false;
  return true;
}

function check(c, r) {
  const top = r.hits[0];
  if (c.first && !sameAs(top, c.first)) return false;
  if (c.first_contains && !(top && (N(`${name(top)} ${top.words}`).includes(N(c.first_contains))))) return false;
  if (c.not_first && sameAs(top, c.not_first)) return false;
  if (c.not_anywhere && [...r.hits, ...r.close].some((i) => N(name(i)).includes(N(c.not_anywhere)))) return false;
  if (c.no_match && r.hits.length) return false;
  if (c.no_similar && r.close.length) return false;
  return true;
}

const [data, cases] = await Promise.all([
  loadAll('../data/'),
  fetch('search-cases.json').then((res) => res.json()),
]);
const index = areaIndex(data);
const hasPlaces = Object.values(data.docs).some((d) => d.places.length);
const rows = document.getElementById('rows');
const count = { PASS: 0, FAIL: 0, PENDING: 0 };
for (const c of cases.cases) {
  const r = findAreas(index, c.q);
  const pending = c.pending || (c.needs === 'places' && !hasPlaces ? 'Inani beach comes with data/manual_additions.json (P10)' : '');
  const result = pending ? 'PENDING' : (check(c, r) ? 'PASS' : 'FAIL');
  count[result]++;
  const got = [...r.hits.slice(0, 3).map(label), ...r.close.map((i) => `similar → ${label(i)}`)].join(' | ') || '(nothing: 999 fallback)';
  const tr = document.createElement('tr');
  for (const [text, cls] of [[result, result], [c.q], [pending ? `PENDING: ${pending}` : c.expect], [got]]) {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    tr.append(td);
  }
  rows.append(tr);
}
document.getElementById('summary').textContent = `${count.PASS} passed, ${count.FAIL} failed, ${count.PENDING} pending`;
document.title = `${count.FAIL ? 'FAIL' : 'PASS'}: search tests`;
