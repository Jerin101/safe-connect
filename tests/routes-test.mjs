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
  ['#/numbers', '#/numbers', 'numbers', 'home'], ['#/account', '#/account', 'account', 'account'], ['#/dakun', '#/dakun', 'dakun', 'dakun'], ['#/provide', '#/provide', 'provide', 'account'], ['#/live', '#/live', 'live', 'send'],
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
// R5 (#267): জরুরি সাহায্য: the big 999, "এখন যা করবেন", this area's numbers, the 19 helplines by need with sources
await open('#/sos');
await ev(`localStorage.setItem('sc-lang', 'bn'); localStorage.setItem('sc-near-area', JSON.stringify({ district: 'Sylhet', upazila: 'Sylhet Sadar' })); true`);
await send('Page.reload'); await waitFor(`document.querySelectorAll('#sosLines .near-row').length > 0`, 15000);
check('জরুরি সাহায্য: the big 999 call', await ev(`document.querySelector('#sosCall a')?.getAttribute('href') === 'tel:999' && document.getElementById('sosTitle').textContent === 'জরুরি সাহায্য'`));
check('জরুরি সাহায্য: "এখন যা করবেন" for the situation', await ev(`!document.getElementById('sitSteps').hidden && document.querySelectorAll('#sitSteps li').length >= 3`));
check('জরুরি সাহায্য: 19 helplines with a source each', await ev(`document.querySelectorAll('#sosLines .near-row').length === 19 && document.querySelectorAll('#sosLines .near-row a[href^="https://"]').length === 19`));
check('জরুরি সাহায্য: the area numbers (Sylhet: 999 and the nearest police station)', await waitFor(`/কাছের থানা/.test(document.getElementById('sosArea').textContent) && !!document.querySelector('#sosArea a[href="tel:999"]')`, 15000));
await ev(`[...document.querySelectorAll('#situations button')].find((b) => b.textContent === 'জরুরি চিকিৎসা').click(); true`);
check('choosing "জরুরি চিকিৎসা" shows its steps and the nearest hospital and pharmacy', await waitFor(`/জরুরি চিকিৎসা/.test(document.getElementById('sitStepsTitle')?.textContent || '') && /কাছের ফার্মেসি/.test(document.getElementById('sitSteps').textContent)`));
// SRS PR-2: live sharing needs sign-in; a wrong or ended link says so; home has the live-sharing button
await open('#/live');
check('#/live signed out: sign-in first (UC-10 2.1)', await waitFor(`/সাইন ইন লাগে/.test(document.getElementById('live').textContent) && !!document.querySelector('#live button.btn.solid')`, 15000));
await open('#/track/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
check('#/track with an unknown id: "শেয়ার শেষ হয়েছে বা লিংকের মেয়াদ শেষ" (UC-12 3.1)', await waitFor(`/শেয়ার শেষ হয়েছে/.test(document.getElementById('live').textContent) && document.getElementById('main').dataset.page === 'track'`, 20000));
await open('#/track/bad');
check('#/track with a malformed id: ended message, no request', await waitFor(`/শেয়ার শেষ হয়েছে/.test(document.getElementById('live').textContent)`));
await open('#/today');
check('home: the "লাইভ লোকেশন শেয়ার" button opens #/live', await ev(`document.getElementById('liveBtn').getAttribute('href') === '#/live' && document.getElementById('liveBtnTitle').textContent === 'লাইভ লোকেশন শেয়ার'`));
// SRS PR-6: Home modules, the theme is remembered, registration asks for a name
await open('#/today');
check('home: the duplicate six-tile block is gone (the bottom bar and the category tiles stay)', await ev(`!document.getElementById('homeMods')`));
const themeBefore = await ev(`document.documentElement.dataset.theme || ''`);
await ev(`document.getElementById('themeBtn').click(); true`);
const themeNow = await ev(`document.documentElement.dataset.theme`);
await send('Page.reload'); await waitFor(`!!document.querySelector('#dock button')`, 15000);
check('the theme is remembered after a reload (sc-theme)', (await ev(`document.documentElement.dataset.theme`)) === themeNow && themeNow !== themeBefore, `${themeBefore} -> ${themeNow}`);
await ev(`document.getElementById('themeBtn').click(); true`);
await ev(`document.querySelector('#dock [data-key="account"]').click(); true`);
await waitFor(`!!document.querySelector('dialog[open] #siName')`, 15000);
await ev(`document.getElementById('siEmail').value = 'someone@example.com'; document.getElementById('siPass').value = 'abcdef12'; document.getElementById('siCreate').click(); document.getElementById('siName').value = ''; document.getElementById('siSubmit').click(); true`);   // "Create new account" opens the sign-up page; Sign up with no name
check('registration without a name: "সব ঘর ঠিকমতো পূরণ করুন" (UC-01)', await waitFor(`/সব ঘর ঠিকমতো পূরণ করুন/.test(document.getElementById('siMsg').textContent)`, 15000));
await ev(`document.querySelector('dialog[open]')?.close(); true`);
// SRS PR-7: SOS situations as the SRS; the Government Directory (Sylhet: no checked numbers → 999 + nearest)
await open('#/sos');
const sits = await ev(`[...document.querySelectorAll('#situations button')].map((b) => b.textContent)`);
check('SOS situations: বিপদে আছি, কেউ পিছু নিয়েছে, দুর্ঘটনা, জরুরি চিকিৎসা, পথ হারিয়েছি, হয়রানি', JSON.stringify(sits) === JSON.stringify(['বিপদে আছি', 'কেউ পিছু নিয়েছে', 'দুর্ঘটনা', 'জরুরি চিকিৎসা', 'পথ হারিয়েছি', 'হয়রানি']), JSON.stringify(sits));
await ev(`[...document.querySelectorAll('#situations button')].find((b) => b.textContent === 'হয়রানি').click(); true`);
check('হয়রানি: steps and the 109 helpline', await waitFor(`/হয়রানি/.test(document.getElementById('sitStepsTitle')?.textContent || '') && !!document.querySelector('#sitSteps a[href="tel:109"]')`));
check('offline pack: the national numbers are saved on the phone (IndexedDB) with a check date', await waitFor(`(async () => { const p = await (await import('./js/offlinepack.js')).loadPack(); return !!p && p.national.some((r) => r.phones.includes('999') && r.checked_on); })()`, 15000));
check('easy mode (phone: Aa opens the Display menu): "Bigger text" turns it on, remembers it, and turns it off', await waitFor(`(() => { const b = document.getElementById('easyBtn'), d = document.getElementById('dispEasy'); b.click(); d.click(); const on = document.documentElement.dataset.easy === '1' && localStorage.getItem('sc-easy') === '1' && d.getAttribute('aria-pressed') === 'true' && b.getAttribute('aria-pressed') === 'true'; d.click(); b.click(); return on && document.documentElement.dataset.easy === '0' && document.getElementById('dispMenu').hidden; })()`, 8000));
check('offline queue: a report is saved on the phone without the user id, and removed again', await waitFor(`(async () => { const q = await import('./js/reportqueue.js'); const r = await q.enqueue('report', { recordId: 'test-1', district: 'noakhali', problem: 'off', note: '' }); const all = await q.listQueue(); const mine = all.find((x) => x.data.recordId === 'test-1'); const okk = r === 'saved' && !!mine && !('uid' in mine.data); for (const x of all) await q.removeItem(x.id); return okk && (await q.countQueue()) === 0; })()`, 15000));
check('offline pack: the six SOS message texts are saved in Bangla and English', await waitFor(`(async () => { const p = await (await import('./js/offlinepack.js')).loadPack(); return !!p && Array.isArray(p.sms) && p.sms.length === 6 && p.sms.every((x) => x.bn.length > 5 && x.en.length > 5); })()`, 20000));
check('readiness check: the offline pack line turns to a tick once the pack is saved (no leaving the page)', await waitFor(`document.querySelectorAll('#sosReady li.ready-ok').length >= 1`, 20000));
check('guided escalation: tapping the 999 call asks "Did the call connect?"', await waitFor(`(() => { const a = document.querySelector('#sosCall .sos-call'); const ask = document.querySelector('#sosCall .esc'); if (!a || !ask) return false; a.addEventListener('click', (e) => e.preventDefault(), { once: true }); a.click(); return !ask.hidden && ask.textContent.length > 10; })()`, 15000));
check('silent SOS with no family number does not claim a message is ready and keeps quiet mode off', await waitFor(`(() => { localStorage.removeItem('sc-family'); const x = document.getElementById('sosExtras'); const q = [...x.querySelectorAll('button')].find((b) => !b.classList.contains('siren-btn')); q.click(); return document.documentElement.dataset.quiet !== '1' && !/Tap send/.test(x.textContent); })()`, 15000));
check('offline answers: a saved "How is it now?" answer is sent once online; an old one and a refused one are dropped; the newest replaces the older', await waitFor(`(async () => { const q = await import('./js/reportqueue.js'); for (const x of await q.listQueue()) await q.removeItem(x.id); const calls = []; const fb = { isVerified: async () => true, readPlaceStatus: async () => null, sendPlaceStatus: async (id, v, n) => { if (id === 'refused-place') { const e = new Error('no'); e.code = 'permission-denied'; throw e; } calls.push([id, v, n.n]); } }; await q.enqueue('vote', { placeId: 'fresh-place', value: 'open' }); await q.enqueue('vote', { placeId: 'fresh-place', value: 'closed' }); await q.enqueue('vote', { placeId: 'old-place', value: 'open' }, Date.now() - 2 * 3600000); await q.enqueue('vote', { placeId: 'refused-place', value: 'open' }); const before = (await q.listQueue()).length; const res = await q.flushQueue({ fb, user: { uid: 'u1' } }); const left = await q.countQueue(); return before === 3 && res.sent === 1 && calls.length === 1 && calls[0][0] === 'fresh-place' && calls[0][1] === 'closed' && left === 0; })()`, 15000));
check('disaster card: the official warning line 1090 and a shelter button', await waitFor(`!!document.querySelector('#sosDisaster a[href="tel:1090"]') && [...document.querySelectorAll('#sosDisaster button')].length >= 1`, 15000));
check('siren and silent SOS: the siren button shows; silent mode hides every loud button and ends again', await waitFor(`(() => { const x = document.getElementById('sosExtras'); const btns = [...x.querySelectorAll('button')]; const siren = btns.find((b) => b.classList.contains('siren-btn')); const quiet = btns.find((b) => !b.classList.contains('siren-btn')); if (!siren || !quiet) return false; localStorage.setItem('sc-family', JSON.stringify([{ name: 'Test', phone: '01712345678' }])); const hidden = () => getComputedStyle(siren).display === 'none'; quiet.click(); const on = document.documentElement.dataset.quiet === '1' && hidden(); quiet.click(); localStorage.removeItem('sc-family'); return on && document.documentElement.dataset.quiet === '0' && !hidden(); })()`, 15000));
check('readiness check: shows what is ready and offers to add a family number', await waitFor(`(() => { const r = document.getElementById('sosReady'); return !!r && r.querySelectorAll('li').length === 2 && r.querySelector('h2')?.textContent.length > 5; })()`, 15000));
check('no location: the SMS still names the area (UC-08 3.1)', await waitFor(`/সিলেট/.test(document.getElementById('sosMsg').value)`, 15000));
await open('#/numbers');
check('Directory (#/numbers): the area, "যাচাই করা নম্বর এখনো নেই", 999 and the nearest', await waitFor(`/সিলেট/.test(document.getElementById('dirTitle')?.textContent || '') && /যাচাই করা নম্বর এখনো নেই/.test(document.getElementById('dirArea').textContent) && !!document.querySelector('#dirArea a[href="tel:999"]') && /কাছের থানা/.test(document.getElementById('dirArea').textContent)`, 20000));
await ev(`localStorage.setItem('sc-near-area', JSON.stringify({ district: 'Noakhali', upazila: 'Hatiya' })); true`); await send('Page.reload');
check('Directory in a pilot area: official numbers by role, each with a source', await waitFor(`document.querySelectorAll('#dirArea details.cat').length >= 3 && document.querySelectorAll('#dirArea a[href^="https://"]').length > 3`, 20000));
// phone width (390 px, the width of a common phone): the area chip must not slide under the 999 button, and the disaster labels must not be crushed
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await ev(`localStorage.setItem('sc-near-area', JSON.stringify({ district: 'Noakhali', upazila: 'Hatiya' })); true`); await open('#/sos');
check('phone width: the area chip ends before the 999 button (no overlap)', await waitFor(`(() => { const c = document.getElementById('areaChip').getBoundingClientRect(), n = document.getElementById('h999').getBoundingClientRect(); return c.width > 30 && c.right <= n.left + 1; })()`, 15000));
check('phone width: nothing in the header sticks out of the screen', await waitFor(`document.documentElement.scrollWidth <= window.innerWidth + 1`, 10000));
check('phone width: the disaster card labels have room (not squeezed into a thin column)', await waitFor(`(() => { const t = document.querySelector('#sosDisaster .near-row .t'); return !!t && t.getBoundingClientRect().width > 140; })()`, 20000));
check('phone width: "Aa" opens a Display menu with Night mode and Bigger text, both inside the screen', await waitFor(`(() => { document.getElementById('easyBtn').click(); const m = document.getElementById('dispMenu'), r = m.getBoundingClientRect(); return !m.hidden && r.left >= 0 && r.right <= window.innerWidth && m.querySelectorAll('button').length === 2 && document.getElementById('dispTheme').textContent.length > 3; })()`, 10000));
check('phone width: Night mode in the menu switches the theme and shows it as on', await waitFor(`(() => { const was = document.documentElement.dataset.theme; document.getElementById('dispTheme').click(); const now = document.documentElement.dataset.theme; const on = document.getElementById('dispTheme').getAttribute('aria-pressed') === 'true'; document.getElementById('dispTheme').click(); return was !== now && on === (now === 'dark') && document.documentElement.dataset.theme === was; })()`, 10000));
check('phone width: tapping outside closes the Display menu', await waitFor(`(() => { document.querySelector('main, #main').click(); return document.getElementById('dispMenu').hidden; })()`, 10000));
await send('Emulation.clearDeviceMetricsOverride');
check('no errors on the page', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(failed ? `\n${failed} failed` : '\nALL OK');
process.exit(failed ? 1 : 0);
