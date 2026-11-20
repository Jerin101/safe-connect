# SafeConnect — project brief (current state, 18 Nov 2026)

Read this first. It replaces the older descriptions in README.md and docs/FEATURES.md (written before Nov 2026; some
items there are plans, not finished features). When this file and the code disagree, the code is right.

## What SafeConnect is now
A Bangla-first web app (PWA) for **everyday local help in Bangladesh**: find what you need nearby, act on local
problems, stay safe while travelling, and **call a nearby service (vehicle, ambulance, technician, helper) and see
each other on a live map, with a fair bill**. It started as an emergency-number directory for two pilot districts;
after the teacher's feedback ("it only shows data") it became a platform where people *do* things.

Team: Israt Jerin (lead: data, Firebase, merges) and Tasmin Toshi (frontend, testing, admin).
Live: https://jerin101.github.io/safe-connect/ (VERSION v53) · new design and features: /demo/

## Two parts of the site
1. **Main site** (`index.html`, `js/`): emergency and official numbers for Noakhali and Cox's Bazar (from *.gov.bd
   sources), 999 first, search with Bangla/English/phonetic spelling, works offline after the first visit, Bangla and
   English, sign-in (user / volunteer / admin), wrong-number reports with an admin review and audit log.
2. **Demo** (`demo/`, the new design; moves to the main site after review): everything below.

## Features in /demo/ (all working, v8)
| Area | What a person can do |
|---|---|
| আজ / কাছে | Pick any of the 64 districts and its upazila (or GPS). See places nearby by category: hospitals, pharmacies, filling stations, shops, bazars, ATMs, workshops, bus/ghat/rail, police and fire, post office, tourist spots, hotels, schools, places of worship. Map (Leaflet + OpenStreetMap). |
| Data sources | Official numbers (*.gov.bd) for the two pilot districts; places from OpenStreetMap (labelled "যাচাই করা হয়নি"); filling stations from Padma Oil and Meghna Petroleum official lists; 471 upazila centres. No Google Maps data. |
| গন্তব্য | A place's page: directions, share, what is within 5 km, "এখন কেমন?" (open/closed, fuel yes/no, reported by people, with time). |
| Place page | First "ফ্রি সহায়তা": the place's official number or "নম্বর পাওয়া যায়নি", the area's police/UNO/fire numbers, 999. Then "সার্ভিস": a ride there and the category's paid services. |
| নিরাপদে পৌঁছানো | A family link that turns red if "পৌঁছেছি" has not come in time. "আমি নিরাপদ" SMS. |
| বিপদে | 999, situations with steps, area police and health numbers, SOS SMS with a location link (SMS app; the site never sends by itself), the 19 official national helplines grouped by need. |
| **ডাকুন** (teacher's request) | **Rider:** choose CNG, bike, ambulance, technician, emergency helper, towing, **আনিয়ে দিন** (a rider buys and brings: bill = shop receipt + delivery) or **তৈরি অর্ডার তুলে আনুন** (already paid at the shop: delivery only); pickup and destination; fare estimate; call. **Provider:** apply, admin approves, go online, see calls of their type in their district live, accept. **Both see each other on a live map** until the trip ends. **Bill:** base + per km + waiting after 3 free minutes, rounded up to 5 taka, minimum fare; "bill ok/wrong", cash, receipt, rating, history, provider earnings. **Admin:** approve providers, set rates (audited). |

## How it is built
- Static site on GitHub Pages: HTML, CSS, vanilla JavaScript modules, no build step, service worker for offline.
- Firebase (free Spark plan): Authentication (Google / email) and Cloud Firestore. **No server code**: the Firestore
  security rules (`firestore.rules`) are the backend; they check who may do each step, in which order, rate limits
  (10 a day, 60 s apart) and that a fare matches the rates within 5 taka.
- Firestore collections: users, admins, audit, reports, limits, family, placeStatus (+by), providers, rates, online,
  rideLimits, rides (+live/{rider|provider}).
- Ride states: requested → accepted → arrived → on_trip → completed → paid, or cancelled.
- Key files: `firestore.rules`, `js/firebase.js`, `js/ride.js` (fare and status logic), `js/community.js`,
  `demo/demo.js`, `demo/README.md` (full feature notes).
- Tests: 136 security-rule tests in the Firestore emulator (`npm run test:rules`, required on every PR); browser
  end-to-end tests with Playwright; data validator (`tools/validate_data.py`); width checks at 320/390/1280 px.

## Privacy and safety rules (from CLAUDE.md)
Location only after a tap. Live ride positions: only the two people of that ride, only during the ride, deleted
at the end. No phone numbers or home addresses in public text. Never invent phone numbers. No paid services.

## What comes next
1. SRS document (IEEE style) and diagrams in `docs/srs/`.
2. Move the demo features to the main site; official numbers for more districts.
Removed on purpose (nobody to follow them up): local problem reporting, government service guides, GD draft.
Not planned on the free plan: push notifications, online payment (bKash/Nagad), road routing.
