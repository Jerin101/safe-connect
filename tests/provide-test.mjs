// #365: the driver page in real Chrome with a stand-in for js/firebase.js (no Firebase, no network): new-call alert, the rider's
// online state on each request, the NID and family form for applicants, and the admin's check before approving.
// Run: python -m http.server 8000 -d src   (another terminal)     node tests/provide-test.mjs
// Options: BASE=http://127.0.0.1:8000/  CHROME="C:\path\to\chrome.exe". Needs 5 GB free in the temp folder (set TEMP/TMP to a roomier disk if needed).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statfsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8000/';
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const PORT = 9400 + Math.floor(Math.random() * 400);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const en = JSON.parse(readFileSync('src/js/lang/en.json', 'utf8')).page.provide;

const { bavail, bsize } = statfsSync(tmpdir());
if (bavail * bsize < 5e9) { console.error(`Only ${(bavail * bsize / 1e9).toFixed(1)} GB free in ${tmpdir()}; set TEMP to another disk.`); process.exit(2); }
const profile = mkdtempSync(join(tmpdir(), 'sc-prov-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch {} });
let version = null;
for (let i = 0; i < 50 && !version; i++) { await wait(200); version = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null); }
if (!version) throw new Error('Chrome did not start');
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(), handlers = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  for (const h of handlers) h(d);
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; const t = setTimeout(() => rej(new Error(`${method}: no answer`)), 15000);
  pending.set(i, (d) => { clearTimeout(t); d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result); });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
async function waitFor(expr, ms = 8000) { for (let t = 0; t < ms; t += 100) { if (await ev(`!!(${expr})`).catch(() => false)) return true; await wait(100); } return false; }

// stand-in for js/firebase.js: every export exists, calls are recorded in window.__calls, overrides come from window.__fb
const real = readFileSync('src/js/firebase.js', 'utf8');
const names = [...real.matchAll(/export\s+(?:async\s+)?(?:function|const|let)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
const stub = names.map((n) => `export const ${n} = (...a) => { (window.__calls = window.__calls || []).push([${JSON.stringify(n)}, ...a]); const o = (window.__fb || {})[${JSON.stringify(n)}]; return o ? o(...a) : Promise.resolve(null); };`).join('\n');
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setBypassServiceWorker', { bypass: true });
await send('Fetch.enable', { patterns: [{ urlPattern: '*js/firebase.js*', requestStage: 'Request' }] });
handlers.push((d) => { if (d.method === 'Fetch.requestPaused') send('Fetch.fulfillRequest', { requestId: d.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }], body: Buffer.from(stub).toString('base64') }); });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${String(info).slice(0, 150)})` : ''}`); };
let seq = 0;
// Opens the driver page with a given stand-in. fbSource = JS object literal text of overrides.
async function open(fbSource, lang = 'en') {
  const key = ++seq;
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (location.protocol.startsWith('http') && !window.__setup${key}) { window.__setup${key} = 1; localStorage.setItem('sc-lang', '${lang}'); localStorage.setItem('sc-welcomed', '1');
    localStorage.setItem('sc-near-area', JSON.stringify({ district: 'Noakhali', upazila: 'Noakhali Sadar' })); window.__calls = []; window.__fb = ${fbSource}; }` });
  await send('Page.navigate', { url: 'about:blank' });
  await send('Page.navigate', { url: `${BASE}#/provide` });
  await wait(800);
}
const base = `currentUser: async () => ({ uid: 'u1', email: 'a@b.c' }), isVerified: async () => true, readRates: async () => ({}), roleOf: async () => 'user',
  watchAllRides: () => () => {}, readRateTable: async () => [], pendingProviders: async () => [], myRides: async () => [], hasProviderPrivate: async () => false,
  watchRequests: (p, cb) => { window.__req = cb; return () => {}; }`;
const calls = (n) => ev(`window.__calls.filter((c) => c[0] === ${JSON.stringify(n)}).length`);
const text = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);

