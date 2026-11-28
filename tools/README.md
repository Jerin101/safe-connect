# SafeConnect data tools

Python 3, standard library only. Run them from this `tools` folder. They wait between requests so they don't overload government servers.

| Script | What it does | Time |
|---|---|---|
| `fetch.py` | Polite downloader shared by all scripts. Adds Sectigo's official intermediate certificate (many `*.gov.bd` portals leave it out); certificate checking stays on. | – |
| `collect_areas.py` | Whole-country list of divisions, districts, upazilas and unions from the national portal | ~25 min |
| `build_areas.py` | Turns that list into the small `src/data/areas_bangladesh.json` | seconds |
| `collect_contacts.py` | Officers (police, UNO, hospital, fire…) and union councils for the pilot districts | ~50 min |
| `collect_union_pages.py` | Village police, UP secretaries, older emergency-contact pages, village names | ~45 min |
| `collect_municipalities.py` | Municipality (town) officers | ~2 min |
| `build_contacts.py` | Cleans everything into `src/data/contacts_<district>.json` (runs `clean_contacts.py` at the end) | seconds |
| `clean_contacts.py` | Fixes names in the wrong cell, glued ID numbers, dates or broken numbers in phones, bad emails; removes UDC entrepreneurs (private people). Can re-clean a built file: `python clean_contacts.py ../data/contacts_noakhali.json` | seconds |
| `validate_data.py` | Checks every data file; must report 0 errors | seconds |
| `spot_check.py` | Picks 40 random key contacts (fixed seed) into `src/data/spot_check_40.csv` for a person to check by hand; `--auto` adds a hint from the source page | ~1 min |
| `verify_sources.py` | Re-downloads every source page and confirms each number is still there | ~25 min |
| `coverage_report.py` | Shows what's covered for every upazila, union and town | seconds |
| `collect_tourist_spots.py` | Tourist spots (দর্শনীয় স্থান) from the district and upazila portals, written into `src/data/aliases.json` as `spot-…` entries (the team's own entries stay). The upazila and union come only from the page. `python collect_tourist_spots.py ../data spots.json [pages_raw.json]` | ~3 min |
| `collect_bbs_villages.py` | Villages for the unions with no official village page, from BBS's geo-code PDFs (bbs.gov.bd → জিও-কোড), into `src/data/villages_bbs.json`. A union is matched to ours by sound, inside its upazila, never guessed; the Bangla name only where BBS's text reads back safely. Needs `pip install pypdf`. `python collect_bbs_villages.py ../data <pdf folder>` | ~1 min |
| `collect_locations.py`, `fill_locations.py`, `build_locations.py` | Map points and upazila boundaries for GPS → area (BBS boundaries via OCHA HDX, OpenStreetMap). `python build_locations.py --shapes-only <bgd_admin_boundaries.geojson.zip> ../data` rebuilds only the upazila shapes in `locations.json` | ~15 min |
| `extract_bbs_source.py` | Reads the official BBS tables (OCHA HDX COD-AB v03, CC BY-IGO; the small `bgd_admin_boundaries.xlsx`, no polygons) into `tools/sources/bbs_cod_ab_v03.json`, with the source URL, file SHA-256, dates and licence. Run by hand when HDX publishes a new version. | – |
| `build_master_areas.py` | Builds `src/data/master_areas.json` (BBS base, reconciled one to one with `areas_bangladesh.json` by code, name and parent; nothing guessed) and `docs/reports/MASTER_AREAS_REVIEW.md` (counts and every unresolved record). Test: `python -m unittest discover -s tests/master_areas` (T1, both directions). | – |
| `m12_polygon_pilot.py` | M1.2 pilot: reads the HDX/BBS upazila polygon zip, validates and repairs rings, simplifies (50 / 100 / 300 m), tests official union points against the polygons, measures raw/gzip size, writes `src/data/pilot/upazila_polygons_pilot.json` (5 upazilas, CC BY-IGO) and `docs/reports/m1_2_pilot_results.json`. Test: `python -m unittest discover -s tests/polygons` and `node --test tests/polygons-test.mjs`. | – |
| `m12_national_check.py` | M1.2: how well the official BBS union points agree with the simplified polygon of their derived upazila, for all upazila polygons (printed only). | – |
| `build_district_polygons.py` | M1.2: builds the 64 per-district layers `src/data/polygons/<district>.json` + `index.json` (upazila / city corporation boundaries from BBS COD-AB v03, CC BY-IGO, simplified 100 m, plus official union centre points) from the HDX geojson zip, and `docs/reports/m1_2_district_layers.json` (sizes, coverage). Tests: `python -m unittest discover -s tests/polygons`, `node --test tests/areapoly-test.mjs`. | – |
| `m12_topology.py` | M1.2 T2 fix: simplifies the borders shared by two units once (arcs), so neighbours leave no gaps or overlaps. Used by `build_district_polygons.py`. | – |
| `m12_t2_check.py` | M1.2 T2: gaps and overlaps between the 507 polygons on a grid (`--step 0.05` on PRs, `0.002` on release; `--zip` checks the original source). Test: `tests/polygons/test_t2_gaps_overlaps.py`. | – |
| `import_manual_places.py` | Tasmin's Sheet tab "নতুন জায়গা", downloaded as CSV (keep it outside the repo), into `src/data/places/manual_<district>.json`. Header: `templates/notun-jayga-template.csv`. Rows with an error are not written and are listed with their row number. No internet, no Google API. `python import_manual_places.py <file.csv> ../data` | seconds |
| `places_rules.py` | Shared rules for `src/data/places/` (used by the import and by `validate_data.py`): categories, `verified_by`, no Google links or plus codes | – |

Full refresh order and details: `docs/DATA_REPORT.md`. Raw `*_raw.json` files are working files and are not committed.

## Where the output goes

Every script takes the output path as an argument. Run from `tools/`, keep the raw working files one folder up (not committed) and write the finished files into `src/data/`:

```
python collect_contacts.py ..\contacts_raw.json                  # raw file, not committed
python build_contacts.py ..\contacts_raw.json ..\union_pages_raw.json ..\src\data ..\municipalities_raw.json
python build_areas.py ..\areas_raw.json ..\src\data\areas_bangladesh.json
python verify_sources.py ..\src\data                                 # writes data\verify_report.json
python spot_check.py ..\src\data                                     # writes src\data\spot_check_40.csv
python validate_data.py ..\src\data                                  # must say 0 errors
```

Without a path, a script writes into the current folder (`tools/`). Move nothing by hand: run it again with the right path. Full order: `docs/DATA_REPORT.md`.

## Officer pages have no date

Union pages show a "last updated" date, so those records keep it in `source_last_updated` (and get the flag `source_older_than_2_years` when it is old). Officer pages (police, UNO, hospital, fire…) show no date, so `source_last_updated` stays empty for officer records. The site then shows the "checked on" date instead: the last `verify_sources.py` check (`script_check.on`), otherwise the date the page was downloaded (`retrieved_on`).
