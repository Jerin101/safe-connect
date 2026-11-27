# Workstream E: Official contacts and the later data milestones

Paste this whole file into a new Claude session opened in `E:\Projects\safe-connect-e`. First read `CLAUDE.md`, `docs/PROJECT_COMPLETION_STATUS.md`, `docs/workstreams/README.md`, `docs/plans/nationwide/BUILD_PLAN_NATIONWIDE.md` (M2 to M6), `docs/plans/nationwide/COVERAGE_PLAN.md` and `docs/BUILD_PLAN.md` section 4 (the fallback chain).

## The one rule that matters
**Never invent, guess or fill in a phone number, name or office.** Every contact comes from an official `*.gov.bd` page (or `acc.org.bd`) and keeps its `source_url`, a quote (`source_quote_bn`) and a check date. If something is missing, say so and let the fallback chain work. Never claim a contact is verified without that evidence. Data changes only through the scripts in `tools/` or through `src/data/manual_additions.json`.

## What exists now (verify it)
- Official numbers: only **Noakhali** (89 unions, 3 municipalities) and **Cox's Bazar** (71 unions, 1 municipality), retrieved 2026-10-21. 301 records come from pages older than 2 years (validator warning).
- 19 national helplines (`national_hotlines.json`, each with `source_url`), 19 police stations in `thanas.json` (both pilot districts), OpenStreetMap places for 64 districts (unverified, labelled), official fuel lists for 64 districts.
- Tools: `collect_contacts.py` (portal IDs for the two pilot districts only), `clean_contacts.py`, `build_contacts.py`, `collect_municipalities.py`, `verify_sources.py`, `find_conflicts.py`, `coverage_report.py`, `validate_data.py`. CI: `validate.yml`, `weekly-source-check.yml`.

## Milestones defined in the repository (and nothing else)
`BUILD_PLAN_NATIONWIDE.md` defines **M2 (core numbers, 64 districts), M3 (union data per division), M4 (union volunteer network), M5 (villages, trip plan), M6 (release)**. **M7 and M8 do not exist in any file.** Do not invent them. If you think they are needed, stop and ask the human to write the definition.

| Step | Work | Depends on |
|---|---|---|
| M2.1 | Collect district and upazila core numbers for 64 districts (DC, SP, Civil Surgeon, UNO, police stations, health complexes, fire stations) with the existing tools, official pages only. Start with **one division** per PR. Generalise `collect_contacts.py` (portal IDs per district are discovered from official pages, not guessed) | nothing: use the **existing** `contacts_<district>.json` layout |
| M2.2 | Build layer 3 `src/data/core_numbers.json`; city corporations; T3 gap report; T8 airplane-mode test | **gate G4** (D's M1.4 layout, interface I4) |
| M2.3 | Weekly source check for all 64 districts | M2.1 |
| M3 | Union data, Chattogram division first, then the others, one division per PR | G4, M2 |
| M4 | Union volunteer network | **gate G2** (C reports "rules frozen") **and a written decision from the project owner**: `docs/PLAN_STATUS.md` says the volunteer role is not in this release. Do not start M4 without that decision. |
| M5 | Villages, trip plan, area notes | M3 |
| M6 | Release | F owns it |

## Tasks for this session
1. Verify the state above. List, per division, which districts have official numbers (none outside the two pilots) and the exact `source_url` pattern of their district portals, found by reading official pages. Report unreachable pages honestly.
2. Do **M2.1 for exactly one division** (the human names it; if not named, Chattogram without the two pilots), PR-sized. Polite to servers: a delay between requests, no certificate bypass. Save raw output outside the repository. Every record keeps `source_url`, quote, `checked_on`.
3. Make `tools/validate_data.py` accept the new districts and check: source present, date present, phone digits valid, no duplicate number for different people (conflicts go to `docs/SOURCE_CONFLICTS.md` for a human), stale-record flags (`source_older_than_2_years`), `number_not_published` flag when the official page lists none.
4. Update `tools/coverage_report.py` so `docs/COVERAGE.md` shows the 64-district matrix (own numbers, fallback counted separately, "unverified" never counted as verified).
5. Run the `data-checker` agent logic on your diff (duplicates, missing sources, stale records, coverage gaps).

## Files you own
Everything listed under "Workstream E" in the status file, section 4. Summary: `src/data/contacts_*.json`, `core_numbers.json`, `national_hotlines.json`, `thanas.json`, `manual_additions.json`, `details/`, `landmarks/`, `places/`, `aliases.json`; contact tools in `tools/`; `tools/validate_data.py`; `tests/must-find/*`, `tests/places_data/*`, `tests/phonetic/*`; `docs/COVERAGE.md`, `DATA_GAPS.md`, `DATA_REPORT.md`, `SOURCE_CONFLICTS.md`; `validate.yml`, `weekly-source-check.yml`. Language keys: contact labels only (`kinds`, `what`).

## Files you must NOT change
All `src/js/*` (B, C, D) except agreed contact-row changes in `data.js` after interface I4; `firestore.rules`, `firebase.js`, `admin.js`, `workspace.js` (C, until G2); geography data and tools (D); `VERSION` (F).

## Tests (real output required)
`python tools/validate_data.py src/data` (0 errors) · `python -m unittest discover -s tests/places_data` · `node tests/must-find/run.mjs` if it applies · `python tools/coverage_report.py src/data` · for M2.2: T3 and T8 as defined in the plan.

## Done when
0 validation errors, the coverage matrix is regenerated from the data (not hand-edited), every new record has source, quote and date, nothing invented, and the handoff lists: districts done, districts blocked and why, records flagged stale or conflicting, and what D must know for the layout (I4).
