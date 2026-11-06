# Smart area search: plan

Queue v3 step 5. Goal: a person types the place they know (a bazar, a village, a thana, in any spelling) and lands on the right area, or gets a clear next step. **No phone number changes in any of this**; only names that lead to areas.

## Today (Nov 2026)

- `js/data.js` builds one search index (`areaIndex`) from upazilas, unions, towns, named places, local names (`data/aliases.json`) and villages (official lists in `data/villages.json`, plus names from representatives' addresses).
- `findAreas` scores each item by its text (0–2), its sound (3–4) or a close spelling (5+, shown only as "similar names").
- Since #145, a close spelling must also match on the part of the name before a common word (bazar, hat, para, char, school), so "kasehmbazar" no longer suggests কক্সবাজার.
- Gaps:
  - one query is matched as one name
  - thana names are not search names
  - results don't show the full address
  - when nothing matches, there is no step-by-step way on

## Parts, one PR each

| # | PR | What | Tests |
|---|---|---|---|
| 1 | Kashem Bazar | New `data/aliases.json` entry for কাশেম বাজার, a bazar in ধর্মপুর village, which is on the official village list of নিয়াজপুর ইউনিয়ন (Newajpur, newajpurup.noakhali.gov.bd), Noakhali Sadar. Spellings: কাশেম বাজার, কাসেম বাজার, Kashem Bazar, Kasem Bazar, Kashembazar. New field `village_bn` for aliases; `source: "local name, added by the team"`, `added_by: jerin101`, `added_on: 2026-11-02`. The result shows "স্থানীয়ভাবে জানা নাম" / "known locally" (the village only in Bangla until there is a `village_en`). | `kashem bazar`, `Kasem Bazar`, `kashembazar`, `কাশেম বাজার`, `কাসেম বাজার` → কাশেম বাজার (the typo `kasehmbazar` comes with part 2) |
| 2 | Query understanding | Split the query into words. Words naming a district, upazila, thana or union (bn/en, any spelling) become context; filler words go (জেলা, উপজেলা, থানা, ইউনিয়ন, গ্রাম, এর কাছে, er kache, near, commas); the rest is the place name. Match inside the context first, then everywhere. If only the context matches: "<নাম> পাইনি, তবে <উপজেলা/থানা> পেয়েছি", and open that area. Common words (বাজার/bazar, হাট/hat, পাড়া/para, গ্রাম/gram, চর/char, স্কুল/school) never match on their own. Suggestions stay in the chosen district first. | `kashem bazar noakhali`, `kashem bazar er kache`, `kashem bazar neyajpur`, `অচেনা বাজার নোয়াখালী সদর` → "not found, but নোয়াখালী সদর", `bazar` → no fake match |
| 3 | Thana names | A thana → upazila list built from our police contact records (office name "… থানা"), each with that record's official `source_url`; nothing guessed. E.g. সুধারাম → নোয়াখালী সদর, চরজব্বর → সুবর্ণচর, and every Cox's Bazar thana. A validator check that every entry points to an existing upazila and a source. | `sudharam` → নোয়াখালী সদর, `কাশেম বাজার সুধারাম থানা` → কাশেম বাজার |
| 4 | Full address | Every result shows place · village · union · upazila (thana) · district. Sadar upazilas are always "নোয়াখালী সদর" / "Noakhali Sadar" (and "কক্সবাজার সদর"), never just the district name. This fixes "নিয়াজপুর ইউনিয়ন, নোয়াখালী, নোয়াখালী" and the upazila buttons. | result labels for a union, a village, a local name, both Sadars |
| 5 | Landmarks | New `data/landmarks/<district>.json` (name bn/en; type bazar/school/madrasa/college/mosque/hospital/ghat; village/union/upazila; `source_url` or local source; `added_by`; `added_on`). The village collector also reads the "হাট-বাজার" and "শিক্ষা প্রতিষ্ঠান" pages of each union/upazila portal (official sites only, certificate checks on, 1 s between requests). Validator check; cached for offline search. | collector dry run; validator 0 errors; a landmark found offline |
| 6 | When nothing matches | In this order: 1) a big "📍 লোকেশন দিয়ে খুঁজুন" button; 2) a step picker district → thana/upazila → union, each union with a few village and bazar names; 3) "জায়গাটা যোগ করতে বলুন" (place name + upazila, optional union), saved as a new report kind `missing_place` with the same limits as reports (verified email, 10/day, 60 s), Firestore rules + emulator tests, rules deployed after the tests pass. An admin adds the name as an alias only after checking an official list or confirming it locally, and records the source. | rules tests (new kind allowed only with the limits; no phone numbers in the text); browser test of the three steps |

All search tests in `tests/search-test.html` must keep passing, and the search must work offline (the index is built on the phone from cached files).

## Rules

- **No guessing.** A local name links to a union or village only when an official list or a team member confirms it; otherwise it links to the whole upazila. Every entry keeps its source.
- **No numbers.** None of these files holds a phone number; contacts still come only from the official records.
- **Privacy.** The search runs on the phone. A `missing_place` request holds only the place name and area the person typed, never a location.
- **Width sweep and tester GO** for every UI PR; bangla-reviewer for every new text.
