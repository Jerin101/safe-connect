"""M1.2 technical pilot: official upazila polygons -> validated, simplified, compact, point-in-polygon tested.

Source: BBS COD-AB v03 (OCHA HDX, CC BY-IGO), file bgd_admin3.geojson inside bgd_admin_boundaries.geojson.zip.
This script only READS the downloaded zip/geojson. It writes a small pilot file and a report. It never touches
production data (src/data/*.json other than the pilot folder). Python standard library only.

Run (from the repo root):
  python tools/m12_polygon_pilot.py --zip PATH/bgd_admin_boundaries.geojson.zip
Options: --tolerance 100 (metres, for the pilot file) --out-data src/data/pilot --report docs/reports/M1_2_POLYGON_PILOT.md

A polygon is an UPAZILA boundary. A union point inside it only says "this union is probably in this upazila";
no union boundary exists in the official data, so nothing here may be shown as "exact union".
"""
import argparse, gzip, hashlib, json, math, os, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# Pilot choice (see the report): island, long coast + offshore island, mainland district seat, a small mainland upazila, one new upazila (Eidgaon).
PILOT = {
    'BD20750036': 'island (Hatiya): MultiPolygon, many char islands',
    'BD20220090': 'long thin coast plus offshore island (Teknaf, Saint Martin): MultiPolygon, long border',
    'BD20750087': 'mainland district seat (Noakhali Sadar): many neighbours, dense unions',
    'BD20750047': 'small mainland upazila (Kabirhat): present in the 2020 point table with its own code and 8 union points (it is NOT a 2023 new upazila; its link to the 2020 code is derived)',
    'BD20220032': 'new upazila (Eidgaon): no 2020 point code at all',
}
TOLERANCES = (50, 100, 300)
PRECISION = 5  # decimal degrees, about 1.1 m


# ---------- geometry helpers (lon, lat in degrees) ----------
def metres_per_deg(lat):
    return 111320.0 * math.cos(math.radians(lat)), 110574.0


def ring_area(ring):
    """Signed area in deg^2 (positive = counter-clockwise)."""
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return s / 2


def clean_ring(ring, notes):
    """Drop repeated points, close the ring, report what changed."""
    out = []
    for p in ring:
        p = (float(p[0]), float(p[1]))
        if not (math.isfinite(p[0]) and math.isfinite(p[1])):
            notes.append('non-finite point dropped'); continue
        if out and out[-1] == p:
            notes.append('repeated point dropped'); continue
        out.append(p)
    if out and out[0] != out[-1]:
        out.append(out[0]); notes.append('ring closed')
    return out


