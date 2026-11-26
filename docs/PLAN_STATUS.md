# SafeConnect: status against the teacher's improvement plan

Honest list: **Done** = works and is tested, **Partial** = some of it works, **Planned** = not built yet.
Targets in the plan are proposed targets, not achieved results (they need real device and network tests).

| Plan item | Status | Where / note |
|---|---|---|
| 1. Source URL, last checked date on every contact | Done | cards show source link and check date |
| 1. Verified by, method, next check date | Done | `src/js/verify.js`, shown under every number |
| 1. Review periods (30 days local, 90 days national helplines) | Done | initial team policy, not an official standard |
| 1. Stale warning: no "verified" after the review time, shows last checked date | Done | row says "Check overdue"; emergency numbers point to 999 |
| 1. Admin re-verification task | Done | admin overview: "Numbers to check again" (counts from the data files) |
| 1. Source conflicts go to a human review list | Done | `tools/find_conflicts.py` writes `docs/SOURCE_CONFLICTS.md` (same number for different people; same person with different numbers) |
| 1. A second independent source for every contact | Planned | needs a second official page per contact |
| 2. Situation list and guide steps | Done | SOS page, 6 situations |
| 2. Guided escalation (999, situation helpline, police station, SMS, family) | Done | asks "Did the call connect?"; never automatic; the browser cannot know if a call connected |
| 3A. Offline emergency pack | Done | `src/js/offlinepack.js`: 999, helplines, the remembered area and the ready SOS message texts (6 situations, Bangla and English) saved in IndexedDB with check dates; shown when data cannot load |
| 3B. Online / slow / offline chip | Done | `src/js/netstatus.js` |
| 3B. "Data sync pending" | Done | the network chip shows "N waiting to send" (`reportqueue.js`) |
| 3C. Sync of reports and "How is it now?" answers written offline | Done | `src/js/reportqueue.js`, see BUILD_PLAN §9.2; an answer is dropped after 1 hour (it would look fresh when sent late); no background sync in a browser: it sends while the page is open |
| 4. Tracking link revocation | Done | stopping the share deletes it at once (`live.js`) |
| 4. Self-approval prohibited, audit log | Done | `firestore.rules` |
| 4. Rate limiting, malicious report filter | Partial | reports have limits and no phone numbers; no server-side rate limit |
| 5. Community status with confidence logic | Partial | several confirmations, 6-hour decay, 24-hour expiry and the "people disagree" flag are done (`community.js`, `firestore.rules`); owner / admin confirmation is **not in this release** |
| 6. Accessibility: easy mode | Done | "Aa" button in the header: bigger text and buttons, stronger contrast, clear focus; kept on the phone |
| 6. Disaster mode, read aloud | Done | official warning and coast / river lines, then the nearest shelters; the SOS steps can be read aloud (phone voice, nothing sent) |
| 6. Siren and silent SOS | Done | siren starts only after a tap and stops after 1 minute; silent mode hides every sound button and opens the SMS with the message ready (a browser cannot send an SMS silently) |
| 6. Emergency readiness check | Done | SOS page: is a family number saved, is the offline pack saved; family numbers can be copied to the account (opt-in) |
| 6. Safe arrival check | Done | when a live share ends without "I arrived" the page asks, now and on the next visit; no automatic arrival detection and no wake-up when the phone is closed |
| 6. Public service analytics | Not in this release | it would collect usage data; CLAUDE.md rule 5 says nothing leaves the phone |
| Volunteer role: apply, verify contacts, approval | Not in this release | needs new Firestore rules, review and deploy by the team lead, and real people to confirm each volunteer |
| 7. Measurable NFR targets | Partial | coverage and overdue % are measured now in the admin overview; speed, offline success, SOS failure need real tests |
| 8. Impact dashboard | Partial | only what can be measured today; the rest says "not measured yet" |
| Rides (supporting feature) | Done | demo works; kept as a supporting feature, not the main pillar |

Technical limits we state openly: no reliable background location in a browser, the Battery API is missing in some browsers,
SMS opens the message app (it cannot send silently), GPS speed can be wrong, free tiers have quotas.

## Release scope: 21 use cases

These work today and can be shown. The use case diagram has exactly these.

**No login needed (7):** 1 Get emergency help (SOS: situation guide, 999 and helplines, guided escalation, siren / silent SOS, read aloud) · 2 Use the offline emergency pack · 3 Find nearby services (map, source and check date, Bangla / English / Banglish words) · 4 View community status · 5 View disaster help and shelters · 6 Change display settings (language, theme, easy mode) · 7 View a live location (family link).

**Login needed (7):** 8 Log in / out with email verification · 9 Share live location / safe journey (with stop, expiry and the arrival check) · 10 Set up emergency contacts (readiness check) · 11 Submit a community update · 12 Report wrong information (offline reports are sent later) · 13 Request a service (fare estimate, local emergency number when no provider) · 14 Save my numbers and areas (copy in the account, opt-in).

**Roles (7):** 15 Driver: apply · 16 Driver: accept and complete a service (digital bill) · 17 Admin: approve providers · 18 Admin: review reports and source conflicts · 19 Admin: re-verify contacts · 20 Admin: manage contacts and fare rates · 21 Admin: view the audit log and the impact numbers.

**Not in this release:** volunteer role (apply, verify contacts in the area, approval) and owner / admin confirmation of a community report. Both need new Firestore rules reviewed and deployed by the team lead, and real people to confirm volunteers. Second independent source for every contact is data work. Public analytics and a server-side rate limit are left out on purpose (privacy rule and zero budget).

**Impact numbers** (admin overview): coverage and overdue percentages are measured from the data files. Speed, offline success and SOS failure rate are **not measured yet**; they need real phone and network tests.

## Test record

**2026-11-26, emulated phone (390 x 844, desktop Chromium, not a physical phone).** 0 console errors and 0 failed requests on `#/today`, `#/numbers`, `#/area/...`, `#/c/pharmacy`, `#/dakun` and `#/sos`.

Passed: source link, check dates, verification method and due-soon warning on the numbers; six SOS situations with their steps and SMS text; offline pack saved (21 national numbers plus the chosen area); Easy mode (text, contrast, 56 px buttons, no horizontal scroll); siren button state; silent SOS hides the sound buttons.

Found and fixed in `fix/338-mobile-test-fixes`:
- header: the area chip slid under the 999 button at 390 px (it could not shrink);
- disaster card: the helpline name was squeezed into the 40 px icon column of the row;
- readiness card: did not update after the pack was saved or a family number was added;
- silent SOS with no family number said "your messages app has the message" (it opened the form instead);
- "Stop reading" stayed visible in silent mode; Read aloud showed no state while reading;
- no space between the "due soon" tag and the verification line.

Not a bug: the network chip is hidden while online (it shows only for "slow" and "offline"). "Did the call connect?" appears after tapping the 999 call; the test sandbox blocks `tel:` so it could not tap it (a page test now checks it).

**Not tested on a physical phone yet:** siren and read-aloud sound (and whether the phone's silent mode blocks it), the real `tel:` / `sms:` / WhatsApp hand-off, airplane mode with the service worker, the offline pack and the offline queue.
