// The family live page (#/track/<id>, src/js/live.js): place line and age above the map, scale bar, position and map links
// below it, "not live" after 60 s, no empty card when the share has ended. Firebase is replaced by a stub (js/firebase.js is
// answered by this test), so no network and no data are needed. Runs once in English and once in Bangla.
// Run: python -m http.server 8000 -d src      then      node tests/family-map-test.mjs        It must end with ALL OK.
// Options: BASE=http://127.0.0.1:8000/  CHROME="C:\path\to\chrome.exe"  OUT=<folder for screenshots>
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8000/', OUT = process.env.OUT || '';
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
if (!process.env.LANG_UNDER_TEST) {   // no language chosen: run this file once per language
  let bad = 0;
  for (const l of ['en', 'bn']) { console.log(`--- ${l}`); bad += spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, LANG_UNDER_TEST: l } }).status ? 1 : 0; }
  console.log(bad ? '\nFAILED' : '\nALL OK');
  process.exit(bad ? 1 : 0);
}
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const PORT = 9500 + Math.floor(Math.random() * 100);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'sc-fam-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch {} });
let v = null;
for (let i = 0; i < 50 && !v; i++) { await wait(200); v = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => null); }
const ws = new WebSocket(v.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map(), errors = [], handlers = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (waiting.has(d.id)) { waiting.get(d.id)(d.result || {}); waiting.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0] || d.params.exceptionDetails.text);
  for (const h of handlers) h(d);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
async function waitFor(expr, ms = 10000) { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await wait(100); } return false; }

// stub of js/firebase.js: every export of the real file exists; watchShare hands the callback to the test
const real = readFileSync(join(SRC, 'js/firebase.js'), 'utf8');
const names = [...real.matchAll(/export\s+(?:async\s+)?(?:function|const|let)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]).filter((n) => n !== 'watchShare');
const stub = `${names.map((n) => `export const ${n} = () => Promise.resolve(null);`).join('\n')}\nexport function watchShare(id, cb) { window.__cb = cb; return () => {}; }\n`;
await send('Runtime.enable'); await send('Page.enable'); await send('Network.setBypassServiceWorker', { bypass: true });
await send('Fetch.enable', { patterns: [{ urlPattern: '*js/firebase.js*', requestStage: 'Request' }] });
handlers.push(async (d) => {
  if (d.method === 'Fetch.requestPaused') {
    await send('Fetch.fulfillRequest', { requestId: d.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }], body: Buffer.from(stub).toString('base64') });
  }
});
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
const shot = async (file) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, file), Buffer.from(r.data, 'base64')); };

const LANG = process.env.LANG_UNDER_TEST || 'en';
await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('sc-lang', '${LANG}')` });
const shareId = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6';
await send('Page.navigate', { url: `${BASE}#/track/${shareId}` });
check('family page asks for the share', await waitFor(`typeof window.__cb === 'function'`, 20000));
const now = Date.now();
const share = (over) => JSON.stringify({ id: shareId, lat: 23.97178, lon: 90.27394, speed: 1.5, heading: null, battery: 49, status: 'active', startedAt: now - 120000, updatedAt: now - 8000, expiresAt: now + 14 * 60000, ...over });
await ev(`window.__cb(${share({})})`);
const en = LANG === 'en';
check('the page is in the language under test', (await ev(`document.documentElement.lang`)) === LANG);
check('place line above the map says where (near the centre of ... upazila)', await waitFor(`/Dhamrai|ধামরাই/i.test(document.querySelector('.live-place')?.textContent || '')`, 15000), await ev(`document.querySelector('.live-place')?.textContent`));
check('age line says "Updated ... ago" and is not red', await waitFor(`${en ? '/Updated .* ago/' : '/আপডেট: .* আগে/'}.test(document.querySelector('.live-age')?.textContent || '') && !document.querySelector('.live-age').classList.contains('bad')`), await ev(`document.querySelector('.live-age')?.textContent`));
check('the map opens (Leaflet) with a scale bar', await waitFor(`!!document.querySelector('.live-map.leaflet-container') && !!document.querySelector('.leaflet-control-scale')`, 20000));
check('position under the map shows 5 decimals' + (en ? '' : ' in Bangla digits'), await waitFor(`${en ? '/23\.97178.*90\.27394/' : '/২৩\.৯৭১৭৮.*৯০\.২৭৩৯৪/'}.test(document.querySelector('.live-coords')?.textContent || '')`), await ev(`document.querySelector('.live-coords')?.textContent`));
check('Google Maps and Directions links point at the point', await waitFor(`(() => { const a = [...document.querySelectorAll('.live-foot a')]; return a.length === 2 && /query=23\.97178,90\.27394/.test(a[0].href) && /destination=23\.97178,90\.27394/.test(a[1].href) && a.every((x) => x.rel.includes('noopener')); })()`));
check('the map starts at zoom 15 (scale bar shows a road-level scale)', await waitFor(`!!document.querySelector('.leaflet-tile-pane .leaflet-tile')`, 20000));
await wait(2500); await shot(`family-live-${LANG}.png`);
await ev(`window.__cb(${share({ updatedAt: now - 3 * 60000 })})`);
check('a point older than 60 s says "Not live" in red', await waitFor(`${en ? '/Not live/' : '/লাইভ নয়/'}.test(document.querySelector('.live-age')?.textContent || '') && document.querySelector('.live-age').classList.contains('bad')`), await ev(`document.querySelector('.live-age')?.textContent`));
await wait(500); await shot(`family-notlive-${LANG}.png`);
await ev(`window.__cb(null)`);
check('ended or expired: the message shows and the map card is hidden (no empty grey box)', await waitFor(`!!document.querySelector('.note') && [...document.querySelectorAll('.live-map')].every((m) => m.closest('section').hidden)`));
await shot(`family-ended-${LANG}.png`);
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(failed ? `\n${failed} failed` : '\nALL OK');
process.exit(failed ? 1 : 0);
