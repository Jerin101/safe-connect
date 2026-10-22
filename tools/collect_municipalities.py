"""Collect officers of every municipality (পৌরসভা) portal in the pilot districts.

Towns are municipalities, not unions, so collect_contacts.py does not see them.
Output records use the same format as contacts_raw.json, with level = "municipality".
Usage: python collect_municipalities.py municipalities_raw.json
"""
import datetime, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import get_json
from collect_contacts import API, DISTRICTS, officers

OUT = sys.argv[1] if len(sys.argv) > 1 else "municipalities_raw.json"
PS_LEVEL, PS_TYPE = "626a41e552093d4768e64b34", "626a41e552093d4768e64b20"
TODAY = datetime.date.today().isoformat()


def portals(loc_id, loc_type):
    return get_json(f"{API}/office-level/{PS_LEVEL}/offices?office_type_id={PS_TYPE}&loc_id={loc_id}&loc_type={loc_type}") or []


records, log = [], []
for dname, (did, _) in DISTRICTS.items():
    upazilas = get_json(f"{API}/upazilla/{did}/list") or []
    owner = {}                                   # municipality domain -> upazila record
    for uz in upazilas:
        for o in portals(uz["_id"], "loc_upazila_id"):
            owner[o["subdomain"]] = uz
    for o in portals(did, "loc_district_id"):
        uz = owner.get(o["subdomain"])
        if uz is None:                           # not filed under an upazila: match the upazila name in the subdomain
            parts = o["subdomain"].split(".")[:-3]      # drop "<district>.gov.bd"
            uz = next((u for u in upazilas if u["title_en"].lower().replace("'", "").replace(" ", "") in parts), None)
        rows = officers(o["subdomain"])
        for r in rows:
            records.append({"division": "Chattogram", "district": dname, "level": "municipality", "category": "administration",
                            "upazila_en": uz["title_en"].title().strip() if uz else None, "upazila_bn": uz["title_bn"] if uz else None,
                            "municipality_bn": o["title_bn"], "office_bn": o["title_bn"], "office_domain": o["subdomain"],
                            **r, "retrieved_on": TODAY})
        log.append((o["subdomain"], len(rows)))
        print(f"{len(rows):3d}  {o['subdomain']}  ->  {uz['title_en'] if uz else 'UPAZILA NOT FOUND'}", flush=True)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"retrieved_on": TODAY, "records": records, "log": log}, f, ensure_ascii=False, indent=1)
