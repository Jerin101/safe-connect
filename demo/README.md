# SafeConnect demo v2 (17 Nov 2026)

The new design and the everyday features, for showing the plan. Not linked from the site (`noindex`). Open:
https://jerin101.github.io/safe-connect/demo/

## What is real
- **All 64 districts:** the area picker (district, then upazila), GPS anywhere in Bangladesh, and search by district or
  upazila use `../data/upazila_centres.json` (471 centres, merged in #217).
- **Places near you:** hospitals, clinics, pharmacies, pumps, banks/ATMs, shops, bazars, workshops, bus stands/ghats,
  police and fire, from `../data/places/` (OpenStreetMap, 64 districts, #217). Each row says "OpenStreetMap, যাচাই করা
  হয়নি", links to its OSM page, and has directions; no phone numbers (they are not from an official source).
- **Map:** Leaflet 1.9.4 kept in `vendor/leaflet/` (BSD-2, LICENSE there; SRI of leaflet.js
  `sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=`, the published one). Opens only after "ম্যাপে দেখুন";
  tiles from tile.openstreetmap.org with the credit; the list works without internet.
- **Official numbers** (police, UNO, health complex, fire, union chairman, DC) for Noakhali and Cox's Bazar:
  `data.json`, copied from `data/` on 14 Nov 2026 with source links. Other districts say "আসছে (পর্ব ২)" and show 999.
- **Search** also knows the site's local names (`../data/aliases.json`: Laboni, Kashem Bazar, …).
- Sunrise and sunset are computed on the phone.

## What is not real yet (labelled on the page)
Weather and cyclone signal ("নমুনা"), cyclone shelters (no list yet: an empty state, not sample rows), the service
guides' fees (general information with a note to check the official page).

## Rules it follows
CSP meta: `default-src 'self'`, no inline script or style, fonts from `../fonts/`, images only from self, `data:` and
tile.openstreetmap.org. Location: only after a tap; distances computed on the phone; nothing uploaded. Popups on the
map are built with `textContent`. The page itself still builds its lists with template strings and an `esc()` function
on every value (a demo shortcut); the real pages (DEMO_TO_REAL_PLAN A1–A8) use `textContent`.

## Tested (Playwright, Chromium)
320, 390, 412 (dark) and 1280 px: every tab, no horizontal scroll, no console errors, no CSP errors; the only outside
host is tile.openstreetmap.org. Noakhali: pharmacies and hospitals from OSM, 24 pins on the map, pumps show the empty
state (OSM has none in Noakhali, see docs/reports/OSM_GAPS.md). Sylhet (picked from the list): pharmacies and map;
emergency numbers say "আসছে". Search: rangpur, sylhet, laboni, chowmuhoni, jonmo nibondhon.

## v3 (17 Nov 2026, night)
- **Any of the 64 districts** from the Today tab ("জেলা বদলান"), the area pill, or search.
- **17 categories**, daily needs first: হাসপাতাল ও ক্লিনিক, ফার্মেসি, ফিলিং স্টেশন, দোকান ও সুপারশপ, বাজার, ব্যাংক/ATM, ওয়ার্কশপ,
  যাতায়াত (বাস, ঘাট, রেল), থানা ও ফায়ার, পোস্ট অফিস, দর্শনীয় স্থান, হোটেল ও খাবার, স্কুল-কলেজ, উপাসনালয়, আশ্রয়কেন্দ্র, ইউনিয়ন পরিষদ, অন্যান্য সেবা.
- **Filling stations** from Padma Oil's official list (#227): "আনুমানিক অবস্থান" at the upazila centre, or "অবস্থান জানা নেই".
- **Destination page** ("গন্তব্য দেখুন" / "বিস্তারিত" on every place with a point): directions, share, "এখানে যাচ্ছি" SMS to family,
  a map, and what is within 5 km: থাকা ও খাওয়া, হাসপাতাল, ফার্মেসি, ATM, ফিলিং স্টেশন, থানা, যাতায়াত.
- **সাহায্য ও হেল্পলাইন** page: all 19 official national helplines by need (বিপদ, নারী ও শিশু, স্বাস্থ্য, দুর্যোগ, পর্যটক, আইনি, তথ্য),
  each with its source, plus the area's official numbers.
- The new categories (tourism, stay_food, education, worship, shelter, post_office, railway_station) fill in by
  themselves when data PR 2c adds them to `data/places/`; until then they show an honest empty state.

## v4 (18 Nov 2026): features that help people act
- **সমস্যা জানান, সমাধান দেখুন** (tab "সমস্যা"): report a local problem (road, water, drain, light, …) with a landmark; others
  press "আমিও"; the status moves জানানো → যাচাই → অফিসে → কাজ চলছে → সমাধান and everyone sees it. No name or phone on the page.
- **এখন কেমন?** on a place's page: "এখন খোলা / বন্ধ / তেল আছে / তেল নেই", with how many people said it and when.
- **নিরাপদে পৌঁছানো**: a family link that turns red when the time is over and "পৌঁছেছি" has not come.
- **GD draft** for a lost item, and "আমি নিরাপদ" SMS buttons.

## v5 (18 Nov 2026): ডাকুন — call a vehicle, a technician or a helper, with a live map and a bill
- **Rider** (tab "ডাকুন"): choose সিএনজি, বাইক, অ্যাম্বুলেন্স, কারিগর or বিপদে সাহায্যকারী; pickup (area, "আমার লোকেশন", or a tap
  on the map) and destination (a tap, or a nearby bazar/bus stand/hospital); the fare estimate from the admin's rates;
  how many providers of that type are working in the district. After a provider accepts: their name and vehicle number,
  their point moving on the map, distance and minutes away. Then the bill (start + km + waiting after 3 free minutes,
  rounded up to 5 taka, minimum fare), "বিল ঠিক আছে / ভুল", cash, receipt (copy/share), rating, and history.
- **Provider** ("আমি সেবা দিই"): apply (name, type, vehicle number or skill; the district is the chosen area), wait for
  approval, go online, see new requests of their type in their district live, accept (the second provider is refused),
  পৌঁছেছি → যাত্রা শুরু → বিল করুন (distance from GPS, waiting from the two times) → টাকা পেয়েছি; earnings today and total.
- **Admin** (same page): approve providers and set the rates per type; both are written with an audit entry.
- **Firestore rules** decide every step: who may take it, in which order, that the fare is within 5 taka of the formula
  and the distance not more than 3 × the estimate + 5 km, at most 10 requests a day and 60 s apart.
- **Location during a ride:** this is the one feature that sends positions. Only after the person taps "ডাকুন" / "নিন";
  the live point (`rides/{id}/live/{rider|provider}`) is readable only by those two people, only while the ride is
  accepted, arrived or on trip, and is deleted when it ends. The pickup and destination (with the person's own label)
  stay in the ride record for the receipt; only the rider, the provider and an admin can read it. "Online" providers
  are stored rounded to about 100 m. The page says this next to the button.
- **Presentation mode:** add `?sim=1` to the address. Positions then move along a straight line (120 m every 3 s) instead
  of GPS, so the live map can be shown with two browser windows on one laptop. The page says "নকল".
- Tested: rules 146/146 in the emulator (27 for rides); a three-browser test (admin, driver, rider) from rates to receipt,
  320/390/1280 px, no console errors.

## Map (19 Nov 2026)
Ride-app look on the OpenStreetMap tiles (no key; CARTO's tiles now need an account key): pickup pin, destination flag,
the provider as a vehicle that glides and turns toward where it goes, the person as a pulsing dot, dashed straight lines
(no road-routing service) and a chip with distance and minutes. "পথ দেখান" on a place opens our own place page first
(straight line from the chosen area and the distance); "Google Maps-এ খুলুন" is the second button. Dark mode darkens
the tiles with a CSS filter.

## v6 (19 Nov 2026): the map inside the site, the closest place, and "আনিয়ে দিন"
- **কাছে opens with a map inside the site** (Leaflet + OpenStreetMap, no Google Maps): every place of the category is
  an icon; **the closest one is green** with the label "সবচেয়ে কাছে", and the same row is green in the list. Tapping a
  pin (or "ম্যাপে" on a row) opens: **এখানে যেতে ডাকুন**, **আনিয়ে দিন** (pharmacies, shops, bazars), বিস্তারিত.
- **Every category works the same way** (all 17): map, closest in green, "এখানে যেতে ডাকুন", plus the action that fits:
  হাসপাতাল → অ্যাম্বুলেন্সে যান · ফার্মেসি, দোকান, বাজার → আনিয়ে দিন · হোটেল ও খাবার → খাবার আনিয়ে দিন · ওয়ার্কশপ → মেকানিক কাছে ডাকুন ·
  অন্যান্য সেবা → কারিগর কাছে ডাকুন · আশ্রয়কেন্দ্র → সাহায্যকারী ডাকুন. A category with no places shows an empty map (only "আপনি").
  Places at an "approximate" point (upazila or union centre) get no green and no আনিয়ে দিন.
- **সবচেয়ে কাছের সাহায্য** on আজ and কাছে: the closest hospital (a hospital or the official health complex before
  clinics), pharmacy, police/fire and filling station from where the person is, in any of the 64 districts (e.g.
  Mohammadpur, Dhaka by GPS), with call (official numbers), map and ডাকুন.
- **এখানে যেতে ডাকুন** fills the ডাকুন form: pickup = the person's area, destination = that place; then the same live map.
- **আনিয়ে দিন (errand) — the new billing:** the person picks a shop, writes what to buy and the most they will pay for
  the things. An approved delivery rider takes it: দোকানে যাচ্ছেন → দোকানে কিনছেন → আপনার কাছে আনছেন, live on the map.
  The rider pays at the shop and types the receipt amount. **Bill = the shop's receipt + the delivery fare** (start +
  per km + waiting, the same formula); the person sees both parts, says "বিল ঠিক আছে", pays cash; the receipt lists the
  things. Firestore rules: the list (2–300 characters, no phone number) and the limit (1–20,000 taka) are required for an
  errand and refused on other types; the receipt amount must be whole taka and never above the limit; the delivery fare
  is checked like any ride. Medicines that need a prescription are excluded (said on the form).
- Tested: rules 151/151 (5 new for errands); a four-browser test (visitor in Mohammadpur; admin, delivery rider and
  rider in Noakhali) from the map to the receipt; 320/390/1280 px, no console errors.

## v7 (20 Nov 2026): safety fixes, police station in the GD draft, problem status by an admin
- **Stored ride points are rounded to about 100 m** (CLAUDE.md rule 5); the rules refuse a more exact pickup or
  destination. The exact spot exists only in the live documents during the ride and is deleted at its end.
- **"Online" providers store no position at all** (only type, district, time); riders see only how many work in the
  district. Online is renewed every 10 minutes while the page is open, and the page goes offline when it is closed.
- **A stuck ride can be closed by the rider** (no fee): after 3 hours with no change before the trip, 12 hours after it
  started or while waiting for "টাকা পেয়েছি". The rules check the time; the provider sees why it closed.
- **GD draft:** the police station comes from `data/thanas.json` (district police websites, with the source link);
  where the list has none, the field is empty for the person to fill, never a guess.
- **Problems:** an admin changes the status in the app (জানানো → যাচাই → অফিসে → কাজ চলছে → সমাধান, or বন্ধ with a
  reason), with an audit entry; nobody else sees the form.
- Tested: rules 155/155; four-browser test (map, nearest help, errand with its bill, GD, problem status, stored points)
  and the three-browser CNG ride; 320/1280 px, no console errors.
