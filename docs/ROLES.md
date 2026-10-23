# SafeConnect – Accounts and roles (plan)

Ideas taken from a reference video (a role-based service app) and adapted to SafeConnect.
Follow `docs/DESIGN.md` for every screen. Reference page: `design/portal-v2.html`. **The emergency part never needs an account.**

## 1. Three sign-in options, one safe system
The sign-in page shows **three clear options**: সাধারণ ব্যবহারকারী, স্বেচ্ছাসেবক, অ্যাডমিন. Each has one line saying who it is for.
Behind them is one Firebase Auth. After sign-in, the chosen option is checked against the role stored in Firestore:
- If the role matches, that workspace opens.
- If it doesn't (for example, "অ্যাডমিন" chosen by a normal user), the person signs in as a general user and sees a short note.

Above the options, a red box always says "বিপদে আছেন? সাইন ইন লাগবে না।" with 999, send location and help near me.

| Role | Who | How they get the role | Workspace |
|---|---|---|---|
| **সাধারণ ব্যবহারকারী** (user) | Anyone who signs in | Automatic | আমার প্রিয়জন, আমার এলাকা, আমার রিপোর্ট, স্বেচ্ছাসেবক হতে চাই |
| **স্বেচ্ছাসেবক** (volunteer) | A user whose application was approved | Only an admin (or an approved team leader, for their own team) | আমার অবস্থা, "আমাকে দেখান" switch, সময়, টিম |
| **অ্যাডমিন** (admin) | jerin101, tasmintoshi | Set by hand in the Firebase console, never from the site | রিপোর্ট, আবেদন যাচাই, ব্যবহারকারী, অডিট লগ, তথ্যের অবস্থা |

Sign-in methods: **email + password** and **Google** (both free on Firebase Spark). Phone OTP is not used, because SMS verification has limits and costs. Check them before adding it.

## 2. Rules that never change
1. 999, "আমার কাছের সাহায্য", search, area pages and SMS work **without signing in**. Sign-in is never shown before help.
2. The **999 button stays in the header of every workspace**.
3. Roles are stored in Firestore (`users/{uid}.role`, `admins/{uid}`). **Security rules** enforce them, so hiding a button is never the only protection.
4. A user can't change their own role. Only admins can change roles, and every change is written to the audit log.
5. The **audit log is append-only**: rules allow create, never update or delete.
6. No home addresses anywhere. Volunteer verification details stay admin-only and are never shown to users (existing P38/P39 rules).
7. Tests use test accounts only, and test data is deleted afterwards (tester agent rules).

## 3. What each workspace has (sidebar like the video: কাজ / অ্যাকাউন্ট ও সাহায্য)
**User:**
- Dashboard cards: প্রিয়জন (count), সেভ করা এলাকা, আমার রিপোর্ট (open / fixed)
- প্রিয়জনের নম্বর, synced to the account. The phone copy still works offline.
- আমার রিপোর্ট: each "ভুল নম্বর জানান" with its status (জমা হয়েছে → দেখা হচ্ছে → ঠিক করা হয়েছে / পরিবর্তন লাগেনি)
- স্বেচ্ছাসেবক হতে চাই: a step-by-step form (see §4)
- প্রোফাইল ও সেটিংস, সাইন আউট (with a confirmation that says what stays on the phone)

**Volunteer** (everything a user has, plus):
- আমার অবস্থা: যাচাই চলছে / অনুমোদিত / সাময়িক বন্ধ. It never says who confirms or how.
- "আমাকে দেখান" on/off, available time, skills
- My team (team leaders: confirm new members of their own team)

**Admin:**
- Dashboard cards: খোলা রিপোর্ট, অপেক্ষমাণ আবেদন, সক্রিয় স্বেচ্ছাসেবক, শেষ সাপ্তাহিক যাচাই (from `verify_report.json`)
- রিপোর্টের তালিকা: open each report, compare it with the official source, then set a status. A data fix still goes through `tools/` and a PR.
- আবেদন যাচাই: the confirmer is picked from official data. Approve, reject or pause.
- ব্যবহারকারী: list and filter users, change roles (logged)
- অডিট লগ: who did what and when. Filter by type, person and date.

## 4. Ideas from the video we use, and ones we don't
**Use:**
- Three sign-in options on one page, role-based workspaces with a sidebar
- "তিন ভূমিকা, এক লক্ষ্য" section on the home page, explaining user · volunteer · admin in one line each
- **Step-by-step forms** with a progress bar (ধাপ ১/৩): পছন্দ → বিস্তারিত → মিলিয়ে দেখুন → জমা দিন. Used for "ভুল নম্বর জানান" and "স্বেচ্ছাসেবক আবেদন".
- Dashboard number cards, each with "সব দেখুন"
- Append-only audit history with filters
- Sign-out confirmation that says what happens to saved data
- "কীভাবে কাজ করে" steps for volunteers: আবেদন → স্থানীয় প্রতিনিধির নিশ্চয়তা → অনুমোদন → তালিকায় দেখা যাবে
- Contact cards (লিখুন / GitHub) in the same calm style

**Don't use:**
- Bookings, prices, invoices (SafeConnect is free and isn't a service shop)
- Stock-photo carousels
- Heavy animated 3D/WebGL effects (slow on cheap phones and bad for offline)
- Marketing slogans

## 5. Issues (adjusted plan)
| ID | Task | Who | Needs |
|---|---|---|---|
| P17 | Firebase setup: Auth (email + Google), Firestore, `users/{uid}.role`, `admins`, base security rules, first admin set by hand | J | – |
| P35 | Sign-in page (one button, both methods) + user workspace + synced family numbers | T (or J) | P17 |
| P18 | "ভুল নম্বর জানান" step form (no GitHub account needed any more) + admin report list | J | P17 |
| P44 | Admin workspace: dashboard, user list + role change, audit log (append-only rules) | J | P17 |
| P38 | Volunteer backend: applications, confirmations, verifications, teams + rules | J | P17, P44 |
| P39 | Volunteer workspace + application step form + public list ("আমাকে দেখান", after official contacts) | T (or J) | P38 |
| P45 | Home page section "তিন ভূমিকা, এক লক্ষ্য" + sign-in link in the header (never covering 999) | T (or J) | P35 |

**If time is short, cut in this order:** teams and team-leader confirmation → weekly batch messages → volunteer public list → volunteer workspace.
Always keep: P17, P35, P18, P44 (sign-in, user workspace, real wrong-number reports, admin with audit log).

## 6. Testing
- Security-rule tests in the Firebase emulator (free, runs on the laptop):
  - a user can't read another user's data
  - a user can't make themselves admin
  - the audit log can't be edited or deleted
  - verification data is admin-only
- Real phone: everything in the emergency part still works signed out and offline.
- Test accounts only. Delete test users, reports and applications afterwards.
