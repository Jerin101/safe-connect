"""Villages for the unions that have no village page, from BBS's official geo-code lists (bbs.gov.bd → জিও-কোড).

BBS publishes one PDF per district: every division, upazila, pourashava, union, mauza (মৌজা) and village (গ্রাম) with its
code. The English names are clean. The Bangla names come out of the PDF garbled: a vowel sign written before its
letter, and some joined letters replaced by other characters. So:
  * the English name is taken as it is (official),
  * the Bangla name only when moving the vowel signs back gives plain Bangla whose sound matches the English name,
    otherwise it is left out (null). Nothing is guessed.
A BBS union is matched to our union inside the same upazila by sound; a union that does not match is reported, never
guessed. Only unions without an official village page get villages from here (data/villages.json keeps those).

Usage: python collect_bbs_villages.py <data folder> <pdf folder>
Needs pypdf (pip install pypdf). Downloads the two PDFs into <pdf folder> once (certificate checks on).
"""
import datetime, json, os, re, sys, unicodedata, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import CTX, UA, get
from collect_villages import load_json

sys.stdout.reconfigure(encoding="utf-8")
GEOCODE = "https://bbs.gov.bd/pages/static-pages/6922ded1933eb65569e1d95d"
DISTRICTS = (("Noakhali", "NOAKHALI", "contacts_noakhali.json"), ("Cox's Bazar", "COX", "contacts_coxsbazar.json"))
N = lambda s: " ".join(unicodedata.normalize("NFC", s or "").split())
TODAY = datetime.date.today().isoformat()
# Rebuilt Bangla that sounds right but is not a reliable spelling (bangla-reviewer, PR #181, 11 Nov 2026): English only.
NOT_BANGLA = {"Satghariapara Lal Shiariapara",   # "শরীয়া" for Shiaria: a vowel sign put back in the wrong place
              "Bataiya"}                         # "বাটৈয়া": the union itself is বাটইয়া


