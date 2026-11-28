# M1.2 T2 (gaps and overlaps) and M1.3 (`locate.js`), issue #366

Status: built and tested locally, **not committed, not deployed**. Branch `data/366-t2-gaps-locate`, service worker `v82-2026-11-28`.

## T2: what the check found and what was fixed
`tools/m12_t2_check.py` covers a grid with every polygon (even-odd scanline fill) and counts cells covered twice (overlap) and uncovered cells enclosed by covered ones (holes).
| Data | Step | Overlap | Enclosed holes |
|---|---|---|---|
| Original BBS polygons (unsimplified) | 0.002° | 0 | 7.75 km², 44 pieces |
| My 100 m layers, each polygon simplified alone (as merged in #364) | 0.002° | **97.6 km², 864 pairs** | **107 km², 2,004 slivers** |
| New layers, shared borders simplified once (`tools/m12_topology.py`) | 0.002° | 0.09 km², 1 pair | 5.8 km², 32 pieces |
| New layers | 0.01° / 0.05° | 0 / 0 | 18 / 197 km² (coarse cells; the 0.002° row is the exact one) |
Cause: independent simplification moved each side of a shared border differently. Effect on people: a position in a sliver got "no boundary" or the wrong neighbour, near the border where the card already warns. Fix: borders shared by two units are cut into arcs, each arc simplified once, both units use the identical arc (4,414 arcs, 3,985 shared; 6 rings needed a finer tolerance to avoid self-crossing).
**Tolerance changed from 100 m to 110 m** because keeping the shared-border vertices makes the files about 2.4 % bigger: at 100 m the data would be 1,329,350 B (over the approved 1.3 MB); at 110 m it is **1,290,388 B** (index 14,539 + layers 1,275,849; 9.6 KB under). The remaining holes match the original data (rivers, enclaves) and are not repaired.
Because the layers changed, the service worker is bumped to v82. Tests: `tests/polygons/test_t2_gaps_overlaps.py` (0.05, 0.01 and 0.002 grids) plus the existing 25 layer tests: 28 pass.

## M1.3: `src/js/locate.js`
`locateArea(lat, lon, service)` answers with one `kind`:
`inside` · `near-boundary` (inside, but another unit's edge is within 3 km: **both returned**, nearest first, with distances) · `no-polygon` (in the country box but in no boundary: sea, a border strip or a 2026 area; **not called "sea"**, the official data has no sea zone; the nearest units within 3 km are listed) · `outside-bangladesh` (outside 20.5–26.7 N, 88.0–92.7 E) · `invalid` / `unavailable` (bad numbers / files missing: the caller keeps its fallback).
It never returns a union, an exact flag or the position. Not wired to any page yet (the wiring is the separate small PR with gate G3 from `docs/workstreams/D-geography.md`).
Tests: `tests/locate-test.mjs` (8): each of the five rules on real layers, a city corporation position, privacy and the offline list. Unions inside cities and the 262 city-thana points stay unresolved.
## Open
- A sea zone and "override areas" (M1.2 plan) need an official source; not invented.
- Wiring `locateArea` into `resolvePlace` and the near-me picker (gate G3).
- Bangla wording for the new states when wired; BBS licence confirmation still open.
