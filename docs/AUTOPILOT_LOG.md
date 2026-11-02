# Autopilot log

## Summary (2 Nov 2026)

**Live:** https://jerin101.github.io/safe-connect/preview.html, service worker **`v28-2026-11-02`**. That is `main` at `3114067` (after PR #135), and all checks on `main` are green.

**Firestore rules and indexes:** deployed today from `main` at **`1274fd9`**, after `npm run test:rules` passed **83/83** on that commit. The report limits (M1) and the phone-number check in notes (L3) now apply on the live site.

**PRs since #109:**

| PR | What | State |
|---|---|---|
| [#109](https://github.com/Jerin101/safe-connect/pull/109), [#110](https://github.com/Jerin101/safe-connect/pull/110), [#111](https://github.com/Jerin101/safe-connect/pull/111), [#112](https://github.com/Jerin101/safe-connect/pull/112), [#114](https://github.com/Jerin101/safe-connect/pull/114) | UI clarity 1–5 (#108) | merged |
| [#116](https://github.com/Jerin101/safe-connect/pull/116) | UI/UX test reports and README Testing section (#115) | merged |
| [#119](https://github.com/Jerin101/safe-connect/pull/119) | Secret alert #1 explained, SECURITY.md (#118) | merged |
| [#120](https://github.com/Jerin101/safe-connect/pull/120) | C1 = M1: report limits (#117) | merged |
| [#122](https://github.com/Jerin101/safe-connect/pull/122) | C2 = M3: Content-Security-Policy (#121) | merged |
| [#124](https://github.com/Jerin101/safe-connect/pull/124) | C3 = L3: no mobile numbers in report notes (#123) | merged |
| [#126](https://github.com/Jerin101/safe-connect/pull/126) | C4 = L1: Actions pinned to SHAs, Dependabot (#125) | merged |
| [#128](https://github.com/Jerin101/safe-connect/pull/128) | C5 = L2: rules-test dev tools updated (#127) | merged |
| [#130](https://github.com/Jerin101/safe-connect/pull/130) | Audit report + FAQ for shared phones (#129) | merged |
| [#135](https://github.com/Jerin101/safe-connect/pull/135) | Header and pages with large text, 44 px district menu, Hatiya post in English (#113) | merged today |
| [#133](https://github.com/Jerin101/safe-connect/pull/133) | Rules tests on every PR, so they can be a required check (#132) | **open: for Jerin** |
| [#136](https://github.com/Jerin101/safe-connect/pull/136) | বিপদ বার্তা step 1 (#134) | **open: don't merge** before the SMS text review |
| [#138](https://github.com/Jerin101/safe-connect/pull/138) | autoloc test always removes its Chrome profile (#137) | **open: for Jerin** |
| this PR | this log (#139) | open |

## NEEDS JERIN (only you can do these)

- [ ] **Merge [#133](https://github.com/Jerin101/safe-connect/pull/133), then make the rules test required.** GitHub → Settings → Rules → Rulesets → **main** → Require status checks to pass → Add checks → type `rules` → pick it → Save changes. (It can't be required before #133: PRs that don't touch the rules would wait for it forever.)
- [ ] **Review the বিপদ বার্তা SMS texts with Claude chat:** [#136](https://github.com/Jerin101/safe-connect/pull/136) and `docs/plans/bipod-barta.md` → "Questions for the review". Merge only after that. Also check on a real iPhone whether a group SMS opens (we assume one person at a time).
- [ ] **Merge [#138](https://github.com/Jerin101/safe-connect/pull/138)** (test clean-up) after a look at the diff.
- [ ] **Password-reset email (Firebase console):**
  1. Authentication → Templates → Password reset → edit.
  2. "Customize action URL" → `https://jerin101.github.io/safe-connect/reset.html`. The API refuses this change on the free plan, so it must be done in the console.
  3. Sender name "SafeConnect", with a Bangla subject and text.
  4. Then test one real reset with a **test account** on the live site, and delete that account afterwards.
- [ ] **Add Tasmin as admin.** Her User UID is in Authentication → Users. In Firestore create `admins/<her UID>` with `since` (timestamp) and `addedBy` = `console` (`docs/FIREBASE_SETUP.md` part F).
- [ ] **Real sign-in test with a test account** on the live site: Google and email sign-in, one "wrong number" report (it now needs a verified email), and workspace sync on/off. Then delete the test account and its `users`, `family`, `reports` and `limits` documents in the console (audit entries can only be deleted there).
- [ ] **On a real Android phone (#75):** does Messenger open with the map link, and does WhatsApp open with the message?
- [ ] **P13 (#80):** open each link in `data/spot_check_40.csv`, then fill in `human_ok`, `checked_by` and `checked_on`. Row `acd98005cc` is already known not to match.
- [ ] **Firebase CLI login on this PC:** it was already logged in to an account with access to safeconnect-67d83 (see which with `npx firebase login:list`). Today's rules deploy used that login. I didn't log in, so I didn't log out. If this login shouldn't stay, run `npx firebase logout`.
- [ ] **Three leftover Firestore emulators** from today's rules runs. On Windows, `firebase emulators:exec` doesn't stop its Java process, and I wasn't allowed to stop them.
  - The processes: port 8080 = PID 30492, port 8085 = PID 10212, port 8086 = PID 19776 (all `java.exe`, started 19:09–19:19).
  - Close them in Task Manager, or run `Stop-Process -Id 30492,10212,19776` in PowerShell.
- [ ] **Delete the untracked folder `safeconnect-uiux-reports/`** in the project root (queue part G). I wasn't allowed to delete it. I checked it first: all 81 files are already in the repo under `docs/testing/`. 79 match exactly or differ only in line endings, and the 2 READMEs in the repo are the later, corrected wording.
- [ ] **Before v1.0:** remove `localhost` from the Firebase authorized domains and from the API key's websites.

Removed from the old list because they are done: API key restriction · secret scanning and push protection · Jerin's own admin · real-phone test (30 Oct) · the old emulator processes from 29 Oct.

## Queue results (CLAUDE_CODE_QUEUE_v2)

### A–D: Security (audit, 31 Oct)

- **API key restricted: yes.**
  - The browser key keeps its websites and is limited to the Identity Toolkit, Token Service, Cloud Firestore and Firebase Installations APIs (changed via gcloud on 31 Oct).
  - Claude chat checked the live site on v27: no CSP errors, Firebase loads, and email sign-in reaches the Identity Toolkit with the calm "wrong email or password" message.
  - The local key backup was deleted after that check. It was never in the repo.
- **Email enumeration protection:** on.
- **Reset link:** still the default Firebase page. Changing it needs the console (see NEEDS JERIN).
- **Service-account keys:** none created by people.
- **Secret-scanning alert #1:** closed as "won't fix". It is the public Firebase web key, explained in `SECURITY.md`. Secret scanning and push protection are on.
- **C1–C5:** [#120](https://github.com/Jerin101/safe-connect/pull/120) (M1) · [#122](https://github.com/Jerin101/safe-connect/pull/122) (M3) · [#124](https://github.com/Jerin101/safe-connect/pull/124) (L3) · [#126](https://github.com/Jerin101/safe-connect/pull/126) (L1) · [#128](https://github.com/Jerin101/safe-connect/pull/128) (L2), all merged.
- **Audit report:** `docs/security/2026-10-31-audit.md` ([#130](https://github.com/Jerin101/safe-connect/pull/130)). All findings are fixed. Its "still for the team" items are now:
  - rules deployed (today)
  - private vulnerability reporting on (today)
  - gitleaks required (today)
  - reset URL and `localhost` still open (see NEEDS JERIN)
- **GitHub settings (today, via `gh api`):**
  - Private vulnerability reporting is **on**.
  - Ruleset **main** is **active** on the default branch:
    - requires a pull request (0 approvals, so the team can merge its own PRs)
    - requires the `gitleaks` check
    - blocks force pushes and branch deletion
  - `rules` gets added after #133 (see NEEDS JERIN).

### E: বিপদ বার্তা, step 1 ([#136](https://github.com/Jerin101/safe-connect/pull/136), open, don't merge)

- **Plan and exact SMS texts with part counts:** `docs/plans/bipod-barta.md`.
  - Bangla: 3–4 SMS. Short English: 2. Safe message: 1.
- **Built:**
  - big red button
  - SMS with area, police number and help link
  - short English option
  - 999 card
  - after-tap controls ("new location", "I am safe")
  - family help page `#/help/…` with the 999 → থানা → health complex → UNO call steps
  - calm page for broken or outside links
- **Rules kept:** nothing is stored or uploaded, no sign-in, never says "sent", CSP unchanged.
- **Checks:**
  - unit tests 10/10
  - browser check at 360/1366 px, bn/en and dark, with no console errors
  - `/security-review`: no findings
  - bangla-reviewer: 6 wording fixes applied. The SMS now says "আগে 999-এ কল করো" with normal digits, so phones make it tappable.
  - tester: see the PR comments
- **Step 2, not built:** the phone SOS setup guide per brand and the WhatsApp live-location steps. Both need each company's official help page checked first.

### F: Issues

- **#113:** merged in [#135](https://github.com/Jerin101/safe-connect/pull/135).
  - Checks: 60-case header test 60/60, tester GO, `/security-review` with no findings, service worker v28.
  - Tester: home 78/78, area 78/78, phones ≤ 430 px pixel-identical to main, post() over all 445 posts with only the 4 intended changes.
- **#98 (sync: which copy to keep, uid with the sync flag):**
  - Still needed: on a shared phone, the flag without the uid could apply to the next account (see audit L4).
  - Size: medium, about half a day (a choice dialog, storing the uid in the flag, p78-style tests).
- **#100 (test counts, Ubuntu 26):**
  - Still needed but small. The rule-test count is now **83**, not 69.
  - Move to the next Ubuntu LTS runner only when GitHub lists it. The weekly-check tick still needs a Monday run on main.
  - Size: small, under 30 min of docs.
- **#101 (report-status audit meta, lone audit entry):**
  - Still needed as hardening. The risk is low: only admins change status, and a dangling `lastAuditId` needs the console.
  - Size: small to medium (2 rule changes, 2 emulator tests that fail on the old rules, then a rules deploy).

### G: Clean-up

- **Disk:** it was full (0 GB free), mostly from 70 leftover headless Chrome profiles (6.15 GB) and old session scratch folders (1.76 GB). Both were deleted, and 11 GB is free now.
- **Test scripts:**
  - The session's scripts now stop below 5 GB free and always delete their profile.
  - The repo test follows in [#138](https://github.com/Jerin101/safe-connect/pull/138).
- **npm cache:** verified, 668 MB, under 1 GB, so not cleaned.
- **Firebase emulator files** in `~/.cache/firebase`: not touched.
- **Untracked `safeconnect-uiux-reports/`:** see NEEDS JERIN.

## How PRs are checked

- **Each PR:** one issue and one branch.
  - Tests green, tester GO and `/security-review` before every merge.
  - bangla-reviewer for any text people read.
  - Raise the service-worker VERSION when a cached file changes.
- **Browser checks** drive the installed Chrome over the DevTools protocol, with no packages.
  - Every run checks for at least 5 GB free and deletes its temporary profile, even after an error.
- **Rules tests:** `npm run test:rules`.
  - If port 8080 is taken by a leftover emulator, use a copy of `firebase.json` with another port and `--config`.

Older entries (the 28–29 Oct autopilot, PRs #76–#95): see this file's Git history before this PR.
