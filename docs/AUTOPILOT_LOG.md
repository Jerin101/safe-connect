# Autopilot log

## Summary (9 Nov 2026, merge queue done)

**Live:** https://jerin101.github.io/safe-connect/ = `main` at `9b57973`, `VERSION = 'v49-2026-11-09'`. Firestore rules and indexes were deployed on 9 Nov from `4167be2` (#160 merged; rules tests 90/90 on main first).

**Live check (9 Nov, headless Chrome, fresh profile, 360 px; nothing sent to Firebase):**
- the service worker installs; the only cache is `safeconnect-v49-2026-11-09`
- "kashem bazar" → কাশেম বাজার, ধর্মপুর, নিয়াজপুর ইউনিয়ন, নোয়াখালী সদর (সুধারাম মডেল থানা), নোয়াখালী
- "sudharam" → সুধারাম মডেল থানা (নোয়াখালী সদর উপজেলা)
- the help link in the বিপদ বার্তা SMS opens `#/help/…` on the live site (200)
- offline: the site loads after a reload, and both searches work
- old `preview.html` links forward to the site with their `#/…` part kept
- no page errors

**Merged (all with merge commits):**

| PR | What | Merge commit |
|---|---|---|
| [#163](https://github.com/Jerin101/safe-connect/pull/163) | saved-area icon and width-sweep fixes | `8f53b13` |
| [#144](https://github.com/Jerin101/safe-connect/pull/144) | বিপদ বার্তা review fixes | `eb64a89` |
| [#162](https://github.com/Jerin101/safe-connect/pull/162) | prepare page (phone SOS) + live location | `cd063be` |
| [#150](https://github.com/Jerin101/safe-connect/pull/150) | 5.1 smart-search plan + Kashem Bazar | `14fa307` |
| [#152](https://github.com/Jerin101/safe-connect/pull/152) | 5.2 query understanding | `144551b` |
| [#154](https://github.com/Jerin101/safe-connect/pull/154) | 5.3 thana names | `337f319` |
| [#165](https://github.com/Jerin101/safe-connect/pull/165) | fixes from the #162 post-merge review | `412edfd` |
| [#156](https://github.com/Jerin101/safe-connect/pull/156) | 5.4 full address in results | `f4be1df` |
| [#158](https://github.com/Jerin101/safe-connect/pull/158) | 5.5 landmarks from the union pages | `9ebe882` |
| [#160](https://github.com/Jerin101/safe-connect/pull/160) | 5.6 when nothing matches + `missing_place` requests | `4167be2` |
| [#168](https://github.com/Jerin101/safe-connect/pull/168) | VERSION only, v48 → v49 | `9b57973` |

**#158, three NO-GOs, all fixed before the merge:**
- landmarks outranked an exact village or union ("ঈদগাও", "উত্তর মোহাম্মদপুর")
- Khurushkul's college and school pages list the whole Cox's Bazar Sadar upazila
- prose and headings were taken as names, and some mosques had the wrong type
- one copied page ("সুবিল ইউনিয়নে মোট মসজিদের সংখ্যা - ২২ টি") sits on 8 union sites; its 22 mosques had been filed under বড়ঘোপ

The data was rebuilt from the saved pages, with no new requests: 41 rows dropped and 21 types fixed.

**#160 review:**
- Bangla review: 5 text changes; the sent message no longer promises the place will be added
- security review: a phone number in `upazila` is now refused, in the rules and in `missingFields()`
- tester: the width sweep passed 7392/7392, and no coordinate is stored or sent (checked with a faked GPS fix)

**Search checks on main** (sweeps in the session scratchpad):

| Check | Result |
|---|---|
| same-named unions | 472/474 |
| union+upazila | 634/640 |
| village+upazila | 808/810 |
| village + wrong district, exact village first | 754/761 |
| search tests | 80/80 |
| names lost against the old main | 0 |

**Open notes (not blockers):**
- [#167](https://github.com/Jerin101/safe-connect/issues/167): English names for the towns, from the BBS/HDX data. "নোয়াখালী সদর, নোয়াখালী" stays as it is.
- If `villages.json` fails to load, `loadAll` turns it into an empty list with no error, and village search quietly stops. The sweeps sometimes ran on such a small index.
- A missing-place request may also carry `area` and `note`. `area` has no phone check; this is older than #160.
- A loose match limits the step picker and the ask form to one district. Example: "ঝুমঝুমপুর খালপাড়" lists only Noakhali upazilas, prefilled with Chatkhil / খিলপাড়া.
- Search:
  - the "elsewhere" note can contradict the result
  - "chhayani begumganj"
  - "uttar" alone
  - "ukhiya thana" and "ukhiya police station" give no result (only "similar")
- Data cleanup rows: "/রাস্তা: উত্তর মানিকপুর", "ত্তর মানিকপুর", the village "ইউনিয়ন পরিষদ".
- The Apple label "Call with 5 Presses" (#162) is not confirmed on an official Apple page.
- Leftover Firestore emulators from test runs:
  - PID 18036 on 8080 and 9150. It blocks `npm run test:rules`; the tests ran on other ports with a temporary config.
  - PID 27252 on 8088.
  - PIDs 13144, 27412 and 9604 on 8095, 8097 and 8099.
  - Close them, or restart the PC.

**Next, each needs your OK first:** the permanent deploy fix (GitHub Actions Pages deploy with `VERSION` set by the deploy), step 7 (docs move, README, tidy-ups), and the `E:\Projects\SafeConnect-Files` folder.

## NEEDS JERIN

- [ ] **Rename the old C: folder** after closing VS Code: `C:\Users\ASUS\Downloads\Project_Capstone\safe-connect` → `safe-connect-old-2026-11-05`. Then reopen Claude Code in `E:\Projects\safe-connect`.
- [ ] **Kashem Bazar (#150):** the official Newajpur page lists it in নিয়াজপুর ইউনিয়ন. Please confirm the village is ধর্মপুর (Noakhali Sadar also has a whole ধর্মপুর union).
- [ ] **Thanas (#154):** 7 Cox's Bazar rows have only "portal" proof: the thana's own official site sits under the upazila's address. Is that OK, or should they be marked "not confirmed"?
- [ ] **Send one real "জায়গাটা যোগ করতে বলুন" request** with a test account. The rules were deployed on 9 Nov from `4167be2`.
- [ ] **Thanas (#154):** Begumganj may be a মডেল থানা (the contacts file). Please check.
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
