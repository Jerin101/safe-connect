# Workstream D: Nationwide geography (M1.1 to M1.4)

Paste this whole file into a new Claude session opened in `E:\Projects\safe-connect-d`. First read `CLAUDE.md`, `docs/PROJECT_COMPLETION_STATUS.md`, `docs/workstreams/README.md` and `docs/plans/nationwide/BUILD_PLAN_NATIONWIDE.md` (the authoritative milestone definitions: M1 steps 1.1 to 1.4, tests T1, T2, T5, T6, T9, T10) and `docs/plans/nationwide/COVERAGE_PLAN.md`.

## Rule for this workstream
One issue = one PR. **Start with issue #346 (M1.1) only**, with the scope, rules and acceptance criteria written in that issue (read it with `gh issue view 346`). Then M1.2, M1.3, M1.4 as separate issues and separate sessions. Do not mix them.

## What exists now (verify it)
- `src/data/areas_bangladesh.json`: national portal hierarchy: 8 divisions, 64 districts, 510 upazilas, 4,537 unions. Its own note says some codes are missing or repeated (22 upazilas have no `bbs` code; upazila `bbs` repeats 410 times because it is only unique inside a district; 19 upazilas have 0 unions).
- `src/data/upazila_centres.json`: 471 centres, 39 listed as missing, with `source_url`.
- `src/data/locations.json`: **only** 18 upazilas (with polygons), 158 unions, 4 municipalities, in Noakhali and Cox's Bazar.
- `src/js/location.js`: `nearestPlace`/`upazilaAt` (polygons, pilot only, 45 km limit) and `nearestUpazilaCentre` (nationwide, nearest centre, 60 km, never claims "inside"). **Owned by B; you do not edit it.**
- No `master_areas.json`, no `data/geo/bangladesh.json`, no `src/js/locate.js`, no T1 test.

## Milestones
| Step | Output | Tests | Depends on |
|---|---|---|---|
| M1.1 (#346) | `src/data/master_areas.json`, `tools/build_master_areas.py`, review report, source and licence recorded | **T1** both directions, expected vs actual counts, no silent missing or duplicates | nothing |
| M1.2 | `src/data/geo/bangladesh.json` (simplified boundaries, sea zone, override areas), size limit | **T2** (no holes or overlaps, 0.05° on PRs, 0.002° on release), **T9** size | M1.1 |
| M1.3 | `src/js/locate.js` with the five rules (inside, near boundary within about 3 km shows both, sea, outside Bangladesh, otherwise unknown), union from the master list, wards in cities | **T5** (special places), **T10** (remote and border points) | M1.1, M1.2 |
| M1.3 wiring | one small PR that calls `locateArea` in `resolvePlace` (`preview.js`) and the near-me picker | existing SOS tests still pass | **gate G3** (B reports `location.js` free) |
| M1.4 | per-district files under `src/data/districts/`, lazy loading in `data.js`, layers 1 to 3 always cached, layer 4 cached when opened; the 2 pilot districts behave exactly as before | **T6** offline | **gate G1** (C's PR merged, because it touches `near.js`); publishes interface **I4** to E |

## Hard rules for data
- Official sources only; BBS administrative boundaries (COD-AB via OCHA HDX, as already credited in the footer). Record dataset version, date, URL and licence. **Never join on name alone** (Demra and Dhamrai must not be paired by name). Unresolved cases stay explicitly unresolved in the report. No guessed codes, names or parents.
- Python standard library only; polite to servers (a delay between requests); UTF-8; no certificate-check bypass; Nominatim only in `tools/`, 1 request per second, with credit.
- `python tools/validate_data.py src/data` must still report 0 errors (you do not edit that script; add your own `tools/validate_geo.py`).
- File size: layers 1 to 3 must stay small enough for offline (state the numbers in the PR; T9 guards it).

## Files you own
`src/data/master_areas.json`, `src/data/geo/*`, `src/data/areas_bangladesh.json`, `src/data/locations.json`, `src/data/upazila_centres.json`, geographic fixes in `src/data/villages*.json`, `src/js/locate.js`, `src/js/data.js` (district list and loader, **only in M1.4**), `src/js/near.js` (everything except `loadLeaflet`, **only after G1**), `tools/build_areas.py`, `tools/build_locations.py`, `tools/collect_locations.py`, `tools/build_master_areas.py`, `tools/validate_geo.py`, `tests/locations/*`, `tests/master_areas/*`, `tests/near-test.mjs`, `tests/autoloc-test.mjs`, `tests/partial-load-test.mjs`, `.github/workflows/test-geo.yml`. Language keys: `near`, `area*`, `pick*`.

## Files you must NOT change
`src/js/location.js`, `src/js/preview.js`, `src/js/geo.js`, `src/js/bipod.js` (B); `src/js/live.js`, `src/js/firebase.js`, `firestore.rules` (C); contact data and `tools/validate_data.py` (E); `VERSION` (F).

## Interfaces
- You **provide** I1: `locateArea(pos, deps)` in `src/js/locate.js` (shape in the status file, section 6). No network, no storage, no globals. Write it so node tests can call it with plain data.
- You **provide** I4: the per-district layout, as a short document in the M1.4 PR.
- You **consume** nothing from B, C or E.

## Tests (real output required)
`python tools/validate_data.py src/data` · your T1/T2/T5/T9/T10 tests under `tests/` · `node --test tests/locations/upazila-shapes-test.mjs tests/geo-test.mjs tests/location-estimate-test.mjs` (must stay green) · for M1.4: `BASE=… node tests/near-test.mjs`, `tests/partial-load-test.mjs`, `tests/routes-test.mjs`, and an airplane-mode test of layers 1 to 3.

## Done when
The acceptance criteria of the issue are met with real output, nothing outside your file list changed, and the handoff names exactly what B (I1) or E (I4) can now use.
