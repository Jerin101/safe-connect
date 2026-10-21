# SafeConnect – Build Plan (data · technology · workflow)

Team: **jerin101** (lead: backend, data, GitHub) · **tasmintoshi** (frontend, UI) · Deadline: 2 weeks · Budget: 0

This file is the single source of truth for technology, data and workflow. The short rules for Claude and its agents are in `CLAUDE.md`, which points back here.

---

## 1. Technology (final)

| Part | Choice | Why | Cost |
|---|---|---|---|
| Pages | HTML + CSS + plain JavaScript (ES modules), no framework, no build step | Easy to learn and to explain in a viva | Free |
| Data | JSON files in `data/` | Simple, versioned in Git, works offline | Free |
| Hosting | GitHub Pages (HTTPS) | Free; HTTPS is required for GPS, camera and offline mode | Free |
| Offline app | `manifest.json` + `service-worker.js` (PWA) | Works with no internet after the first visit; installable on the home screen | Free |
| Fonts | Hind Siliguri (Google Fonts), cached by the service worker | Bangla + English in one font | Free |
| Calling | `tel:` links | One tap to call | Free |
| SOS sharing | Web Share API, `sms:` links, `https://wa.me/?text=` | Works on Android and iPhone; SMS works without internet | Free |
| Location | Browser Geolocation API; upazila/union lookup with OpenStreetMap Nominatim (online only, at most 1 request per second, credit "© OpenStreetMap contributors") | GPS works offline; the area name lookup needs internet, otherwise the manual picker is used | Free |
| Plate photo | `<input type="file" accept="image/*" capture="environment">`, then share | Safe Journey feature | Free |
| Siren | Web Audio API (sound generated in code) | No audio files or licences needed | Free |
| On-device storage | `localStorage` (settings, family contacts, saved areas) | Nothing sent to a server without login | Free |
| Login (Should) | Firebase Authentication (Google + email) + Firestore, free Spark plan, loaded from Google's CDN | Synced contacts, wrong-number reports, admin page | Free (no card) |
| Data tools (backend) | Python 3 standard library only: `tools/` | Collect → build → validate | Free |
| Automation | GitHub Actions: run `validate_data.py` on every PR; deploy Pages on merge | Bad data cannot reach the site | Free (public repo) |
| Editor | VS Code + Live Server + GitHub Pull Requests + Claude Code extensions | | Free / your Claude plan |

---

## 2. Folder structure

```
safeconnect/
├── index.html              ← home: 999, SOS, search, area picker
├── pages/                  ← sos.html, journey.html, fakecall.html, guides.html, area.html, account.html, admin.html
├── css/                    ← base.css (tokens: dark/light), components.css
├── js/
│   ├── app.js              ← start-up, routing, settings
│   ├── data.js             ← loads and caches JSON, search index
│   ├── location.js         ← GPS → upazila/union lookup (the area picker UI is P24)
│   ├── contacts.js         ← cards, ordering, fallbacks
│   ├── sos.js  journey.js  fakecall.js  siren.js
│   ├── i18n.js + lang/bn.json, lang/en.json
│   └── firebase.js         ← login, reports (Should)
├── data/                   ← national_hotlines.json, areas_bangladesh.json, contacts_*.json, manual_additions.json
├── tools/                  ← collectors, build, validate (Python)
├── docs/                   ← BUILD_PLAN.md, FEATURES.md, PROJECT_PLAN.md, ISSUES.md, COVERAGE.md, DATA_REPORT.md, DATA_GAPS.md
├── .claude/agents/         ← 6 agents
├── .github/                ← workflows/validate.yml, workflows/pages.yml, issue + PR templates
├── manifest.json  service-worker.js  preview.html (data test page)
├── CLAUDE.md  README.md  CONTRIBUTING.md  LICENSE
└── .gitignore              ← *_raw.json, __pycache__/, secret files
```

---

## 3. Data pipeline

