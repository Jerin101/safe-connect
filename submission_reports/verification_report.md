# SafeConnect Capstone Project — Git Contribution Tracker Verification Report

- **Audit Timestamp:** 2026-11-21 20:25:56
- **Repository Audited:** `E:\Projects\safe-connect`
- **Audit Mode:** Strictly Read-Only (No existing reports modified; Git history untouched)

## 1. Checks Performed

1. **Commit Hash Uniqueness:** Verified SHA-1 deduplication across `--all` refs against the 559 reported commits.
2. **Contributor Identity Resolution:** Verified mapping of all author aliases and emails to **Israt Jerin Nafisa** and **Tasmin Toshi**.
3. **Authentic Git Author Attribution:** Verified reliance on Git `%an` and `%ae` metadata without fabrication.
4. **PR Merge Commit Identification:** Verified parent-count (`>1`) classification for 159 and 21 merge commits.
5. **Merge Double-Counting Prevention:** Verified exclusion of merge commit `--numstat` totals.
6. **`daily_activity.csv` Reconciliation:** Cross-checked every date/member row against independent `git log` output.
7. **`member_summary.csv` Reconciliation:** Cross-checked summary totals against `daily_activity.csv` and `contribution_report.md`.
8. **Post-Commit Hook Inspection:** Verified `.git/hooks/post-commit` existence, target script invocation, and execution path.
9. **Anti-Recursion & Auto-Push Guard:** Verified hook contains no `git commit` or `git push` triggers.
10. **`switch_member.ps1` Safety Audit:** Verified local-only Git config updates with zero history rewriting.

## 2. Passed Checks (9/10)

- [PASS] **Check 1 (Unique Commit Hashes):** Verified 559 strictly unique 40-character SHA-1 commit hashes (out of 560 raw headers across `--all` refs; 1 bot commit excluded, 0 duplicates).
- [PASS] **Check 2 (Contributor Identification):** All 559 commits map cleanly to the two team members with 0 unmapped authors: `Israt Jerin <nafijerin455@gmail.com>` -> **Israt Jerin Nafisa**; `Israt Jerin Nafisa <nafijerin455@gmail.com>` -> **Israt Jerin Nafisa**; `Tasmin Toshi <toshi2305341342@diu.edu.bd>` -> **Tasmin Toshi**; `tasmintoshi <toshi2305341342@diu.edu.bd>` -> **Tasmin Toshi**.
- [PASS] **Check 3 (Git Author Attribution):** 100% (559/559) of historical commits were attributed directly via authentic Git commit metadata (`%an` author name and `%ae` author email).
- [PASS] **Check 4 (PR Merge Commit Counts):** Verified via parent commit count (`len(%P.split()) > 1`): Israt Jerin Nafisa = **159** merge commits, Tasmin Toshi = **21** merge commits (Total = 180 merge commits).
- [PASS] **Check 5 (Merge Double-Counting Prevention):** Verified 0 files and 0 lines counted from merge commits (prevented 0 duplicate file-stat entries from being double-counted).
- [PASS] **Check 6 (`daily_activity.csv` Accuracy):** All 24 daily contributor rows match the independent `git log` aggregation across commits, merges, files changed, insertions, and deletions.
- [PASS] **Check 7 (Cross-Report Totals Consistency):** `member_summary.csv` totals reconcile 100% with `daily_activity.csv` sums and all 559 commit log entries in `contribution_report.md`.
- [PASS] **Check 8 & 9 (Post-Commit Hook & Anti-Recursion):** `.git/hooks/post-commit` exists, invokes `git_report.py` to refresh all three reports, and contains zero `git commit` or `git push` commands (preventing infinite recursive commits or unintended pushes).
- [PASS] **Check 10 (`switch_member.ps1` Safety):** Verified script modifies only repository-scoped `git config --local user.name` and `user.email`, without touching `--global` config or rewriting history.

## 3. Failed Checks (0)

- None. All 10 structural and numerical integrity checks passed.

## 4. Potential Inaccuracies & Data Limitations

- **Shared-PC Historical Attribution Caveat:** Because both members share one Windows machine, any past commit made before `switch_member.ps1` was created carries whichever `git config --local` identity was active at that moment. Additionally, GitHub PR merges reflect the GitHub account that clicked 'Merge Pull Request' rather than who wrote the branch code.
- **Windows Python PATH in Git Hook:** `.git/hooks/post-commit` calls `python` via Git for Windows' `sh.exe`. Because your Python installation resides in Anaconda (`C:\Users\ASUS\anaconda3\python.exe`), `sh.exe` may fail silently (`> /dev/null 2>&1`) if Anaconda is not in the Windows System `PATH`.
- **Branch Scope (`--all`):** `git log --all` includes commits across all local/remote feature branches (`chore/*`, `data/*`, `docs/*`), not just `origin/main`.
- **Detached HEAD & Uncommitted File:** Repository `HEAD` is currently detached at `a504615` (`origin/main`), and `PROJECT_BRIEF.md` is staged (`A`) but uncommitted.
- **Line Count Inflation:** Insertions (`+209,936`) include large datasets (e.g., OSM places, BBS villages, tourist spots) and documentation files, which inflate raw line metrics relative to application logic.

## 5. Recommended Corrections

1. Update `.git/hooks/post-commit` to call the explicit Anaconda Python path (`"C:/Users/ASUS/anaconda3/python.exe" project_management/git_tracker/git_report.py`) and log errors to `project_management/git_tracker/hook.log` instead of `/dev/null`.
2. Re-attach `HEAD` to local `main` (`git checkout -B main origin/main`) so future commits stay on the `main` branch rather than detached `HEAD`.
3. Add `project_management/git_tracker/reports/` to `.gitignore` if you do not want generated CSV/Markdown reports committed into application source history, or commit them intentionally only at milestones.
