// Must-find test (coverage fix): how many of the names people search for the search really finds, per district.
// Run: node tests/must-find/run.mjs [--strict] [--list]   (no browser, no network: fetch reads data/ from disk)
// found = one of the results the page shows is in the expected upazila (and union, when the entry gives one).
// Entries with "gap" (no page names their upazila yet) are listed, not counted; they are in docs/DATA_GAPS.md.
// --strict exits with 1 below 100%; --list prints every name not found.
import { readFileSync } from 'node:fs';
import { loadAll, areaIndex, findAreas, norm } from '../../js/data.js';

globalThis.fetch = async (url) => {
  try { const body = readFileSync(url, 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; }
  catch { return { ok: false, status: 404, json: async () => ({}) }; }
};
const index = areaIndex(await loadAll('data/'));
const strict = process.argv.includes('--strict'), list = process.argv.includes('--list');
let all = true;
for (const key of ['noakhali', 'coxsbazar']) {
  const { district, entries } = JSON.parse(readFileSync(`tests/must-find/${key}.json`, 'utf8'));
  const groups = new Map(), miss = [], gaps = entries.filter((e) => e.gap);
  for (const e of entries.filter((x) => !x.gap)) {
    const top = findAreas(index, e.q).hits;
    const ok = !!e.upazila && top.some((h) => h.place.district === key && h.place.upazila === e.upazila
      && (!e.union || norm(h.place.area?.bn || '') === norm(e.union)));
    const g = groups.get(e.group) || { n: 0, ok: 0 };
    g.n++; if (ok) g.ok++; groups.set(e.group, g);
    if (!ok) miss.push(`${e.q} [${e.group}] want ${e.upazila || 'no upazila yet'}${e.union ? ' / ' + e.union : ''} got ${top.slice(0, 2).map((h) => `${h.kind}@${h.place.upazila}`).join(', ') || '-'}`);
  }
  const n = entries.length - gaps.length, ok = n - miss.length;
  console.log(`${district}: ${ok}/${n} found (${(100 * ok / n).toFixed(1)}%); ${gaps.length} data gaps (docs/DATA_GAPS.md)`);
  for (const [g, c] of groups) console.log(`  ${g.padEnd(20)} ${c.ok}/${c.n}`);
  if (list) miss.forEach((m) => console.log('   MISS', m));
  for (const e of gaps) console.log('   GAP ', `${e.q} [${e.group}]: ${e.gap}`);
  if (ok < n) all = false;
}
if (strict && !all) process.exit(1);
