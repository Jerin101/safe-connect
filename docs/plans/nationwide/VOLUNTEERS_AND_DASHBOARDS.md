# SafeConnect: every corner + union volunteers + meaningful dashboards (plan addition)

This adds to COVERAGE_PLAN.md (v2). It follows the same rules: official numbers only, help never needs an account, zero budget,
and every permission is enforced by Firestore security rules with emulator tests, never by hiding a button.

---

## Part 1: It works in every corner, even for a tourist with no internet

Example: a tourist from Dhaka trekking to **Andharmanik (Thanchi, Bandarban)**, with no mobile data.
They opened SafeConnect once in Dhaka and never looked at Bandarban.

**The gap:** with one file per district, the phone only has the districts it opened before.

**The fix: three layers, all saved on every phone the first time the site opens:**

| Layer | What | Size (target) | Offline everywhere? |
|---|---|---|---|
| 1. **National core** | 999 + national hotlines + Coast Guard / Navy / Tourist Police | small | ✅ |
| 2. **Area finder for all of Bangladesh** | simplified boundaries of all 507 upazilas and city corporations, plus the sea zone and override areas | under 2 MB | ✅ |
| 3. **Upazila core numbers for all 495 upazilas + 12 city corporations** | per area: UNO or city corporation, the police station(s), Upazila Health Complex or hospital, the nearest fire station | about 300–500 KB | ✅ |
| 4. Full district file (union chairmen, members, village police…) | downloaded when the person is online in, or chooses, that district | per district | ✅ once saved |

