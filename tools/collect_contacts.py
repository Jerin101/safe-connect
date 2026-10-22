"""Collect public-service contacts for pilot districts from official *.gov.bd portals.

Every record keeps the exact source URL, the page's own "last updated" text and
the retrieval date. Nothing is guessed: a field the page does not show stays empty.
"""
import datetime, html, json, re, sys
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import get, get_json

OUT = sys.argv[1] if len(sys.argv) > 1 else "contacts_raw.json"
API = "https://bangladesh.gov.bd/ajax/get"
FIELD_TYPE = "687df048256c87dc78f1a068"
LEVEL = {"district": "626a41e552093d4768e64b13", "upazila": "626a41e552093d4768e64b14",
         "union": "626a41e552093d4768e64b15", "regional": "68ef33e2b74cbf429ba5968c"}
UNION_PORTAL, UPAZILA_PORTAL = "6915c8c02d68425160fc40ee", "626a41e552093d4768e64b16"
DISTRICTS = {"Noakhali": ("66648888fbd77af96fdf18ba", "noakhali.gov.bd"),
             "Cox's Bazar": ("66648888fbd77af96fdf18b6", "coxsbazar.gov.bd")}
# subdomain prefix -> SafeConnect category
DISTRICT_OFFICES = {"police": "police", "Rab": "police", "Bgb": "police", "fireservice": "fire",
                    "hospital": "health", "cs": "health", "dss": "social", "dss-ucdo": "social",
                    "css": "social", "dwa": "women_children", "jms": "women_children",
                    "drro": "disaster", "ansarvdp": "police", "acc": "anti_corruption",
                    "dnc": "police", "po": "women_children", "ssp": "women_children", "bmd": "disaster"}
UPAZILA_OFFICES = {"police": "police", "fireservice": "fire", "fscd": "fire", "health": "health",
                   "dss": "social", "ss": "social", "dwa": "women_children", "wa": "women_children",
                   "pio": "disaster", "cpp": "disaster", "ansarvdp": "police"}
REGIONAL_TOURIST = ("coxsreg", "coxsz", "inanizone", "smz", "teknafzone")

BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
TODAY = datetime.date.today().isoformat()


def clean(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s or "")).split())


def phones(raw):
    """Return BD phone numbers found in a cell, normalised to digits."""
    s = clean(raw).translate(BN)
    found = []
    for m in re.findall(r"(?:\+?88)?0[\d\s\-]{6,14}\d", s):
        d = re.sub(r"\D", "", m)
        d = d[2:] if d.startswith("880") else d
        if re.fullmatch(r"01[3-9]\d{8}", d) or re.fullmatch(r"0[2-9]\d{6,9}", d):
            found.append(d)
    return list(dict.fromkeys(found))


def last_updated(page):
    m = re.search(r"শেষ হাল-নাগাদ করা হয়েছে:\s*([^<]+)", page)
    return clean(m.group(1)) if m else ""


def paged(base):
    """Yield (url, html) for every page of a portal list (?page=N)."""
    seen = set()
    for n in range(1, 8):
        url = base if n == 1 else f"{base}?page={n}"
        st, body = get(url, delay=0.35)
        if st != 200 or not body:
            return
        sig = tuple(re.findall(r'href="(/pages/(?:leaders|officers)/[^"]+)"', body))
        if not sig or sig in seen:
            return
        seen.add(sig)
        yield url, body


def leaders(domain):
    rows = []
    for url, page in paged(f"https://{domain}/pages/leaders"):
        upd = last_updated(page)
        for tr in re.findall(r'(?s)<tr class="table-tr">(.*?)</tr>', page):
            cell = dict(re.findall(r'(?s)data-column="([a-z_]+)">(.*?)</td>', tr))
            if "title" not in cell:
                continue
            rows.append({"name_bn": clean(cell.get("title")), "designation_bn": clean(cell.get("designation")),
                         "ward_no": clean(cell.get("ward_no")).translate(BN),
                         "mobile": phones(cell.get("mobile_number")), "office_phone": phones(cell.get("office_phone")),
                         "email": clean(cell.get("email")), "source_url": url, "page_last_updated": upd})
    return rows


