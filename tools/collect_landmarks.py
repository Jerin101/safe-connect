"""Collect landmarks (bazars, schools, madrasas, colleges, mosques, hospitals, ghats) from each union portal.

Many union portals (*.gov.bd) have pages such as "হাট-বাজার" or "শিক্ষা প্রতিষ্ঠান". This tool finds them from
the union's home page, keeps only names that say what they are (…বাজার, …হাট, …উচ্চ বিদ্যালয়, …মাদ্রাসা, …),
and writes data/landmarks/<district>.json with the union and the exact source_url of every name.
Used only by the area search (a landmark leads to its union); no phone numbers here.

Usage: python collect_landmarks.py <data folder> [pages_raw.json]
Official sites only, certificate checks on (fetch.py), 1 s between requests. pages_raw.json keeps every downloaded
page, so the reader can be improved and run again without asking the servers a second time (not committed).
"""
import datetime, json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import get
from collect_villages import N, content_of, last_updated, load_json, save_json, text_of

sys.stdout.reconfigure(encoding="utf-8")                        # Bangla names print on Windows too

LINK = re.compile(N(r"হাট[- ]?বাজার|হাটবাজার|বাজার সমূহ|বাজারের তালিকা|শিক্ষা ?প্রতিষ্ঠান|বিদ্যালয়|মাদ্রাসা|কলেজ|মসজিদ|খেয়াঘাট|ঘাট সমূহ"))
NOT_LINK = re.compile(N(r"পুলিশ|আদালত|উন্নয়ন|প্রকল্প|ফরম|নোটিশ|বিজ্ঞপ্তি|নীতিমালা|অফিস"))
# The type comes from the name itself; a name without one of these words is not kept (it may be prose).
TYPES = [("college", N(r"কলেজ")), ("madrasa", N(r"মাদ্রাসা|মাদরাসা|মাদ্‌রাসা")), ("school", N(r"বিদ্যালয়|বিদ্যালয়|স্কুল|বিদ্যানিকেতন|একাডেমী|একাডেমি")),
         ("mosque", N(r"মসজিদ")), ("hospital", N(r"হাসপাতাল|স্বাস্থ্য কমপ্লেক্স|ক্লিনিক|স্বাস্থ্য কেন্দ্র")),
         ("ghat", N(r"ঘাট$|খেয়াঘাট|ফেরিঘাট|লঞ্চঘাট")), ("bazar", N(r"বাজার$|হাট$|বাজার |হাট "))]
NOT_A_NAME = re.compile(N(r"মোট|সর্বমোট|ক্রমিক|নাম|তালিকা|সংখ্যা|ঠিকানা|মোবাইল|ফোন|প্রধান শিক্ষক|অধ্যক্ষ|সুপার|রয়েছে|আছে|হলো|এর |টি |[0-9০-৯]{3,}|@|http"))
MAX_PER_PAGE = 120
# A name must say WHERE it is, not only what it is: at least one word besides these (#157).
GENERIC_WORDS = set(N(w) for w in "সরকারি সরকারী বেসরকারি প্রাথমিক উচ্চ নিম্ন মাধ্যমিক বিদ্যালয় বিদ্যালয় স্কুল বালিকা বালক কেন্দ্রীয় জামে মসজিদ বাজার হাট "
                    "মাদ্রাসা মাদরাসা দাখিল আলিম ফাজিল কামিল এবতেদায়ী হাফেজিয়া নূরানী কওমী কলেজ ডিগ্রী ডিগ্রি মহাবিদ্যালয় ঘাট হাসপাতাল ক্লিনিক এন্ড অ্যান্ড ও".split())
NEGATIVE = re.compile(N(r"নেই|নাই|নয়|নাহি|ওয়ার্ড|ওয়ার্ড|[0-9০-৯]"))                    # also counts like "১১টি"


def fetch(url, cache):
    if url not in cache:
        status, body = get(url, delay=1.0)
        cache[url] = N(body) if status == 200 else None
    return cache[url]


