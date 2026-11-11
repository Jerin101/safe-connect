# SafeConnect: how we build the nationwide system (master build plan)

This brings together COVERAGE_PLAN.md (v2, after the tester review) and VOLUNTEERS_AND_DASHBOARDS.md
into one order of work. Every milestone ends with tests on GitHub, and the live site keeps working after every merge.

**Who does what:**
- **Kit (Claude chat):** prepares the hard parts (data builds, security rules + emulator tests) as tested kits, like P17.
- **Claude Code:** puts kits and UI into the repo, one issue = one branch = one PR; tester agent GO before every merge.
- **Jerin:** console steps, real-phone tests, recruiting volunteers, final release.

---

## Where we are (9 Nov 2026)

Phase 1 (Noakhali + Cox's Bazar) is live at https://jerin101.github.io/safe-connect/ (site at `index.html`):
UI clarity pass, security audit (all findings fixed), বিপদ বার্তা, saved area, phone layout, smart search parts 1–4 and the phone-SOS prepare page.
Still to merge for Phase 1: smart search part 5 (landmarks, #158) and part 6 (nothing matches + missing-place requests, #160), then the rules deploy and the automatic VERSION deploy.

---

## Architecture for 64 districts (target)

```
Every phone, saved on first visit (offline everywhere):
  Layer 1  data/national_hotlines.json          999, hotlines, Coast Guard, Navy, Tourist Police
  Layer 2  data/geo/bangladesh.json             simplified boundaries: 507 upazilas + 12 cities,
                                                sea zone, override areas (Bhasan Char, Azimpur, Urir Char)   < 2 MB
  Layer 3  data/core_numbers.json               per upazila/city: UNO or city, police station(s),
                                                health complex or hospital, nearest fire station            ~300–500 KB
Downloaded when needed (and kept for offline after that):
  Layer 4  data/districts/<district>.json       unions/wards: chairmen, members, village police, villages
Master list (used by tools and tests, not by phones):
  data/master_areas.json                        8 / 64 / 507 / unions + wards; BBS codes + portal names + fixes
Accounts and volunteers (Firestore, rules + tests):
  users, admins, family, places, reports, audit (live today) + volunteers, proposals, activity (Milestone 4)
```

How the site finds the area (`js/locate.js`):
1. override areas
2. inside an upazila/city boundary
3. near a boundary (within about 3 km) → show both
4. in Bangladesh's sea → nearest coastal upazila + Coast Guard + Navy
5. otherwise → "outside Bangladesh" + national numbers

All of this runs on the phone, offline.

---

## Milestones

### M0: Finish Phase 1
#158 → #160 → rules deploy → VERSION/deploy fix → repo cleanup (queue v3 step 7).
**Done when:** each PR merged with tester GO; the live site serves the new version.

### M1: Nationwide foundation (kits + Claude Code)
| Step | Work | Tests (done when) |
|---|---|---|
| 1.1 | **Master list** `data/master_areas.json`: BBS base + portal Bangla names + every fix (Khetlal, Kabirhat's unions, the 12 city corporations, renames, Mokamtala → Shibganj, the missing single unions, 1 to 1 code+name matching) | **T1** both ways |
| 1.2 | **Boundaries for phones** `data/geo/bangladesh.json`: simplified, plus the sea zone and override areas | **T2** (0.05° on PRs, 0.002° on release, area check), **T9** size |
| 1.3 | **`js/locate.js`**: the 5 rules above; replaces the current lookup; "আপনার কাছের ইউনিয়ন" from the master union list; wards inside cities | **T5** special places with the expected district/upazila, foreign border towns = outside; **T10** remote/border points, both upazilas near a line |
| 1.4 | **Per-district files + lazy loading**: Noakhali and Cox's Bazar moved to `data/districts/`; the smart search (aliases, thanas, landmarks) reads per-district files too; service worker: layers 1–3 always cached, layer 4 cached when opened | **T6** offline; the site works exactly as before for the 2 districts |

### M2: Core numbers for all 64 districts
| Step | Work | Tests |
|---|---|---|
| 2.1 | Collect **district + upazila core numbers** for all 64 districts (DC, SP, Civil Surgeon, UNO, police stations, health complexes, fire stations) with the existing tools, from official pages only | validator 0 errors; data-checker OK |
| 2.2 | Build **layer 3** `data/core_numbers.json`; city corporations' core numbers (incl. all metropolitan police stations) | **T3** report: share with own numbers, fallbacks counted separately; **T8** 100 random points, airplane mode, layers 1–3 only |
| 2.3 | Weekly source check and validator run for all 64 districts | the GitHub Action is green |

**After M2 the site is truly nationwide:** every corner gets its area name and upazila-level numbers, offline.

### M3: Union data, one division at a time
Chattogram → Dhaka → Khulna → Barishal → Rajshahi → Rangpur → Sylhet → Mymensingh.
For each division:
- unions + pourashavas
- city wards
- special places (Rohingya camps: APBn/RRRC; the Sundarbans: Forest Department; airports, EPZs, rivers, CHT councils)

**Tests per division:** T1, T3, T4 (search, including duplicate names), T5, validator, data-checker, tester GO.

### M4: Union volunteer network
| Step | Work | Tests |
|---|---|---|
| 4.1 | **Rules + emulator tests first** (kit): `volunteers`, `proposals`, `activity`, reports with `unionCode`. Per-union access, the author ≠ the tester, only an admin approves (audited), paused/expired volunteers can do nothing | every rule test in VOLUNTEERS_AND_DASHBOARDS.md Part 4 passes |
| 4.2 | Application (4 steps, 18+) + the local representative's confirm link + the admin assigning the union and role | rule tests + UI check |
| 4.3 | **Union data volunteer dashboard**: health score, this week's tasks, new proposal, my proposals, reports in my union, my activity | tester GO, 360 px, bn/en |
| 4.4 | **Union tester dashboard**: check queue, call check, escalate | tester GO |
| 4.5 | **Admin**: coverage of Bangladesh (division → union), approval queue, volunteers (unions without volunteers), data health | tester GO |
| 4.6 | **Weekly export Action**: approved proposals → PR into `data/` (the service-account key is an encrypted GitHub secret) | validator + tests pass on the export PR |
| 4.7 | User reports also go to that union's tester | rule test |

### M5: Villages, trip plan and polish
- **Villages:** union websites → `data/districts/*` (T7 report per union); BBS lists if available; OpenStreetMap only as a search hint.
- **"ভ্রমণের আগে" + "ভ্রমণ পরিকল্পনা":** save a district offline; send the route, the guide and the return time to the family; a reminder with the police number.
- **Area notes** from official sources (for example visitor rules in remote areas), with a link and a check date.

### M6: Release
P37 full test on real phones (all roles, offline, night/day, bn/en, remote points) → the NEEDS JERIN list
(remove localhost, API key limits, admins, reset email template) → demo script → report with the honest limits → tag **v1.0**.

---

## The course cut-line

**Must be done for the demo:** M0, M1, M2, M3 for the **Chattogram division**, and M4.1–M4.5.
That gives: every corner of Bangladesh covered by location and upazila numbers, offline;
union-level data for one full division; and a working union volunteer + tester + admin system with tested security.

**Can continue after the course:** M3 for the other 7 divisions, M4.6 automation, M5 villages.

---

## The tests that guard "nothing missing" (run on GitHub)

| Test | Guards |
|---|---|
| T1 | every official division, district, upazila, city and union is in the master list, both ways |
| T2 | the map has no holes or overlaps |
| T3 | each area's own numbers vs fallbacks (the gap report) |
| T4 | every name can be found, including duplicates |
| T5 | special places give the **expected** area; foreign towns say "outside" |
| T6 | the offline emergency part works; file size limits |
| T7 | villages per union |
| T8 | 100 random points with only layers 1–3, in airplane mode |
| T9 | layers 1–3 stay small |
| T10 | remote and border points; both upazilas near a boundary |
| Rules | every Firestore permission, including per-union volunteer access |
