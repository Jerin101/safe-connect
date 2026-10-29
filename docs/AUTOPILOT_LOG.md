# Autopilot log

## NEEDS JERIN (only you can do these)
- [ ] Firebase console (for #74): Authentication → Templates → Password reset → edit → "Customize action URL" → `https://jerin101.github.io/safe-connect/reset.html`; sender name "SafeConnect", Bangla subject and text; check `jerin101.github.io` is in Authentication → Settings → Authorized domains. Then test one real reset with a **test account** on the live site (localhost is refused by the API key restrictions), and delete that test account afterwards.
- [ ] Add the first admins: `docs/FIREBASE_SETUP.md` part F. Sign in on the site once, copy your User UID from Authentication → Users, then in Firestore create `admins/<your UID>` with `since` (timestamp) and `addedBy` = `console`. Do the same for Tasmin. Only the console can add admins; the site never can.
- [ ] Remove `localhost` from Firebase Auth authorized domains before v1.0.
- [ ] Google Cloud console: add website restrictions to the Firebase API key.
- [ ] GitHub settings: turn on Secret scanning and Push protection (for #77).
- [ ] Test on your real phone: install it to the home screen, then open it from the icon in airplane mode and check the offline list; also 360 px, Bangla and English, night and day, a slow connection and large text. Open the dialer for 999 but cancel; never call.
- [ ] P13 (#80): open each link in `data/spot_check_40.csv`, fill `human_ok` (yes/no), `checked_by`, `checked_on`; only then mark the "yes" rows `verified` (through the tools). Row `acd98005cc` is already known not to match (DATA_GAPS §11).
- [ ] Try a real Google and email sign-in with a **test account** on the live site (the error texts were only tested with a stub); also send one test "wrong number" report. Afterwards delete the test account and its `users`, `family` and `reports` documents in the console (audit entries can only be deleted there too).
- [ ] On a real Android phone (#75): does Messenger open with the map link, and does WhatsApp open with the message? If Messenger does not work, the button should only open the share menu.
- [ ] Leftover Firestore emulators (no parent program left): port 8093, java PID 17088 (and its helper processes 9088, 16652, 25916, 22568) from the #78 rules run; port 8080, java PID 20600, started 2026-10-29 09:13, which may be from the autopilot's first rules run or your own. Close them in Task Manager, or check with `Get-Process -Id 17088,20600,9088,16652,25916,22568` and stop them with `Stop-Process -Id 17088,20600,9088,16652,25916,22568` (an ID that is already gone just shows an error, which is fine).
- [ ] Workspace (#78) with a real **test account** (Tasmin): sync on/off, then delete the test data in Firestore.

**Where to continue:** the autopilot is **finished and stopped** (2026-10-29, on Jerin's change of plan). Nothing is in progress. Next work: the new nationwide plan (union volunteer network, M4) that Jerin adds to `docs/`.

**How each PR is checked (tools kept outside the repo, in the session scratchpad):** Playwright (`npm i --no-save playwright-core@1.48.2`, uses the installed Chrome) runs every page at 360/1280 px, day/night, bn/en: sideways scroll, 999 visible and first, console errors; it also runs `tests/search-test.html`. Rules tests run from PowerShell (`npm run test:rules`); if port 8080 is taken by another emulator, run them in a copy with port 8085.

| Step | Task | Issue | Branch | PR | Status |
|---|---|---|---|---|---|
| 1 | Design v3 reference and plan | #68 | docs/68-design-v3 | #76 | done: #68 closed, merged in PR #76, nothing waiting |
| 2 | Secret scan (gitleaks + rule in CLAUDE.md) | #77 | feature/77-secret-scan | #83 | done: merged. Tester NO-GO (allowlist target) fixed, then GO. Local scan clean, fake token caught. Rules 35/35, validator 0 errors, search 26/0 |
| 3 | css/base.css + v3 colours | #69 | feature/69-base-css | #84 | done: merged, live `v5-2026-10-28`, offline reload OK |
| 4 | New header | #70 | feature/70-new-header | #85 | done: merged, live `v6-2026-10-28`, offline reload OK |
| 5 | Real pages with routes | #71 | feature/71-routes | #86 | done: merged, live `v7-2026-10-28`, offline `#/faq` OK |
| 6 | New home layout (+ "তিন ভূমিকা, এক লক্ষ্য") | #72 | feature/72-home-layout | #87 | done: merged, live `v8-2026-10-28`, offline reload OK |
| 7 | Sign-in modal + Google error messages | #73 | feature/73-signin-modal | #88 | done: merged, live `v9-2026-10-29`, offline `#/account` OK |
| 8 | Password-reset page (code only) | #74 | feature/74-reset-page | #89 | done: merged, live `v10-2026-10-29`, reset.html offline OK |
| 9 | Share buttons | #75 | feature/75-share | #90 | done: merged, live `v11-2026-10-29`, offline `#/send` OK |
| 10 | P35 user workspace | #78 | feature/78-user-workspace | #91 | done: merged, live `v12-2026-10-29`, offline `#/account` OK |
| 11 | P18 wrong-number reports | #79 | feature/79-reports | #92 | done: merged, live `v13-2026-10-29`, offline area OK |
| 12 | P44 admin workspace | #65 | feature/65-admin-workspace | #93 | done: merged, **rules + indexes deployed** (b53b65e), live `v14-2026-10-29`, offline `#/account` OK |
| 13 | Action versions | #52 | fix/52-action-versions | #94 | done: merged; CI on ubuntu-24.04 with no Node 20 warning |
| 14 | P13 spot-check of 40 contacts | #80 | data/80-spot-check | #95 | done: merged; sheet + tool ready. **#80 stays open** for the hand check |
| 15 | Inani Coast Guard number | #49 | - | - | done: closed with a note; the official number was already in the data and is live |
| 16 | P38 / P39 volunteers | #81 / #82 | - | - | not started: closed as "Replaced by the union volunteer network (nationwide plan M4)" |

Reminder: volunteer and report tests use a test account and a fake code, and the test data is deleted afterwards.

## Final report (2026-10-29)

**Merged PRs (13), all with tester GO:** #83 secret scan (#77) · #84 base.css + v3 colours (#69) · #85 header (#70) · #86 routes (#71) · #87 home layout (#72) · #88 sign-in modal (#73) · #89 reset page (#74) · #90 share buttons (#75) · #91 user workspace (#78) · #92 wrong-number reports (#79) · #93 admin workspace + rules (#65) · #94 action versions (#52) · #95 spot-check sheet (#80, issue stays open).
**Closed without a PR:** #49 (number already in the data and live), #81 and #82 (replaced by the union volunteer network).

**What is live:** https://jerin101.github.io/safe-connect/preview.html, service worker `v14-2026-10-29` (identical to main 486f9d5). Firestore rules + 3 audit indexes deployed from main b53b65e.

**Final release check (tester, live site): GO.**
- Pages: 88/88. 11 pages × 360/1280 px × day/night × bn/en: 999 first and visible, no sideways scroll, no console errors.
- Offline: home, numbers, an area, send, FAQ, account and reset.html all open from the cache with 999.
- Privacy: no Firebase request before a tap.
- Search tests: 26/0.
- Scenarios: A (Chowmuhani) and B (Inani: Coast Guard 01769442310 shown) work.

**Bugs the reviews caught before merge:**
- #83: the allowlist didn't match.
- #89: the reset code was stored in the cache.
- #91: another person's numbers could be uploaded.
- #93: an admin could change another admin's role.

All were fixed with a test that fails on the old code.

**Skipped, and why:**
- P38/P39: Jerin's change of plan.
- The P13 hand check: only a person may mark records verified.
- The QR picture (#72): a home-made code could not be test-scanned.
- National hotlines can't be reported, and there is no "which number" field (#79): the existing rules don't allow them.
- The "signal ring" (#73).
- Real-account, real-phone and Android tests: see NEEDS JERIN.

**Can wait (good next issues):**
- Scenario A: the police station OC is not in "Call these first" (outpost first). This is a product decision.
- The outpost card label says "Police station".
- English mode shows Bangla official names; the data has no English names.
- Turning sync on replaces the account copy; ask which copy to keep.
- Store the uid with the sync flag.
- Report-status audit meta is not checked against the real status.
- A lone audit entry is possible if a dangling `lastAuditId` exists (console only).
- Filter messages: "not in our list" when the district filter hides a place.
- Some `aria-label`s are still English in the HTML.
- Update the "Done when" counts in the issues (rules are now 69).
- A small issue for the later move to Ubuntu 26.

## Research (source-researcher, 2026-10-28)
- **#49:** the official number is already in `data/manual_additions.json` (`manual-bcg-inani`, 01769442310, source: jaliapalongup.coxsbazar.gov.bd, page updated 2026-08-08, re-checked live 2026-10-28). To check: does the site load it as a Cox's Bazar `coast_river` contact?
- **P13:** 40 random key contacts (seed 20261028): 39 numbers found on their `source_url`, 1 not found: `acd98005cc` (Amanullapur union secretary, 01823239591). The officers page changed after 2026-10-21 and no longer lists him. Do not mark it verified; a person should check the page and its archive.

## Log
- **#68:** nothing to do (closed, merged in PR #76).
- **project-manager:** created issues #77–#82 (milestone v1.0); added #65, #52, #49 to milestone v1.0.
- **#77 → PR #83 (merged):** gitleaks 8.30.1 workflow (checksum checked), `.gitleaks.toml` allows only the public Firebase key in `js/firebase-config.js` (rules `gcp-api-key` and `generic-api-key`), CLAUDE.md rule 4a, P46 in ISSUES.md. Agents: tester (NO-GO, then GO). Live VERSION unchanged (`v4-2026-10-27`, no site files changed). Can wait: `actions/checkout@v7` here vs `@v4` elsewhere (fix in #52).
- **#69 → PR #84 (merged):** style move + v3 colours. Agents: tester GO (contrast of muted/link/accent text checked, all ≥ 4.5:1). Can wait: old duplicate `.linkbtn` in preview.html; `index.html` still has its own styles.
- **#70 → PR #85 (merged):** v3 header (area chip, 999 first, account, send button, language, theme; tabs with `aria-current`; search pill that jumps to the area search). Agents: developer, bangla-reviewer (4 text fixes applied), tester GO. Rules 35/35, validator 0, search 26/0, page check 8/8. Fixed after review: search pill narrower so all tabs fit at 1280 px. **To do (#72):** night 999 contrast is about 3:1 (white on `--red-1`), below 4.5:1; it comes from the v3 colours.
- **#71 → PR #86 (merged):** hash routes (`#/`, `#/numbers`, `#/area`, `#/send`, `#/guide`, `#/about`, `#/faq`, `#/account`, `#/area/<district>/<upazila>/<union|town>[/<place>]`). Agents: developer, bangla-reviewer (OK; 2 small fixes applied: "Find area" title, arrow hidden from screen readers), tester GO (location asked only after a tap; Back/reload/links never ask). Route flow test 42/42, page check all OK, rules 35/35, search 26/0, validator 0. Can wait: the "outside" result can't be reopened by Back; an English town address shows the Bangla town name (data has no English names); check on main that the Chowmuhani police outpost shows in the first calls.
- **#72 → PR #87 (merged):** v3 home: banner with the 3 actions (all fit on 360x640, 320x568), number-tile row, card rows, desktop sidebar (short web address instead of a QR picture: a home-made QR could not be test-scanned; district filter), "তিন ভূমিকা, এক লক্ষ্য" section (volunteers marked "soon"). Night 999 contrast fixed: white on reds now ≥ 4.61 in both themes (new `--red-ink` for red text). Agents: developer, bangla-reviewer (5 text fixes applied: no "fast help" promise, honest offline line, real button names), tester GO. Rules 35/35. Page check all OK, routes 0 FAIL, search 26/0, validator 0. Not done: QR picture; service-type filter; v3 card badges with hand-typed numbers (numbers must come from data).
  Can wait (from tester): with the district filter on, searching a place in the other district says "not in our list" (should say "in another district, show all?"); "Change area" clears the sidebar filter; `aria-label="District"`/`"Prepare"` are English in the HTML. To re-check after P35/P18: `auth.roles.user.desc` promises numbers on a new phone and report tracking.
- **#73 → PR #88 (merged):** sign-in is a two-panel `<dialog>` over the current page (999 link first inside it, Escape/× close, focus returns). Firebase loads **only after a tap** (never on load, link, reload or Back to `#/account`); slow-network race fixed; Google/Firebase error codes mapped to calm bn/en texts; offline text without trying. Agents: developer, bangla-reviewer (8 text fixes applied), tester GO. Rules 35/35. After review: `auth/internal-error` named, stale comment in firebase.js fixed. Tests with a stubbed Firebase (no real account): p73 ALL OK (no Firebase request before a tap), routes73 ALL OK (replaces routes71: the account button now opens the modal instead of changing the address), page check OK, search 26/0, validator 0. Not done: "signal ring" on the sign-in page; a real Google sign-in with a test account on the live site (NEEDS JERIN).
- **#74 → PR #89 (merged):** new `reset.html` + `js/reset.js` (action-URL page for reset emails): 999 in the HTML (shows before scripts and offline), Firebase loaded with `import()` only for `mode=resetPassword` with a code and online; masked email, new password twice with show/hide, calm errors (expired/invalid/weak/mismatch/network/too many), offline text, `continueUrl` only for this site, the code and email never logged. Both files cached, VERSION v10. Agents: developer, bangla-reviewer (OK + 3 small polishes applied), tester **NO-GO** (the service worker stored the full reset link with the one-time code in Cache Storage) → fixed (cache saved without the `?` part; code removed from the address bar) → GO. Rules 35/35. Stub tests: p74 ALL OK (55 checks incl. airplane mode from cache), check74 ALL OK (24 runs), p73/routes73 OK, search 26/0, validator 0.
  Can wait: when Firebase fails to load, the text says "could not be changed" though nothing was tried; inputs lack `aria-invalid`/`aria-describedby` to the message.
- **#75 → PR #90 (merged):** per saved person in the SOS view: SMS (main, works offline), Call, WhatsApp (`whatsapp://send`, "did not open" note + copy after 1.5 s), Messenger on phones only (map link only, falls back to the share menu), "Other app" (share menu or copy). Offline: WhatsApp/Messenger disabled with "needs internet". No network request on tap, nothing counted. Agents: developer, bangla-reviewer (3 fixes applied: SMS offered first), tester GO. After review: saved numbers are cleaned before use in links (an old "+88…" entry gave a broken WhatsApp link). p75 86 checks OK, page check OK, p73/routes73 OK, search 26/0, validator 0, rules 35/35 (the developer ran them against the emulator already on port 8080, java PID 20600 started 09:13; it may be Jerin's own emulator, and the test clears its data).
- **#78 → PR #91 (merged):** workspace on `#/account` when signed in: dashboard, my people (local `sc-family`, works offline; **sync off by default**; on = copy only `{name, relation, phone}` to `family/{uid}/people`; off = delete the copy), saved areas (`sc-places`, max 5, local), reports (empty text for now), settings (language, colours, sync), sign out (choice to also remove local data; sync flag always cleared). Firebase still only after a tap. **No rule change** (the existing family rule fits); 7 new emulator tests → rules 42/42. Agents: developer, bangla-reviewer (9 text fixes: the sync text now says names, relations and numbers are copied, saved areas are not), tester **NO-GO** (a signed-in account with its own copy could upload another person's numbers left on the phone) → fixed (upload only while the copy is on for this phone; new test 4b fails on the old code, passes on the new) → GO. Rules 42/42, CI rules check passed. p78 ALL OK, sw78 (offline) OK, p73/p75/routes73 OK, search 26/0, validator 0. Not done: "Save this area" on the area page; saved-areas sync; reports list (P18); changes on `#/send` reach the account copy only on the next workspace open.
  Can wait: turning sync on replaces the account copy with the phone list (needs a tap, the text says so; later: ask which to keep); the sync flag could store the uid; issue #78 "Done when" still says 35/35 (now 42).
- **#79 → PR #92 (merged):** "Report a wrong number" link on area contact rows → 3-step dialog (999 first; record from data; 4 allowed problems + optional note ≤ 300 with a "no personal data" hint; honest "a report changes no number" line). Firebase loads only on "Send"; signed out → the #73 sign-in modal. Offline: Send off with a calm note. My reports (own only, 4 statuses, dashboard count). Admin "Check reports" (admins only: newest 100, filters, status change with its audit entry; reporter uid never shown). **No rule change**; 9 new emulator tests → rules 51/51. Agents: developer, bangla-reviewer (12 text fixes), tester GO (rules 51/51 in its own copy). After review: a report status is saved only once per tap. p79 47 checks OK, p78/p73/p75/routes73 OK, search 26/0, validator 0.
  **Gaps from the existing rules (decision for Jerin):** national hotlines (999, 333…) cannot be reported (rules need district noakhali/coxsbazar); no "which number" field (rules allow no phone field; use the note); no "place is missing" report (needs a recordId); the footer/help "Report a wrong number" links still open GitHub. Admin list: newest 100 only; the audit log is read in P44.
- **#65 → PR #93 (merged, rules deployed):** admin workspace (admins only): dashboard (open reports; applications/volunteers "not built yet"; last source check from `data/verify_report.json`), users and roles (role change = one batch with its audit entry; own role and "admin" locked; new admins only in the Firebase console), audit log (append-only; filters type/person/date). **Rules tightened, none weakened:** role change needs `getAfter()` audit entry with the true old/new role, never your own role; an audit entry only together with the change it is about (`changedWith`); action/entity pairs, id format, meta keys/sizes. 3 new audit indexes. 17 new tests → rules 68/68. Agents: developer, bangla-reviewer (6 fixes + 3 polishes: accurate last-check and audit texts, no "later update" promises), tester GO (rules 68/68 in its own copy + 9 extra bypass tests). After review: an admin cannot change another admin's role (new test fails on the old rules, passes on the new) → rules 69/69. Deployed with `npx firebase deploy --only firestore:rules,firestore:indexes --project safeconnect-67d83`: rules compiled and released, indexes deployed. p65 ALL OK, p79/p78 OK, search 26/0, validator 0.
  Can wait: report-status audit meta is limited to from/to strings but not yet checked against the real old/new status; the "last source check" is the last full check (22 Oct) because the weekly Action does not commit its result.
  Follow-up issue to open (from the tester): report-status audit meta is not checked against the real old/new status; a lone audit entry is accepted if a user document already has a dangling `lastAuditId` (only possible via the console).
- **#52 → PR #94 (merged):** checkout v4→v7, setup-python v5→v7, setup-node v4→v7, setup-java v4→v6 (latest majors from each action's releases page, 2026-10-29); `ubuntu-latest` → `ubuntu-24.04` everywhere; the rules workflow now also runs when its own file changes. Agents: tester GO (all 3 jobs green on ubuntu-24.04, no Node 20 annotations). Can wait: tick "run the weekly check by hand" after the next Monday run on main; a small issue for the later move to Ubuntu 26.
- **#80 (P13):** new `tools/spot_check.py` (standard library; seed 20261028 → same 40 records as the source-researcher; `--auto` opens each source page once, 1.2 s apart, certificate checks on) writes `data/spot_check_40.csv` with empty `human_ok` / `checked_by` / `checked_on` columns. Hint: 39 of 40 found, 1 not found (`acd98005cc`, listed in `docs/DATA_GAPS.md` §11). No record is marked verified: a person must check each row by hand first. Validator 0 errors.
