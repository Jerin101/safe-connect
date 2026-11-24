# SafeConnect

**Everyday local help for Bangladesh: find what you need nearby, call a vehicle or a helper and see each other on a live map with a fair bill, report local problems, and reach the right official numbers in an emergency. Bangla first, works on cheap phones, the emergency part works offline.**

🌐 **Live site:** https://jerin101.github.io/safe-connect/ (everything below is on the live site)

> B1 Capstone Project · Team: Israt Jerin (lead: planning, data and backend) and Tasmin Toshi (frontend and testing)  
> Documents: [SRS Specification (PDF)](docs/srs/SafeConnect_SRS.pdf) ([SRS Markdown](docs/srs/SafeConnect_SRS.md) · [Screenshots](docs/srs/screenshots/README.md)) · [Development Journal](JOURNAL.md) · [Project Brief](docs/PROJECT_BRIEF.md) · [From Demo to the Real Site: The Plan](docs/plans/DEMO_TO_REAL_PLAN.md) · [Notion Workspace](https://app.notion.com/p/421039f69acf80cd9fc5c42e309e6fdf?v=93206128c6504033a32d3dfc1d983eab&source=copy_link)

---

## 1. Problem Statement & Target Users

### The Problem
Every day, people across Bangladesh travel on rickshaws, CNGs, easybikes, and local buses, face road accidents, medical emergencies, harassment, and natural disasters, and need quick access to reliable local help. Existing ride-sharing apps (such as Uber and Pathao) only protect rides booked inside their own apps and mainly serve large metropolitan areas. Meanwhile, emergency numbers, local government contacts, and nearby facility details remain scattered and unavailable without mobile data.

SafeConnect bridges this gap by providing an all-in-one crisis response, live travel safety, and hyper-local service platform tailored for all 64 districts of Bangladesh.

### Target Users & Primary Roles
As specified in our Software Requirements Specification (SRS User Profiles 01–06):

- **General Citizen / Help Seeker (Guest User):** Any visitor without an account. Can access emergency dialing (999), 19 national helplines, grassroots government directory, nearby facilities, situation-based offline SOS SMS, and view shared family tracking links without login barriers.
- **Verified User (Rider / Commuter):** Logged-in citizen with verified email. Can start dynamic live location sharing sessions, log Safe Commute vehicle trips, request on-demand "Dakun" rides/services, post community facility status (*এখন কেমন?*), and submit error reports.
- **Family Member / Trusted Contact:** Receives unguessable live tracking links (`#/track/<shareId>`) or offline SOS SMS coordinates; monitors real-time trip progress, vehicle number plate, battery level, and safe arrival on Leaflet maps without needing an account or app installation.
- **Local Service Provider (Driver / Technician / Partner):** Verified local driver (CNG, easybike, rickshaw, ambulance, van) or local technician (mechanic, electrician, helper) who self-onboards, receives Admin approval, toggles availability (Online/Offline), accepts nearby requests, and gets fair automated fares.
- **System Admin:** Team members who verify and approve/reject provider applications, configure per-district fare rates, resolve reported numbers, delete expired live sessions, and maintain system integrity via an immutable audit log.
- **Emergency & Local Government Services:** National helplines (999, 109, etc.) and district/upazila/union offices (Thana, UNO, Hospital, Fire Service, Village Police) whose verified contact numbers are published and source-linked.

---

## 2. Functional Requirements (`FR01`–`FR16`)

The table below maps each Functional Requirement from our finalized SRS to what a person can do and its exact route on the live site:

| SRS ID | Functional Requirement | What a Person Can Do | Route / Location |
|---|---|---|---|
| **FR01** | User Registration & Login | Register with name, email, and password via Firebase Auth, verify email to unlock live safety and service features, or continue as guest for emergency services. | সাইন ইন tab, `#/account` |
| **FR02** | Profile & Preferences | Manage profile display name (stored in `users/{uid}`), switch between Bangla (default) and English, and toggle high-contrast Light/Dark theme. | `#/account` |
| **FR03** | Area Selection & Smart Search | Select any of the 64 districts and 471+ upazilas manually or via one-tap GPS; search using Bangla, phonetic Banglish ("osudher dokan", "teler pump"), and colloquial aliases (`aliases.json`). | Search bar, `#/c` |
| **FR04** | Nearby Facilities & Interactive Map | Browse facilities across 12 categories (Hospital, Pharmacy, Police/Fire, Fuel, Bank/ATM, etc.) sorted by approximate road distance (straight-line × 1.3); interactive Leaflet/OpenStreetMap loads on demand with closest place in green. | Home, `#/c/<category>` |
| **FR05** | Community Status Updates | Verified users post real-time crowd-sourced facility status (*এখন কেমন?* — Open, Closed, Fuel Available, Shelter Open; 30-min cooldown); updates older than 6 hours are marked Outdated. | Place detail pages |
| **FR06** | Sticky 999 Dialer & Helplines | Persistent one-tap `tel:999` dialer button visible on every screen; instant access to 19 national helplines categorized by need, fully cached for offline use. | Top Header, `#/numbers` |
| **FR07** | Situation-Based Offline SOS SMS | Select situation (Danger, Followed, Accident, Medical Emergency, Lost, Harassment 109); auto-generates compact Bangla/English SMS with area, local Thana number, and `#/help/<lat>,<lon>,<time>` link into native SMS app without mobile data. | জরুরি সাহায্য, `#/sos` |
| **FR08** | Verified Grassroots Government Directory | Browse verified, source-linked contacts for Thana, UNO, Hospital, Fire Service, Union Parishad Chairman/Members, and Village Police; unverified numbers are never shown. | `#/numbers` |
| **FR09** | Dynamic Live Location Sharing | Verified users start 15-minute, 1-hour, or 8-hour live tracking sessions with unguessable `#/track/<shareId>` link; updates coordinates, speed, heading, and battery every 5–10s; deleted immediately upon safe arrival or expiration. | `#/live` |
| **FR10** | Safe Commute (Transport Log) | Log vehicle type (rickshaw, easybike, CNG, bus), number plate, and destination before boarding non-app vehicles; attaches directly to the active live tracking session. | `#/live` |
| **FR11** | Zero-Login Family Tracking View | Family members follow real-time marker on Leaflet map, vehicle details, battery percentage (with low battery warning <10%), and freshness timestamp without app installation or login. | `#/track/<shareId>` |
| **FR12** | "Dakun" Local Ride & Service Request | Request 8+ local service types (Easybike/Auto, Rickshaw, CNG, Bike, Ambulance, Van/Pickup, Mechanic/Electrician, Volunteer/Blood Help, Buy/Deliver Goods, Towing); shows live map on both sides; fallback to verified local stands when no provider is online. | `#/dakun` |
| **FR13** | Provider Self-Onboarding & Availability | Verified users apply to become service partners; once approved by Admin, toggle Online/Offline (stores no GPS coordinates when idle), view and accept district requests, and share live trip location. | সেবা দিন, `#/provide` |
| **FR14** | Fair Fare, Receipt & Rating | Automated fair calculation: Base Fare + (Distance × Per-Km) + Waiting Time from Admin-configured district rates, rounded up to nearest 5 BDT; cash payment, digital receipt, and 1–5 star rating. | `#/dakun` |
| **FR15** | Error Reporting | Flag outdated or incorrect contacts (Number Off, Wrong Person, Changed) or request to add missing places in any district; regex prevents phone spam in notes. | Place & area pages |
| **FR16** | Admin Management & Audit Log | Admin dashboard to approve/reject provider applications, configure per-district fare rates, resolve error reports, and clean expired shares; every action enforced with simultaneous immutable audit entry (`audit/{id}`). | সেবা দিন (`#/provide`), `#/account` |

> **Offline-First Emergency Capability:** The core emergency suite — sticky 999 dialer, 19 national helplines, cached grassroots government directory, and situation-based SOS SMS generation — operates completely offline without internet or mobile data once loaded.

---

## 3. Non-Functional Requirements (NFRs)

Key NFRs defined in `docs/srs/` (NFR01–NFR09) and implemented across the architecture:

- **Offline Reliability (`NFR01`):** Service Worker precaches all core HTML/CSS/JS assets, fonts, icons, and static JSON data (`contacts_<district>.json`, `aliases.json`, etc.) so emergency calling, directory browsing, and SOS SMS compose with zero mobile data.
- **Performance & Low-End Device Support (`NFR04`, `NFR06`, `NFR07`):** Built with zero-framework vanilla ES Modules (no heavy bundle), lightweight payload, lazy-loaded Leaflet maps (loaded only on demand), and lazy-loaded Firebase SDK (loaded only when interacting with auth/database). Operates within Firebase Spark free tier (50k reads / 20k writes per day) with listeners active only during live rides/tracking. Real-time location updates reach tracking views every 5–10 seconds.
- **Privacy & Security (`NFR02`, `NFR03`, `NFR08`):** Strict Privacy by Design. GPS coordinates are never uploaded passively. Stored pickup and drop-off coordinates are rounded to ~100m to protect private residences. Online provider status (`online/{uid}`) stores zero GPS coordinates. Live share documents (`live_shares/`) and trip coordinates (`rides/{id}/live/`) are ephemeral and destroyed upon arrival or expiration. Server-side security rules ([`firestore.rules`](firestore.rules)) enforce all permissions, daily limits (max 10 rides/day, 60s cooldown, 30m status cooldown), fare rate bounds, and require immutable append-only audit logging (`audit/{id}`). Backed by 154 automated security rule tests.
- **Accessibility & Localization (`NFR05`, `NFR06`):** Bangla-first UI with full English toggle across all views, including dual-language emergency SMS templates. Smart search supports phonetic Banglish, English, and local colloquial aliases (`aliases.json`). Responsive design tested and verified from 320px mobile screens to 1440px desktop displays, featuring high-contrast Light and Dark themes.
- **Installability & Portability (`NFR09`):** Progressive Web App (PWA) with installable web manifest, standard 192px/512px icons, and responsive layouts running directly in standard mobile (Android/iOS) and desktop browsers without requiring app store downloads.

---

## 4. System Architecture & Data Pipeline

- **Frontend:** Static HTML5, CSS3, and JavaScript ES modules, zero framework, no build step; hosted on GitHub Pages; Service Worker for offline resilience.
- **Backend:** Firebase Authentication (email/password with verification + Google sign-in) and Cloud Firestore on the free Spark tier. There is no custom backend server: **Firestore Security Rules** ([`firestore.rules`](firestore.rules)) strictly enforce authentication, role permissions, rate limits, schema validation, and fair fare calculations.
- **Live Sharing Lifecycle:** Ephemeral `live_shares/{shareId}` documents generated with 24–40 character unguessable IDs (listing is strictly denied). Coordinates, speed, heading, and battery level update every 5–10s (`watchPosition`). Low battery (<10%) flags an alert. Tapping "I Have Reached Safely" or expiration (15m, 1h, 8h) immediately deletes the document.
- **Ride State Machine:**
  ```text
  requested ──> accepted ──> arrived ──> on_trip ──> completed ──> paid (or cancelled)
  ```
  Live coordinates exist only between accepted provider and rider, and are wiped when the trip finishes.
- **Data Pipeline & Sources:**
  - **Official Government Contacts:** Harvested directly from official `*.gov.bd` district and national portals (pilot: Noakhali and Cox's Bazar).
  - **Nearby Places:** Extracted from OpenStreetMap (ODbL license) covering all 64 districts across 12 categories.
  - **Fuel Stations:** Official lists from Padma Oil Company Limited and Meghna Petroleum Limited (over 1,700 verified stations).
  - **Administrative Centers:** 471+ upazila centroids for instant distance calculation.
- **System Design Diagrams & Models (in `docs/srs/`):**
  - **Use Case Architecture:** [Use Case Diagram](docs/srs/SafeConnect_SRS.pdf#page=34) & 17 detailed Use Case Descriptions (pages 35–46)
  - **Activity Diagrams:** 18 Activity Diagrams covering each functional flow (pages 47–64)
  - **Sequence Diagrams:** 17 Sequence Diagrams showing component interactions and Firestore calls (pages 65–81)
  - **Domain & Database Models:** [Class Diagram](docs/srs/SafeConnect_SRS.pdf#page=82) and [Entity-Relationship Diagram](docs/srs/SafeConnect_SRS.pdf#page=83)
  - **Verified UI & User Manual:** [User Manual & Screenshots](docs/srs/screenshots/README.md) (pages 84–85)

---

## 5. Coverage Status (Honest Assessment)

| Level | Status |
|---|---|
| The app, map, search, nearby places | All 64 districts (places are sparse in rural areas: OpenStreetMap) |
| National helplines | Complete (19 verified national services) |
| Official district and upazila numbers | Noakhali and Cox's Bazar complete; others in progress |
| Union-level numbers | Noakhali and Cox's Bazar complete |
| ডাকুন (On-demand services) | Fully functional in all districts; tested with team accounts (commercial driver network pending pilot launch) |

---

## 6. Local Setup & Automated Testing

### Run Locally
```bash
git clone https://github.com/Jerin101/safe-connect.git
cd safe-connect
python -m http.server 8000 -d src   # then open http://localhost:8000/
```
Or with Docker:
```bash
cp .env.example .env
docker compose up --build          # then open http://localhost:8080/
```

### Folder Structure
```text
src/        the website: index.html, js/, css/, data/, fonts/, icons/, demo/, manifest.json, service-worker.js
tools/      Python scripts that collect and check the data (standard library only)
tests/      all tests (rules, data, search, PWA, browser checks)
docs/       plans, reports, design drafts (docs/design/), and finalized SRS (docs/srs/)
.github/    CI workflows, issue and PR templates
project_management/  journal and Git contribution tracker
```

### Automated Testing Suite
- **154 Firestore Security Rule Tests:** `npm ci` then `npm run test:rules` runs all 154 Firestore security-rule tests in the Firebase Emulator (verifying role permissions, rate limits, fare bounds, live share privacy, and audit logging; required on every PR).
- **Node.js Core Unit Tests:** `node --test tests/bipod-test.mjs tests/partial-load-test.mjs tests/category-words-test.mjs tests/pwa-test.mjs` (validates SMS generation, fallback resilience, phonetic/category keywords, and PWA manifest/service worker integrity).
- **Python Data Integrity Validators:** `python tools/validate_data.py src/data` (enforces district/upazila slugs against `areas_bangladesh.json`, validates phone formats, and source links) and `python -m unittest discover -s tests/places_data`.
- **Chrome UI & Width-Sweep Tests:** `tests/routes-test.mjs`, `tests/near-test.mjs`, `tests/dakun-test.mjs`, `tests/autoloc-test.mjs`, and the exhaustive width-sweep `tests/width-sweep.mjs` (testing 12 pages across 320px–1440px viewport widths, light/dark themes, Bangla/English localization, and 130% font scale). See [`tests/README.md`](tests/README.md).

---

## 7. Team, Workflow & License

### Team and Contributions
| Member | GitHub | Role | Main Contributions |
|---|---|---|---|
| Israt Jerin | [@jerin101](https://github.com/jerin101) | Lead: planning, data, backend, Firebase/Firestore, reviews and merges | Plans and system design (#64, #187, #240); data pipeline and places for 64 districts (#217, #220, #224); official fuel lists (#227, #232); Firestore rules and ডাকুন (#236, #243, #250); map and design (#244, #246) |
| Tasmin Toshi | [@tasmintoshi](https://github.com/tasmintoshi) | Frontend, testing, UI/UX | Reviewed and merged #166, #187, #240 and #250; frontend pull requests of the real site: home and tabs, categories, ডাকুন, সেবা দিন, জরুরি সাহায্য (#269–#296); SRS pull requests PR-1 to PR-8 (#287–#296); testing reports; SRS diagrams and user manual |

- **Day-by-day work log:** [`JOURNAL.md`](JOURNAL.md)
- **Shared Workspace:** [Notion Workspace](https://app.notion.com/p/421039f69acf80cd9fc5c42e309e6fdf?v=93206128c6504033a32d3dfc1d983eab&source=copy_link)

### Tools and AI Use
Code was written with the help of AI coding assistants (Claude Code, Claude). Every change went through a pull request with automated tests (security rules, data, contrast, width checks) and review (AI reviewer agents for testing, Bangla text, and security, alongside team member review), and was merged by a team member. The SRS document was written by the team without AI.

### License
Code: MIT ([`LICENSE`](LICENSE)). Places data © OpenStreetMap contributors (ODbL). Official numbers: public `*.gov.bd` pages, linked per record.
