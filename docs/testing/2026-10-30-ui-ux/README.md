# UI/UX test report: phone and laptop (30 Oct 2026)

> **Update 31 Oct 2026:** all 22 issues below were fixed in #109–#112 and #114. See the [after report](../2026-10-31-ui-ux-after/).

> **সংক্ষেপে (বাংলা):** লাইভ সাইট (v19) ফোন (360px) ও ল্যাপটপ (1366px) সাইজে, লাইট ও ডার্ক মোডে, বাংলা ও English-এ টেস্ট করা হয়েছে।
> মূল কাজগুলো সব চলে: ৯৯৯, লোকেশন পাঠান, এলাকা খোঁজা, সাইন ইন, অফলাইন। কোনো JavaScript এরর নেই, পাশে স্ক্রল হয় না।
> **২২টা UI/UX সমস্যা পাওয়া গেছে। এর মধ্যে ৪টা PR #109-এ (ইস্যু #108) ঠিক হয়েছে, ১৮টা বাকি।** প্রতিটা সমস্যার স্ক্রিনশটে লাল দাগ দিয়ে দেখানো আছে, ঠিক হওয়াগুলো সবুজ দাগে।

| | |
|---|---|
| **Site tested** | https://jerin101.github.io/safe-connect/preview.html |
| **Version** | service worker `v19-2026-10-30`, `main` at `ea57180` (after PRs #107 and #109) |
| **Date** | 30 Oct 2026 |
| **Phone** | 360 × 740, touch, 2× screen (a small Android phone) |
| **Laptop** | 1366 × 768 |
| **Also checked** | light and dark mode, বাংলা and English, keyboard only, offline (network off after the first visit) |
| **Tools** | Playwright + Chromium; axe-core 4.10.2 (WCAG 2 A and AA); our own checks in [`scripts/`](scripts/) |
| **Pages** | home, জরুরি নম্বর, এলাকা খুঁজুন, এলাকার পাতা (হাতিয়া), লোকেশন পাঠান, কী হয়েছে? (guide), আমাদের সম্পর্কে, প্রশ্ন ও উত্তর, অ্যাকাউন্ট, sign-in window |

## Summary

| Result | Count |
|---|---|
| ✅ Checks passed | 9 |
| ✅ Issues fixed during testing (PR #109, issue #108) | 4 |
| ❌ Issues still open | 18: **5 high**, 12 medium, 1 low |

## ✅ What works

| Check | Phone | Laptop |
|---|---|---|
| No sideways scrolling on any page (light and dark) | ✅ | ✅ |
| **৯৯৯** and **লোকেশন পাঠান** visible on the first screen of every page | ✅ | ✅ |
| No JavaScript errors on any page | ✅ | ✅ |
| Search "hatiya" finds হাতিয়া and opens `#/area/noakhali/hatiya` | ✅ | ✅ |
| Sign-in window shows ৯৯৯ / লোকেশন পাঠান / আমার কাছের সাহায্য **above** the form; Esc closes it | ✅ | ✅ |
| Keyboard focus is visible (3px outline) | ✅ | ✅ |
| Dark mode: no colour-contrast problems | ✅ | ✅ |
| Offline: জরুরি নম্বর page opens with the network off, after one visit | ✅ | — |
| English mode translates the menus, buttons and page texts | ✅ | ✅ |

| Phone | Laptop |
|---|---|
| <img src="shots/phone-home.png" width="240" alt="Phone home, first screen"> | <img src="shots/laptop-home.png" width="520" alt="Laptop home, first screen"> |
| <img src="shots/phone-offline-numbers.png" width="240" alt="Phone, numbers page with the network off"> <br>Offline: numbers still shown | <img src="shots/laptop-signin.png" width="520" alt="Laptop sign-in window"> <br>Sign-in: emergency buttons first |

## Measurements (v19)

"Screens" = page length ÷ screen height. "Repeats" = how often the label appears on that page.

| Page | Phone screens | Laptop screens | "লোকেশন পাঠান" repeats (phone / laptop) | Main heading (h1) | axe problems |
|---|---|---|---|---|---|
| home | **11.7** | **6.8** | **9 / 11** | ✅ | 1 (footer contrast) |
| জরুরি নম্বর | 2.5 | 1.4 | 3 / 4 | ✅ | 1 (footer contrast) |
| এলাকা খুঁজুন | 3.0 | 1.4 | 2 / 3 | ❌ | 1 (footer contrast) |
| লোকেশন পাঠান | 3.5 | 2.2 | 3 / 4 | ✅ | 1 (footer contrast) |
| কী হয়েছে? (guide) | 3.6 | 1.5 | 4 / 5 | ❌ | 1 (footer contrast) |
| আমাদের সম্পর্কে | 3.1 | 1.7 | 3 / 4 | ❌ | 1 (footer contrast) |
| প্রশ্ন ও উত্তর | 2.7 | 1.6 | 2 / 3 | ❌ | 1 (footer contrast) |
| অ্যাকাউন্ট | 1.8 | 1.0 | 3 / 4 | ✅ | 1 (footer contrast) |

Full numbers: [`metrics-v19.json`](metrics-v19.json).

## ✅ Fixed during testing (in PR #109, issue #108)

| # | Was | Now | Screenshot |
|---|---|---|---|
| 1 | One feature had 5–6 names (কাছের সাহায্য, আপনার এলাকা বেছে নিন, আপনার এলাকা কোথায়?…) | One name each: **আমার কাছের সাহায্য / আমার এলাকা / এলাকা খুঁজুন / লোকেশন পাঠান** | — |
| 5 | The hero promised "আপনার ইউনিয়নের" numbers everywhere | Says নোয়াখালী ও কক্সবাজার, plus a coverage line | <img src="shots/issue05-fixed-coverage.png" width="200" alt="Coverage line under the hero"> |
| 9 | "ভুল নম্বর জানান (GitHub অ্যাকাউন্ট লাগবে)" | Points to the in-site report under each number | <img src="shots/issue09-fixed-report-text.png" width="200" alt="New report text"> |
| 10 | "যাচাই করা হয়েছে" next to a date (sounds like every number was called) | "উৎস আবার মিলিয়ে দেখা হয়েছে" | <img src="shots/issue10-fixed-source-date.png" width="200" alt="Source checked date"> |

## ❌ Open issues

Severity: **High** = confuses or worries a person in an emergency, or looks broken. **Medium** = makes the site harder to use. **Low** = accessibility polish.

### High

| # | Issue | Where | Suggested fix | Screenshot |
|---|---|---|---|---|
| 3 + 18 | **Home is too long and repeats itself:** 11.7 screens on a phone; "লোকেশন পাঠান" appears 9 times, "আমার কাছের সাহায্য" 7, ৯৯৯ 9 | phone home | Order: hero + 3 big buttons → one "আমার এলাকা" card → all national numbers → এলাকা খুঁজুন → কী হয়েছে? → links. Move the rest to their own pages. Target: under 5 screens | <img src="shots/issue18-phone-home-full-repeats.png" width="120" alt="Whole phone home page with every 'লোকেশন পাঠান' outlined"> |
| 4 | **Two questions at the same time on the first visit:** the welcome card and "আপনার এলাকা কি নিজে থেকে আপডেট হবে?"; the same switch appears again below | phone and laptop home | Show the welcome card first; ask about auto location only after the first "আমার কাছের সাহায্য" tap; put the switch inside the "আমার এলাকা" card only | <img src="shots/issue04-two-questions.png" width="200" alt="Auto-location question under the welcome card"> |
| 13 | **"সার্চ টেস্ট (ডেভেলপারদের জন্য)" link in the footer**, visible to everyone | footer, every page | Remove from the footer; link the test page from README/CONTRIBUTING only | <img src="shots/issue13-dev-link.png" width="200" alt="Developer link in the footer"> |
| 14 | **A thick purple box appears around the page heading** after moving to another page; it looks like a bug | every page, phone and laptop | Keep the focus (for screen readers) but hide the outline when it wasn't keyboard focus: `[tabindex="-1"]:focus:not(:focus-visible){outline:none}` | <img src="shots/issue14-heading-focus-box.png" width="200" alt="Purple box around the heading"> |

### Medium

| # | Issue | Where | Suggested fix | Screenshot |
|---|---|---|---|---|
| 2 | ৯৯৯ and লোকেশন পাঠান appear 3 times on the first screen (header, left panel, hero) | laptop home | Left panel: only আমার এলাকা and the filter | <img src="shots/issue02-laptop-repeats.png" width="320" alt="Laptop: the same buttons three times"> |
| 6 | "জরুরি নম্বর" is a slider: only 3 visible on a phone, and actions (লোকেশন পাঠান, আমার কাছের সাহায্য) are mixed with numbers | home | An open grid of all national numbers; actions stay in the hero | <img src="shots/issue06-numbers-carousel.png" width="200" alt="Numbers slider"> |
| 7 | A second district filter card sits in the middle of the phone home page (the search already has "সব জেলা") | phone home | Hide the filter card on phones | <img src="shots/issue07-filter-card.png" width="200" alt="Extra filter card"> |
| 8 | "কী হয়েছে?" cards have large empty coloured boxes; the page looks unfinished | home, guide | Remove the boxes or use a small icon beside the title | <img src="shots/issue08-empty-boxes.png" width="200" alt="Empty boxes"> |
| 11 | The "তিন ভূমিকা" accounts section (volunteer "শীঘ্রই") is on home | home | Move to অ্যাকাউন্ট and আমাদের সম্পর্কে | <img src="shots/issue11-roles-on-home.png" width="200" alt="Roles section on home"> |
| 12 + 17 | **Phone tabs:** only 4 of 7 are visible, with no hint that more exist; on লোকেশন পাঠান the active tab itself is cut ("লোকেশ…") | phone, every page | Scroll the active tab into view and add a fade/arrow, or use 4 tabs + "আরও" | <img src="shots/issue17-tabs-cut.png" width="240" alt="Cut tab"> |
| 15 | Area page uses only ~550px; the right half of the screen is empty, and the left panel disappears | laptop area page | Same layout and left panel as home, or a wider content column | <img src="shots/issue15-laptop-area-empty.png" width="320" alt="Laptop area page with empty right side"> |
| 16 | Phone header shows neither the current area nor the SafeConnect name | phone, every page | Show the area (short) under the header, and the name if it fits | <img src="shots/issue16-phone-header.png" width="240" alt="Phone header"> |
| 19 | "কী হয়েছে?" names two different things: the guide page and the situation chips on লোকেশন পাঠান | send page, guide | Rename the chips' title to "পরিস্থিতি" / "Situation" | <img src="shots/issue19-send-ki-hoyeche.png" width="200" alt="'কী হয়েছে?' on the send page"> |
| 20 | English mode: the language button shows "বাং" (cut); designations stay in Bangla ("পুলিশ পরিদর্শক (নিঃ), অফিসার ইনচার্জ") | header, area page | Show "বাংলা" in full; translate designations (OC, Police Inspector (Unarmed), UNO…); names may stay in Bangla | <img src="shots/issue20-english-mode.png" width="200" alt="English mode"> |
| 21 | Small tap targets on the phone: footer links ~25px tall, the auto switch 28px, "আরও দেখুন" 27px (44px recommended for people in a hurry) | phone | At least 44px tall | <img src="shots/issue21-small-taps.png" width="200" alt="Small footer links"> |

### Low

| # | Issue | Where | Suggested fix | Screenshot |
|---|---|---|---|---|
| 22 | No main heading (h1) on এলাকা খুঁজুন, guide, আমাদের সম্পর্কে, প্রশ্ন ও উত্তর; the footer credit line is too faint in light mode (axe `color-contrast`) | 4 pages; footer | One h1 per page; darker credit text | <img src="shots/issue22-credit-contrast.png" width="200" alt="Faint footer credit"> |

## All page screenshots

| Page | Phone | Laptop |
|---|---|---|
| Home | <img src="shots/phone-home.png" width="180" alt=""> | <img src="shots/laptop-home.png" width="420" alt=""> |
| জরুরি নম্বর | <img src="shots/phone-numbers.png" width="180" alt=""> | <img src="shots/laptop-numbers.png" width="420" alt=""> |
| এলাকা খুঁজুন | <img src="shots/phone-area.png" width="180" alt=""> | <img src="shots/laptop-area.png" width="420" alt=""> |
| হাতিয়া (area page) | <img src="shots/phone-area-hatiya.png" width="180" alt=""> | <img src="shots/issue15-laptop-area-empty.png" width="420" alt=""> |
| লোকেশন পাঠান | <img src="shots/phone-send.png" width="180" alt=""> | <img src="shots/laptop-send.png" width="420" alt=""> |
| কী হয়েছে? | <img src="shots/phone-guide.png" width="180" alt=""> | <img src="shots/laptop-guide.png" width="420" alt=""> |
| আমাদের সম্পর্কে | <img src="shots/phone-about.png" width="180" alt=""> | <img src="shots/laptop-about.png" width="420" alt=""> |
| প্রশ্ন ও উত্তর | <img src="shots/phone-faq.png" width="180" alt=""> | <img src="shots/laptop-faq.png" width="420" alt=""> |
| অ্যাকাউন্ট | <img src="shots/phone-account.png" width="180" alt=""> | <img src="shots/laptop-account.png" width="420" alt=""> |
| Sign-in window | <img src="shots/phone-signin.png" width="180" alt=""> | <img src="shots/laptop-signin.png" width="420" alt=""> |
| English | <img src="shots/issue20-english-mode.png" width="180" alt=""> | <img src="shots/laptop-english.png" width="420" alt=""> |
| Dark mode | <img src="shots/phone-dark-home.png" width="180" alt=""> | <img src="shots/laptop-dark-home.png" width="420" alt=""> |

## How to run the tests again

The scripts test the **live site**, so nothing in the project needs to change. They need Node 20+ and Playwright with Chromium. Playwright is **not** part of the project's `package.json`.

```
mkdir ui-test && cd ui-test
node <path>/scripts/audit.js         # every page: measurements + axe -> report.json
node <path>/scripts/flow.js          # search, area page, sign-in, English, keyboard, offline
node <path>/scripts/evidence.js shots   # the marked screenshots in this report
```

After the UI clarity fixes, run them again and add a new dated report next to this one. Every open issue above should then be ✅.
