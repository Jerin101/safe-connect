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
| 1. Second independent source, conflict goes to admin | Planned | needs a second source per contact |
| 2. Situation list and guide steps | Done | SOS page, 6 situations |
| 2. Guided escalation (999, situation helpline, police station, SMS, family) | Done | asks "Did the call connect?"; never automatic; the browser cannot know if a call connected |
| 3A. Offline emergency pack | Done | `src/js/offlinepack.js`: 999, helplines and the remembered area saved in IndexedDB with check dates; shown when data cannot load |
| 3B. Online / slow / offline chip | Done | `src/js/netstatus.js` |
| 3B. "Data sync pending" | Done | the network chip shows "N waiting to send" (`reportqueue.js`) |
| 3C. Sync of reports written offline | Done | `src/js/reportqueue.js`, see BUILD_PLAN §9.2; no background sync in a browser: it sends while the page is open |
| 4. Tracking link revocation | Done | stopping the share deletes it at once (`live.js`) |
| 4. Self-approval prohibited, audit log | Done | `firestore.rules` |
| 4. Rate limiting, malicious report filter | Partial | reports have limits and no phone numbers; no server-side rate limit |
| 5. Community status with confidence logic | Partial | "How is it now?" exists; several confirmations, decay and conflicts are Planned |
| 6. Disaster mode, accessibility mode, analytics | Partial | shelters and large text exist; voice and aggregate analytics Planned |
| 7. Measurable NFR targets | Partial | coverage and overdue % are measured now in the admin overview; speed, offline success, SOS failure need real tests |
| 8. Impact dashboard | Partial | only what can be measured today; the rest says "not measured yet" |
| Rides (supporting feature) | Done | demo works; kept as a supporting feature, not the main pillar |

Technical limits we state openly: no reliable background location in a browser, the Battery API is missing in some browsers,
SMS opens the message app (it cannot send silently), GPS speed can be wrong, free tiers have quotas.
