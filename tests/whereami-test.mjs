// M1.2 page integration, part 1 (no browser): the "where the map puts you" model and card (js/whereami.js) with the real
// layers and the real lang files. Run: node --test tests/whereami-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createAreaPolygons } from '../src/js/areapoly.js';
import { whereAmI, renderWhere, BOUNDARY_MIN_M, ROUGH_M } from '../src/js/whereami.js';

const en = JSON.parse(readFileSync('src/js/lang/en.json', 'utf8')).ui.where;
const bn = JSON.parse(readFileSync('src/js/lang/bn.json', 'utf8')).ui.where;
const master = JSON.parse(readFileSync('src/data/master_areas.json', 'utf8'));
const src = readFileSync('src/js/whereami.js', 'utf8');
const diskFetch = async (url) => (existsSync('src/' + url) ? new Response(readFileSync('src/' + url, 'utf8')) : new Response('', { status: 404 }));
const offline = async () => { throw new TypeError('Failed to fetch'); };
const real = () => createAreaPolygons({ fetchFn: diskFetch });
const at = (upazilaCode) => { const u = master.unions.find((x) => x.derived_upazila === upazilaCode); return { lat: u.lat, lon: u.lon, accuracy: 30 }; };
const HATIYA = at('BD20750036');

// ---- a tiny fake DOM, enough for createElement + textContent ----
class El {
  constructor(tag) { this.tag = tag; this.children = []; this.className = ''; this.textContent = ''; this.hidden = false; }
  append(...k) { this.children.push(...k); }
  replaceChildren(...k) { this.children = k; }
  text() { return [this.textContent, ...this.children.map((c) => c.text())].join(' ').replace(/\s+/g, ' ').trim(); }
}
const doc = { createElement: (t) => new El(t) };
const bnDigits = (s) => String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (a, k) => (k in v ? v[k] : a));
const H = (lang) => ({ lang, num: lang === 'bn' ? bnDigits : String, fill, doc });
const draw = (m, lang = 'en') => { const box = new El('section'); renderWhere(box, m, lang === 'bn' ? bn : en, H(lang)); return box; };

// ---- strings ----
test('Bangla and English strings: same keys, same placeholders, none empty, Bangla really Bangla', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(bn).sort());
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of Object.keys(en)) {
    assert.ok(en[k].trim() && bn[k].trim(), k);
    assert.equal(ph(en[k]), ph(bn[k]), 'placeholders of ' + k);
    assert.match(bn[k], /[ঀ-৿]/, k + ' is not Bangla');
  }
});

test('every ui.where key used by whereami.js exists, and the file has no user-facing sentence of its own', () => {
  for (const m of src.matchAll(/\bS\.(\w+)/g)) assert.ok(m[1] in en, 'missing string ' + m[1]);
  const literals = [...src.matchAll(/'([^'\n]{12,})'/g)].map((m) => m[1]).filter((s) => /[A-Za-z]{3,} [A-Za-z]{3,}/.test(s) && !/[()\\]/.test(s) && !/^note /.test(s));   // sentences only; code strings with regex characters are skipped
  assert.deepEqual(literals, [], 'hard-coded text: ' + literals.join(' | '));
});

