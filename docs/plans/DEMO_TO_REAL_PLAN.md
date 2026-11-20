# From demo to the real site: plan v3 (20 Nov 2026; v2 of 18 Nov 2026)

> **বাংলায় সংক্ষেপে:** `/demo/`-এর নতুন ডিজাইন আর ফিচার আসল সাইটে আসবে ধাপে ধাপে, প্রতিটা আলাদা PR-এ। ডেমোর কোড কপি
> হবে না: দেখতে কেমন আর কী করে সেটা নিয়ে আসল সাইটের নিয়মে (`textContent`, CSP, বাংলা+ইংরেজি `js/lang`, অফলাইন) নতুন করে
> লেখা হবে। আসল সাইটের যা ডেমোতে নেই (ইংরেজি, স্বেচ্ছাসেবক ও অ্যাডমিন পাতা, অফলাইন ক্যাশ) কিছুই হারাবে না।
> v1 (14 Nov) ছিল প্রথম ডেমোর জন্য; v2-তে সমস্যা জানান, এখন কেমন, নিরাপদে পৌঁছানো, GD আর ডাকুন যোগ হয়েছে (A9–A12)।
> **প্রতিটা PR: issue → PR → tests → tester GO (Tasmin) → merge → live check। Jerin অনুমতি দিলে তবেই A1 শুরু।**
> **v3 (২০ নভেম্বর):** সমস্যা জানান, সরকারি সেবার নির্দেশিকা আর GD খসড়া বাদ (A9 বাতিল, A5 থেকে নির্দেশিকা ও GD বাদ)।
> ১৯টা জাতীয় হেল্পলাইন A6 (বিপদে)-তে। নতুন ক্রম: A12 → A4 → A6 → A3, সময় থাকলে A7, A8, A13।
> **৫ ডিসেম্বর কোড ফ্রিজ**, তারপর শুধু বাগ ঠিক করা। নিচে §1a।

