"""Build data/locations.json: what the website needs to turn a GPS position into an area, offline.

Sources
  * Bangladesh Bureau of Statistics administrative boundaries (via OCHA HDX "cod-ab-bgd", CC BY-IGO):
    upazila boundary shapes + union / municipality centre points
  * OpenStreetMap Nominatim points from collect_locations.py (ODbL) for unions BBS names don't match

Usage: python build_locations.py <bgd_admin_boundaries.geojson.zip> <data folder> <osm locations_raw.json> <output locations.json>
"""
import difflib, json, math, os, re, sys, zipfile

def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, obj, **kw):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, **kw)

HDX_ZIP, DATA, OSM_RAW, OUT = sys.argv[1:5]
PILOT = {"Noakhali": "contacts_noakhali.json", "Cox's Bazar": "contacts_coxsbazar.json"}
SIMPLIFY_DEG = 0.0015          # ~150 m: small file, still accurate enough to find the upazila
# Union names whose BBS spelling is too different for the automatic match (checked by hand).
ALIASES = {"Tomoroddi": "Tamaruddin", "Nodona": "Nadana", "Saintmartin": "St.Martin Dwip", "Pmkhali": "Patali Machhuakhali", "Noakhala": "Nayakhola"}
MIN_SCORE = 0.78


def key(s):
    """Spelling-tolerant key: 'Alyearpur' ~ 'Alyerapur', 'Senbagh' ~ 'Senbag'."""
    s = re.sub(r"\(.*?\)|union|paurashava|pourashava|sadar|[^a-z]", "", (s or "").lower())
    for a, b in (("ph", "f"), ("kh", "k"), ("gh", "g"), ("bh", "b"), ("dh", "d"), ("th", "t"), ("sh", "s"), ("ch", "c"),
                 ("aa", "a"), ("ee", "i"), ("oo", "u"), ("ou", "u"), ("y", "i"), ("w", "o"), ("z", "j"), ("h", "")):
        s = s.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", s)


def similar(a, b):
    return difflib.SequenceMatcher(None, key(a), key(b)).ratio()


