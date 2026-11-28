"""M1.2 T2: gaps and overlaps between the 507 upazila / city-corporation polygons in src/data/polygons (100 m layers).

Method (standard library only, no GEOS): a grid of square cells (--step degrees; 0.05 on pull requests, 0.002 on release)
is covered by every polygon with an even-odd scanline fill, counting how many polygons cover each cell centre.
  overlap = a cell centre covered by 2 or more polygons (reported with the units involved and the area)
  gap     = a cell centre covered by none that cannot be reached from outside Bangladesh through other uncovered cells
            (an enclosed hole: a missing unit or a hole in the map; the sea and rivers open to the sea are not gaps)
Findings are REPORTED, never repaired: no official field or boundary is changed here.

Run: python tools/m12_t2_check.py [--step 0.01] [--json out.json] [--zip bgd_admin_boundaries.geojson.zip  (original polygons instead of the layers)]
"""
import argparse, json, math, os, sys
from collections import Counter, deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIR = os.path.join(ROOT, 'src', 'data', 'polygons')


def decode(flat, scale):
    pts, x, y = [], 0, 0
    for i in range(0, len(flat), 2):
        x += flat[i]; y += flat[i + 1]; pts.append((x / scale, y / scale))
    return pts + [pts[0]]


def load_units_from_zip(path):
    """The ORIGINAL (unsimplified) BBS polygons, to tell source problems from simplification problems."""
    import zipfile
    sys.path.insert(0, HERE)
    import m12_polygon_pilot as P
    gj = json.loads(zipfile.ZipFile(path).read('bgd_admin3.geojson').decode('utf-8'))
    return [{'code': f['properties']['adm3_pcode'], 'name': f['properties']['adm3_name'], 'district': f['properties']['adm2_name'], 'polys': P.prepare(f['geometry'])[0]} for f in gj['features']]


def load_units():
    units = []
    for d in json.load(open(os.path.join(DIR, 'index.json'), encoding='utf-8'))['districts']:
        doc = json.load(open(os.path.join(ROOT, 'src', d['file']), encoding='utf-8'))
        scale = doc['meta']['scale']
        for u in doc['upazilas']:
            units.append({'code': u['code'], 'name': u['name_en'], 'district': doc['district']['name_en'],
                          'polys': [[decode(r, scale) for r in poly] for poly in u['rings']]})
    return units


def run(step, zip_path=None):
    units = load_units_from_zip(zip_path) if zip_path else load_units()
    xs = [p[0] for u in units for poly in u['polys'] for r in poly for p in r]; ys = [p[1] for u in units for poly in u['polys'] for r in poly for p in r]
    x0, y0 = math.floor(min(xs) / step) * step - step, math.floor(min(ys) / step) * step - step
    W, H = int((max(xs) - x0) / step) + 3, int((max(ys) - y0) / step) + 3
    count = bytearray(W * H)
    owner = {}                                   # cell index -> first unit index (to name overlap pairs)
    pairs = Counter(); over_cells = 0
    for ui, u in enumerate(units):
        for poly in u['polys']:
            edges = [(r[i], r[i + 1]) for r in poly for i in range(len(r) - 1)]
            rows = {}
            for (ax, ay), (bx, by) in edges:
                if ay == by:
                    continue
                lo, hi = (ay, by) if ay < by else (by, ay)
                j0, j1 = max(0, math.ceil((lo - y0) / step - 0.5)), min(H - 1, math.ceil((hi - y0) / step - 0.5) - 1)
                for j in range(j0, j1 + 1):
                    cy = y0 + (j + 0.5) * step
                    rows.setdefault(j, []).append(ax + (cy - ay) * (bx - ax) / (by - ay))
            for j, cross in rows.items():
                cross.sort()
                for k in range(0, len(cross) - 1, 2):
                    i0, i1 = max(0, math.ceil((cross[k] - x0) / step - 0.5)), min(W - 1, math.ceil((cross[k + 1] - x0) / step - 0.5) - 1)
                    for i in range(i0, i1 + 1):
                        c = j * W + i
                        if count[c] == 0:
                            count[c] = 1; owner[c] = ui
                        elif owner.get(c) != ui:
                            if count[c] < 255: count[c] += 1
                            over_cells += 1
                            pairs[tuple(sorted((owner[c], ui)))] += 1
    # exterior flood fill over uncovered cells from the border
    seen = bytearray(W * H); dq = deque()
    for i in range(W):
        for j in (0, H - 1):
            dq.append(j * W + i)
    for j in range(H):
        for i in (0, W - 1):
            dq.append(j * W + i)
    while dq:
        c = dq.popleft()
        if seen[c] or count[c]:
            continue
        seen[c] = 1
        i, j = c % W, c // W
        for ni, nj in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
            if 0 <= ni < W and 0 <= nj < H and not seen[nj * W + ni] and not count[nj * W + ni]:
                dq.append(nj * W + ni)
    holes = [c for c in range(W * H) if not count[c] and not seen[c]]
    cell_km2 = (step * 111.32 * math.cos(math.radians(23.7))) * (step * 110.57)
    # hole components
    comp, hs = [], set(holes)
    while hs:
        s = hs.pop(); q = [s]; n = 0; sx = sy = 0
        while q:
            c = q.pop(); n += 1; sx += c % W; sy += c // W
            i, j = c % W, c // W
            for nb in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                cc = nb[1] * W + nb[0]
                if cc in hs: hs.discard(cc); q.append(cc)
        comp.append({'cells': n, 'km2': round(n * cell_km2, 2), 'lon': round(x0 + (sx / n + 0.5) * step, 4), 'lat': round(y0 + (sy / n + 0.5) * step, 4)})
    covered = sum(1 for v in count if v)
    top = [{'a': f"{units[a]['name']} ({units[a]['district']})", 'b': f"{units[b]['name']} ({units[b]['district']})", 'km2': round(n * cell_km2, 2)} for (a, b), n in pairs.most_common(10)]
    return {'step_deg': step, 'units': len(units), 'covered_km2': round(covered * cell_km2, 1), 'overlap_cells': over_cells, 'overlap_km2': round(over_cells * cell_km2, 2),
            'overlap_pairs': len(pairs), 'worst_overlaps': top, 'gap_components': len(comp), 'gap_km2': round(len(holes) * cell_km2, 2),
            'worst_gaps': sorted(comp, key=lambda g: -g['cells'])[:10]}


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--step', type=float, default=0.01); ap.add_argument('--json'); ap.add_argument('--zip', help='check the original source polygons instead of the 100 m layers')
    a = ap.parse_args()
    r = run(a.step, a.zip)
    print(json.dumps({k: v for k, v in r.items() if k not in ('worst_overlaps', 'worst_gaps')}))
    for o in r['worst_overlaps'][:5]: print('overlap', o)
    for g in r['worst_gaps'][:5]: print('gap', g)
    if a.json:
        json.dump(r, open(a.json, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