```
official *.gov.bd pages
   │  tools/collect_areas.py · collect_contacts.py · collect_union_pages.py     (polite: waits between requests)
   ▼
*_raw.json   (NOT committed – .gitignore)
   │  tools/build_contacts.py · build_areas.py        (cleans, removes non-public staff, adds flags)
   ▼
data/*.json  + data/manual_additions.json (typed by hand from official pages, with a quote)
   │  tools/validate_data.py      (0 errors required)
   ▼
Pull request → review by the other person → GitHub Actions re-runs the validator → merge → GitHub Pages
   ▼
Website loads data/*.json → service worker caches it for offline use
```

### Data files the website reads

| File | Size | Loaded when |
|---|---|---|
| `national_hotlines.json` | 15 KB | Always (first screen) |
| `areas_bangladesh.json` | 320 KB | When the area picker opens |
| `contacts_noakhali.json` / `contacts_coxsbazar.json` | ~1 MB each | When that district is chosen |
| `manual_additions.json` | small | With the district files |

### Record fields (district files)

`id, level (district/upazila/union/regional), category, district, upazila_en/bn, union_en/bn, office_bn, office_domain, name_bn, designation_bn, ward_no, phones[], email, key_contact, source_url, source_last_updated, retrieved_on, status, flags[]`

**Categories:** emergency, police, village_police, fire, health, women_children, legal, administration, local_representative, union_office, tourist_police, coast_river, disaster, social, ansar_vdp, anti_corruption, information.

**Flags the UI must show:**

| Flag | What the card shows |
|---|---|
| `number_not_published` | "নম্বর সরকারি সাইটে প্রকাশিত নেই" (number not published on the government site), plus the next contact in the fallback chain |
| `source_older_than_2_years` / `older_union_page` | Small "may be outdated" label |
| `administrator_not_elected` | "প্রশাসক" badge (the union is run by an appointed administrator) |
| `number_shared_by_several_records` | Show it as an office number |

---

## 4. Missing data: how the site handles it

**Rule 1: never leave a person with nothing.** For any area, the site walks this **fallback chain** and always shows the first available contacts:

1. **999** (always at the top)
2. Police station for the upazila: OC → duty officer → other officers → district SP office
3. Police outpost or Tourist Police, if the place has one (e.g. Inani)
4. **Village police (গ্রাম পুলিশ)** for the user's ward → village police of other wards in the union
5. Ward member → chairman / administrator → UP secretary or union office (in towns: municipality administrator / executive officer)
6. UNO → DC office
7. Category helplines: 109 / 1098 (women and children), 16263 (health), 102 (fire), 16111 (coast), 16699 (legal aid)
8. **333.** The official portal says 333 gives "contact information of public representatives and government officials", so it's the official fallback for any missing local number.

**Rule 2: an unknown village never blocks the user.**
- GPS finds the upazila automatically, and sometimes the union.
- Otherwise the user picks the union from a list.
- The village search uses `villages[]` (559 village names mapped to a union and ward).
- If the village isn't found, the site still shows the upazila-level contacts (police station, UNO) and the 999 / 109 buttons, and asks "Which union are you in?"

**Rule 3: fill gaps only from official sources.** Each gap becomes a GitHub issue labelled `data-gap`. Acceptable sources, best first:
1. An official `*.gov.bd` page. Some, like `police.gov.bd`, only open from inside Bangladesh, so check them from your laptop.
2. A citizen charter (সিটিজেন চার্টার) board, or the office signboard at the office itself: take a photo, note the date.
3. Calling **333** to ask for the number: record "source: 333, date, call reference".
4. Logged-in users' "report / suggest a number" → admin checks it with source 1–3 → then it's published.
- Never use news sites, Facebook pages that aren't linked from a `.gov.bd` site, or "someone told us".

---

## 5. Scenario check (data needed vs. data we have)

### A. Noakhali – at night a woman is attacked in a village ("Babunagar")

Open SafeConnect → big **999** button → **Silent SOS** sends her location to family → the area page shows:

