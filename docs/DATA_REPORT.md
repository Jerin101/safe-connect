# SafeConnect – Data Report

Collected on **21 October 2026**, cleaned and re-checked on **22 October 2026** (issue #20), from official Bangladesh government websites only (`*.gov.bd`).
No number was typed from memory or taken from news sites.

## Result in one line

**2,945 district contacts (3,050 phone numbers) + 25 national numbers.** On 22 October 2026 every source page was downloaded again and checked by script: **2,945 / 2,945 records still have their numbers on the official page, 0 removed, 0 pages unreachable** (`data/verify_report.json`). `validate_data.py`: **0 errors** (with the P11 clean-up, #27).

## Files

| File | What it holds | Size |
|---|---|---|
| `national_hotlines.json` | 19 national services, 25 numbers (999, 102, 109, 1098, 16699, 333, 16263, 16111, 1090, Tourist Police…) | 15 KB |
| `areas_bangladesh.json` | Whole country: 8 divisions, 64 districts, 510 upazilas, 4,537 unions (official BBS codes, Bangla + English) | 320 KB |
| `contacts_noakhali.json` | 1,644 contacts (incl. municipalities) + 354 village→union/ward hints | ~1.7 MB |
| `contacts_coxsbazar.json` | 1,301 contacts (incl. Cox's Bazar municipality) + 205 village→union/ward hints | ~1.3 MB |
| `manual_additions.json` | Hand-entered official records (BCG Station Inani) + places (Inani beach) (P10, #26) | small |
| `locations.json` | Offline "Find help near me" (P26): 18 upazila boundaries + 158 union and 4 town centre points (see "Map data" below) | 36 KB |
| `verify_report.json` | Result of the last full source check (also re-run every Monday by the "Weekly source check" GitHub Action) | small |
| `spot_check_40.csv` | 40 key contacts for a person to check by hand (P13, to do) | – |
| `docs/DATA_GAPS.md` | Everything missing, ready to become GitHub issues | – |
| `docs/COVERAGE.md` | Every upazila, union and municipality: what's covered and which fallback is used | – |
| `BUILD_PLAN.md` · `FEATURES.md` | Technology, workflow, scenarios · feature list | – |
| `tools/` | Collect → build → verify → validate scripts (Python, standard library only) | – |

## What's inside

| Category | Noakhali | Cox's Bazar |
|---|---|---|
| Union chairmen, members, administrators | 943 | 683 |
| **Village police (গ্রাম পুলিশ)** | **337** | **304** |
| UP secretaries / union office | 66 | 26 |
| Police (SP office, police stations, narcotics) | 56 | 32 |
| Tourist Police (Cox's Bazar region, zone, Saint Martin, Teknaf) | – | 18 |
| Administration (DC office, UNO offices, municipality administrators/officers) | 67 | 56 |
| Health (civil surgeon, hospital heads, emergency doctors, UHFPO, doctors) | 97 | 91 |
| Fire service | 23 | 21 |
| Disaster (relief, PIO, CPP, weather office) | 11 | 28 |
| Women & children, social services, Ansar-VDP, anti-corruption | 44 | 42 |
| **Total** | **1,644** | **1,301** |

Left out on purpose:
- `build_contacts.py` drops hospital staff entries (nurses, cleaners, drivers: internal staff lists, not public contacts), office staff with no number, and duplicates already covered by a newer record.
- **14 union digital centre (UDC) entrepreneurs** (Noakhali 9, Cox's Bazar 5), removed by `clean_contacts.py`: they are private business people who run the union's service centre, not officials. They are not responsible for emergencies, so their personal numbers are left out (decision in issue #20). Their ids are listed in issue #20.

## Phone number rules (issue #20)

A number is kept only if it is:
- a **mobile**: `01` + 3–9 + 8 digits (11 digits), or
- a **landline**: `0` + area code, 9 to 11 digits in total, **and not a date**. `DDMMYYYY` such as `08011976` is a birth date, not a phone number.

How the union tables were fixed: some union pages put a row number in the name column and the person's name in the next column. `tools/clean_contacts.py` (issue #20, run automatically by `build_contacts.py`) moved **571 names** back (Noakhali 317, Cox's Bazar 254), split 9 "name (title)" cells, and moved about 70 job titles out of the name field. A number in the name field is a row number, not the ward, so it is dropped. It also removed **8 birth dates** (Dhalghata) and **3 too-short numbers** from the phones. Now there are 0 of each. A number is never guessed or built from another field.

If a record loses a number this way, or the page doesn't say who a number belongs to, it gets the flag `needs_manual_check`: **10 records** (Noakhali 1, Cox's Bazar 9; 11 after P11). A person must re-check them on the official page.

Bangla text: the sources store some letters in two Unicode forms (e.g. "য়"), so code always compares Bangla text after `normalize("NFC")` (BUILD_PLAN §3).

## How it was collected

| Data | Official source |
|---|---|
| National hotlines | National portal "জরুরি হটলাইন" page (updated 28 July 2026), `dghs.gov.bd`, `touristpolice.gov.bd` |
| Area list | National portal location API `bangladesh.gov.bd/ajax/get/<level>/<id>/list` |
| Which office websites exist | National portal office finder `…/ajax/get/office-level/<level>/offices` |
| Union council | `https://<union>up.<district>.gov.bd/pages/leaders` |
| Officers (UNO, police, hospital, fire…) | `https://<office>.<district>.gov.bd/pages/officers` |
| Village police, emergency contacts | Each union's "গ্রাম পুলিশ" and "জরুরি যোগাযোগ" pages (these show their own last-updated date) |
| Inani police outpost, BCG Station Inani | Jaliapalong union portal pages (updated August 2026) |

### Map data (credit)

`data/locations.json` is used only to turn the phone's GPS position into an upazila and union, on the phone, without internet. It holds no phone numbers.
- **Upazila boundaries and all 162 union/town centre points:** Bangladesh Bureau of Statistics (BBS) administrative boundaries v03, via OCHA HDX ("cod-ab-bgd"), licence **CC BY-IGO**.
- **OpenStreetMap:** `tools/collect_locations.py` and `fill_locations.py` look up points with OpenStreetMap Nominatim (© OpenStreetMap contributors, licence **ODbL**; at most 1 request per second), and `build_locations.py` uses them only where a BBS name does not match. The current file uses none (all 162 points come from BBS); if a later build adds some, they are marked `"src": "osm"`.
- 2 of the 160 unions have no centre point; there the site shows the whole upazila and lets the person pick the union.

District and union portals send an incomplete certificate chain. The scripts add Sectigo's official intermediate certificate (copied from Mozilla's CCADB list) and **never turn certificate checking off**.

## Checks

1. **National:** each of the 25 numbers was found in the text of its source page.
2. **District:** `verify_sources.py` re-downloaded every source page on 22 October 2026. Every record's phone numbers were found: 2,945 / 2,945, 0 removed, 0 pages unreachable. For 4 records (2 per district) the name is written differently on the page (`name_text_differs`); the phones are correct. The "Weekly source check" GitHub Action repeats this every Monday and opens a `data-gap` issue if a number disappears.
3. **Validator** (`validate_data.py`, runs on every pull request): official-source URL, phone format (mobile, landline length, ASCII digits only, no dates), names that are only a number, categories, IDs, flags. 0 errors.
4. **Human spot-check (to do):** `spot_check_40.csv`.

## Honest limits (say these at the showcase)

1. **Some numbers may be outdated even though they're official.** 502 records (Noakhali 301, Cox's Bazar 201) come from pages last updated more than 2 years ago (some in 2013–2018). They're flagged and shown with a "may be outdated" label.
2. **Some unions don't publish members' numbers at all** (111 union representatives). They're shown as "number not published" with the fallback chain.
3. **84 of 160 unions have no village police list.**
4. **Missing units:** Bhasanchar police station, the Inani Tourist Police zone (website offline), and the Inani police outpost number. RAB and BGB pages are empty. See `DATA_GAPS.md`.
5. **Villages aren't in any government list.** We have 559 village names taken from representatives' addresses. "Babunagar" isn't among them, nor in OpenStreetMap for Noakhali.
6. **Police websites (`police.gov.bd`, `999.gov.bd`, `gd.police.gov.bd`) block connections from outside Bangladesh.** Check them from a laptop in Bangladesh.
7. **Some official Bangla names are garbled** (e.g. "বৃধমিত্ম"). The `bangla-reviewer` agent should fix the display names.

## Rules for using this data

- Show `source_url` and the check date on every card.
- Change `status` to `verified` only after a person has checked the record.
- Some numbers are personal mobiles of officials and representatives, published by the government for public contact:
  - Use them only to contact them in their public role.
  - Never export or sell them in bulk.
  - Remove a number promptly if the person asks.
- Refresh every 2–3 months.

## Refresh (Windows, jerin101's laptop)

```bash
cd tools
python collect_areas.py ..\areas_raw.json                 # ~25 min, whole country
python collect_contacts.py ..\contacts_raw.json           # ~50 min, both districts
python collect_union_pages.py ..\union_pages_raw.json     # ~45 min, village police etc.
python collect_municipalities.py ..\municipalities_raw.json  # ~2 min, town (municipality) officers
python build_areas.py ..\areas_raw.json ..\data\areas_bangladesh.json
python build_contacts.py ..\contacts_raw.json ..\union_pages_raw.json ..\data ..\municipalities_raw.json   # also runs clean_contacts.py
python verify_sources.py ..\data                           # ~25 min, re-checks every record
python validate_data.py ..\data                            # must say 0 errors
python coverage_report.py ..\data > ..\docs\COVERAGE.md
```
`*_raw.json` files are working files: don't commit them.
