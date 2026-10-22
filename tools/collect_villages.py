"""Collect the official village list of every union in the pilot districts.

Many union portals (*.gov.bd) have a page such as "গ্রাম ভিত্তিক লোক সংখ্যা" or "গ্রামের তালিকা".
This tool finds that page from the union's home page, reads the village names from its table and
writes data/villages.json with the union and the exact source_url of every village.

Usage: python collect_villages.py <data folder> <output villages.json> [pages_raw.json]
The optional pages_raw.json keeps every downloaded page, so the reader can be improved and run again
without asking the government servers a second time. *_raw.json files are not committed.
"""
import base64, datetime, html, json, os, re, sys, unicodedata, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import get

N = lambda s: " ".join(unicodedata.normalize("NFC", s or "").split())
BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
MONTHS = {N(m): i + 1 for i, m in enumerate("জানুয়ারি ফেব্রুয়ারি মার্চ এপ্রিল মে জুন জুলাই আগস্ট সেপ্টেম্বর অক্টোবর নভেম্বর ডিসেম্বর".split())}
VILLAGE_LINK = re.compile(N(r"গ্রাম ?ভিত্তি|গ্রামের|গ্রাম ?সমূহ|গ্রাম ?সমুহ|গ্রামের নাম|গ্রামের তালিকা"))
NOT_VILLAGE_LINK = re.compile(N(r"পুলিশ|আদালত|সরকার|উন্নয়ন|প্রকল্প|রাস্তা|অগ্নি"))
NOT_A_NAME = re.compile(N(r"জন|মোট|সর্বমোট|ওয়ার্ড|নং|ক্রমিক|গ্রামের নাম|জনসংখ্যা|লোকসংখ্যা|সংখ্যা|তথ্য|সূত্র|পুরুষ|মহিলা|ভোটার|খানা|[০-৯0-9]"))
# Words that only appear in sentences or headings, never in a village name.
SENTENCE = re.compile(N(r"ইউনিয়ন|পরিষদ|রয়েছে|তালিকা|নিচে|দেওয়া|হলো|অধীনে|বিভক্ত|পরিচালিত|হয়|গ্রামগুলো|গ্রামসমূহ|গ্রাম সমূহ|নাম|মৌজা|মহল্লা|"
                       r"আয়তন|সীমানা|উত্তরে|দক্ষিণে|পূর্বে|পশ্চিমে|বিষয়|ইত্যাদি|প্রায়|কিঃমিঃ|কিমি|গ্রামের|একটি|অফিস|"
                       r"^পুর$|^হাজীর$|^মাতবর$|^মোঃ$|শিঘ্রই|শীঘ্রই|আপডেট|সমূহের|প্রকাশিত|অনুযায়ী|স্কুল|ফরেস্ট|ভিত্তিক|বাড়ীর|বাড়ির|মাত্র"))
MAX_WARD = 12                                                     # unions have 9 wards; anything far bigger is a count
DIRECTION = re.compile(N(r"^(পূর্ব|পুর্ব|পশ্চিম|উত্তর|দক্ষিণ|দক্ষিন|মধ্য|চর|নতুন|বড়|ছোট|পুরাতন|নয়া)$"))
COLUMN_HEAD = re.compile(N(r"গ্রাম|মৌজা|মহল্লা"))


def load_json(path, default=None):
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, obj, **kw):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, **kw)


def fetch(url, cache):
    if url not in cache:
        status, body = get(url, delay=0.5)
        cache[url] = N(body) if status == 200 else None
    return cache[url]


def text_of(fragment):
    return N(html.unescape(re.sub(r"<[^>]+>", " ", fragment)))


def last_updated(page):
    """'সর্বশেষ হাল-নাগাদ করা হয়েছে: রবিবার, ১৯ জুলাই, ২০২০ ...' -> '2020-07-19'."""
    m = re.search(N(r"(?:সর্ব-?)?শেষ হাল-?নাগাদ[^:]*:\s*[^,]*,\s*([০-৯0-9]+)\s+(\S+),\s*([০-৯0-9]{4})"), text_of(page))
    if not m or N(m[2]) not in MONTHS:
        return None
    return f"{m[3].translate(BN_DIGITS)}-{MONTHS[N(m[2])]:02d}-{int(m[1].translate(BN_DIGITS)):02d}"


def village_links(home, base):
    links = []
    for href, label in re.findall(r'href="([^"#]+)"[^>]*>(.*?)</a>', home, re.S):
        label = text_of(label)
        if VILLAGE_LINK.search(label) and not NOT_VILLAGE_LINK.search(label):
            url = urllib.parse.urljoin(base + "/", href)
            if url not in links:
                links.append(url)
    return links[:2]


def content_of(page):
    """The page's own content: newer portals keep it base64-encoded in <rt-renderer encoded-content="...">;
    older ones show it between 'কন্টেন্ট:' and the share line. Menus and footers are left out."""
    encoded = re.findall(r'encoded-content="([^"]+)"', page)
    if encoded:
        return N(" ".join(base64.b64decode(e).decode("utf-8", "replace") for e in encoded))
    start, end = page.find(N("কন্টেন্ট:")), page.find(N("এই কনটেন্টটি শেয়ার"))
    return page[start:end] if 0 <= start < end else ""