def segs_intersect(a, b, c, d):
    def o(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    o1, o2, o3, o4 = o(a, b, c), o(a, b, d), o(c, d, a), o(c, d, b)
    return (o1 * o2 < 0) and (o3 * o4 < 0)


def self_intersections(rings, limit=5):
    """Proper crossings between any two segments of the given rings (grid-bucketed, not O(n^2))."""
    segs = []
    for ri, ring in enumerate(rings):
        for i in range(len(ring) - 1):
            segs.append((ri, i, ring[i], ring[i + 1], len(ring) - 1))
    if not segs:
        return 0
    xs = [p[0] for s in segs for p in (s[2], s[3])]; ys = [p[1] for s in segs for p in (s[2], s[3])]
    x0, y0 = min(xs), min(ys)
    n = max(8, int(math.sqrt(len(segs))))
    cw = (max(xs) - x0) / n or 1e-9; ch = (max(ys) - y0) / n or 1e-9
    grid = {}
    for k, s in enumerate(segs):
        ax, ay, bx, by = s[2][0], s[2][1], s[3][0], s[3][1]
        for gx in range(int((min(ax, bx) - x0) / cw), int((max(ax, bx) - x0) / cw) + 1):
            for gy in range(int((min(ay, by) - y0) / ch), int((max(ay, by) - y0) / ch) + 1):
                grid.setdefault((gx, gy), []).append(k)
    seen, found = set(), 0
    for cell in grid.values():
        for ii in range(len(cell)):
            for jj in range(ii + 1, len(cell)):
                a, b = cell[ii], cell[jj]
                if (a, b) in seen:
                    continue
                seen.add((a, b))
                s, t = segs[a], segs[b]
                if s[0] == t[0] and (abs(s[1] - t[1]) <= 1 or abs(s[1] - t[1]) >= s[4] - 1):
                    continue  # neighbours in the same ring share an end point
                if segs_intersect(s[2], s[3], t[2], t[3]):
                    found += 1
                    if found >= limit:
                        return found
    return found


def point_in_ring(x, y, ring):
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def point_in_polygon(x, y, poly):
    """poly = [exterior, hole, hole...]"""
    if not point_in_ring(x, y, poly[0]):
        return False
    return not any(point_in_ring(x, y, h) for h in poly[1:])


def dist_to_rings_m(x, y, polys):
    mx, my = metres_per_deg(y)
    best = 1e18
    for poly in polys:
        for ring in poly:
            for i in range(len(ring) - 1):
                ax, ay = (ring[i][0] - x) * mx, (ring[i][1] - y) * my
                bx, by = (ring[i + 1][0] - x) * mx, (ring[i + 1][1] - y) * my
                dx, dy = bx - ax, by - ay
                L = dx * dx + dy * dy
                t = 0 if L == 0 else max(0, min(1, -(ax * dx + ay * dy) / L))
                best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best


def douglas_peucker(ring, tol_m):
    """Iterative Douglas-Peucker on a closed ring; keeps at least 4 positions (triangle + closing point)."""
    pts = ring[:-1]
    if len(pts) <= 3:
        return ring
    lat0 = sum(p[1] for p in pts) / len(pts)
    mx, my = metres_per_deg(lat0)
    xy = [(p[0] * mx, p[1] * my) for p in pts]
    # anchors: first point and the point farthest from it, so a ring is split into two open lines
    far = max(range(len(xy)), key=lambda i: (xy[i][0] - xy[0][0]) ** 2 + (xy[i][1] - xy[0][1]) ** 2)
    keep = {0, far}

    def run(lo, hi):  # open line xy[lo..hi] (hi may equal len(xy) meaning back to the start)
        stack = [(lo, hi)]
        while stack:
            a, b = stack.pop()
            pa, pb = xy[a % len(xy)], xy[b % len(xy)]
            dx, dy = pb[0] - pa[0], pb[1] - pa[1]
            L = math.hypot(dx, dy)
            worst, wi = -1.0, None
            for i in range(a + 1, b):
                px, py = xy[i % len(xy)]
                d = abs(dx * (py - pa[1]) - dy * (px - pa[0])) / L if L else math.hypot(px - pa[0], py - pa[1])
                if d > worst:
                    worst, wi = d, i
            if wi is not None and worst > tol_m:
                keep.add(wi % len(xy)); stack.append((a, wi)); stack.append((wi, b))
    run(0, far); run(far, len(xy))
    idx = sorted(keep)
    out = [pts[i] for i in idx]
    if len(out) < 3:
        return ring
    return out + [out[0]]


def orient(ring, ccw):
    return ring if (ring_area(ring) > 0) == ccw else ring[::-1]


def prepare(geom):
    """GeoJSON geometry -> list of polygons (each [exterior, holes...]) with cleaned, oriented rings + notes."""
    notes, polys = [], []
    raw = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    for poly in raw:
        rings = []
        for k, r in enumerate(poly):
            c = clean_ring(r, notes)
            if len(c) < 4 or abs(ring_area(c)) < 1e-14:
                notes.append('degenerate ring dropped'); continue
            rings.append(orient(c, ccw=(k == 0)))
        if rings:
            polys.append(rings)
    return polys, notes


def simplify_polys(polys, tol_m):
    """Simplify every ring; if a simplified ring crosses itself, retry with half the tolerance (reported)."""
    out, retried = [], 0
    for poly in polys:
        rings = []
        for k, ring in enumerate(poly):
            t = tol_m
            while True:
                s = douglas_peucker(ring, t)
                s = [(round(x, PRECISION), round(y, PRECISION)) for x, y in s]
                dedup = [s[0]] + [p for i, p in enumerate(s[1:], 1) if p != s[i - 1]]
                if dedup[0] != dedup[-1]:
                    dedup.append(dedup[0])
                if len(dedup) >= 4 and self_intersections([dedup], 1) == 0 and abs(ring_area(dedup)) > 0:
                    break
                t /= 2; retried += 1
                if t < 1:
                    dedup = [(round(x, PRECISION), round(y, PRECISION)) for x, y in ring]; break
            if len(dedup) >= 4 and (k == 0 or abs(ring_area(dedup)) * 1.0 > 0):
                rings.append(dedup)
        if rings:
            out.append(rings)
    return out, retried


def area_m2(polys):
    tot = 0.0
    for poly in polys:
        for k, ring in enumerate(poly):
            lat0 = sum(p[1] for p in ring) / len(ring); mx, my = metres_per_deg(lat0)
            tot += (1 if k == 0 else -1) * abs(ring_area(ring)) * mx * my
    return tot


def bbox(polys):
    xs = [p[0] for poly in polys for r in poly for p in r]; ys = [p[1] for poly in polys for r in poly for p in r]
    return [round(min(xs), PRECISION), round(min(ys), PRECISION), round(max(xs), PRECISION), round(max(ys), PRECISION)]


def encode_ring(ring):
    """Integers (degrees x 1e5), first point absolute, the rest as differences: small and exact after rounding."""
    q = [(round(x * 10 ** PRECISION), round(y * 10 ** PRECISION)) for x, y in ring[:-1]]
    flat, px, py = [], 0, 0
    for x, y in q:
        flat += [x - px, y - py]; px, py = x, y
    return flat


def encode(code, name, district, polys):
    return {'code': code, 'name_en': name, 'district': district, 'bbox': bbox(polys), 'rings': [[encode_ring(r) for r in poly] for poly in polys]}


def decode_ring(flat):
    pts, x, y = [], 0, 0
    for i in range(0, len(flat), 2):
        x += flat[i]; y += flat[i + 1]
        pts.append((x / 10 ** PRECISION, y / 10 ** PRECISION))
    return pts + [pts[0]]


def sizes(obj):
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    return len(raw), len(gzip.compress(raw, 9, mtime=0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip', required=True)
    ap.add_argument('--tolerance', type=float, default=100)
    ap.add_argument('--out-data', default=os.path.join(ROOT, 'src', 'data', 'pilot'))
    ap.add_argument('--report-json', default=os.path.join(ROOT, 'docs', 'reports', 'm1_2_pilot_results.json'))
    a = ap.parse_args()

    zf = zipfile.ZipFile(a.zip)
    zip_sha = hashlib.sha256(open(a.zip, 'rb').read()).hexdigest()
    gj = json.loads(zf.read('bgd_admin3.geojson').decode('utf-8'))
    master = json.load(open(os.path.join(ROOT, 'src', 'data', 'master_areas.json'), encoding='utf-8'))
    upz = {u['code']: u for u in master['upazilas']}
    feats = {f['properties']['adm3_pcode']: f for f in gj['features']}
    print('source features', len(feats), '| zip sha256', zip_sha)

    # ---- every polygon of the country: validity + size at each tolerance (measured here, nothing redistributed) ----
    national = {t: [0, 0] for t in TOLERANCES}
    nat_notes, nat_bad, nat_retry = {}, [], 0
    prepared = {}
    for code, f in feats.items():
        polys, notes = prepare(f['geometry'])
        prepared[code] = polys
        for n in set(notes):
            nat_notes[n] = nat_notes.get(n, 0) + 1
    for t in TOLERANCES:
        doc = {'features': []}
        for code, polys in prepared.items():
            s, r = simplify_polys(polys, t); nat_retry += r
            doc['features'].append(encode(code, feats[code]['properties']['adm3_name'], feats[code]['properties']['adm2_name'], s))
        national[t] = list(sizes(doc))
        print('national', t, 'm: raw', national[t][0], 'gzip', national[t][1])

    # ---- pilot polygons: validation + point-in-polygon ----
    unions = master['unions']
    by_parent = {}
    for u in unions:
        by_parent.setdefault(u['derived_upazila'], []).append(u)
    results = {}
    for code, why in PILOT.items():
        f = feats[code]; p = f['properties']
        full = prepared[code]
        flat_rings = [r for poly in full for r in poly]
        r = {'code': code, 'name': p['adm3_name'], 'district': p['adm2_name'], 'why': why, 'geometry': f['geometry']['type'],
             'polygons': len(full), 'rings': len(flat_rings), 'vertices_full': sum(len(x) for x in flat_rings),
             'valid_from_source': p['valid_on'], 'source_area_sqkm': p['area_sqkm'], 'self_intersections_full': self_intersections(flat_rings),
             'notes': sorted(set(prepare(f['geometry'])[1]))}
        # holes must be inside the exterior
        r['holes_outside'] = sum(1 for poly in full for h in poly[1:] if not point_in_ring(h[0][0], h[0][1], poly[0]))
        r['tolerances'] = {}
        for t in TOLERANCES:
            s, retried = simplify_polys(full, t)
            enc = encode(code, p['adm3_name'], p['adm2_name'], s)
            raw, gz = sizes(enc)
            # reference points: official BBS union points whose derived parent is this upazila (expected inside)
            exp = by_parent.get(code, [])
            inside = [pt for pt in exp if any(point_in_polygon(pt['lon'], pt['lat'], poly) for poly in s)]
            miss = [pt for pt in exp if pt not in inside]
            near = [pt for pt in miss if dist_to_rings_m(pt['lon'], pt['lat'], s) <= 500]
            # neighbours: points of other upazilas of the same district must not be inside (false positives)
            others = [pt for pt in unions if pt['derived_upazila'] != code and pt['code'][:6] == code[:6] and pt['derived_upazila'] in upz]
            fp = [pt for pt in others if any(point_in_polygon(pt['lon'], pt['lat'], poly) for poly in s)]
            fp_near = [pt for pt in fp if dist_to_rings_m(pt['lon'], pt['lat'], s) <= 500]
            ctr_in = any(point_in_polygon(p['center_lon'], p['center_lat'], poly) for poly in s)
            r['tolerances'][t] = {'vertices': sum(len(x) for poly in s for x in poly), 'raw_bytes': raw, 'gzip_bytes': gz,
                'area_change_pct': round(100 * (area_m2(s) - area_m2(full)) / area_m2(full), 3), 'retried_rings': retried,
                'self_intersections': self_intersections([x for poly in s for x in poly]),
                'expected_points': len(exp), 'inside': len(inside), 'outside': len(miss), 'outside_within_500m': len(near),
                'other_upazila_points_inside': len(fp), 'of_which_within_500m_of_border': len(fp_near), 'centre_in_polygon': ctr_in}
            if t == a.tolerance:
                r['_chosen'] = s
        results[code] = r

    # ---- write the pilot data file (only the chosen tolerance) ----
    os.makedirs(a.out_data, exist_ok=True)
    meta = {
        'purpose': 'M1.2 technical pilot only. Not used by the site. Upazila boundaries, NOT union boundaries.',
        'source': 'Bangladesh Bureau of Statistics (BBS) administrative boundaries COD-AB v03, via OCHA / UN Humanitarian Data Exchange',
        'source_url': 'https://data.humdata.org/dataset/cod-ab-bgd',
        'file': 'bgd_admin_boundaries.geojson.zip / bgd_admin3.geojson', 'zip_sha256': zip_sha,
        'boundaries_valid_on': '2023-05-21', 'licence': 'CC BY-IGO (Creative Commons Attribution for Intergovernmental Organisations)',
        'licence_url': 'https://creativecommons.org/licenses/by/3.0/igo/',
        'attribution': 'Contains BBS administrative boundaries (COD-AB v03) distributed by OCHA through HDX under CC BY-IGO.',
        'modification_notice': f'Simplified (Douglas-Peucker, {a.tolerance:g} m), coordinates rounded to {PRECISION} decimals and delta-encoded. Not the original data.',
        'encoding': f'ring = flat list of integers, degrees x 10^{PRECISION}; first pair absolute, then differences; ring closes to its first point. rings[0] of each polygon is the exterior, the rest are holes.',
        'scale': 10 ** PRECISION, 'tolerance_m': a.tolerance, 'result_use': 'nearest-upazila answer only; say "inside the upazila boundary", never "exact union".',
    }
    doc = {'meta': meta, 'features': [encode(c, r['name'], r['district'], r['_chosen']) for c, r in results.items()]}
    path = os.path.join(a.out_data, 'upazila_polygons_pilot.json')
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
    for r in results.values():
        r.pop('_chosen', None)
    raw, gz = sizes(doc)
    out = {'zip_sha256': zip_sha, 'chosen_tolerance_m': a.tolerance, 'pilot_file': 'src/data/pilot/upazila_polygons_pilot.json', 'pilot_raw_bytes': raw, 'pilot_gzip_bytes': gz,
           'national_sizes_bytes_raw_gzip': {str(k): v for k, v in national.items()}, 'national_notes': nat_notes, 'pilot': results}
    os.makedirs(os.path.dirname(a.report_json), exist_ok=True)
    json.dump(out, open(a.report_json, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    print('wrote', path, raw, 'raw', gz, 'gzip')


if __name__ == '__main__':
    sys.exit(main())
