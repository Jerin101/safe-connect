"""Collect the tourist spots (দর্শনীয় স্থান) of the district portal and every upazila portal of the pilot districts.

The portals publish them in two ways: a "tourist-spot" list with one page per spot (/pages/tourist-spot/<name>-<id>),
or a static page with a table (ক্রমিক | নাম | কিভাবে যাওয়া যায় | অবস্থান). Both are read; every spot keeps the
exact page it came from and the text of its "অবস্থান" (location) part, so its upazila and union can be checked.
The upazila comes from the portal the spot is on (an upazila portal), or from that location text; a union only
when the page names it. Nothing is guessed: a spot whose upazila cannot be read is kept with upazila_en = null.

Usage: python collect_tourist_spots.py <data folder> <out.json> [pages_raw.json]
Official sites only, certificate checks on (fetch.py), 1 s between requests.
"""
import datetime, hashlib, json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import get
from collect_villages import N, content_of, last_updated, load_json, save_json, text_of

sys.stdout.reconfigure(encoding="utf-8")
TODAY = datetime.date.today().isoformat()
LINK = re.compile(N(r"দর্শনীয়|দর্শনীয় স্থান|পর্যটন স্থান|tourist"), re.I)
DETAIL = re.compile(r'href="([^"#]*/pages/tourist-spot/[^"#?]+)"')
NOT_A_SPOT = {N("অন্যান্য")}


def fetch(url, cache):
    if cache.get(url) is None:                                    # not yet, or failed before: (re)try once
        status, body = get(urllib.parse.quote(url, safe=":/?=&%#"), delay=1.0)   # Bangla page names, percent-encoded
        cache[url] = N(body) if status == 200 else None
    return cache[url]


def tourist_pages(base, cache):
    """The portal's tourist list page(s): /pages/tourist-spot (and its next pages) plus any "দর্শনীয় স্থান" link."""
    out = [f"{base}/pages/tourist-spot", f"{base}/pages/tourist-spot?page=2", f"{base}/pages/tourist-spot?page=3"]
    for href, label in re.findall(r'href="([^"#]+)"[^>]*>(.*?)</a>', fetch(base, cache) or "", re.S):
        url = urllib.parse.urljoin(base + "/", href)
        if LINK.search(text_of(label)) and url.startswith(base) and url not in out:
            out.append(url)
    return out


def from_list(page, base, cache):
    """A tourist-spot list: one entry per detail page; the name is the page's title (or its address)."""
    spots = []
    for href in dict.fromkeys(DETAIL.findall(page or "")):
        url = urllib.parse.urljoin(base + "/", href)
        body = fetch(url, cache) or ""
        slug = urllib.parse.unquote(url.rsplit("/", 1)[-1])
        name = N(re.sub(r"-[0-9a-f]{6}-[0-9a-f]{20,}$", "", slug).replace("-", " ")).strip()
        text = clean_text(content_of(body))
        loc = re.search(N(r"অবস্থান\s*[:ঃ]?\s*(.{0,200})"), text)
        spots.append({"name_bn": name, "source_url": url, "source_last_updated": last_updated(body),
                      "location_text": N(loc.group(1)).strip() if loc else where(text)})
    return spots


def clean_text(fragment):
    """Text of a page part without Word's leftovers (<!--[if gte mso 9]>…, <style>…)."""
    fragment = re.sub(r"<!--.*?-->|<style.*?</style>|<xml>.*?</xml>", " ", fragment or "", flags=re.S)
    return N(re.sub(r"<[^>]+>", " ", text_of(fragment)))


def where(text):
    """The sentences that say where the spot is ("… উপজেলার … ইউনিয়নে অবস্থিত"), else the start of the text."""
    said = [x for x in re.split(r"[।|]", text) if re.search(N(r"অবস্থিত|উপজেলা|ইউনিয়ন|পৌরসভা"), x)]
    return N(" । ".join(said))[:800] if said else text[:600]


def from_table(page, url):
    """A static page with a table: the "নাম" column, and the "অবস্থান" column when there is one."""
    spots = []
    for table in re.findall(r"<table.*?(?:</table>|$)", content_of(page or ""), re.S):   # some portals never close it
        rows = [[text_of(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)] for r in re.findall(r"<tr.*?</tr>", table, re.S)]
        rows = [r for r in rows if any(r)]
        if not rows:
            continue
        head = rows[0]
        name_col = next((i for i, h in enumerate(head) if re.search(N(r"নাম|স্থান"), h)), None)
        loc_col = next((i for i, h in enumerate(head) if re.search(N(r"অবস্থান|ঠিকানা"), h)), None)
        if name_col is None:
            continue
        for r in rows[1:]:
            if len(r) <= name_col or not r[name_col].strip():
                continue
            spots.append({"name_bn": N(r[name_col]).strip(), "source_url": url, "source_last_updated": last_updated(page),
                          # every other cell: the "অবস্থান" column, or a description that says where it is
                          "location_text": N(" ".join(c for i, c in enumerate(r) if i != name_col))[:600]})
    return spots