def ward_of(digits):
    """'০৩' -> '3'; numbers that cannot be a ward (populations, '123') -> None."""
    digits = re.sub(r"\D", "", (digits or "").translate(BN_DIGITS))
    return str(int(digits)) if digits and 1 <= int(digits) <= MAX_WARD else None


WARD_MARK = re.compile(N(r"ওয়ার্ড\s*নং\s*[-–:]?\s*([০-৯0-9]+)|([০-৯0-9]+)\s*নং\s*ওয়ার্ড"))   # "ওয়ার্ড নং-০১" / "১নং ওয়ার্ড"


def split_names(text):
    """'১। ওয়ার্ড নং-০১ গোবিন্দপুর-৯৬০' -> [('গোবিন্দপুর', '1')]; 'রাজাপুর রামচন্দ্রপুর মনপুর' -> three names;
    'রুস্তম আলী চৌধুরী পাড়া' stays one name (words are joined until one ends like a village name).
    A line with several ward marks is cut at each mark, so every name gets its own ward."""
    if re.search(r"[:ঃ]", text):                                   # "গ্রাম সমূহের নাম: ..." -> part after the colon
        text = re.split(r"[:ঃ]", text, maxsplit=1)[1]
    pieces = WARD_MARK.split(text)                                 # [text, ward, ward, text, ward, ward, text, ...]
    out = names_in(pieces[0], None)
    for i in range(1, len(pieces) - 2, 3):
        out += names_in(pieces[i + 2], ward_of(pieces[i] or pieces[i + 1]))
    return out


def names_in(text, ward):
    text = re.sub(N(r"[০-৯0-9]*\s*নং\s*ওয়ার্ড|ওয়ার্ড\s*নং"), " ", text or "")
    text = re.sub(r"\(.*?\)|^\s*[০-৯0-9]+\s*[।.)]", " ", text)          # (mouza numbers), leading "১।"
    text = re.sub(r"[-–]?\s*[০-৯0-9][০-৯0-9,]*\s*(জন)?", " ", text)     # population numbers
    out = []
    for part in re.split(N(r"[,،;/\-–]| এবং "), text):
        words = N(part).strip(" .।:").split()
        endings = sum(bool(VILLAGE_ENDING.search(w)) for w in words)
        directions = sum(bool(DIRECTION.match(w)) for w in words[1:])
        if len(words) >= 2 and (endings >= 2 or (len(words) >= 3 and directions >= 1)):   # several names, spaces only
            group = []
            for w in words:
                if DIRECTION.match(w) and group:                  # "পূর্ব …" starts a new name
                    out.append(" ".join(group)); group = []
                group.append(w)
                if VILLAGE_ENDING.search(w) and not DIRECTION.match(w):   # "…পুর" / "…পাড়া" ends a name
                    out.append(" ".join(group)); group = []
            if group:
                out.append(" ".join(group))
        elif words:
            out.append(" ".join(words))
    return [(n, ward) for n in out]


def villages_on_page(page):
    """Village names from a union's village page: table columns headed গ্রাম/মৌজা/মহল্লা, or list lines."""
    content = content_of(page)                                    # never the whole page: menus are not villages
    found = []
    tables = re.findall(r"<table.*?</table>", content, re.S)
    for table in tables:
        rows = [[text_of(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.S)]
                for row in re.findall(r"<tr.*?</tr>", table, re.S)]
        head = next((i for i, r in enumerate(rows) if any(COLUMN_HEAD.search(c) for c in r)), None)
        if head is None:
            continue
        cols = [i for i, c in enumerate(rows[head]) if COLUMN_HEAD.search(c) and N("পুলিশ") not in c
                and N("নম্বর") not in c and N("ইউনিয়ন") not in c]
        ward_col = next((i for i, c in enumerate(rows[head]) if N("ওয়ার্ড") in c), None)
        for r in rows[head + 1:]:
            for i in cols:
                if i < len(r):
                    ward = ward_of(r[ward_col]) if ward_col is not None and ward_col < len(r) else None
                    for name in re.split(r"[,،;/]|\s{2,}", r[i]):
                        found.append((N(name).strip(" .।-:"), ward))
    if not found and content:                                     # no usable table: read list items and lines
        blocks = re.split(r"</?(?:p|li|br|div|tr|h\d)[^>]*>", content)
        for block in blocks:
            found.extend(split_names(text_of(block)))
    names = []
    for n, w in found:
        words = [x for x in n.split() if not re.search(r"[A-Za-z]", x)]       # "হরিয়ারছড়া Horiarchara" -> Bangla part
        if len(words) > 1 and words[-1] == N("গ্রাম"):                        # "কালা সিকদার পাড়া গ্রাম" -> without "গ্রাম"
            words = words[:-1]
        n = " ".join(words)
        if (re.fullmatch(r"[ঀ-৿ ]{3,35}", n) and len(words) <= 5
                and not NOT_A_NAME.search(n) and not SENTENCE.search(n) and n not in PLACE_NAMES
                and not (len(words) == 1 and VILLAGE_ENDING.fullmatch(n))          # a bare "পাড়া" / "গ্রাম"
                and (len(n) > 3 or VILLAGE_ENDING.search(n))):
            names.append((n, w))
    # A real village list: not too long, and most names end like village names (prose pages fail this).
    if not names or len(names) > MAX_VILLAGES:
        return []
    typical = sum(1 for n, _ in names if VILLAGE_ENDING.search(n) or VILLAGE_START.match(n)) / len(names)
    return names if typical >= MIN_TYPICAL else []


