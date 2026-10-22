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
| `verify_sources.py` | Re-downloads every source page and confirms each number is still there | ~25 min |
| `coverage_report.py` | Shows what's covered for every upazila, union and town | seconds |
| `collect_locations.py`, `fill_locations.py`, `build_locations.py` | Map points and upazila boundaries for GPS → area (BBS boundaries via OCHA HDX, OpenStreetMap) | ~15 min |

Full refresh order and details: `docs/DATA_REPORT.md`. Raw `*_raw.json` files are working files and are not committed.
