// R1 (#267): categories near the person on the real site, all 64 districts. Drives the Chrome (or Edge) already on this
// computer over the DevTools protocol; no packages. The map needs internet (OpenStreetMap tiles).
// Run: python -m http.server 8000   (in the project folder, in another terminal)
//      node tests/near-test.mjs           It must end with ALL OK.
// Options: BASE=http://127.0.0.1:8000/  CHROME="C:\path\to\chrome.exe"  SHOTS=<folder for screenshots>
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8000/';
const SHOTS = process.env.SHOTS || '';
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const PORT = 9300 + Math.floor(Math.random() * 100);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'sc-near-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch {} });

let v = null;
for (let i = 0; i < 50 && !v; i++) { await wait(200); v = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => null); }
const ws = new WebSocket(v.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map(), errors = [], requests = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (waiting.has(d.id)) { waiting.get(d.id)(d.result || {}); waiting.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0] || d.params.exceptionDetails.text);
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url || '')) errors.push(d.params.entry.text);
  if (d.method === 'Network.requestWillBeSent') requests.push(d.params.request.url);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
async function waitFor(expr, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await wait(150); } return false; }
const shot = async (name) => { if (!SHOTS) return; const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64')); };
for (const m of ['Runtime.enable', 'Log.enable', 'Network.enable']) await send(m);
await send('Network.setBypassServiceWorker', { bypass: true });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
const click = (sel) => ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!e) return false; e.click(); return true; })()`);
async function pickArea(district, upazila) {
  if (!(await ev(`!!document.querySelector('#cat .near-picker') && !document.querySelector('#cat .near-picker').hidden`))) await click('#cat .near-area .pills .btn:last-child');
  await ev(`(() => { const s = document.querySelectorAll('#cat .near-selects select'); s[0].value = ${JSON.stringify(district)}; s[0].dispatchEvent(new Event('change')); s[1].value = ${JSON.stringify(upazila)}; })()`);
  await click('#cat .near-picker .btn.solid');
}

// 1. the hub: 12 categories, the কাছে tab marked
await send('Page.navigate', { url: `${BASE}#/c` });
await waitFor(`document.querySelectorAll('#cat .cat-tile').length > 0`);
const tiles = await ev(`document.querySelectorAll('#cat .cat-tile').length`);
check('#/c shows 12 categories', tiles === 12, `${tiles}`);
check('the কাছে tab is marked', await ev(`document.querySelector('#dock [aria-current="page"]')?.dataset.key === 'area'`));
check('no area yet: the picker is open', await ev(`!document.querySelector('#cat .near-picker').hidden`));

// 2. outside the pilot districts: Sylhet Sadar, pharmacies
await pickArea('Sylhet', 'Sylhet Sadar');
await waitFor(`/সিলেট/.test(document.querySelector('#cat .near-where')?.textContent || '')`);
await click('#cat .cat-tile[data-cat="pharmacy"]');
await waitFor(`location.hash === '#/c/pharmacy' && document.querySelectorAll('#cat .near-row').length > 0`);
const rows = await ev(`document.querySelectorAll('#cat .near-row').length`);
const first = await ev(`document.querySelector('#cat .near-row .t')?.textContent || ''`);
check('Sylhet pharmacies listed, the first one marked nearest', rows > 5 && /সবচেয়ে কাছে/.test(first), `${rows} rows; first: ${first.slice(0, 60)}`);
const mapOk = await waitFor(`document.querySelectorAll('#cat .leaflet-tile-loaded').length > 3 && document.querySelectorAll('#cat .mk-pin').length > 1`, 25000);
check('the map shows tiles and pins, one green', mapOk && (await ev(`document.querySelectorAll('#cat .mk-pin.near').length`)) === 1,
  `${await ev(`document.querySelectorAll('#cat .mk-pin').length`)} pins`);
await shot('r1-sylhet-pharmacy-390');
// the place page: ফ্রি সহায়তা first, 999, no area numbers in Sylhet (honest note), the way there
await click('#cat .near-row .btn.solid');
await waitFor(`/^#\\/c\\/pharmacy\\/osm-/.test(location.hash) && !!document.querySelector('#cat h2')`);
const h2 = await ev(`[...document.querySelectorAll('#cat h2')].map((h) => h.textContent)`);
check('place page: ফ্রি সহায়তা, then the way there', h2[0] === 'ফ্রি সহায়তা' && h2.length >= 2, JSON.stringify(h2));
check('999 on the place page, with a tel: link', await ev(`!!document.querySelector('#cat a[href="tel:999"]')`));
check('Sylhet: no unofficial number, an honest note and the national numbers link', await ev(`!!document.querySelector('#cat a[href="#/numbers"]') && ![...document.querySelectorAll('#cat a[href^="tel:"]')].some((a) => a.getAttribute('href') !== 'tel:999')`));
await shot('r1-sylhet-place-390');

// 3. a pilot district: Noakhali Sadar shows the area's official numbers on the place page
await send('Page.navigate', { url: `${BASE}#/c/hospital` }); await waitFor(`!!document.querySelector('#cat .near-area')`);
await pickArea('Noakhali', 'Noakhali');   // the centres call Noakhali Sadar 'Noakhali'
await waitFor(`document.querySelectorAll('#cat .near-row').length > 0`);
await click('#cat .near-row .btn.solid');
const official = await waitFor(`[...document.querySelectorAll('#cat a[href^="tel:"]')].some((a) => a.getAttribute('href') !== 'tel:999')`);
check('Noakhali: the place page shows the area official numbers', official);
await shot('r1-noakhali-place-390');

// 4. English, all 64 districts in the picker, no position stored, no errors
await send('Page.navigate', { url: `${BASE}#/c` }); await waitFor(`!!document.querySelector('#cat .cat-tile')`);
await click('#cat .near-area .pills .btn:last-child');
const districts = await ev(`document.querySelectorAll('#cat .near-selects select')[0].options.length`);
check('the district picker lists all 64 districts', districts === 64, `${districts}`);
await ev(`document.getElementById('langBtn').click()`); await waitFor(`document.documentElement.lang === 'en'`);
check('English: the hub title and tiles change', await ev(`document.querySelector('#cat h1')?.textContent === 'What do you need?' && document.querySelector('#cat .cat-tile span:last-child').textContent === 'Hospitals and clinics'`));
const stored = await ev(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])))`);
check('only names are stored, no coordinates', !/\d+\.\d{3,}/.test(stored), stored.slice(0, 160));
const outside = [...new Set(requests.filter((u) => /^https?:/.test(u)).map((u) => new URL(u).host))].filter((h) => h !== new URL(BASE).host);
check('outside hosts: only OpenStreetMap tiles', outside.every((h) => h === 'tile.openstreetmap.org'), outside.join(', '));
check('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(failed ? `\n${failed} failed` : '\nALL OK');
process.exit(failed ? 1 : 0);
