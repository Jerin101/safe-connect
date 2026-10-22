"""Check SafeConnect data files before they are committed. Exit code 1 if any error is found.

Usage: python validate_data.py <data folder>
Errors stop a merge; warnings are printed for the team to review.
"""
import json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")                        # Bangla names print on Windows too
DATA = sys.argv[1] if len(sys.argv) > 1 else "."
# [0-9], not \d: in Python \d also matches Bangla digits, which would break tel: links
MOBILE = re.compile(r"^01[3-9][0-9]{8}$")
LANDLINE = re.compile(r"^0[2-9][0-9]{7,9}$")                   # 9 to 11 digits
DATE = re.compile(r"^(0[1-9]|[12][0-9]|3[01])(0[1-9]|1[0-2])(19|20)[0-9][0-9]$")   # DDMMYYYY: a date, not a phone
SHORT = re.compile(r"^[0-9]{3,5}$")
OFFICIAL = re.compile(r"^https://([a-z0-9-]+\.)*(gov\.bd|acc\.org\.bd)(/|$)")
CATEGORIES = {"emergency", "police", "fire", "health", "women_children", "legal", "information", "coast_river",
              "disaster", "anti_corruption", "tourist_police", "administration", "local_representative",
              "village_police", "union_office", "social", "ansar_vdp"}
STATUSES = {"collected_from_official_page", "verified"}
errors, warnings = [], []


def err(f, rid, msg):
    errors.append(f"{f} [{rid}] {msg}")


def load(f):
    with open(os.path.join(DATA, f), encoding="utf-8") as fh:
        return json.load(fh)


def check_phone(f, rid, p, allow_short):
    if DATE.match(p):
        err(f, rid, f"looks like a date, not a phone number: {p}")
    elif not (MOBILE.match(p) or LANDLINE.match(p) or (allow_short and SHORT.match(p))):
        err(f, rid, f"bad phone number format: {p}")


def check_national(f):
    seen = set()
    for r in load(f)["records"]:
        rid = r.get("id")
        if rid in seen: err(f, rid, "duplicate id")
        seen.add(rid)
        for key in ("numbers", "name_bn", "name_en", "category", "source_url"):
            if not r.get(key): err(f, rid, f"missing {key}")
        for p in r.get("numbers", []) + r.get("whatsapp", []): check_phone(f, rid, p, allow_short=True)
        if r.get("category") not in CATEGORIES: err(f, rid, f"unknown category {r.get('category')}")
        if not OFFICIAL.match(r.get("source_url", "")): err(f, rid, f"source is not an official site: {r.get('source_url')}")


def check_district(f):
    d = load(f)
    for pl in d.get("places", []):
        if not OFFICIAL.match(pl.get("source_url", "")): err(f, pl.get("id"), "place source is not an official site")
    seen = set()
    for r in d["records"]:
        rid = r.get("id")
        if rid in seen: err(f, rid, "duplicate id")
        seen.add(rid)
        for key in ("level", "category", "district", "source_url", "retrieved_on", "status"):
            if not r.get(key): err(f, rid, f"missing {key}")
        if not (r.get("name_bn") or r.get("designation_bn") or "needs_manual_check" in r.get("flags", [])):
            err(f, rid, "missing both name_bn and designation_bn")  # some pages give only the post, no name
        if r.get("category") not in CATEGORIES: err(f, rid, f"unknown category {r.get('category')}")
        if re.fullmatch(r"[\d০-৯\s.,()-]+", r.get("name_bn") or ""): err(f, rid, f"name is only a number: {r.get('name_bn')}")
        if r.get("status") not in STATUSES: err(f, rid, f"unknown status {r.get('status')}")
        if not OFFICIAL.match(r.get("source_url", "")): err(f, rid, f"source is not an official site: {r.get('source_url')}")
        if not r.get("phones") and not {"number_not_published", "needs_manual_check"} & set(r.get("flags", [])):
            err(f, rid, "no phone and not flagged number_not_published or needs_manual_check")
        for p in r.get("phones", []): check_phone(f, rid, p, allow_short=False)
        if r.get("level") == "union" and not r.get("union_bn"): err(f, rid, "union record without union_bn")
    stale = sum("source_older_than_2_years" in r.get("flags", []) for r in d["records"])
    if stale: warnings.append(f"{f}: {stale} records come from pages older than 2 years")


def check_areas(f):
    d = load(f)
    n = sum(len(u["unions"]) for dv in d["divisions"] for ds in dv["districts"] for u in ds["upazilas"])
    if len(d["divisions"]) != 8: err(f, "-", f"expected 8 divisions, found {len(d['divisions'])}")
    if sum(len(dv["districts"]) for dv in d["divisions"]) != 64: err(f, "-", "expected 64 districts")
    if n < 4000: err(f, "-", f"only {n} unions – download probably incomplete")


for name in sorted(os.listdir(DATA)):
    if name == "national_hotlines.json": check_national(name)
    elif (name.startswith("contacts_") or name == "manual_additions.json") and name.endswith(".json"): check_district(name)
    elif name == "areas_bangladesh.json": check_areas(name)

for w in warnings: print("WARNING", w)
for e in errors[:50]: print("ERROR  ", e)
print(f"{len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
