"""Re-check every district record against its official source page.

Usage: python verify_sources.py <data folder>

For each record it downloads source_url again and checks that every phone number
(and the person's name) is really on that page. Then it updates the data files:
  * script_check = {"on": <date>, "result": "ok" | "name_text_differs"}
  * records whose phone number is no longer on the page are REMOVED and listed in
    verify_report.json, so a wrong or changed number never reaches the website.
"""
import datetime, json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import get

DATA = sys.argv[1] if len(sys.argv) > 1 else "."
BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
TODAY = datetime.date.today().isoformat()


def squash(text):
    text = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"[\s\-‌‍]", "", unicodedata.normalize("NFC", text).translate(BN))


cache, report = {}, {"checked_on": TODAY, "removed": [], "counts": {}}
for name in sorted(os.listdir(DATA)):
    if not (name.startswith("contacts_") or name == "manual_additions.json") or not name.endswith(".json"):
        continue
    path = os.path.join(DATA, name)
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    kept, counts = [], {"ok": 0, "name_text_differs": 0, "removed": 0, "page_unreachable_kept": 0}
    for r in doc["records"]:
        url = r["source_url"]
        if url not in cache:
            status, body = get(url, delay=0.3)
            cache[url] = squash(body) if status == 200 else None
        page = cache[url]
        if page is None:
            counts["page_unreachable_kept"] += 1          # keep the old check; try again next run
            kept.append(r)
            continue
        if not all(p in page for p in r["phones"]):
            counts["removed"] += 1
            report["removed"].append({"file": name, "id": r["id"], "name_bn": r["name_bn"], "source_url": url})
            continue
        result = "ok" if squash(r["name_bn"]) in page else "name_text_differs"
        counts[result] += 1
        r["script_check"] = {"on": TODAY, "result": result}
        kept.append(r)
    doc["records"] = kept
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    report["counts"][name] = counts
    print(name, counts, flush=True)

with open(os.path.join(DATA, "verify_report.json"), "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
