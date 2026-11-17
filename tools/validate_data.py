"""Check SafeConnect data files before they are committed. Exit code 1 if any error is found.

Usage: python validate_data.py <data folder>
Errors stop a merge; warnings are printed for the team to review.
"""
import collections, unicodedata, json, os, re, sys

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


def check_thanas(f):
    # Thana -> upazila for the search (#153): every row official, quoted, and pointing to an upazila we have.
    d = load(f)
    have = {}
    for c in os.listdir(DATA):
        if c.startswith("contacts_") and c.endswith(".json"):
            for r in load(c)["records"]:
                if r.get("upazila_en"): have.setdefault(r.get("district"), set()).add(r["upazila_en"])
    seen = set()
    for i, t in enumerate(d.get("thanas", [])):
        rid = t.get("name_bn") or f"row {i}"
        if not t.get("name_bn"): err(f, rid, "name_bn missing")
        if t.get("upazila_en") not in have.get(t.get("district"), set()): err(f, rid, f"upazila {t.get('upazila_en')!r} is not in the {t.get('district')} contact data")
        if not OFFICIAL.match(t.get("source_url") or ""): err(f, rid, "source_url must be an official https page")
        if not (t.get("source_quote_bn") or "").strip(): err(f, rid, "source_quote_bn missing")
        if t.get("proof") not in {"statement", "table", "portal"}: err(f, rid, "proof must be statement, table or portal")
        if not re.match(r"^20[0-9]{2}-[01][0-9]-[0-3][0-9]$", t.get("checked_on") or ""): err(f, rid, "checked_on must be YYYY-MM-DD")
        if any(re.search(r"01[3-9][0-9]{8}", str(v)) for v in t.values()): err(f, rid, "no phone numbers in this file")
        if (t.get("district"), t.get("name_bn")) in seen: err(f, rid, "duplicate")
        seen.add((t.get("district"), t.get("name_bn")))


LANDMARK_TYPES = {"bazar", "school", "madrasa", "college", "mosque", "hospital", "ghat"}


def check_landmarks(f):
    # Landmarks for the search (#157): official source, a known type, a union we have, no phone numbers.
    d = load(f)
    unions = set()
    for c in os.listdir(DATA):
        if c.startswith("contacts_") and c.endswith(".json"):
            for u in load(c).get("unions", []):
                unions.add((u.get("upazila_en"), u.get("union_bn")))
    seen = set()
    for i, x in enumerate(d.get("landmarks", [])):
        rid = x.get("name_bn") or f"row {i}"
        if not x.get("name_bn"): err(f, rid, "name_bn missing")
        if x.get("type") not in LANDMARK_TYPES: err(f, rid, f"unknown type {x.get('type')!r}")
        if (x.get("upazila_en"), x.get("union_bn")) not in unions: err(f, rid, f"union {x.get('union_bn')!r} in {x.get('upazila_en')!r} is not in the contact data")
        if not OFFICIAL.match(x.get("source_url") or ""): err(f, rid, "needs an official https source_url (local names go to aliases.json)")
        if (x.get("name_bn"), x.get("union_bn")) in seen: err(f, rid, "duplicate row")
        seen.add((x.get("name_bn"), x.get("union_bn")))
        if not x.get("added_by") or not x.get("added_on"): err(f, rid, "added_by and added_on are needed")
        if any(re.search(r"01[3-9][0-9]{8}", str(v)) for v in x.values()): err(f, rid, "no phone numbers in this file")


nfc = lambda s: " ".join(unicodedata.normalize("NFC", s or "").split())   # য়/ড় are stored in two ways
REFERENCE = re.compile(r"^https://bn\.banglapedia\.org/")   # secondary reference, place names only (final queue rule 6)


