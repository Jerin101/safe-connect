"""Find a map point (latitude/longitude) for every union, municipality and upazila in the pilot districts.

The website uses these points to pick the nearest union from the phone's GPS, with no internet needed.
Source: OpenStreetMap Nominatim (free; max 1 request per second; data © OpenStreetMap contributors, ODbL).
Usage: python collect_locations.py <data folder> <output.json>
"""
import datetime, json, os, re, sys, time, urllib.parse, urllib.request

def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj, **kw):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, **kw)

UA = {"User-Agent": "SafeConnect-student-project/1.0 (github.com/Jerin101/safe-connect)"}
DISTRICT_EN = {"Noakhali": "Noakhali", "Cox's Bazar": "Cox's Bazar"}


def nominatim(q):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "jsonv2", "countrycodes": "bd", "limit": 3, "addressdetails": 1, "accept-language": "en"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                time.sleep(1.1)
                return json.loads(r.read().decode())
        except Exception:
            time.sleep(3 * (attempt + 1))
    return []


def first_in_district(results, district):
    key = district.lower().replace("'", "").split()[0]          # "noakhali" / "coxs"
    for res in results:
        if key in res.get("display_name", "").lower().replace("'", ""):
            return res
    return None


def locate(queries, district):
    for q in queries:
        hit = first_in_district(nominatim(q), district)
        if hit:
            return {"lat": round(float(hit["lat"]), 5), "lon": round(float(hit["lon"]), 5), "osm_query": q,
                    "osm_type": hit.get("addresstype") or hit.get("type")}
    return None


def main(DATA, OUT):
    out = {"source": "OpenStreetMap Nominatim, © OpenStreetMap contributors (ODbL)", "retrieved_on": datetime.date.today().isoformat(),
           "upazilas": [], "unions": [], "municipalities": []}
    for fname in ("contacts_noakhali.json", "contacts_coxsbazar.json"):
        doc = load_json(os.path.join(DATA, fname))
        dist = doc["district"]
        for upz in sorted({u["upazila_en"] for u in doc["unions"]} | {"Eidgaon"} if dist == "Cox's Bazar" else {u["upazila_en"] for u in doc["unions"]}):
            name = upz.replace(" Sadar", "")
            p = locate([f"{upz} Upazila, {dist}, Bangladesh", f"{name} Upazila, {dist}", f"{name}, {dist}, Bangladesh"], dist)
            out["upazilas"].append({"district": dist, "upazila_en": upz, **(p or {})})
            print("UPZ", dist, upz, "ok" if p else "MISSING", flush=True)
        for u in doc["unions"]:
            en = re.sub(r"\s+", " ", (u["union_en"] or "")).strip()
            p = locate([f"{en} Union, {u['upazila_en'].replace(' Sadar', '')}, {dist}", f"{en} Union, {dist}, Bangladesh", f"{en}, {dist}, Bangladesh"], dist) if en else None
            out["unions"].append({"district": dist, "upazila_en": u["upazila_en"], "union_bn": u["union_bn"], "union_en": en, **(p or {})})
            print("UNI", dist, en, "ok" if p else "MISSING", flush=True)
        for m in doc["municipalities"]:
            town = m["website"].split("//")[1].split(".")[0].replace("ps", "").replace("municipality", "") or m["upazila_en"]
            names = {"basurhat": "Basurhat", "chowmuhani": "Chowmuhani", "": "Maijdee", "coxsbazar": "Cox's Bazar"}
            guess = names.get(town, town.title())
            p = locate([f"{guess}, {dist}, Bangladesh", f"{guess} Pourashava, {dist}"], dist)
            out["municipalities"].append({"district": dist, "upazila_en": m["upazila_en"], "municipality_bn": m["municipality_bn"], "query_name": guess, **(p or {})})
            print("MUN", dist, guess, "ok" if p else "MISSING", flush=True)
    save_json(OUT, out, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
