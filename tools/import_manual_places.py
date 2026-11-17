"""Turn Tasmin's Sheet tab "নতুন জায়গা" (downloaded as CSV) into data/places/manual_<district>.json.

Usage: python tools/import_manual_places.py <file.csv> <data folder>
       (keep the CSV outside the repo, e.g. E:\\Projects\\SafeConnect-Files\\manual\\)

- Standard library only, no internet. The Sheet is never read online and no Google API is used.
- The CSV is the master list: every manual_<district>.json is written again from it.
- A row with an error is NOT written; its row number and the reason are printed so it can be fixed in the Sheet.
  Exit code 1 if any row had an error.
- Rules: tools/places_rules.py (the validator uses the same rules).
"""
import csv
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import places_rules as R  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")


def load_areas(data):
    d = json.load(open(os.path.join(data, "areas_bangladesh.json"), encoding="utf-8"))
    out = {}
    for dv in d["divisions"]:
        for ds in dv["districts"]:
            out[ds["en"]] = {"division": dv["en"], "bn": ds["bn"],
                             "upazilas": {u["en"]: u["bn"] for u in ds["upazilas"]}}
    return out


def find_district(areas, text):
    t = R.nfc(text)
    for en, x in areas.items():
        if t.lower() == en.lower() or t == R.nfc(x["bn"]):
            return en
    return None


def find_upazila(areas, district_en, text):
    t = R.nfc(text)
    for en, bn in areas[district_en]["upazilas"].items():
        if t.lower() == en.lower() or t == R.nfc(bn):
            return en
    return None


def number(text):
    t = R.to_ascii_digits((text or "").strip())
    if not t:
        return None
    return round(float(t), 6)


def row_to_place(row, areas, problems):
    """One CSV row -> a place dict (or None when the district is unknown)."""
    g = lambda k: (row.get(k) or "").strip() or None
    den = find_district(areas, g("district") or "")
    if not den:
        problems.append(("error", f"district {g('district')!r} is not in areas_bangladesh.json"))
        return None
    upz = find_upazila(areas, den, g("upazila") or "")
    if not upz:
        problems.append(("error", f"upazila {g('upazila')!r} is not in {den}"))
    rid = g("row_id") or ""
    if not rid.isdigit():
        problems.append(("error", "row_id must be a whole number"))
    try:
        lat, lon = number(g("lat")), number(g("lon"))
    except ValueError:
        problems.append(("error", "lat/lon must be numbers like 22.86951"))
        lat = lon = None
    vb = g("verified_by")
    return {
        "id": f"man-{R.slug(den)}-{rid}", "name_bn": g("name_bn"), "name_en": g("name_en"),
        "category": g("category"), "subcategory": g("subcategory"),
        "lat": lat, "lon": lon, "location_approx": lat is None, "location_source": g("location_source"),
        "division": areas[den]["division"], "district": den, "upazila": upz, "union": g("union"),
        "address_bn": g("address_bn"), "phone": R.clean_phone(g("phone")) or None, "hours": g("hours"),
        "source": R.VERIFIED_BY.get(vb), "verified_by": vb, "source_url": g("source_url"),
        "checked_by": g("checked_by"), "checked_on": g("checked_on"), "note": g("note"),
    }


def main(csv_path, data, today=None):
    today = today or datetime.date.today()
    areas = load_areas(data)
    polys = R.upazila_polygons(json.load(open(os.path.join(data, "locations.json"), encoding="utf-8")))
    cpath = os.path.join(data, "upazila_centres.json")
    centres = R.upazila_centre_points(json.load(open(cpath, encoding="utf-8"))) if os.path.exists(cpath) else {}
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != R.CSV_COLUMNS:
            print("ERROR   the header row must be exactly:", ",".join(R.CSV_COLUMNS))
            return 1
        rows = list(reader)
    good, bad, ids = {}, 0, set()
    for n, row in enumerate(rows, start=2):           # row 1 is the header, as in the Sheet
        if not any((v or "").strip() for v in row.values()):
            continue
        problems = []
        if None in row:                                # DictReader puts extra cells under the key None
            problems.append(("error", "too many cells in this row: put text with a comma (e.g. the note) in quotes"))
        p = row_to_place(row, areas, problems)
        if p:
            problems += R.check_manual_place(p, p["district"], set(areas[p["district"]]["upazilas"]), today)
            problems += R.check_in_upazila(p, polys, centres)
            if p["id"] in ids:
                problems.append(("error", f"row_id {row.get('row_id')} is used twice"))
            ids.add(p["id"])
        for lvl, msg in problems:
            print(f"{'ERROR  ' if lvl == 'error' else 'WARNING'} row {n}: {msg}")
        if p is None or any(lvl == "error" for lvl, _ in problems):
            bad += 1
            continue
        good.setdefault(p["district"], []).append(p)
    pdir = os.path.join(data, "places")
    os.makedirs(pdir, exist_ok=True)
    old = {x for x in os.listdir(pdir) if x.startswith("manual_") and x.endswith(".json")}
    written = set()
    for den in sorted(set(good) | {d for d in areas if f"manual_{R.slug(d)}.json" in old}):
        ps = sorted(good.get(den, []), key=lambda p: int(p["id"].rsplit("-", 1)[1]))
        doc = {"district_en": den, "district_bn": areas[den]["bn"], "division": areas[den]["division"],
               "source_note": "Places checked by the SafeConnect team (Sheet tab \"নতুন জায়গা\"). Not from Google Maps.",
               "imported_on": today.isoformat(), "places": ps}
        name = f"manual_{R.slug(den)}.json"
        with open(os.path.join(pdir, name), "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
            f.write("\n")
        written.add(name)
    total = sum(len(v) for v in good.values())
    print(f"{total} places written to {len(written)} file(s), {bad} row(s) with errors not written")
    return 1 if bad else 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
