# SafeConnect

**Everyday local help for Bangladesh: find what you need nearby, call a vehicle or a helper and see each other on a
live map with a fair bill, report local problems, and reach the right official numbers in an emergency. Bangla first,
works on cheap phones, the emergency part works offline.**

🌐 **Live site:** https://jerin101.github.io/safe-connect/ (everything below is on the live site)

> B1 Capstone Project · Team: Israt Jerin (lead: planning, data and backend) and Tasmin Toshi (frontend and testing)
> Documents: SRS (coming, in `docs/srs/`) · [Journal](JOURNAL.md) · [Project brief](docs/PROJECT_BRIEF.md) ·
> [From demo to the real site: the plan](docs/plans/DEMO_TO_REAL_PLAN.md) · Notion: _(add link)_

## The problem
Bangladesh has official help (999, police, UNO, health complexes, union parishads) and local services (CNG, ambulance,
pharmacy, mechanic), but finding the right one *for where you are* is hard, and booking a local service has no
tracking or fair bill. SafeConnect puts both in one Bangla web app.

## Features (as in the SRS)
| SRS | What a person can do | Where on the site |
|---|---|---|
| FR01, FR02 | Register with name, email and password (or Google); Profile & Settings: name, language saved to the account, light/dark theme remembered | সাইন ইন tab, `#/account` |
| FR03 | Search with everyday words in Bangla, Banglish or English ("osudher dokan", "teler pump") | the search box, `#/c` |
| FR04 | Nearby places in all 64 districts, 12 categories, approximate road distance, the nearest in green; the map loads only when tapped | Home, `#/c/<category>` |
| FR05 | **এখন কেমন?** People say "open / closed / fuel available / shelter open"; older than 6 hours shown as Outdated | every place page |
| FR06, FR08 | The 19 national helplines by need; the Government Directory of the area by role (police station, UNO, health complex, fire service, union council, village police), each with its official source | জরুরি সাহায্য, `#/numbers` |
| FR07 | SOS: big 999, situations (danger, followed, accident, medical emergency, lost, harassment with 109), "what to do now", SMS to the family with the location (or the area when there is none) | জরুরি সাহায্য (`#/sos`) |
| FR09–FR11 | Live location sharing for 15 min / 1 h / 8 h; **Safe Commute** (number plate, vehicle, destination); the family follows on a map at `#/track/<id>` (battery, speed, time left); "I have reached safely" ends it at once | `#/live` |
| FR12, FR14 | **সেবা ডাকুন**: CNG, easybike, rickshaw, bike, ambulance, van/pickup, repair person, volunteer / blood, buy and bring, collect an order, towing; fare estimate from the district's rate; both sides on a live map; bill, cash, receipt, rating; "never stranded" help when nobody is online; show the ride to the family live | `#/dakun` |
| FR13 | Provider panel: apply, go online, take calls, the bill, earnings | সেবা দিন (`#/provide`) |
| FR15 | Report a wrong number or detail, or ask to add a missing place, in any district | place pages, area pages |
| FR16 | Admin: approve or reject providers, fare rates per district, delete expired live shares, users and roles, reports, audit log | সেবা দিন, `#/account` |

The emergency part (999, the area's numbers, helplines, SOS message) works with no internet.

## How it works (system design in short)
- **Frontend:** static HTML, CSS and JavaScript modules, no framework, no build step; GitHub Pages; service worker for offline.
- **Backend:** Firebase Authentication + Cloud Firestore (free Spark plan). There is no server code: the **Firestore
  security rules** ([`firestore.rules`](firestore.rules)) decide who may read or write what, in which order, how often,
  and that a bill matches the rates.
- **Live sharing:** `live_shares/{id}` with a long random id (only people with the link can read it), at most 8 hours, deleted at once when the person arrives.
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
python -m http.server 8000      # then open http://localhost:8000/
```

## Tests
- `npm ci` then `npm run test:rules`: 154 Firestore security-rule tests in the emulator (required on every pull request).
- `node --test tests/bipod-test.mjs tests/partial-load-test.mjs tests/category-words-test.mjs tests/pwa-test.mjs`
  (SMS, data loading, everyday-word search, installable offline app).
- `python tools/validate_data.py data` (data validator, incl. district/upazila slugs) and `python -m unittest discover -s tests/places_data`.
- Chrome-based page tests: `tests/routes-test.mjs`, `tests/near-test.mjs`, `tests/dakun-test.mjs`, `tests/autoloc-test.mjs`,
  and the width check `tests/width-sweep.mjs` (320–1440 px, Bangla/English, light/dark). See [`tests/README.md`](tests/README.md).

## Team and contributions
| Member | GitHub | Role | Main contributions |
|---|---|---|---|
| Israt Jerin | [@jerin101](https://github.com/jerin101) | Lead: planning, data, backend, Firebase/Firestore, reviews and merges | Plans and system design (#64, #187, #240); data pipeline and places for 64 districts (#217, #220, #224); official fuel lists (#227, #232); Firestore rules and ডাকুন (#236, #243, #250); map and design (#244, #246) |
| Tasmin Toshi | [@tasmintoshi](https://github.com/tasmintoshi) | Frontend, testing, UI/UX | Reviewed and merged #166, #187, #240 and #250; the frontend pull requests of the real site from her account: home and tabs, categories, ডাকুন, সেবা দিন, জরুরি সাহায্য (#269–#296), and the SRS pull requests PR-1 to PR-8 (#287–#296); testing; SRS diagrams |

Day-by-day work: [`JOURNAL.md`](JOURNAL.md).

## Tools and AI use
Code was written with the help of AI coding assistants (Claude Code, Claude). Every change went through a pull request
with automated tests (security rules, data, contrast, width checks) and review (AI reviewer agents for testing,
Bangla text and security, and a team member), and was merged by a team member. The SRS document was written by the team
without AI.

## License
Code: MIT ([`LICENSE`](LICENSE)). Places data © OpenStreetMap contributors (ODbL). Official numbers: public `*.gov.bd` pages, linked per record.
