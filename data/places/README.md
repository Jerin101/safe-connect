# data/places

Places by category for all 64 districts (MASTER_PLAN "Phase 3: Places data"). Two kinds of file:

| File | What | Source label |
|---|---|---|
| `<district>.json` (Dhaka: `dhaka-1.json` … `dhaka-3.json`) | Places from OpenStreetMap | "OpenStreetMap, যাচাই করা নয়" |
| `manual_<district>.json` | Places checked by the team (Sheet tab "নতুন জায়গা") | by `verified_by`: official list / owner's page / visited |
| `index.json` | Which OSM files exist per district, place counts, gzip sizes, OSM credit | – |

`<district>` is the district's English name in lower case with only the letters (`coxsbazar`, `chapainababganj`), as in `data/landmarks/`.

## OpenStreetMap data: credit and licence

The OSM files and `data/upazila_centres.json` contain data © OpenStreetMap contributors, available under the
**Open Database License (ODbL) 1.0**: https://www.openstreetmap.org/copyright. Anything that shows them (list, map) must
show "© OpenStreetMap contributors" with that link. Under ODbL, these files (and changed versions of them) stay under the
ODbL, not under the repo's MIT licence. Source: Geofabrik `bangladesh-latest.osm.pbf`, OSM data of 2026-11-13
(MD5 `97d2d03b254c5fd0d9a4f62925a67e46`).

## Place shape

As in MASTER_PLAN: `id, name_bn, name_en, category, subcategory, lat, lon, division, district, upazila, union, address_bn,
phone, hours, source, source_url, checked_by, checked_on`. In the OSM files a key that is missing means null (to keep each
file under 120 KB gzip). Manual files also have `verified_by`, `location_approx` and `location_source`.

- **category**: `health`, `shops`, `workshops`, `fuel_transport`, `money`, `public_offices`.
- **OSM subcategory** (the OSM tag): health = hospital, clinic, doctors, pharmacy, chemist · shops = supermarket,
  convenience, general, mall, marketplace · workshops = car_repair, motorcycle_repair, motorcycle, bicycle, mobile_phone,
  craft (+ `craft`: the craft tag) · fuel_transport = fuel, bus_station, ferry_terminal · money = bank, atm ·
  public_offices = police, fire_station.
- **OSM places**: named places only; the same name and kind within 100 m is kept once (node first); **no phone
  numbers** (OSM is not an official source); `union` is always null; `upazila` comes from the OSM upazila boundary, matched
  to `areas_bangladesh.json` (null where OSM has no boundary); `hours` is the OSM `opening_hours` text; `source_url` is the
  object on openstreetmap.org; `checked_on` is the extract date.
- **Manual places**: see `tools/import_manual_places.py`. With no `lat`/`lon`, `location_approx` is true and the website
  shows the pin at the upazila centre (`data/upazila_centres.json`) with the label "আনুমানিক অবস্থান". The centre is not
  copied into the place. No data from Google Maps (location, plus code, phone, hours): the validator rejects Google links
  and plus codes.

## How the OSM files are made

The OSM extract is read **outside the repo** (it needs pyosmium and shapely, which the repo's tools do not use).
The scripts and the extract live in `E:\Projects\SafeConnect-Files\osm\`:

```
python -I tools/extract.py bangladesh-latest.osm.pbf extract                     # boundaries + places from the extract
python -I tools/upazila_members.py bangladesh-latest.osm.pbf extract/upazila_members.json
python -I tools/build_places.py . <repo>                                            # writes data/places/* and data/upazila_centres.json
python tools/validate_data.py data                                                  # in the repo: must be 0 errors
```

Only the generated JSON is committed. To refresh: download the extract again from download.geofabrik.de (once,
certificate checks on), run the four commands, and review the diff.
