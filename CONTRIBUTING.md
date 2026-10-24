# Contributing to SafeConnect

Two people build SafeConnect: **jerin101** (lead: data and backend) and **tasmintoshi** (frontend). These rules keep our work safe and make every step visible in Git.

## The loop for every change

1. **Issue.** Every task starts as a GitHub issue. Put the planning ID from `docs/ISSUES.md` at the start of the title, e.g. `[P05] Add national hotlines data`. Assign it to yourself.
2. **Branch from the latest `main`.**
   - In VS Code: bottom-left branch name → `main` → Source Control `⋯` → **Pull**.
   - Then: bottom-left → **+ Create new branch**.
   - Names: `docs/<n>-short-name`, `data/<n>-…`, `feature/<n>-…`, `fix/<n>-…`, where `<n>` is the **GitHub issue number** (not the P-number).
3. **Small commits.** One idea per commit. The message starts with a verb: `Add Ukhia police station records`, `Fix card overflow on small phones`.
4. **Publish the branch**, then open a **pull request**:
   - title = the issue title
   - first line of the description: `Closes #<issue number>`
   - reviewer = the other person
5. **Review.** The other person reads **Files changed**, tests if needed, then **Approve** or **Request changes** with a comment.
6. **Merge** only after approval and a green automatic check. Use **Create a merge commit**, then **Delete branch**.
7. **Pull `main`** again before starting the next task.

## Data rules (most important)

- Every phone number comes from an **official `*.gov.bd` page** (or `acc.org.bd`) and keeps its `source_url`. Never type a number from memory, news, Facebook or "someone said".
- Change files in `data/` only with the scripts in `tools/` or through `data/manual_additions.json`. Never hand-edit the other `data/*.json` files.
- Hand-entered records go into `data/manual_additions.json` with **both** a `source_url` and a `source_quote_bn` copied from the page.
- Before a data PR, run `python tools/validate_data.py data`. It must say **0 errors**. GitHub runs it again automatically (after P11).
- **Any PR that changes a file in `data/` must raise `VERSION` in `service-worker.js`, otherwise phones keep the old numbers.**
  Why: the offline app (P34, #53) saves the data on each phone. A new `VERSION` (for example `v1-2026-10-23` → `v2-2026-11-02`) tells every phone to throw away its saved copy and download the new numbers. Put the version change in the same PR as the data change.

## Code rules

- Plain HTML, CSS and JavaScript; no frameworks, no paid services.
- Text shown to people lives in `js/lang/bn.json` and `js/lang/en.json`.
- Use `textContent` for data, never `innerHTML`.
- Test at phone width (360 px), in both languages and both themes.
- Privacy: without login, nothing leaves the phone. Read the location only when the user taps SOS or "Use my location". Never log or upload personal data.
- Python tools: standard library only, a delay between requests to government servers, UTF-8 everywhere.
- Never turn off certificate checking (`verify=False`, `-k`, etc.).

## Reviews

- Be kind and specific: what's wrong, where, and a suggestion.
- Check:
  - does it work?
  - does it follow the rules above?
  - any number without an official source?
  - anything private leaving the phone?