def links(home, base):
    out = []
    for href, label in re.findall(r'href="([^"#]+)"[^>]*>(.*?)</a>', home, re.S):
        label = text_of(label)
        if LINK.search(label) and not NOT_LINK.search(label):
            url = urllib.parse.urljoin(base + "/", href)
            if url.startswith(base) and url not in out:
                out.append(url)
    return out[:4]


def type_of(name):
    name = re.sub(N(r"কক্সবাজার|কক্স বাজার"), " ", name)              # the district's name is not a bazar
    return next((t for t, rx in TYPES if re.search(rx, name)), None)


def names_on_page(page):
    """Table cells and list lines from the page's own content (never menus), cleaned to one name each."""
    content = content_of(page)
    pieces = [text_of(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", content, re.S)]
    if not pieces:
        pieces = [text_of(b) for b in re.split(r"</?(?:p|li|br|div|tr|h\d)[^>]*>", content)]
    found = []
    for p in pieces:
        for part in re.split(r"[,،;।\n]", p):
            n = N(re.sub(r"^\s*[০-৯0-9]+\s*[।.)\-]?\s*", "", part)).strip(" .:-–")
            n = re.sub(r"\s*\(.*?\)\s*", " ", n).strip()
            words = n.split()
            if not (2 <= len(words) <= 9) or not re.fullmatch(r"[ঀ-৿ .\-]{4,70}", n) or NOT_A_NAME.search(n):
                continue
            t = type_of(n)
            if t and not NEGATIVE.search(n) and any(w not in GENERIC_WORDS and len(w) > 1 for w in n.split()):
                found.append((n, t))
    return list(dict(found).items())[:MAX_PER_PAGE] if len(found) <= MAX_PER_PAGE else []


def main(data, cache_path=None):
    cache = load_json(cache_path, {})
    today = datetime.date.today().isoformat()
    os.makedirs(os.path.join(data, "landmarks"), exist_ok=True)
    for fname, key in (("contacts_noakhali.json", "noakhali"), ("contacts_coxsbazar.json", "coxsbazar")):
        doc = load_json(os.path.join(data, fname))
        out = {"note": "Landmarks named on the official union portals (হাট-বাজার and শিক্ষা প্রতিষ্ঠান pages), for the area search only: "
                       "a landmark leads to its union. Only names that say what they are were kept. No phone numbers. "
                       "Collected by tools/collect_landmarks.py; each entry keeps its source_url.",
               "fields": "name_bn, name_en, type, village_bn, union_bn, upazila_en, source_url, source_last_updated, added_by, added_on",
               "district": doc["district"], "retrieved_on": today, "landmarks": [], "unions_without_pages": 0}
        seen = set()
        for u in doc["unions"]:
            base = (u.get("website") or "").rstrip("/")
            if not base:
                continue
            home = fetch(base, cache)
            got = 0
            for url in links(home or "", base):
                page = fetch(url, cache)
                for name, t in names_on_page(page or ""):
                    if (name, u["union_bn"]) in seen:
                        continue
                    seen.add((name, u["union_bn"]))
                    out["landmarks"].append({"name_bn": name, "name_en": None, "type": t, "village_bn": None,
                                             "union_bn": u["union_bn"], "upazila_en": u["upazila_en"],
                                             "source_url": url.replace("http://", "https://", 1), "source_last_updated": last_updated(page or ""),
                                             "added_by": "collect_landmarks.py", "added_on": today})
                    got += 1
            if not got:
                out["unions_without_pages"] += 1
            print(f"{got:3d}  {u['union_bn']}", flush=True)
            if cache_path:
                save_json(cache_path, cache)
        path = os.path.join(data, "landmarks", f"{key}.json")
        with open(path, "w", encoding="utf-8") as f:            # one landmark per line: small, still readable in a diff
            f.write(json.dumps({k: v for k, v in out.items() if k != "landmarks"}, ensure_ascii=False)[:-1] + ',\n "landmarks": [\n')
            f.write(",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in out["landmarks"]))
            f.write("\n]}\n")
        print(key, "landmarks", len(out["landmarks"]), "| unions without pages", out["unions_without_pages"], flush=True)


if __name__ == "__main__":
    main(*sys.argv[1:3])
