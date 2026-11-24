// R3 (#267): সেবা ডাকুন on the real site: the eight services, the form, the place-page buttons. Drives the Chrome (or Edge) already on this
// computer over the DevTools protocol; no packages. The map needs internet (OpenStreetMap tiles).
// Run: python -m http.server 8000   (in the project folder, in another terminal)
//      node tests/dakun-test.mjs           It must end with ALL OK.
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
const profile = mkdtempSync(join(tmpdir(), 'sc-dakun-'));
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

// 1. an area first, then the সেবা ডাকুন tab: eight services with the new names, the form, the map
await send('Page.navigate', { url: `${BASE}#/c` }); await waitFor(`!!document.querySelector('#cat .near-area')`);
await pickArea('Sylhet', 'Sylhet Sadar');
await waitFor(`/সিলেট/.test(document.querySelector('#cat .near-where')?.textContent || '')`);
await click('#dock [data-key="dakun"]');
await waitFor(`location.hash === '#/dakun' && document.querySelectorAll('#dakun .tcard').length === 11`);
const names = await ev(`[...document.querySelectorAll('#dakun .tcard span:last-child')].map((x) => x.textContent)`);
check('eleven services with the SRS names (FR12)', JSON.stringify(names) === JSON.stringify(['অ্যাম্বুলেন্স', 'সিএনজি অটোরিকশা', 'মোটরবাইক রাইড', 'মিস্ত্রি ডাকুন', 'স্বেচ্ছাসেবক / রক্তের খোঁজ', 'কিনে এনে দিন', 'অর্ডার তুলে এনে দিন', 'গাড়ি টেনে নেওয়া', 'ইজিবাইক / অটো', 'রিকশা', 'ভ্যান / পিকআপ']), JSON.stringify(names));
check('never stranded: 999 and the nearest hospital and bus stand or ghat (UC-13 3.1)', await waitFor(`!document.querySelector('#dakun .dk-fallback').hidden && !!document.querySelector('#dakun .dk-fallback a[href="tel:999"]') && /কাছের হাসপাতাল/.test(document.querySelector('#dakun .dk-fallback').textContent)`, 20000));
await click('#dakun .tcard[data-type="easybike"]');
check('ইজিবাইক: chosen, "চালক ডাকুন"', await waitFor(`document.querySelector('#dakun .tcard[aria-pressed="true"]')?.dataset.type === 'easybike' && /চালক ডাকুন/.test(document.querySelector('#dakun .dk-go')?.textContent || '')`));
await click('#dakun .tcard[data-type="cng"]');
check('the ডাকুন tab is marked', await ev(`document.querySelector('#dock [aria-current="page"]')?.dataset.key === 'dakun'`));
check('pickup starts at the chosen area', await ev(`/সিলেট/.test(document.getElementById('dkPick').value)`));
check('the map shows tiles', await waitFor(`document.querySelectorAll('#dakun .leaflet-tile-loaded').length > 3`, 25000));
check('nothing is booked or sent before a tap: no ride id saved', await ev(`!localStorage.getItem('sc-ride')`));
await shot('r3-dakun-390');
// 2. কিনে এনে দিন: the shop comes first, the list and the price limit are asked
await click('#dakun .tcard[data-type="errand"]');
check('কিনে এনে দিন: shop, list and limit fields', await waitFor(`!!document.getElementById('dkItems') && !!document.getElementById('dkMax') && /দোকান/.test(document.querySelector('label[for="dkPick"]').textContent)`));
// 3. the booking button asks for sign-in first (signed out), with the reason
await click('#dakun .tcard[data-type="cng"]');
await waitFor(`!document.getElementById('dkItems')`);
await click('#dakun .dk-go');
check('signed out: the booking button explains and offers sign-in', await waitFor(`/সাইন ইন/.test(document.querySelector('#dakun .dk-msg')?.textContent || '')`, 20000));
// 4. a place page offers "এখানে যেতে ডাকুন"; it opens ডাকুন with the place as the destination
await send('Page.navigate', { url: `${BASE}#/c/hospital` });
await waitFor(`document.querySelectorAll('#cat .near-row .btn.solid').length > 0`);
await click('#cat .near-row .btn.solid');
await waitFor(`/^#\/c\/hospital\/osm-/.test(location.hash)`);
const place = await ev(`document.querySelector('#cat h1')?.textContent || ''`);
const callBtns = await ev(`[...document.querySelectorAll('#cat button')].map((b) => b.textContent).filter((t) => /ডাকুন/.test(t))`);
check('hospital place page: "এখানে যেতে ডাকুন" and "অ্যাম্বুলেন্স ডাকুন"', callBtns.includes('এখানে যেতে ডাকুন') && callBtns.includes('অ্যাম্বুলেন্স ডাকুন'), JSON.stringify(callBtns));
await ev(`[...document.querySelectorAll('#cat button')].find((b) => b.textContent === 'অ্যাম্বুলেন্স ডাকুন').click()`);
check('it opens ডাকুন: ambulance, the hospital as the destination', await waitFor(`location.hash === '#/dakun' && document.querySelector('#dakun .tcard[aria-pressed="true"]')?.dataset.type === 'ambulance' && document.getElementById('dkDrop')?.value === ${JSON.stringify('')} + ${JSON.stringify(place)}`, 20000), place);
check('ambulance: the 999 reminder is shown', await ev(`!!document.querySelector('#dakun a[href="tel:999"]')`));
// 5. English
await ev(`document.getElementById('langBtn').click()`); await waitFor(`document.documentElement.lang === 'en'`);
check('English: the service names change', await waitFor(`[...document.querySelectorAll('#dakun .tcard span:last-child')].map((x) => x.textContent).includes('Collect a paid order')`));
const stored = await ev(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])))`);
check('only names are stored, no coordinates', !/\d+\.\d{3,}/.test(stored), stored.slice(0, 160));
check('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(failed ? `\n${failed} failed` : '\nALL OK');
process.exit(failed ? 1 : 0);
