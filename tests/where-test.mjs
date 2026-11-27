// M1.2 page integration, part 2 (real Chrome): the "Where the map puts you" card on the area page, driven over the
// DevTools protocol with a fake position and fake location permission. No packages to install (CLAUDE.md rule 3).
// Run: python -m http.server 8000 -d src   (in the project folder, in another terminal)
//      node tests/where-test.mjs
// Options: BASE=http://127.0.0.1:8000/  CHROME="C:\path\to\chrome.exe". The Chrome profile goes to the temp folder; the run
// stops when less than 5 GB is free there (set TEMP/TMP to a roomier disk if needed).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statfsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAreaPolygons } from '../src/js/areapoly.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8000/';
const ORIGIN = new URL(BASE).origin;
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const PORT = 9400 + Math.floor(Math.random() * 400);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pageErrors = [];

// ---- test data from the repo itself ----
const master = JSON.parse(readFileSync('src/data/master_areas.json', 'utf8'));
const svc = createAreaPolygons({ fetchFn: async (u) => new Response(readFileSync('src/' + u, 'utf8')) });
const hu = master.unions.find((x) => x.derived_upazila === 'BD20750036');
const HATIYA = { lat: hu.lat, lon: hu.lon };
let SEA = null;                    // inside a district box, in no polygon
for (const d of (await svc.getIndex()).districts) {
  for (const [lat, lon] of [[d.bbox[1] + 0.003, d.bbox[0] + 0.003], [d.bbox[1] + 0.003, d.bbox[2] - 0.003]]) {
    if (!SEA && (await svc.locate(lat, lon)).status === 'no_polygon') SEA = { lat, lon };
  }
}
if (!SEA) throw new Error('no test point without a polygon found');
const en = JSON.parse(readFileSync('src/js/lang/en.json', 'utf8')).ui, bn = JSON.parse(readFileSync('src/js/lang/bn.json', 'utf8')).ui;

// ---- Chrome ----
const { bavail, bsize } = statfsSync(tmpdir());
if (bavail * bsize < 5e9) { console.error(`Only ${(bavail * bsize / 1e9).toFixed(1)} GB free in ${tmpdir()}; free some space or set TEMP to another disk.`); process.exit(2); }
const profile = mkdtempSync(join(tmpdir(), 'sc-where-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch { console.error(`Could not remove ${profile}`); } });
let version = null;
for (let i = 0; i < 50 && !version; i++) { await wait(200); version = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null); }
if (!version) throw new Error('Chrome did not start');
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') pageErrors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; const timer = setTimeout(() => { pending.delete(i); rej(new Error(`${method}: no answer`)); }, 15000);
    pending.set(i, (d) => { clearTimeout(timer); if (d.error) rej(new Error(`${method}: ${d.error.message}`)); else res(d.result); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { send };
}
const browser = await connect(version.webSocketDebuggerUrl);
const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
const page = await connect((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.id === targetId).webSocketDebuggerUrl);
const ev = async (expr) => {
  const r = await page.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
await page.send('Page.enable'); await page.send('Network.enable'); await page.send('Runtime.enable');
const permission = (setting) => browser.send('Browser.setPermission', { origin: ORIGIN, permission: { name: 'geolocation' }, setting });
const moveTo = (p, accuracy = 30) => page.send('Emulation.setGeolocationOverride', { latitude: p.lat, longitude: p.lon, accuracy });
async function waitFor(expr, ms = 8000) { for (let t = 0; t < ms; t += 100) { if (await ev(`!!(${expr})`)) return true; await wait(100); } return false; }
async function open({ w = 1280, lang = 'en', blocked = [] } = {}) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: w < 800 });
  await page.send('Network.setBlockedURLs', { urls: blocked });
  await page.send('Page.navigate', { url: BASE }); await wait(800);
  await ev(`localStorage.clear(); localStorage.setItem('sc-lang', '${lang}'); localStorage.setItem('sc-welcomed', '1'); window.__old = true`);
  await page.send('Page.navigate', { url: BASE });
  if (!await waitFor('!window.__old && document.getElementById("homeAutoSw")')) throw new Error('page did not load');
}
const tapLocate = () => ev('document.getElementById("locateBtn").click(); true');
const whereText = () => ev('(document.getElementById("where") || {}).hidden === false ? document.getElementById("where").textContent.replace(/\\s+/g, " ").trim() : null');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${String(detail).slice(0, 160)})` : ''}`); if (!ok) failed++; };

