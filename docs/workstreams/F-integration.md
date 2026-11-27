# Workstream F: Final integration, documents and release

Paste this whole file into a new Claude session opened in `E:\Projects\safe-connect-f`. First read `CLAUDE.md`, `docs/PROJECT_COMPLETION_STATUS.md` and `docs/workstreams/README.md`.

## Gate
F starts the **integration** part only when B, C and D (M1.3) report "merged and reviewed" (gate G5). Some document work does not depend on that and may start earlier: the CI wiring plan, README and docs index, the test inventory, the presentation outline. Say in the handoff which parts you did before G5, so the human can re-check them after it.

## Tasks (stop after the first PR-sized piece; each bullet can be its own PR)
1. **Integration check:** `git fetch`, list merged and open PRs, read the handoff blocks in section 9 of the status file, confirm each workstream's branch is merged into `origin/main` (not "I think so"). Check there are no half-merged interfaces (I1 to I4). Report anything missing.
2. **CI wiring:** a new `.github/workflows/test-site.yml` that runs the hand-run tests (`routes-test`, `near-test`, `dakun-test`, `track-test`, `siren-test`, `reportqueue-test`, `offlinepack-test`, `verify-test`, `pwa-test`) against a local `python -m http.server`, using the headless Chrome that is on the GitHub runner. Free tier only. Do not edit other streams' workflows.
3. **Full regression:** run every test in `docs/workstreams/README.md` section 3 and the page tests at 360 px, 390 px and desktop; bn and en; night and day; offline (airplane mode) for the offline list in `docs/BUILD_PLAN.md` section 9. Report real output. Write failures as findings; do not fix other streams' files.
4. **Security and privacy check:** secret scan, CSP meta tag still valid (new outside resources need an entry), no coordinates stored or uploaded outside an explicit send, Firestore rules suite green (`npm run test:rules`), no `innerHTML` with data, no inline JavaScript.
5. **Documents:** refresh `README.md` (the folder guide stays), `docs/PROJECT_BRIEF.md` (numbers must be re-measured: tests, counts), `docs/PLAN_STATUS.md` (honest Done / Not-in-release table and the real test record), `docs/BUILD_PLAN.md`, `docs/FEATURES.md`, `docs/ROLES.md`, `docs/README.md` index.
6. **Diagrams** (new `docs/diagrams/`): the **Use Case diagram** (the release scope is 21 use cases: read `docs/PLAN_STATUS.md`; leave volunteer and owner/admin confirmation out as future work, no "planned" labels) and the **Firestore ER diagram** (read `firestore.rules` and `src/js/firebase.js`; every collection and field that really exists: users, admins, audit, reports, limits, family, placeStatus (+by), providers, rates, online, rideLimits, rides (+live), live_shares, shareLimits, places/saved, fare_rates, and any added by C). Draw from the code, not from old notes. Give the source file for each box.
7. **Coverage and testing reports** (new `docs/reports/`): coverage matrix of the 64 districts from `tools/coverage_report.py` output (no hand edits), test inventory (what runs in CI, what runs by hand, what passed on which commit), known limits stated honestly (no wake of a closed phone, no silent SMS, Banglish is rule-based, official numbers only in the districts that have them).
8. **Supervisor presentation, 10 to 12 slides** (new `docs/presentation/` or an Artifact of type slides if the human asks): problem, users and roles, what works offline, trust and verification, emergency escalation, privacy, live share, nationwide coverage with the honest numbers, architecture and zero budget, testing, limits and next steps, demo script. Every number comes from the reports above.
9. **Release preparation:** service-worker `VERSION` bump in its own chore PR, the NEEDS JERIN list (deploy `firestore.rules`, Pages source "GitHub Actions", API key referrer, admins, reset email template), the real-phone test checklist (SOS, live share, offline, sign-in time), then the tester agent's GO / NO-GO. The v1.0 tag is the human owner's decision, never yours.

## Files you own
See "Workstream F" in the status file, section 4: `README.md`, `docs/*` (not the data reports owned by E), `docs/diagrams/*`, `docs/presentation/*`, `docs/reports/*`, `tests/routes-test.mjs`, `tests/pwa-test.mjs`, `tests/dakun-test.mjs`, `tests/reportqueue-test.mjs`, `tests/verify-test.mjs`, `tests/README.md`, `pages.yml`, `secret-scan.yml`, `test-site.yml`, `VERSION` in `src/service-worker.js`, `journal/*`, `project_management/*`, Docker files.

## Files you must NOT change
Anything owned by B, C, D or E. If a test fails because of their file, report it with the file, the line and the failing output, and give it back to that workstream.

## Done when
Every item you claim is backed by command output or a file path in the handoff; documents say what is true on `origin/main` today; the human can run the demo from the script; the handoff ends with the GO / NO-GO result and the exact next action.