// 1. applicant: the NID and family form, with the same checks as the rules
await open(`{ ${base}, myProvider: async () => null }`);
check('applicant sees the NID and family form with the privacy sentence', await waitFor('document.getElementById("pvNid") && document.getElementById("pvFamPhone") && document.getElementById("pvConsent")'));
check('the form says only the applicant and admins can read it and when it is deleted', (await ev('document.getElementById("provide").textContent')).includes(en.privIntro.slice(0, 40)));
await ev(`document.getElementById('pvName').value = 'রহিম'; document.getElementById('pvVeh').value = 'ঢাকা-মেট্রো-১২৩৪'; true`);
const apply = () => ev(`[...document.querySelectorAll('#provide button')].find((b) => b.textContent.trim() === ${JSON.stringify(en.apply)}).click(); true`);
await apply();
check('a wrong NID is explained and nothing is sent', await waitFor(`document.querySelector('#provide .dk-msg')?.textContent.includes(${JSON.stringify(en.nidBad)})`) && (await calls('applyProvider')) === 0, await text('#provide .dk-msg'));
await ev(`document.getElementById('pvNid').value = '1234567890'; document.getElementById('pvFamName').value = 'করিম'; document.getElementById('pvFamPhone').value = '12345'; true`); await apply();
check('a wrong family phone is explained', await waitFor(`document.querySelector('#provide .dk-msg')?.textContent.includes(${JSON.stringify(en.famPhoneBad)})`));
await ev(`document.getElementById('pvFamPhone').value = '01712345678'; true`); await apply();
check('no consent: asked to tick, nothing sent', await waitFor(`document.querySelector('#provide .dk-msg')?.textContent.includes(${JSON.stringify(en.consentNeed)})`) && (await calls('applyProvider')) === 0);
await ev(`document.getElementById('pvConsent').click(); true`); await apply();
check('valid: the application and the private record are both saved', await waitFor(`window.__calls.some((c) => c[0] === 'saveProviderPrivate')`) && (await calls('applyProvider')) === 1, await ev('JSON.stringify(window.__calls.filter((c) => c[0] === "saveProviderPrivate").map((c) => Object.keys(c[1])))'));
check('the NID is sent as digits only and is not in the address or in localStorage', !(await ev('location.href')).includes('1234567890') && !(await ev('JSON.stringify(localStorage)')).includes('1234567890'));

// 2. pending applicant without details: asked to add them
await open(`{ ${base}, myProvider: async () => ({ id: 'u1', name: 'রহিম', type: 'cng', vehicle: 'ঢাকা-১২', district: 'noakhali', approved: false }), hasProviderPrivate: async () => false }`);
check('pending applicant with no details is asked for them', await waitFor(`document.getElementById('pvNid') && document.getElementById('provide').textContent.includes(${JSON.stringify(en.privMissing)})`));
await open(`{ ${base}, myProvider: async () => ({ id: 'u1', name: 'রহিম', type: 'cng', vehicle: 'ঢাকা-১২', district: 'noakhali', approved: false }), hasProviderPrivate: async () => true }`);
check('pending applicant who already gave them is not asked again', await waitFor(`document.getElementById('provide').textContent.includes('${en.pendingTitle}')`) && !(await ev('!!document.getElementById("pvNid")')));

