"""Make a small, reviewable copy of the official BBS administrative areas (via OCHA HDX) for the master area list.

Source: "Bangladesh - Subnational Administrative Boundaries" (COD-AB v03), published by OCHA Field Information Services
Section (FISS) from data of the Bangladesh Bureau of Statistics (BBS), licence CC BY-IGO.
  https://data.humdata.org/dataset/cod-ab-bgd
This script reads ONLY the tabular file (bgd_admin_boundaries.xlsx, about 0.6 MB). It does not read any boundary polygons.

Usage:  python tools/extract_bbs_source.py <bgd_admin_boundaries.xlsx> tools/sources/bbs_cod_ab_v03.json [--retrieved-on YYYY-MM-DD]
Standard library only. The xlsx is downloaded by hand from the HDX page (one polite request); its SHA-256 is recorded here.
"""
import hashlib, json, os, re, sys, zipfile
import xml.etree.ElementTree as ET
from datetime import date, timedelta

sys.stdout.reconfigure(encoding="utf-8")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

SOURCE = {
    "dataset": "Bangladesh - Subnational Administrative Boundaries (COD-AB), version v03",
    "publisher": "OCHA Field Information Services Section (FISS); contributed by OCHA ROAP",
    "original_source": "Bangladesh Bureau of Statistics (BBS)",
    "page": "https://data.humdata.org/dataset/cod-ab-bgd",
    "file": "bgd_admin_boundaries.xlsx",
    "file_url": "https://data.humdata.org/dataset/401d3fae-4262-48c9-891f-461fd776d49b/resource/5f7e534d-9b06-442e-a706-083789bff2c9/download/bgd_admin_boundaries.xlsx",
    "file_last_modified_on_hdx": "2026-01-26",
    "licence": "Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)",
    "attribution": "Bangladesh Bureau of Statistics (BBS), via OCHA HDX (CC BY-IGO)",
    "dates_from_dataset_notes": {
        "2025-06-01": "dataset reviewed for accuracy and completeness; last edit before publishing",
        "2023-05-21": "valid for use by the humanitarian community (polygon tables: levels 1 to 3)",
        "2010-01-01": "boundaries created by the source",
    },
    "modification_notice": "Adapted by SafeConnect: the official tables were extracted into JSON with names, codes, parents and coordinates unchanged; the links between the 2020 and 2023 codes and to the national portal list were derived by tools/build_master_areas.py and are marked as derived. BBS, OCHA and HDX do not endorse SafeConnect or this adaptation.",
    "note": "Levels 1 to 3 (8 divisions, 64 districts, 507 upazila-level units = 495 upazilas + 12 city corporations) carry the 2023 codes "
            "(10 digits for level 3). The point table (union and old upazila / metropolitan thana points) is dated 2020-11-13 and uses the OLD "
            "8-digit level-3 codes. The current HDX dataset (v03) has polygons for levels 1 to 3 only: unions are points. "
            "A 2020 BBS / OCHA ROAP union polygon set (5,160 units) exists only as a third-party copy (geoBoundaries) and is NOT used here.",
}


def read_xlsx(path):
    z = zipfile.ZipFile(path)
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))

    def column(ref):
        n = 0
        for ch in re.match(r"[A-Z]+", ref).group():
            n = n * 26 + ord(ch) - 64
        return n - 1

    out = {}
    for sheet in wb.find("m:sheets", NS):
        target = rels[sheet.get("{%s}id" % NS["r"])]
        rows = ET.fromstring(z.read("xl/" + target.lstrip("/").replace("xl/", ""))).find("m:sheetData", NS).findall("m:row", NS)
        table = []
        for row in rows:
            cells = {}
            for c in row.findall("m:c", NS):
                v = c.find("m:v", NS)
                if v is None:
                    inline = c.find("m:is", NS)
                    cells[column(c.get("r"))] = "".join(t.text or "" for t in inline.iter("{%s}t" % NS["m"])) if inline is not None else ""
                else:
                    cells[column(c.get("r"))] = shared[int(v.text)] if c.get("t") == "s" else v.text
            table.append(cells)
        header = [table[0].get(i, "") for i in range(max(table[0]) + 1)]
        out[sheet.get("name")] = [{header[i]: r.get(i, "") for i in range(len(header))} for r in table[1:]]
    return out


def excel_date(serial):
    return (date(1899, 12, 30) + timedelta(days=int(float(serial)))).isoformat()


def num(x, digits=6):
    return round(float(x), digits) if x not in ("", None) else None


def main():
    argv = sys.argv[1:]
    retrieved = date.today().isoformat()
    if "--retrieved-on" in argv:
        i = argv.index("--retrieved-on")
        retrieved = argv[i + 1]
        del argv[i:i + 2]
    args = [a for a in argv if not a.startswith("--")]
    if len(args) != 2:
        sys.exit(__doc__)
    xlsx, out = args
    digest = hashlib.sha256(open(xlsx, "rb").read()).hexdigest()
    t = read_xlsx(xlsx)
    a1, a2, a3, pts = t["bgd_admin1"], t["bgd_admin2"], t["bgd_admin3"], t["bgd_adminpoints"]
    result = {
        "source": {**SOURCE, "retrieved_on": retrieved, "file_sha256": digest,
                   "polygon_table_valid_on": excel_date(a3[0]["valid_on"]), "point_table_valid_on": excel_date(pts[0]["valid_on"])},
        "divisions": [{"code": r["adm1_pcode"], "name": r["adm1_name"], "area_sqkm": num(r["area_sqkm"], 2)} for r in a1],
        "districts": [{"code": r["adm2_pcode"], "name": r["adm2_name"], "division": r["adm1_pcode"], "area_sqkm": num(r["area_sqkm"], 2)} for r in a2],
        "upazilas": [{"code": r["adm3_pcode"], "name": r["adm3_name"], "district": r["adm2_pcode"], "division": r["adm1_pcode"],
                      "area_sqkm": num(r["area_sqkm"], 2), "lat": num(r["center_lat"]), "lon": num(r["center_lon"])} for r in a3],
        # point table (2020): level 1 and 2 = the same divisions and districts with their OLD spelling (Chittagong, Comilla, Jessore ...)
        "points1": [{"code": r["adm1_pcode"], "name": r["adm1_name"]} for r in pts if r["admin_level"] == "1"],
        "points2": [{"code": r["adm2_pcode"], "name": r["adm2_name"], "division": r["adm1_pcode"]} for r in pts if r["admin_level"] == "2"],
        # level 3 = old upazila / metropolitan thana points (old 8-digit code), level 4 = union and city-ward points
        "points3": [{"code": r["adm3_pcode"], "name": r["adm3_name"], "district": r["adm2_pcode"], "lat": num(r["y_coord"]), "lon": num(r["x_coord"])}
                    for r in pts if r["admin_level"] == "3"],
        "points4": [{"code": r["adm4_pcode"], "name": r["adm4_name"], "parent": r["adm3_pcode"], "district": r["adm2_pcode"],
                     "lat": num(r["y_coord"]), "lon": num(r["x_coord"])} for r in pts if r["admin_level"] == "4"],
    }
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {out}: {len(result['divisions'])} divisions, {len(result['districts'])} districts, {len(result['upazilas'])} upazila-level units, "
          f"{len(result['points1'])} + {len(result['points2'])} old division / district names, {len(result['points3'])} old level-3 points, {len(result['points4'])} union points; {os.path.getsize(out):,} bytes; sha256 {digest[:16]}…")


if __name__ == "__main__":
    main()