test('privacy: whereami.js never stores, sends or reads the position itself', () => {
  assert.doesNotMatch(src, /localStorage|sessionStorage|XMLHttpRequest|sendBeacon|navigator\.geolocation|\bfetch\(/);
});

// ---- model ----
test('inside a pilot upazila: division, district, upazila and the nearest union centre, never an exact union', async () => {
  const m = await whereAmI(HATIYA, real());
  assert.equal(m.state, 'ok'); assert.equal(m.upazila.en, 'Hatiya'); assert.equal(m.district.en, 'Noakhali'); assert.equal(m.division.en, 'Chattogram');
  assert.equal(m.exact_union, false); assert.equal(m.centre.exact, false); assert.equal(m.centre.labelKey, 'nearest_union_centre');
  assert.ok(m.district.bn && m.division.bn && m.upazila.bn);
});

test('names appear only when a boundary supports them: no polygon, offline, bad positions', async () => {
  for (const [pos, svc, state] of [
    [{ lat: 0, lon: 0 }, real(), 'no_polygon'], [HATIYA, createAreaPolygons({ fetchFn: offline }), 'unavailable'],
    [null, real(), 'invalid'], [{ lat: NaN, lon: 90 }, real(), 'invalid'], [{ lat: null, lon: null }, real(), 'invalid'], [{ lat: 'x', lon: 'y' }, real(), 'invalid'],
  ]) {
    const m = await whereAmI(pos, svc);
    assert.equal(m.state, state);
    for (const k of ['division', 'district', 'upazila', 'centre']) assert.equal(k in m, false, `${state} must not carry ${k}`);
  }
});

test('a rough position (over 2 km) names nothing', async () => {
  const m = await whereAmI({ ...HATIYA, accuracy: ROUGH_M + 1 }, real());
  assert.equal(m.state, 'rough'); assert.equal('upazila' in m, false);
  assert.equal((await whereAmI({ ...HATIYA, accuracy: ROUGH_M }, real())).state, 'ok');
});

test('boundary uncertainty: close to an edge, or a GPS error bigger than the distance, warns', async () => {
  const svc = (edge) => ({ locate: async () => ({ status: 'inside', district: 'BD2075', edge_m: edge, upazila: { code: 'X', name_en: 'Hatiya', name_bn: 'হাতিয়া', kind: 'upazila', lp: '36' },
    districtDoc: JSON.parse(readFileSync('src/data/polygons/BD2075.json', 'utf8')) }), getIndex: async () => JSON.parse(readFileSync('src/data/polygons/index.json', 'utf8')) });
  assert.equal((await whereAmI({ ...HATIYA, accuracy: 20 }, svc(40))).near_boundary, true);
  assert.equal((await whereAmI({ ...HATIYA, accuracy: 20 }, svc(BOUNDARY_MIN_M + 1))).near_boundary, false);
  assert.equal((await whereAmI({ ...HATIYA, accuracy: 800 }, svc(500))).near_boundary, true, 'GPS error 800 m > distance 500 m');
  const box = draw(await whereAmI({ ...HATIYA, accuracy: 20 }, svc(40)));
  assert.match(box.text(), /close to a boundary/);
});

test('real data: a point very near an upazila edge is flagged', async () => {
  const svc = real();
  const idx = await svc.getIndex();
  const d = idx.districts.find((x) => x.code === 'BD2075'); const [w, s, e, n] = d.bbox;
  let found = null;
  for (let i = 1; i < 120 && !found; i++) for (let j = 1; j < 120 && !found; j++) {
    const lat = s + ((n - s) * i) / 120, lon = w + ((e - w) * j) / 120;
    const r = await svc.locate(lat, lon);
    if (r.status === 'inside' && r.edge_m < 60) found = { lat, lon, accuracy: 15 };
  }
  assert.ok(found, 'a point near an edge exists');
  assert.equal((await whereAmI(found, svc)).near_boundary, true);
});

test('2026 upazilas without polygons: a plain note, nothing invented', async () => {
  const idx = JSON.parse(readFileSync('src/data/polygons/index.json', 'utf8'));
  const lak = idx.districts.find((d) => d.name_en === 'Lakshmipur');
  const m = await whereAmI(at(master.upazilas.find((u) => u.district === lak.code && u.kind === 'upazila').code), real());
  assert.equal(m.state, 'ok'); assert.deepEqual(m.new_upazilas, ['Chandraganj']);
  const box = draw(m);
  assert.match(box.text(), /Reported new upazila not yet on the map: Chandraganj/);
  assert.equal(box.text().includes('Chandraganj') && !/not yet on the map/.test(box.text()), false);
});

test('the contact list and the map disagree: a neutral note, spelling differences are not flagged', async () => {
  const svc = real();
  assert.equal((await whereAmI(HATIYA, svc, { district: 'Noakhali', upazila: 'Hatiya' })).mismatch, undefined);
  const m = await whereAmI(HATIYA, svc, { district: 'Noakhali', upazila: 'Companiganj' });
  assert.deepEqual(m.mismatch, { contact: 'Companiganj', map: 'Hatiya', level: 'upazila' });
  assert.match(draw(m).text(), /numbers on this page are for Companiganj; the map shows Hatiya/);
  assert.equal((await whereAmI(HATIYA, svc, { district: "Cox's Bazar", upazila: 'Teknaf' })).mismatch.level, 'district');
});

// ---- card ----
test('card (English): upazila rows, "Nearest union centre", the not-your-union warning, the source', async () => {
  const box = draw(await whereAmI(HATIYA, real()));
  const t = box.text();
  assert.equal(box.hidden, false);
  assert.match(t, /Where the map puts you/); assert.match(t, /Division Chattogram/); assert.match(t, /District Noakhali/); assert.match(t, /Upazila Hatiya/);
  assert.match(t, /Nearest union centre/); assert.match(t, /not your union/); assert.match(t, /CC BY-IGO/);
  assert.doesNotMatch(t, /your union is|exact union|Union Hatiya/i);
});

test('card (Bangla): Bangla names, Bangla digits, no Latin digits in distances', async () => {
  const m = await whereAmI(HATIYA, real());
  const t = draw(m, 'bn').text();
  assert.match(t, /নিকটতম ইউনিয়ন কেন্দ্র/); assert.match(t, new RegExp(m.upazila.bn)); assert.match(t, /আপনার ইউনিয়ন নয়/);
  assert.doesNotMatch(t.replace(/CC BY-IGO|OCHA|HDX/g, ''), /\d/, 'Latin digits in the Bangla card');
});

test('card for every other state is a plain message; invalid hides the card', async () => {
  assert.match(draw(await whereAmI({ lat: 0, lon: 0 }, real())).text(), /not inside any upazila boundary/);
  assert.match(draw(await whereAmI(HATIYA, createAreaPolygons({ fetchFn: offline }))).text(), /not on this phone yet/);
  assert.match(draw(await whereAmI({ ...HATIYA, accuracy: 3000 }, real())).text(), /too rough \(about 3000 m\)/);
  const hidden = draw(await whereAmI(null, real())); assert.equal(hidden.hidden, true); assert.equal(hidden.children.length, 0);
});

test('service worker lists whereami.js and the version is above the production one', () => {
  const sw = readFileSync('src/service-worker.js', 'utf8');
  assert.ok(sw.includes("'js/whereami.js'"));
  assert.ok(Number(sw.match(/VERSION = 'v(\d+)-/)[1]) >= 81);
});
