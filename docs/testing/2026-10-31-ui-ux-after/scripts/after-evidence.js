// Takes the AFTER screenshots for the UI/UX report: each fixed item outlined in green with a label.
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


const G = '#0a8a3a';
(async () => {
  const b = await chromium.launch();
  let ctx = await b.newContext(PHONE); let p = await ctx.newPage();
  const pages = ['', '#/numbers', '#/area', '#/send', '#/guide', '#/about', '#/faq', '#/account'];
  for (const h of pages) { await go(p, h); await p.screenshot({ path: `${OUT}/phone-${h.replace('#/', '') || 'home'}.png` }); }
  await go(p, '#/area/noakhali/hatiya'); await p.screenshot({ path: `${OUT}/phone-area-hatiya.png` });

  const p1 = await b.newContext({ ...PHONE, deviceScaleFactor: 1 }).then(c => c.newPage());
  await go(p1, ''); await mark(p1, eval(byText('/লোকেশন পাঠান/')), '', G);
  console.log('send repeats', await p1.evaluate(() => (document.body.innerText.match(/লোকেশন পাঠান/g) || []).length));
  await p1.screenshot({ path: `${OUT}/after18-phone-home-full.png`, fullPage: true });

  await go(p, ''); await mark(p, eval(byText('/স্বাগতম! প্রথমবার/')), 'শুধু একটা প্রশ্ন', G);
  await p.evaluate(() => window.scrollTo(0, 500)); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/after04-one-question.png` });

  await go(p, '');
  await p.evaluate(() => { const e = [...document.querySelectorAll('h2,h3')].find(e => /জরুরি নম্বর|জাতীয়/.test(e.textContent)); if (e) e.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(300);
  await mark(p, eval(byText('/^(জরুরি নম্বর|জাতীয় জরুরি নম্বর)$/')), 'সব নম্বর খোলা গ্রিডে', G);
  await p.screenshot({ path: `${OUT}/after06-numbers-grid.png` });

  await go(p, ''); await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400);
  await mark(p, () => [document.querySelector('footer')], 'ডেভেলপার লিংক নেই, বাটন ৪৪px', G);
  await p.screenshot({ path: `${OUT}/after13-21-footer.png` });

  await go(p, ''); await p.locator('nav button:visible, nav a:visible').filter({ hasText: 'এলাকা খুঁজুন' }).first().click(); await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/after14-no-focus-box.png` });

  await go(p, '#/send');
  await mark(p, () => [document.querySelector('header')], 'এলাকার নাম + চালু ট্যাব দেখা যায়', G);
  await mark(p, eval(byText('/^পরিস্থিতি$/')), 'পরিস্থিতি', G);
  await p.screenshot({ path: `${OUT}/after16-17-19-header-send.png` });

  await go(p, '#/area/noakhali/hatiya'); await p.locator('#langBtn').click(); await p.waitForTimeout(700);
  await mark(p, () => [document.getElementById('langBtn')], '"বাংলা" পুরো', G);
  await p.evaluate(() => { const e = [...document.querySelectorAll('p,span,div')].find(e => /Officer in Charge|Inspector/.test(e.textContent) && !e.children.length); if (e) e.scrollIntoView({ block: 'center' }); });
  await mark(p, eval(byText('/Officer in Charge|Inspector/')), 'English post name', G);
  await p.screenshot({ path: `${OUT}/after20-english.png` });
  await p.locator('#langBtn').click(); await p.waitForTimeout(300);

  await go(p, ''); await p.getByRole('button', { name: /সাইন ইন/ }).first().click(); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/phone-signin.png` });
  await ctx.close();

  ctx = await b.newContext({ ...PHONE, colorScheme: 'dark' }); p = await ctx.newPage();
  await go(p, ''); await p.screenshot({ path: `${OUT}/phone-dark-home.png` });
  await p.waitForTimeout(2000); await ctx.setOffline(true);
  await p.goto(BASE + '#/numbers', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/phone-offline-numbers.png` });
  await ctx.close();

  ctx = await b.newContext(LAPTOP); p = await ctx.newPage();
  for (const h of pages) { await go(p, h); await p.screenshot({ path: `${OUT}/laptop-${h.replace('#/', '') || 'home'}.png` }); }
  await go(p, '#/area/noakhali/hatiya'); await p.screenshot({ path: `${OUT}/after15-laptop-area.png` });
  await go(p, ''); await p.getByRole('button', { name: /সাইন ইন/ }).first().click(); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/laptop-signin.png` });
  await go(p, ''); await p.locator('#langBtn').click(); await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/laptop-english.png` });
  await ctx.close();
  ctx = await b.newContext({ ...LAPTOP, colorScheme: 'dark' }); p = await ctx.newPage();
  await go(p, ''); await p.screenshot({ path: `${OUT}/laptop-dark-home.png` });
  await b.close(); console.log('done');
})();
