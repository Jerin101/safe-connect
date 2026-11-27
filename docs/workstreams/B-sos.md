# Workstream B: SOS

Paste this whole file into a new Claude session opened in `E:\Projects\safe-connect-b` (worktree on branch `fix/<ISSUE>-sos-phone-test`, from `origin/main`). First read `CLAUDE.md`, `docs/PROJECT_COMPLETION_STATUS.md` and `docs/workstreams/README.md`.

## Goal
Make the SOS flow reliable and honest, and close the gaps found by a real-phone test. This is a **hardening and test** workstream: the main features are already on `main` (PRs #343, #344, #345). Do not rebuild them.

## What exists now (verify it yourself first; do not trust this list)
- GPS acquisition: `getSosPosition` and `locateBest` (`src/js/location.js`, `src/js/geo.js`): best fix for up to 20 s, target 25 m, no cached fix, coarse fix needs confirmation (`sos.state === 'rough'`, `preview.js`).
- SOS link and family page: `helpLink` and `parseHelp` (`src/js/bipod.js`), family page `showHelp` (`preview.js`), shared point shown inside SafeConnect (#344), accuracy text and nearest-centre estimate (#343, #345).
- Tests: `tests/bipod-test.mjs`, `tests/geo-test.mjs`, `tests/location-estimate-test.mjs` (in CI), `tests/siren-test.mjs`, `tests/offlinepack-test.mjs`, `tests/routes-test.mjs` (hand-run).

## Tasks (do them in this order; stop after the first PR-sized piece)
1. **Audit against the spec below** and write a short list of real gaps with file and line. No code yet.
2. **GPS acquisition and accuracy:** permission denied (code 1) never reuses an earlier fix; timeout returns the best fix or a clear failure; `maximumAge` 0; accuracy is carried into the SOS link. Fix only real gaps.
3. **SOS snapshot and consent:** the position in the message and link is the one the person confirmed, with its accuracy and time. A "send new location" action discards the old one (`requestSosLocation(true)`). Nothing is sent without a tap. Check this by test, not by reading.
4. **SOS link generation:** round-trip tests for `helpLink` and `parseHelp`: six decimals kept, time kept, accuracy kept, situation kept, rejected outside Bangladesh, rejected when the time is far in the future, old link shows its age.
5. **Family SOS map:** opens inside SafeConnect (Leaflet through `near.loadLeaflet`, owned by workstream C: **call it, do not edit it**), shows the point, accuracy circle, age, the nearest-centre estimate as a separate line, 999 and the family's call buttons; works with a clear message when offline or when the map fails (never a blank box).
6. **Tests:** add what is missing to the files you own; keep them fast and deterministic. Put new CI lines only in your own `.github/workflows/test-sos.yml` (create it; copy the setup steps from `validate.yml`).
7. If the human gives you real-phone results, record them in the handoff exactly as given. Do not invent results.

## Files you own
`src/js/preview.js`, `src/js/bipod.js`, `src/js/geo.js`, `src/js/location.js`, `src/js/emergency.js`, `src/js/siren.js`, `src/js/speak.js`, `src/js/offlinepack.js`, SOS parts of `src/css/preview.css`, SOS/help ids in `src/index.html`, `tests/bipod-test.mjs`, `tests/geo-test.mjs`, `tests/location-estimate-test.mjs`, `tests/offlinepack-test.mjs`, `tests/siren-test.mjs`, `.github/workflows/test-sos.yml`. Language keys: `bipod`, `sos*`, `loc*`, `emergency`, `help*`.

## Files you must NOT change
`src/js/live.js`, `src/js/track.js`, `src/js/firebase.js`, `firestore.rules`, `tests/rules/*` (C); `src/js/near.js`, `src/js/locate.js`, any `src/data/*` (D and E); `src/service-worker.js` `VERSION` (F; you may append to `FILES`); other workflows.

## Interfaces
- You **consume** I1 from D (`locateArea` in `src/js/locate.js`) only after D reports it merged. Until then keep `nearestUpazilaCentre`. When D reports it, you do the one wiring PR (replace the call in `resolvePlace`) and then tell the human `location.js` is free for D (gate G3).
- You **provide** I2 to C: `locate`, `locateBest`, `geoCode` stay compatible.

## Must not break
Offline-first (the SOS page, the pack and the SMS texts work with no internet), privacy rule 5 (coordinates leave the phone only when the person sends), bn/en parity, 360 px and 390 px layouts.

## Done when
Tests above pass with real output, `routes-test` (with `BASE`) is ALL OK, `node --check` passes for each JS file you touched, and the handoff (template in `docs/workstreams/README.md`) is written. Next action for the human: review the diff, commit, push, open the PR.
