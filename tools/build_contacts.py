"""Build the website's district data files from the two raw collections.

Usage: python build_contacts.py contacts_raw.json union_pages_raw.json <output folder> [municipalities_raw.json]

Output per district: contacts_<district>.json with
  records  – every contact shown on the site (see FIELD NOTES below)
  villages – village name → union + ward hints taken from representatives' addresses
FIELD NOTES
  status   collected_from_official_page until a person checks it, then verified
  flags    number_not_published, administrator_not_elected, number_shared_by_several_records,
           designation_missing, source_older_than_2_years, older_union_page
"""
import collections as C, datetime, hashlib, json, re, sys, unicodedata as U

def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

raw = load(sys.argv[1] if len(sys.argv) > 1 else "contacts_raw.json")
union_pages = load(sys.argv[2] if len(sys.argv) > 2 else "union_pages_raw.json")
OUT = sys.argv[3] if len(sys.argv) > 3 else "."
municipal = load(sys.argv[4])["records"] if len(sys.argv) > 4 else []

N = lambda s: U.normalize("NFC", s or "").strip()


def clean_name(s):
    """Old union pages mix emails, image labels and biodata into the name cell."""
    s = N(s)
    s = re.sub(r'^.*(View Image Details|\]">)\s*(\]">)?\s*', "", s)
    s = re.sub(r"\S+@\S+", "", s)
    s = re.sub(r"(ই-?মেই?ল|ইমেল)\s*[-:ঃ]?\s*$", "", s.strip())
    s = re.split(r"।\s*(পিত|পিতা|মাত|জন্ম)", s)[0]
    return " ".join(s.split()).strip(" ,।-:")
NURSE = re.compile(r"নার্স|nurse|এসএসএন|মিডওয়াইফ|midwife|ওয়ার্ড বয়|আয়া|ক্লিনার|পরিচ্ছন্ন|স্টোর|ক্যাশিয়ার|অফিস সহায়ক|ড্রাইভার|গাড়ি চালক|ঝাড়ুদার", re.I)
KEY = re.compile(N(r"ইনচার্জ|ডিউটি অফিসার|পুলিশ সুপার|নির্বাহী অফিসার|জেলা প্রশাসক|চেয়ারম্যান|প্রশাসক|তত্ত্বাবধায়ক|আবাসিক মেডিকেল|ইমার্জেন্সি|ইর্মাজেন্সী|জরুরি|স্বাস্থ্য ও পরিবার পরিকল্পনা কর্মকর্তা|সিভিল সার্জন|স্টেশন অফিসার|সিনিয়র স্টেশন|উপসহকারী পরিচালক|উপ-সহকারী পরিচালক|ত্রাণ ও পুনর্বাসন কর্মকর্তা|প্রকল্প বাস্তবায়ন কর্মকর্তা|মহিলা বিষয়ক কর্মকর্তা|সমাজসেবা কর্মকর্তা|অতিরিক্ত পুলিশ সুপার|অধিনায়ক|কমান্ডিং|পৌর নির্বাহী|প্রধান নির্বাহী"), re.I)
UPZ = {"Noakhali": "Noakhali Sadar", "Cox'S Bazar Sadar": "Cox's Bazar Sadar"}
upz = lambda s: UPZ.get((s or "").strip(), (s or "").strip()) or None
FILES = {"Noakhali": "contacts_noakhali.json", "Cox's Bazar": "contacts_coxsbazar.json"}
OLD = (datetime.date.today() - datetime.timedelta(days=730)).isoformat()

all_numbers = C.Counter(n for r in raw["records"] + municipal for n in r["mobile"] + r["office_phone"])
for u in union_pages["unions"]:
    for c in u["contacts"]:
        all_numbers.update(c["phones"])

out, villages, dropped = C.defaultdict(list), C.defaultdict(list), C.Counter()
seen_phones = C.defaultdict(set)
used_ids = C.Counter()


def add(dist, rec):
    rid = hashlib.sha1(f"{rec['office_domain']}|{rec['name_bn']}|{rec['designation_bn']}|{rec['phones'][:1]}".encode()).hexdigest()[:10]
    used_ids[rid] += 1
    rec["id"] = rid if used_ids[rid] == 1 else f"{rid}-{used_ids[rid]}"
    if rec["phones"] and any(all_numbers[p] > 2 for p in rec["phones"]):
        rec["flags"].append("number_shared_by_several_records")
    out[dist].append(rec)
    seen_phones[dist].update(rec["phones"])


def base(r, **kw):
    return {"id": None, "level": r["level"], "category": r["category"], "district": r["district"],
            "upazila_en": upz(r.get("upazila_en")), "upazila_bn": r.get("upazila_bn"),
            "union_en": (r.get("union_en") or "").replace(" Union", "") or None, "union_bn": r.get("union_bn"),
            "municipality_bn": r.get("municipality_bn"),
            "office_bn": N(r.get("office_bn")), "office_domain": r.get("office_domain") or r.get("domain"),
            "retrieved_on": r["retrieved_on"], "status": "collected_from_official_page", **kw}