# ---- one sound for Bangla and English (the same idea as js/phonetic.js) ----
BN = {'অ': 'a', 'আ': 'a', 'ই': 'a', 'ঈ': 'a', 'উ': 'a', 'ঊ': 'a', 'ঋ': 'ri', 'এ': 'a', 'ঐ': 'a', 'ও': 'a', 'ঔ': 'a',
      'া': 'a', 'ি': 'a', 'ী': 'a', 'ু': 'a', 'ূ': 'a', 'ৃ': 'ri', 'ে': 'a', 'ৈ': 'a', 'ো': 'a', 'ৌ': 'a',
      'ক': 'k', 'খ': 'k', 'গ': 'g', 'ঘ': 'g', 'ঙ': 'ng', 'চ': 'C', 'ছ': 'C', 'জ': 'j', 'ঝ': 'j', 'ঞ': 'n', 'ট': 't', 'ঠ': 't',
      'ড': 'd', 'ঢ': 'd', 'ণ': 'n', 'ত': 't', 'থ': 't', 'দ': 'd', 'ধ': 'd', 'ন': 'n', 'প': 'p', 'ফ': 'p', 'ব': 'b', 'ভ': 'b',
      'ম': 'm', 'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 's', 'ষ': 's', 'স': 's', 'হ': 'h', 'ৎ': 't', 'ং': 'ng', 'ঃ': '', 'ঁ': '', '্': ''}


def sound(text):
    s = N(text).lower().replace("ক্ষ", "ক")
    s = re.sub("[ডঢ]়|[ড়ঢ়]", "র", s)
    s = re.sub("য়|য়", "", s)
    s = re.sub("(?<!র)্ব", "", s).replace("্য", "").replace("়", "")
    s = "".join(BN.get(c, c) for c in s)
    s = re.sub(r"[^a-zC ]+", " ", s.replace("x", "ks").replace("q", "k"))
    s = re.sub("chh|ch", "C", s).replace("c", "k").replace("C", "c")
    for a, b in (("kh", "k"), ("gh", "g"), ("jh", "j"), ("z", "j"), ("th", "t"), ("dh", "d"), ("ph", "p"), ("f", "p"),
                 ("bh", "b"), ("v", "b"), ("sh", "s")):
        s = s.replace(a, b)
    s = re.sub(r"rh\b", "r", s)                                 # ঢ় at a word end ("Garh"), not "Charhazari"
    out = []
    for w in s.split():
        lead = "a" if w[0] in "aeiou" else ""
        out.append(lead + re.sub("[aeiouyw]", "", w))
    return re.sub(r"(.)\1+", r"\1", "".join(out))               # "Mir Warishpur" = মিরওয়ারিশপুর


def bare(text):
    """The sound without vowels at word starts: "Char Amanullah" and "চরআমান উল্যা" meet. An n before a consonant is
    left out too: BBS writes ঁ as n ("Char Kankra" = চরকাঁকড়া, "Fansiakhali" = ফাঁসিয়াখালী)."""
    s = re.sub("n(?=[kgcjtdpbs])", "", re.sub(r"(?<!^)a", "", sound(text)))
    return re.sub(r"(.)\1+", r"\1", s)


def repair(garbled):
    """BBS's Bangla with the vowel signs put back after their letter; None if anything else is wrong with it."""
    s = garbled.replace("έ", "ে")                                   # 'έ' stands for ে
    s = re.sub("([িেৈ])((?:[ক-হ]\u09BC?্)*[ক-হ]\u09BC?)", r"\2\1", N(s))   # ি ে ৈ come before their letter in the PDF (য় is য + nukta)
    s = s.replace("ো", "ো").replace("ৌ", "ৌ")
    s = N(s)
    ok = re.fullmatch(r"[ঀ-৿ -]+", s or "x") and not re.search("[া-ৌ][া-ৌ]|(^|[ -])[া-ৌ্]", s)   # no two vowel signs in a row
    return s if ok else None


def pdf_rows(path):
    from pypdf import PdfReader
    rows = []
    for page in PdfReader(path).pages:
        for line in (page.extract_text() or "").split("\n"):
            m = re.match(r"^([4-8]) ((?:\d+ )+)(.*)$", line.strip())
            if not m:
                continue
            rest = m.group(3).split(" ")
            en = []
            while rest and re.fullmatch(r"[A-Z0-9().'’/&,*-]+", rest[0]):
                en.append(rest.pop(0))
            bn = []
            while rest and not re.fullmatch(r"[0-9.]+", rest[0]):
                bn.append(rest.pop(0))
            if en:
                rows.append((int(m.group(1)), " ".join(en).title(), " ".join(bn)))
    return rows


def pdf_links():
    status, page = get(GEOCODE, delay=1.0)
    return {re.sub(r"<[^>]+>", "", label).strip().upper(): href.replace("&amp;", "&")
            for href, label in re.findall(r'href="([^"#]+\.pdf)"[^>]*>(.*?)</a>', page, re.S)}


def main(data, pdf_dir):
    os.makedirs(pdf_dir, exist_ok=True)
    villages_page = load_json(os.path.join(data, "villages.json"))
    without = {(w["district"], w["upazila_en"], N(w["union_bn"])) for w in villages_page["unions_without_village_page"]}
    links = pdf_links()                                        # each union's source is its district's PDF
    out = {"note": "Villages for the unions with no official village page, from BBS's geo-code list (জিও-কোড, bbs.gov.bd). "
                   "English names as BBS writes them. A Bangla name only where BBS's Bangla, with its vowel signs put back, "
                   "sounds the same as the English name; otherwise null. Collected by tools/collect_bbs_villages.py.",
           "source_page": GEOCODE, "retrieved_on": TODAY, "source_pdfs": {}, "unions": [], "not_matched": []}
    for district, label, fname in DISTRICTS:
        path = os.path.join(pdf_dir, f"{label.lower()}.pdf")
        pdf_url = next(v for k, v in links.items() if k.startswith(label))
        if not re.match(r"https://objectstorage\.[a-z0-9-]+\.oraclecloud15\.com/n/[a-z0-9]+/b/V2Ministry/o/office-bbs/", pdf_url):
            sys.exit(f"{district}: the PDF link is not on the portal's file store, stopping: {pdf_url}")   # as validate_data.py
        out["source_pdfs"][district] = pdf_url                  # validate_data.py ties each union to its district's PDF
        if not os.path.exists(path):
            with urllib.request.urlopen(urllib.request.Request(pdf_url, headers=UA), context=CTX, timeout=120) as r, open(path, "wb") as f:
                f.write(r.read())
        doc = load_json(os.path.join(data, fname))
        ours = {}
        for u in doc["unions"]:
            ours.setdefault(sound(u["upazila_en"])[:4], []).append(u)
        upazila, union, items = None, None, {}
        for lvl, en, bn in pdf_rows(path):
            if lvl == 4:
                upazila, union = en, None
            elif lvl == 5:
                union = None                                    # a pourashava: its wards are not unions
            elif lvl == 6 and en.startswith("Ward No"):         # a pourashava's ward
                union = None
            elif lvl == 6:
                key = bare(en)
                same = lambda u: bare(N(u["union_bn"]).replace(N(" ইউনিয়ন"), "")) == key or bare(re.sub(r"(?i)up\d*$|union", "", u.get("union_en") or "")) == key
                hit = [u for u in ours.get(sound(upazila)[:4], []) if same(u)]
                if not hit:                                     # BBS's 2017 list files some unions under an older upazila
                    hit = [u for us in ours.values() for u in us if same(u)]   # (Eidgaon): only if just one in the district
                union = hit[0] if len(hit) == 1 else None
                if not union:
                    out["not_matched"].append({"district": district, "upazila": upazila, "union_en": en, "candidates": len(hit)})
                items.setdefault(id(union), (union, [], []))
            elif lvl in (7, 8) and union:
                fixed = repair(bn)
                name_bn = fixed if fixed and sound(fixed) == sound(en) and en not in NOT_BANGLA else None
                items[id(union)][1 if lvl == 8 else 2].append([en, name_bn])
        for union, vill, mauza in items.values():
            if not union or (district, union["upazila_en"], N(union["union_bn"])) not in without:
                continue
            names = vill or mauza                               # villages; a union with none listed: its mauzas
            out["unions"].append({"district": district, "upazila_en": union["upazila_en"], "union_bn": N(union["union_bn"]),
                                  "level": "village" if vill else "mauza", "source_url": pdf_url,
                                  "villages": list({tuple(v): v for v in names}.values())})
    with open(os.path.join(data, "villages_bbs.json"), "w", encoding="utf-8") as f:
        f.write(json.dumps({k: v for k, v in out.items() if k != "unions"}, ensure_ascii=False)[:-1] + ',\n "unions": [\n')
        f.write(",\n".join(json.dumps(u, ensure_ascii=False) for u in out["unions"]) + "\n]}\n")
    got = {(u["district"], u["upazila_en"], u["union_bn"]) for u in out["unions"]}
    print("unions without a village page:", len(without), "| filled from BBS:", len(got),
          "| villages:", sum(len(u["villages"]) for u in out["unions"]),
          "| with a Bangla name:", sum(1 for u in out["unions"] for v in u["villages"] if v[1]),
          "| BBS unions not matched:", len(out["not_matched"]))
    for w in sorted(without - got):
        print("  still none:", *w)


if __name__ == "__main__":
    main(*sys.argv[1:3])
