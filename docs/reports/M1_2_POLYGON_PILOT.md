# M1.2 – Upazila polygon technical pilot

Status: pilot only. Nothing here is used by the site, the service worker or any production data file.
Reproduce: `python tools/m12_polygon_pilot.py --zip <bgd_admin_boundaries.geojson.zip>`; tests: `python -m unittest discover -s tests/polygons` and `node --test tests/polygons-test.mjs`.
Full numbers: `docs/reports/m1_2_pilot_results.json`.

## 1. Source and licence (verified, not assumed)
| Item | Value |
|---|---|
| Dataset | "Bangladesh - Subnational Administrative Boundaries" (COD-AB v03), https://data.humdata.org/dataset/cod-ab-bgd |
| Publisher / source field | OCHA Field Information Services Section (FISS); `dataset_source`: Bangladesh Bureau of Statistics (BBS) |
| Licence (HDX metadata field `license_title`) | Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO), https://creativecommons.org/licenses/by/3.0/igo/ |
| Boundary dates | `valid_on` 2023-05-21 in the polygons; HDX `dataset_date` 2023-05-21 to 2025-06-01; HDX metadata modified 2026-11-23 |
| File used | `bgd_admin_boundaries.geojson.zip` (37,759,475 bytes), SHA-256 `ec54c97c2004bbee084afa3f662abb202d8ec038dbfd398af2ebb9b1bf3ec9e5`, member `bgd_admin3.geojson` (507 features: 495 upazilas + 12 city corporations; CRS84) |
| Retrieved | 2026-11-27 |
| HDX caveat (quoted) | "Boundary alignments are based on the latest updates from the BBS as of March 2025." and "ADM4 (Ward level) is not officially confirmed or maintained". Upazilas created in 2026 are therefore **not** in this data. |

Attribution and a modification notice ("Simplified ... not the original data") are in the `meta` block of the pilot file and are checked by a test.
The same BBS v03 polygons are already used in `src/data/locations.json` for the 18 upazilas of Noakhali and Cox's Bazar (licence recorded there); the pilot checks that its areas agree with them (within 1 %).
The raw 50 MB source is **not** committed (`*.zip` is git-ignored). Only the 5-upazila simplified pilot file (7.7 KB) is in the repository.
Not found: a BBS-own licence statement for these polygons. CC BY-IGO is the licence HDX states; it is what the project relies on and it should be confirmed with BBS together with the geo-code PDFs (see the reconciliation report).

## 2. Pilot upazilas
| Upazila | Code | Why |
|---|---|---|
| Hatiya | BD20750036 | island upazila, MultiPolygon with 5 parts |
| Teknaf | BD20220090 | long thin coast plus the offshore island (St Martin), MultiPolygon, long border |
| Noakhali Sadar | BD20750087 | mainland district seat, many neighbours, 14 union points |
| Kabirhat | BD20750047 | small mainland upazila with its own 2020 point code and 8 union points. **Correction (M1.2 step 4):** an earlier version of this report called it a "new upazila"; the data does not say that. (The national portal snapshot lists 0 unions for it, a portal-side filing issue; the link to the 2020 code is derived.) |
| Eidgaon | BD20220032 | the only new upazila of the pilot: it has **no** 2020 point code: its unions are still filed under the old upazila |

## 3. Validation and repair
All 5 source polygons were already valid: 0 self-intersections, 0 holes outside the exterior, no repeated points, rings closed. The repair code (closing rings, dropping repeated/degenerate points, orientation, retry with half the tolerance when a simplified ring crosses itself) is unit-tested with deliberately broken rings. Over all 507 source polygons the repair step changed nothing (`national_notes` is empty); no simplified pilot ring needed a retry.

## 4. Simplification, size and agreement
Raw = compact JSON (UTF-8), gzip = level 9. Whole-country sizes were measured by simplifying all 507 polygons locally; nothing of it is redistributed.

| Tolerance | Pilot file raw / gzip (5 upazilas, with meta) | All 507 polygons raw / gzip | Budget check (raw ≤ 1 MB, per-district gzip ≤ 150 KB) |
|---|---|---|---|
| 50 m | – (per-upazila: 1.4–2.2 KB) | 1,199,935 B / 478,297 B | raw over 1 MB |
| 100 m (pilot file) | 7,676 B / 3,843 B | 811,335 B / 329,072 B | passes (0.81 MB raw) |
| 300 m | – (per-upazila: 0.5–0.8 KB) | 415,968 B / 169,516 B | passes with large margin |

Area change after simplification for the 5 pilots: at most 0.2 % at 100 m, up to 1.1 % (Eidgaon) at 300 m.
Agreement of official BBS union points with the polygon of their **derived** parent upazila, all 4,898 points that have a parent polygon:
50 m 96.5 %, 100 m 96.5 %, 300 m 96.6 % (`python tools/m12_national_check.py`). The tolerance hardly matters here. The 144–145 points more than 500 m outside come from the 2020 points versus 2023 boundaries and from the derived parent, not from simplification. 262 points have an old city-thana parent and no polygon (kept unlinked).

## 5. Point-in-polygon results (pilot upazilas)
- Official union points whose derived parent is the pilot upazila: **41 of 41 inside** at 50, 100 and 300 m (Hatiya 12, Teknaf 7, Noakhali Sadar 14, Kabirhat 8, Eidgaon 0).
- Points of other upazilas of the same district that fall inside a pilot polygon: Hatiya 1 (within 500 m of the border); Eidgaon 5, which are exactly the unions still filed under the old upazila – this is the **unresolved mapping** and it is reported, not hidden or linked.
- Points of far upazilas: 0 inside.
- Boundary-crossing note: a point near a border can fall on either side after simplification, so a result is "inside the upazila boundary", never "exact".
- Union points are 2020 BBS points; they are reference points, not independently surveyed positions.

## 6. Offline loading (tested with a fake Cache Storage and fetch, no browser)
`src/pilot/polygons.js`: network first, saved copy when offline, saved in its own cache (`safeconnect-polygons-pilot`).
Tests (all pass): online loads and caches; offline after one visit answers the same query from the saved copy; offline and never visited returns `null` (the site then uses the existing district/upazila-centre fallback); a 500 response, an empty file and invalid JSON never erase the saved copy; no cache storage (private mode) still works online.
**Not tested:** a real browser with the real service worker and airplane mode. The pilot file is deliberately **not** in the service worker file list (that would change production offline behaviour and need a version bump).

## 7. Rules kept
No union boundary exists in the official data; the loader returns `level: 'upazila'` and the tests assert that no union is ever returned. Unresolved union mappings (Eidgaon, the 262 city-thana points, the reconciliation table) are untouched.

## 8. Remaining blockers and next step
1. Confirm CC BY-IGO usage with BBS (same email as for the geo-code PDFs) and decide the final tolerance (100 m recommended; 300 m also fits all budgets).
2. 2026 upazilas (Chandraganj, Fatikchhari North, South Gafargaon, Bangra) are not in the polygon data; until a gazette plus boundary source exists they stay on the district fallback.
3. Next coding step (M1.3 proper, needs approval): per-district layers, add the files to the service worker with a version bump, a "nearest union centre" lookup that reports "nearest union centre", and a real-phone offline test.

## Correction note
The 41 of 41 result only shows that the pilot upazilas' own points fall inside their own polygons. It is **not** proof that the derived parent of every Bangladesh union point is right: nationally 4,726 of 4,898 points agree with their derived parent polygon and 172 do not (see `docs/reports/M1_2_DISTRICT_LAYERS.md`).