def main(data, out_path, cache_path=None):
    cache = load_json(cache_path, {}) if cache_path else {}
    out = []
    for fname, district, home in (("contacts_noakhali.json", "Noakhali", "https://noakhali.gov.bd"),
                                  ("contacts_coxsbazar.json", "Cox's Bazar", "https://coxsbazar.gov.bd")):
        doc = load_json(os.path.join(data, fname))
        portals = [(None, home)] + sorted({(r["upazila_en"], "https://" + r["office_domain"]) for r in doc["records"]
                                          if r.get("level") == "upazila" and r.get("category") == "administration" and r.get("office_domain")})
        for upazila, base in portals:
            got = []
            for url in tourist_pages(base, cache):
                page = fetch(url, cache)
                # a page with a table in its own content is a table (its sidebar may still link spot pages)
                got += from_table(page, url) if "<table" in content_of(page or "") else from_list(page, base, cache)
            seen = set()
            for s in got:
                s["name_bn"] = re.sub(r"^[০-৯0-9]+[.)।]?\s*", "", s["name_bn"]).strip()     # "৪ কমলার দিঘি"
                if not re.search(r"[ঀ-৿]{2}", s["name_bn"]) or s["name_bn"] in NOT_A_SPOT or s["name_bn"] in seen:
                    continue
                seen.add(s["name_bn"])
                out.append({"district": district, "portal_upazila_en": upazila, **s})
            print(f"{len(seen):3d}  {district} / {upazila or 'district portal'}", flush=True)
            if cache_path:
                save_json(cache_path, cache)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("spots", len(out))
    write_aliases(data, out, cache)


# Rows on the pages that are not places one can be at ("মহিষের দধি" is a food; an office; a page heading).
NOT_A_PLACE = {N(x) for x in ["মহিষের দধি", "লিডারশীপ ইউনিভার্সিটি কলেজ", "বারবাকিয়া রেন্জ অফিস", "উপজেলা শহীদ মিনার",
                               "মাহাসিংদোগ্রী বৌদ্ধ মন্দিরের ঐতিহাসিক পটভূমি", "জেলা জামে মসজিদ", "আইসোলেটেড নারিকেল বীজ বাগান"]}
TYPES = [("beach", N(r"সৈকত|বীচ|বিচ")), ("island", N(r"দ্বীপ")), ("temple", N(r"মন্দির|বিহার|ক্যাং|কেয়াং|তীর্থ|প্যাগোডা")),
         ("park", N(r"পার্ক|উদ্যান|বাগান|ইকোপার্ক|ফরেষ্ট|ফরেস্ট"))]