| Order | Contact | In our data? |
|---|---|---|
| 1 | 999 | ✅ |
| 2 | Police station OC / duty officer for her upazila | ✅ all 9 Noakhali upazilas have police station numbers |
| 3 | **Village police of her ward** | ✅ for 76 of the 160 unions in both districts (337 village police in Noakhali) |
| 4 | Ward member, chairman | ✅ 143 chairmen + 15 administrators across both districts |
| 5 | 109 (violence against women and children), 1098 (if she is a child) | ✅ |
| Later | Upazila women affairs officer, legal aid 16699, UNO | ✅ |

**"Babunagar" doesn't exist in any official list** we can reach: the area list, union sites and OpenStreetMap (its "Babunagar" matches are all in Chattogram district). It's probably a village or para name, and villages aren't in the government list. So the site uses GPS or the union picker. Once we know its union, its chairman and village police are already in the data.

The live demo (`PROJECT_PLAN.md` §6) uses Chowmuhani, Begumganj, where the union is known. This check uses a village name that is not in any official list, to test the fallback.

### B. Cox's Bazar – a tourist loses a drone camera at Inani beach (or it's stolen)

Open SafeConnect → **Use my location**. GPS gives Jaliapalong (Ukhia). Tourist mode turns on because the user is near Inani beach (`places`).

| Step | Contact / action | In our data? |
|---|---|---|
| Theft happening now / thief nearby | 999 | ✅ national |
| Tourist help | Tourist Police helpline 01320222222 / 01887878787; Tourist Police Cox's Bazar zone and region officers | ✅ (the Inani Tourist Police zone site is offline, so the fallback is the Cox's Bazar zone) |
| Report the loss (GD) | **Inani police outpost** helps file the GD; a formal case goes to **Ukhia police station** (official page, Aug 2026) | ✅ procedure + Ukhia OC number; ⚠️ the outpost has no published number, so the fallback is Ukhia police station |
| Lost at sea or on the beach edge | **BCG Station Inani 01769442310**, Coast Guard 16111 | ✅ |
| Local help | Jaliapalong UP chairman | ✅ (the 12 members' numbers are not published, so they show as "not published") |
| Online GD | `gd.police.gov.bd` | ⚠️ only reported by news; **verify from Bangladesh** before adding |

The app's **"Report a lost/stolen item"** helper builds a GD-ready text: date, time, place, item, serial number, photos.

---

## 6. GitHub workflow (beginner-safe)

1. **Issue** for every task and every data gap (labels: `frontend`, `backend`, `data`, `data-gap`, `docs`, `bug`).
2. **Branch:** `docs/<issue>-short-name`, `data/<issue>-…`, `feature/<issue>-…`, `fix/<issue>-…` (`<issue>` = the GitHub issue number).
3. **Small commits:** one change per commit, message starting with a verb ("Add Ukhia village police records").
4. **Pull request** with `Closes #<issue>`. The **other person reviews**. GitHub Actions must pass (validator).
5. **Merge, delete the branch, pull `main`.**
6. **Both people commit on most days.** Tasmin commits from her own Windows account, so her work is credited to **tasmintoshi**.

## 7. Claude Code agents (`.claude/agents/`)

| Agent | Job |
|---|---|
| `project-manager` | Reads issues, plans the day, keeps both people's work balanced |
| `developer` | Writes code in small steps that follow this plan, and explains each change |
| `tester` | Tests phone and desktop sizes, both languages and themes, offline mode, and the SOS and journey flows; reviews PRs |
| `source-researcher` | Finds official pages for data gaps. Never invents numbers |
| `data-checker` | Runs `validate_data.py`; finds stale, duplicate and missing records |
| `bangla-reviewer` | Natural, short Bangla and English text; fixes garbled official names |

## 8. Definition of done (showcase)

- [ ] Both scenarios above can be demoed live on a phone, including with **airplane mode on** (offline mode + SMS)
- [ ] Search, area picker, GPS, SOS, Safe Journey, siren, fake call, Bangla/English, dark/light all work
- [ ] Every card shows its source and check date; unpublished numbers are labelled and a fallback is shown
- [ ] The validator passes in GitHub Actions; the site is live on GitHub Pages
- [ ] 40-record human spot-check done (`spot_check_40.csv`)
- [ ] Both members have regular commits, PRs and reviews
