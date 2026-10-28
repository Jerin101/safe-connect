# Autopilot log

## NEEDS JERIN (only you can do these)
- [ ] Firebase console: set the password-reset email template and the action URL (for #74).
- [ ] Admins, part F (Firebase console, by hand).
- [ ] Remove `localhost` from Firebase Auth authorized domains before v1.0.
- [ ] Google Cloud console: add website restrictions to the Firebase API key.
- [ ] GitHub settings: turn on Secret scanning and Push protection (for #77).
- [ ] Test on your real phone (airplane mode, 360 px, Bangla and English, night and day).
- [ ] P13 (#80): open the 40 sample links by hand before setting `status: verified` (sample below).

**Where to continue:** step 2, #77 on branch `feature/77-secret-scan` (open the PR, wait for the checks, tester GO, merge). Then step 3, #69 on `feature/69-base-css` (2 commits ready).

| Step | Task | Issue | Branch | PR | Status |
|---|---|---|---|---|---|
| 1 | Design v3 reference and plan | #68 | docs/68-design-v3 | #76 | done: #68 closed, merged in PR #76, nothing waiting |
| 2 | Secret scan (gitleaks + rule in CLAUDE.md) | #77 | feature/77-secret-scan | #83 | in progress: tester NO-GO fixed (allowlist target), local scan clean, fake token caught |
| 3 | css/base.css + v3 colours | #69 | feature/69-base-css | - | ready: style move (360 px screenshots identical before/after), v3 colours; page check 8/8 OK |
| 4 | New header | #70 | - | - | to do |
| 5 | Real pages with routes | #71 | - | - | to do |
| 6 | New home layout (+ "তিন ভূমিকা, এক লক্ষ্য") | #72 | - | - | to do |
| 7 | Sign-in modal + Google error messages | #73 | - | - | to do |
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
