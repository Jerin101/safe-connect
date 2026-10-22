"""Second pass over every union portal in the pilot districts.

Collects what the first pass (collect_contacts.py) cannot see:
  * গ্রাম পুলিশ (village police, one per ward) and জরুরি যোগাযোগ (emergency contacts) pages
  * ইউপি সচিব (union secretary) from the officers page
  * village names per ward, taken from the representatives' address fields.
    Only the village name and ward are kept (to answer "which union/ward is my village in?");
    addresses themselves are not saved.
Static pages show their own "last updated" date, so those records keep it.
"""
import datetime, html, json, os, re, sys, unicodedata, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import get, get_json
from collect_contacts import API, DISTRICTS, UNION_PORTAL, BN, clean, phones, last_updated, officers, offices, paged

OUT = sys.argv[1] if len(sys.argv) > 1 else "union_pages_raw.json"
TODAY = datetime.date.today().isoformat()
LINK_KINDS = {"village_police": re.compile(r"^গ্রাম পুলিশ$"),
              "emergency_contacts": re.compile(r"^জরুর[িী] যোগাযোগ$")}
BN_MONTHS = {"জানুয়ারী": 1, "জানুয়ারি": 1, "ফেব্রুয়ারী": 2, "ফেব্রুয়ারি": 2, "মার্চ": 3, "এপ্রিল": 4, "মে": 5, "জুন": 6,
             "জুলাই": 7, "আগস্ট": 8, "সেপ্টেম্বর": 9, "অক্টোবর": 10, "নভেম্বর": 11, "ডিসেম্বর": 12}


def bn_date(text):
    """'বুধবার, ১৬ অক্টোবর, ২০১৯ এ ১১:০৩ AM' -> '2019-10-16' (None if it cannot be read)."""
    m = re.search(r"(\d{1,2})\s+(\S+?),?\s+(\d{4})", nfc(text).translate(BN))
    months = {nfc(k): v for k, v in BN_MONTHS.items()}
    if not m or m.group(2) not in months:
        return None
    return f"{m.group(3)}-{months[m.group(2)]:02d}-{int(m.group(1)):02d}"


def nfc(s):
    return unicodedata.normalize("NFC", s or "")


def content_updated(page):
    """The page's own 'last updated' date (not the site footer's)."""
    m = re.search(nfc(r"কনটেন্টটি শেষ হাল-নাগাদ করা হয়েছে:\s*([^|]{0,60})"), nfc(clean(re.sub(r"<", " | <", page))))
    return bn_date(m.group(1)) if m else None


def table_rows(page):
    """Rows of the main content table as lists of cell texts."""
    start = page.find("কন্টেন্ট:")
    body = page[start:] if start > 0 else page
    rows = []
    for tr in re.findall(r"(?s)<tr[^>]*>(.*?)</tr>", body):
        cells = [c for c in re.findall(r"(?s)<t[dh][^>]*>(.*?)</t[dh]>", tr)]
        if cells:
            rows.append(cells)
    return rows


def static_contacts(url, kind):
    status, page = get(url)
    if status != 200:
        return []
    updated = content_updated(page)
    out = []
    for cells in table_rows(page):
        nums = [p for c in cells for p in phones(c)]
        texts = [clean(c) for c in cells if clean(c) and not phones(c)]
        if not nums or not texts:
            continue
        ward = re.search(r"(\d+)\s*নং\s*" + nfc("ওয়ার্ড"), nfc(" ".join(texts)).translate(BN))
        out.append({"kind": kind, "name_bn": texts[0], "designation_bn": " ".join(texts[1:2]),
                    "ward_no": ward.group(1) if ward else None, "phones": list(dict.fromkeys(nums)),
                    "source_url": url, "source_last_updated": updated})
    return out


def villages_from_leaders(domain):
    found = []
    for url, page in paged(f"https://{domain}/pages/leaders"):
        for tr in re.findall(r'(?s)<tr class="table-tr">(.*?)</tr>', page):
            cell = dict(re.findall(r'(?s)data-column="([a-z_]+)">(.*?)</td>', tr))
            ward = clean(cell.get("ward_no")).translate(BN)
            for col in ("present_address", "permanent_address"):
                addr = clean(cell.get(col))
                m = re.search(r"গ্রাম\s*[ঃ:।-]?\s*([^,،;।\n]+)", addr)
                parts = [x.strip(" ।") for x in addr.split(",") if x.strip(" ।")]
                village = m.group(1).strip() if m else parts[0] if len(parts) >= 3 else None
                if village and ward and "," not in ward:
                    found.append({"village_bn": village, "ward_no": ward, "source_url": url})
                    break
    return found


def main():
    unions = []
    for dname, (did, _) in DISTRICTS.items():
        for uz in get_json(f"{API}/upazilla/{did}/list") or []:
            for o in offices("union", UNION_PORTAL, uz["_id"], "loc_upazila_id"):
                unions.append({"district": dname, "upazila_en": uz["title_en"].title().strip(), "upazila_bn": uz["title_bn"],
                               "union_bn": o["title_bn"], "union_en": (o.get("title_en") or "").replace(" Union", ""),
                               "domain": o["subdomain"]})
    print("unions", len(unions), flush=True)
    for u in unions:
        status, home = get(f"https://{u['domain']}")
        links = {}
        for href, txt in re.findall(r'(?s)<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', home or ""):
            for kind, rx in LINK_KINDS.items():
                if rx.match(clean(txt)) and href.startswith("/pages/"):
                    links.setdefault(kind, f"https://{u['domain']}{urllib.parse.quote(href)}")
        u["contacts"] = [c for kind, url in links.items() for c in static_contacts(url, kind)]
        u["secretary"] = [o for o in officers(u["domain"]) if "সচিব" in o["designation_bn"]]
        u["villages"] = villages_from_leaders(u["domain"])
        u["retrieved_on"] = TODAY
        print(f"{len(u['contacts']):3d} contacts {len(u['secretary'])} secretary {len(u['villages']):3d} villages  {u['domain']}", flush=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"retrieved_on": TODAY, "unions": unions}, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
