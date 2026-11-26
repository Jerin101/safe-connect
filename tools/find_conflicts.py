"""Find numbers in src/data that may need a second look (plan section 1: source conflicts go to admin review).

Two kinds of conflict are listed, nothing is changed and nothing is guessed:
  1. the SAME phone number appears for DIFFERENT people (may be a shared office line, may be a mistake);
  2. the SAME person in the SAME office has DIFFERENT numbers on different pages.
Each line shows the official source_url, so a human can open the page and decide. The result goes to docs/SOURCE_CONFLICTS.md.

Usage:  python tools/find_conflicts.py src/data > docs/SOURCE_CONFLICTS.md
Standard library only; it makes no web requests.
"""
import glob, json, os, sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")


def load(folder):
    for path in sorted(glob.glob(os.path.join(folder, "contacts_*.json"))):
        doc = json.load(open(path, encoding="utf-8"))
        for r in doc.get("records", []):
            r["_file"] = os.path.basename(path)
            yield r


def who(r):
    return " / ".join(x for x in [r.get("name_bn"), r.get("designation_bn"), r.get("office_bn")] if x) or r.get("id", "?")


def main(folder):
    recs = [r for r in load(folder) if r.get("phones")]
    by_phone = defaultdict(list)
    for r in recs:
        for p in r["phones"]:
            by_phone[p].append(r)
    shared = []
    for p, rs in by_phone.items():
        names = {(r.get("name_bn") or "").strip() for r in rs if (r.get("name_bn") or "").strip()}
        if len(names) > 1:
            shared.append((p, rs))
    by_person = defaultdict(list)
    for r in recs:
        if r.get("name_bn") and r.get("office_bn"):
            by_person[(r["name_bn"].strip(), r["office_bn"].strip(), r.get("union_en") or r.get("upazila_en") or "")].append(r)
    differ = []
    for key, rs in by_person.items():
        nums = {tuple(r["phones"]) for r in rs}
        if len(nums) > 1:
            differ.append((key, rs))

    print("# Numbers to review (possible source conflicts)\n")
    print("Made by `tools/find_conflicts.py`. Nothing here is wrong for sure: a shared office line is normal. A human opens each")
    print("source page and decides; a fix goes through `manual_additions.json` or the collector, never by hand in the data files.\n")
    print(f"- Same number, different people: **{len(shared)}**")
    print(f"- Same person and office, different numbers: **{len(differ)}**\n")
    print("## 1. The same number for different people\n")
    for p, rs in sorted(shared, key=lambda x: x[0]):
        print(f"### {p}")
        for r in rs:
            print(f"- {who(r)} · {r['_file']} · {r.get('source_url') or 'no source'}")
        print()
    print("## 2. The same person and office with different numbers\n")
    for (name, office, place), rs in sorted(differ, key=lambda x: x[0]):
        print(f"### {name} · {office} {('· ' + place) if place else ''}")
        for r in rs:
            print(f"- {', '.join(r['phones'])} · {r['_file']} · {r.get('source_url') or 'no source'}")
        print()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
