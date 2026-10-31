// User flows: search "hatiya" -> area page, sign-in window + Esc, English, keyboard focus, offline.
// Run from an empty folder: node flow.js
const { chromium } = require('playwright');
const BASE = 'https://jerin101.github.io/safe-connect/preview.html';
(async () => {
  const b = await chromium.launch(); const log = [];
  for (const [dev, vp] of [['phone', { width: 360, height: 740 }], ['laptop', { width: 1366, height: 768 }]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: dev === 'phone', hasTouch: dev === 'phone' });
    const p = await ctx.newPage();
    await p.goto(BASE + '#/area', { waitUntil: 'networkidle' });
    const inp = p.locator('input[type=search]:visible, input:visible').first();
    await inp.fill('hatiya'); await p.waitForTimeout(800);
    await p.screenshot({ path: `${dev}_search.png` });
    const res = p.locator('#home button:visible, #home a:visible').filter({ hasText: /হাতিয়া|Hatiya/ });
    log.push(`${dev} search results matching: ${await res.count()}`);
    await res.first().click(); await p.waitForTimeout(1000);
    log.push(`${dev} area url: ${p.url().split('#')[1]}  height screens: ${(await p.evaluate(() => document.documentElement.scrollHeight / innerHeight)).toFixed(1)}`);
    await p.screenshot({ path: `${dev}_areapage.png` });
    await p.screenshot({ path: `${dev}_areapage_full.png`, fullPage: true });
    // sign in modal
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /সাইন ইন/ }).first().click(); await p.waitForTimeout(800);
    await p.screenshot({ path: `${dev}_signin.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    log.push(`${dev} modal closes on Esc: ${!(await p.locator('dialog[open]').count())}`);
    // English
    await p.locator('#langBtn').click(); await p.waitForTimeout(600);
    await p.screenshot({ path: `${dev}_en.png` });
    const bn = await p.evaluate(() => (document.querySelector('main').innerText.match(/[ঀ-৿]+/g) || []).slice(0, 15).join(' '));
    log.push(`${dev} Bangla left in English mode: ${bn}`);
    // keyboard focus visible
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    log.push(`${dev} focus outline on 2nd tab stop: ` + await p.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return `${e.tagName} "${(e.innerText||'').slice(0,15)}" outline=${s.outlineStyle} ${s.outlineWidth} shadow=${s.boxShadow !== 'none'}`; }));
    await ctx.close();
  }
  // offline: second load with network off
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 } }); const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await ctx.setOffline(true);
  try { await p.goto(BASE + '#/numbers', { waitUntil: 'load', timeout: 15000 }); await p.waitForTimeout(800);
    log.push('offline numbers page: ' + ((await p.evaluate(() => document.body.innerText)).includes('১০২') ? 'OK (102 shown)' : 'MISSING')); await p.screenshot({ path: 'phone_offline.png' }); }
  catch (e) { log.push('offline FAILED ' + e.message.slice(0, 80)); }
  await b.close(); console.log(log.join('\n'));
})();
