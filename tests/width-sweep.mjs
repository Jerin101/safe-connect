// Width sweep (queue v3): every page at every width from 320 to 1024 px (10 px steps) plus real phone widths,
// in Bangla and English, light and dark, signed out and in, at 100 % and 130 % text. Drives the Chrome already on
// this computer over the DevTools protocol; no packages (CLAUDE.md rule 3).
//
// Run: python -m http.server 8000   (in the project folder, in another terminal)
//      node tests/width-sweep.mjs
// Options: BASE=http://127.0.0.1:8000/  PAGES="#/,#/area/noakhali/hatiya"  WIDTHS=360,412  CHROME=...
//
// Signed in = the "sc-signed-in" flag: on page load the header shows exactly that (Firebase loads only after a tap).
// 130 % text = the root font size set to 130 %, like Android's font size setting scales the text of a web page.
// Checks per case: sideways scroll; overlapping header controls; clipped text (a label cut short, also with "…");
// empty buttons (no visible text or icon); header targets under 44 px; the search box too narrow for its hint.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statfsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8000/';
const PAGES = (process.env.PAGES || '#/,#/area/noakhali/hatiya,#/area,#/send,#/numbers,#/help/22.29580,91.10660,1793624400,followed').split(/,(?=#)/);
const GRID = Array.from({ length: 71 }, (_, i) => 320 + i * 10).concat(1024);
const PHONES = [360, 375, 390, 393, 412, 430, 440, 480, 768, 820, 1024, 1366];
const WIDTHS = process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : [...new Set([...GRID, ...PHONES])].sort((a, b) => a - b);
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const PORT = 9800 + Math.floor(Math.random() * 100);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { bavail, bsize } = statfsSync(tmpdir());
if (bavail * bsize < 5e9) { console.error(`Only ${(bavail * bsize / 1e9).toFixed(1)} GB free in ${tmpdir()}; free some space first.`); process.exit(2); }
const profile = mkdtempSync(join(tmpdir(), 'sc-sweep-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => {
  try { chrome.kill(); } catch {}
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch { console.error(`Could not remove ${profile}; delete it by hand.`); }
});

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waiting = new Map(); const listeners = [];
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (waiting.has(d.id)) { waiting.get(d.id)(d.result || {}); waiting.delete(d.id); } else listeners.forEach((f) => f(d)); });
  return { on: (f) => listeners.push(f), close: () => ws.close(),
    send: (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }) };
}
let version = null;
for (let i = 0; i < 50 && !version; i++) { await wait(200); version = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json()).catch(() => null); }
if (!version) throw new Error('Chrome did not start');
const browser = await connect(version.webSocketDebuggerUrl);
const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
const page = await connect((await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.id === targetId).webSocketDebuggerUrl);
const pageErrors = [];
page.on((d) => { if (d.method === 'Runtime.exceptionThrown') pageErrors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0] || d.params.exceptionDetails.text); });
await page.send('Runtime.enable');
await page.send('Network.setBypassServiceWorker', { bypass: true });
const ev = async (expression) => (await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
const size = (w) => page.send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: w < 800 });
const frame = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');