def check_aliases(f):
    # Local names and tourist spots for the search: each one has an official page (or Banglapedia, for a place name),
    # or says the team added it, with who and when. A union or town only if it is in our data. No phone numbers.
    d = load(f)
    areas = set()
    for c in os.listdir(DATA):
        if c.startswith("contacts_") and c.endswith(".json"):
            doc = load(c)
            areas |= {("union", u.get("upazila_en"), nfc(u.get("union_bn"))) for u in doc.get("unions", [])}
            areas |= {("municipality", m.get("upazila_en"), nfc(m.get("municipality_bn"))) for m in doc.get("municipalities", [])}
    seen = set()
    for i, a in enumerate(d.get("aliases", [])):
        rid = a.get("id") or f"row {i}"
        if not a.get("id") or not a.get("name_bn"): err(f, rid, "id and name_bn are needed")
        if a.get("id") in seen: err(f, rid, "duplicate id")
        seen.add(a.get("id"))
        if not a.get("upazila_en"): err(f, rid, "upazila_en is needed (the search shows the whole upazila when the union is not known)")
        url, src = a.get("source_url") or "", a.get("source") or ""
        if not (OFFICIAL.match(url) or REFERENCE.match(url) or src.startswith("local name")):
            err(f, rid, "needs an official source_url, a Banglapedia page, or source 'local name, added by the team'")
        if not a.get("added_by") or not a.get("added_on"): err(f, rid, "added_by and added_on are needed")
        if a.get("union_bn") and ("union", a.get("upazila_en"), nfc(a.get("union_bn"))) not in areas:
            err(f, rid, f"union {a.get('union_bn')!r} in {a.get('upazila_en')!r} is not in the contact data")
        if a.get("municipality_bn") and ("municipality", a.get("upazila_en"), nfc(a.get("municipality_bn"))) not in areas:
            err(f, rid, f"town {a.get('municipality_bn')!r} in {a.get('upazila_en')!r} is not in the contact data")
        if any(re.search(r"01[3-9][0-9]{8}", str(v)) for v in a.values()): err(f, rid, "no phone numbers in this file")


BBS_PAGE = re.compile(r"^https://bbs\.gov\.bd/")
BBS_PDF = re.compile(r"^https://objectstorage\.[a-z0-9-]+\.oraclecloud15\.com/n/[a-z0-9]+/b/V2Ministry/o/office-bbs/[0-9a-z/]+\.pdf$")   # the portal's file store


def check_bbs_villages(f):
    # Villages from BBS's geo-code lists: only for unions in our data that have no village page, each union once,
    # its own district's PDF, each village once, an English name always, a Bangla name only in Bangla letters and with
    # the same sound as the English one (the collector's own check), no phone numbers.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from collect_bbs_villages import sound
    d = load(f)
    if not BBS_PAGE.match(d.get("source_page") or ""): err(f, "file", "source_page must be the bbs.gov.bd geo-code page")
    pdfs = d.get("source_pdfs") or {}
    if not pdfs or not all(BBS_PDF.match(p or "") for p in pdfs.values()) or len(set(pdfs.values())) != len(pdfs):
        err(f, "file", "source_pdfs must give each district its own BBS PDF")
    unions = set()
    for c in os.listdir(DATA):
        if c.startswith("contacts_") and c.endswith(".json"):
            doc = load(c)
            unions |= {(doc.get("district"), u.get("upazila_en"), nfc(u.get("union_bn"))) for u in doc.get("unions", [])}
    without = {(w["district"], w["upazila_en"], nfc(w["union_bn"])) for w in load("villages.json").get("unions_without_village_page", [])}
    seen = set()
    for u in d.get("unions", []):
        key = (u.get("district"), u.get("upazila_en"), nfc(u.get("union_bn")))
        rid = " ".join(map(str, key))
        if key not in unions: err(f, rid, "union is not in the contact data")
        if key not in without: err(f, rid, "union has an official village page: BBS is only for the others")
        if key in seen: err(f, rid, "union listed twice")
        seen.add(key)
        if not BBS_PDF.match(u.get("source_url") or "") or u.get("source_url") != pdfs.get(u.get("district")):
            err(f, rid, "source_url must be the district's BBS PDF")
        if u.get("level") not in ("village", "mauza"): err(f, rid, f"unknown level {u.get('level')!r}")
        if not u.get("villages"): err(f, rid, "no villages")
        names = set()
        for v in u.get("villages", []):
            if not (isinstance(v, list) and len(v) == 2):
                err(f, rid, f"a village must be [English, Bangla or null], not {v!r}")
                continue
            en, bn = v
            if not isinstance(en, str) or not re.fullmatch(r"[A-Za-z0-9 .()'-]+", en): err(f, rid, f"bad English name {en!r}")
            elif en in names: err(f, rid, f"village {en!r} listed twice")
            else: names.add(en)
            if bn is not None and not (isinstance(bn, str) and re.fullmatch(r"[ঀ-৿ .()-]+", bn)): err(f, rid, f"bad Bangla name {bn!r}")
            elif bn is not None and isinstance(en, str) and sound(bn) != sound(en): err(f, rid, f"Bangla {bn!r} is not the village {en!r}")
        if re.search(r"01[3-9][0-9]{8}", json.dumps(u)): err(f, rid, "no phone numbers in this file")