// 3. approved driver: go online, a new call alerts, the rider's state shows
await ev(`window.__beeps = 0; true`);
await open(`{ ${base}, myProvider: async () => ({ id: 'u1', name: 'রহিম', type: 'cng', vehicle: 'ঢাকা-১২', district: 'noakhali', approved: true }) }`);
check('approved driver sees the go-online button', await waitFor(`[...document.querySelectorAll('#provide button')].some((b) => b.textContent.trim() === ${JSON.stringify(en.goOnline)})`));
await ev(`window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; }; true`);
await ev(`[...document.querySelectorAll('#provide button')].find((b) => b.textContent.trim() === ${JSON.stringify(en.goOnline)}).click(); true`);
check('after going online the alert state and its limit are written under the button', await waitFor(`document.querySelector('.pv-alertnote')?.textContent.includes(${JSON.stringify(en.alertLimit)})`, 6000), (await text('.pv-alertnote')) + ' || ' + (await ev('document.getElementById("provide").textContent.slice(0, 400)')));
await ev(`window.__req([]); true`);
const now = Date.now();
await ev(`window.__req([{ id: 'r1', type: 'cng', district: 'noakhali', pickup: { lat: 22.87, lon: 91.1, label: 'মাইজদী বাজার' }, drop: { lat: 22.86, lon: 91.09, label: 'হাসপাতাল' }, estM: 1500, estFare: 60, riderSeenAt: ${now - 10000} }]); true`);
check('a new call vibrates and puts the count in the page title', await waitFor(`window.__vib.length === 1 && /^\\(1\\)/.test(document.title)`), await ev('document.title'));
check('the request shows the customer is online now', await waitFor(`document.querySelector('.pv-presence')?.textContent.trim() === ${JSON.stringify(en.riderOnline)}`), await text('.pv-presence'));
await ev(`window.__req([{ id: 'r1', type: 'cng', district: 'noakhali', pickup: { lat: 22.87, lon: 91.1, label: 'মাইজদী বাজার' }, estM: 0, estFare: 60, riderSeenAt: ${Date.now() - 6 * 60000} }, { id: 'r2', type: 'cng', district: 'noakhali', pickup: { lat: 22.87, lon: 91.1, label: 'বসুরহাট' }, estM: 0, estFare: 60 }]); true`);
check('an old heartbeat says not seen for 6 min; no heartbeat says unknown; the second new call alerts again', await waitFor(`[...document.querySelectorAll('.pv-presence')].map((x) => x.textContent).join('|').includes('6 min') && [...document.querySelectorAll('.pv-presence')].some((x) => x.textContent === ${JSON.stringify(en.riderUnknown)}) && window.__vib.length === 2`), await ev(`[...document.querySelectorAll('.pv-presence')].map((x) => x.textContent).join('|')`));
await ev(`[...document.querySelectorAll('#provide button')].find((b) => b.textContent.trim() === ${JSON.stringify(en.goOffline)}).click(); true`);
check('going offline removes the alert note and restores the title', await waitFor(`!document.querySelector('.pv-alertnote') && !/^\\(/.test(document.title)`), await ev('document.title'));

// 4. admin: sees the details only on tap, must tick before approving
const pend = `[{ id: 'p1', name: 'করিম', type: 'cng', vehicle: 'ঢাকা-৯৯', district: 'noakhali', approved: false }]`;
await open(`{ ${base}, roleOf: async () => 'admin', myProvider: async () => null, pendingProviders: async () => ${pend}, readProviderPrivate: async () => ({ nid: '1234567890123', familyName: 'রহিমা', familyRelation: 'mother', familyPhone: '01712345678' }), approveProvider: async () => null, rejectProvider: async () => null }`);
check('admin sees the waiting applicant but not the NID yet', await waitFor(`document.getElementById('chk-p1')`) && !(await ev('document.getElementById("provide").textContent')).includes('1234567890123'));
const row = (label) => `[...document.querySelectorAll('#provide button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
await ev(`${row(en.approve)}.click(); true`);
check('approving without ticking is refused and nothing is sent', await waitFor(`document.querySelector('#provide .dk-msg')?.textContent.includes(${JSON.stringify(en.needChecked)}) || document.body.textContent.includes(${JSON.stringify(en.needChecked)})`) && (await calls('approveProvider')) === 0);
await ev(`${row(en.showPriv)}.click(); true`);
check('after a tap the admin sees NID, family contact, relation and phone', await waitFor(`document.querySelector('.pv-priv') && !document.querySelector('.pv-priv').hidden && document.querySelector('.pv-priv').textContent.includes('1234567890123') && document.querySelector('.pv-priv').textContent.includes('01712345678')`), await text('.pv-priv'));
await ev(`document.getElementById('chk-p1').click(); ${row(en.approve)}.click(); true`);
check('after ticking, approve is sent for that applicant', await waitFor(`window.__calls.some((c) => c[0] === 'approveProvider' && c[1] === 'p1')`));
check('no uncaught errors on the page', errors.length === 0, errors.join(' | '));
console.log(failed ? `\n${failed} FAILED` : '\nALL OK');
process.exit(failed ? 1 : 0);
