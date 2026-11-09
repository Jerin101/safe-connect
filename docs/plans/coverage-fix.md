# Coverage fix: Noakhali and Cox's Bazar (final queue, step 3)

Goal: everything people search for in the two pilot districts is found. Each district must reach **100%** on its
must-find list. A name that is truly on no official or reference list goes to `docs/DATA_GAPS.md` with the reason.

## Where we start (9 Nov 2026)

Measured with `node tests/must-find/run.mjs` on main `ca5f864` (with the phonetic search, #173). Entries with a data gap are
left out of the % and listed in `docs/DATA_GAPS.md` §12 (none in Noakhali; 14 entries in Cox's Bazar: 8 places, in English and Bangla).

| District | Found | Unions (bn + en) | Pourashavas | Tourist spots (portals) | Banglapedia list | Jerin's names (en + bn) | Villages (bn + Banglish) |
|---|---|---|---|---|---|---|---|
| Noakhali | 285/315 (90.5%) | 175/175 | 8/8 | 2/32 | — | — | 100/100 |
| Cox's Bazar | 262/337 (77.7%) | 142/142 | 4/4 | 5/49 | 1/14 | 10/28 | 100/100 |

Our data today:

| District | Unions in our data | Unions with a village list | Villages | Pourashavas in our data | Pourashavas (official list) |
|---|---|---|---|---|---|
| Noakhali | 89 | 39 | 397 | 3 | 8 |
| Cox's Bazar | 71 | 43 | 853 | 1 | 4 |

78 unions have no village page (`data/villages.json` → `unions_without_village_page`).

Claude chat's comparison with the 2011 census (Banglapedia) gives Noakhali 91 unions and 967 villages, and Cox's Bazar
66 unions and 927 villages. Those union counts predate the newer upazilas: Kabirhat, Eidgaon and the Subarnachar
changes.

## The must-find lists (`tests/must-find/<district>.json`)

Every entry has a query, its group, the expected upazila (the union only when an official page gives it) and the
exact source.
- **Unions:** every union in our data, by its Bangla name and by its English name. The source is the union portals.
- **Pourashavas:** the official lists:
  - Noakhali has 8 (`noakhali.gov.bd` → পৌরসভার তালিকা).
  - Cox's Bazar has 4 (`coxsbazar.gov.bd` → পৌরসভার প্রশাসকবৃন্দ).
- **Tourist spots from the portals:**
  - Every spot on the দর্শনীয় স্থান / tourist-spot pages of the district portal and the 18 upazila portals, collected by `tools/collect_tourist_spots.py`.
  - The upazila comes from the portal the spot is on, from the page text, or from the same spot on an upazila portal.
  - A few rows that are not places are left out (for example "মহিষের দধি", a food, and an office).
- **Banglapedia:**
  - Its দর্শনীয় স্থান list for Cox's Bazar (secondary reference, place names only); the upazila only where Banglapedia gives it.
  - The Noakhali page has no such list.
- **Jerin's Cox's Bazar names**, in English and in Bangla, from the final queue:
  - Laboni, Sugandha, Kolatoli, Himchari, Dariyanagar, Inani, Patuartek, Teknaf beach, Shamlapur, Marine Drive, Mermaid beach
  - Saint Martin / Narikel Jinjira, Chhera Dwip, Shah Porir Dwip, Sonadia, Adinath temple
  - Maheshkhali, Matarbari, Kutubdia lighthouse, Dulahazra Safari Park, Ramu Buddhist temples, Mathiner Kup
- **Villages:**
  - 50 random villages per district from the official union pages (a fixed seed), each typed in Bangla and in Banglish.
  - These measure the search, not the coverage; part 3 measures coverage against BBS.

An entry with `gap` has no page read so far, official or reference, that names its upazila. It is listed in
`docs/DATA_GAPS.md` §12 and left out of the % until a source is found. A spot spelled differently on an upazila portal
("ডুলাহাজরা" / "ডুলাহাজারা") takes that portal's upazila, and the entry says so.

## Parts (one PR each)

1. **Must-find test** (this PR): the lists, `tests/must-find/run.mjs` and this plan.
2. **Tourist spots:**
   - `tools/collect_tourist_spots.py`: 1 request/s, certificate checks on, every page kept in a local cache.
   - The spots go into `data/landmarks/<district>.json` with type tourist/beach/island/temple/park, Bangla and English names, and common spellings (Laboni Point, Sugandha Point, Saint Martin, Narikel Jinjira…).
   - The search needs a small change: a landmark that is known only to its upazila, with no union, leads to the upazila.
   - The upazila comes from the page or our boundary check; the union only from an official page.
3. **Missing villages:**
   - For the 78 unions without a village page: BBS's official geo-code (mauza/village) lists from bbs.gov.bd, plus the union portals' ward pages.
   - Each village keeps its source. A union is never guessed.
4. **Rerun the must-find test:**
   - Each district must reach 100%.
   - What is truly on no list goes to `docs/DATA_GAPS.md` with the reason.
   - The numbers per district go to Jerin.

## Rules

- Never invent a name, phone number or office (CLAUDE.md rule 1).
- Place names come from official pages, BBS, or "local name, added by the team" with who and when.
- Banglapedia is a secondary reference for place names only, and is marked as such.
- Official sites only for collecting, 1 request per second, certificate checks on.
- `validate_data.py` must show 0 errors, and data PRs need data-checker GO.
