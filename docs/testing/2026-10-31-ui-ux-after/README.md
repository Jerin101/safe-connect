# UI/UX test report, after the UI clarity pass (31 Oct 2026)

> **সংক্ষেপে (বাংলা):** ৩০ অক্টোবরের টেস্টে ২২টা UI/UX সমস্যা পাওয়া গিয়েছিল ([আগের রিপোর্ট](../2026-10-30-ui-ux/))। ৫টা PR-এ (#109–#112, #114) **২২টাই ঠিক হয়েছে।**
> একই স্ক্রিপ্ট দিয়ে আবার টেস্ট করা হয়েছে: অ্যাক্সেসিবিলিটি সমস্যা **৮ → ০**, ফোনে হোম পেজ **১১.৭ → ৭.২ স্ক্রিন**, কোনো JavaScript এরর নেই, কোনো সার্ভিস বাদ পড়েনি।
> নিচে আগে-পরের ছবি পাশাপাশি দেওয়া আছে। ঠিক হওয়া জায়গা সবুজ দাগে চিহ্নিত।

| | |
|---|---|
| **Site tested** | https://jerin101.github.io/safe-connect/preview.html |
| **Version** | service worker `v23-2026-10-31`, `main` at `85af7cf` (after #114) |
| **Compared with** | [30 Oct report](../2026-10-30-ui-ux/), `v19-2026-10-30` |
| **Same method** | Playwright + Chromium; phone 360 × 740 (touch, 2×) and laptop 1366 × 768; light and dark; বাংলা and English; offline; axe-core 4.10.2 (WCAG 2 A/AA) |
| **Scripts** | [`../2026-10-30-ui-ux/scripts/`](../2026-10-30-ui-ux/scripts/) (audit, flows) and [`scripts/after-evidence.js`](scripts/after-evidence.js) (the screenshots here) |

## Result

| | Before (v19) | After (v23) |
|---|---|---|
| UI/UX issues open | 18 (+4 fixed in #109) | **0** |
| axe accessibility problems (all pages, light) | 8 | **0** |
| Pages without a main heading (h1) | 4 | **0** |
| JavaScript errors | 0 | 0 |
| Sideways scrolling | none | none |
| ৯৯৯ and লোকেশন পাঠান on the first screen of every page | ✅ | ✅ |
| Offline: numbers page with the network off | ✅ | ✅ |
| Services missing after the moves | — | **none** (tester checked every one) |

## Measurements, before → after

"Screens" = page length ÷ screen height. Some pages got longer on purpose: the content that left home now lives there (all national numbers on জরুরি নম্বর, stats on আমাদের সম্পর্কে, the account roles on অ্যাকাউন্ট).

| Page | Phone screens | Laptop screens | "লোকেশন পাঠান" on the phone page | h1 | axe problems | Small tap targets (phone) |
|---|---|---|---|---|---|---|
| home | 11.7 → **7.2** | 6.8 → **4.2** | 9 → 5 | ✅ → ✅ | 1 → **0** | 20 → 2 |
| জরুরি নম্বর | 2.5 → 4.7 | 1.4 → 2.1 | 3 → 2 | ✅ → ✅ | 1 → **0** | 18 → 2 |
| এলাকা খুঁজুন | 3.0 → 2.8 | 1.4 → 1.4 | 2 → 2 | ❌ → ✅ | 1 → **0** | 17 → 1 |
| লোকেশন পাঠান | 3.5 → 3.7 | 2.2 → 2.4 | 3 → 3 | ✅ → ✅ | 1 → **0** | 17 → 1 |
| কী হয়েছে? (guide) | 3.6 → 3.4 | 1.5 → 1.5 | 4 → 4 | ❌ → ✅ | 1 → **0** | 17 → 1 |
| আমাদের সম্পর্কে | 3.1 → 3.7 | 1.7 → 2.4 | 3 → 3 | ❌ → ✅ | 1 → **0** | 17 → 1 |
| প্রশ্ন ও উত্তর | 2.7 → 2.9 | 1.6 → 1.7 | 2 → 2 | ❌ → ✅ | 1 → **0** | 17 → 1 |
| অ্যাকাউন্ট | 1.8 → 3.3 | 1.0 → 1.7 | 3 → 5 | ✅ → ✅ | 1 → **0** | 17 → 1 |

The small tap targets left are the "সরকারি উৎস ↗" links inside text, and the "উৎস" footer link, which is 44px tall but 25px wide. Links inside running text are an accepted exception in WCAG 2.2. Full numbers: [`metrics-v23.json`](metrics-v23.json).

## The 22 points, before and after

| # | Issue | Fixed in | Before | After |
|---|---|---|---|---|
| 1 | One feature had 5–6 names | #109 | — | One name each: আমার কাছের সাহায্য / আমার এলাকা / এলাকা খুঁজুন / লোকেশন পাঠান |
| 2 | ৯৯৯ and লোকেশন পাঠান 3 times on the laptop's first screen | #111 | <img src="../2026-10-30-ui-ux/shots/issue02-laptop-repeats.png" width="300" alt="Before: three copies"> | <img src="shots/laptop-home.png" width="300" alt="After: sidebar keeps only আমার এলাকা and the filter"> |
| 3 + 18 | Phone home 11.7 screens; "লোকেশন পাঠান" 9 times | #110, #111 | <img src="../2026-10-30-ui-ux/shots/issue18-phone-home-full-repeats.png" width="110" alt="Before: whole home page"> | <img src="shots/after18-phone-home-full.png" width="110" alt="After: whole home page"> <br>7.2 screens, 5 times |
| 4 | Welcome card and auto-location question at once | #111 | <img src="../2026-10-30-ui-ux/shots/issue04-two-questions.png" width="180" alt="Before"> | <img src="shots/after04-one-question.png" width="180" alt="After: only the welcome card"> <br>The question comes after the first "আমার কাছের সাহায্য" tap |
| 5 | Hero promised union numbers everywhere | #109 | — | Coverage line: নোয়াখালী ও কক্সবাজার |
| 6 | Numbers in a slider, mixed with actions | #110 | <img src="../2026-10-30-ui-ux/shots/issue06-numbers-carousel.png" width="180" alt="Before"> | <img src="shots/after06-numbers-grid.png" width="180" alt="After: all 19 numbers in a grid"> |
| 7 | Second district filter card on phones | #110 | <img src="../2026-10-30-ui-ux/shots/issue07-filter-card.png" width="180" alt="Before"> | One district menu, inside এলাকা খুঁজুন |
| 8 | Empty picture boxes in "কী হয়েছে?" | #110 | <img src="../2026-10-30-ui-ux/shots/issue08-empty-boxes.png" width="180" alt="Before"> | <img src="shots/phone-guide.png" width="180" alt="After: guide without empty boxes"> |
| 9 | Report text said GitHub is needed | #109 | — | Points to the in-site report under each number |
| 10 | "যাচাই করা হয়েছে" next to a date | #109 | — | "উৎস আবার মিলিয়ে দেখা হয়েছে" |
| 11 | Roles section ("শীঘ্রই") on home | #111 | <img src="../2026-10-30-ui-ux/shots/issue11-roles-on-home.png" width="180" alt="Before"> | <img src="shots/phone-account.png" width="180" alt="After: roles on the account page"> |
| 12 + 17 | Phone tabs: 4 of 7 visible, active tab cut | #112 | <img src="../2026-10-30-ui-ux/shots/issue17-tabs-cut.png" width="220" alt="Before"> | <img src="shots/after16-17-19-header-send.png" width="180" alt="After: active tab in view, arrows show more tabs"> |
| 13 | Developer test link in the footer | #112 | <img src="../2026-10-30-ui-ux/shots/issue13-dev-link.png" width="180" alt="Before"> | <img src="shots/after13-21-footer.png" width="180" alt="After: footer without the developer link"> |
| 14 | Purple box around headings after moving pages | #112 | <img src="../2026-10-30-ui-ux/shots/issue14-heading-focus-box.png" width="180" alt="Before"> | <img src="shots/after14-no-focus-box.png" width="180" alt="After: no box; keyboard users still see focus"> |
| 15 | Laptop area page: right half empty | #114 | <img src="../2026-10-30-ui-ux/shots/issue15-laptop-area-empty.png" width="300" alt="Before"> | <img src="shots/after15-laptop-area.png" width="300" alt="After: home layout with the sidebar"> |
| 16 | Phone header without area or name | #112 | <img src="../2026-10-30-ui-ux/shots/issue16-phone-header.png" width="220" alt="Before"> | Area name in the header (see 12 + 17). On phones ≤ 430px the logo and night/day button step aside; night/day is in the footer |
| 19 | "কী হয়েছে?" used for two things | #114 | <img src="../2026-10-30-ui-ux/shots/issue19-send-ki-hoyeche.png" width="180" alt="Before"> | "পরিস্থিতি / Situation" on the send page (see 12 + 17) |
| 20 | English: "বাং" button, posts in Bangla | #112, #114 | <img src="../2026-10-30-ui-ux/shots/issue20-english-mode.png" width="180" alt="Before"> | <img src="shots/after20-english.png" width="180" alt="After: বাংলা in full, English post names"> <br>54 official posts translated (about 81% of rows) |
| 21 | Tap targets under 44px on phones | #112 | <img src="../2026-10-30-ui-ux/shots/issue21-small-taps.png" width="180" alt="Before"> | 44px (see 13) |
| 22 | 4 pages without h1; faint footer credit | #112 | <img src="../2026-10-30-ui-ux/shots/issue22-credit-contrast.png" width="180" alt="Before"> | One h1 on every page; axe finds 0 problems |

## Still open (small, tracked)

| What | Where | Tracked in |
|---|---|---|
| Header at 800–900px wide with large text | laptop/tablet | #113 |
| District menu is 42px tall on phones (target 44px) | এলাকা খুঁজুন | #113 |
| One police entry in English mode stays in Bangla ("পুলিশ পরিদর্শক(নিঃ), অফিসার ইনচার্জ, হাতিয়া থানা, নোয়াখালী"): this spelling of the post (short form নিঃ, no space before the bracket) is not on the post list. Fix: add it to the list and translate each comma-separated part that is on the list; names stay in Bangla | হাতিয়া area page | add to #113 |
| Phone home is 7.2 screens; the first goal was under 5 | home | for later, if needed |
| On a phone, জরুরি নম্বর no longer shows "আমার কাছের সাহায্য" on the first screen (৯৯৯ and লোকেশন পাঠান still do) | জরুরি নম্বর | for later, if needed |

## All page screenshots (after)

| Page | Phone | Laptop |
|---|---|---|
| Home | <img src="shots/phone-home.png" width="180" alt=""> | <img src="shots/laptop-home.png" width="420" alt=""> |
| জরুরি নম্বর | <img src="shots/phone-numbers.png" width="180" alt=""> | <img src="shots/laptop-numbers.png" width="420" alt=""> |
| এলাকা খুঁজুন | <img src="shots/phone-area.png" width="180" alt=""> | <img src="shots/laptop-area.png" width="420" alt=""> |
| হাতিয়া (area page) | <img src="shots/phone-area-hatiya.png" width="180" alt=""> | <img src="shots/after15-laptop-area.png" width="420" alt=""> |
| লোকেশন পাঠান | <img src="shots/phone-send.png" width="180" alt=""> | <img src="shots/laptop-send.png" width="420" alt=""> |
| কী হয়েছে? | <img src="shots/phone-guide.png" width="180" alt=""> | <img src="shots/laptop-guide.png" width="420" alt=""> |
| আমাদের সম্পর্কে | <img src="shots/phone-about.png" width="180" alt=""> | <img src="shots/laptop-about.png" width="420" alt=""> |
| প্রশ্ন ও উত্তর | <img src="shots/phone-faq.png" width="180" alt=""> | <img src="shots/laptop-faq.png" width="420" alt=""> |
| অ্যাকাউন্ট | <img src="shots/phone-account.png" width="180" alt=""> | <img src="shots/laptop-account.png" width="420" alt=""> |
| Sign-in window | <img src="shots/phone-signin.png" width="180" alt=""> | <img src="shots/laptop-signin.png" width="420" alt=""> |
| English | <img src="shots/after20-english.png" width="180" alt=""> | <img src="shots/laptop-english.png" width="420" alt=""> |
| Dark mode | <img src="shots/phone-dark-home.png" width="180" alt=""> | <img src="shots/laptop-dark-home.png" width="420" alt=""> |
| Offline | <img src="shots/phone-offline-numbers.png" width="180" alt=""> | — |
