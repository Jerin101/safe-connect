import json, sys, datetime
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from fetch import get_json
B = "https://bangladesh.gov.bd/ajax/get"
out = {"source": "https://bangladesh.gov.bd (national portal location API: /ajax/get/<level>/<id>/list)",
       "retrieved_on": datetime.date.today().isoformat(), "divisions": []}
for dv in get_json(f"{B}/division/list"):
    d = {"bbs_code": dv["bbs_code"], "name_en": dv["title_en"], "name_bn": dv["title_bn"], "districts": []}
    for ds in get_json(f"{B}/district/{dv['_id']}/list") or []:
        di = {"bbs_code": ds["bbs_code"], "name_en": ds["title_en"], "name_bn": ds["title_bn"], "upazilas": []}
        for uz in get_json(f"{B}/upazilla/{ds['_id']}/list") or []:
            u = {"bbs_code": uz.get("bbs_code"), "name_en": uz["title_en"], "name_bn": uz["title_bn"], "_raw": {k: v for k, v in uz.items() if k not in ("title","title_en","title_bn","row_status")}, "unions": []}
            for un in get_json(f"{B}/union/{uz['_id']}/list") or []:
                u["unions"].append({"bbs_code": un.get("bbs_code"), "name_en": un["title_en"], "name_bn": un["title_bn"], "_raw": {k: v for k, v in un.items() if k not in ("title","title_en","title_bn","row_status")}})
            di["upazilas"].append(u)
        d["districts"].append(di); print(dv["title_en"], ds["title_en"], len(di["upazilas"]), sum(len(x["unions"]) for x in di["upazilas"]), flush=True)
    out["divisions"].append(d)
with open(sys.argv[1] if len(sys.argv) > 1 else "areas_raw.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
