# SafeConnect: covering the whole of Bangladesh (plan v2, after the tester review)

Goal: **every place in Bangladesh** gets the right official numbers, with no area left out.
That covers land, islands, chars, cities, towns and Bangladesh's sea.
This work starts after the v3 design autopilot is finished.
Changes from v1 come from an independent tester review: verdict NO-GO for v1, GO once the 6 must-fix items below are in.

## 1. What "covered" means

A place is covered when the site shows, in this order:

1. **999** and the national hotlines. These work everywhere and are already done.
2. The **district**: DC office, Superintendent of Police, Civil Surgeon / district hospital, district fire station.
3. The **upazila or city corporation**: police station(s), UNO or city corporation, Upazila Health Complex or city hospital, the nearest fire station.
4. The **union or ward**: chairman or councillor, secretary, members, village police. Only where these are officially published.

**Never empty.** If a level has no published number, the site says so and shows the next level up.
The coverage report counts these fallbacks separately; a fallback is never counted as "has its own numbers".

## 2. The master list

| Source | Divisions | Districts | Upazila level | Union level |
|---|---|---|---|---|
| **BBS boundaries** via OCHA HDX (COD-AB v03; polygons valid from 21 May 2023; points from 13 Nov 2020, old 8-digit codes) | 8 | 64 | **507** = 495 upazilas + 12 city corporations | 5,160 points = **4,565 unions + 595 pourashava/ward points** |
| **National portal** (bangladesh.gov.bd, `data/areas_bangladesh.json`) | 8 | 64 | 510 entries | 4,537 unions, with Bangla names |

**BBS is the base** (boundaries and every city corporation). The portal adds the Bangla names.
**Matching uses code and name together, and every pair must match 1 to 1.**
Name-only matching makes mistakes: it pairs Demra with Dhamrai. Some portal codes are wrong:
Bandar has Rupganj's code, Ajmiriganj and Shayestaganj have Habiganj Sadar's code, and 22 codes are empty.

Problems found and their fixes:

| Problem | Fix |
|---|---|
| **Khetlal (Joypurhat) and its 5 unions are missing** from the portal | add them from BBS; get the union names from the Khetlal upazila website |
| **Kabirhat's 7 unions are missing** from the portal | add them from the Kabirhat upazila website |
| Mokamtala (Bogura) is not an upazila, and its 5 unions belong to **Shibganj, Bogura** | move them to Shibganj |
| Bhulli, Ruhia, Chandraganj, Dakkhin Gafargaon are not upazilas | link each to its upazila; police stations are stored separately |
| Osmaninagar and Shayestaganj have only 1 union each | complete the lists from their upazila websites |
| About 20 single unions are missing: Baharchhara (Teknaf), Battali, Dhurung, Rangamatia, Elangi, Kazirbag, Pairaband, Paria, Shibnagar, Tamta Paschim, Tantibanda, Tantihati, Kaliganj, Chauddagram, Debidwar, Homna, Nangalkot, Katiadi, Beani Bazar, Elenga | check each on its upazila website; some may have become part of a pourashava since 2020 |
| 6 upazilas have no union list: Char Fasson, Rajapur, Galachipa, Bagerhat Sadar, Panchbibi, Purbadhala | take the lists from their own websites |
| New upazilas (Eidgaon, Lalmai, Guimara, Karnaphuli, Dasar, Naldanga, Madhyanagar): unions still filed under the older upazila | move them using each new upazila's official page |
| 12 city corporations are not in the portal; 14 former unions in Dhaka (Tejgaon Unnon Circle, Badda, Demra) are now city wards | add the city corporations; **no unions inside city corporations**, only wards |
| Renamed: Zianagar = Indurkani, Dakshin Sunamganj = Shantiganj, Comilla Sadar Dakshin = Sadar Dakkhin, Zanjira = Zajira | current name, old name as a search alias |
| Duplicate: Sayestaganj / Shayestaganj | keep one |

