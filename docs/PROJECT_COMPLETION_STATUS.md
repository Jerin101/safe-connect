# SafeConnect: project completion status and workstream plan (A–F)

Written by workstream A on 2026-11-27. Base: `origin/main` at `00337e8` (PR #345), service worker `v78-2026-11-27`.
Every line below was checked against the repository or GitHub on that date; anything not checked is marked **unverified**.
Keep this file updated: each workstream adds its result to section 9 (update log) in its own PR.

## 1. What was verified

| Item | Fact | How checked |
|---|---|---|
| `origin/main` | `00337e8`, merge of PR #345 | `git log origin/main` |
| Open pull requests | none | `gh pr list --state open` |
| Open issues | **#346** "M1.1: reconcile the national portal area list with BBS and add T1" (by Jerin101) | `gh issue list` |
| Last merged PRs | #337 v72 bump, #338 repo cleanup, #339 journal, #341 night menu, #342 v73 bump, **#343 M1 approximate nationwide GPS location labels**, **#344 shared GPS point inside SafeConnect**, **#345 SOS location quality and limits** | `gh pr list --state merged` |
| Site version | `v78-2026-11-27` in `src/service-worker.js` on `main` | `git grep` |
| CI workflows | `pages.yml`, `rules-test.yml`, `secret-scan.yml`, `validate.yml`, `weekly-source-check.yml` | `.github/workflows/` |
| CI test coverage | Only data validation, `upazila-shapes-test`, `geo-test`, `location-estimate-test`, `bipod-test`, `node --check preview.js`, contrast test, places unit tests and the Firestore rules suite run in CI. `routes-test`, `near-test`, `dakun-test`, `siren-test`, `reportqueue-test`, `offlinepack-test`, `track-test`, `verify-test`, `autoloc-test`, `pwa-test`, `partial-load-test`, `width-sweep` and the phonetic/must-find tests are **run by hand only** | `validate.yml`, `rules-test.yml` |
| Worktrees | `E:\Projects\safe-connect` (main), `…\safe-connect-release` (detached `89f9d2f`), `…\safe-connect-ui` (branch `fix/346-live-link-map-accuracy`), `…\safe-connect-wsA` (this plan) | `git worktree list` |
| Local-only commits | `fix/346-live-link-map-accuracy` `729396e` (live share fixes, **not pushed**); `fix/343-prev-tests` (2 commits, **not pushed**) | `git rev-list origin/main..<branch>` |
| Untracked files | `journal.csv` in `E:\Projects\safe-connect` | `git status` |
| Remote branches not merged | `Jerin101-patch-1`, `chore/pages-version`, `feature/134-bipod-barta`, `feature/257-a2-app-shell`, `feature/53-offline-app`, `fix/phone-location-live-share-and-structure`, `tasmintoshi-patch-1` | `git branch -r --no-merged` |

### Name collisions to fix before pushing
- The local branch `fix/346-live-link-map-accuracy` uses number 346, but **#346 is the M1.1 issue**. It needs its own issue (next free number) and the branch must be renamed (`git branch -m`) before it is pushed.
- The local branch `fix/343-prev-tests` uses number 343, but **#343 is a merged PR**. Same fix: new issue, rename, then push.
- `docs/347-project-completion-plan` (this document) assumes issue **#347** is created for it. Create the issue first, or rename the branch.

## 2. Done on `main` (verified in code and PRs; real-phone results are still **unverified**)

- SOS: six-decimal coordinates, "preview locations are not real" warning, confirmation before sharing a coarse fix, best-fix acquisition (`locateBest`, target 25 m, 20 s), shared GPS point shown inside SafeConnect, accuracy limits in Bangla and English (#344, #345).
- Nationwide approximate label "near the centre of X upazila, Y district" from 471 upazila centres (#343, `nearestUpazilaCentre` in `src/js/location.js`).
- Night mode and bigger text reachable on phones (#341).
- Offline emergency pack, SOS texts in the pack, offline vote queue, siren, silent SOS, safe-arrival check, readiness check (earlier PRs).
- Data: 64-district area list, OpenStreetMap places for 64 districts, official fuel lists for 64 districts, 19 national helplines, official numbers for **Noakhali and Cox's Bazar only**.

## 3. Unfinished work (the real list)

| ID | Work | Source of the requirement | Workstream |
|---|---|---|---|
| U1 | Push and merge the live-share fixes (clock, serialized sends, map retry, GPS fix, accuracy on the sharer's page) | local commit `729396e`; user report 2026-11-27 | C |
| U2 | Accuracy shown to the family (needs an `accuracy` field in `firestore.rules`, rules deploy by Jerin) | user report | C |
| U3 | `prev` rule tests and comment fix; brief says 158 tests | local `fix/343-prev-tests` | C |
| U4 | Family live map: place name, last-updated warning, "not live" state, nearby help | user report | C (+ B interface) |
| U5 | SOS: real-phone test of v78, SOS snapshot and consent review, remaining gaps found by that test | user phone test pending | B |
| U6 | M1.1 master area list and T1 tests | issue #346, `docs/plans/nationwide/BUILD_PLAN_NATIONWIDE.md` M1 step 1.1 | D |
| U7 | M1.2 boundaries for phones (`data/geo/bangladesh.json`, T2, T9) | same plan, step 1.2 | D |
| U8 | M1.3 `js/locate.js` (point-in-area, border, sea, outside), T5 and T10 | same plan, step 1.3 | D (wiring after B) |
| U9 | M1.4 per-district files, lazy loading, offline layers, T6 | same plan, step 1.4 | D |
| U10 | M2 core numbers for all 64 districts, `data/core_numbers.json`, T3, T8 | same plan, M2 | E |
| U11 | M3 union data, one division at a time (Chattogram first) | same plan, M3 | E |
| U12 | M4 union volunteer network (rules first) | same plan, M4. **Conflicts with the current release scope** (volunteer role was left out in `docs/PLAN_STATUS.md`); needs an owner decision | E, after C, **blocked** |
| U13 | M5 villages, trip plan, area notes | same plan, M5 | E (late) |
| U14 | M6 release: real-phone test, "NEEDS JERIN" list, demo script, v1.0 tag | same plan, M6 | F |
| U15 | Put the hand-run tests into CI; README and docs refresh; use case and Firestore ER diagrams; coverage and test reports; 10–12 slide presentation | user request | F |
| U16 | Human-only items: deploy `firestore.rules`, Pages source "GitHub Actions", review of 7 old remote branches, delete merged remote branch `toshi` | earlier checks | Jerin / Tasmin |

**M7 and M8 are not defined in any file of the repository** (the plan ends at M6). Nobody may invent them. If the owner wants M7/M8, write the definition first.

## 4. Exclusive file ownership

One owner per file. A workstream may **read** any file. It may **change** only files it owns, plus the shared-file exceptions in section 5.

### Workstream B (SOS)
`src/js/preview.js` (SOS, help-page and SOS-map sections; the rest of the file only when the change is required by an owned section), `src/js/bipod.js`, `src/js/geo.js`, `src/js/location.js` (all of it until B's final PR is merged), `src/js/emergency.js`, `src/js/siren.js`, `src/js/speak.js`, `src/js/offlinepack.js`, `src/css/preview.css` (SOS parts), `src/index.html` (SOS and help sections: ids starting `sos`, `help`, `bipod`), `tests/bipod-test.mjs`, `tests/geo-test.mjs`, `tests/location-estimate-test.mjs`, `tests/offlinepack-test.mjs`, `tests/siren-test.mjs`, `.github/workflows/test-sos.yml` (new).
Language namespaces: `bipod`, `sos*`, `loc*`, `emergency`, `help*`.

### Workstream C (Live Share and Firestore)
`src/js/live.js`, `src/js/track.js`, `src/js/firebase.js`, `src/js/routemap.js`, `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `tests/rules/*`, `tests/track-test.mjs`, `.github/workflows/rules-test.yml`, `docs/FIREBASE_SETUP.md`; and **only the function `loadLeaflet` and the Leaflet vendor files** in `src/js/near.js` and `src/vendor/leaflet/*`.
Language namespace: `live`.
C owns `firestore.rules` for the whole of its work; nobody else edits it until C reports "rules frozen".

### Workstream D (Nationwide geography)
`src/data/master_areas.json` (new), `src/data/geo/*` (new), `src/data/areas_bangladesh.json`, `src/data/locations.json`, `src/data/upazila_centres.json`, `src/data/villages*.json` (geographic fixes only), `src/js/locate.js` (new), `src/js/data.js` (the district list and loader parts, only in M1.4), `src/js/near.js` (everything except `loadLeaflet`), `tools/build_areas.py`, `tools/build_locations.py`, `tools/collect_locations.py`, `tools/build_master_areas.py` (new), `tools/validate_geo.py` (new), `tests/locations/*`, `tests/master_areas/*` (new), `tests/near-test.mjs`, `tests/autoloc-test.mjs`, `tests/partial-load-test.mjs`, `.github/workflows/test-geo.yml` (new).
Language namespaces: `near`, `area*`, `pick*`.
D may **not** edit `src/js/location.js` or `src/js/preview.js`; it builds `locate.js` and hands the wiring to B (section 6, interface I1).

### Workstream E (Contacts and later data milestones)
`src/data/contacts_*.json`, `src/data/core_numbers.json` (new), `src/data/national_hotlines.json`, `src/data/thanas.json`, `src/data/manual_additions.json`, `src/data/details/*`, `src/data/landmarks/*`, `src/data/places/*`, `src/data/aliases.json`, `tools/collect_contacts.py`, `tools/clean_contacts.py`, `tools/build_contacts.py`, `tools/collect_municipalities.py`, `tools/verify_sources.py`, `tools/find_conflicts.py`, `tools/coverage_report.py`, `tools/places_rules.py`, `tools/import_manual_places.py`, `tools/collect_place_details.py`, **`tools/validate_data.py`**, `tests/must-find/*`, `tests/places_data/*`, `tests/phonetic/*`, `docs/COVERAGE.md`, `docs/DATA_GAPS.md`, `docs/DATA_REPORT.md`, `docs/SOURCE_CONFLICTS.md`, `.github/workflows/validate.yml`, `.github/workflows/weekly-source-check.yml`.
Language namespace: `kinds`, `what`, contact labels.
E may not change `src/js/*` except `src/js/data.js` contact-row parts agreed in section 6 (I4). M4 (volunteer network) additions to `firestore.rules`, `firebase.js`, `admin.js`, `workspace.js` wait for gate G2.

### Workstream F (Integration, documents, release)
`README.md`, `docs/README.md`, `docs/PROJECT_COMPLETION_STATUS.md` (section 9 is appended by everyone), `docs/PLAN_STATUS.md`, `docs/PROJECT_BRIEF.md`, `docs/BUILD_PLAN.md`, `docs/SYSTEM_DESIGN.md`, `docs/FEATURES.md`, `docs/ROLES.md`, `docs/srs/*`, `docs/design/*` (read only unless fixing a diagram), new `docs/diagrams/*`, new `docs/presentation/*`, `tests/routes-test.mjs`, `tests/pwa-test.mjs`, `tests/dakun-test.mjs`, `tests/reportqueue-test.mjs`, `tests/verify-test.mjs`, `tests/README.md`, `.github/workflows/pages.yml`, `.github/workflows/secret-scan.yml`, new `.github/workflows/test-site.yml`, `src/service-worker.js` (the `VERSION` line), `journal/*`, `project_management/*`, `Dockerfile`, `docker-compose.yml`, `docker/*`.

### Files nobody changes without the human owner
`CLAUDE.md`, `LICENSE`, `.gitleaks.toml`, `src/js/firebase-config.js`, `CONTRIBUTING.md`, `SECURITY.md`.

## 5. Shared files and the one rule for each

| File | Owner | Rule for everybody else |
|---|---|---|
| `src/js/lang/en.json`, `bn.json` | each stream owns its **namespaces** (section 4) | Insert only inside your namespace, by text insertion. Never re-format or re-serialize the file. Keep `en` and `bn` keys identical. |
| `src/service-worker.js` | F (`VERSION`) | Others may **append lines to `FILES`** for files they add. Nobody except F changes `VERSION`. Say in your PR that a version bump is needed. |
| `src/index.html` | B (SOS/help ids) | Others ask B, or add a new section and report it in the handoff. |
| `src/js/preview.js` | B | D and E send interface requests (I1, I4) and do not edit. |
| `src/js/location.js` | B until B's last PR is merged, then D | D builds `locate.js`; the switch-over is one small B or D follow-up PR after B reports "location.js free". |
| `src/js/near.js` | D (C only `loadLeaflet`) | C's `loadLeaflet` change is already in commit `729396e`; it must merge before D touches `near.js`. |
| `src/js/firebase.js` | C | E (M4) and D wait for gate G2. |
| `firestore.rules`, `tests/rules/*` | C | E (M4) waits for gate G2. |
| `tools/validate_data.py` | E | D uses its own `tools/validate_geo.py`. |
| `.github/workflows/*` | one file per stream (section 4) | No stream edits another stream's workflow. F wires `test-site.yml`. |
| `docs/PROJECT_COMPLETION_STATUS.md` | F | Others append one block to section 9 in their PR. |

## 6. Interfaces between workstreams

**I1 (D → B): area lookup.** D delivers `src/js/locate.js` exporting
`locateArea(pos, deps) → { kind: 'inside' | 'near-boundary' | 'sea' | 'outside' | 'unknown', district, upazila, unionCode?, distanceKm, method: 'polygon' | 'centre', alsoNear?: [] }`
with `pos = { lat, lon }` in degrees, no network, no storage. Until D reports it merged, B keeps using `nearestUpazilaCentre`. B does not depend on D to finish its own work.

**I2 (B → C): GPS.** `geo.js` exports `locate`, `locateBest` and `geoCode`; a fix has `{ coords: { latitude, longitude, accuracy }, timestamp }`. C only calls them. If C needs a change, C writes it in its handoff and B makes it.

**I3 (C → B, D, E): Firestore.** `firestore.rules` is frozen when C says "rules frozen". The live-share document fields are `uid, lat, lon, speed, heading, battery, vehicleNo, vehicleType, destination, status, startedAt, updatedAt, expiresAt` (+ `accuracy` once U2 is approved). B reads shares only through `watchShare`.

**I4 (D → E): data layout.** D publishes the layout decision for M1.4 (per-district files under `data/districts/`, layers 1–4) as a short document in the M1.4 PR. Until then E collects data in the **existing** `contacts_<district>.json` layout and does not build `core_numbers.json`.

**I5 (everyone → F): handoff template** (section 5 of `docs/workstreams/README.md`).

## 7. Sequence and gates

```
Now        A done  →  you create the issues  →  start B, C, D, E in separate sessions
Parallel   B (SOS)   C (Live share + rules)   D (M1.1 → M1.2)   E (M2.1 collection with existing tools)
G1         C-PR1 merged (live fixes + loadLeaflet + FILES lines)         → D may start M1.4 and edit near.js
G2         C reports "rules frozen" and its PR is merged                 → E may start M4 (if the owner approves M4)
G3         B reports "location.js free" and its PR is merged             → D wires locate.js (M1.3 step 2)
G4         D M1.4 merged (layout)                                        → E builds core_numbers.json (M2.2) and starts M3
G5         B, C, D(M1.3) merged and reviewed                             → F starts integration, diagrams, reports, slides
Last       F: release check (GO / NO-GO), v1.0 tag decision by the human owner
```
Sequential by force: D M1.2 → D M1.3 → G3 wiring; D M1.4 → E M2.2 → E M3. Everything else in B, C, D (M1.1/1.2) and E (M2.1) can run at the same time because the file sets do not overlap.

## 8. Issues and branches to create (a human creates the issues; numbers come from GitHub)

| Issue to create | Branch | Workstream |
|---|---|---|
| (this plan) "Project completion plan A–F" | `docs/347-project-completion-plan` | A |
| Live share: clock, serialized sends, map retry, GPS fix, accuracy | rename `fix/346-live-link-map-accuracy` to `fix/<N>-live-share-reliability` | C |
| Rules: `prev` tests, comment, brief count | rename `fix/343-prev-tests` to `fix/<N>-prev-tests` | C |
| Family live map and accuracy field | `feature/<N>-family-live-map` | C |
| SOS review after the real-phone test | `fix/<N>-sos-phone-test` | B |
| **#346** M1.1 master area list | `data/346-m1-1-bbs-master` (already specified in the issue) | D |
| M1.2 boundaries | `data/<N>-m1-2-boundaries` | D |
| M1.3 locate.js | `feature/<N>-m1-3-locate` | D |
| M1.4 per-district files | `feature/<N>-m1-4-lazy-loading` | D |
| M2 core numbers (2.1, 2.2, 2.3 as three issues) | `data/<N>-m2-…` | E |
| M3 Chattogram union data | `data/<N>-m3-chattogram` | E |
| CI: wire hand-run tests | `chore/<N>-ci-tests` | F |
| Documents, diagrams, reports | `docs/<N>-final-docs` | F |
| Presentation | `docs/<N>-presentation` | F |
| Release check and v1.0 | `chore/<N>-release` | F |

Before creating a branch, run `git branch -a` and `gh issue list --state all` again: this table is a snapshot.

## 9. Update log (append one block per workstream result, newest last)

```
### <Workstream>, <date>
Branch / base commit / commit SHA:
Changed files:
Tests run (command and real result):
Blockers:
Handoff for: <workstream>
Next action:
```

### A, 2026-11-27
Branch `docs/347-project-completion-plan`, base `00337e8`. Added this file and `docs/workstreams/README.md`, `B-sos.md`, `C-live-share.md`, `D-geography.md`, `E-contacts.md`, `F-integration.md`. No code or data changed. No tests run (documents only). Blockers: issues for B, C, E, F and the renamed branches do not exist yet; the owner decision about M4 (volunteers) is open. Next action: a human creates the issues from section 8, commits this branch, and starts B, C, D and E in separate sessions.
