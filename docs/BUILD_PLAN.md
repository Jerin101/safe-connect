# SafeConnect – Build Plan (data · technology · workflow)

Team: **jerin101** (lead: backend, data, GitHub) · **tasmintoshi** (frontend, UI) · Deadline: 2 weeks · Budget: 0

This file is the single source of truth. It becomes the project's `CLAUDE.md`, so every Claude agent follows it too.

---

## 1. Technology (final)

| Part | Choice | Why | Cost |
|---|---|---|---|
| Pages | HTML + CSS + plain JavaScript (ES modules), no framework, no build step | Easy to learn and to explain in a viva | Free |
| Data | JSON files in `data/` | Simple, versioned in Git, works offline | Free |
| Hosting | GitHub Pages (HTTPS) | Free; HTTPS is required for GPS, camera and offline mode | Free |
| Offline app (**top priority**) | `manifest.json` + `service-worker.js` (PWA) caching all pages and `data/` files | Works with no internet after the first visit; installable on the home screen. See §9 | Free |
| Fonts | Hind Siliguri (Google Fonts), cached by the service worker | Bangla + English in one font | Free |
| Calling | `tel:` links | One tap to call | Free |
| SOS sharing | Web Share API, `sms:` links, `https://wa.me/?text=` | Works on Android and iPhone; SMS works without internet | Free |
| Location | Browser Geolocation API + `data/locations.json`: official BBS upazila boundaries (via OCHA HDX, CC BY-IGO, credited on the page) and union/town centre points | GPS and the upazila/union lookup both work **offline**; no request leaves the phone | Free |
| Plate photo | `<input type="file" accept="image/*" capture="environment">`, then share | Safe Journey feature | Free |
| Siren | Web Audio API (sound generated in code) | No audio files or licences needed | Free |
| On-device storage | `localStorage` (settings, family contacts, saved areas) | Nothing sent to a server without login | Free |
| Login + backend (Should) | Firebase Authentication (Google + email) + Firestore, free **Spark** plan, loaded from Google's CDN. No Cloud Functions, no file storage | Synced contacts, wrong-number reports, admin page, volunteer service. See §10 | Free (no card) |
| Data tools (backend) | Python 3 standard library only: `tools/` | Collect → build → validate | Free |
| Automation | GitHub Actions: run `validate_data.py` on every PR; deploy Pages on merge | Bad data cannot reach the site | Free (public repo) |
| Editor | VS Code + Live Server + GitHub Pull Requests + Claude Code extensions | | Free / your Claude plan |

---

## 2. Folder structure

