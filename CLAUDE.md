# SafeConnect – rules for Claude

SafeConnect is a free website that shows **official** emergency and public-service contacts for any location in Noakhali and Cox's Bazar (later all of Bangladesh), in Bangla and English, and works offline.
Full details: `docs/BUILD_PLAN.md` (technology, data pipeline, fallback chain), `docs/FEATURES.md`, `docs/PROJECT_PLAN.md`, `docs/ISSUES.md`.

## Team

- **jerin101**: team lead. Owns `data/`, `tools/`, `js/data.js`, `js/location.js`, Firebase, GitHub Actions, docs.
- **tasmintoshi**: frontend. Owns `index.html`, `pages/`, `css/`, the UI modules in `js/`, PWA, accessibility.
- Both are **beginners**. Explain in short, simple English. Before running or suggesting any Git command, say what it does.

## Hard rules

1. **Never invent, guess or "fill in" a phone number, name or office.** Every contact must come from an official `*.gov.bd` page (or `acc.org.bd`) and keep its `source_url`. If something is missing, say so and use the fallback chain in `docs/BUILD_PLAN.md` §4.
2. **Zero budget.** No paid services, no paid APIs, no paid datasets. Free tiers only: GitHub Pages, GitHub Actions, Firebase Spark (no Cloud Functions, no file storage), OpenStreetMap Nominatim only in the `tools/` scripts (at most 1 request per second, with credit).
3. **No frameworks and no build step** for the website: plain HTML, CSS and JavaScript (ES modules). The Python tools use only the standard library.
4. **Never turn off certificate checking** (`verify=False`, `-k`, etc.).
5. **Privacy:** without login, nothing leaves the phone. Location is read only when the user taps SOS or "Find help near me", and the lookup happens on the phone. Never log or upload personal data. Volunteer applications are private, verification is hidden from users, and no home address is ever shown.
6. **The humans commit.** Make small changes, explain them, and let the person review the diff and commit it themselves. Never push, merge or force-push.
7. Every change belongs to a GitHub issue (planning ID `Pxx` in `docs/ISSUES.md`) and a branch: `docs/`, `data/`, `feature/` or `fix/` + **GitHub issue number** + short name.
8. **Offline first is the top priority.** Everything in the offline list (`docs/BUILD_PLAN.md` §9) must work with no internet.
9. **Safe testing:** use a test account, delete test data afterwards, never send a confirmation message to a real official (use a fake code), and never call a real emergency number to test.

## Code style

- **Design:** for any page, button or text, follow `docs/DESIGN.md`. `design/portal-v2.html` is the reference.
- HTML: semantic tags, a `lang` attribute, a label for every button and input, no inline JavaScript.
- CSS: colours and sizes only as variables in `css/base.css`; dark and light themes; mobile-first (test at 360 px).
- JavaScript: ES modules, `const`/`let`, small functions, no global variables, `textContent` (never `innerHTML` with data), and `tel:` links with normal digits.
- Text shown to users lives in `js/lang/bn.json` and `js/lang/en.json`, never hard-coded.
- Python tools: standard library only, polite to government servers (a delay between requests), UTF-8 everywhere.

## Data rules

- Data files live in `data/`. Change them only with the scripts in `tools/` or through `data/manual_additions.json` (with a `source_url` and a `source_quote_bn`).
- `python tools/validate_data.py data` must report **0 errors** before any data PR.
- Cards must show: the source link, the check date, and badges for the flags `number_not_published`, `source_older_than_2_years`, `administrator_not_elected`.

## Save usage

- Never read `data/*.json` or `design/portal-v2.html` in full. Use grep or read only the needed lines.
- For one step, show all commands together with one simple sentence each, then wait for one OK.
- Don't print long command output; show only errors or the last few lines.
- Keep replies short.
- When the person can do a step themselves, give the exact terminal commands so they can run them by hand.

## Commands

- Run the site: VS Code → right-click `index.html` → **Open with Live Server** (or `python -m http.server 8000`).
- Check data: `python tools/validate_data.py data`
- Coverage: `python tools/coverage_report.py data > docs/COVERAGE.md`

## Agents (`.claude/agents/`)

`project-manager` · `developer` · `tester` · `source-researcher` · `data-checker` · `bangla-reviewer`. Use the right one for the job; they follow these rules too.

- **tester:** PR reviews and the **release check** (GO / NO-GO) before every deploy and the showcase
- **developer:** writing code · **data-checker:** every data PR · **source-researcher:** data gaps and volunteer confirmers · **bangla-reviewer:** any text people read · **project-manager:** the day's plan, issue numbers, deploy readiness