// Measured inside the page. Returns a list of problems (strings) for this one case.
const MEASURE = `(() => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; };
  const box = (e) => e.getBoundingClientRect();
  const name = (e) => e.id || (e.tagName.toLowerCase() + (e.classList[0] ? '.' + e.classList[0] : ''));
  const out = [];
  const side = document.documentElement.scrollWidth - innerWidth;
  if (side > 0) {
    const wide = [...document.querySelectorAll('body *')].filter((e) => vis(e) && box(e).right > innerWidth + 1 && !e.closest('#nav, .tabs')
      && ![...e.querySelectorAll('*')].some((c) => box(c).right > innerWidth + 1)).slice(0, 3).map(name);
    out.push('sideways ' + side + 'px (' + wide.join(' ') + ')');
  }
  const head = [...document.querySelectorAll('header.site .bar1 > *, header.site .top-actions > *, header.site .bar2 > *')].filter(vis);
  for (let i = 0; i < head.length; i++) for (let j = i + 1; j < head.length; j++) {
    if (head[i].contains(head[j]) || head[j].contains(head[i])) continue;
    const a = box(head[i]), b = box(head[j]);
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push('overlap ' + name(head[i]) + ' x ' + name(head[j]));
  }
  const ctrls = [...document.querySelectorAll('header.site a, header.site button, header.site select, #distSel, #areaInput')].filter(vis);
  for (const e of ctrls) { const b = box(e); if (b.height < 43.5 || b.width < 43.5) out.push('small ' + name(e) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); }
  const scope = document.querySelectorAll('header.site *, main button, main a, main label, main h1, main h2, main h3, main .chip, main .btn, main select');
  for (const e of scope) {
    if (!vis(e) || !e.textContent.trim() || e.closest('#nav, .tabs')) continue;
    const s = getComputedStyle(e);
    if (box(e).width <= 1 || s.clipPath.startsWith('inset')) continue;   // hidden on purpose (text for screen readers only)
    if (s.overflowX === 'visible' && s.overflow === 'visible' && s.textOverflow !== 'ellipsis') continue;
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) out.push('clipped ' + name(e) + ' "' + e.textContent.trim().slice(0, 24) + '"');
  }
  for (const e of document.querySelectorAll('header.site button, header.site a, main button, main a.btn, main a.send, main a.call')) {
    if (!vis(e) || box(e).width < 2) continue;
    const text = [...e.querySelectorAll('*'), e].some((c) => vis(c) && box(c).width >= 4 && !getComputedStyle(c).clipPath.startsWith('inset') && [...c.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const icon = [...e.querySelectorAll('svg, img, .av')].some((c) => vis(c) && box(c).width > 4);
    if (!text && !icon) out.push('empty ' + name(e));
  }
  const inp = document.getElementById('areaInput');
  if (vis(inp) && inp.placeholder) {
    const s = getComputedStyle(inp), c = document.createElement('canvas').getContext('2d');
    c.font = s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily;
    const room = inp.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    if (c.measureText(inp.placeholder).width > room + 1) out.push('search hint cut (' + Math.round(room) + 'px for ' + Math.round(c.measureText(inp.placeholder).width) + ')');
  }
  return [...new Set(out)];
})()`;

const problems = new Map();   // "page | problem" -> [case labels]
let cases = 0;
for (const pg of PAGES) for (const lang of ['bn', 'en']) for (const signed of [false, true]) {
  await size(400);
  await page.send('Page.navigate', { url: BASE }); await wait(400);
  await ev(`localStorage.clear(); localStorage.setItem('sc-lang','${lang}'); localStorage.setItem('sc-welcomed','1');
    localStorage.setItem('sc-last', JSON.stringify({ district: 'noakhali', upazila: 'Begumganj', area: null }));
    ${signed ? "localStorage.setItem('sc-signed-in','1');" : ''} true`);
  await page.send('Page.navigate', { url: BASE + pg }); await wait(300);
  // Wait until the page has drawn itself (page set, header texts filled), at most 15 s.
  for (let i = 0; i < 60; i++) {
    if (await ev(`Boolean(document.getElementById('main')?.dataset.page && document.getElementById('acctBtn')?.textContent.trim() && document.getElementById('areaChipT')?.textContent.trim())`)) break;
    await wait(250);
  }
  await wait(500);
  for (const w of WIDTHS) for (const theme of ['light', 'dark']) for (const text of [100, 130]) {
    await size(w);
    await ev(`document.documentElement.dataset.theme='${theme}'; document.documentElement.style.fontSize='${text === 100 ? '' : text + '%'}'; true`);
    await frame();
    const found = (await ev(MEASURE)) || ['measure failed'];
    cases++;
    for (const p of found) {
      const key = `${pg} | ${p.replace(/\d+px \(/, 'Npx (').replace(/\(\d+px for \d+\)/, '(too narrow)').replace(/ \d+x\d+$/, '')}`;
      if (!problems.has(key)) problems.set(key, []);
      problems.get(key).push(`${lang} ${signed ? 'in' : 'out'} ${theme} ${text}% ${w}`);
    }
  }
}
// Report: each problem once, with how many cases and the width range.
for (const [key, where] of problems) {
  const ws = where.map((x) => Number(x.split(' ').pop()));
  const kinds = [...new Set(where.map((x) => x.split(' ').slice(0, 4).join(' ')))];
  console.log(`FAIL ${key}: ${where.length} cases, ${Math.min(...ws)}-${Math.max(...ws)} px; ${kinds.slice(0, 4).join('; ')}${kinds.length > 4 ? '; …' : ''}`);
}
if (pageErrors.length) console.log(`FAIL page errors: ${[...new Set(pageErrors)].slice(0, 3).join(' | ')}`);
console.log(`\n${cases} cases (${PAGES.length} pages x ${WIDTHS.length} widths x bn/en x signed out/in x light/dark x 100/130 % text)`);
console.log(problems.size || pageErrors.length ? `${problems.size + (pageErrors.length ? 1 : 0)} kinds of problem` : 'ALL OK');
page.close(); browser.close();
process.exit(problems.size || pageErrors.length ? 1 : 0);