def area_upazilas():
    """district_en -> set of upazila_en, from the official list (areas_bangladesh.json)."""
    d = load("areas_bangladesh.json")
    return {ds["en"]: {u["en"] for u in ds["upazilas"]} for dv in d["divisions"] for ds in dv["districts"]}


BOM = "﻿".encode("utf-8")
FAR_FROM_DISTRICT_KM = 60    # an OSM place this far from every upazila centre of its district is suspicious
CENTRE_FAR_KM = 100           # an upazila centre this far from its district's other centres is wrong


def check_places():
    # Places (MASTER_PLAN place shape): OSM files listed in places/index.json, the team's manual files,
    # and data/upazila_centres.json. Shared rules live in places_rules.py (also used by the import tool).
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import gzip
    import places_rules as R
    ups = area_upazilas()
    polys = R.upazila_polygons(load("locations.json")) if os.path.exists(os.path.join(DATA, "locations.json")) else {}
    centres = R.upazila_centre_points(load("upazila_centres.json")) if os.path.exists(os.path.join(DATA, "upazila_centres.json")) else {}
    by_slug = {R.slug(k): k for k in ups}
    pdir = os.path.join(DATA, "places")
    index = load(os.path.join("places", "index.json"))
    f = os.path.join("places", "index.json")
    for key in ("license", "attribution", "attribution_url", "extract_date"):
        if not index.get(key): err(f, "file", f"missing {key} (OSM credit)")
    if index.get("license") != "ODbL-1.0" or "OpenStreetMap" not in (index.get("attribution") or ""):
        err(f, "file", "OSM data needs license ODbL-1.0 and the attribution '© OpenStreetMap contributors'")
    listed = set()
    if {x.get("district_en") for x in index.get("districts", [])} != set(ups): err(f, "file", "index must list all 64 districts")
    seen = set()
    for x in index.get("districts", []):
        den = x.get("district_en")
        for fi in x.get("files", []):
            name = fi.get("file")
            listed.add(name)
            fp = os.path.join("places", name)
            if not os.path.exists(os.path.join(DATA, fp)):
                err(f, den, f"listed file {name} is missing")
                continue
            raw = open(os.path.join(DATA, fp), "rb").read()
            if len(gzip.compress(raw, 9)) > R.MAX_GZIP: err(fp, "file", f"over {R.MAX_GZIP // 1024} KB gzip")
            doc = json.loads(raw)
            if doc.get("district_en") != den or doc.get("source") != "osm": err(fp, "file", "district_en/source do not match the index")
            if doc.get("license") != "ODbL-1.0" or not doc.get("attribution"): err(fp, "file", "missing ODbL credit")
            if len(doc.get("places", [])) != fi.get("places"): err(fp, "file", "place count differs from the index")
            for i, p in enumerate(doc.get("places", [])):
                if not isinstance(p, dict):
                    err(fp, f"entry {i}", "each place must be an object")
                    continue
                full = {k: p.get(k) for k in ("id", "name_bn", "name_en", "category", "subcategory", "lat", "lon",
                                              "district", "upazila", "union", "phone", "hours", "source",
                                              "source_url", "checked_on")}
                full.update(p)
                for lvl, msg in R.check_osm_place(full, den, ups.get(den, set()), index.get("extract_date")):
                    (err(fp, p.get("id"), msg) if lvl == "error" else warnings.append(f"{fp} [{p.get('id')}] {msg}"))
                if p.get("id") in seen: err(fp, p.get("id"), "duplicate id (in another places file too)")
                near = [R.km(p["lat"], p["lon"], c[0], c[1]) for (cd, _), c in centres.items() if cd == den] if R.in_bd(p.get("lat"), p.get("lon")) else []
                if near and min(near) > FAR_FROM_DISTRICT_KM:
                    warnings.append(f"{fp} [{p.get('id')}] {min(near):.0f} km from every upazila centre of {den}: wrong district?")
                seen.add(p.get("id"))
    osm_names = {}
    for name in sorted(os.listdir(pdir)):
        fp = os.path.join("places", name)
        if name == "index.json" or name == "README.md":
            continue
        if not name.endswith(".json"):
            err(fp, "file", "only .json files (lower-case extension) and README.md belong in data/places/")
            continue
        if name.startswith("official_"):
            den = by_slug.get(name[len("official_"):-len(".json")])
            if not den:
                err(fp, "file", "official_<district>.json must use the district's slug")
                continue
            doc = load(fp)
            lists = doc.get("lists") or {}
            if doc.get("district_en") != den: err(fp, "file", "district_en does not match the file name")
            for lid, meta in lists.items():
                for lvl, msg in R.check_official_list(lid, meta):
                    (err(fp, "file", msg) if lvl == "error" else warnings.append(f"{fp} {msg}"))
            ids = set()
            for i, p in enumerate(doc.get("places", [])):
                if not isinstance(p, dict):
                    err(fp, f"entry {i}", "each place must be an object")
                    continue
                for lvl, msg in R.check_official_place(p, den, ups.get(den, set()), lists):
                    (err(fp, p.get("id"), msg) if lvl == "error" else warnings.append(f"{fp} [{p.get('id')}] {msg}"))
                if p.get("id") in ids: err(fp, p.get("id"), "duplicate id")
                ids.add(p.get("id"))
            continue
        if name.startswith("manual_"):
            den = by_slug.get(name[len("manual_"):-len(".json")])
            if not den:
                err(fp, "file", "manual_<district>.json must use the district's slug (like data/landmarks/)")
                continue
            raw = open(os.path.join(DATA, fp), "rb").read()
            if raw.startswith(BOM):
                err(fp, "file", "saved with a BOM: save as UTF-8 without BOM")
                raw = raw[3:]
            try:
                doc = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as e:
                err(fp, "file", f"not valid UTF-8 JSON: {e}")
                continue
            if not isinstance(doc, dict) or not isinstance(doc.get("places"), list):
                err(fp, "file", "must be an object with a \"places\" list")
                continue
            if doc.get("district_en") != den: err(fp, "file", "district_en does not match the file name")
            if not osm_names:
                for x in index.get("districts", []):
                    for fi in x.get("files", []):
                        for p in load(os.path.join("places", fi["file"])).get("places", []):
                            if not isinstance(p, dict) or not p.get("category"):
                                continue
                            osm_names.setdefault((x["district_en"], p.get("upazila"), p["category"]), set()).update(
                                {R.name_key(p.get("name_bn")), R.name_key(p.get("name_en"))} - {""})
            ids = set()
            for i, p in enumerate(doc.get("places", [])):
                if not isinstance(p, dict):
                    err(fp, f"entry {i}", "each place must be an object")
                    continue
                pid = p.get("id")
                for lvl, msg in R.check_manual_place(p, den, ups.get(den, set())) + R.check_in_upazila(p, polys, centres):
                    (err(fp, pid, msg) if lvl == "error" else warnings.append(f"{fp} [{pid}] {msg}"))
                if pid in ids: err(fp, pid, "duplicate id")
                ids.add(pid)
                if {R.name_key(p.get("name_bn")), R.name_key(p.get("name_en"))} - {""} & osm_names.get((den, p.get("upazila"), p.get("category")), set()):
                    warnings.append(f"{fp} [{pid}] same name as an OSM place in this upazila: data-checker decides if it is one place")
        elif name not in listed:
            err(fp, "file", "places file not listed in places/index.json")
    # upazila centres: every official upazila has a centre or is listed as missing (never guessed)
    fc = "upazila_centres.json"
    if os.path.exists(os.path.join(DATA, fc)):
        c = load(fc)
        if c.get("license") != "ODbL-1.0" or "OpenStreetMap" not in (c.get("attribution") or ""): err(fc, "file", "missing ODbL credit")
        have = collections.Counter((x.get("district"), x.get("upazila_en")) for x in c.get("centres", []) + c.get("missing", []))
        want = {(d, u) for d, us in ups.items() for u in us}
        for k in want - set(have): err(fc, " ".join(k), "upazila has no centre and is not listed as missing")
        for k in set(have) - want: err(fc, " ".join(map(str, k)), "not an upazila in areas_bangladesh.json")
        for k, n in have.items():
            if n > 1: err(fc, " ".join(map(str, k)), "listed twice")
        for x in c.get("centres", []):
            rid = f"{x.get('district')} {x.get('upazila_en')}"
            if not R.in_bd(x.get("lat"), x.get("lon")): err(fc, rid, "lat/lon missing or outside Bangladesh")
            if x.get("source") == "osm":
                if x.get("method") not in ("osm_admin_centre", "osm_place_node", "osm_upazila_office",
                                           "osm_polygon_centroid", "osm_point_inside_polygon"): err(fc, rid, "unknown method")
                if x.get("method") in ("osm_place_node", "osm_upazila_office") and not re.match(
                        r"^https://www\.openstreetmap\.org/(node|way|relation)/[0-9]+$", x.get("place_node") or ""):
                    err(fc, rid, "place_node must be the OSM link of the town or office used")
                if not re.match(r"^https://www\.openstreetmap\.org/(relation|way)/[0-9]+$", x.get("source_url") or ""): err(fc, rid, "OSM centre needs its boundary's OSM link")
            elif x.get("source") == "locations.json":
                if x.get("method") != "locations_json_center": err(fc, rid, "unknown method")
            else:
                err(fc, rid, "source must be osm or locations.json")
        for x in c.get("centres", []):
            others = [(y["lat"], y["lon"]) for y in c.get("centres", []) if y.get("district") == x.get("district") and y is not x and R.in_bd(y.get("lat"), y.get("lon"))]
            if others and R.in_bd(x.get("lat"), x.get("lon")):
                mlat = sorted(o[0] for o in others)[len(others) // 2]
                mlon = sorted(o[1] for o in others)[len(others) // 2]
                if R.km(x["lat"], x["lon"], mlat, mlon) > CENTRE_FAR_KM:
                    err(fc, f"{x.get('district')} {x.get('upazila_en')}", f"centre is {R.km(x['lat'], x['lon'], mlat, mlon):.0f} km from the district's other centres")
        for x in c.get("missing", []):
            if "lat" in x or "lon" in x: err(fc, f"{x.get('district')} {x.get('upazila_en')}", "a missing centre must not have lat/lon")


if os.path.exists(os.path.join(DATA, "places", "index.json")):
    check_places()

if os.path.exists(os.path.join(DATA, "aliases.json")):
    check_aliases("aliases.json")

if os.path.exists(os.path.join(DATA, "villages_bbs.json")):
    check_bbs_villages("villages_bbs.json")

for name in sorted(os.listdir(os.path.join(DATA, "landmarks")) if os.path.isdir(os.path.join(DATA, "landmarks")) else []):
    if name.endswith(".json"): check_landmarks(os.path.join("landmarks", name))

for name in sorted(os.listdir(DATA)):
    if name == "national_hotlines.json": check_national(name)
    elif (name.startswith("contacts_") or name == "manual_additions.json") and name.endswith(".json"): check_district(name)
    elif name == "areas_bangladesh.json": check_areas(name)
    elif name == "thanas.json": check_thanas(name)

for w in warnings: print("WARNING", w)
for e in errors[:50]: print("ERROR  ", e)
print(f"{len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
