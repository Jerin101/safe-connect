# M1.2 – National per-district polygon layers, offline wiring, nearest union centre

Status: built locally and tested; **not committed, not deployed**. Reproduce: `python tools/build_district_polygons.py --zip <bgd_admin_boundaries.geojson.zip>` (zip SHA-256 `ec54c97c2004bbee084afa3f662abb202d8ec038dbfd398af2ebb9b1bf3ec9e5`, BBS COD-AB v03 via OCHA HDX, CC BY-IGO, boundaries valid 2023-05-21, retrieved 2026-11-27; see `M1_2_POLYGON_PILOT.md` §1 for the licence evidence).
Numbers: `docs/reports/m1_2_district_layers.json`. Tests: `python -m unittest discover -s tests/polygons`, `node --test tests/areapoly-test.mjs`.

## 1. National coverage
| | Count |
|---|---|
| Divisions / districts with a layer | 8 / 64 |
| Source level-3 polygons | 507 (495 upazilas + 12 city corporations) |
| Master upazila-level units (M1.1) | 507 |
| Master units **without** a polygon | **0** |
| Polygons without a master unit | 0 |
| Official union centre points in the layers | 5,160 (all have coordinates; 0 skipped) |
| Rings that crossed themselves after simplification and were re-simplified at half tolerance | 7 (all fixed, 0 problems left) |

**Missing units:** none from the 2023 source. The upazilas reported in 2026 (Chandraganj, Fatikchhari Uttar, Dakshin Gafargaon, Bangra) are **not** in the source. They have **no polygon**; they are listed in `index.json` under `not_in_source` with the evidence "news report only; gazette not opened", and a position there gets `no_polygon` → the district / upazila-centre fallback. Nothing is invented. (The gazettes, city wards and the reconciliation table stay separate research items.)

## 2. Layer sizes (100 m simplification)
Raw = compact JSON UTF-8, gzip = level 9.
| | Raw | Gzip |
|---|---|---|
| `index.json` (now with the 8 division names) | 14,540 B | 4,467 B |
| 64 district layers, total | 1,280,599 B | 547,692 B |
| Smallest layer (Jhalokati, 4 upazilas, 34 points) | 8,183 B | 3,797 B |
| Largest layer (Chattogram, 16 units, 258 points) | 45,003 B | 17,701 B |
| Other large ones: Cumilla / Mymensingh / Sylhet | 42,201 / 39,335 / 34,532 B | 16.8 / 16.3 / 14.3 KB |
| Union points alone (inside the layers) | 397,171 B | – |

Approved initial budgets: new always-cached data ≤ 1.3 MB raw → **1,295,139 B (index + layers): passes by 4.9 KB**. The three new scripts (areapoly 7,265 B, unioncentre 3,967 B, whereami 6,134 B = 17,366 B) are application code, reported separately and not counted as data. Union points ≤ 400 KB → 397 KB, passes by 3 KB. Per-district gzip ≤ 150 KB → largest 17.7 KB. Whole-base cache ≤ 10 MB → **6.58 MB raw** (was 5.26 MB; 1.35 MB gzip).
Tight margins mean any extra field in the layers needs a size review.

## 3. What each layer contains and keeps
Every layer repeats the attribution, CC BY-IGO licence, source URL, validity date, zip hash and the **modification notice** ("Simplified ... Not the original data"); the long explanations are once in `index.json`. Upazila boundaries (rings delta-encoded integers, degrees × 1e5 ≈ 1.1 m), the official BBS union centre points (2020 point table, same source), and per upazila `lp`: the 2-digit 2020 code, which is the **derived** parent link (not an official 2023 link). Unions of an upazila with no 2020 code (Eidgaon) have no own parent, and say so.

## 4. Offline integration (stage B)
Existing strategy (inspected): `service-worker.js` saves every file in `FILES` at install, cache-first with a background refresh; a new `VERSION` deletes the old cache and saves everything again.
Change (local only): added `js/areapoly.js`, `js/unioncentre.js`, `data/polygons/index.json` and the 64 layers to `FILES` (135 files, 6.58 MB raw, including `js/whereami.js`); `VERSION` bumped to `v81-2026-11-27`. Install is all-or-nothing (`addAll`): one missing layer would break installation, so a test checks that every listed file exists and that all 65 polygon files are listed once.
The loader reads files with plain `fetch`, so offline the service worker cache answers; it keeps loaded districts in memory for the session. If a file is missing or damaged it answers `unavailable` and the page keeps its old fallback. The area page now uses them: see `M1_2_PAGE_INTEGRATION.md` (the existing `locations.json` lookup is untouched).
Not deployed. After a merge the next deploy delivers v81 to phones on their next online visit.

## 5. Nearest union centre (stage C)
`src/js/unioncentre.js`: `nearestUnionCentre()` and `describePosition()` use the official union points. The result always has `labelKey: 'nearest_union_centre'`, `exact: false`, a distance in metres, the second-nearest distance and `ambiguous` (second within 500 m). Rows without finite coordinates are skipped; nothing within 30 km gives `none / too_far` rather than a distant centre. With an upazila hit, only centres whose **derived** parent is that upazila are used (`limited_to_upazila`, `parent_is_derived`); where the upazila has none (Eidgaon, city corporations) all centres of the district are used and flagged. `describePosition` always returns `exact_union: false`. Text for people is not written yet: add `nearest_union_centre` strings to `bn.json` / `en.json` when the page is wired (needs the Bangla reviewer: "nearest union centre", not "your union").

## 6. Honest limits
- **41 of 41 pilot matches is not proof** that union points everywhere have a correct parent. Nationally 4,726 of 4,898 points with a derived parent are inside that parent's polygon (96.5 %); **172 are not**. Causes: 2020 points vs 2023 boundaries, new upazilas, and the derived (not official) parent. These are reported, not hidden, and the test requires that some disagree.
- 262 points with an old city-thana parent have no polygon parent; wards, city corporation delimitation and the 2026 gazettes remain separate open research.
- Polygons are simplified 100 m: a position within about 100 m of a border can fall on either side. The answer is "inside the boundary of the upazila", never a surveyed position.
- Not tested: a real browser with the real service worker (see `M1_2_REAL_PHONE_CHECKLIST.md`).
- Kabirhat correction: it is an upazila with its own 2020 point code and 8 union points, not a 2023 "new upazila" (the earlier pilot wording was wrong and is fixed).
