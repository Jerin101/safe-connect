# OSM gaps: fuel deep-dive and 64-district gap table

> **Status (2026-11-17):** this is the measurement of 14–15 Nov 2026 that the places plan was based on. The data that was built from it is in `data/places/` (PR #217, 25,007 places; Jerin's later rules: places of the key kinds are kept even without a name, crafts split into workshops / other_services). For current numbers see `docs/COVERAGE.md` (Places section) and `docs/DATA_GAPS.md` §14.

Source: Geofabrik `bangladesh-latest.osm.pbf` (2026-11-13, MD5 matched), © OpenStreetMap contributors, ODbL 1.0. District = OSM `admin_level=5` polygon (as in OSM_COVERAGE.md); upazila = OSM `admin_level=6`. Every object type counted: node, way and relation.

## 1. Fuel search rules

An object is a **fuel hit** if any of these is true:

- `amenity=fuel`; any `fuel:*` key not `no` (fuel:cng, fuel:diesel, fuel:octane, fuel:lpg …); `shop=gas`
- lifecycle: `disused:/abandoned:/was:/construction:/proposed:/demolished:/removed:/razed:` + `amenity=fuel` or `shop=gas`; `construction=fuel`
- any name key (name, name:bn, name:en, alt_name, old_name, official_name, short_name) containing: filling station, petrol, pump, CNG, ফিলিং, পেট্রোল, পাম্প, সিএনজি
- extra spellings, marked `extra~`: পেট্রল, ফুয়েল, fuel, gas station, oil station

Each hit gets a verdict: **fuel (amenity=fuel / fuel:* tag)**, **likely fuel (name only)** (name has filling/petrol/পেট্রোল/ফিলিং/fuel/CNG station and no other place word), **unclear**, **gas-cylinder shop**, **closed/planned fuel**, or **probably not fuel** (e.g. "CNG stand" = auto-rickshaw stand, water pump). Verdicts are a word-match guess for the report, not checked on the ground.

## 2. Noakhali and neighbouring districts

| District | Hits | fuel (tag) | likely fuel (name) | unclear | gas shop | closed/planned | probably not fuel |
|---|---:|---:|---:|---:|---:|---:|---:|
| Noakhali | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Lakshmipur | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| Feni | 19 | 17 | 0 | 0 | 0 | 0 | 2 |
| Chandpur | 7 | 3 | 1 | 0 | 0 | 0 | 3 |
| Comilla | 100 | 93 | 2 | 0 | 0 | 0 | 5 |

### Noakhali (নোয়াখালী): 1 hits

| # | Name | Upazila | Tags | Matched by | Verdict | Why the first count missed it | OSM |
|---:|---|---|---|---|---|---|---|
| 1 | Khejur Tola CNG Bus Stop | Begumganj Upazila | highway=bus_stop, public_transport=stop_position | name~cng | probably not fuel (name word only) | only the name says it (highway=bus_stop, public_transport=stop_position) | [n8435345442](https://www.openstreetmap.org/node/8435345442) |

### Lakshmipur (লক্ষ্মীপুর): 3 hits

| # | Name | Upazila | Tags | Matched by | Verdict | Why the first count missed it | OSM |
|---:|---|---|---|---|---|---|---|
| 1 | Filliing Station | Lakshmipur Sadar Upazila | amenity=fuel, fuel:cng=no, fuel:octane_100=yes | amenity=fuel, fuel:octane_100=yes | fuel (amenity=fuel) | was counted (amenity=fuel) | [n4216908003](https://www.openstreetmap.org/node/4216908003) |
| 2 | GreenLeaf Filling Station | Lakshmipur Sadar Upazila | amenity=fuel, fuel:cng=yes | amenity=fuel, fuel:cng=yes, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n3215705057](https://www.openstreetmap.org/node/3215705057) |
| 3 | (no name) | Ramganj Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [n4312337709](https://www.openstreetmap.org/node/4312337709) |

### Feni (ফেনী): 19 hits

| # | Name | Upazila | Tags | Matched by | Verdict | Why the first count missed it | OSM |
|---:|---|---|---|---|---|---|---|
| 1 | Sultana Kamal Filling Stand সুলতানা কামাল ফিলিং স্টেশন | Chhagalnaiya Upazila | amenity=fuel | amenity=fuel, name~ফিলিং | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527472269](https://www.openstreetmap.org/way/527472269) |
| 2 | qbal & Son's CNG Complex Ltd. ইকবাল ও ছেলের সিএনজি কমপ্লেক্স লিমিটেড | Chhagalnaiya Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527476429](https://www.openstreetmap.org/way/527476429) |
| 3 | (no name) | Feni Sadar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [w1093396879](https://www.openstreetmap.org/way/1093396879) |
| 4 | Bakhrabad Gas Station, Feni. বাখরাবাদ গ্যাস স্টেশন, ফেনী। | Feni Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527422215](https://www.openstreetmap.org/way/527422215) |
| 5 | CNG | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527420351](https://www.openstreetmap.org/way/527420351) |
| 6 | Hazi Nazir Ahmed CNG Filling Station হাজী নাজির আহমেদ সিএনজি ফিলিং স্টেশনে | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527426849](https://www.openstreetmap.org/way/527426849) |
| 7 | Ma Moni Filling Station মা মনি ফিলিং স্টেশন | Feni Sadar Upazila | amenity=fuel, brand=Mamoni Filling Station মা মনি ফিলিং স্টেশন, fuel:diesel=yes, fuel:octane=yes, fuel:petrol=yes | amenity=fuel, fuel:diesel=yes, fuel:octane=yes, fuel:petrol=yes, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527420512](https://www.openstreetmap.org/way/527420512) |
| 8 | Mohipal Filling Station. | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527426159](https://www.openstreetmap.org/way/527426159) |
| 9 | Muhuri Filling Station মুহুরি ফিলিং ষ্টেশন | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527434510](https://www.openstreetmap.org/way/527434510) |
| 10 | PV Oil | Feni Sadar Upazila | amenity=fuel, brand=PV Oil, man_made=pump | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [w972605859](https://www.openstreetmap.org/way/972605859) |
| 11 | Prime CNG Station প্রাইম সিএনজি স্টেশন | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527420989](https://www.openstreetmap.org/way/527420989) |
| 12 | Progoti oil and gas station | Feni Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w1093396878](https://www.openstreetmap.org/way/1093396878) |
| 13 | S RAHMAN FILLING AND CNG STATION এস রহমান ফিলিং এন্ড সিএনজি স্টেশন | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6274356312](https://www.openstreetmap.org/node/6274356312) |
| 14 | Sondhani Filling Station সন্ধানী ফিলিং স্টেশন | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527429912](https://www.openstreetmap.org/way/527429912) |
| 15 | Star Line CNG Station / স্টার লাইন সিএনজি স্টেশন | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~cng, name~সিএনজি | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527429438](https://www.openstreetmap.org/way/527429438) |
| 16 | Star Line Petrol & Gas Station Feni | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~petrol, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527419342](https://www.openstreetmap.org/way/527419342) |
| 17 | Zenith Filling Station | Feni Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527470057](https://www.openstreetmap.org/way/527470057) |
| 18 | CNG Sten muhariganja | Chhagalnaiya Upazila | highway=bus_stop | name~cng | probably not fuel (name word only) | only the name says it (highway=bus_stop) | [n12169802624](https://www.openstreetmap.org/node/12169802624) |
| 19 | East Sujapur CNG Stand | Sonagazi Upazila | amenity=taxi | name~cng | probably not fuel (name word only) | only the name says it (amenity=taxi) | [n11665837203](https://www.openstreetmap.org/node/11665837203) |

### Chandpur (চাঁদপুর): 7 hits

| # | Name | Upazila | Tags | Matched by | Verdict | Why the first count missed it | OSM |
|---:|---|---|---|---|---|---|---|
| 1 | CNG Station | Hajiganj Upazila | amenity=fuel, fuel:cng=yes | amenity=fuel, fuel:cng=yes, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [n4088214489](https://www.openstreetmap.org/node/4088214489) |
| 2 | Nowrin C.N.G and Filling Station | Matlab Dakshin Upazila | amenity=fuel, fuel:Petrol=yes, fuel:diesel=yes, fuel:octane_98=yes | amenity=fuel, fuel:Petrol=yes, fuel:diesel=yes, fuel:octane_98=yes, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n4955809527](https://www.openstreetmap.org/node/4955809527) |
| 3 | CNG Station | Shaharasti Upazila | amenity=fuel, fuel:cng=yes | amenity=fuel, fuel:cng=yes, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [n4088219867](https://www.openstreetmap.org/node/4088219867) |
| 4 | চিতোষি ফিলিং স্টেশন / Chitoshi Filling Station | Shaharasti Upazila | man_made=fuel_pump | name~ফিলিং, name~filling station | likely fuel (name only) | only the name says it (man_made=fuel_pump) | [n12249851095](https://www.openstreetmap.org/node/12249851095) |
| 5 | Noabari CNG Stand | Kachua Upazila | amenity=taxi | name~cng | probably not fuel (name word only) | only the name says it (amenity=taxi) | [n6223336639](https://www.openstreetmap.org/node/6223336639) |
| 6 | Noluya CNG Stand | Kachua Upazila | amenity=taxi | name~cng | probably not fuel (name word only) | only the name says it (amenity=taxi) | [w664877831](https://www.openstreetmap.org/way/664877831) |
| 7 | Rohimanagar CNG Stand | Kachua Upazila | amenity=taxi, operator=Nabil CNG LTD. | name~cng | probably not fuel (name word only) | only the name says it (amenity=taxi, operator=Nabil CNG LTD.) | [n6223336590](https://www.openstreetmap.org/node/6223336590) |

### Comilla (কুমিল্লা): 100 hits

| # | Name | Upazila | Tags | Matched by | Verdict | Why the first count missed it | OSM |
|---:|---|---|---|---|---|---|---|
| 1 | (no name) | Burichang Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9175430](https://www.openstreetmap.org/relation/9175430) |
| 2 | (no name) | Burichang Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9175431](https://www.openstreetmap.org/relation/9175431) |
| 3 | (no name) | Burichang Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9179259](https://www.openstreetmap.org/relation/9179259) |
| 4 | (no name) | Burichang Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9179260](https://www.openstreetmap.org/relation/9179260) |
| 5 | B Baria Filling Station | Burichang Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n3889036049](https://www.openstreetmap.org/node/3889036049) |
| 6 | East Zone Gas Station | Burichang Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n3889036051](https://www.openstreetmap.org/node/3889036051) |
| 7 | Khorshed Alam CNG Station | Burichang Upazila | amenity=fuel, fuel:cng=yes | amenity=fuel, fuel:cng=yes, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [n3889036055](https://www.openstreetmap.org/node/3889036055) |
| 8 | M/S Naymul Gas Station | Burichang Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n5293150406](https://www.openstreetmap.org/node/5293150406) |
| 9 | Madina Filling Station | Burichang Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n3889036056](https://www.openstreetmap.org/node/3889036056) |
| 10 | Master & Sons Gas/Oil Station মাস্টার অ্যান্ড সন্স গ্যাস / তেল স্টেশন | Burichang Upazila | amenity=fuel | amenity=fuel, extra~oil station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526967467](https://www.openstreetmap.org/way/526967467) |
| 11 | Messrs Medina Filling Corporation | Burichang Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6180227318](https://www.openstreetmap.org/node/6180227318) |
| 12 | Nimsar Filling Station / NIMSAR FILLING STATION | Burichang Upazila | amenity=fuel | amenity=fuel, name~filling station, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n3889036659](https://www.openstreetmap.org/node/3889036659) |
| 13 | Nur & Brothers | Burichang Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [n3889036662](https://www.openstreetmap.org/node/3889036662) |
| 14 | Sakura CNG Gas Station সাকুরা সিএনজি গ্যাস স্টেশন | Burichang Upazila | amenity=fuel | amenity=fuel, name~cng, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6180227337](https://www.openstreetmap.org/node/6180227337) |
| 15 | Tazmahal Gas Station | Chauddagram Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n4609836195](https://www.openstreetmap.org/node/4609836195) |
| 16 | (no name) | Chauddagram Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9131034](https://www.openstreetmap.org/relation/9131034) |
| 17 | Cheora CNG Filling Station Ltd | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527238067](https://www.openstreetmap.org/way/527238067) |
| 18 | Chowdhury Filling Station চৌধুরী ফিলিং স্টেশন | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527233262](https://www.openstreetmap.org/way/527233262) |
| 19 | Heron Auto Filling Station হিরনের অটো ফিলিং স্টেশনে / হিরন ফিলিং স্টেশন | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~filling station, name~ফিলিং | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527189387](https://www.openstreetmap.org/way/527189387) |
| 20 | Highway Link হাইওয়ে লিংক | Chauddagram Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [n5307859320](https://www.openstreetmap.org/node/5307859320) |
| 21 | INTRACO CNG refining ইন্ট্রাকো সিএনজি বিশোধক | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527189420](https://www.openstreetmap.org/way/527189420) |
| 22 | Ideal Filling Station আইডিয়াল ফিলিং স্টেশন | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6274353469](https://www.openstreetmap.org/node/6274353469) |
| 23 | Jamuna Gas Plant,Comilla | Chauddagram Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [w1132424160](https://www.openstreetmap.org/way/1132424160) |
| 24 | M A Khaleque Filling Station এম এ খালেক ফিলিং স্টেশনে | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527217626](https://www.openstreetmap.org/way/527217626) |
| 25 | M/S Bhuiyan & Sons | Chauddagram Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [r10167080](https://www.openstreetmap.org/relation/10167080) |
| 26 | M/S Chowdhury & Sons CNG Station এম / এস চৌধুরী অ্যান্ড সন্স সিএনজি স্টেশন | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [r10166471](https://www.openstreetmap.org/relation/10166471) |
| 27 | Miah Bazar CNG Filling Station মিয়া বাজার সিএনজি ফিলিং স্টেশনে | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527189064](https://www.openstreetmap.org/way/527189064) |
| 28 | Mian Bazar Filling Station মিয়া বাজার ফিলিং স্টেশনের | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527190660](https://www.openstreetmap.org/way/527190660) |
| 29 | Premier Fuel Filling and CNG Station প্রিমিয়ার জ্বালানি ভর্তি এবং সিএনজি স্টেশন | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~cng, extra~fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527414137](https://www.openstreetmap.org/way/527414137) |
| 30 | SUPUA Petrol Pump | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~petrol | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527193156](https://www.openstreetmap.org/way/527193156) |
| 31 | Three Star Filling Station | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527415018](https://www.openstreetmap.org/way/527415018) |
| 32 | Universal CNG Filling Station ইউনিভার্সাল সিএনজি ফিলিং স্টেশন | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6312094538](https://www.openstreetmap.org/node/6312094538) |
| 33 | ময়নামতি ফিলিং ষ্টেশান | Chauddagram Upazila | amenity=fuel | amenity=fuel, name~ফিলিং | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527413927](https://www.openstreetmap.org/way/527413927) |
| 34 | (no name) | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [n4485069221](https://www.openstreetmap.org/node/4485069221) |
| 35 | (no name) | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526974123](https://www.openstreetmap.org/way/526974123) |
| 36 | (no name) | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526976565](https://www.openstreetmap.org/way/526976565) |
| 37 | (no name) | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9130672](https://www.openstreetmap.org/relation/9130672) |
| 38 | (no name) | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9130773](https://www.openstreetmap.org/relation/9130773) |
| 39 | (no name) | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9130843](https://www.openstreetmap.org/relation/9130843) |
| 40 | Advance CNG Filling Station এ্যাডভান্স সি এন জি ফিলিং স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel, building=yes | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527003448](https://www.openstreetmap.org/way/527003448) |
| 41 | Arafat Rana Gas Station আরাফাত রানা গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526973791](https://www.openstreetmap.org/way/526973791) |
| 42 | BSZ Gas Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527002065](https://www.openstreetmap.org/way/527002065) |
| 43 | Bangla GAS বাংলা গ্যাস | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526983158](https://www.openstreetmap.org/way/526983158) |
| 44 | Bhuiyan gas station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6149177115](https://www.openstreetmap.org/node/6149177115) |
| 45 | Bhuyan & Haque CNG ভূঁইয়া এন্ড হক সি এন জি | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526992948](https://www.openstreetmap.org/way/526992948) |
| 46 | Bismillah Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n4827839828](https://www.openstreetmap.org/node/4827839828) |
| 47 | Bismillsh Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526992824](https://www.openstreetmap.org/way/526992824) |
| 48 | CNG Pump সিএনজি পাম্প | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526981176](https://www.openstreetmap.org/way/526981176) |
| 49 | Comilla Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6180446793](https://www.openstreetmap.org/node/6180446793) |
| 50 | Cosmos Gas Station কসমস গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6177813084](https://www.openstreetmap.org/node/6177813084) |
| 51 | Essa Garden (Pvt.) Ltd-2 ইসা গার্ডেন (প্রাঃ) লিমিটেড-২ | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6177821698](https://www.openstreetmap.org/node/6177821698) |
| 52 | Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n5124033352](https://www.openstreetmap.org/node/5124033352) |
| 53 | G. Das Gas Station জি দাস গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6189342470](https://www.openstreetmap.org/node/6189342470) |
| 54 | Goodluck Gas Station গুডলাক গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526994528](https://www.openstreetmap.org/way/526994528) |
| 55 | Highway Gas Station হাইওয়ে গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526995810](https://www.openstreetmap.org/way/526995810) |
| 56 | Image Gas Station ভাবমূর্তি গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6177813039](https://www.openstreetmap.org/node/6177813039) |
| 57 | Intraco Gas Station ইন্ট্রাকো গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6189335031](https://www.openstreetmap.org/node/6189335031) |
| 58 | Jamuna Petrol Pump | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~petrol | fuel (amenity=fuel) | was counted (amenity=fuel) | [n2813724461](https://www.openstreetmap.org/node/2813724461) |
| 59 | Jannat CNG Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [n5123808224](https://www.openstreetmap.org/node/5123808224) |
| 60 | M A Hakim & Sons Gas Station এম এ হাকিম অ্যান্ড সন্স গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6149095803](https://www.openstreetmap.org/node/6149095803) |
| 61 | M/S Khaza Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n5292980439](https://www.openstreetmap.org/node/5292980439) |
| 62 | M/S Sujan Gas Station এম / এস সুজন গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526962928](https://www.openstreetmap.org/way/526962928) |
| 63 | Mallika Gas Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6180589433](https://www.openstreetmap.org/node/6180589433) |
| 64 | Mun Highway Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526996252](https://www.openstreetmap.org/way/526996252) |
| 65 | National Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n2813709912](https://www.openstreetmap.org/node/2813709912) |
| 66 | Nurul Islam Hazari CNG & Filling Station নুরুল ইসলাম হাজারী সিএনজি ও ফিলিং স্টেশনে | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527001614](https://www.openstreetmap.org/way/527001614) |
| 67 | Petrol Pump | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~petrol | fuel (amenity=fuel) | was counted (amenity=fuel) | [n2813734159](https://www.openstreetmap.org/node/2813734159) |
| 68 | Rahat Gas Station রাহাত গ্যাস স্টেশন | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6149217131](https://www.openstreetmap.org/node/6149217131) |
| 69 | Rahmaa Gas Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526980335](https://www.openstreetmap.org/way/526980335) |
| 70 | Rahman Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526965259](https://www.openstreetmap.org/way/526965259) |
| 71 | River View CNG & Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526995135](https://www.openstreetmap.org/way/526995135) |
| 72 | Saboria Gas Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526966174](https://www.openstreetmap.org/way/526966174) |
| 73 | South Comilla Filling & Gas Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526996672](https://www.openstreetmap.org/way/526996672) |
| 74 | Swajan Gas Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n6180765246](https://www.openstreetmap.org/node/6180765246) |
| 75 | Taj CNG Filling Station | Cumilla Adarsha Sadar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w527005493](https://www.openstreetmap.org/way/527005493) |
| 76 | CNG Station সিএনজি স্টেশন | Daudkandi Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526419123](https://www.openstreetmap.org/way/526419123) |
| 77 | Essa Kha CNG Pump | Daudkandi Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526422426](https://www.openstreetmap.org/way/526422426) |
| 78 | Mohona CNG Filling Station মোহনা সিএনজি ফিলিং স্টেশনের | Daudkandi Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526386847](https://www.openstreetmap.org/way/526386847) |
| 79 | Petrol Pump পেট্রোল পাম্প | Daudkandi Upazila | amenity=fuel | amenity=fuel, name~petrol | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526436494](https://www.openstreetmap.org/way/526436494) |
| 80 | Rabeya CNG Complex Ltd রাবেয়া সিএনজি কমপ্লেক্স লিমিটেড Gas Station | Daudkandi Upazila | amenity=fuel | amenity=fuel, name~cng, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526422692](https://www.openstreetmap.org/way/526422692) |
| 81 | Reliable CNG And Petrol Pump নির্ভরযোগ্য সিএনজি আর পেট্রোল পাম্প | Daudkandi Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526436508](https://www.openstreetmap.org/way/526436508) |
| 82 | Tasfin CNG and Refueling Station সিএনজি স্টেশন | Daudkandi Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526418815](https://www.openstreetmap.org/way/526418815) |
| 83 | Xpeed CNG Station | Daudkandi Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526392285](https://www.openstreetmap.org/way/526392285) |
| 84 | Bipasha Petrol Pump | Debidwar Upazila | amenity=fuel | amenity=fuel, name~petrol | fuel (amenity=fuel) | was counted (amenity=fuel) | [n2815326045](https://www.openstreetmap.org/node/2815326045) |
| 85 | Comilla CNG Filling Station কুমিল্লা সিএনজি ফিলিং স্টেশন | Debidwar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9257838](https://www.openstreetmap.org/relation/9257838) |
| 86 | Gas Station Petrol Pump | Debidwar Upazila | amenity=fuel | amenity=fuel, name~petrol, extra~gas station | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9257837](https://www.openstreetmap.org/relation/9257837) |
| 87 | Purbasha Filling Station | Debidwar Upazila | amenity=fuel | amenity=fuel, name~filling station | fuel (amenity=fuel) | was counted (amenity=fuel) | [n2815356544](https://www.openstreetmap.org/node/2815356544) |
| 88 | RNR CNG station | Debidwar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [w526451651](https://www.openstreetmap.org/way/526451651) |
| 89 | Shaharpar CNG Station | Debidwar Upazila | amenity=fuel | amenity=fuel, name~cng | fuel (amenity=fuel) | was counted (amenity=fuel) | [r9257839](https://www.openstreetmap.org/relation/9257839) |
| 90 | ZOOM LPG Autogas & Fuel Filling Station | Monohorgonj Upazila | amenity=fuel, fuel:cng=yes, fuel:diesel=yes, fuel:lpg=yes | amenity=fuel, fuel:cng=yes, fuel:diesel=yes, fuel:lpg=yes, name~filling station, extra~fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [n10047105751](https://www.openstreetmap.org/node/10047105751) |
| 91 | ZOOM LPG Autogas & Fuel Filling Station | Monohorgonj Upazila | amenity=fuel, building=yes, fuel:cng=yes, fuel:diesel=yes, fuel:lpg=yes, fuel:petrol=yes | amenity=fuel, fuel:cng=yes, fuel:diesel=yes, fuel:lpg=yes, fuel:petrol=yes, name~filling station, extra~fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [w1097250868](https://www.openstreetmap.org/way/1097250868) |
| 92 | (no name) | Muradnagar Upazila | amenity=fuel | amenity=fuel | fuel (amenity=fuel) | was counted (amenity=fuel) | [n4369702712](https://www.openstreetmap.org/node/4369702712) |
| 93 | 25 Srekail Gas Firld | Muradnagar Upazila | amenity=fuel, operator=BAPEX, fuel:gas=yes | amenity=fuel, fuel:gas=yes | fuel (amenity=fuel) | was counted (amenity=fuel) | [w439329472](https://www.openstreetmap.org/way/439329472) |
| 94 | Gouripur Gas Station | Daudkandi Upazila | – | extra~gas station | likely fuel (name only) | only the name says it (no category tag) | [n2783453115](https://www.openstreetmap.org/node/2783453115) |
| 95 | মনোহরগঞ্জ সিএনজি স্টেশন / Monohorganj CNG Station | Monohorgonj Upazila | amenity=taxi | name~সিএনজি, name~cng | likely fuel (name only) | only the name says it (amenity=taxi) | [n11510813924](https://www.openstreetmap.org/node/11510813924) |
| 96 | সেচ পাম্প / Irrigation Pump | Brahmanpara Upazila | man_made=pump | name~পাম্প, name~pump | probably not fuel (name word only) | only the name says it (man_made=pump) | [n13438199146](https://www.openstreetmap.org/node/13438199146) |
| 97 | CNG Stand | Burichang Upazila | highway=bus_stop, public_transport=stop_position | name~cng | probably not fuel (name word only) | only the name says it (highway=bus_stop, public_transport=stop_position) | [n5123602547](https://www.openstreetmap.org/node/5123602547) |
| 98 | Chauddagram CNG Bus Stop | Chauddagram Upazila | highway=bus_stop, public_transport=stop_position | name~cng | probably not fuel (name word only) | only the name says it (highway=bus_stop, public_transport=stop_position) | [n5126010413](https://www.openstreetmap.org/node/5126010413) |
| 99 | Laksham- Bangodda CNG Stand, Chauddagram | Chauddagram Upazila | amenity=taxi | name~cng | probably not fuel (name word only) | only the name says it (amenity=taxi) | [n12192583529](https://www.openstreetmap.org/node/12192583529) |
| 100 | Mayer Dua CNG Workshop | Cumilla Adarsha Sadar Upazila | shop=car_repair | name~cng | probably not fuel (name word only) | only the name says it (shop=car_repair) | [n6091662581](https://www.openstreetmap.org/node/6091662581) |

### Why the first count found 0 fuel in Noakhali

- The first count (OSM_COVERAGE.md) used **only `amenity=fuel`** for fuel, over node, way and relation. Noakhali has **0** objects with `amenity=fuel` in this extract, so that count was correct for its rule.
- The broader rules (all fuel tags, shop=gas, lifecycle, name words in Bangla and English) find only **1** hit in Noakhali, and it is not a fuel station (see the table).
- **Boundary checked:** the OSM Noakhali polygon (relation 3824792) is one piece of about 6,400 km² (land, chars and sea), lat 21.37–23.13, lon 90.83–91.43, and holds the upazila polygons of Noakhali Sadar, Begumganj, Chatkhil, Companiganj, Hatiya, Senbagh and Subarnachar (Sonaimuri and Kabirhat have no admin_level=6 polygon in OSM). The nearest `amenity=fuel` objects are 6.7–11 km **outside** it (e.g. GreenLeaf Filling Station n3215705057 in Lakshmipur; ZOOM LPG Autogas w1097250868 north of the border).
- **So nothing was missed by our rules or our boundary check.** The petrol pumps in Noakhali (they certainly exist) are simply **not mapped in OpenStreetMap** in this extract: not as `amenity=fuel`, not as a named point or building. OSM cannot fill this gap; the official dealer lists in §4 can. A second, wider recheck (all tags + live OSM) is in §7.

## 3. Gap table (64 districts)

Counts by the same rules (node + way + relation). **fuel (tag)** = amenity=fuel or a live fuel:* tag; **fuel (broad)** = fuel (tag) + likely fuel by name. **bank/atm** = amenity=bank + amenity=atm. A row is listed when any of hospital, pharmacy, fuel (broad), bank/atm or bus_station is **below 3**. **0 is bold**.

| Division | District | hospital | pharmacy | fuel (tag) | fuel (broad) | bank/atm | bank | atm | bus_station | Gaps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Barisal | Barguna (বরগুনা) | 4 | 2 | 3 | 3 | 26 | 23 | 3 | 14 | 1 |
| Barisal | Bhola (ভোলা) | 9 | 1 | **0** | **0** | 7 | 6 | 1 | 1 | 3 |
| Barisal | Jhalokati (ঝালকাঠি) | 4 | 2 | 5 | 5 | 5 | 3 | 2 | 2 | 2 |
| Barisal | Patuakhali (পটুয়াখালী) | 14 | 7 | 2 | 2 | 30 | 27 | 3 | 9 | 1 |
| Chittagong | Bandarban (বান্দরবান) | 8 | 1 | **0** | **0** | 15 | 5 | 10 | 2 | 3 |
| Chittagong | Chandpur (চাঁদপুর) | 9 | **0** | 3 | 4 | 6 | 5 | 1 | 3 | 1 |
| Chittagong | Khagrachhari (খাগড়াছড়ি) | 6 | 4 | **0** | **0** | 8 | 6 | 2 | 3 | 1 |
| Chittagong | Lakshmipur (লক্ষ্মীপুর) | 8 | 1 | 3 | 3 | 1 | 1 | **0** | **0** | 3 |
| Chittagong | Noakhali (নোয়াখালী) | 12 | 9 | **0** | **0** | 5 | 4 | 1 | 1 | 2 |
| Chittagong | Rangamati (রাঙ্গামাটি) | 6 | 1 | 3 | 3 | 12 | 8 | 4 | 6 | 1 |
| Dhaka | Madaripur (মাদারীপুর) | 16 | 2 | 13 | 13 | 15 | 12 | 3 | 15 | 1 |
| Dhaka | Manikganj (মানিকগঞ্জ) | 40 | 20 | 18 | 18 | 19 | 14 | 5 | 1 | 1 |
| Dhaka | Rajbari (রাজবাড়ী) | 6 | 1 | 4 | 5 | 8 | 6 | 2 | 2 | 2 |
| Khulna | Bagerhat (বাগেরহাট) | 22 | 30 | 9 | 12 | 40 | 37 | 3 | 1 | 1 |
| Khulna | Chuadanga (চুয়াডাঙ্গা) | 4 | 1 | 2 | 3 | 2 | 2 | **0** | 6 | 2 |
| Khulna | Magura (মাগুরা) | 3 | 13 | 6 | 6 | 13 | 11 | 2 | 1 | 1 |
| Khulna | Meherpur (মেহেরপুর) | 6 | 12 | 1 | 1 | 6 | 6 | **0** | 1 | 2 |
| Khulna | Narail (নড়াইল) | 7 | 45 | 2 | 3 | 10 | 5 | 5 | 1 | 1 |
| Mymensingh | Sherpur (শেরপুর) | 43 | 44 | 17 | 18 | 33 | 31 | 2 | 1 | 1 |
| Rangpur | Gaibandha (গাইবান্ধা) | 19 | 19 | 9 | 9 | 28 | 23 | 5 | **0** | 1 |
| Rangpur | Kurigram (কুড়িগ্রাম) | 6 | 2 | 13 | 13 | 26 | 25 | 1 | 4 | 1 |
| Sylhet | Maulvibazar (মৌলভীবাজার) | 29 | 14 | 15 | 15 | 41 | 29 | 12 | 1 | 1 |

22 of 64 districts have at least one gap.

| Category | Districts with 0 | Districts with < 3 |
|---|---:|---:|
| hospital | 0 | 0 |
| pharmacy | 1 | 11 |
| fuel (broad) | 4 | 6 |
| bank/atm | 0 | 2 |
| bus_station | 2 | 14 |

<details><summary>All 64 districts</summary>

| District | hospital | pharmacy | fuel (tag) | fuel (broad) | bank/atm | bank | atm | bus_station |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Bagerhat | 22 | 30 | 9 | 12 | 40 | 37 | 3 | 1 |
| Bandarban | 8 | 1 | **0** | **0** | 15 | 5 | 10 | 2 |
| Barguna | 4 | 2 | 3 | 3 | 26 | 23 | 3 | 14 |
| Barisal | 22 | 41 | 14 | 14 | 36 | 28 | 8 | 9 |
| Bhola | 9 | 1 | **0** | **0** | 7 | 6 | 1 | 1 |
| Bogra | 104 | 78 | 107 | 110 | 171 | 127 | 44 | 16 |
| Brahmanbaria | 12 | 4 | 10 | 10 | 14 | 13 | 1 | 19 |
| Chandpur | 9 | **0** | 3 | 4 | 6 | 5 | 1 | 3 |
| Chapai Nababganj | 10 | 11 | 24 | 24 | 25 | 20 | 5 | 8 |
| Chittagong | 201 | 427 | 244 | 258 | 890 | 734 | 156 | 69 |
| Chuadanga | 4 | 1 | 2 | 3 | 2 | 2 | **0** | 6 |
| Comilla | 52 | 23 | 93 | 95 | 98 | 72 | 26 | 15 |
| Cox's Bazar | 51 | 52 | 21 | 22 | 80 | 51 | 29 | 5 |
| Dhaka | 524 | 1929 | 287 | 299 | 1791 | 1105 | 686 | 90 |
| Dinajpur | 36 | 60 | 42 | 44 | 89 | 69 | 20 | 10 |
| Faridpur | 19 | 93 | 27 | 28 | 64 | 41 | 23 | 8 |
| Feni | 16 | 7 | 17 | 17 | 16 | 12 | 4 | 6 |
| Gaibandha | 19 | 19 | 9 | 9 | 28 | 23 | 5 | **0** |
| Gazipur | 82 | 81 | 112 | 117 | 174 | 112 | 62 | 10 |
| Gopalganj | 12 | 8 | 9 | 10 | 8 | 6 | 2 | 6 |
| Habiganj | 14 | 14 | 25 | 25 | 21 | 18 | 3 | 10 |
| Jamalpur | 28 | 22 | 12 | 13 | 34 | 29 | 5 | 4 |
| Jessore | 30 | 107 | 26 | 29 | 106 | 75 | 31 | 15 |
| Jhalokati | 4 | 2 | 5 | 5 | 5 | 3 | 2 | 2 |
| Jhenaidah | 11 | 31 | 12 | 14 | 42 | 37 | 5 | 10 |
| Joypurhat | 4 | 3 | 13 | 13 | 24 | 21 | 3 | 4 |
| Khagrachhari | 6 | 4 | **0** | **0** | 8 | 6 | 2 | 3 |
| Khulna | 36 | 62 | 12 | 13 | 32 | 23 | 9 | 39 |
| Kishoregonj | 24 | 44 | 7 | 8 | 30 | 25 | 5 | 13 |
| Kurigram | 6 | 2 | 13 | 13 | 26 | 25 | 1 | 4 |
| Kushtia | 9 | 9 | 12 | 12 | 22 | 20 | 2 | 5 |
| Lakshmipur | 8 | 1 | 3 | 3 | 1 | 1 | **0** | **0** |
| Lalmonirhat | 5 | 6 | 21 | 21 | 35 | 34 | 1 | 4 |
| Madaripur | 16 | 2 | 13 | 13 | 15 | 12 | 3 | 15 |
| Magura | 3 | 13 | 6 | 6 | 13 | 11 | 2 | 1 |
| Manikganj | 40 | 20 | 18 | 18 | 19 | 14 | 5 | 1 |
| Maulvibazar | 29 | 14 | 15 | 15 | 41 | 29 | 12 | 1 |
| Meherpur | 6 | 12 | 1 | 1 | 6 | 6 | **0** | 1 |
| Munshiganj | 16 | 36 | 31 | 31 | 40 | 33 | 7 | 14 |
| Mymensingh | 88 | 77 | 74 | 76 | 146 | 118 | 28 | 19 |
| Naogaon | 38 | 34 | 33 | 33 | 78 | 74 | 4 | 12 |
| Narail | 7 | 45 | 2 | 3 | 10 | 5 | 5 | 1 |
| Narayanganj | 6 | 14 | 56 | 59 | 167 | 113 | 54 | 32 |
| Narsingdi | 9 | 10 | 26 | 27 | 49 | 40 | 9 | 23 |
| Natore | 26 | 20 | 45 | 48 | 70 | 65 | 5 | 15 |
| Netrakona | 15 | 26 | 6 | 6 | 51 | 42 | 9 | 8 |
| Nilphamari | 46 | 35 | 23 | 23 | 44 | 39 | 5 | 8 |
| Noakhali | 12 | 9 | **0** | **0** | 5 | 4 | 1 | 1 |
| Pabna | 15 | 28 | 17 | 17 | 44 | 41 | 3 | 13 |
| Panchagarh | 18 | 23 | 29 | 30 | 38 | 37 | 1 | 4 |
| Patuakhali | 14 | 7 | 2 | 2 | 30 | 27 | 3 | 9 |
| Pirojpur | 4 | 16 | 7 | 7 | 13 | 12 | 1 | 6 |
| Rajbari | 6 | 1 | 4 | 5 | 8 | 6 | 2 | 2 |
| Rajshahi | 36 | 59 | 33 | 35 | 86 | 64 | 22 | 9 |
| Rangamati | 6 | 1 | 3 | 3 | 12 | 8 | 4 | 6 |
| Rangpur | 67 | 125 | 67 | 72 | 92 | 67 | 25 | 14 |
| Satkhira | 30 | 82 | 7 | 7 | 44 | 38 | 6 | 5 |
| Shariatpur | 15 | 11 | 8 | 8 | 11 | 11 | **0** | 9 |
| Sherpur | 43 | 44 | 17 | 18 | 33 | 31 | 2 | 1 |
| Sirajganj | 23 | 15 | 30 | 31 | 26 | 25 | 1 | 6 |
| Sunamganj | 14 | 3 | 6 | 6 | 17 | 13 | 4 | 5 |
| Sylhet | 43 | 66 | 51 | 55 | 188 | 139 | 49 | 22 |
| Tangail | 108 | 112 | 76 | 81 | 92 | 77 | 15 | 11 |
| Thakurgaon | 10 | 9 | 20 | 22 | 45 | 40 | 5 | 7 |

</details>

## 4. Official lists

Checked on 2026-11-14 with HTTPS and certificate checks on, one request at a time with ≥ 1.2 s between requests. Only the HTML pages were read; for the list files only a HEAD request (size, type, date) was sent. Status 2026-11-14: nothing downloaded. **2026-11-15:** Padma's list and Jamuna's LPG list were downloaded with Jerin's OK; their columns are in §8.

| Source | Page | File | Format | District / address | Location (lat/lon) | Terms of use |
|---|---|---|---|---|---|---|
| পদ্মা অয়েল পিএলসি (Padma Oil) | https://pocl.gov.bd/pages/static-pages/6922dece933eb65569e1d7db ("ডিলার (ফিলিং স্টেশান)"); also এল পি জি ডিলার, এজেন্ট, প্যাকড ডিলার pages | PDF, 98 KB (HEAD: Last-Modified 2026-01-05; object path 2024/12) | PDF | Not known until opened (page text gives no column list) | Not known; no map or coordinates on the page | National-portal (a2i) template; same "ব্যবহারের শর্তাবলী" footer as Jamuna (see note) |
| মেঘনা পেট্রোলিয়াম (Meghna Petroleum) | https://mpl.gov.bd/pages/static-pages/6922de45933eb65569e19700 ("কাস্টমার তথ্য" → row "ফিলিং স্টেশন/ডিলার", dated ১১.০৬.২০২৬) | PDF, 13.0 MB (HEAD: Last-Modified 2026-01-05); also "জেলা ভিত্তিক এলপিজি কাস্টমার তালিকা" PDF 4.8 MB | PDF (13 MB: possibly scanned images; to check) | Not known until opened. The LPG list title says জেলা ভিত্তিক (by district) | No coordinates on the page. The "ডিপো নেটওয়ার্ক লিংক" is a Google My Maps link (depots only, and Google: not used) | National-portal template, same footer |
| যমুনা অয়েল পিএলসি (Jamuna Oil) | https://jamunaoil.gov.bd/pages/static-pages/6922e104933eb65569e299fa ("বিপণন নেটওয়ার্ক": ডিলার/ফিলিং স্টেশন ৭৫৯টি, "কোম্পানির বিদ্যমান ফিলিং স্টেশনের তালিকা ডাউনলোড") | PDF, 0.94 MB (HEAD: Last-Modified 2026-01-05) | PDF | Not known until opened | No coordinates on the page | Read: https://jamunaoil.gov.bd/pages/static-pages/6922dd23933eb65569e13a4a (see note) |
| RPGCL (CNG) | https://rpgcl.org.bd/pages/reports?filters=… ("এক নজরে সিএনজি কার্যক্রম", monthly, latest "অক্টোবর-২০২৬ পর্যন্ত" dated 11/9/2026); report type "সিএনজি ফিলিং স্টেশন ও ওয়ার্কশপ পরিদর্শন প্রতিবেদন" also exists | PDF, 183 KB (HEAD: Last-Modified 2026-11-09) | PDF | Not known. The title suggests national totals, not a station list; the inspection reports may list stations | Not known; none on the pages | National-portal template, same footer |
| BERC (LPG autogas station licences) | **No public list found.** Checked https://berc.org.bd/: homepage menu, "এলপিজি" page (/pages/static-pages/6922e0f0933eb65569e293ec → HTTP 404), "ট্যারিফ আদেশ (গ্যাস)", "লাইসেন্স আবেদনের নিয়মাবলী" forms page, notices list, annual reports list. None names autogas stations. `www.berc.org.bd` has an untrusted certificate (not used) | – . The e-licence site https://elicense.berc.org.bd/ needs a login; its public "Verify License" page (/LicenseVerification) checks one licence number at a time and is not a list | – | – | – | Same national-portal footer. A list could be asked for under the RTI Act 2009 through BERC's information officer (/views/info-officers): NEEDS JERIN |
| DGHS Health Facility Registry | https://hrm.dghs.gov.bd/public/facility-registry (facilityregistry.dghs.gov.bd gave HTTP 503 twice) | HTML table filled from JSON (`/public/facility-registry/facilities/datatable/json`, `/public/facilities/json`); reports: Organization List, Organization Summary | HTML + JSON (not called) | Table columns: ID, Name, Name (Bangla), Code, Email, Agency, Type, Primary Ownership, Division, District, City Corporation, Upazila, Active. Search by Mobile No exists. No address column in the table | Not in the table columns; no latitude/longitude on the page. The JSON may have more fields (not checked) | No terms-of-use or licence link found on the page |

- **Terms (national-portal template, read on jamunaoil.gov.bd):** content is protected by the Copyright Act (amended 2005); users may print the information without changing, adding to or editing it; content not owned by the Government needs that body's permission. There is no open-data licence. Using names + districts with a `source_url` (as we do for contacts) fits our current practice, but republishing a whole list as a dataset is not clearly allowed: NEEDS JERIN (or ask the companies).
- **TLS:** `www.pocl.gov.bd` and `www.rpgcl.org.bd` present a self-signed "Kubernetes Ingress Controller Fake Certificate"; those hosts were not used. `pocl.gov.bd` and `rpgcl.org.bd` (without www) have valid certificates and were used. (On 2026-11-14 one handshake per www host was opened without verification only to read the certificate; Jerin has ruled that this is not allowed either, and it will not be done again.)
- **Correction (2026-11-15):** on the Jamuna page, "ফিলিং স্টেশনের তালিকা" links to a **Google Drive** file (`drive.google.com/file/d/1ai7Odqy…`), not to the gov object store. The 0.94 MB PDF listed above is the **LPG dealer list** (740 rows). See §8.
- `padmaoil.gov.bd` and `rpgcl.gov.bd` do not resolve.
- Dealer lists name the station and usually the area; even with a district they have no coordinates, so a map pin would need geocoding (Nominatim, 1 request/s, tools only) or a match to an OSM object. A list-only entry (name + upazila, no pin) is possible without that.
- Meghna's 13 MB PDF may be scanned images; if so, reading it needs OCR, which is not in the standard library.

## 5. Google Maps (plan for PR 3 only)

- No data is taken from Google Maps: no scraping, no Places API, nothing stored.
- **Decision 2026-11-15: the "Google Maps-এ আরও দেখুন" button is built by Tasmin (frontend), not in PR 3.** Jerin's spec for it, kept here for reference: under each category list, link `https://www.google.com/maps/search/?api=1&query=<category> near <area name>` (area name text only, never coordinates), opened only on tap, `rel="noopener noreferrer"`.
- PR 3 (map) does not touch `css/`, `js/icons.js`, `tests/must-find/places/` or `docs/reports/testing/`.

## 6. Second path: `data/places/manual_<district>.json` (plan only, no code yet)

For places that OSM does not have (like Noakhali's petrol pumps), checked by the team.

### Flow

1. Tasmin keeps the Sheet tab **"নতুন জায়গা"**. A person downloads it as CSV (File → Download → CSV) to `E:\Projects\SafeConnect-Files\manual\<date>-notun-jayga.csv` (outside the repo). The tool never reads the Sheet online and uses no Google API.
2. `python tools/import_manual_places.py <csv> data` (standard library `csv` + `json` only, no network) writes one `data/places/manual_<district>.json` per district. Rows that fail a check are not written; the tool prints the row number and the reason so Tasmin can fix the Sheet.
3. `python tools/validate_data.py data` (0 errors), data-checker GO, then a data PR (rule 2).

### CSV columns (proposed; Tasmin confirms the header row)

`row_id, name_bn, name_en, category, subcategory, district, upazila, union, address_bn, lat, lon, location_source, phone, hours, verified_by, source_url, checked_by, checked_on, note`

- `row_id`: a fixed number per row in the Sheet, so the place `id` (`man-<district>-<row_id>`) stays the same when rows move.
- `union` only when an official page names it (as for landmarks).
- `lat`/`lon` optional. If given, `location_source` is required: `official_list`, `owner_page` or `visited_gps` (a team member's own phone reading on site).
- `phone` only if it is printed on the `source_url` page (MASTER_PLAN "phone (if published)"); never from Google.

### File shape (MASTER_PLAN place shape + two fields)

```json
{
  "district_en": "Noakhali",
  "source_note": "Places checked by the SafeConnect team. Not from Google Maps.",
  "places": [
    {
      "id": "man-noakhali-12",
      "name_bn": "…", "name_en": "…",
      "category": "fuel", "subcategory": "filling_station",
      "division": "Chittagong", "district": "Noakhali", "upazila": "Begumganj", "union": null,
      "address_bn": "…",
      "lat": null, "lon": null, "location_approx": true, "location_source": null,
      "phone": null, "hours": null,
      "source": "official", "verified_by": "official_list",
      "source_url": "https://….gov.bd/…",
      "checked_by": "tasmintoshi", "checked_on": "2026-11-15"
    }
  ]
}
```

- `source` follows MASTER_PLAN (`official|osm|owner|user`): `official_list` → `official`, `owner_page` → `owner`, `visited` → `user`.
- `verified_by` ∈ `official_list | owner_page | visited`.

### No location → "আনুমানিক অবস্থান"

- If `lat`/`lon` are empty, the file stores `lat: null, lon: null, location_approx: true`. **The centre's coordinates are not copied into the place**, so the data never claims a location it does not have.
- The website puts the pin at the upazila `center` from `data/locations.json` (BBS / OCHA HDX, CC BY-IGO), with the label **"আনুমানিক অবস্থান"** / "Approximate location" on the card and on the map pin (a different, hollow pin).
- The distance reads "উপজেলা কেন্দ্র থেকে ~X কিমি"; approximate places sort after exact ones.
- **🧭 পথ দেখান is not a directions link to the centre** (that would send the user to the wrong place). For approximate places it becomes a search link by name + upazila (as in §5: text only, no coordinates).
- `data/locations.json` now has centres for the 18 upazilas of Noakhali and Cox's Bazar only. Other districts need the same BBS/HDX upazila centres first (nationwide data step); until then, an approximate place outside those districts shows in the list without a pin.

### Google Maps data is never used

No location, plus code, phone, hours, photo or review from Google Maps goes into the data. The validator checks every place in `data/places/manual_*.json`:

| Check | Level |
|---|---|
| `source_url` host is `google.com` or any subdomain (maps.google.com, docs.google.com…), or `goo.gl` / `maps.app.goo.gl` | **error** (asked by Jerin) |
| Also suggested: `google.com.bd` and other `google.*` country domains, `g.page`, `g.co`, `googleusercontent.com`, `ggpht.com` | **error** (suggestion) |
| Any field contains a Plus Code (regex `\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b`, e.g. `V3P8+2F`) | **error** (suggestion) |
| `note`/`address_bn` mentions "google" or "গুগল" | warning |
| `verified_by` not in the list; `source_url` missing or not `https://` | error |
| `verified_by=official_list` and the host is not `*.gov.bd` (or `acc.org.bd`) | error |
| `lat`/`lon` given without `location_source`, or outside the stated upazila polygon (`data/locations.json`) | error |
| `location_approx` not equal to "lat/lon are empty" | error |
| `checked_on` missing or in the future; `checked_by` not a team login | error / warning |
| Same category and same normalised name in the same upazila as an OSM place, or within 100 m | warning (data-checker decides: merge into one card showing both sources) |

Limit: the validator can only catch the marks Google leaves (links, plus codes). It cannot prove where a typed number came from. That is why `location_source` is required and data-checker asks for it on every new pin.

### Tests

- Validator: one good file plus bad rows (google.com, maps.app.goo.gl, docs.google.com, plus code, missing `source_url`, `official_list` on a non-gov site, lat/lon outside the upazila, `location_approx` mismatch). Each must give exactly its error.
- Import tool: a sample CSV (made-up test rows, clearly marked) → the expected JSON; wrong rows are reported with their row number.
- Website: an approximate place shows "আনুমানিক অবস্থান" in bn and "Approximate location" in en, the hollow pin, and a search link with no coordinates; width sweep 320–1024 px, light/dark.

### Order

A separate topic and PR (rule 1), after the OSM `data/places` PR is merged, because both touch the validator and the places loader.

## 7. Noakhali recheck (2026-11-15)

Two independent checks, because Noakhali certainly has petrol pumps:

1. **Every tagged object, every tag.** All 205,090 tagged nodes, ways and relations inside the Noakhali polygon were dumped from the extract, and every key and value (not only names; also brand, operator, building, shop…) was searched for: fuel, petrol, filling, pump, CNG, LPG, autogas, gas station, service station, oil, petroleum, diesel, octane, Padma, Meghna, Jamuna, ফিলিং, পেট্রো-, পেট্রল, পাম্প, সিএনজি, এলপিজি, তেল, অয়েল, জ্বালানি, ডিজেল, অকটেন, গ্যাস, সার্ভিস, পদ্মা, মেঘনা, যমুনা (Unicode-normalised). **16 hits, none a fuel station:**

   | OSM | Name | Matched | What it is |
   |---|---|---|---|
   | [n8435345442](https://www.openstreetmap.org/node/8435345442) | Khejur Tola CNG Bus Stop | name | `highway=bus_stop` (CNG = auto-rickshaw) |
   | [n9152869055](https://www.openstreetmap.org/node/9152869055) | Oil Store | name | `shop=general` (no fuel tag; may be an edible-oil shop: unclear) |
   | n9591222012–16, n9591245817–23 (12 nodes) | – | `generator:source=oil` | power generators |
   | [w976798095](https://www.openstreetmap.org/way/976798095) | Chowmuhani Power Plant | `plant:source=oil` | `landuse=industrial` |
   | [w908091551](https://www.openstreetmap.org/way/908091551) | মেঘনা নদী | name | `waterway=river` |

2. **Live OSM (Overpass), one small query, Noakhali area only**, data as of 2026-11-15 03:58 UTC: `amenity=fuel`, `shop=gas`, any `fuel:*`, lifecycle `…:amenity=fuel`, any `brand`, operator Padma/Meghna/Jamuna, and names with filling/petrol/fuel/cng/pump/station/oil/ফিলিং/পেট্রোল/পেট্রল/পাম্প/সিএনজি/তেল/অয়েল/স্টেশন → **0 objects**. The query area was tested with a count of `amenity=marketplace` → 80, the same as our extract count, so the area works.

**Result:** OSM has **no petrol pump or CNG station mapped in Noakhali**, neither in the 13 Nov extract nor live. This is a gap in OSM, not in our counting. Fuel for Noakhali has to come from the official dealer lists (§4) or the manual path (§6).

## 8. Jerin's decisions and the Padma / Jamuna column check (2026-11-15)

### Decisions

| # | Decision |
|---|---|
| 1 | Download Padma + Jamuna PDFs; read them outside the repo (`E:\Projects\SafeConnect-Files\official-lists\`); only generated JSON + `source_url` go in the repo. Meghna: not now. |
| 2 | BERC RTI request: not now. |
| 3 | `verified_by=visited`: no `source_url` needed; `checked_by` + `checked_on` required. |
| 4 | `owner_page`: the shop's own official Facebook page counts; groups or other people's posts do not. |
| 5 | §6 CSV columns are final. Blank template: `E:\Projects\SafeConnect-Files\manual\notun-jayga-template.csv` (UTF-8 with BOM, header only). |
| 6 | Centres for **all** upazilas from OSM `admin_level=6` polygons (ODbL, with credit), in PR 2. |
| 7 | Validator errors: `google.com` (+ subdomains), `google.com.bd`, `goo.gl`, `maps.app.goo.gl`, `g.page`, plus codes. |
| 8 | Certificate checks are never turned off, not even to read a certificate. Use the non-www host when its certificate verifies. |
| 9 | "Google Maps-এ আরও দেখুন" is Tasmin's (frontend). |

**PR order** (each after the previous is merged): PR 1 docs → PR 2 data (OSM places, upazila centres, manual-places import + validator) → PR 3 map → PR 4 Padma/Jamuna lists.

These change §6: `source_url` is optional only for `visited`; `owner_page` URLs may be `facebook.com/<page>` (a validator warning for `facebook.com/groups/…`, `/posts/`, `/permalink/`, `/share/`, `/story.php`, and data-checker confirms it is the shop's own page). Note for PR 2: OSM has no `admin_level=6` polygon for **Sonaimuri** and **Kabirhat** (Noakhali); 488 level-6 polygons exist nationally, against the 495 upazilas in `areas_bangladesh.json`. Missing ones are listed in the PR and keep the BBS/HDX centre where `data/locations.json` has one.

### Padma Oil: "ডিলার (ফিলিং স্টেশান)"

- File: `padma/padma_dealer_filling_station.pdf`, 98,405 bytes, SHA-256 `a5d5b759…0466`, from https://pocl.gov.bd/pages/static-pages/6922dece933eb65569e1d7db.
- **Made 2019-07-23** (Oracle Reports, PDF metadata). The list is over 7 years old, so every entry needs `source_older_than_2_years`.
- Text PDF (not scanned), 63 pages, English. **918 stations** in 63 district groups (district spelt the company's way: MYNENSINGH, SARIATPUR, HOBIGANJ, NAWABGONJ…; one group per district, as far as parsed).
- **Columns:** `A/C No` (customer account number; never kept, Jerin 2026-11-15), `A/C NAME` (station or dealer name), `Address`.
  - **District:** yes (group heading).
  - **Upazila:** **no column**; sometimes inside the address (e.g. "BEGUMGONJ").
  - **Address:** yes, free text, sometimes with the owner's name ("PROP.-MR. …"). An owner's name must not go into our data.
  - **Phone, location:** none.
- **Noakhali: 4 stations** (group NOAKHALI):

  | Name | Address (as printed) |
  |---|---|
  | HOSSAIN ENTERPRISE | NOATOLA BY PASS ROAD BEGUMGONJ |
  | SONAPUR F. STATION | VILL. SONAPUR PS. SONAPUR |
  | 1320159 | M/S.ABDUL HOQUE | MAIZDEE NOAKHALI |
  | 1320167 | FIDAAP FILLING STATION | EKHLASPUR BEGUMGONJ |

  (Two more addresses mention Noakhali places but are filed under other districts: IBRAHIM & BROTHERS, "CHOWMUHANI ROAD DAGONBHUIYAN" (Feni) and MOZAMMEL HOQUE, "LAKSMIPUR, NOAKHALI" (Lakshmipur).)

### Jamuna Oil

- **The filling station list (৭৫৯টি) is on Google Drive**, not on the government site: the page's "ফিলিং স্টেশনের তালিকা ডাউনলোড" goes to `https://drive.google.com/file/d/1ai7Odqy1FRHyniQkUfqPFvEozpcqT5ip/view`. It was **not downloaded**: under decision 7 a `drive.google.com` `source_url` is an error. NEEDS JERIN (see below).
  **Update 2026-11-15:** Jerin chose to use it with the jamunaoil.gov.bd page as `source_url`, but the Drive file now returns HTTP 404 ("পৃষ্ঠা পাওয়া গেল না"): it was removed. Not available.
- What was downloaded is the **LPG dealer list** (`jamuna/jamuna_filling_stations.pdf`, 942,926 bytes, SHA-256 `d599b588…d1`, Excel 2010 export, 2025-08-21, 38 pages, **740 rows**, which matches the page's "এলপিজি ডিলার ৭৪০টি").
  - Columns: ক্রমিক নং, জেলার নাম, উপজেলার নাম, জেলার ক্র:নং, এলপিজি ডিলারের নাম, ঠিকানা, মালিকের নাম, মোবাইল নম্বর. **District, upazila and address: yes. Location: no.**
  - It has the **owner's name and personal mobile number**, which must never go into our data (privacy rule).
  - Text is in mixed legacy encodings (SutonnyMJ/Bijoy on some pages, broken Unicode on others), and 190 rows have an empty district cell (merged cells). Noakhali appears garbled as "ফনায়াখারী" in **about 14 rows**.
  - LPG cylinder dealers are not petrol pumps; not used for now.
  - **Deleted 2026-11-15** on Jerin's instruction (it has private mobile numbers). It was only in `E:\Projects\SafeConnect-Files\official-lists\jamuna\`; no copy was kept.
