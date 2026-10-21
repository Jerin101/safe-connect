# SafeConnect – Project Plan

Team: **jerin101** (lead: data, backend tools, Firebase, GitHub) · **tasmintoshi** (frontend, UI)
Length: **14 days** · Budget: **0** · Editor: **VS Code** (+ Claude Code)

Related: [`BUILD_PLAN.md`](BUILD_PLAN.md) (technology, data pipeline, fallback chain, scenarios) · [`FEATURES.md`](FEATURES.md) · [`ISSUES.md`](ISSUES.md) (every task, ready to copy into GitHub Issues)

---

## 1. Goal

From **any location in Noakhali or Cox's Bazar** (a union, a town or municipality, an island or a beach), a person in danger gets the right official help in a few seconds, even with weak internet.

**Coverage promise** (checked by `tools/coverage_report.py`):

| Level | What is always shown |
|---|---|
| Everywhere | 999 + national helplines (109, 1098, 102, 16263, 16699, 333, 16111, Tourist Police…) |
| Every upazila (18) | Police station or its fallback (SP office), UNO, hospital or fallback, fire or fallback |
| Every union (160) | Chairman/administrator, members, village police **or** the fallback chain → police station → UNO → 333 |
| Every municipality with a website (5) | Administrator and executive officer, then the police station and UNO |
| Landmarks (e.g. Inani beach) | The responsible police outpost, Coast Guard station, Tourist Police and where to file a GD |

## 2. Data already collected (to be committed through the issues below)

- 25 national numbers (19 services) from the national portal's official hotline page
- Area list for the whole country (8 divisions / 64 districts / 510 upazilas / 4,537 unions)
- Noakhali 1,653 + Cox's Bazar 1,306 contacts:
  - police, Tourist Police and Coast Guard
  - UNO, municipalities, hospitals, fire service, women affairs, disaster
  - **union chairmen and members, and 641 village police**
- Every record was re-checked against its official page by script.

## 3. Roles

| | jerin101 (lead) | tasmintoshi |
|---|---|---|
| Owns | `data/`, `tools/`, `js/data.js`, `js/location.js`, Firebase, GitHub Actions, docs | `index.html`, `pages/`, `css/`, all UI modules in `js/`, PWA, accessibility |
| Reviews | Every PR from Tasmin | Every PR from Jerin |
| Daily | Plans the day with the `project-manager` agent; at least 1 commit | At least 1 commit |

## 4. Git rules (both)

1. Every change starts from a **GitHub Issue** ([`ISSUES.md`](ISSUES.md)). Each person creates their own issues; this counts as activity.
2. **Branch per issue**, named with the **GitHub issue number** (not the P-number, because issues and PRs share one number list): `docs/5-contributing`, `data/6-national-hotlines`, `feature/22-home-screen`, `fix/40-card-overflow`.
3. **Small commits** with clear messages that start with a verb: `Add Ukhia police station records`.
4. **Pull request** with `Closes #N` → **the other person reviews** → the automatic check passes → merge → delete the branch.
5. Tasmin works in **her own Windows user account** and is signed in to Git and GitHub as **tasmintoshi**, so every commit shows her name.
6. Never push straight to `main` (branch protection blocks it).

## 5. Day-by-day schedule

| Day | jerin101 | tasmintoshi | Showable result |
|---|---|---|---|
| 1 | Create the repo, protect `main`, labels, milestone. **P01 first push (this plan)** → PR | Setup, accept the invite, clone. **Review PR P01**. **P02 design guide** | Both have a commit + a review on day 1 |
| 2 | P03 CLAUDE.md + 6 agents · P04 contributing + templates | P20 page skeleton | |
| 3 | P05 national hotlines · P06 area list | P21 design tokens + dark/light | |
| 4 | P07 collector tools | P22 home screen (999 bar, SOS button, search box) | |
| 5 | P08 Noakhali data · P09 Cox's Bazar data | P24 area picker | |
| 6 | P10 manual additions + places · P23 `data.js` (load, cache, search) | P25 area page + contact cards + fallback chain | |
| 7 | P11 validator + GitHub Action · **review** | Finish P25 · **review** | **Checkpoint:** search + area page work with real data |
| 8 | P12 verify + coverage tools · P26 `location.js` (GPS → upazila/union) | P28 Bangla/English + Bangla digits | |
| 9 | P16 Bangla/English texts (UI + SOS messages + guides) | P29 SOS + family contacts | |
| 10 | P13 spot-check 40 records · P14 police data gaps | P30 Silent SOS + siren · P27 village search + places | |
| 11 | P15 GD / crime-report guide content · P17 Firebase setup | P31 Safe Journey · P32 fake call | |
| 12 | P18 report-wrong-number + admin page | P33 GD helper · P34 offline PWA | |
| 13 | P19 GitHub Pages deploy · release notes | P35 login/account page · P36 accessibility + polish | Site live on GitHub Pages |
| 14 | **P37 both:** test both scenarios on real phones, fix bugs, demo script, tag `v1.0` | same | **Showcase ready** |

If time runs short, cut in this order: P35 → P18 → P17 → P32 → P33. Everything else is needed for the demo.

## 6. Showcase demo (5 minutes)

1. **Noakhali, Chowmuhani, night attack:** open the app → GPS → Begumganj → 999 + Chowmuhani police outpost + Begumganj police station → Silent SOS to family.
2. **Cox's Bazar, drone lost at Inani beach:** "Inani beach" → Jaliapalong → Tourist Police, Ukhia police station, Inani Coast Guard → GD helper text.
3. **Airplane mode on:** the app still opens; SOS falls back to SMS.
4. **Trust:** open any card → its official source link and check date. Show `COVERAGE.md` and the GitHub Action passing.
5. **Teamwork:** GitHub Insights → contributors, PRs and reviews from both members.

## 7. Definition of done

- [ ] All "Must" features in `FEATURES.md` work on a phone
- [ ] `validate_data.py` passes in GitHub Actions; `COVERAGE.md` shows a fallback wherever a number is missing
- [ ] Site live on GitHub Pages; works offline
- [ ] 40-record human spot-check done
- [ ] Both members: commits on most days, PRs, reviews and issues closed
