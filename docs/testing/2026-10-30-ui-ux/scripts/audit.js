// UI/UX audit: every page at 360px (phone) and 1366px (laptop), light and dark.
// Measures page length, sideways scroll, what is visible on the first screen, repeated labels,
// small tap targets, tiny text, missing h1, and axe-core WCAG 2 A/AA problems.
// Run from an empty folder: node audit.js  -> report.json + first-screen screenshots.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'https://jerin101.github.io/safe-connect/preview.html';
const AXE = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const VPS = { phone: { width: 360, height: 740, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
              laptop: { width: 1366, height: 768 } };
const ROUTES = ['', '#/numbers', '#/area', '#/send', '#/guide', '#/about', '#/faq', '#/account'];
function checks() {
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]'); };
  const out = { docH: document.documentElement.scrollHeight, screens: +(document.documentElement.scrollHeight / vh).toFixed(1),
    hScroll: document.documentElement.scrollWidth > vw, wide: [], smallTap: [], tinyText: [], h1: 0, fold: {} };
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.right > vw + 1 && !e.closest('[class*=scroll],[class*=rail],[class*=carousel],[class*=row],nav,.tabs')) out.wide.push((e.id || e.className || e.tagName).toString().slice(0, 40));
  }
  for (const e of document.querySelectorAll('a,button,input,select,[role=button],summary,label.switch,[role=switch]')) {
    if (!vis(e)) continue; const r = e.getBoundingClientRect();
    if (r.height < 32 || r.width < 32) out.smallTap.push(`${(e.innerText || e.getAttribute('aria-label') || e.id || e.tagName).trim().replace(/\s+/g,' ').slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (w.nextNode()) { const n = w.currentNode; const p = n.parentElement; if (!p || !n.textContent.trim() || !vis(p) || seen.has(p)) continue; seen.add(p);
    const fs = parseFloat(getComputedStyle(p).fontSize); if (fs < 12) out.tinyText.push(`${fs}px: ${n.textContent.trim().slice(0, 30)}`); }
  out.h1 = [...document.querySelectorAll('h1')].filter(vis).map(e => e.innerText.slice(0, 30));
  const inFold = (re) => [...document.querySelectorAll('a,button')].some(e => vis(e) && re.test(e.innerText) && e.getBoundingClientRect().top < vh && e.getBoundingClientRect().bottom > 0);
  out.fold = { call999: inFold(/৯৯৯|999/), send: inFold(/লোকেশন পাঠান|Send location/i), near: inFold(/কাছের সাহায্য|help near/i) };
  const txt = document.body.innerText;
  out.repeats = { 'লোকেশন পাঠান': (txt.match(/লোকেশন পাঠান/g) || []).length, 'কাছের সাহায্য': (txt.match(/কাছের সাহায্য/g) || []).length, '৯৯৯': (txt.match(/৯৯৯/g) || []).length };
  out.smallTap = [...new Set(out.smallTap)].slice(0, 25); out.tinyText = out.tinyText.slice(0, 15); out.wide = [...new Set(out.wide)].slice(0, 10);
  return out;
}
(async () => {
  const b = await chromium.launch(); const report = {};
  for (const [dev, vp] of Object.entries(VPS)) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, colorScheme: scheme, locale: 'bn-BD' });
      const p = await ctx.newPage(); const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 120))); p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 120)));
      for (const r of ROUTES) {
        const key = `${dev}/${scheme}/${r || '#/'}`;
        await p.goto('about:blank'); await p.goto(BASE + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(700);
        const c = await p.evaluate(checks);
        await p.addScriptTag({ url: AXE });
        c.axe = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0,3).map(n => n.target.join(' ')).join(' | ')}`));
        c.errors = [...errs]; errs.length = 0;
        report[key] = c;
        if (scheme === 'light' || r === '') await p.screenshot({ path: `${dev}_${scheme}_${(r.replace('#/', '') || 'home')}_fold.png` });
      }
      await ctx.close();
    }
  }
  fs.writeFileSync('report.json', JSON.stringify(report, null, 1)); await b.close();
})();