Reference: `demo/` (look and behaviour), `demo/README.md` (feature notes), `docs/PROJECT_BRIEF.md` (current state),
`docs/DESIGN.md` (design rules). Data work (more districts' official numbers) continues on its own track in `data/`
and never touches the app files in the same PR.

## 0. Rules for every PR in this plan
1. **Take what it looks like and does, not the code.** The demo uses template strings with `innerHTML` + `esc()`; the
   real site builds DOM with `createElement` + `textContent` (CLAUDE.md). Leaflet popups and tooltips get DOM nodes or
   text only, never a string with data in it.
2. **Bangla and English.** Every new text goes into `js/lang/bn.json` and `js/lang/en.json`; nothing hard-coded.
3. **Nothing is lost.** English, sign-in (user / volunteer / admin), the volunteer and admin workspaces, wrong-number
   reports, family numbers, offline cache and every old link keep working. A PR that removes an old part says which
   new part replaces it and has a test for the old link.
4. **Offline:** new shell files go into `FILES` in `service-worker.js` in the same PR, and the separate VERSION PR follows
   the merge (feature PRs never change VERSION).
5. **Tests in the same PR:** width sweep 320–1440 (bn/en, light/dark), the feature's Playwright test, rules tests if
   `firestore.rules` changes, must-find 100% unchanged. `/security-review`, bangla-reviewer, tester GO.
6. **The demo stays** at `/demo/` until A13; it is the reference while the real pages are built.

## 1. Steps (one PR each, in this order)
| # | PR | What | Done when |
|---|---|---|---|
| A1 | Design tokens + icons | **Done (#246, VERSION #248).** Demo tokens in `css/base.css` (light/dark, teal), `js/icons.js`, DESIGN.md | width sweep and contrast check green; no data change |
| A2 | App shell | **Done (#258, #260, VERSION #262).** Bottom tabs on phones, side menu ≥ 960 px, `#/today #/near #/sos #/search`, old addresses redirect, "সাইন ইন" visible. A tab appears only when its real page exists (no /demo/ links): আজ · কাছে · নম্বর · বিপদে now; **ডাকুন comes with A12** | every old link opens the right page; bn/en switch works on every tab |
| A3 | আজ | greeting, sunrise/sunset (on the phone), district card, "কী দরকার" tiles, nearest help, safe-trip card, local numbers (no problems card and no service pills: removed in v3) | works offline |
| A4 | কাছে + গন্তব্য | 64 districts, district/upazila picker, 17 categories, places from `data/places/` (OSM, labelled), official fuel lists, distance on the phone; **map inside the page with the nearest place in green**; **place card: "ফ্রি সহায়তা" first (the place's official number or "নম্বর পাওয়া যায়নি", the area's police/UNO/fire, 999), then "সার্ভিস"** (এখানে যেতে ডাকুন + the category's paid services); destination page with "within 5 km" | no coordinates in any request (test) |
| A5 | ~~সেবা~~ | **Removed in v3:** service guides and GD draft are out of scope; the national helplines move to A6 and the local office numbers are on the place card (A4) and in বিপদে (A6) | — |
| A6 | বিপদে | situations, SOS SMS with the help link, "আমি নিরাপদ" buttons, local numbers, **the 19 national helplines grouped by need, each with its source** (existing `js/bipod.js` reused) | existing SOS tests green; 19 helplines with `source_url` (test) |
| A7 | Search | current smart search in a Web Worker, index per district, categories, services and helplines added | must-find 100%; < 50 ms per keystroke on a low-end phone |
| A8 | Remove old screens | delete the old portal parts that A2–A7 replaced; VERSION PR afterwards | live == main; old links still redirect |
| A9 | ~~সমস্যা জানান~~ | **Cancelled in v3** (problems removed; their Firestore collections are closed since kit v8, #264) | — |
| A10 | এখন কেমন? + নিরাপদে পৌঁছানো | place status on the destination page; trip link that turns red | e2e of both |
| A11 | ডাকুন hardening (rules + `js/ride.js`) | **Done in kits v7/v8 (#250, #264):** stored pickup/destination rounded to ~100 m (the rules refuse exact points), `online/` without any position, provider offline on page close, the rider may close a stuck ride (3 h before the trip, 12 h after) | rules tests 136/136 |
| A12 | ডাকুন | rider, provider and admin parts as in the demo, rewritten with `textContent`; admin parts move into the existing admin workspace. **Must keep:** আনিয়ে দিন (shop receipt + delivery, limit), তৈরি অর্ডার তুলে আনুন (pickup), টোয়িং, closing a stuck ride, points rounded to ~100 m. Separate PRs for rider, provider and admin | three-browser e2e from rates to receipt in **each** PR |
| A13 | Retire the demo | `/demo/` redirects to the real site; demo files removed; VERSION PR | live == main |

Weather and cyclone signal stay labelled "নমুনা" until an official source is wired.

## 1a. Order and dates (v3, Jerin, 20 Nov 2026)
1. **A12 ডাকুন** (rider, provider, admin: separate PRs, each with the three-browser ride test)
2. **A4 কাছে + map + place card**
3. **A6 বিপদে + helplines**
4. **A3 আজ**
5. If there is time: A7 search, A8 remove old screens, A13 retire the demo.

- **Code freeze: 5 December 2026.** After it, only bug fixes.
- **2 December check:** if A12 and A4 are not finished by then, tell Jerin; A7, A8 and A13 are then dropped.
- **Risk:** A8 and A13 remove old parts, so they carry the highest risk of breaking something. They come last, each
  with the routes test (`tests/routes-test.mjs`) and a full width sweep, and only with time to spare before the freeze.
- Every PR from Tasmin's account, merged after Tasmin's GO; check the PR's state before every push.

## 2. Concurrency (many people at once, on the free Spark plan)
1. No server of our own: static files from the GitHub Pages CDN.
2. The phone does the work: search, distances, sunrise/sunset, lists and SOS text are computed on the phone.
3. **Firestore only when needed.** Public visitors who do not sign in cost 0 reads. Realtime listeners (`onSnapshot`)
   are allowed **only** in ডাকুন: one ride document and one `live` document while that person has an active ride, and the
   provider's open-request list while their page is open. Everything else reads once, by id or an equality filter.
4. Budget (Spark: 50,000 reads, 20,000 writes a day): a ride costs about 60–150 writes (live points every 8 s / 25 m)
   and a similar number of reads. Rule of thumb: about 100 complete rides a day fit next to the other features. If the
   console shows > 60% of the daily quota, raise the live interval to 15 s.
5. Writes are limited by the rules: verified email, 10 a day, 60 s apart (reports, issues, ride requests).
6. Load test only against a local copy (`npx http-server`) and the emulators, never against GitHub Pages or Firebase.

## 3. Security
1. CSP stays strict (`default-src 'self'`, no inline scripts, self-hosted fonts); `connect-src` lists only the Firebase
   hosts in use.
2. No `innerHTML` with data; lint rule `no-unsanitized`. Leaflet: `bindTooltip`/`bindPopup` get text or DOM nodes.
3. Links: only `tel:`, `sms:`, Google Maps directions, OpenStreetMap and the listed `*.gov.bd` hosts; `rel="noopener noreferrer"`.
4. Location: only after a tap. Outside ডাকুন nothing is sent. In ডাকুন: the live point only to the two people of the ride,
   only during it, deleted at the end; stored points rounded (A11). Test: no `lat`/`lon` in any request outside ডাকুন.
5. Firestore rules for every new collection, with emulator tests; admin actions write an audit entry.
6. Data: `validate_data.py` in CI; never invented phone numbers; `source_url` on every official record.

## 4. Redundancy
| If this fails | Then |
|---|---|
| Internet on the phone | the service worker serves the shell, the user's district and national numbers; tel:/sms: still work; ডাকুন says it needs internet |
| GitHub Pages | mirror on Firebase Hosting (decision 3) |
| Firebase | public features do not need it; signed-in parts show "এখন সংযোগ নেই" and keep drafts on the phone |
| A union has no number | union → upazila → district → national (always 999) |
| Bad data merged | revert the PR; every data file has a date; the page shows "শেষ যাচাই" |

## 5. Latency budgets
Shell ≤ 150 KB gzip (per-tab modules loaded when a tab opens) · fonts ≤ 140 KB · one district's data ≤ 120 KB ·
Firebase SDK 0 KB until a feature needs it (dynamic `import()`) · Leaflet only when a map opens · LCP < 2.5 s first visit
and < 1 s repeat at 360 px on slow 4G (Lighthouse CI ≥ 90 on UI PRs) · search < 50 ms · tab switch < 100 ms.

## 6. Decisions for Jerin (answer before A1)
1. Accent colour: the real site is **violet**, the demo is **teal**. Switch to teal (red stays only for 999/SOS)? Yes / keep violet.
2. Order: A1→A13 as above, or ডাকুন earlier (A11–A12 right after A2)? The teacher's request argues for earlier.
3. Firebase Hosting as a mirror address: yes / no.

**Jerin's answers (18 Nov 2026; the order was changed in v3, see §1a):** (1) Accent colour: **teal** (red only for 999/SOS). (2) Order: **A1 → A2 → A11 → A12**
(ডাকুন right after the app shell), then A3–A10 and A13 in the order above. (3) Firebase Hosting mirror: **no** (section 4's
GitHub Pages row then has no mirror; the offline cache covers a Pages outage for returning visitors).
