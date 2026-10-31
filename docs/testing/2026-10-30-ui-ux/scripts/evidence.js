// Takes the evidence screenshots for the UI/UX report: each problem outlined in red with a label.
const { chromium } = require('playwright');
const BASE = 'https://jerin101.github.io/safe-connect/preview.html';
const OUT = process.argv[2] || 'shots';
require('fs').mkdirSync(OUT, { recursive: true });
const PHONE = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'bn-BD' };
const LAPTOP = { viewport: { width: 1366, height: 768 }, locale: 'bn-BD' };

// Outline every visible element matched by fn (runs in the page) and add a small label.
async function mark(p, fn, label, color = '#e00000') {
  await p.evaluate(([src, label, color]) => {
    const els = (new Function('return (' + src + ')()'))();
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]'); };
    els.filter(vis).forEach((e, i) => {
      const r = e.getBoundingClientRect();
      const box = document.createElement('div');
      Object.assign(box.style, { position: 'absolute', left: (r.left + scrollX - 3) + 'px', top: (r.top + scrollY - 3) + 'px', width: (r.width + 6) + 'px', height: (r.height + 6) + 'px',
        border: '3px solid ' + color, borderRadius: '6px', zIndex: 99999, pointerEvents: 'none', boxSizing: 'border-box' });
      document.body.appendChild(box);
      if (label && i === 0) {
        const t = document.createElement('div'); t.textContent = label;
        Object.assign(t.style, { position: 'absolute', left: Math.max(4, r.left + scrollX) + 'px', top: Math.max(0, r.top + scrollY - 24) + 'px', background: color, color: '#fff',
          font: 'bold 12px system-ui, sans-serif', padding: '2px 6px', borderRadius: '4px', zIndex: 100000, pointerEvents: 'none', whiteSpace: 'nowrap' });
        document.body.appendChild(t);
      }
    });
  }, [fn.toString(), label, color]);
}
const byText = (re) => `() => [...document.querySelectorAll('a,button,h1,h2,h3,p,span,label,div,li,summary')].filter(e => ${re}.test(e.textContent) && ![...e.children].some(c => ${re}.test(c.textContent)))`;
async function go(p, hash) { await p.goto('about:blank'); await p.goto(BASE + hash, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); }
async function shotEl(p, sel, file) { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await el.screenshot({ path: `${OUT}/${file}` }); }

