"""Second pass for collect_locations.py: fill missing points using Bangla names.

A match counts only if it lies in the right district and within 25 km of its own upazila's point.
Usage: python fill_locations.py <locations_raw.json> <output data/locations.json>
"""
import json, math, re, sys, time, urllib.parse, urllib.request
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from collect_locations import nominatim, load_json, save_json  # noqa: E402  (same polite helpers)

raw = load_json(sys.argv[1])
OUT = sys.argv[2]
BN_DISTRICT = {"Noakhali": "নোয়াখালী", "Cox's Bazar": "কক্সবাজার"}


def km(a, b):
    r = math.radians
    h = math.sin(r(b["lat"] - a["lat"]) / 2) ** 2 + math.cos(r(a["lat"])) * math.cos(r(b["lat"])) * math.sin(r(b["lon"] - a["lon"]) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


upz_point = {(u["district"], u["upazila_en"]): u for u in raw["upazilas"] if "lat" in u}
for u in raw["unions"]:
    if "lat" in u:
        centre = upz_point.get((u["district"], u["upazila_en"]))
        if centre and km(u, centre) > 25:          # first pass matched a same-name place far away
            for k in ("lat", "lon", "osm_query", "osm_type"):
                u.pop(k, None)
            print("DROP far", u["union_en"], flush=True)
        continue
for u in raw["unions"]:
    if "lat" in u:
        continue
    name = re.sub(r"\s*ইউনিয়ন\s*$", "", u["union_bn"]).strip()
    centre = upz_point.get((u["district"], u["upazila_en"]))
    for q in (u["union_bn"], f"{name}, {BN_DISTRICT[u['district']]}", f"{name} ইউনিয়ন"):
        hit = None
        for res in nominatim(q):
            p = {"lat": float(res["lat"]), "lon": float(res["lon"])}
            if centre and km(p, centre) <= 25:
                hit = res
                break
        if hit:
            u.update({"lat": round(float(hit["lat"]), 5), "lon": round(float(hit["lon"]), 5), "osm_query": q,
                      "osm_type": hit.get("addresstype") or hit.get("type")})
            break
    print("UNI2", u["union_en"], "ok" if "lat" in u else "MISSING", flush=True)
for m in raw["municipalities"]:
    if m["upazila_en"] == "Noakhali Sadar":                # Noakhali municipality = Maijdee town
        for res in nominatim("Maijdee, Noakhali, Bangladesh"):
            m.update({"lat": round(float(res["lat"]), 5), "lon": round(float(res["lon"]), 5), "osm_query": "Maijdee, Noakhali, Bangladesh", "query_name": "Maijdee"})
            break

points = {"source": raw["source"], "retrieved_on": raw["retrieved_on"],
          "note": "Approximate centre points used to pick the nearest union/town from GPS. Unions without a point fall back to their upazila.",
          "upazilas": [u for u in raw["upazilas"] if "lat" in u],
          "unions": [u for u in raw["unions"] if "lat" in u],
          "municipalities": [m for m in raw["municipalities"] if "lat" in m]}
for group in points.values():
    if isinstance(group, list):
        for p in group:
            p.pop("osm_query", None); p.pop("osm_type", None); p.pop("query_name", None)
save_json(OUT, points, ensure_ascii=False, separators=(",", ":"))
print("FINAL upazilas", len(points["upazilas"]), "unions", len(points["unions"]), "of", len(raw["unions"]), "towns", len(points["municipalities"]))
