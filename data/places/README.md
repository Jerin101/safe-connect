# data/places

Places by category for all 64 districts (MASTER_PLAN "Phase 3: Places data"). Two kinds of file:

| File | What | Source label |
|---|---|---|
| `<district>.json` (Dhaka: `dhaka-1.json` … `dhaka-3.json`) | Places from OpenStreetMap | "OpenStreetMap থেকে, যাচাই করা হয়নি" |
| `manual_<district>.json` | Places checked by the team (Sheet tab "নতুন জায়গা") | by `verified_by`: official list / owner's page / visited |
| `official_<district>.json` | Fuel stations from the state oil companies' dealer lists (Padma 2019, Meghna 2025) | "সরকারি তালিকা" + the list's badge (Padma: "২০১৯ সালের সরকারি তালিকা, এখন বদলে থাকতে পারে") |
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

- **category**: `health`, `shops`, `workshops`, `fuel_transport`, `money`, `public_offices`, `other_services`.
- **OSM subcategory** (the OSM tag): health = hospital, clinic, doctors, pharmacy, chemist · shops = supermarket,
  convenience, general, mall, marketplace · workshops = car_repair, motorcycle_repair, motorcycle, bicycle, mobile_phone,
  and the repair crafts (car_repair, motorcycle_repair, bicycle, electronics_repair, mobile_phone_repair, shoemaker,
  tailor) · fuel_transport = fuel, bus_station, ferry_terminal · money = bank, atm · public_offices = police,
  fire_station · other_services = every other `craft=*`; for a craft, `subcategory` is the craft value (sawmill,
  photographer…; `unspecified` for `craft=yes`) and `osm_key` is `"craft"`. Of the repair crafts, the data has tailor,
  electronics_repair and shoemaker today.
- **OSM places**: the same kind of place with the same Bangla *or* English name within 100 m is kept once (node
  first). **Places without a name** are kept for hospital, clinic, pharmacy, fuel, atm, bank, police, fire_station,
  bus_station and ferry_terminal, with `unnamed: true` and no name: show `unnamed_labels[subcategory]` from the file
  ("ফার্মেসি (নাম জানা নেই)"); other kinds need a name. Bangla text goes only in `name_bn`, English only in `name_en` ("Popular Pharmacy (পপুলার
  ফার্মেসী)" is split); names that are only coordinates, an address, "Test"/"Unnamed", or a private person's name with no
  business (outside `doctors`) are not used (the place is kept as unnamed if it is one of the kinds above). Places whose
  name has text copied from Google Maps (a rating, Google's category labels) are not used at all. **No phone numbers** (OSM is not an
  official source); `union` is always null; `upazila` comes from the OSM upazila boundary, matched
  to `areas_bangladesh.json` (null where OSM has no boundary); `hours` is the OSM `opening_hours` text; `source_url` is the
  object on openstreetmap.org; `checked_on` is the extract date.
- **Upazila centres** (`data/upazila_centres.json`): see its `note` and `docs/DATA_GAPS.md` §14 (order: the
  `data/locations.json` centre, the OSM `admin_centre`, an OSM town node with the upazila's name, the upazila's police
  station or health complex, then the middle of the shape; never guessed).
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
python -I tools/place_nodes.py bangladesh-latest.osm.pbf extract/place_nodes.json           # towns, for upazila centres
python -I tools/build_places.py . <repo>                                            # writes data/places/* and data/upazila_centres.json
python tools/validate_data.py data                                                  # in the repo: must be 0 errors
```

Only the generated JSON is committed. To refresh: download the extract again from download.geofabrik.de (once,
certificate checks on), run the five commands, and review the diff.

## Official fuel lists (`official_<district>.json`)

Built outside the repo by `E:\Projects\SafeConnect-Files\official-lists\tools\build_fuel_lists.py` from the PDFs
(Padma's is text; Meghna's is a scan, read with OCR). Each file names its lists (`lists`: the company's `*.gov.bd` page,
the PDF's own address and SHA-256, the list date, the badge, and a label for a hidden name). Per place: `name_en` (or `name_hidden: true` when the list
gives only a person's name: show the list's `hidden_name_label_bn/_en`, e.g. "পেট্রোল পাম্প (পদ্মা অয়েলের
ডিলার)"; for Meghna's scan, also when the OCR did not read the name clearly, i.e. a word confidence under 85, because a
misread name would be an invented one; those are on the review list with their PDF page), `district`, `upazila` (only when the address names exactly one upazila of that district; a bare district
name does not count as Sadar), `page` (the PDF page), `flags` (`source_older_than_2_years` for Padma). The PDF groups
Padma's stations by sales area: a station moves to another district only when its address names that district and
not its own district or one of its upazilas (every move and every unclear case is on a review list for Jerin).
Terminated stations and internal accounts are left out. The lists have no location, so `lat`/`lon` are null and
`location_approx` is true: pin at the upazila centre with "আনুমানিক অবস্থান", or no pin when the upazila is not known.
**Never kept:** account numbers (A/C No), owner names, and the address text (it often holds the owner's name); the
upazila and district found from the address are kept.
