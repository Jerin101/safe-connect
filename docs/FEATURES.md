# SafeConnect – Feature List (v3)

Goal: in a crime or emergency, a person in Bangladesh reaches the **right official contact** and their **family** in a few seconds, even with weak internet.

Priority: **Must** = needed for the showcase · **Should** = adds real value · **Could** = only if time remains.
Rule: a few features that work perfectly beat many half-finished ones.

---

## 1. Find the right contact (no login)

| Feature | Priority |
|---|---|
| 999 button always visible at the top of every page | Must |
| Area picker: Division → District → Upazila → Union **or municipality (town)** (official list, whole country) | Must |
| **"Use my location"**: GPS picks your upazila automatically (free OpenStreetMap lookup, manual picker as fallback) | Should |
| Area page follows the **fallback chain** in BUILD_PLAN.md §4: 999 → police station → outpost/Tourist Police → village police → ward member → chairman → UNO → helplines → 333. A missing number never leaves an empty screen | Must |
| **Village search**: type a village name → its union and ward (559 villages from official pages); if it's not found, use GPS or pick the union | Should |
| Search in Bangla or English by name, office, designation or number | Must |
| Category chips: Police, Fire, Health, Women & Children, Legal, Local representatives, Tourist Police, Coast/River, Disaster, Information | Must |
| Contact card: tap-to-call, copy, share, Bangla digits in Bangla mode | Must |
| Every card shows **source link + "official page last updated" + "we checked on"**; warning label if the source is older than 2 years | Must |

## 2. Crime and emergency tools (no login)

| Feature | Why it matters in Bangladesh | Priority |
|---|---|---|
| **SOS share**: pick a situation → GPS → ready message with Google Maps link and time → WhatsApp / SMS / share sheet to saved family contacts | Family knows where you are within seconds | Must |
| **SMS fallback**: SOS opens SMS with the message when there is no internet (GPS still works offline) | Rural and highway areas often have weak data | Must |
| **Silent SOS**: no sound, dark screen, minimum taps | When shouting or a loud alarm would put you in more danger | Must |
| **Loud siren + flashing screen** | Draws attention, can scare off attackers | Must |
| **Safe Journey card**: before a trip, take a photo of the CNG/bus number plate, add route and expected arrival → share to family in one tap. When you arrive, tap "I reached safely" to send a message | Robbery and hijacking of CNGs and buses are common; a plate number helps police | Must |
| **Fake incoming call**: a realistic call screen to leave an unsafe situation (street harassment, being followed) | Common in women's safety apps; simple and useful | Should |
| **Village police of my ward (গ্রাম পুলিশ)**: shown right after the police station on every union page | Closest government security in a village at night; 641 numbers collected | Must |
| **Report a lost/stolen item (GD helper)**: fill in the item, serial number, place and time → a ready Bangla GD text to copy, plus where to file it (e.g. Inani police outpost → Ukhia police station) | Tourists and locals don't know where or how to file a GD | Should |
| **Places**: landmarks (e.g. Inani beach) linked to their union, police outpost, Coast Guard station and police station | People know the landmark, not the union name | Should |
| **What to do now** guides: robbery/hijack, harassment, kidnapping threat, road accident, fire, mobile-money (bKash/Nagad) fraud, cyber harassment. Taken only from official sources (Police, 999, Fire Service, DDM) | People panic; short official steps help | Should |
| **How to report a crime**: GD vs FIR, what to bring, women & children help desk at the thana, legal aid 16699, NLASO district office | Many people do not know the process | Should |
| **Evidence recorder**: record audio quietly and keep the file on the phone | Evidence for police | Could |
| **Shake to open SOS** (Android) | Faster than unlocking and searching | Could |

## 3. Areas the pilot data makes special

| Feature | Priority |
|---|---|
| **Tourist mode (Cox's Bazar)**: English-first; shows Tourist Police zones (Cox's Bazar, Inani, Saint Martin, Teknaf), the Tourist Police helpline, Coast Guard 16111 and beach safety | Should |
| **Coastal and cyclone tools (Hatiya, Subarnachar, Kutubdia, Maheshkhali…)**: 1090 warning line, cyclone signal meanings, Cyclone Preparedness Programme (CPP) and PIO contacts | Should |
| **River travel**: BIWTA 16113 and Coast Guard 16111 shown for Hatiya and island upazilas | Should |

## 4. Works anywhere

| Feature | Priority |
|---|---|
| Offline app: install to the home screen, works without internet after the first visit | Must |
| Bangla / English switch | Must |
| Night / Day theme | Must |
| Large-text mode | Should |
| Printable one-page area contact sheet (for families, shops, bus counters) | Should |
| **QR poster** for a union, bazar or bus stand that opens that area's page | Could |

## 5. With login (free Firebase plan)

| Feature | Priority |
|---|---|
| Family contacts and saved areas synced across devices | Should |
| Favourites | Should |
| Report a wrong number / suggest a new one (logged-in users only, which reduces spam) | Should |
| **Admin page (jerin101)**: review reports, see stale records, approve changes | Should |
| Private SOS and trip history (the user can delete it) | Could |
| Medical card (blood group, allergies) added to SOS only if the user turns it on | Could |

---

## Deliberately NOT included (and why — good to explain in the viva)

| Idea | Why not |
|---|---|
| Public "crime map" from user reports | False reports could defame people or spread panic, and moderation needs staff we don't have |
| Automatic SMS without user tap | Browsers block it for security; paid SMS gateways break the zero-budget rule |
| Live location tracking | Needs a paid always-on server, and raises big privacy risks |
| Personal data on our server without login | Privacy first: without login everything stays on the phone |