(async () => {
  const b = await chromium.launch();
  // ---------- phone ----------
  let ctx = await b.newContext(PHONE); let p = await ctx.newPage();
  const pages = ['', '#/numbers', '#/area', '#/send', '#/guide', '#/about', '#/faq', '#/account'];
  for (const h of pages) { await go(p, h); await p.screenshot({ path: `${OUT}/phone-${h.replace('#/', '') || 'home'}.png` }); }
  await go(p, '#/area/noakhali/hatiya'); await p.screenshot({ path: `${OUT}/phone-area-hatiya.png` });

  // 18 + 2: every "লোকেশন পাঠান" on the phone home page (full page, 1x for size)
  const p1 = await b.newContext({ ...PHONE, deviceScaleFactor: 1 }).then(c => c.newPage());
  await go(p1, '');
  await mark(p1, eval(byText('/লোকেশন পাঠান/')), '');
  const nSend = await p1.evaluate(() => (document.body.innerText.match(/লোকেশন পাঠান/g) || []).length); console.log('send repeats', nSend);
  await p1.screenshot({ path: `${OUT}/issue18-phone-home-full-repeats.png`, fullPage: true });

  // 4: welcome card + auto-location question + the switch again, all at once
  await go(p, '');
  await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(300);
  await mark(p, eval(byText('/স্বাগতম! প্রথমবার/')), 'প্রশ্ন ১');
  await mark(p, eval(byText('/আপনার এলাকা কি নিজে থেকে আপডেট হবে\\?/')), 'প্রশ্ন ২');
  await mark(p, () => [document.getElementById('homeAutoSw')].filter(Boolean), 'একই সুইচ আবার');
  await p.screenshot({ path: `${OUT}/issue04-two-questions.png` });

  // 5 (fixed in v19): honest coverage line
  await go(p, '');
  await mark(p, eval(byText('/এলাকার নম্বর এখন শুধু/')), 'ঠিক হয়েছে ✓', '#0a8a3a');
  await p.screenshot({ path: `${OUT}/issue05-fixed-coverage.png` });

  // 6: numbers carousel mixes actions; 7: second filter card; 8: empty boxes; 9: GitHub text; 10: verified date; 11: roles
  await go(p, '');
  const sections = [
    ['issue06-numbers-carousel.png', '/^জরুরি নম্বর$/', 'শুধু ৩টা দেখা যায়, কাজ আর নম্বর মেশানো'],
    ['issue07-filter-card.png', '/^ফিল্টার$/', 'দ্বিতীয় জেলা ফিল্টার'],
    ['issue08-empty-boxes.png', '/^রাতে বা পথে বিপদ$/', ''],
    ['issue09-fixed-report-text.png', '/এলাকার পাতায় প্রতিটি নম্বরের নিচে/', 'ঠিক হয়েছে ✓', '#0a8a3a'],
    ['issue10-fixed-source-date.png', '/উৎস আবার মিলিয়ে দেখা হয়েছে/', 'ঠিক হয়েছে ✓', '#0a8a3a'],
    ['issue11-roles-on-home.png', '/তিন ভূমিকা/', 'হোমে দরকার নেই'],
    ['issue13-dev-link.png', '/সার্চ টেস্ট/', 'ডেভেলপার লিংক'],
    ['issue22-credit-contrast.png', '/^©/', 'ফিকে লেখা'],
  ];
  for (const [file, re, label, color] of sections) {
    await go(p, '');
    await p.evaluate((src) => { const re = eval(src); const e = [...document.querySelectorAll('h1,h2,h3,p,span,a,div,small,footer *')].find(e => re.test(e.textContent.trim()) && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0 && ![...e.children].some(c => re.test(c.textContent.trim()))); if (e) e.scrollIntoView({ block: 'center' }); }, re);
    await p.waitForTimeout(300);
    if (file.startsWith('issue08')) await mark(p, () => [...document.querySelectorAll('img,svg')].map(s => s.closest('div')).filter(d => d && d.getBoundingClientRect().height > 100 && d.getBoundingClientRect().height < 200 && !d.innerText.trim()), 'খালি বক্স');
    else await mark(p, eval(byText(re)), label, color);
    await p.screenshot({ path: `${OUT}/${file}` });
  }

  // 14: heading gets a purple box after moving to another page by tab
  await go(p, '');
  await p.locator('nav button:visible, nav a:visible').filter({ hasText: 'এলাকা খুঁজুন' }).first().click(); await p.waitForTimeout(700);
  await mark(p, () => [document.activeElement], 'বাগের মতো দেখায়');
  await p.screenshot({ path: `${OUT}/issue14-heading-focus-box.png` });

  // 17: tabs cut on the send page; 16: no area / name in phone header
  await go(p, '#/send');
  await mark(p, () => [...document.querySelectorAll('nav [aria-current], nav .on, nav .active, nav [aria-selected="true"]')], 'চালু ট্যাব কাটা');
  await p.screenshot({ path: `${OUT}/issue17-tabs-cut.png`, clip: { x: 0, y: 0, width: 360, height: 220 } });
  await go(p, '#/area/noakhali/hatiya');
  await mark(p, () => [document.querySelector('header')], 'এলাকার নাম নেই');
  await p.screenshot({ path: `${OUT}/issue16-phone-header.png`, clip: { x: 0, y: 0, width: 360, height: 400 } });

  // 19: "কী হয়েছে?" on the send page and the guide page
  await go(p, '#/send');
  await mark(p, eval(byText('/^কী হয়েছে\\?$/')), 'এখানে: পরিস্থিতি');
  await p.screenshot({ path: `${OUT}/issue19-send-ki-hoyeche.png` });

  // 21: small tap targets in the phone footer
  await go(p, '');
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400);
  await mark(p, () => [...document.querySelectorAll('footer a, footer button')].filter(e => e.getBoundingClientRect().height < 44), '৪৪px-এর কম');
  await p.screenshot({ path: `${OUT}/issue21-small-taps.png` });

  // sign-in, English, dark, offline
  await go(p, ''); await p.getByRole('button', { name: /সাইন ইন/ }).first().click(); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/phone-signin.png` });
  await go(p, '#/area/noakhali/hatiya'); await p.locator('#langBtn').click(); await p.waitForTimeout(700);
  await mark(p, () => [document.getElementById('langBtn')], '"বাং" কাটা');
  await p.evaluate(() => { const e = [...document.querySelectorAll('p,span,div')].find(e => /পুলিশ পরিদর্শক/.test(e.textContent) && !e.children.length); if (e) e.scrollIntoView({ block: 'center' }); });
  await mark(p, eval(byText('/পুলিশ পরিদর্শক/')), 'English মোডে বাংলা পদবি');
  await p.screenshot({ path: `${OUT}/issue20-english-mode.png` });
  await p.locator('#langBtn').click(); await p.waitForTimeout(300);
  await ctx.close();

  ctx = await b.newContext({ ...PHONE, colorScheme: 'dark' }); p = await ctx.newPage();
  await go(p, ''); await p.screenshot({ path: `${OUT}/phone-dark-home.png` });
  await p.waitForTimeout(2000); await ctx.setOffline(true);
  await p.goto(BASE + '#/numbers', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/phone-offline-numbers.png` });
  await ctx.close();

  // ---------- laptop ----------
  ctx = await b.newContext(LAPTOP); p = await ctx.newPage();
  for (const h of pages) { await go(p, h); await p.screenshot({ path: `${OUT}/laptop-${h.replace('#/', '') || 'home'}.png` }); }
  await go(p, '#/area/noakhali/hatiya');
  await p.evaluate(() => { const m = document.querySelector('main'); const r = [...m.querySelectorAll('section,article,div')].filter(e => e.getBoundingClientRect().height > 300 && e.getBoundingClientRect().width > 400).sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0]?.getBoundingClientRect();
    const right = r ? r.right + 20 : 700; const box = document.createElement('div');
    Object.assign(box.style, { position: 'fixed', left: right + 'px', top: '150px', width: (innerWidth - right - 40) + 'px', height: (innerHeight - 180) + 'px', border: '3px dashed #e00000', borderRadius: '8px', zIndex: 99999, display: 'grid', placeItems: 'center', color: '#e00000', font: 'bold 18px system-ui' });
    box.textContent = 'খালি জায়গা'; document.body.appendChild(box); });
  await p.screenshot({ path: `${OUT}/issue15-laptop-area-empty.png` });
  await go(p, ''); await mark(p, eval(byText('/^(৯৯৯-এ কল করুন|লোকেশন পাঠান|৯৯৯)$/')), 'একই বাটন ৩ বার');
  await p.screenshot({ path: `${OUT}/issue02-laptop-repeats.png` });
  await go(p, ''); await p.getByRole('button', { name: /সাইন ইন/ }).first().click(); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/laptop-signin.png` });
  await go(p, ''); await p.locator('#langBtn').click(); await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/laptop-english.png` });
  await ctx.close();
  ctx = await b.newContext({ ...LAPTOP, colorScheme: 'dark' }); p = await ctx.newPage();
  await go(p, ''); await p.screenshot({ path: `${OUT}/laptop-dark-home.png` });
  await b.close(); console.log('done');
})();
