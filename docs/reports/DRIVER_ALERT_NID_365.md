# #365: driver call alert, rider state, and NID + family details for driver approval

Status: built and tested locally, **not committed, not deployed**. Branch `feature/365-driver-alert-nid`, service worker `v83-2026-11-28` (origin/main is v81; the geography branch #366 uses v82, so merge in number order or renumber).

## Why
Phone test of সেবা ডাকুন: when a rider called a service, the driver was not alerted, and the driver could not tell whether the rider was still there. Drivers also had no identity check before approval.

## What the driver now gets (all free; Firebase Spark has no Cloud Functions)
- Tap **Go online**: the browser may ask for notifications; the page starts the alert (sound, vibration, screen wake lock).
- A new request for the driver's service and district gives: sound + vibration, the page title `(1) New call`, an on-screen card, and (only if the page is hidden and notifications are allowed) a system notification. The first list after going online is the baseline and is not announced.
- Each request shows the **customer's state**, from the rider's page: "online now" (a heartbeat in the last 75 s), "was here N min ago", "not seen for N min (may have left)", or "status unknown". A cancelled request leaves the list at once.
- **Honest limit, written on the page:** the alert works while the driver's page is open and the phone awake. A closed app cannot be woken without a paid server. Real background push needs a server (not free) and is not built.

## Rider side
While the request (or the trip to the pickup) is open and the page is visible, the rider's page writes `riderSeenAt` (server time only) every 30 s. Nothing about the rider's position is added. Hidden page or closed tab: the heartbeat stops and the driver sees "not seen".

## NID and family details (decision: private admin-only record) — needs owner sign-off before deploy
- Applicant form: NID (10, 13 or 17 digits), one family contact (name, relation, mobile 01XXXXXXXXX) and a consent tick. Saved in `providerPrivate/{uid}`.
- Rules: only that person and admins can read it, one document at a time (no listing); only the applicant writes it, only while not approved; deleted by the applicant on withdraw and by the admin batch on reject; **an admin can approve only if the record exists** (new applicants and existing pending ones must add it).
- Admin sees the details only after tapping "Show NID and family details", must tick "I checked…" before **Approve** works.
- Approved records are kept so an admin can re-check; the owner must decide retention (delete after approval is a one-line change). The data is never logged, never in a URL, never in localStorage (tests check the source).
- **Privacy and legal sign-off by the project owner is required before this is deployed**: lawful basis, who the admins are, how long it is kept, how a person asks for deletion. CLAUDE.md rule 5 was written for volunteers; this extends it to drivers only with that approval.

## Tests (all pass locally)
- `tests/rules/ride.rules.test.mjs`: 50 (6 new: record format and consent, who can read, who can write, delete, rider heartbeat rules, driver sees heartbeat; the approve test now needs the record). All four rules files: **164 pass** (Firestore emulator). Mutation checks: approve without the record, anyone reads it, heartbeat for anyone: all detected.
- `tests/driveralert-test.mjs` (11): alert logic, baseline, no double alert, offline, disarm, degraded devices, presence states, strings, privacy and service worker list.
- `tests/provide-test.mjs` (Chrome with a stand-in for firebase.js, 21 checks): applicant form validation, pending applicant asked for details, go online, new-call alert, customer state lines, admin tap-to-view and tick-before-approve. Also still passing: `dakun-test`, `autoloc-test`, `routes-test`.
- String bug found and fixed on the way: a new key `riderAway` clashed with an existing one (the last duplicate wins in JSON); it is now `riderGone`.

## Real-phone test (two phones, test accounts only; never call a real number)
1. Phone B (driver): sign in, apply with test NID `1234567890` and a test family number; phone A (admin): open Provide, tap Show details, tick, Approve.
2. Phone B: open the Provide page, tap **Go online**, allow notifications, keep the screen on.
3. Phone A2 (rider): open ডাকুন, request a ride. Expect on B within seconds: sound, vibration, `(1) New call`, the request with "Customer is online now".
4. Close the rider tab: after about 3 minutes B shows "not seen for N min".
5. B goes offline: no more alerts. Lock B's screen or close the app: no alert (known limit).
6. Delete the test applicant afterwards.
