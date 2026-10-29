"""Human spot-check sheet (P13, issue #80): 40 random key contacts for a person to check by hand.

Usage: python spot_check.py <data folder> [--seed N] [--auto] [--force]
Writes <data folder>/spot_check_40.csv (UTF-8 with BOM, so Excel shows Bangla).
  --auto  also opens each source page once (1.2 s between requests, certificate checks on) and fills
          auto_result / auto_quote. That is only a hint: a person still opens every link, compares the
          number with the official page, and writes yes / no in human_ok. Only rows with human_ok = yes may
          later get status "verified". Never guess or fill in a number.
"""
import csv, html, json, os, random, re, sys, unicodedata

sys.stdout.reconfigure(encoding="utf-8")
DATA = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "."
SEED = int(sys.argv[sys.argv.index("--seed") + 1]) if "--seed" in sys.argv else 20261028
AUTO = "--auto" in sys.argv
FILES = ["contacts_coxsbazar", "contacts_noakhali", "manual_additions"]
BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
COLUMNS = ["id", "file", "category", "office_bn", "name_bn", "designation_bn", "phones", "source_url",
           "auto_result", "auto_quote", "human_ok", "checked_by", "checked_on", "note"]


def load(name):
    with open(os.path.join(DATA, name + ".json"), encoding="utf-8") as f:
        return json.load(f)["records"]


def page_text(body):
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", body, flags=re.S)
    return unicodedata.normalize("NFC", html.unescape(re.sub(r"<[^>]+>", " ", text)))


def auto_check(phones, text):
    """'found' only if every number of the record is on the page (Bangla or English digits, any spacing)."""
    flat = re.sub(r"[\s\-‌‍\.\(\)/]", "", text.translate(BN))
    hits, quote = [], ""
    for p in phones:
        d = re.sub(r"\D", "", p)
        hits.append(d in flat or "88" + d in flat)
        if hits[-1] and not quote:
            pat = r"[\s\-\.\(\)]{0,3}".join("[%s%s]" % (c, "০১২৩৪৫৬৭৮৯"[int(c)]) for c in d)
            m = re.search(pat, text)
            if m:
                quote = re.sub(r"\s+", " ", text[max(0, m.start() - 90):m.end() + 10]).strip()
    return ("found" if all(hits) else "partly found" if any(hits) else "not found"), quote


out = os.path.join(DATA, "spot_check_40.csv")
# Never erase a person's work: once any human_ok is filled in, only --force may write the sheet again.
if os.path.exists(out) and "--force" not in sys.argv:
    with open(out, encoding="utf-8-sig", newline="") as f:
        if any((row.get("human_ok") or "").strip() for row in csv.DictReader(f)):
            sys.exit(f"{out} already has hand-check answers (human_ok). Not overwritten; use --force to replace it.")

pool = sorted(((f, r) for f in FILES for r in load(f)
               if r.get("key_contact") and r.get("phones") and r.get("source_url")), key=lambda x: x[1]["id"])
sample = random.Random(SEED).sample(pool, 40)
pages = {}
if AUTO:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import fetch

rows = []
for f, r in sample:
    row = {"id": r["id"], "file": f, "category": r.get("category", ""), "office_bn": r.get("office_bn", ""),
           "name_bn": r.get("name_bn", ""), "designation_bn": r.get("designation_bn", ""),
           "phones": " | ".join(r["phones"]), "source_url": r["source_url"]}
    if AUTO:
        u = r["source_url"]
        if u not in pages:
            pages[u] = fetch.get(u, delay=1.2)
        status, body = pages[u]
        if status != 200 or not body:
            row["auto_result"] = "page did not open"
        else:
            row["auto_result"], row["auto_quote"] = auto_check(r["phones"], page_text(body))
    rows.append(row)

with open(out, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=COLUMNS)
    w.writeheader()
    w.writerows(rows)
counts = {}
for row in rows:
    counts[row.get("auto_result", "not checked")] = counts.get(row.get("auto_result", "not checked"), 0) + 1
print(f"seed {SEED}, pool {len(pool)} key contacts, wrote {len(rows)} rows to {out}")
print(", ".join(f"{k}: {v}" for k, v in sorted(counts.items())))