// 1. English, real position inside Hatiya
await permission('granted'); await moveTo(HATIYA);
await open({ lang: 'en' }); await tapLocate();
check('en: card appears after "Find help near me"', await waitFor('document.getElementById("where") && !document.getElementById("where").hidden && document.querySelector("#where .where-list")'));
let t = await whereText();
check('en: division, district, upazila from the polygon', /Chattogram/.test(t) && /Noakhali/.test(t) && /Hatiya/.test(t), t);
check('en: "Nearest union centre" with the warning, never "your union is"', t.includes(en.where.centreTitle) && t.includes('not your union') && !/your union is|exact union/i.test(t), t);
check('en: source and licence shown', /CC BY-IGO/.test(t));
check('en: the area page and contacts still work', (await ev('document.getElementById("placeName").textContent.length > 0 && document.querySelectorAll("#firstList a, #firstList button").length > 0')));
check('privacy: no coordinates saved in localStorage', !(await ev('JSON.stringify(localStorage)')).includes(String(HATIYA.lat).slice(0, 6)));
check('card is a live region without innerHTML-injected markup', await ev('document.getElementById("where").getAttribute("aria-live") === "polite" && !document.querySelector("#where script, #where img")'));

// 2. Bangla
await open({ lang: 'bn' }); await tapLocate();
await waitFor('document.querySelector("#where .where-list")');
t = await whereText();
check('bn: Bangla card with the Bangla labels', t && t.includes(bn.where.centreTitle) && t.includes('আপনার ইউনিয়ন নয়') && t.includes(bn.where.upazila), t);
check('bn: no Latin digits in the numbers', t && !/\d/.test(t.replace(/CC BY-IGO|OCHA|HDX/g, '')), t);

// 3. 360 px, no sideways scroll, 999 still on screen
await open({ lang: 'en', w: 360 }); await tapLocate(); await waitFor('document.querySelector("#where .where-list")');
check('360 px: no sideways scroll with the card', await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'), await ev('document.documentElement.scrollWidth + " vs " + document.documentElement.clientWidth'));

// 4. no polygon (a point inside a district box but in no boundary) and outside Bangladesh
await moveTo(SEA); await open({ lang: 'en' }); await tapLocate();
await waitFor('document.getElementById("where") && !document.getElementById("where").hidden');
t = await whereText();
check('no polygon: plain message, no names', t && t.includes(en.where.noPolygon.slice(0, 40)) && !/Division|Upazila Hatiya/.test(t), t);
check('no polygon: the contact page still shows', await ev('document.getElementById("area") && !document.getElementById("area").hidden'));
await moveTo({ lat: 0, lon: 0 }); await open({ lang: 'en' }); await tapLocate();
await waitFor('document.getElementById("where") && !document.getElementById("where").hidden');
check('outside Bangladesh: plain message', (await whereText() || '').includes(en.where.noPolygon.slice(0, 40)));

// 5. GPS permission denied: the existing message, no card
await permission('denied'); await moveTo(HATIYA); await open({ lang: 'en' }); await tapLocate();
check('permission denied: the existing message shows', await waitFor('document.getElementById("locMsg") && !document.getElementById("locMsg").hidden'), await ev('document.getElementById("locMsg").textContent'));
check('permission denied: no card, no names', (await whereText()) === null);
await permission('granted');

// 6. boundary files cannot load (offline before the first visit / blocked)
await moveTo(HATIYA); await open({ lang: 'en', blocked: ['*data/polygons/*'] }); await tapLocate();
await waitFor('document.getElementById("where") && !document.getElementById("where").hidden');
t = await whereText();
check('files blocked: "not on this phone yet", contacts still work', t && t.includes(en.where.unavailable.slice(0, 30)) && await ev('document.getElementById("placeName").textContent.length > 0'), t);

// 7. offline after the site was saved: the service worker cache answers
await open({ lang: 'en' });
const saved = await waitFor('caches.keys().then((k) => k.some((x) => /^safeconnect-v\\d+/.test(x)))', 20000);
check('service worker saved a cache', saved, await ev('caches.keys().then((k) => k.join(","))'));
const nPoly = await ev(`caches.keys().then(async (k) => { const c = await caches.open(k.find((x) => /^safeconnect-v\\d+/.test(x))); return (await c.keys()).filter((r) => r.url.includes('/data/polygons/')).length; })`);
check('cache holds the index and all 64 district layers', nPoly === 65, nPoly);
await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await page.send('Page.reload'); await wait(1500);
await waitFor('document.getElementById("homeAutoSw")');
await tapLocate();
check('offline: the card still works from the saved layers', await waitFor('document.querySelector("#where .where-list")', 10000), await whereText());
await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

check('no uncaught errors on the page', pageErrors.length === 0, pageErrors.join(' | '));
console.log(failed ? `\n${failed} FAILED` : '\nALL OK');
process.exit(failed ? 1 : 0);
