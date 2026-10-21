# SafeConnect – Issues

Create each issue on GitHub (**Issues → New issue**). Copy the title and the text, set the **label**, **assignee** and the milestone **v1.0 – Showcase**.
**Each person creates their own issues**, so both accounts show activity.

**Planning IDs:** GitHub numbers issues in the order they are created, so its numbers will differ from ours. Put the planning ID at the start of the title, e.g. `[P05] Add national hotlines data`, and refer to issues by that ID.

Legend: **J** = jerin101 · **T** = tasmintoshi · **Day** = planned day · Branch prefix: `docs/`, `data/`, `feature/`, `fix/`

---

## Setup

### [P01] Add project plan, README and .gitignore — J · docs · Day 1
First push. Add `README.md`, `.gitignore`, `docs/PROJECT_PLAN.md`, `docs/BUILD_PLAN.md`, `docs/FEATURES.md`, `docs/ISSUES.md`.
**Done when:** the PR is reviewed by T and merged.

### [P02] Add design guide — T · docs, frontend · Day 1
`docs/DESIGN.md`:
- colours (night and day), font (Hind Siliguri), spacing
- card layout and button styles
- phone-first sketches of the home, area and SOS screens (inspired by the team's reference images)

**Done when:** reviewed by J and merged.

### [P03] Add CLAUDE.md and the 6 Claude Code agents — J · docs · Day 2
`CLAUDE.md` (project rules, from BUILD_PLAN) and `.claude/agents/`: project-manager, developer, tester, source-researcher, data-checker, bangla-reviewer.

### [P04] Add contributing guide, issue/PR templates — J · docs · Day 2
`CONTRIBUTING.md` (branch → commit → PR → review), `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`.

---

## Data and backend (jerin101)

### [P05] Add national hotlines data — J · data · Day 3
`data/national_hotlines.json`: 19 services, 25 numbers from the national portal's hotline page. Each record has `source_url` and a quote.

### [P06] Add area list for the whole country — J · data · Day 3
`data/areas_bangladesh.json` + `tools/collect_areas.py` + `tools/build_areas.py`. 8 divisions, 64 districts, 510 upazilas, 4,537 unions with BBS codes.

### [P07] Add data collector tools — J · backend · Day 4
`tools/fetch.py` (+ the Sectigo intermediate certificate), `collect_contacts.py`, `collect_union_pages.py`, `collect_municipalities.py`, `build_contacts.py`. Write a short README in `tools/` explaining each script.

### [P08] Add Noakhali contacts — J · data · Day 5
`data/contacts_noakhali.json`: police, administration, municipalities, health, fire, unions, village police, villages, union index.

### [P09] Add Cox's Bazar contacts — J · data · Day 5
`data/contacts_coxsbazar.json` (including Tourist Police zones).

### [P10] Add manual additions and places — J · data · Day 6
`data/manual_additions.json`: BCG Station Inani; place "Inani beach" → Jaliapalong / Inani police outpost / Ukhia police station.

### [P11] Add data validator and GitHub Action — J · backend · Day 7
`tools/validate_data.py` + `.github/workflows/validate.yml` (runs on every PR; the PR fails on any error).

### [P12] Add source verification and coverage report — J · backend · Day 8
`tools/verify_sources.py`, `tools/coverage_report.py`, `docs/COVERAGE.md`, `docs/DATA_REPORT.md`, `docs/DATA_GAPS.md`.

### [P13] Human spot-check of 40 key contacts — J · data · Day 10
Open each source link in `spot_check_40.csv` and confirm the number. Set `status: verified` for the ones that match.

### [P14] Data gap: police units — J · data-gap · Day 10
From a laptop in Bangladesh, check `noakhali.police.gov.bd` / `coxsbazar.police.gov.bd` for **Eidgaon** and **Bhasanchar** police stations, RAB and BGB. Add them to `manual_additions.json` with source and quote.

### [P15] Content: how to report a crime / file a GD — J · data, docs · Day 11
Confirm `gd.police.gov.bd` from Bangladesh. Write short Bangla and English steps (GD vs case, what to bring, women & children help desk, legal aid 16699) with official links.

### [P16] Bangla/English text files — J · backend · Day 9
`js/lang/bn.json`, `js/lang/en.json`: every button and label, the 8 SOS message templates, the guide texts. Checked by the `bangla-reviewer` agent.

### [P17] Firebase setup — J · backend · Day 11 · *Should*
Free Spark project, Google + email login, Firestore with **security rules** (users can only read and write their own data; only the admin can approve reports). `js/firebase.js`.

### [P18] Report wrong number + admin page — J · backend · Day 12 · *Should*
"Report / suggest a number" button (logged-in users) → Firestore. `pages/admin.html`: list reports, approve or reject with an official source.

### [P19] Deploy to GitHub Pages + release — J · backend · Day 13
`.github/workflows/pages.yml`, test the live site on a phone, write release notes, tag `v1.0`.

### [P23] Data module: load, cache, search — J · backend · Day 6
`js/data.js`:
- load the national, areas and district files
- build a search index (Bangla and English, including numbers)
- `getAreaContacts(upazila, union)` returns contacts **in fallback-chain order**

### [P26] Location module: GPS → upazila/union — J · backend · Day 8
`js/location.js`: Geolocation → OpenStreetMap Nominatim reverse lookup (online, at most 1 request per second, with credit) → match to our upazila/union names. Fall back to the manual picker.

---

## Frontend (tasmintoshi)

### [P20] Page skeleton and navigation — T · frontend · Day 2
`index.html`, `pages/` placeholders, header (logo, language and theme buttons), bottom navigation (Home, Area, SOS, Guides).

### [P21] Design tokens and dark/light theme — T · frontend · Day 3
`css/base.css` with CSS variables; the theme follows the phone's setting and is remembered.

### [P22] Home screen — T · frontend · Day 4
A 999 bar that is always visible, a big SOS button, a search box, the "Use my location" button, quick categories.

### [P24] Area picker — T · frontend · Day 5
Division → district → upazila → union **or municipality**, remembered on the phone. Uses `data.js`.

### [P25] Area page + contact cards — T · frontend · Day 6–7
Contacts in fallback-chain order; police outpost first when present. Each card has:
- tap-to-call, copy and share
- the source link and check date
- badges: "number not published", "may be outdated", "administrator"

### [P27] Village search + places — T · frontend · Day 10
Search villages (from `villages[]`) and places (e.g. Inani beach) → open that union's page.

### [P28] Bangla/English switch + Bangla digits — T · frontend · Day 8
Uses `js/lang/*.json`; numbers are shown in Bangla digits, but `tel:` links keep the normal digits.

### [P29] SOS + family contacts — T · frontend · Day 9
Pick a situation → GPS → message (from P16) → WhatsApp / SMS / share. SMS fallback without internet. Family contacts are saved on the phone.

### [P30] Silent SOS + siren — T · frontend · Day 10
Silent SOS: a dark screen, no sound, minimum taps. Siren: Web Audio + a flashing screen.

### [P31] Safe Journey — T · frontend · Day 11
Number-plate photo + route + expected arrival → share to family; an "I arrived safely" button.

### [P32] Fake incoming call — T · frontend · Day 11 · *Should*

### [P33] Lost/stolen item GD helper — T · frontend · Day 12
A form → a ready Bangla GD text to copy, plus where to file it (from places / police station data).

### [P34] Offline app (PWA) — T · frontend · Day 12
`manifest.json`, `service-worker.js`, caching of the pages and data; installable on the home screen.

### [P35] Login and account page — T · frontend · Day 13 · *Should*
Uses `js/firebase.js` (P17): synced family contacts, saved areas, favourites.

### [P36] Accessibility, large text, mobile polish — T · frontend · Day 13
Contrast, keyboard use, screen-reader labels in Bangla, a large-text mode, testing at 360 px width.

---

## Both

### [P37] Final test and showcase — J + T · Day 14
- Test both scenarios on real phones, including airplane mode
- Fix bugs (each fix = a `fix/` issue + PR)
- Write `docs/DEMO.md`
- Tag `v1.0`

---

**Count:** jerin101 20 issues · tasmintoshi 16 issues · P37 shared · each person reviews every PR from the other.