# English names and other spellings people type, given by the team (final queue, 9 Nov): only for spots that an official
# page already places. Each one keeps who gave it.
TEAM_SPELLINGS = {
    N("হিমছড়ি"): ["Himchari", "Himchori"], N("ইনানী সি বীচ"): ["Inani", "Inani beach", "Inani sea beach"],
    N("টেকনাফ সমুদ্র সৈকত"): ["Teknaf beach"], N("সেন্টমার্টিন দ্বীপ"): ["Saint Martin", "St Martin", "Saint Martin island", "নারিকেল জিঞ্জিরা", "Narikel Jinjira"],
    N("ছেঁড়া দ্বীপ"): ["Chhera Dwip", "Chera dwip"], N("শাহপরীর দ্বীপ"): ["Shah Porir Dwip", "Shahporir dwip"],
    N("সোনাদিয়া সমুদ্র সৈকত"): ["Sonadia", "Sonadia beach", "Sonadia island"], N("আদিনাথ মন্দির"): ["Adinath temple", "Adinath mandir"],
    N("কুতুবদিয়া বাতিঘর"): ["Kutubdia lighthouse"], N("ডুলাহাজারা সাফারি পার্ক"): ["Dulahazra Safari Park", "Safari Park"],
    N("কানা রাজার সুড়ঙ্গ"): ["Kana Rajar Surongo"], N("রামু সীমা বিহার"): ["Ramu Buddhist temple", "Ramu Sima Bihar"],
    N("রাংকূট বৌদ্ধ বিহার"): ["Ramkot Buddhist temple"], N("লামার পাড়া বৌদ্ধ বিহার"): ["Lamar Para Buddhist temple"],
    N("নিঝুম দ্বীপ"): ["Nijhum Dwip", "Nijhum island"], N("মুছাপুর ক্লোজার"): ["Musapur closure", "Musapur"],
    N("গান্ধী আশ্রম"): ["Gandhi Ashram"], N("বজরা শাহী জামে মসজিদ"): ["Bajra Shahi Mosque"],
}
TEAM = "names and spellings given by the team (final queue, 9 Nov 2026)"
# Banglapedia's names for spots an official page already places (secondary reference, place names only).
REFERENCE_NAMES = {N("ডুলাহাজারা সাফারি পার্ক"): ["বঙ্গবন্ধু সাফারি পার্ক"], N("রাংকূট বৌদ্ধ বিহার"): ["রামকোট বৌদ্ধ কেয়াং"],
                   N("শ্রী শ্রী রামকুট তীর্থ ধাম"): ["রামকোট হিন্দু মন্দির"], N("হিমছড়ি ঝর্ণা/সমুদ্র সৈকত"): ["হিমছড়ির ঝর্ণা"],
                   N("সেন্টমার্টিন দ্বীপ"): ["সেন্ট মার্টিনস দ্বীপ"], N("কানা রাজার সুড়ঙ্গ"): ["কানারাজার সুড়ঙ্গ"]}
REFERENCE = "Banglapedia (secondary reference, place names only): https://bn.banglapedia.org/index.php/কক্সবাজার_জেলা"
# Spots that pages name only in running text, copied word for word (name, upazila, page, note).
TEKNAF_OTHERS = "https://teknaf.coxsbazar.gov.bd/pages/tourist-spot/অন্যান্য-dcb997-6990be1a35ce18e1c070736f"
BP_CX = "https://bn.banglapedia.org/index.php/কক্সবাজার_জেলা"
IN_TEXT = [(n, "Teknaf", TEKNAF_OTHERS, "listed on the Teknaf upazila page 'অন্যান্য'") for n in
           ["সাবরাং ট্যুরিজম পার্ক", "মাথিনের কূপ", "বাংলাদেশ-মায়ানমার ট্রানজিট জেটিঘাট", "টেকনাফ ন্যাচার গেম রিজার্ভ",
            "শীলখালী চিরহরিৎ গর্জন বাগান", "মারিশবনিয়া সৈকত", "কুদুমগুহা"]] + [
    ("মেরিন ড্রাইভ", "Ukhia", "https://ukhiya.coxsbazar.gov.bd/pages/tourist-spot/ইনানী-সি-বীচ-84b2a7-6990be1e35ce18e1c07075a5",
     "the Ukhia page: the 84 km Marine Drive road from Kolatoli to Teknaf leads to Inani"),
] + [(n, up, BP_CX, "Banglapedia (secondary reference, place names only)") for n, up in
     [("মৈনাক পর্বত", "Maheshkhali"), ("কুতুব আউলিয়ার মাযার", "Kutubdia"), ("বীর কমলার দিঘী", "Teknaf"), ("থোয়াইংগা চৌধুরীর ক্যাং", "Ramu"),
                                                                    ("সাবমেরিন ক্যাবল ল্যান্ডিং স্টেশন", "Cox's Bazar Sadar")]]
IN_TEXT_SPELLINGS = {N("মাথিনের কূপ"): ["Mathiner Kup", "Mathin's well"], N("মেরিন ড্রাইভ"): ["Marine Drive", "Marine Drive road"]}


