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
