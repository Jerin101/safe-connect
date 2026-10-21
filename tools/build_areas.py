"""Turn areas_raw.json (from collect_areas.py) into the compact areas_bangladesh.json used by the website.

It also accepts an already built areas_bangladesh.json, so the clean-up below can be re-run without downloading again:
    python tools/build_areas.py data/areas_bangladesh.json data/areas_bangladesh.json
"""
import json, re, sys

in_path = sys.argv[1] if len(sys.argv) > 1 else "areas_raw.json"
out_path = sys.argv[2] if len(sys.argv) > 2 else "areas_bangladesh.json"
with open(in_path, encoding="utf-8") as f:
    raw = json.load(f)

# Remove spaces at the start/end and double spaces inside a name ("Kaptai  " -> "Kaptai").
clean = lambda s: " ".join(s.split()) if isinstance(s, str) else s
# ALL-CAPS English names -> Title Case, keeping "Cox's" and "2nd" correct.
fix = lambda s: re.sub(r"(\d)(St|Nd|Rd|Th)\b", lambda m: m[1] + m[2].lower(), s.title().replace("'S", "'s")) if s.isupper() else s
# Works for both raw records (bbs_code/name_en/name_bn) and built records (bbs/en/bn).
node = lambda x: {"bbs": x.get("bbs_code", x.get("bbs")),
                  "en": fix(clean(x.get("name_en", x.get("en")))),
                  "bn": clean(x.get("name_bn", x.get("bn")))}
out = {"source": raw["source"], "retrieved_on": raw["retrieved_on"],
       "note": "Official location list from the national portal. Some newer upazilas (e.g. Kabirhat, Eidgaon) have 0 unions here because their unions are still filed under the older upazila. Some bbs codes are missing (null or empty) or repeated in the source; they are kept as published.",
       "divisions": [{**node(d), "districts": [{**node(ds), "upazilas": [{**node(u), "unions": [node(n) for n in u["unions"]]}
                                                                       for u in ds["upazilas"]]} for ds in d["districts"]]}
                     for d in raw["divisions"]]}
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
