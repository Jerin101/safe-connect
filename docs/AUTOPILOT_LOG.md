# Autopilot log

## Summary (7 Nov 2026, queue v3)

**Live:** https://jerin101.github.io/safe-connect/ = `main` (#142 site at index.html, #146 phone layout, #148 saved area; merged 6 Nov). Firestore rules were last deployed on 2 Nov from `1274fd9`; **#160 needs a new deploy after it is merged.**

**Repo folder:** the project moved to `E:\Projects\safe-connect` (fresh clone, 6 Nov). Old copies: `E:\New folder\Downloads\Project_Capstone\safe-connect-old-2026-11-05` and `C:\Users\ASUS\Downloads\Project_Capstone\safe-connect` (still to rename, see below).

| PR | Queue step | State |
|---|---|---|
| [#163](https://github.com/Jerin101/safe-connect/pull/163) | Follow-up to #148/#146: saved-area icon fixes and width-sweep fixes (#148 and #146 were merged before these) | **merge first**: live main has the two icon bugs |
| [#144](https://github.com/Jerin101/safe-connect/pull/144) | 2: বিপদ বার্তা review fixes (short link, thana OC, SMS texts within 3 parts, fresh location) | tester GO |
| [#150](https://github.com/Jerin101/safe-connect/pull/150) | 5.1: smart-search plan + Kashem Bazar | tester GO; Jerin to confirm the village |
| [#152](https://github.com/Jerin101/safe-connect/pull/152) | 5.2: query understanding | fixes for 2 NO-GOs done; the re-review was cut off by the usage limit |
| [#154](https://github.com/Jerin101/safe-connect/pull/154) | 5.3: thana names (`data/thanas.json`) | same re-review |
| [#156](https://github.com/Jerin101/safe-connect/pull/156) | 5.4: full address in results | same re-review |
| [#158](https://github.com/Jerin101/safe-connect/pull/158) | 5.5: landmarks from the union pages | NO-GO fixed (copied lists, prose); same re-review |
| [#160](https://github.com/Jerin101/safe-connect/pull/160) | 5.6: when nothing matches + `missing_place` requests (rules tests 90/90) | same re-review; **rules deploy after merge** |
| [#162](https://github.com/Jerin101/safe-connect/pull/162) | 6: prepare page (phone SOS) + live location | Bangla and tester review cut off by the usage limit |
| Step 7 | docs move, README, tidy-ups | **not started**: moving docs now would conflict with every open PR; do it after the merges |

**Merge order:** #163 → #144 → #150 → #152 → #154 → #156 → #158 → #160 → #162. Each builds on the one before.

**Search check for #152–#160:** every name in main's index (1,545, villages included) is still found, and no first result changes. 160 union+upazila pairs pick the right union; the 3 where the union has the upazila's own name show it second.

## NEEDS JERIN

- [ ] **Merge #163 first** (live bug), then the order above as each PR gets tester GO.
- [ ] **Rename the old C: folder** after closing VS Code: `C:\Users\ASUS\Downloads\Project_Capstone\safe-connect` → `safe-connect-old-2026-11-05`. Then reopen Claude Code in `E:\Projects\safe-connect`.
- [ ] **Kashem Bazar (#150):** the official Newajpur page lists it in নিয়াজপুর ইউনিয়ন. Please confirm the village is ধর্মপুর (Noakhali Sadar also has a whole ধর্মপুর union).
- [ ] **Thanas (#154):** 7 Cox's Bazar rows have only "portal" proof: the thana's own official site sits under the upazila's address. Is that OK, or should they be marked "not confirmed"?
- [ ] **Deploy the rules after #160 is merged:**
  1. Run `npm run test:rules` on main.
  2. Then run `npx firebase deploy --only firestore:rules,firestore:indexes --project safeconnect-67d83`.
  3. Then send one real "জায়গাটা যোগ করতে বলুন" request with a test account.
- [ ] **Data fix through the tools:** 3 garbled English union names ("Narottampurup1", "Mohammadpuru5P", "Mohammadpurup7").
- [ ] **realme SOS page (#162):** open https://www.realme.com/in/support/kw/doc/2077523 in a browser. If it has steps, they can be added. No official SOS page was found for OPPO, vivo, Infinix or Tecno.
- [ ] **Old branches:** delete these when you're sure. 66 merged branches were already deleted, and "Automatically delete head branches" is on.
  - `feature/134-bipod-barta`: its extra commit is in #144.
  - `fix/145-phone-layout`: its extra commits are in #163.
  - `feature/53-offline-app`: old, never merged.
  - `toshi`: a person's branch, kept.
- [ ] **Still open from 2 Nov:**
  - set the password-reset action URL in the Firebase console
  - add Tasmin as admin
  - real sign-in test with a test account
  - Android Messenger/WhatsApp check
  - P13 spot-check (#80)
  - the Firebase CLI login on the old PC
  - remove `localhost` before v1.0

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
