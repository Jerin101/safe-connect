# SafeConnect data tools

Python 3, standard library only. Run them from this `tools` folder. They wait between requests so they don't overload government servers.

| Script | What it does | Time |
|---|---|---|
| `fetch.py` | Polite downloader shared by all scripts. Adds Sectigo's official intermediate certificate (many `*.gov.bd` portals leave it out); certificate checking stays on. | – |
| `collect_areas.py` | Whole-country list of divisions, districts, upazilas and unions from the national portal | ~25 min |
| `build_areas.py` | Turns that list into the small `data/areas_bangladesh.json` | seconds |
| `collect_contacts.py` | Officers (police, UNO, hospital, fire…) and union councils for the pilot districts | ~50 min |
| `collect_union_pages.py` | Village police, UP secretaries, older emergency-contact pages, village names | ~45 min |
| `collect_municipalities.py` | Municipality (town) officers | ~2 min |
| `build_contacts.py` | Cleans everything into `data/contacts_<district>.json` (runs `clean_contacts.py` at the end) | seconds |
| `clean_contacts.py` | Fixes names in the wrong cell, glued ID numbers, dates or broken numbers in phones, bad emails; removes UDC entrepreneurs (private people). Can re-clean a built file: `python clean_contacts.py ../data/contacts_noakhali.json` | seconds |
| `validate_data.py` | Checks every data file; must report 0 errors | seconds |
| `spot_check.py` | Picks 40 random key contacts (fixed seed) into `data/spot_check_40.csv` for a person to check by hand; `--auto` adds a hint from the source page | ~1 min |
| `verify_sources.py` | Re-downloads every source page and confirms each number is still there | ~25 min |
| `coverage_report.py` | Shows what's covered for every upazila, union and town | seconds |
| `collect_locations.py`, `fill_locations.py`, `build_locations.py` | Map points and upazila boundaries for GPS → area (BBS boundaries via OCHA HDX, OpenStreetMap) | ~15 min |

Full refresh order and details: `docs/DATA_REPORT.md`. Raw `*_raw.json` files are working files and are not committed.

## Where the output goes

Every script takes the output path as an argument. Run from `tools/`, keep the raw working files one folder up (not committed) and write the finished files into `data/`:

```
python collect_contacts.py ..\contacts_raw.json                  # raw file, not committed
python build_contacts.py ..\contacts_raw.json ..\union_pages_raw.json ..\data ..\municipalities_raw.json
python build_areas.py ..\areas_raw.json ..\data\areas_bangladesh.json
python verify_sources.py ..\data                                 # writes data\verify_report.json
python spot_check.py ..\data                                     # writes data\spot_check_40.csv
python validate_data.py ..\data                                  # must say 0 errors
```

Without a path, a script writes into the current folder (`tools/`). Move nothing by hand: run it again with the right path. Full order: `docs/DATA_REPORT.md`.

## Officer pages have no date

Union pages show a "last updated" date, so those records keep it in `source_last_updated` (and get the flag `source_older_than_2_years` when it is old). Officer pages (police, UNO, hospital, fire…) show no date, so `source_last_updated` stays empty for officer records. The site then shows the "checked on" date instead: the last `verify_sources.py` check (`script_check.on`), otherwise the date the page was downloaded (`retrieved_on`).
