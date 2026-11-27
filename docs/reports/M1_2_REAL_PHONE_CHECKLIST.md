# M1.2 – real-phone test checklist (airplane mode, first visit, offline visit, GPS permission)

Use a test phone and the preview/deploy that contains service worker **v81-2026-11-27**. Never call a real emergency number. Nothing on this page sends a position anywhere; do not paste real positions into notes.
Record each result (pass / fail / what you saw) in `docs/PLAN_STATUS.md`.
The page is wired: the card **"Where the map puts you / মানচিত্র অনুযায়ী আপনার অবস্থান"** shows on the area page after "Find help near me" (steps 9–12). Steps 1–8 test that the files are cached and open offline. Use service worker **v81** (or higher).

| # | Step | Expected |
|---|---|---|
| 1 | Chrome → open the site with mobile data or Wi-Fi ON. Wait 30 s on the home page. | Page loads. |
| 2 | Chrome menu → Settings → Site settings → check the site: storage shows more than before (about +1.3 MB for polygons). Or DevTools (desktop) → Application → Cache Storage → `safeconnect-v81-2026-11-27`. | Cache name ends `v81-...`; contains `data/polygons/index.json` and 64 `BD....json` files. The old `v80` cache is gone. |
| 3 | Open `<site>/data/polygons/index.json` in a tab. | JSON with `"districts"` (64) and `"not_in_source"`. |
| 4 | Turn **airplane mode ON** (also Wi-Fi off). Close the tab and open the site again from the home screen / bookmark. | Site opens; contacts still show. |
| 5 | Offline: open `<site>/data/polygons/index.json` and `<site>/data/polygons/BD2075.json` (Noakhali). | Both open from the cache (no "no internet" page). |
| 6 | Offline: open a layer of a district you never visited (for example `BD2015.json`, Chattogram). | Opens (all 64 are saved at install). |
| 7 | Airplane mode OFF; reload. | Site still fine; no error. |
| 8 | **First visit offline control:** on a second browser profile or after "Clear site data", turn airplane mode ON and open the site. | Site does not open (expected: nothing cached yet). Turn network ON, open once, then repeat steps 4–6. |
| 9 | Online, location **allowed once**: tap **Find help near me** outdoors. | The area page opens. Under "You are in …" a card shows Division / District / Upazila, then **"Nearest union centre"** with a distance and the line "not your union". The contact numbers are unchanged. Switch Bangla ↔ English: the card follows, with Bangla digits in Bangla. |
| 10 | Location **blocked** (Chrome site settings → Location → Block), tap **Find help near me**. | The old "location blocked" message and the demo chips. **No card.** Nothing breaks; 999 still works. |
| 11 | Airplane mode **ON** (after step 1–3), tap **Find help near me** again, outdoors. | The card still shows (layers come from the saved cache). If you never opened the site online first: "The boundary map is not on this phone yet…" and the numbers still work. |
| 12 | Weak GPS (indoors, or location set to "Wi-Fi only") and, if you can, stand within about 100 m of an upazila or district border. | Weak signal worse than about 2 km: "position is too rough" and **no names**. Near a border: the "close to a boundary" warning. Never "your union"; the answer is "inside the boundary of the upazila" plus "nearest union centre". If you are in a new 2026 upazila area (Chandraganj, Fatikchhari, Gafargaon, Bangra): the "Reported new upazila not yet on the map" note. |
| 13 | Open the site in a **private tab** online and offline. | Online works; offline private tabs can have no cache: expected. |
| 14 | After a later deploy with a new version, open the site online once, then offline. | The new cache is used; the old one is deleted. |

Safety: results only describe areas; nothing here replaces the SOS flow. If anything fails, note the phone model, Chrome version and the exact step.