MAX_VILLAGES = 100                                                # the largest real list seen is about 60
PLACE_NAMES = set()                                               # district and upazila names: not villages (filled in main)
VILLAGE_START = re.compile(N(r"(চর|পূর্ব|পুর্ব|পশ্চিম|উত্তর|দক্ষিণ|দক্ষিন|মধ্য)"))   # চরবাটা, মধ্য চরবাটা
TEMPLATE_COPIES = 3                                               # the same list on this many unions = copied template text
MIN_TYPICAL = 0.35
VILLAGE_ENDING = re.compile(N(r"(পুর|পূর|পাড়া|পাড়া|পারা|নগর|গ্রাম|গাঁও|গাও|চর|খালী|খালি|ছড়া|ছড়ি|ছড়া|কুল|দিয়া|দীয়া|পালং|"
                               r"বাড়িয়া|বাড়ীয়া|তলী|তলা|ডেইল|ঘোনা|ঘাটা|কাটা|বাগ|বাদ|পুকুর|দিঘী|দীঘি|হাট|ভাঙ্গা|মুড়া|মোড়া|টিলা|"
                               r"ঝিরি|খোলা|জুম|বিল|ডাঙ্গা|গঞ্জ|নালা|পাতা|ঢালা|দ্বীপ|মারা|কান্দি|শরীফ|গাছা|পোতা|টোলা|ডাঙা)$"))


def main(data, out_path, cache_path=None):
    cache = load_json(cache_path, {})
    out = {"source": "Official village pages of each union portal (*.gov.bd); see source_url of each union",
           "retrieved_on": datetime.date.today().isoformat(),
           "format": "unions[].villages = [[village_bn, ward_no or null], ...]; one source page per union",
           "unions": [], "unions_without_village_page": []}
    docs = [load_json(os.path.join(data, f)) for f in ("contacts_noakhali.json", "contacts_coxsbazar.json")]
    for doc in docs:
        PLACE_NAMES.update(N(u["upazila_bn"]) for u in doc["unions"])
    PLACE_NAMES.update([N("নোয়াখালী"), N("কক্সবাজার")])
    for doc in docs:
        for u in doc["unions"]:
            base = u["website"].rstrip("/")
            home = fetch(base, cache)
            names, used = [], None
            for url in village_links(home or "", base):
                page = fetch(url, cache)
                names = villages_on_page(page or "")
                if names:
                    used = (url.replace("http://", "https://", 1), last_updated(page))   # same gov.bd page, secure link
                    break
            if not names:
                out["unions_without_village_page"].append({"district": doc["district"], "upazila_en": u["upazila_en"],
                                                           "union_bn": u["union_bn"], "website": u["website"]})
                print("NONE ", u["union_bn"], flush=True)
                if cache_path:
                    save_json(cache_path, cache)                 # keep downloaded pages even for unions without a list
                continue
            villages = list({name: [name, ward] for name, ward in reversed(names)}.values())[::-1]   # unique, in page order
            out["unions"].append({"district": doc["district"], "upazila_en": u["upazila_en"], "upazila_bn": u["upazila_bn"],
                                  "union_bn": u["union_bn"], "union_en": u["union_en"],
                                  "source_url": used[0], "source_last_updated": used[1], "villages": villages})
            print(f"{len(villages):3d}  {u['union_bn']}", flush=True)
            if cache_path:
                save_json(cache_path, cache)
    # The same list on several unions is template text copied between sites, not their own villages.
    lists = {}
    for x in out["unions"]:
        lists.setdefault(tuple(sorted(v[0] for v in x["villages"])), []).append(x)
    for copies in lists.values():
        if len(copies) >= TEMPLATE_COPIES:
            for x in copies:
                out["unions"].remove(x)
                out["unions_without_village_page"].append({"district": x["district"], "upazila_en": x["upazila_en"],
                                                           "union_bn": x["union_bn"], "website": x["source_url"].split("/pages")[0],
                                                           "note": f"same list as {len(copies) - 1} other unions (copied template text)"})
    with open(out_path, "w", encoding="utf-8") as f:            # one union per line: small, still readable in a diff
        f.write(json.dumps({k: v for k, v in out.items() if k != "unions"}, ensure_ascii=False)[:-1] + ',\n "unions": [\n')
        f.write(",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in out["unions"]))
        f.write("\n]}\n")
    print("villages", sum(len(x["villages"]) for x in out["unions"]), "| unions with a list", len(out["unions"]),
          "| without", len(out["unions_without_village_page"]))


if __name__ == "__main__":
    main(*sys.argv[1:4])
