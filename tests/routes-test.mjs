// A2 (#257): every old and new address opens the right page, the main tabs mark it, and Bangla/English works on
// every tab. Drives the Chrome (or Edge) already on this computer over the DevTools protocol; no packages.
// Run: python -m http.server 8000   (in the project folder, in another terminal)
//      node tests/routes-test.mjs           It must end with ALL OK.
// Options: BASE=http://127.0.0.1:8000/  CHROME="C:\path\to\chrome.exe"
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8000/';
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const PORT = 9400 + Math.floor(Math.random() * 100);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'sc-routes-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch {} });

let v = null;
for (let i = 0; i < 50 && !v; i++) { await wait(200); v = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => null); }
const ws = new WebSocket(v.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const waiting = new Map(), errors = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (waiting.has(d.id)) { waiting.get(d.id)(d.result || {}); waiting.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0] || d.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
async function waitFor(expr, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await wait(100); } return false; }
await send('Runtime.enable');
await send('Network.setBypassServiceWorker', { bypass: true });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

let failed = 0;
const check = (name, ok, info = '') => { if (!ok) failed += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };
const state = () => ev(`({ hash: location.hash, page: document.getElementById('main').dataset.page, tab: document.querySelector('#dock [aria-current="page"]')?.dataset.key || null,
  focus: document.activeElement?.id || '' })`);
async function open(hash) {
  await send('Page.navigate', { url: BASE + hash });
  await waitFor(`document.readyState === 'complete' && !!document.querySelector('#dock button') && !!document.getElementById('main').dataset.page`, 15000);
  await wait(400);
  return state();
}

// [address typed or linked, address shown afterwards, page, tab marked]
const CASES = [
  ['', '#/today', 'home', 'home'], ['#/', '#/today', 'home', 'home'], ['#/home', '#/today', 'home', 'home'], ['#/today', '#/today', 'home', 'home'],
  ['#/area', '#/near', 'area', 'home'], ['#/near', '#/near', 'area', 'home'],
  ['#/send', '#/sos', 'send', 'send'], ['#/sos', '#/sos', 'send', 'send'],
  ['#/numbers', '#/numbers', 'numbers', 'home'], ['#/account', '#/account', 'account', 'account'], ['#/dakun', '#/dakun', 'dakun', 'dakun'],
  ['#/guide', '#/guide', 'guide', null], ['#/about', '#/about', 'about', null], ['#/faq', '#/faq', 'faq', null], ['#/prepare', '#/prepare', 'prepare', null],
  ['#/area/noakhali/hatiya', '#/area/noakhali/hatiya', 'place', 'home'], ['#/c', '#/c', 'cat', 'home'], ['#/c/pharmacy', '#/c/pharmacy', 'cat', 'home'],
  ['#/help/22.29580,91.10660,1793624400,followed', '#/help/22.29580,91.10660,1793624400,followed', 'help', null],
  ['#/no-such-page', '#/today', 'home', 'home'],
];
for (const [from, to, page, tab] of CASES) {
  const s = await open(from);
  check(`${from || '(no address)'} → ${to}, page "${page}"`, s.hash === to && s.page === page && s.tab === tab, JSON.stringify(s));
}
const s = await open('#/search');
check('#/search → #/near with the cursor in the area search', s.hash === '#/near' && s.page === 'area' && s.focus === 'areaInput', JSON.stringify(s));

// The tabs themselves (R2/R3, #267): হোম, সেবা ডাকুন, জরুরি সাহায্য, সাইন ইন. The categories and numbers are on home.
await open('#/today');
const keys = await ev(`[...document.querySelectorAll('#dock button')].map((b) => b.dataset.key)`);
check('four main tabs: হোম, সেবা ডাকুন, জরুরি সাহায্য, সাইন ইন', JSON.stringify(keys) === JSON.stringify(['home', 'dakun', 'send', 'account']), JSON.stringify(keys));
for (const [key, hash, page] of [['dakun', '#/dakun', 'dakun'], ['send', '#/sos', 'send'], ['home', '#/today', 'home']]) {
  await ev(`document.querySelector('#dock [data-key="${key}"]').click()`);
  const ok = await waitFor(`location.hash === '${hash}' && document.getElementById('main').dataset.page === '${page}'`);
  check(`tab "${key}" opens ${hash}`, ok, JSON.stringify(await state()));
}
// signed out: the সাইন ইন tab opens the sign-in window (nothing is loaded or sent before the person chooses)
await ev(`document.querySelector('#dock [data-key="account"]').click()`);
check('tab "account" (signed out) opens the sign-in window', await waitFor(`document.querySelector('dialog[open]') !== null`));
await ev(`document.querySelector('dialog[open]')?.close(); true`);
check('home: 12 category tiles, the area card and the live-location button', await waitFor(`document.querySelectorAll('#homeCats .cat-tile').length === 12 && !!document.getElementById('homeTitle') && document.getElementById('sosBtn').getClientRects().length > 0`));
check('home: the old hero and sidebar are not shown', await ev(`document.querySelector('.hero').hidden && document.getElementById('rail').hidden !== false`));

// Bangla and English on every tab: the tab labels and the page change language.
const LABELS = { bn: ['হোম', 'সেবা ডাকুন', 'জরুরি সাহায্য', 'সাইন ইন'], en: ['Home', 'Book a service', 'Emergency help', 'Sign in'] };
for (const hash of ['#/today', '#/near', '#/numbers', '#/sos']) {
  await open(hash);
  for (const lang of ['en', 'bn']) {
    const now = await ev(`document.documentElement.lang`);
    if (now !== lang) { await ev(`document.getElementById('langBtn').click()`); await waitFor(`document.documentElement.lang === '${lang}'`); }
    const got = await ev(`[...document.querySelectorAll('#dock button span')].map((x) => x.textContent)`);
    check(`${hash} in ${lang}: tabs say ${LABELS[lang].join(', ')}`, JSON.stringify(got) === JSON.stringify(LABELS[lang]) && (await ev('location.hash')) === hash, JSON.stringify(got));
  }
}
check('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(failed ? `\n${failed} failed` : '\nALL OK');
process.exit(failed ? 1 : 0);