So **anywhere in Bangladesh, with no internet**, the phone can show:
"আপনি আছেন: থানচি, বান্দরবান" + 999 + the Thanchi police station, UNO and health complex (and Alikadam's, near the line).

**"ভ্রমণের আগে" (before you travel):** a button to save any district for offline use, for example "save Bandarban".
The user dashboard lists the saved districts.

**Remote and border areas (example: Andharmanik trek, Thanchi, Bandarban):**
- The map check: 18 points along the Sangu south of Remakri, 3–16 km from the Myanmar border, all fall inside **Thanchi or Alikadam, Bandarban**.
- **Near an upazila boundary** (within about 3 km), the site shows **both** upazilas' police stations and health centres.
  For example, the Andharmanik area lies near the Thanchi–Alikadam line.
- **No mobile signal there is common.** SafeConnect cannot make calls or send SMS without signal; no app can.
  What it can do offline: show the area, the numbers, the coordinates and a ready message.
  The person presses Send in the SMS app as soon as there is signal again.
- **"ভ্রমণ পরিকল্পনা" (trip plan)**, used *before* losing signal:
  1. save the district for offline use;
  2. send the family an SMS with the route, the guide's name and the expected return time;
  3. a reminder: "যদি <সময়ের> মধ্যে খবর না দিই, থানচি থানায় ফোন করো" with the number included.
- **Area notes from official sources only**, for example "visitors usually register at the local police station or camp and travel with a
  registered guide; check the current rules before going". Shown only with an official source link and a check date.

**Tests added:**
- **T10:** remote and border points (Andharmanik stretch, Remakri, Saka Haphong area, Sajek, Teknaf border, Tanguar Haor)
  must give the expected upazila; points within 3 km of an upazila line must show both upazilas.
- **T8:** for 100 random points across Bangladesh, with *only* layers 1–3 on the phone (airplane mode, no district file),
  each point shows its area name and at least one police, one administration and one health number, or the district fallback.
- **T9:** the size of layers 1–3 stays under the limit, so a cheap phone downloads them quickly.

---

## Part 2: The union volunteer network

### Roles (one account, different permissions)

| Role | Who | Can see | Can do |
|---|---|---|---|
| **User** | anyone signed in | own data | report a wrong number, save family numbers, save areas, apply to volunteer |
| **Union data volunteer** | approved person (18+) for **one union** | **only their union** | propose new or corrected numbers for offices in their union, with proof; see reports about their union |
| **Union tester volunteer** | a **different** approved person for the same union | **only their union** | check proposals and user reports by calling the number; mark "correct / wrong / no answer"; send to the admin |
| **Admin** | jerin101, tasmintoshi | everything | approve, publish, manage volunteers, see all reports and the audit log |

**Each volunteer has access only to their own union.** This is enforced by the security rules:
the volunteer's record holds `unionCode`, and every rule compares it with the record they want to read or write.
The data volunteer and the tester volunteer of a union must be **two different people**, so no one can change numbers alone.

### How a number gets updated (four eyes + admin)

```
Data volunteer (union X)  →  proposal: office, name, number, proof
        ↓                     proof = an official *.gov.bd link, or a notice board / letter
                                described in writing (no photos: the free plan has no file storage)
Tester volunteer (union X) →  calls the number, records who answered and when → "verified" / "wrong"
        ↓
Admin                       →  checks the proof, approves → written to the audit log
        ↓
Weekly export (GitHub Action) → approved changes go into data/manual_additions.json as a PR
                                 (with source_url / proof, volunteer and tester IDs, dates)
        ↓
Validator + tests pass → merged → live on the site, shown as "স্বেচ্ছাসেবক যাচাই করেছেন, <date>"
```

- Numbers on the site still come only from official sources **or** from a recorded two-person check approved by an admin.
  Every number shows which one.
- The export uses a Firebase service-account key stored as an **encrypted GitHub Actions secret**, never in the repository.
- A user's wrong-number report now also goes to **that union's tester volunteer**, as well as the admin.

### Who becomes a volunteer for a union

1. Apply (4 steps): choose the union, about you, skills and time, review. 18+ only.
2. The local representative confirms: the ward member or chairman, through the one-time confirm link (already in the plan).
3. The admin approves and **assigns the union and the role** (data or tester).
4. Approval lasts 1 year, or until the chairman changes. Users can report a volunteer; that pauses them until an admin checks.

With about 4,565 unions, not every union will have volunteers. The admin coverage page shows **which unions have none**.

---

## Part 3: Meaningful dashboards

### User dashboard

| Card | What it shows / does |
|---|---|
| **My area now** | the found area + its key numbers, usable offline |
| **Saved areas and districts** | including "before you travel" downloads, with their size and last update |
| **My people** | family numbers, optional sync, one-tap "send location" |
| **My reports** | each wrong-number report with its status (received → being checked → fixed / no change needed) and who is checking it (union tester or admin) |
| **Volunteer for my union** | the application, and its status |

### Union data volunteer dashboard (only their union)

| Card | What it shows / does |
|---|---|
| **Union health score** | the share of offices with a number checked in the last 6 months (chairman, secretary, members, village police) and the gaps |
| **This week's tasks** | for example "5 numbers not checked for over a year", "ward 3 village police: no number" |
| **New proposal** | the step form: office → number → proof → review |
| **My proposals** | status: waiting for the tester → verified → approved → live |
| **Reports in my union** | user reports, read-only (the tester handles them) |
| **My activity** | hours and activities (the base for certificates later) |

### Union tester volunteer dashboard (only their union)

| Card | What it shows / does |
|---|---|
| **Check queue** | proposals and user reports for their union, oldest first |
| **Call check** | call → result (correct / wrong / no answer) → who answered (designation) → note |
| **Done this month** | checks completed, average time to check |
| **Escalate** | send a case to the admin with a note (for example "the chairman has changed") |

### Admin dashboard

| Card | What it shows / does |
|---|---|
| **Coverage of Bangladesh** | a table by division → district → upazila → union: share of own numbers, last check date, volunteers yes/no |
| **Approval queue** | verified proposals waiting for the admin |
| **Reports** | all reports, with filters (status, district, age) |
| **Volunteers** | applications, confirmations, assign union and role, pause, unions without volunteers |
| **Data health** | the weekly source check and validator results, and the last export PR |
| **Audit log** | every admin action, append-only |

---

## Part 4: Firestore rules and tests (sketch)

New collections (all closed until their tests exist):

| Collection | Fields (main) | Rules |
|---|---|---|
| `volunteers/{uid}` | unionCode, role (`data` / `tester`), status, since, until | create/update: admin only (audited); read: the volunteer, admins |
| `proposals/{id}` | unionCode, office, name, phone, proof, byUid, status, testerUid, result | create: a data volunteer of **that** unionCode, status `waiting`; tester fields: a tester of that unionCode, **not the author**; approve: admin, audited |
| `reports/{id}` | adds `unionCode` | read: the reporter, admins, testers and data volunteers of that unionCode; status by tester (`checking`, `verified`, `wrong`) or admin |
| `activity/{id}` | uid, unionCode, kind, at | create: the volunteer themselves; read: the volunteer, admins |

Rule tests to add (emulator, before any UI):
- a volunteer cannot read or write another union's proposals or reports
- a data volunteer cannot verify their own proposal
- a tester cannot approve (only admins)
- a paused or expired volunteer can do nothing
- a user cannot set `unionCode` or `role` on themselves
- every admin approval needs an audit entry (same batch, `getAfter`)

---

## Part 5: Where this fits in the phases

| Phase | Work |
|---|---|
| after Phase 2 | **layers 1–3 on every phone** + "before you travel" (T8, T9) |
| after P44 (admin) | **volunteer rules + tests** → the union volunteer and tester dashboards → the weekly export Action |
| with every division | the admin coverage page shows unions without volunteers, for recruiting |

**Honest limits:** volunteers depend on local people and representatives responding.
A union without volunteers still gets official numbers and the upazila/district fallback.
Volunteer-checked numbers are clearly marked as such.
