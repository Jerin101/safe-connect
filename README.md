# SafeConnect

**Everyday local help for Bangladesh: find what you need nearby, call a vehicle or a helper and see each other on a
live map with a fair bill, report local problems, and reach the right official numbers in an emergency. Bangla first,
works on cheap phones, the emergency part works offline.**

🌐 **Live site:** https://jerin101.github.io/safe-connect/
🧪 **New design with all new features:** https://jerin101.github.io/safe-connect/demo/
🎬 **Presentation mode (two windows, simulated movement):** https://jerin101.github.io/safe-connect/demo/?sim=1

> B1 Capstone Project · Team: Israt Jerin (lead: planning, data and backend) and Tasmin Toshi (frontend and testing)
> Documents: SRS (coming, in `docs/srs/`) · [Journal](JOURNAL.md) · [Project brief](docs/PROJECT_BRIEF.md) ·
> [From demo to the real site: the plan](docs/plans/DEMO_TO_REAL_PLAN.md) · Notion: _(add link)_

## The problem
Bangladesh has official help (999, police, UNO, health complexes, union parishads) and local services (CNG, ambulance,
pharmacy, mechanic), but finding the right one *for where you are* is hard, and booking a local service has no
tracking or fair bill. SafeConnect puts both in one Bangla web app.

## Features
| Area | What a person can do | Where |
|---|---|---|
| Emergency | 999 first; area police, UNO, health complex, fire; SOS SMS with location; works offline | main site + /demo/ |
| কাছে (nearby) | 64 districts; 17 categories (hospital, pharmacy, filling station, shop, bazar, ATM, workshop, transport, police/fire, …); distance from you; the map inside the site, closest place in green; "সবচেয়ে কাছের সাহায্য" | /demo/ |
| ডাকুন (call a service) | CNG, bike, ambulance, technician, helper, and **আনিয়ে দিন** (a rider buys from a shop and brings it); **both sides on a live map**; fare estimate; **bill** (base + km + waiting; for an errand the shop's receipt + delivery), cash, receipt, rating; provider earnings; admin approves providers and sets rates | /demo/ |
| সমস্যা জানান | report a local problem, "আমিও", status from reported to solved (changed by an admin, with an audit entry) | /demo/ |
| নিরাপদে পৌঁছানো | a family link that turns red if you have not arrived in time | /demo/ |
| সেবা | government service guides, 19 national helplines, GD draft for a lost item (police station from the official list) | /demo/ |
| Accounts | Google / email sign-in; user, volunteer, admin; every admin action in an audit log | main site + /demo/ |

The new design and features move from `/demo/` to the main site step by step (A1–A13 in
[the plan](docs/plans/DEMO_TO_REAL_PLAN.md)); A1 (the teal look and the icon set) is done.

## How it works (system design in short)
- **Frontend:** static HTML, CSS and JavaScript modules, no framework, no build step; GitHub Pages; service worker for offline.
- **Backend:** Firebase Authentication + Cloud Firestore (free Spark plan). There is no server code: the **Firestore
  security rules** ([`firestore.rules`](firestore.rules)) decide who may read or write what, in which order, how often,
  and that a bill matches the rates.
- **Ride states:** requested → accepted → arrived → on_trip → completed → paid (or cancelled). Live positions only for
  the two people of a ride, from acceptance to the end of the ride, deleted at the end; stored pickup and destination
  points are rounded to about 100 m; online providers store no position.
- **Data:** official numbers from `*.gov.bd` pages (pilot: Noakhali and Cox's Bazar), places from OpenStreetMap (ODbL,
  64 districts), filling stations from Padma Oil and Meghna Petroleum official lists, 471 upazila centres.

## Coverage (honest)
| Level | Status |
|---|---|
| The app, map, search, nearby places | all 64 districts (places are sparse in rural areas: OpenStreetMap) |
| National helplines | complete |
| Official district and upazila numbers | Noakhali and Cox's Bazar; others in progress |
| Union-level numbers | Noakhali and Cox's Bazar |
| ডাকুন | works in every district; tested with team accounts only (no real drivers yet) |

## Run locally
```
git clone https://github.com/Jerin101/safe-connect.git
cd safe-connect
python -m http.server 8000      # then open http://localhost:8000/  and  http://localhost:8000/demo/
```

## Tests
- `npm ci` then `npm run test:rules`: 155 Firestore security-rule tests in the emulator (required on every pull request).
- `python tools/validate_data.py data` (data validator), `node --test tests/design/contrast-test.mjs` (colour contrast),
  `node --test tests/locations/upazila-shapes-test.mjs`, and the Chrome-based width check `tests/width-sweep.mjs`
  (320–1440 px, Bangla/English, light/dark). See [`tests/README.md`](tests/README.md).

## Team and contributions
| Member | GitHub | Role | Main contributions |
|---|---|---|---|
| Israt Jerin | [@jerin101](https://github.com/jerin101) | Lead: planning, data, backend, Firebase/Firestore, reviews and merges | Plans and system design (#64, #187, #240); data pipeline and places for 64 districts (#217, #220, #224); official fuel lists (#227, #232); Firestore rules and ডাকুন (#236, #243, #250); map and design (#244, #246) |
| Tasmin Toshi | [@tasmintoshi](https://github.com/tasmintoshi) | Frontend, testing, UI/UX | Reviewed and merged #166, #187, #240 and #250. Next: the frontend steps of the plan from A2 on (app shell, pages, ডাকুন and সমস্যা on the main site), testing, SRS diagrams |

Day-by-day work: [`JOURNAL.md`](JOURNAL.md).

## Tools and AI use
Code was written with the help of AI coding assistants (Claude Code, Claude). Every change went through a pull request
with automated tests (security rules, data, contrast, width checks) and review (AI reviewer agents for testing,
Bangla text and security, and a team member), and was merged by a team member. The SRS document was written by the team
without AI.

## License
Code: MIT ([`LICENSE`](LICENSE)). Places data © OpenStreetMap contributors (ODbL). Official numbers: public `*.gov.bd` pages, linked per record.