def officers(domain):
    rows = []
    for url, page in paged(f"https://{domain}/pages/officers"):
        upd = last_updated(page)
        for card in page.split('employee-content-widget')[1:]:
            f = {clean(k): v for k, v in re.findall(r"(?s)<tr>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*</tr>", card)}
            if not f.get("নাম"):
                continue
            rows.append({"name_bn": clean(f.get("নাম")), "designation_bn": clean(f.get("পদবি")),
                         "mobile": phones(f.get("মোবাইল")), "office_phone": phones(f.get("ফোন (অফিস)")),
                         "email": clean(f.get("ইমেইল")).replace(" ", ""), "source_url": url, "page_last_updated": upd})
    return rows


def offices(level, otype, loc_id, loc_type):
    return get_json(f"{API}/office-level/{LEVEL[level]}/offices?office_type_id={otype}&loc_id={loc_id}&loc_type={loc_type}") or []


def main():
    recs, log = [], []

    def add(rows, **ctx):
        for r in rows:
            recs.append({**ctx, **r, "retrieved_on": TODAY})
        log.append((ctx.get("office_domain"), len(rows)))
        print(f"{len(rows):3d}  {ctx.get('office_domain')}", flush=True)

    for dname, (did, ddomain) in DISTRICTS.items():
        base = {"division": "Chattogram", "district": dname}
        add(officers(ddomain), **base, level="district", category="administration",
            office_bn="জেলা প্রশাসকের কার্যালয়", office_domain=ddomain)
        for o in offices("district", FIELD_TYPE, did, "loc_district_id"):
            cat = DISTRICT_OFFICES.get(o["subdomain"].split(".")[0])
            if cat:
                add(officers(o["subdomain"]), **base, level="district", category=cat,
                    office_bn=o["title_bn"], office_en=o.get("title_en"), office_domain=o["subdomain"])
        for o in offices("regional", FIELD_TYPE, did, "loc_district_id"):
            if o["subdomain"].split(".")[0] in REGIONAL_TOURIST:
                add(officers(o["subdomain"]), **base, level="regional", category="tourist_police",
                    office_bn=o["title_bn"], office_en=o.get("title_en"), office_domain=o["subdomain"])
        for uz in get_json(f"{API}/upazilla/{did}/list") or []:
            ub = {**base, "upazila_en": uz["title_en"].title(), "upazila_bn": uz["title_bn"], "upazila_bbs": uz.get("bbs_code")}
            for o in offices("upazila", UPAZILA_PORTAL, uz["_id"], "loc_upazila_id"):
                add(officers(o["subdomain"]), **ub, level="upazila", category="administration",
                    office_bn=o["title_bn"], office_en=o.get("title_en"), office_domain=o["subdomain"])
            for o in offices("upazila", FIELD_TYPE, uz["_id"], "loc_upazila_id"):
                cat = UPAZILA_OFFICES.get(o["subdomain"].split(".")[0])
                if cat:
                    add(officers(o["subdomain"]), **ub, level="upazila", category=cat,
                        office_bn=o["title_bn"], office_en=o.get("title_en"), office_domain=o["subdomain"])
            for o in offices("union", UNION_PORTAL, uz["_id"], "loc_upazila_id"):
                add(leaders(o["subdomain"]), **ub, level="union", category="local_representative",
                    union_bn=o["title_bn"], union_en=o.get("title_en"), office_bn=o["title_bn"],
                    office_domain=o["subdomain"])
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"retrieved_on": TODAY, "records": recs, "log": log}, f, ensure_ascii=False, indent=1)
    print("TOTAL records", len(recs))


if __name__ == "__main__":
    main()