```
safeconnect/
├── index.html              ← home: 999, SOS, search, area picker
├── pages/                  ← sos.html, journey.html, guides.html, area.html, account.html, admin.html, volunteer.html, confirm.html
├── css/                    ← base.css (tokens: dark/light), components.css
├── js/
│   ├── app.js              ← start-up, routing, settings
│   ├── data.js             ← loads and caches JSON, search index
│   ├── area.js             ← area picker + GPS lookup
│   ├── contacts.js         ← cards, ordering, fallbacks
│   ├── sos.js  journey.js  siren.js
│   ├── i18n.js + lang/bn.json, lang/en.json
│   └── firebase.js         ← login, reports (Should)
├── data/                   ← national_hotlines.json, areas_bangladesh.json, contacts_*.json, manual_additions.json
├── tools/                  ← collectors, build, validate (Python)
├── docs/                   ← DATA_POLICY.md, DATA_REPORT.md, FEATURES.md, BUILD_PLAN.md
├── .claude/agents/         ← 6 agents
├── .github/                ← workflows/validate.yml, workflows/pages.yml, issue + PR templates
├── manifest.json  service-worker.js  CLAUDE.md  README.md  CONTRIBUTING.md
└── .gitignore              ← *_raw.json, __pycache__/
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
| `locations.json` | 36 KB | Cached for offline; used by "Find help near me" |

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

### A. Cox's Bazar – a tourist loses a drone camera at Inani beach (or it's stolen)

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

### B. Noakhali – at night a woman is attacked in a village ("Babunagar")

Open SafeConnect → big **999** button → **Silent SOS** sends her location to family → the area page shows:

| Order | Contact | In our data? |
|---|---|---|
| 1 | 999 | ✅ |
| 2 | Police station OC / duty officer for her upazila | ✅ all 9 Noakhali upazilas have police station numbers |
| 3 | **Village police of her ward** | ✅ for 76 of 160 unions (337 in Noakhali) |
| 4 | Ward member, chairman | ✅ 143 chairmen + 15 administrators across both districts |
| 5 | 109 (violence against women and children), 1098 (if she is a child) | ✅ |
| Later | Upazila women affairs officer, legal aid 16699, UNO | ✅ |

**"Babunagar" doesn't exist in any official list** we can reach: the area list, union sites and OpenStreetMap (its "Babunagar" matches are all in Chattogram district). It's probably a village or para name, and villages aren't in the government list. So the site uses GPS or the union picker. Once we know its union, its chairman and village police are already in the data.

---

## 6. GitHub workflow (beginner-safe)

1. **Issue** for every task and every data gap (labels: `frontend`, `backend`, `data`, `data-gap`, `docs`, `bug`).
2. **Branch:** `feature/<issue>-short-name`, `data/<issue>-…`, `fix/<issue>-…`.
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
- [ ] Search, area picker, "Find help near me", SOS, Safe Journey, siren, Bangla/English, dark/light all work (offline list in §9)
- [ ] Every card shows its source and check date; unpublished numbers are labelled and a fallback is shown
- [ ] The validator passes in GitHub Actions; the site is live on GitHub Pages
- [ ] 40-record human spot-check done (`spot_check_40.csv`)
- [ ] Both members have regular commits, PRs and reviews

---

## 9. Offline first (top priority)

| Works with **no internet** (after the first visit) | Waits for internet |
|---|---|
| All contacts and search · Bangla/English · "Find help near me" (GPS + saved boundaries) · tap-to-call · SOS by SMS · siren · Safe Journey photo | Map links · WhatsApp · login sync, reports and the volunteer service |

**"Find help near me" (P26), step by step:**
1. One tap. If the user gave location permission before, it locates straight away.
2. GPS position → which official upazila boundary contains it (`data/locations.json`, 18 upazilas).
3. → the nearest union or town centre point **inside that upazila** (158 union points + 4 town points).
4. Show the coordinates + a map link, so the user can tell 999 or family exactly where they are.
5. If the union is unsure (near a border, or no point), show the **whole upazila** and let the user pick the union.

Location is read only when the user taps (CLAUDE.md rule 5), and the lookup happens on the phone.

## 10. Backend: Firebase Spark + volunteer service

**Cost: 0.** The free **Spark plan has no Cloud Functions** (no server code) and we use **no file storage**. So:
- **Firestore security rules** enforce everything that must be automatic.
- **Admins** (jerin101, tasmintoshi) do everything else by hand from `pages/admin.html`.

### Firestore collections

| Collection | Who can read | Who can write |
|---|---|---|
| `admins` | admins | set up once by hand in the Firebase console |
| `applications` | the applicant + admins | the applicant creates their own; admins update the status |
| `confirmations` | anyone with the exact one-time code (get one document, never list) | admins create; the official answers once (rule below) |
| `verifications` | **admins only** | admins only. Hidden from users |
| `teams` | logged-in users | admins (create teams, set `leader_uid` after the UNO approves the leader) |
| `volunteers` (public list) | everyone | created **only** by an admin or by that team's leader (rule below); the volunteer can switch "Show me" on/off |

### What the security rules enforce
- **One-time code** (`confirmations/{code}`, a long random code): the official can answer **once** (`answer` must still be empty), **before `expires_at`** (7 days after sending), and the update may change **only the `answer` field**.
- **Team-leader approval:** a new `volunteers` document for a team may be created only if the approver is that team's **`leader_uid`** (or an admin).
- **Report this volunteer:** any logged-in user may set **only** `paused: true` (never back to false); only an admin can un-pause.
- Users can read and write only their own `applications`; nobody but admins can read `verifications`.

### Verification flow (hidden from users)
1. A logged-in user applies (name, phone, area, ward, skills, availability). They only see "being checked".
2. The admin page picks the **confirmer automatically from our official data** (`data/contacts_*.json`), never from the applicant:
   - village: ward member → UP chairman/administrator → UP secretary
   - town: municipal executive officer → municipal administrator
   - team leaders only: UNO
3. **Weekly batch per union:** one message per official per week, listing that week's applicants.
4. The admin confirms in one of three ways:
   - **(a)** sends a one-tap link to `pages/confirm.html?c=<code>` via WhatsApp/SMS to the official's **published** number (Yes/No, no login, expires in 7 days)
   - **(b)** a phone call with a short Bangla script
   - **(c)** a প্রত্যয়নপত্র memo number + date, checked with the UP office
5. **Team leaders:** approved by the UNO once. After that, new members of that team only need the team leader's confirmation inside the app, so officials are not disturbed again.
6. Verification **expires after 1 year** or when the chairman changes. Any complaint pauses it.

### What the public sees
Only **approved** volunteers who switched on **"Show me"**, shown **after** the official contacts, with a "Report this volunteer" button. Name, team, area, skills, availability and phone: **never a home address**.
