# Workstream C: Live Share and Firestore

Paste this whole file into a new Claude session opened in `E:\Projects\safe-connect-c`. First read `CLAUDE.md`, `docs/PROJECT_COMPLETION_STATUS.md` and `docs/workstreams/README.md`.

## Starting point (do not redo it)
Commit `729396e` on the local branch `fix/346-live-link-map-accuracy` (in `E:\Projects\safe-connect-ui`, **not pushed**) already contains: real-time clock offset, one send at a time with 3 refusals before ending, GPS first with no old fix, accuracy on the sharer's page, Leaflet retry and offline caching, `tests/track-test.mjs`. And the local branch `fix/343-prev-tests` has two commits (two `prev` rule tests, a comment fix, brief count 158).
Branch names collide with issue #346 (M1.1) and merged PR #343. **Before anything else:** the human creates new issues and runs `git branch -m` for both branches, then you continue in a worktree created from the renamed branch (`git worktree add E:\Projects\safe-connect-c <renamed-branch>` is not possible while it is checked out in `safe-connect-ui`; ask the human to check out another branch there first, or cherry-pick the commits onto a new branch from `origin/main` with `git cherry-pick 729396e`).

## Goal
Live Share that does not end by itself, shows the right place on a real map, and tells the family how exact the point is.

## Tasks (stop after the first PR-sized piece)
1. **Land the existing work** (PR 1): the live-share fixes. Re-run the tests listed below on the rebased branch. This PR is gate **G1**.
2. **Rules PR (PR 2):** `fix/<N>-prev-tests` contents. Run the full emulator suite (158 expected) and report the real count.
3. **Session creation and expiry:** the end time uses real time (done), the family page uses real time (done). Add a test for the clock helpers with a phone 20 minutes behind and 20 minutes ahead (done in `track-test.mjs`: keep it passing). Verify by reading `firestore.rules` that `expiresAt` limits still hold (at most 482 minutes from `request.time`).
4. **Serialized updates, retry, reconnect:** `sendPoint` in `live.js` sends one point at a time and survives a network drop: simulate with a fake `updateShare` that rejects, hangs, and resolves late, and test the counting of refusals (extract the logic into `track.js` so it can be tested in node without Firebase if needed).
5. **Accuracy to the family (U2):** add an optional numeric `accuracy` (0 to 10000) to `live_shares` in `firestore.rules` (`create` key list, `update` `changed().hasOnly`, `shareOk`), rules tests for: valid, missing, negative, too large, string. **Never send the field from the client before the rules are deployed** (the old rules would refuse every update and end the share). Ship the client change behind a check: the page sends `accuracy` only when a constant `RULES_HAVE_ACCURACY` in `track.js` is `true`, and the human flips it after Jerin deploys the rules. Report this clearly.
6. **Family live map:** place line ("near the centre of X, Y", already there via `approximateUpazila`), accuracy circle when `accuracy` is present, "last updated N seconds ago" that turns into a clear "not live" warning after 60 s without an update (do not pretend an old point is live), battery and speed as now, nearby help from existing data only (no new numbers), Google Maps button kept, offline message when the map cannot load.
7. When you finish, write "rules frozen" in the handoff. This opens gate **G2** for workstream E.

## Files you own
`src/js/live.js`, `src/js/track.js`, `src/js/firebase.js`, `src/js/routemap.js`, `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `tests/rules/*`, `tests/track-test.mjs`, `.github/workflows/rules-test.yml`, `docs/FIREBASE_SETUP.md`, `src/vendor/leaflet/*`, and only the function `loadLeaflet` in `src/js/near.js`. Language keys: `live`. `src/service-worker.js`: you may append `FILES` lines only.

## Files you must NOT change
`src/js/preview.js`, `src/js/geo.js`, `src/js/location.js`, `src/js/bipod.js` (B); the rest of `src/js/near.js`, any `src/data/*` (D, E); `VERSION` in `src/service-worker.js` (F).

## Interfaces
- You **consume** I2 from B: `locate`, `locateBest`, `geoCode` (import only).
- You **provide** I3: the share document fields, and the "rules frozen" message.
- If the family page needs a change in `preview.js` (for example the `#/track` route), write it as a request in your handoff; do not edit it.

## Tests (run and report real output)
```
node tests/track-test.mjs
node --check --input-type=module < src/js/live.js     (and track.js, firebase.js, near.js)
npm run test:rules       (expect 158 + your new tests; use a temporary firebase.test.json if port 8080 is taken; delete it afterwards)
python -m http.server <port> -d src   then   BASE=http://127.0.0.1:<port>/ node tests/routes-test.mjs
```
Safe testing: use a test account, delete test data afterwards, never call a real emergency number (`CLAUDE.md` rule 9).

## Must not break
Rules `get` for a share stays open to anyone with the 32-character link; expired shares stay unreadable; admins can still delete only expired shares; no position is stored on the phone (only the share id); no secrets in code.

## Done when
Real test output is in the handoff, "rules frozen" is stated, and the human knows: (a) Jerin must deploy `firestore.rules` with `firebase deploy --only firestore:rules`, (b) a service-worker version bump is needed (F), (c) which phone checks to run (15-minute share, second phone opens the link, airplane mode on the sharer for one minute, reconnect).
