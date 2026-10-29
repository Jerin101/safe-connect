# Autopilot log

## NEEDS JERIN (only you can do these)
- [ ] Firebase console: set the password-reset email template and the action URL (for #74).
- [ ] Admins, part F (Firebase console, by hand).
- [ ] Remove `localhost` from Firebase Auth authorized domains before v1.0.
- [ ] Google Cloud console: add website restrictions to the Firebase API key.
- [ ] GitHub settings: turn on Secret scanning and Push protection (for #77).
- [ ] Test on your real phone (airplane mode, 360 px, Bangla and English, night and day).
- [ ] P13 (#80): open the 40 sample links by hand before setting `status: verified` (sample below).
- [ ] Try a real Google and email sign-in with a **test account** on the live site after #73 (the error texts were only tested with a stub).

**Where to continue:** step 7, PR for #73 (branch `feature/73-signin-modal`): wait for checks, tester GO and bangla-reviewer OK, merge, check the live VERSION is `v9-2026-10-29`. Then step 8, #74 (password-reset page, code only).

**How each PR is checked (tools kept outside the repo, in the session scratchpad):** Playwright (`npm i --no-save playwright-core@1.48.2`, uses the installed Chrome) runs every page at 360/1280 px, day/night, bn/en: sideways scroll, 999 visible and first, console errors; it also runs `tests/search-test.html`. Rules tests run from PowerShell (`npm run test:rules`); if port 8080 is taken by another emulator, run them in a copy with port 8085.

| Step | Task | Issue | Branch | PR | Status |
|---|---|---|---|---|---|
| 1 | Design v3 reference and plan | #68 | docs/68-design-v3 | #76 | done: #68 closed, merged in PR #76, nothing waiting |
| 2 | Secret scan (gitleaks + rule in CLAUDE.md) | #77 | feature/77-secret-scan | #83 | done: merged. Tester NO-GO (allowlist target) fixed, then GO. Local scan clean, fake token caught. Rules 35/35, validator 0 errors, search 26/0 |
| 3 | css/base.css + v3 colours | #69 | feature/69-base-css | #84 | done: merged, live `v5-2026-10-28`, offline reload OK |
| 4 | New header | #70 | feature/70-new-header | #85 | done: merged, live `v6-2026-10-28`, offline reload OK |
| 5 | Real pages with routes | #71 | feature/71-routes | #86 | done: merged, live `v7-2026-10-28`, offline `#/faq` OK |
| 6 | New home layout (+ "তিন ভূমিকা, এক লক্ষ্য") | #72 | feature/72-home-layout | #87 | done: merged, live `v8-2026-10-28`, offline reload OK |
| 7 | Sign-in modal + Google error messages | #73 | feature/73-signin-modal | (this PR) | in review |
| 8 | Password-reset page (code only) | #74 | - | - | to do |
| 9 | Share buttons | #75 | - | - | to do |
| 10 | P35 user workspace | #78 | - | - | to do |
| 11 | P18 wrong-number reports | #79 | - | - | to do |
| 12 | P44 admin workspace | #65 | - | - | to do |
| 13 | Action versions | #52 | - | - | to do |
| 14 | P13 spot-check of 40 contacts | #80 | - | - | research done (see below) |
| 15 | Inani Coast Guard number | #49 | - | - | research done (see below) |
| 16 | P38 / P39 volunteers (only if all above merged) | #81 / #82 | - | - | waiting |

Reminder: volunteer and report tests use a test account and a fake code, and the test data is deleted afterwards.

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
- **#73:** sign-in is a two-panel `<dialog>` over the current page (999 link first inside it, Escape/× close, focus returns). Firebase loads **only after a tap** (never on load, link, reload or Back to `#/account`); slow-network race fixed; Google/Firebase error codes mapped to calm bn/en texts; offline text without trying. Agents: developer. Tests with a stubbed Firebase (no real account): p73 ALL OK (no Firebase request before a tap), routes73 ALL OK (replaces routes71: the account button now opens the modal instead of changing the address), page check OK, search 26/0, validator 0. Not done: "signal ring" on the sign-in page; a real Google sign-in with a test account on the live site (NEEDS JERIN).