# 1) officers and council members (first pass) + municipality officers
for r in raw["records"] + municipal:
    des, name = N(r["designation_bn"]), N(r["name_bn"])
    phones = list(dict.fromkeys(r["mobile"] + r["office_phone"]))
    if r["category"] == "health" and NURSE.search(des):
        dropped["hospital_staff_not_public_contact"] += 1; continue
    if not phones and r["level"] not in ("union", "municipality"):
        dropped["office_staff_without_phone"] += 1; continue
    flags = [f for f, cond in (("number_not_published", not phones), ("designation_missing", not des),
                                ("administrator_not_elected", des == "প্রশাসক")) if cond]
    category = "ansar_vdp" if r["office_domain"].startswith("ansarvdp.") else r["category"]
    add(r["district"], base(r, category=category, name_bn=name, designation_bn=des,
                            ward_no=r.get("ward_no") or None, phones=phones, email=r.get("email") or None,
                            key_contact=bool(KEY.search(des)), source_url=r["source_url"],
                            source_last_updated=None, flags=flags))

# 2) union pages (second pass): village police, secretaries, older emergency-contact pages, villages
for u in union_pages["unions"]:
    ctx = {"level": "union", "district": u["district"], "upazila_en": u["upazila_en"], "upazila_bn": u["upazila_bn"],
           "union_en": u["union_en"], "union_bn": u["union_bn"], "office_bn": u["union_bn"], "domain": u["domain"],
           "retrieved_on": u["retrieved_on"]}
    for s in u["secretary"]:
        phones = list(dict.fromkeys(s["mobile"] + s["office_phone"]))
        if phones:
            add(u["district"], base({**ctx, "category": "union_office"}, name_bn=clean_name(s["name_bn"]), designation_bn=N(s["designation_bn"]),
                                    ward_no=None, phones=phones, email=s.get("email") or None, key_contact=True,
                                    source_url=s["source_url"], source_last_updated=None, flags=[]))
    for c in u["contacts"]:
        if c["kind"] == "emergency_contacts" and set(c["phones"]) <= seen_phones[u["district"]]:
            dropped["duplicate_of_newer_record"] += 1; continue
        name, des = clean_name(c["name_bn"]), N(c["designation_bn"])
        if not name:                     # photo column came first: the name sits in the designation cell
            name, des = clean_name(des), ""
        cat = "village_police" if c["kind"] == "village_police" else "local_representative"
        flags = ["older_union_page"] if c["kind"] == "emergency_contacts" else []
        if not des: flags.append("designation_missing")
        if c["source_last_updated"] and c["source_last_updated"] < OLD:
            flags.append("source_older_than_2_years")
        add(u["district"], base({**ctx, "category": cat}, name_bn=name, designation_bn=des,
                                ward_no=c["ward_no"], phones=c["phones"], email=None, key_contact=cat == "village_police",
                                source_url=c["source_url"], source_last_updated=c["source_last_updated"], flags=flags))
    for v in u["villages"]:
        name = re.sub(r"^[\s\-–]+|\s*(পোঃ|ডাকঘর).*$", "", N(v["village_bn"])).strip()
        if 1 < len(name) <= 30:
            villages[u["district"]].append({"village_bn": name, "union_bn": u["union_bn"], "union_en": u["union_en"],
                                            "upazila_bn": u["upazila_bn"], "ward_no": v["ward_no"].lstrip("0") or v["ward_no"],
                                            "source_url": v["source_url"], "how": "village named in a ward representative's address"})

union_index = C.defaultdict(list)          # every union portal, even ones with no published contacts
for u in union_pages["unions"]:
    union_index[u["district"]].append({"union_bn": u["union_bn"], "union_en": u["union_en"], "upazila_en": upz(u["upazila_en"]),
                                       "upazila_bn": u["upazila_bn"], "website": "https://" + u["domain"]})
municipality_index = C.defaultdict(dict)
for r in municipal:
    municipality_index[r["district"]][r["office_domain"]] = {"municipality_bn": r["municipality_bn"], "upazila_en": upz(r["upazila_en"]),
                                                             "website": "https://" + r["office_domain"]}

for dist, recs in out.items():
    vs = list({(v["village_bn"], v["union_bn"], v["ward_no"]): v for v in villages[dist]}.values())
    with open(f"{OUT}/{FILES[dist]}", "w", encoding="utf-8") as f:
        json.dump({"district": dist, "retrieved_on": raw["retrieved_on"],
                   "status_meaning": "collected_from_official_page = copied by script from the official *.gov.bd page in source_url; a human spot-check changes it to verified.",
                   "unions": union_index[dist], "municipalities": list(municipality_index[dist].values()),
                   "records": recs, "villages": vs}, f, ensure_ascii=False, indent=1)
    print(dist, len(recs), "records,", len(vs), "villages,", C.Counter(r["category"] for r in recs).most_common())
print("dropped:", dict(dropped))
