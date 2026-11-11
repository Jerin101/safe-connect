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

## বিপদ বার্তা (issue #134)

`bipod-test.mjs`: the help link, the link parser (broken, cut-off, future and outside-Bangladesh links), the SMS text (bn/en, inside and outside our data, no location) and SMS part counts.

**Run:** `node --test tests/bipod-test.mjs` (no browser, no internet).

## Bangla, English and Banglish search (phonetic key)

`phonetic/phonetic-test.mjs` runs on the real index:
- the kit's 53 Banglish/English queries
- sahapur in both places, and "sahapur noakhali sadar" → the নিয়াজপুর village first
- krishnapur, himchari/himchori
- bazar/char/hat alone find nothing
- every village, union and town finds itself in Bangla
- every name used in more than one place shows every place, typed in Bangla and in Banglish

"kolatoli" is a `todo` until the tourist spots are added (coverage fix).

**Run:** `node --test tests/phonetic/phonetic-test.mjs` (no browser, no internet).

## Must-find test (coverage fix)

`must-find/noakhali.json`, `must-find/coxsbazar.json`, `must-find/run.mjs`: the names people search for in each pilot
district, each with its expected upazila (and union when an official page gives it) and its source:
- unions, in Bangla and English
- pourashavas
- tourist spots: from the portals, Banglapedia and Jerin's list
- 50 villages, in Bangla and Banglish
- BBS villages (`bbs_village`): one per union in `data/villages_bbs.json`, in English, and in Bangla where BBS gives it

Entries with `gap` are listed in `docs/DATA_GAPS.md` §12 and left out of the %. The plan is in `docs/plans/coverage-fix.md`.

**Run:** `node tests/must-find/run.mjs` (`--list` shows every name not found, `--strict` fails below 100%).

## A list that fails to load (issue #170)

`partial-load-test.mjs`: if `villages.json` or the landmark lists fail to load, `loadAll` lists them in `partial`, the search still finds unions, upazilas and thanas, and the calm note exists in bn/en.

**Run:** `node --test tests/partial-load-test.mjs` (no browser, no internet).

## Width sweep (issue #145)

`width-sweep.mjs` opens the main pages (home, an area, area search, send, numbers, a help link) at every width from
320 to 1024 px in 10 px steps plus real phone widths (360, 375, 390, 393, 412, 430, 440, 480, 768, 820, 1024, 1366),
in Bangla and English, light and dark, signed out and signed in, at 100 % and 130 % text. It reports sideways scroll,
overlapping header controls, clipped text, empty buttons, header targets under 44 px and a search box too narrow
for its hint. Every UI pull request must pass it.

- **Signed in** = the `sc-signed-in` flag; on page load the header shows exactly what a signed-in person sees.
- **130 % text** = the root font size set to 130 %, the way Android's font size setting scales a web page's text.

**Run:** `python -m http.server 8000` in the project folder, then `node tests/width-sweep.mjs` (about 10 minutes).
Options: `BASE=http://127.0.0.1:8000/`, `PAGES="#/,#/send"`, `WIDTHS=360,412`. In Git Bash put `MSYS_NO_PATHCONV=1`
in front when `PAGES` has `#/...`. It stops if less than 5 GB is free, and always removes its temporary Chrome profile.
