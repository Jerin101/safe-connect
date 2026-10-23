# SafeConnect – System design (v2)

Official emergency and public-service contacts for every union and town in Noakhali and Cox's Bazar,
with three account roles: **user**, **volunteer** and **admin**. Free to run (GitHub Pages + Firebase Spark).
Visual rules: `docs/DESIGN.md` (updated in §7 below). Reference page: `design/portal-v2.html` (all public services + sign-in + workspaces, Bangla/English, night/day).

---

## 1. Principles
1. **Help first, account second.** 999, "আমার কাছের সাহায্য", search, area pages and SMS work signed out and offline. Sign-in never stands in front of help.
2. **Three sign-in options, one safe system.** The sign-in page offers user · volunteer · admin. The role stored in Firestore decides what opens, and security rules enforce it. Hiding a button is never the protection.
7. **Bangla and English everywhere**, including every workspace page. Night and day for every page.
3. **Official data only.** Every number comes from a `*.gov.bd` page with its source. People can *report* problems, but only reviewed changes through `tools/` and a PR change the data.
4. **Nothing private leaves the phone unless the person chooses.** Family numbers stay on the phone; syncing them to the account is optional.
5. **Every admin action is recorded.** The audit log is append-only.
6. **Free and realistic.** No paid services, no server code (Firebase Spark has no Cloud Functions). Rules plus small admin screens do the work.

## 2. Architecture
```
 Phone browser (PWA, works offline)
 ├─ Public pages  ── read ──> data/*.json (official contacts, cached by the service worker)
 ├─ Sign-in       ── Firebase Auth (email + password, Google)
 └─ Workspaces    ── read/write ──> Firestore (rules decide what each role may do)
                                      ▲
 GitHub Actions ── validate data on every PR · weekly source re-check ── opens data-gap issues
 tools/ (Python) ── collect → clean → verify official data → PR into data/
```
- **Hosting:** GitHub Pages (static, HTTPS).
- **Offline:** a service worker caches all pages, scripts, fonts and `data/` files. Workspaces show the last loaded view offline, and changes wait until the phone is online (Firestore offline persistence).
- **Backend:** Firebase Spark: Auth + Firestore. No Cloud Functions and no file uploads.
- **Data pipeline:** unchanged (collectors, validator, weekly check).

## 3. Roles
| Role | Who | How the role is given | Can |
|---|---|---|---|
| user | anyone signed in | automatic at first sign-in | manage own family numbers and saved places, report wrong numbers, see own reports, apply as volunteer |
| volunteer | approved applicant | admin approves (or an approved team leader, for their own team) | all of the above, plus own volunteer profile, "আমাকে দেখান", availability, team view; team leaders confirm their members |
| admin | jerin101, tasmintoshi | added by hand in the Firebase console (`admins/{uid}`), never from the site | review reports, verify applications, approve/pause volunteers, change roles, read the audit log, see data health |

## 4. Pages
**Public (no sign-in):**
- `/`: home
- `area`: area page (call order)
- `send`: send location to family
- `guide`: what happened? (situation guides)
- `about`, `faq`, `contact`
- `signin`: red "no sign-in needed" box (999, send location, help near me) → three options → form for the chosen option
- `confirm`: an official answers yes/no with a one-time code, without signing in

**User workspace (`/app`):**
- dashboard
- family numbers (on the phone; optional sync)
- saved places
- my reports
- new report (3 steps)
- become a volunteer (4 steps)
- settings
- sign out (with a confirmation)

**Volunteer workspace:** the user pages, plus my status, show me / availability / skills, and my team (leaders: confirm members).

**Admin workspace (`/admin`):**
- dashboard
- reports
- applications
- volunteers
- teams
- users and roles
- audit log
- data health (latest weekly check, validator result)

**Layout:**
- Desktop: a sidebar with groups **কাজ** and **অ্যাকাউন্ট ও সাহায্য**.
- Phone: a scrollable section bar under the top bar.
- The 999 button is in the top bar of every page, signed in or not.
- Every workspace sidebar has an "Emergency (works signed out too)" group: call 999, send location, help near me.
- Sign out is in the sidebar and, on phones, at the top of every workspace page; it asks first and says what stays on the phone.

## 5. Data model (Firestore)
| Collection | Fields | Who can read / write (rules) |
|---|---|---|
| `users/{uid}` | name, email, lang, createdAt, `role` (copy, for display) | owner reads and edits name/lang; **only admins change `role`** |
| `admins/{uid}` | since, addedBy | read: admins; write: nobody from the site (console only) |
| `family/{uid}/people/{id}` | name, relation, phone | owner only (exists only if the person turns on sync) |
| `places/{uid}/saved/{id}` | district, upazila, area | owner only |
| `reports/{id}` | uid, recordId, district, area, problem, note, status, createdAt, updatedAt | create: signed-in owner; read: owner + admins; update status: admins |
| `applications/{id}` | uid, name, phone, district, upazila, union/town, ward, skills, availability, status | create/read: owner; read/update: admins. Never public |
| `confirmations/{code}` | applicationId, confirmerRecordId, expiresAt, answer, answeredAt | get by exact code (no listing); update **only `answer`, once, before `expiresAt`** |
| `verifications/{appId}` | method, memo no., notes, checkedBy | admins only |
| `volunteers/{uid}` | displayName, union, ward, skills, available, showMe, teamId, status | read: signed-in users (only `status == active && showMe`); create: admin or that team's leader; edit showMe/availability: owner; "report" can only set paused |
| `teams/{id}` | name, union, leaderUid, approvedAt | read: signed-in; write: admins |
| `audit/{id}` | actorUid, action, entity, entityId, at, meta | **create only by an admin, with actorUid == own uid; never update or delete**; read: admins |