## 3. Map coverage (tested)

| Test | Result |
|---|---|
| Grid over all land at 0.05°, 0.03°, 0.01°, 0.005° and 0.002° (3.23 million points) | **no holes, no overlaps, no point in the wrong district** |
| Area check | all four levels add up to the same total area (146,298.5 km²) |
| Union / ward points outside every boundary | only **Azimpur and Urir Char (Sandwip)** |
| Special places | Saint Martin's, Shah Porir Dwip, Nijhum Dwip, Kutubdia, Maheshkhali, Sandwip, Hatiya, Monpura, Char Kukri Mukri, Dublar Char, the Sundarbans, Dahagram, the former enclaves, the Ukhia and Teknaf camps, Thanchi, Ruma, Tanguar Haor and the big rivers: all inside the correct area |

## 4. How the site finds the area (corrected rules)

1. **Inside a boundary:** that upazila or city corporation. It's done on the phone and works offline.
2. **Override areas** (checked first). These are small hand-made polygons, each with an official source:
   - **Bhasan Char → Hatiya, Noakhali.** The BBS polygon is only 8.7 km², and its north-east part is nearer to Sandwip. Contacts: Hatiya + APBn + RRRC.
   - **Azimpur and Urir Char → Sandwip, Chattogram.** Without the override, Azimpur would go to Hatiya, its nearest area.
3. **In Bangladesh's sea** (a maritime-zone polygon: territorial sea and the exclusive economic zone, from an open dataset such as Marine Regions, with attribution):
   show **999, the Coast Guard and the Navy**, plus the **nearest coastal upazila**. This covers boats far offshore, for example 35–40 km off Cox's Bazar.
4. **Across the land border, even 2 km from it** (Agartala, Maungdaw, Petrapole, Dawki, Karimganj, Cooch Behar): **"You are outside Bangladesh"**, plus the national numbers.
   The "nearest area" rule is **never** used on the land side.
5. **The union is never guessed from old points.** The union picker uses the master union list of the found upazila.
   It shows "আপনার কাছের ইউনিয়ন" only when the location is clearly closest, and always lets the person change it.
   **Inside a city corporation it shows wards, never unions.**
6. **Data per district:** one file per district. The phone downloads only the district it needs and keeps the user's district for offline use.
   All 64 districts at once would be roughly 100 MB.

## 5. What to collect, and from where (official sources only)

| Level | Contacts | Official source |
|---|---|---|
| District | DC office, SP, Civil Surgeon, district hospital, fire station | `<district>.gov.bd`, police.gov.bd unit pages, dghs.gov.bd, fireservice.gov.bd |
| Upazila | UNO, OC of each police station, Upazila Health Complex, fire station | `<upazila>.<district>.gov.bd`, police.gov.bd, dghs.gov.bd |
| Union | chairman, secretary, ward members, village police | `<union>.<upazila>.<district>.gov.bd` |
| City corporation | mayor or administrator, CEO, **ward councillors**, **all metropolitan police stations** (the portal has only 10 of about 50 Dhaka Metropolitan Police stations) | each city corporation's .gov.bd site; dmp.gov.bd and the other metropolitan police sites |
| Pourashava | mayor or administrator, ward councillors | each pourashava's .gov.bd site |
| Special places and users | Rohingya camps (APBn, RRRC), cantonments, EPZs and economic zones (industrial police), airports (airport police), Chittagong Hill Tracts (hill district councils), border belts, rivers (river police, BIWTA), tea gardens, haors, the Sundarbans (Forest Department range offices + Coast Guard), the sea (Coast Guard, Navy) | the agencies' own .gov.bd sites |

Every record keeps `source_url`, `retrieved_on` and the existing flags. **No number is ever guessed.**

## 6. Villages

| Coverage | Status |
|---|---|
| **By location** ("help near me") | ✅ every village, because every village lies inside an upazila (the grid test shows no holes) |
| **By name in search** | ⚠ about 1,800 names today, in 2 districts; Bangladesh has around 87,000 villages |

