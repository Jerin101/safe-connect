// A ride left open on the phone by another account (id in localStorage "sc-ride") must not leave Book a service as a grey box for ever:
// when the signed-in account may not read that ride, the page forgets it and shows the form (js/dakun.js, follow()).
// Firebase is replaced by a stub that refuses the ride, so no network and no data are needed.
// Run: python -m http.server 8000 -d src      then      node tests/ride-resume-test.mjs        It must end with ALL OK.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8000/';
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
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

const real = readFileSync(join(SRC, 'js/firebase.js'), 'utf8');
const names = [...real.matchAll(/export\s+(?:async\s+)?(?:function|const|let)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]).filter((n) => !['watchRide', 'currentUser', 'readRates'].includes(n));
const stub = `${names.map((n) => `export const ${n} = () => Promise.resolve(null);`).join('\n')}
export const currentUser = () => Promise.resolve({ uid: 'account-B', email: 'b@example.com' });
export const readRates = () => Promise.resolve({});
export function watchRide(id, cb, onErr) { window.__asked = id; setTimeout(() => onErr({ code: 'permission-denied' }), 50); return () => {}; }
`;
await send('Runtime.enable'); await send('Page.enable'); await send('Network.setBypassServiceWorker', { bypass: true });
await send('Fetch.enable', { patterns: [{ urlPattern: '*js/firebase.js*', requestStage: 'Request' }] });
handlers.push(async (d) => {
  if (d.method === 'Fetch.requestPaused') await send('Fetch.fulfillRequest', { requestId: d.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }], body: Buffer.from(stub).toString('base64') });
});
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('sc-lang', 'en'); localStorage.setItem('sc-near-area', JSON.stringify({ district: 'Dhaka', upazila: 'Dhamrai' })); localStorage.setItem('sc-ride', 'ride-made-by-account-A');` });
await send('Page.navigate', { url: `${BASE}#/dakun` });
check('the page asks for the old ride (it is signed in)', await waitFor(`window.__asked === 'ride-made-by-account-A'`, 20000));
check('the ride is refused: the page shows the form, not a grey box', await waitFor(`!!document.querySelector('#dakun form, #dakun .dk-types, #dakun h1') && document.querySelectorAll('#dakun .skeleton').length === 0`, 15000), await ev(`document.getElementById('dakun')?.innerText.replace(/\s+/g, ' ').slice(0, 80)`));
check('the old ride is forgotten on this phone', await waitFor(`localStorage.getItem('sc-ride') === ''`));
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(failed ? `\n${failed} failed` : '\nALL OK');
process.exit(failed ? 1 : 0);
