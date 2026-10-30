# Tests

Plain browser pages, no build step (CLAUDE.md rule 3).

## Area search (issue #36)

| File | What it is |
|---|---|
| `search-cases.json` | Every test word and what the search must (or must NOT) show |
| `search-test.html` + `search-test.js` | The page that runs all cases and shows PASS, FAIL or PENDING |

**Run:** in the project folder, `python -m http.server 8000` (or VS Code → Live Server), then open
`http://localhost:8000/tests/search-test.html`. The preview page's footer also links to it.

**Add a test:** add one line to `cases` in `search-cases.json`, for example

```json
{"q": "hatiya", "expect": "Hatiya upazila first", "first": {"kind": "upazila", "upazila": "Hatiya"}}
```

The checks you can use are listed under `how` at the top of the file. A test that waits for data the team still
has to confirm (for example Hasan Hat) gets `"pending": "why"`; it is shown but not counted as failed.

Before a pull request that changes `js/data.js`, `data/villages.json` or `data/aliases.json`: open the test page and
check that it says **0 failed**.

## Auto location (issue #105)

`autoloc-test.mjs` drives the Chrome (or Edge) already on this computer through its DevTools port, with a fake
position and fake location permission. No packages to install.

**Run:** `python -m http.server 8000` in the project folder, then in a second terminal `node tests/autoloc-test.mjs`.
It must end with **ALL OK**. Optional: `SHOTS=<folder>` saves 360 px screenshots, `CHROME=<path>` picks the browser.

It checks: off by default and no location call when off; the explanation comes before the browser asks; on → the
area is set on open and the header chip, sidebar card and home list show it; walking across a union line changes
the area with a toast and never leaves the page; moves under 300 m are ignored; a hidden tab stops the watch;
no coordinates are saved; "blocked" turns the switch off and the area can still be chosen by hand; reduced motion;
offline; 360 px in bn/en and night/day.
