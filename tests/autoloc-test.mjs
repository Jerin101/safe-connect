// Auto location test (issue #105): drives the Chrome already on this computer over the DevTools protocol,
// with a fake position and fake location permission. No packages to install (CLAUDE.md rule 3).
//
// Run: python -m http.server 8000   (in the project folder, in another terminal)
//      node tests/autoloc-test.mjs
// Options: BASE=http://127.0.0.1:8000/  CHROME="C:\path\to\chrome.exe"  SHOTS=<folder for screenshots>
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8000/';
const PAGE = `${BASE}preview.html`;
const ORIGIN = new URL(BASE).origin;
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
const PORT = 9400 + Math.floor(Math.random() * 400);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pageErrors = [];             // uncaught errors on the page; any one fails the test

/* ---------- Chrome ---------- */
const profile = mkdtempSync(join(tmpdir(), 'sc-autoloc-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let version = null;
for (let i = 0; i < 50 && !version; i++) { await wait(200); version = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null); }
if (!version) throw new Error('Chrome did not start');
const browser = await connect(version.webSocketDebuggerUrl);
const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
const page = await connect((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.id === targetId).webSocketDebuggerUrl);

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
    const i = ++id;
    const timer = setTimeout(() => { pending.delete(i); rej(new Error(`${method}: no answer after 15 s`)); }, 15000);
    pending.set(i, (d) => { clearTimeout(timer); if (d.error) rej(new Error(`${method}: ${d.error.message}`)); else res(d.result); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { send, close: () => ws.close() };
}
const ev = async (expr) => {
  const r = await page.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

// Before any page script: count every geolocation call, and let the test hide or show the page.
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__geo = { get: 0, watch: 0, clear: 0, active: 0 };
  const g = navigator.geolocation, get = g.getCurrentPosition.bind(g), watch = g.watchPosition.bind(g), clear = g.clearWatch.bind(g);
  g.getCurrentPosition = (...a) => { __geo.get++; return get(...a); };
  g.watchPosition = (...a) => { __geo.watch++; __geo.active++; return watch(...a); };
  g.clearWatch = (id) => { __geo.clear++; __geo.active--; return clear(id); };
  let vis = 'visible';
  Object.defineProperty(Document.prototype, 'visibilityState', { get: () => vis, configurable: true });
  Object.defineProperty(Document.prototype, 'hidden', { get: () => vis === 'hidden', configurable: true });
  window.__setVis = (v) => { vis = v; document.dispatchEvent(new Event('visibilitychange')); };
` });
await page.send('Page.enable');
await page.send('Network.enable');
await page.send('Runtime.enable');

const permission = (setting) => browser.send('Browser.setPermission', { origin: ORIGIN, permission: { name: 'geolocation' }, setting });
const moveTo = (p, accuracy = 20) => page.send('Emulation.setGeolocationOverride', { latitude: p.lat, longitude: p.lon, accuracy });
async function open({ w = 1280, h = 800, lang = 'bn', theme = 'light', store = {}, hash = '' } = {}) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 800 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  await page.send('Page.navigate', { url: PAGE });
  await wait(800);
  const items = { 'sc-lang': lang, 'sc-welcomed': '1', ...store };
  await ev(`localStorage.clear(); ${Object.entries(items).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join(' ')} true`);
  await ev('window.__old = true');                           // so the checks below never read the page being left
  await page.send('Page.navigate', { url: PAGE + hash });
  await waitFor('!window.__old && document.getElementById("homeAutoSw")');
}
async function waitFor(expr, ms = 8000) {
  for (let t = 0; t < ms; t += 100) { if (await ev(`!!(${expr})`)) return true; await wait(100); }
  return false;
}
const last = () => ev(`JSON.parse(localStorage.getItem('sc-last') || 'null')`);

/* ---------- checks ---------- */
let failed = 0;
const results = [];
function check(name, ok, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`;
  results.push(line); console.log(line);
  if (!ok) failed++;
}

// Two union centres in the same upazila that the on-phone lookup puts in different unions, 1-8 km apart.
await permission('granted');
await open();
const [A, B] = await ev(`(async () => {
  const L = await import('./js/location.js');
  const locs = await L.loadLocations('data/');
  const us = locs.unions.filter((u) => u.upazila_en === 'Begumganj');
  for (const a of us) for (const b of us) {
    const d = L.distanceKm(a, b);
    if (d < 1 || d > 8) continue;
    const pa = L.nearestPlace(locs, a), pb = L.nearestPlace(locs, b);
    if (pa?.area?.type === 'union' && pb?.area?.type === 'union' && pa.area.bn !== pb.area.bn) return [{ lat: a.lat, lon: a.lon, bn: pa.area.bn }, { lat: b.lat, lon: b.lon, bn: pb.area.bn }];
  }
})()`);
check('found two neighbouring unions to walk between', !!(A && B), A && B ? `${A.bn} -> ${B.bn}` : 'none');

// 1. OFF (default): no geolocation call at all, the one-time question is shown, the switch is off.
await moveTo(A);
await open();
await wait(2500);
let geo = await ev('__geo');
check('OFF: no geolocation call on open', geo.get === 0 && geo.watch === 0, JSON.stringify(geo));
check('OFF: one-time question on home', await ev(`!!document.getElementById('askAutoYes')`));
check('OFF: switch shows off', await ev(`document.getElementById('homeAutoSw').checked === false`));

// 2. Turning on: explanation first, the browser is asked only after "Turn on location".
await ev(`document.getElementById('askAutoNo').click(); true`);
check('"Not now" hides the question for good', await ev(`!document.getElementById('askAutoYes') && localStorage.getItem('sc-autoloc-asked') === '1'`));
await ev(`document.getElementById('homeAutoSw').click(); true`);
geo = await ev('__geo');
check('switch: explanation shown before the browser is asked', await ev(`!!document.querySelector('#myArea .auto-ask') && document.activeElement.id === 'homeAutoYes'`) && geo.get === 0, JSON.stringify(geo));
await ev(`document.getElementById('homeAutoYes').click(); true`);
check('ON + granted: area set from the position', await waitFor(`(JSON.parse(localStorage.getItem('sc-last') || 'null') || {}).area?.bn === ${JSON.stringify(A.bn)}`));
check('ON: switch shows on', await ev(`document.getElementById('homeAutoSw').checked && localStorage.getItem('sc-autoloc') === '1'`));

// 3. Every page open: area found again, header chip, sidebar card and home list updated, still on home.
await open({ store: { 'sc-autoloc': '1', 'sc-autoloc-asked': '1' } });
check('ON + granted: area set on page open', await waitFor(`(JSON.parse(localStorage.getItem('sc-last') || 'null') || {}).area?.bn === ${JSON.stringify(A.bn)}`));
const shown = await ev(`[document.getElementById('areaChipT').textContent, document.getElementById('hcAreaS').textContent, document.getElementById('myAreaTitle').textContent, document.querySelectorAll('#myArea .first-row').length, location.hash]`);
check('chip, sidebar card and home list show the area', shown[0] && shown[0] === shown[1] && shown[2].includes(shown[0]) && shown[3] >= 2 && shown[4] === '', JSON.stringify(shown));
check('first-call list starts with 999', await ev(`document.querySelector('#myArea .first-row a[href^="tel:"]')?.getAttribute('href') === 'tel:999'`));
geo = await ev('__geo');
check('page open: one position read + one watch', geo.get >= 1 && geo.active === 1, JSON.stringify(geo));

// 4. Walking across the union line updates the area with a toast, and never leaves the page the person is on.
await ev(`location.hash = '#/guide'; true`); await wait(500);
await ev(`document.getElementById('toast').hidden = true; true`);
await moveTo(B);
const moved = await waitFor(`(JSON.parse(localStorage.getItem('sc-last') || 'null') || {}).area?.bn === ${JSON.stringify(B.bn)}`);
check('moving across the union line updates the area', moved);
const toast = await ev(`[document.getElementById('toast').hidden, document.getElementById('toast').textContent]`);
check('toast "your area changed" with the new name', !toast[0] && toast[1].includes(await ev(`document.getElementById('areaChipT').textContent`)), toast[1]);
check('stays on the page the person is on', await ev(`location.hash === '#/guide'`));

// 5. Small moves (< 300 m) within 2 minutes do nothing.
await ev(`document.getElementById('toast').hidden = true; localStorage.setItem('sc-last', JSON.stringify({ district: 'noakhali', upazila: 'Sadar', area: null })); true`);
await moveTo({ lat: B.lat + 0.001, lon: B.lon });            // about 110 m north
await wait(2000);
check('a move under 300 m is ignored', (await last()).upazila === 'Sadar' && await ev(`document.getElementById('toast').hidden`));

// 5b. A rough position (5 km) never changes the area.
await ev(`localStorage.setItem('sc-last', JSON.stringify({ district: 'noakhali', upazila: 'Sadar', area: null })); true`);
await moveTo(A, 5000);
await wait(2500);
check('a rough position (5 km) does not change the area', (await last()).upazila === 'Sadar' && await ev(`document.getElementById('toast').hidden`));

// 5c. Looking at another area by hand does not replace the area auto location found, and a reload shows no note.
await moveTo(A);
await open({ store: { 'sc-autoloc': '1', 'sc-autoloc-asked': '1' } });
await waitFor(`(JSON.parse(localStorage.getItem('sc-last') || 'null') || {}).area?.bn === ${JSON.stringify(A.bn)}`);
await ev(`location.hash = '#/area/coxsbazar/ukhia'; true`);
await waitFor(`location.hash === '#/area/coxsbazar/ukhia' && !document.getElementById('area').hidden`);
await wait(500);
check('opening another area by hand keeps the auto area', (await last()).area?.bn === A.bn);
await ev('window.__old = true');
await page.send('Page.reload');
await waitFor(`!window.__old && !document.getElementById('area').hidden`);
await wait(2500);
check('reloading that area link: same auto area, no "changed" note', (await last()).area?.bn === A.bn && await ev(`document.getElementById('toast').hidden && location.hash === '#/area/coxsbazar/ukhia'`));

// 5d. Screen readers hear the explanation with "Yes".
await open({ store: { 'sc-autoloc-asked': '1' } });
await ev(`document.getElementById('homeAutoSw').click(); true`);
check('"Yes" is described by the explanation', await ev(`(() => { const y = document.getElementById('homeAutoYes'); const d = document.getElementById(y.getAttribute('aria-describedby')); return !!d && d.textContent.length > 40; })()`));
await open();
check('one-time "Yes" is described by the explanation', await ev(`document.getElementById(document.getElementById('askAutoYes').getAttribute('aria-describedby'))?.textContent.length > 40`));
await open({ store: { 'sc-autoloc': '1', 'sc-autoloc-asked': '1' } });
await waitFor('__geo.active === 1');

// 6. Hidden page: the watch stops; visible again: it starts again.
await ev(`__setVis('hidden'); true`);
geo = await ev('__geo');
check('hidden tab: watch stopped', geo.active === 0 && geo.clear >= 1, JSON.stringify(geo));
await ev(`__setVis('visible'); true`);
check('visible again: watch running', await waitFor('__geo.active === 1'));

// 7. Nothing but the area is saved: no coordinates anywhere on the phone.
const saved = await ev(`JSON.stringify(Object.fromEntries(Object.entries(localStorage)))`);
const coords = [A, B].flatMap((p) => [p.lat, p.lon]).map((x) => String(x).slice(0, 6));
check('no coordinates in localStorage', !coords.some((c) => saved.includes(c)), saved.slice(0, 160));

// 8. Denied: a calm message, the switch shows off, and choosing the area by hand still works.
await permission('denied');
await open({ store: { 'sc-autoloc-asked': '1' } });
await ev(`document.getElementById('homeAutoSw').click(); true`);
await ev(`document.getElementById('homeAutoYes').click(); true`);
check('denied: calm message shown', await waitFor(`document.querySelector('#myArea [role=status]')?.textContent.length > 10`));
check('denied: switch shows off and setting is off', await ev(`!document.getElementById('homeAutoSw').checked && localStorage.getItem('sc-autoloc') === '0'`));
await ev(`[...document.querySelectorAll('#myArea .auto-box .btn')].pop().click(); true`);
check('denied: "Choose your area" opens the area finder', await waitFor(`location.hash === '#/area' && document.activeElement.id === 'areaInput'`));
// Setting left on but permission taken away later: no prompt, setting turned off, message shown.
await open({ store: { 'sc-autoloc': '1', 'sc-autoloc-asked': '1' } });
geo = await ev('__geo');
check('on but blocked later: no location call, switch off', await waitFor(`localStorage.getItem('sc-autoloc') === '0' && !document.getElementById('homeAutoSw').checked`) && geo.watch === 0, JSON.stringify(geo));

// 9. Reduced motion: the toast does not slide in.
await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
check('reduced motion: toast without animation', await ev(`getComputedStyle(document.getElementById('toast')).animationName === 'none'`));
await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
check('normal motion: toast fades in', await ev(`getComputedStyle(document.getElementById('toast')).animationName === 'toast-in'`));

// 10. Offline (service worker copy): GPS + the on-phone lookup still find the area.
await permission('granted');
await moveTo(A);
await open();
await ev(`navigator.serviceWorker.ready.then(() => true)`);
await wait(1500);
await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await ev(`localStorage.setItem('sc-autoloc', '1'); localStorage.setItem('sc-autoloc-asked', '1'); localStorage.removeItem('sc-last'); true`);
await page.send('Page.reload');
check('offline: area found on open', await waitFor(`(JSON.parse(localStorage.getItem('sc-last') || 'null') || {}).area?.bn === ${JSON.stringify(A.bn)}`, 10000));
await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

// 11. 360 px, bn/en, night/day: no sideways scroll, 999 still the first big action on screen.
for (const [lang, theme] of [['bn', 'light'], ['en', 'dark'], ['bn', 'dark'], ['en', 'light']]) {
  await open({ w: 360, h: 740, lang, theme, store: { 'sc-autoloc': '1', 'sc-autoloc-asked': '1' } });
  await waitFor(`document.querySelectorAll('#myArea .first-row').length >= 2`);
  const r = await ev(`[document.documentElement.scrollWidth <= innerWidth, document.getElementById('call999').getBoundingClientRect().bottom <= innerHeight]`);
  check(`360 px ${lang} ${theme}: no sideways scroll, 999 on the first screen`, r[0] && r[1], JSON.stringify(r));
  if (process.env.SHOTS) {
    await ev(`document.getElementById('myArea').scrollIntoView(); true`); await wait(300);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(process.env.SHOTS, `autoloc-360-${lang}-${theme}.png`), Buffer.from(data, 'base64'));
  }
}

check('no errors on the page', !pageErrors.length, pageErrors.slice(0, 3).join(' | '));
console.log(failed ?`\n${failed} failed` : '\nALL OK');
page.close(); browser.close();
chrome.kill();
await wait(500);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file; the system cleans its temp folder */ }
process.exit(failed ? 1 : 0);