Sources, in order:
1. **Union websites:** official village lists, often by ward. `tools/collect_villages.py` already handles these; run it for every union.
2. **BBS census village and mauza lists**, if published in a usable file (to check).
3. **OpenStreetMap names:** a search hint only, marked "not official", never linked to a phone number.

Search never dead-ends: similar names, then the upazila buttons, then "help near me" and 999.

## 7. Phases (one division at a time, small PRs)

| Phase | Work | Done when |
|---|---|---|
| 0 | **Master list** `data/master_areas.json`: BBS base + portal names + every fix in §2 | T1 passes |
| 1 | **Area lookup for all 64 districts**: boundaries per district, override areas, maritime zone, land-border rule | T2, T5 pass on the phone, offline |
| 2 | **Per-district data files + lazy loading**: Noakhali and Cox's Bazar moved first | the site works as before, offline |
| 3 | **District + upazila contacts for all 64 districts** | T3 report per district |
| 4 | **Union contacts**: Chattogram → Dhaka → Khulna → Barishal → Rajshahi → Rangpur → Sylhet → Mymensingh | T1–T6 for each division |
| 5 | City corporations (wards, metropolitan police) and pourashavas | T3, T5 |
| 6 | Special places and users (§5) | T5 |
| 7 | Villages (§6) | T7 report |
| 8 | Weekly source check and validator for all 64 districts | the GitHub Action runs green |

## 8. Tests that prove nothing is missing (automatic, in GitHub Actions)

- **T1 Master list, both ways:** 8 / 64 / 507 units. Every BBS unit and every BBS union maps 1 to 1 (code and name) to the master list, and every master entry maps back.
- **T2 Map:** a 0.05° grid on every PR, a 0.002° grid before a release (about 10 seconds), plus the area check (all levels add up to the same area).
- **T3 Own numbers:** per upazila, city corporation and union, the share that has its **own** police, administration and health numbers. Fallbacks are counted separately, never as a pass.
- **T4 Search:** every official name, in Bangla and English, is found. A name used in more than one place (Azimpur, Sonadia, Bhasan Char, which is also a union in Mehendiganj) shows **every** matching place with its district.
- **T5 Special places with the expected answer:** fixed coordinates and the **expected district and upazila** for each place in §3 and §4, plus the overrides, the sea points, and the foreign border towns, which must say "outside Bangladesh". A non-empty result alone is not a pass.
- **T6 Size and offline:** size limits per district file; the emergency part works in airplane mode.
- **T7 Villages:** per union, whether a village list exists and its source.

## 9. Scope for the course (honest)

| Level | Promise |
|---|---|
| Every place found by location, including islands, chars and the sea | ✅ yes (T2, T5) |
| 999 + national numbers everywhere | ✅ already done |
| District + upazila numbers for all 64 districts | ✅ realistic |
| Union numbers | ✅ for the Chattogram division; collected automatically for the rest, checked over time |
| Every village by name | ⚠ partial, reported per union (T7) |

## 10. Known limits (state them openly)

1. **Numbers go out of date.** Officials transfer every 1–3 years. Handled by the weekly check, wrong-number reports and the check date on every number.
2. **Many unions publish no numbers.** The site falls back to the upazila and district, marked "নম্বর প্রকাশিত নেই".
3. **Smartphones only.** People with basic phones can't use it. Later: posters and QR codes at union offices.
4. **No live tracking.** Each SMS update takes one tap and needs phone signal; offline GPS can be slow.
5. **The union is a best guess.** There are no official union boundaries, so the person can always change it.
6. **No official approval yet.** Official sources and links on every number build trust.
7. **Report spam.** The free plan has no server code; sign-in, rule limits and admin review reduce it.
8. **Free-plan limits.** The emergency part never uses Firestore, so it keeps working.
9. **Two students maintain it.** Collectors, the validator and the weekly check are automated.
