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