**Audit without server code:** every admin change is a **batched write** (the change + its `audit` entry). The rules use `getAfter()` to refuse an admin change whose audit entry is missing from the same batch.

## 6. Key flows
1. **Wrong number:** a user taps "ভুল নম্বর জানান" on a card. Step 1 shows the number (prefilled). Step 2 asks what is wrong (number off · different person · number changed · other) plus a note. Step 3 is a review, then `reports` gets the new report. An admin checks it against the official page, and if a fix is needed, it goes through `tools/` and a PR. The status the user sees moves through জমা হয়েছে → দেখা হচ্ছে → ঠিক করা হয়েছে / পরিবর্তন লাগেনি, and every change is audited.
2. **Volunteer:** apply (4 steps: area → about you → skills and time → review). The admin page picks the confirmer from official data (ward member → chairman/administrator → UP secretary; towns: municipal executive officer; team leaders: UNO). The admin sends a one-time `confirm` link by WhatsApp/SMS to the official's **published** number, or records a phone call or a প্রত্যয়নপত্র memo. On approval, `volunteers/{uid}` is created. The volunteer is visible only with "আমাকে দেখান" on, listed after the official contacts, with "Report this volunteer" (pauses them). Approval expires after 1 year or when the chairman changes. The applicant only ever sees যাচাই চলছে / অনুমোদিত / সাময়িক বন্ধ.
3. **Roles:** users can't change roles. An admin changes a role in Users and roles, with an audit entry. New admins are added only in the Firebase console.

## 7. Design language (classy, calm, ours)
Ideas taken from a role-based reference app; the identity stays SafeConnect.
- **Restraint:**
  - near-black night (warm white by day), 1 px borders, 12 px corners, soft shadows only on floating parts
  - **one accent colour** (violet); red only for 999 and danger, amber only for warnings, green only for "done"
  - no rainbow icon circles: monochrome line icons in quiet tiles
- **Typography:**
  - two-tone headlines, a bright first line and a softer second line: "বিপদে আছেন? / সরকারি নম্বর, এক জায়গায়।"
  - small accent eyebrows ("● জরুরি সাহায্য")
  - Manrope + Noto Sans Bengali, self-hosted
- **One signature element:** a soft "signal ring" (a location ping), used on the home banner and the sign-in page. Nothing else animates, and motion is off when the phone asks for less motion.
- **Layout:**
  - the public page keeps the portal order (banner with 3 actions, national numbers, search, situations, places, family/report cards, three roles, about, help, weak network, FAQ, footer)
  - home banner text on the left, signal panel on the right
  - "তিন ভূমিকা, এক লক্ষ্য" section
  - "কীভাবে কাজ করে" numbered steps beside stacked step cards
  - workspaces with a sidebar
  - number cards with "সব দেখুন"
  - **step forms with a progress bar**
  - tables with status pills
- **Not taken:** bookings, prices, invoices, stock-photo galleries, heavy 3D/WebGL, slogans.

## 8. Testing
- Firestore **rules tests in the Firebase emulator** (free, on the laptop): every rule in §5, especially
  - a user can't make themselves admin
  - the audit log can't be edited
  - a confirmation can be answered once, before it expires
- The tester agent's release check before every deploy (test accounts only; delete test data; never message real officials; `confirm` tested with a fake code).
- Real phones: the emergency part works signed out and offline; workspaces at 360 px, night and day, Bangla and English.

## 9. Realistic schedule (11 days left)
| Day | Work |
|---|---|
| 1 | Merge open PRs; offline phone test; **design tokens v2** (this §7) on the existing pages |
| 2 | **P17:** Firebase project, Auth, Firestore, rules + emulator tests |
| 3 | **P35:** sign-in page + workspace shell (sidebar, top bar with 999) + user dashboard |
| 4 | **P18:** report a wrong number (3 steps) + my reports + admin reports |
| 5 | **P44:** admin dashboard, users and roles, audit log (batched writes) |
| 6 | **P38:** applications, confirmations, verifications + rules tests |
| 7 | **P39:** volunteer application (4 steps), volunteer workspace, `confirm` page |
| 8 | Volunteer list on area pages, teams + team-leader confirmation |
| 9 | P16 texts into `js/lang`, P13 spot-check of 40 numbers, #52 Action versions |
| 10 | **P37:** full test on real phones (all roles, offline, night/day), fixes |
| 11 | Demo script, release notes, tag `v1.0` |

Each day = one or two issues, small commits, a PR reviewed by the other person.
If a day slips, move the next day's work. Don't skip tests.
