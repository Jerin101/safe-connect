# M1.2 – page integration: "Where the map puts you"

Status: built and tested locally; **not committed, not deployed**. Branch `feature/m1-2-upazila-polygon-pilot` (no GitHub issue number yet).

## Chosen page and why
The **area page** (the page that opens after "Find help near me", after auto location, and from the SOS flow's area), in `src/js/preview.js` `renderArea()`. It is the one page that already has a real phone position (`current.pos`) and tells the person which area the numbers are for, so an administrative answer is most useful there. The home page, the map pages (near me, live share, family map) and the SOS/call flows are not changed. Existing area detection (`locations.json`, two districts) is untouched; the new card sits next to it.

## Exact user-visible behaviour
A card **"Where the map puts you / মানচিত্র অনুযায়ী আপনার অবস্থান"** appears under the "You are in …" block, only for a real phone position (not for demo chips, not for an area picked by hand). All words come from `ui.where` in `lang/en.json` and `lang/bn.json`.
| Situation | What the person sees |
|---|---|
| Position inside an upazila boundary | Rows **Division / District / Upazila** (or **City corporation**) from the polygon layer; then **"Nearest union centre"**: "<name>, about N m away" + "This is the nearest centre point, not your union. Union boundaries are not published, so you may be in a different union."; the source line (BBS via OCHA HDX, CC BY-IGO, simplified; the position stays on this phone). Bangla numbers in Bangla. |
| Within max(150 m, GPS accuracy) of a boundary | Extra warning: "You are close to a boundary (about N m). The next upazila could be the right one." |
| Two centres within 500 m of each other | "Another centre is almost as near, so it could be either one." |
| Upazila has no centre list (Eidgaon, city corporation) | "… centres of the whole district were compared." |
| District has a 2026 upazila reported but not on the map | "Reported new upazila not yet on the map: Chandraganj. If you are there, the upazila above may be out of date." (Fatikchhari Uttar, Dakshin Gafargaon, Bangra likewise.) |
| Contact list and map name a different district/upazila | "The numbers on this page are for A; the map shows B. Near a boundary this can happen. Check the area name." (spelling differences such as "Sadar" are ignored) |
| GPS accuracy worse than 2 km | "Your position is too rough (about N m) to name an upazila…": no names at all |
| In no boundary (sea, outside Bangladesh, 2026 area) | "This position is not inside any upazila boundary on this map… The numbers on this page are not changed." No names. |
| Layer files not on the phone (offline before the first visit, damaged file) | "The boundary map is not on this phone yet. Open this site once with internet and it will be saved for offline use." |
| Location permission denied / no position | **No card.** The existing "location blocked" message and demo chips appear exactly as before. |
The card never says "your union", "exact union" or names a union as a place the person is in. Nothing is stored or sent: the position is compared on the phone with files saved on the phone (a test checks that `whereami.js` has no storage, network or geolocation calls).

## Code changes
- `src/js/whereami.js` (new): model (`whereAmI`) + card (`renderWhere`, createElement + textContent only).
- `src/js/areapoly.js`: `locate()` now also returns `edge_m` (distance to the nearest boundary) and the district list for "no polygon".
- `src/js/preview.js`: imports, `showWhere()`, one call in `renderArea()`, and a **fix**: `renderArea` used `nat(...)` for an outside position, but `nat` only existed inside `firstRows`, so the area page of a position outside the two covered districts threw `ReferenceError: nat is not defined` after drawing the top of the page (same bug on clean origin/main). One line defines it in `renderArea`.
- `src/index.html`: `<section id="where">`; `src/css/preview.css`: card styles (theme variables only); `src/js/lang/en.json`, `bn.json`: `ui.where` (16 strings each; Bangla draft needs the Bangla reviewer).
- `src/service-worker.js`: `js/whereami.js` added; version `v81-2026-11-27` (see below).
- `tools/build_district_polygons.py`: the index now carries the 8 division names. Layers are byte-identical.
- `.github/workflows/validate.yml`: `tests/whereami-test.mjs` added.

## Service worker version
`origin/main` = `v80-2026-11-27`. All local and remote branches and worktrees checked: highest `v80`. This work uses **`v81-2026-11-27`** (free). If another PR merges first with a v81, bump this one to v82 before merging.

## Sizes (budgets)
- Polygon data (index + 64 layers): **1,295,139 B** raw, 552,506 B gzip, against the approved 1.3 MB: passes by 4.9 KB. Union points inside: 397 KB (< 400 KB). Largest layer 17.7 KB gzip.
- Application code, reported separately: `areapoly.js` 7,265 B + `unioncentre.js` 3,967 B + `whereami.js` 6,134 B = **17,366 B** (6.8 KB gzip). Other edits: `preview.js` +1,257 B, `en.json` +1,696 B, `bn.json` +3,492 B, `preview.css` +638 B, `index.html` +213 B.
- Whole offline cache (135 files): **6,582,417 B** raw (1.35 MB gzip) against the 10 MB budget; origin/main base was 5,262,616 B (67 files).

## Tests
- `node --test tests/whereami-test.mjs` (14): strings (same keys and placeholders in bn/en, all Bangla), no hard-coded sentences, privacy (no storage/network/geolocation), model states, rough GPS, boundary warning (fake and real edge point), 2026 upazila note, mismatch note, English and Bangla card text (no Latin digits), SW list and version.
- `node tests/where-test.mjs` (real Chrome, needs `python -m http.server 8000 -d src`): card after "Find help near me" in English and Bangla; contacts and area page still work; no coordinates in localStorage; 360 px no sideways scroll; sea point and (0,0) give the plain message; permission denied shows the old message and no card; layer files blocked gives "not on this phone yet"; service worker cache holds index + 64 layers; offline reload still answers from the cache; no uncaught page errors.
- Earlier: `tests/areapoly-test.mjs` (18), Python polygon suites (25), `tests/polygons-test.mjs` (9), `pwa-test`, `geo-test`, `upazila-shapes-test`, `validate_data.py`.

## The 11 failing/hanging test files (investigated)
Compared on a clean `git archive` of `origin/main` (`365a785`, in `E:\tmp-sc-tests\main-clean`, outside the repo) and on this branch.
| Files | Cause | origin/main | This branch |
|---|---|---|---|
| autoloc, dakun, family-map, near, ride-resume, routes, width-sweep (7 browser tests) | They need the site served locally (`python -m http.server 8000 -d src`), Chrome, and **at least 5 GB free in the temp folder** (they stop when less; `C:` has 2.7 GB free). Without the server they hang or crash. With a local server and `TEMP` pointed at `E:` they run. | autoloc, dakun, family-map, near, ride-resume, routes: **ALL OK**. width-sweep: exit 1, 132 kinds of problem (14,784 cases) | identical: all OK, and width-sweep exit 1 with the **same 132 kinds of problem (the two logs are identical)** |
| firestore / community / ride / track rules (4 files) | Need `npm ci` (no `node_modules` here) and the Firebase emulator (`npm run test:rules`, run in CI by `rules-test.yml`). Both trees stop with `ERR_MODULE_NOT_FOUND`. Rules, `track.js` and `firebase.js` are not touched by this work. | not runnable here | not runnable here |
width-sweep reports existing layout findings (for example the Bangla area chip and home button at 320–430 px) on origin/main too; it is a pre-existing failure, not caused by this work (it does not open an area page with a position).
Conclusion: **no regression found**; 10 of 11 were environment-caused (no server, low disk on `C:`, missing `node_modules`), and `width-sweep` is a real, pre-existing layout failure that is identical on origin/main.

## Unresolved / risks
- Bangla wording for `ui.where` is a draft: Bangla reviewer needed. Wording for "union centre" needs care ("কেন্দ্র", not "ইউনিয়ন").
- Rules tests were not run (no `node_modules`/emulator); they are unaffected by this change.
- Data margin is 4.9 KB under the budget; any new field needs a size review.
- Simplified boundaries (100 m): near a border either side can be correct, and the card says so.
- The contact-vs-map mismatch note compares names; a rare spelling difference could show a harmless note.
- Real-phone test not done yet: see `M1_2_REAL_PHONE_CHECKLIST.md` (updated for the wired page).
- Deploy sends about 1.3 MB of new data to every phone on the next online visit.
- A 2026 gazette, city wards and the reconciliation mappings remain separate open work.