def km(a, b):
    r = math.radians
    h = math.sin(r(b[0] - a[0]) / 2) ** 2 + math.cos(r(a[0])) * math.cos(r(b[0])) * math.sin(r(b[1] - a[1]) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def inside(lat, lon, rings):
    """Ray casting: is (lat, lon) inside any of the rings ([lon, lat] pairs)?"""
    for ring_ in rings:
        hit = False
        for (x1, y1), (x2, y2) in zip(ring_, ring_[1:] + ring_[:1]):
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                hit = not hit
        if hit:
            return True
    return False


def in_or_near(lat, lon, rings, max_km=3):
    """Inside the upazila, or within max_km of its border (coastal chars move faster than maps)."""
    if inside(lat, lon, rings):
        return True
    return any(km((lat, lon), (y, x)) <= max_km for ring_ in rings for x, y in ring_[::3])


def simplify(points, tol):
    """Ramer–Douglas–Peucker line simplification."""
    if len(points) < 4:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-12
    far, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        d = abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / norm
        if d > far:
            far, idx = d, i
    if far <= tol:
        return [points[0], points[-1]]
    return simplify(points[:idx + 1], tol)[:-1] + simplify(points[idx:], tol)


def ring(coords):
    pts = simplify([(round(x, 5), round(y, 5)) for x, y in coords], SIMPLIFY_DEG)
    return [[round(x, 4), round(y, 4)] for x, y in pts]


z = zipfile.ZipFile(HDX_ZIP)
bbs_points = [f["properties"] for f in json.loads(z.read("bgd_adminpoints.geojson"))["features"]]
bbs_upazilas = [f for f in json.loads(z.read("bgd_admin3.geojson"))["features"] if f["properties"]["adm2_name"] in PILOT]
osm = load_json(OSM_RAW)
osm_union = {(u["district"], u["upazila_en"], u["union_bn"]): u for u in osm["unions"] if "lat" in u}

out = {"sources": ["Bangladesh Bureau of Statistics administrative boundaries v03, via OCHA HDX (CC BY-IGO)",
                   "OpenStreetMap Nominatim, © OpenStreetMap contributors (ODbL) – only where BBS names did not match"],
       "note": "Upazila shapes are simplified (~150 m). Union and town points are centres; the website picks the nearest one inside the upazila.",
       "upazilas": [], "unions": [], "municipalities": []}
report = {"matched_bbs": 0, "matched_osm": 0, "missing": []}
upazila_rings = {}

for district, fname in PILOT.items():
    doc = load_json(os.path.join(DATA, fname))
    our_upazilas = sorted({u["upazila_en"] for u in doc["unions"]} | {r["upazila_en"] for r in doc["records"] if r.get("upazila_en")})
    for f in bbs_upazilas:
        p = f["properties"]
        if p["adm2_name"] != district:
            continue
        ours = max(our_upazilas, key=lambda u: similar(u, p["adm3_name"]))
        polys = f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]]
        upazila_rings.setdefault((district, ours), []).extend(poly[0] for poly in polys)
        out["upazilas"].append({"district": district, "upazila_en": ours, "bbs_name": p["adm3_name"], "pcode": p["adm3_pcode"],
                                "center": [round(p["center_lat"], 5), round(p["center_lon"], 5)],
                                "polygons": [[ring(r) for r in poly[:1]] for poly in polys]})   # outer ring only
    points = [p for p in bbs_points if p["admin_level"] == 4 and p["adm2_name"] == district]
    unions_pts = [p for p in points if "paurashava" not in p["name"].lower()]
    towns_pts = [p for p in points if "paurashava" in p["name"].lower()]
    # Each BBS point may belong to only one union: assign the most certain matches first.
    def candidates(u):
        name = ALIASES.get(u["union_en"], u["union_en"])
        same_upazila = [p for p in unions_pts if similar(u["upazila_en"], p["adm3_name"]) > 0.7]
        ranked = sorted(((similar(name, p["name"]), p) for p in (same_upazila or unions_pts)), key=lambda x: -x[0])
        if same_upazila and (not ranked or ranked[0][0] < MIN_SCORE):        # new upazilas: BBS still files them under the old one
            ranked = sorted(((similar(name, p["name"]), p) for p in unions_pts), key=lambda x: -x[0])
        return [(sc, p) for sc, p in ranked if sc >= MIN_SCORE]

    taken, chosen = set(), {}
    for u in sorted(doc["unions"], key=lambda u: -(candidates(u)[0][0] if candidates(u) else 0)):
        for sc, p in candidates(u):
            rings = upazila_rings.get((district, u["upazila_en"]))
            if p["adm4_pcode"] in taken or (rings and not in_or_near(p["y_coord"], p["x_coord"], rings)):
                continue                                    # used already, or outside this union's own upazila
            taken.add(p["adm4_pcode"])
            chosen[(u["upazila_en"], u["union_bn"])] = p
            break
    for u in doc["unions"]:
        rec = {"district": district, "upazila_en": u["upazila_en"], "union_bn": u["union_bn"], "union_en": u["union_en"]}
        best = chosen.get((u["upazila_en"], u["union_bn"]))
        o = osm_union.get((district, u["upazila_en"], u["union_bn"]))
        if best:
            rec.update(lat=round(best["y_coord"], 5), lon=round(best["x_coord"], 5), src="bbs", bbs_name=best["name"])
            report["matched_bbs"] += 1
        elif o and in_or_near(o["lat"], o["lon"], upazila_rings.get((district, u["upazila_en"]), [])):
            rec.update(lat=o["lat"], lon=o["lon"], src="osm")
            report["matched_osm"] += 1
        else:
            report["missing"].append(f"{district} / {u['upazila_en']} / {u['union_en']}")
            continue
        out["unions"].append(rec)
    for m in doc["municipalities"]:
        town = re.sub(r"[,\s].*$", "", m["municipality_bn"])
        osm_m = next((x for x in osm["municipalities"] if x["municipality_bn"] == m["municipality_bn"] and "lat" in x), None)
        name_en = (osm_m or {}).get("query_name") or m["upazila_en"]
        best = max(towns_pts, key=lambda p: similar(name_en, p["name"])) if towns_pts else None
        if best and similar(name_en, best["name"]) >= 0.6:
            out["municipalities"].append({"district": district, "upazila_en": m["upazila_en"], "municipality_bn": m["municipality_bn"],
                                          "lat": round(best["y_coord"], 5), "lon": round(best["x_coord"], 5), "src": "bbs", "bbs_name": best["name"]})
        elif osm_m:
            out["municipalities"].append({"district": district, "upazila_en": m["upazila_en"], "municipality_bn": m["municipality_bn"],
                                          "lat": osm_m["lat"], "lon": osm_m["lon"], "src": "osm"})
        else:
            report["missing"].append(f"{district} / town {town}")

save_json(OUT, out, ensure_ascii=False, separators=(",", ":"))
print(json.dumps(report, ensure_ascii=False, indent=1))
print("upazilas", len(out["upazilas"]), "unions", len(out["unions"]), "towns", len(out["municipalities"]), "size KB", os.path.getsize(OUT) // 1024)
