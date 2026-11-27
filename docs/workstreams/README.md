# Workstreams B–F: how to run them

Each workstream is one Claude session with its own branch and its own folder (Git worktree). Read these three files first, in this order:

1. `CLAUDE.md` (the project rules; they win over everything here)
2. `docs/PROJECT_COMPLETION_STATUS.md` (state, ownership matrix, interfaces, gates)
3. your own file: `B-sos.md`, `C-live-share.md`, `D-geography.md`, `E-contacts.md` or `F-integration.md`

## 1. Start (the human does this once per workstream)

Git commands, in simple words: `fetch` downloads the latest GitHub state, `worktree add` makes a second working folder on a new branch, `status` only shows changes.

```
git -C E:\Projects\safe-connect fetch --prune origin
git -C E:\Projects\safe-connect worktree add E:\Projects\safe-connect-<letter> -b <branch> origin/main
```
Then open Claude in `E:\Projects\safe-connect-<letter>` and paste the whole content of your workstream file. The branch name uses the GitHub issue number (`CLAUDE.md` rule 7); create the issue first.

## 2. Rules for every workstream

- Change **only the files you own** (section 4 of the status file). Reading anything is fine.
- Shared files: follow section 5 of the status file. Never re-serialize `en.json` or `bn.json`; insert text inside your own namespace.
- Never touch an existing worktree, branch, staged change or untracked file that is not yours. Never use `git add -A` or `git add .`; add files by name.
- Do not commit unless the human says so in the session (`CLAUDE.md` rule 6 allows local commits only when the user has said so). Never push, merge, force-push, delete remote branches or deploy.
- Zero budget, no frameworks, no build step, standard-library Python only, no invented numbers, names or sources, no certificate-check bypass, privacy rule 5.
- Run the tests that belong to your files and report the **real** output. If a command fails, say so; do not claim success. Tests that need a browser need a local server: `python -m http.server <port> -d src` and `BASE=http://127.0.0.1:<port>/`. Run `node tests/<name>-test.mjs` with `BASE` set for page tests.
- Stop and ask before anything destructive, anything outside your file list, anything that needs a human (rules deploy, GitHub settings, Firebase console).
- One issue = one PR-sized change. If the work is bigger, stop after the first PR-sized piece and write the handoff.

## 3. Test commands (what exists today)

| Area | Command |
|---|---|
| Data | `python tools/validate_data.py src/data` |
| Places data | `python -m unittest discover -s tests/places_data` |
| Geo and SOS (CI) | `node --test tests/geo-test.mjs tests/location-estimate-test.mjs tests/bipod-test.mjs tests/locations/upazila-shapes-test.mjs` |
| Syntax | `node --check --input-type=module < src/js/<file>.js` |
| Live share helpers | `node tests/track-test.mjs` (only on the C branch until merged) |
| Page tests | `BASE=http://127.0.0.1:<port>/ node tests/routes-test.mjs`, `near-test.mjs`, `dakun-test.mjs` |
| Firestore rules | `npm run test:rules` (needs Java and port 8080; if 8080 is taken use a temporary `firebase.test.json` with another port and delete it afterwards) |

## 4. Quality gates before a workstream says "done"

- Every changed file is on your list; `git status` shows nothing else of yours.
- The tests above that touch your files pass, with the real output pasted in the handoff.
- `python tools/validate_data.py src/data` reports 0 errors if you touched data or anything that loads data.
- No `console.log`, no secrets, no inline JavaScript, text only through the language files, `textContent` and not `innerHTML` for data.

## 5. Handoff template (paste at the end of the session and append it to section 9 of the status file)

```
Workstream:
Branch and base commit:
Commit SHA (or "not committed"):
Changed files:
Tests run (exact command and real result):
Not run, and why:
Blockers:
What the next workstream needs from me (interfaces, file names, function names):
Exact next action for the human:
```