def write_aliases(data, spots, cache):
    """data/aliases.json gets one "spot-…" entry per tourist spot whose upazila a page gives; the team's own entries stay.
    A spot no page places in an upazila is left out (it goes to docs/DATA_GAPS.md)."""
    path = os.path.join(data, "aliases.json")
    doc = load_json(path)
    ups, unions_of = {}, {}
    for fname in ("contacts_noakhali.json", "contacts_coxsbazar.json"):
        doc_d = load_json(os.path.join(data, fname))
        for u in doc_d["unions"]:
            ups[u["upazila_en"]] = (doc_d["district"], N(u["upazila_bn"]))
            unions_of.setdefault(u["upazila_en"], []).append(N(u["union_bn"]))
    twin = {}
    for s in spots:
        if s["portal_upazila_en"]:
            twin.setdefault((s["district"], N(s["name_bn"])), s["portal_upazila_en"])
    entries, seen = [], set()
    for s in spots:
        name = N(s["name_bn"])
        if name in NOT_A_PLACE:
            continue
        up = s["portal_upazila_en"]
        if not up:                                                   # a district page: the upazila named in its text,
            text = N(name + " " + s["location_text"])               # or the same spot on an upazila portal
            named = [en for en, (d, bn) in ups.items() if d == s["district"] and bn != N(s["district"] == "Noakhali" and "নোয়াখালী" or "কক্সবাজার") and bn in text]
            same = next((v for (d, k), v in twin.items() if d == s["district"] and (k in name or name in k)), None)
            up = named[0] if len(named) == 1 else same
        if not up or (s["district"], up, name) in seen:
            continue
        seen.add((s["district"], up, name))
        # the union only when the page names one of this upazila's unions ("০২নং কেশারপাড় ইউনিয়নে অবস্থিত")
        text = N(name + " " + s["location_text"])
        unions = [u for u in unions_of.get(up, []) if re.search(re.escape(u.replace(N(" ইউনিয়ন"), "")) + N(r"\s*ইউনিয়ন"), text)]
        kind = next((t for t, rx in TYPES if re.search(rx, name)), "tourist")
        key = hashlib.sha1(f"{s['district']}|{up}|{name}".encode("utf-8")).hexdigest()[:10]   # stable: same spot, same id
        e = {"id": f"spot-{key}",
             "name_bn": name, "name_en": None, "also": TEAM_SPELLINGS.get(name, []), "type": kind, "district": s["district"],
             "upazila_en": up, "municipality_bn": None, "union_bn": unions[0] if len(unions) == 1 else None,
             "source": "official page", "source_url": s["source_url"],
             "source_last_updated": s.get("source_last_updated"), "added_by": "collect_tourist_spots.py", "added_on": TODAY}
        ref = REFERENCE_NAMES.get(name, [])
        if e["also"]:
            e["name_en"] = e["also"][0]
        if e["also"] or ref:
            e["also_source"] = "; ".join(x for x in [e["also"] and f"{', '.join(e['also'])}: {TEAM}", ref and f"{', '.join(ref)}: {REFERENCE}"] if x)
            e["also"] = e["also"] + ref
        entries.append(e)
    for name, up, url, note in IN_TEXT:
        name = N(name)
        if (N("Cox's Bazar"), up, name) in {(N(a), b, c) for a, b, c in seen}:
            continue
        also = IN_TEXT_SPELLINGS.get(name, [])
        entries.append({"id": "spot-" + hashlib.sha1(f"Cox's Bazar|{up}|{name}".encode("utf-8")).hexdigest()[:10], "name_bn": name,
                        "name_en": also[0] if also else None, "also": also, **({"also_source": TEAM} if also else {}),
                        "type": next((t for t, rx in TYPES if re.search(rx, name)), "tourist"), "district": "Cox's Bazar",
                        "upazila_en": up, "municipality_bn": None, "union_bn": None,
                        "source": "reference" if "banglapedia" in url else "official page", "source_url": url, "source_note": note,
                        "added_by": "collect_tourist_spots.py", "added_on": TODAY})
    # Kolatoli: the Cox's Bazar pourashava's ward page lists দক্ষিণ/উত্তর কলাতলী in ward 12 (Cox's Bazar Sadar).
    ward = "https://ps.coxsbazar.gov.bd/pages/static-pages/6990e62b35ce18e1c0725cdb"
    if N("কলাতলী") in text_of(content_of(fetch(ward, cache) or "")):
        entries.append({"id": "spot-kolatoli", "name_bn": N("কলাতলী"), "name_en": "Kolatoli", "also": ["Kolatoli", "Kalatoli", "Kolatoli beach"],
                        "also_source": TEAM, "type": "tourist", "district": "Cox's Bazar", "upazila_en": "Cox's Bazar Sadar",
                        "municipality_bn": N("কক্সবাজার পৌরসভা"), "union_bn": None, "ward_no": "12", "source": "official page",
                        "source_url": ward, "source_note": "ward 12: দক্ষিণ কলাতলী, উত্তর কলাতলী", "added_by": "collect_tourist_spots.py", "added_on": TODAY})
    doc["aliases"] = [a for a in doc["aliases"] if not a["id"].startswith("spot-")] + entries
    save_json(path, doc, indent=1)
    print("aliases: spots", len(entries))


if __name__ == "__main__":
    main(*sys.argv[1:4])
