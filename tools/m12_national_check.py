"""M1.2: how well do official BBS union points agree with the (simplified) upazila polygon of their DERIVED parent?
Measured on all upazila polygons, locally; nothing is written to the repo except the printed summary.
Run: python tools/m12_national_check.py --zip PATH/bgd_admin_boundaries.geojson.zip
A point outside its derived parent is not proof of an error: the 2020 points and 2023 boundaries differ, and the parent is derived."""
import argparse, json, os, sys, zipfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m12_polygon_pilot as P

ap = argparse.ArgumentParser(); ap.add_argument('--zip', required=True); a = ap.parse_args()
gj = json.loads(zipfile.ZipFile(a.zip).read('bgd_admin3.geojson').decode('utf-8'))
master = json.load(open(os.path.join(P.ROOT, 'src', 'data', 'master_areas.json'), encoding='utf-8'))
prep = {f['properties']['adm3_pcode']: P.prepare(f['geometry'])[0] for f in gj['features']}
for tol in P.TOLERANCES:
    simp = {c: P.simplify_polys(p, tol)[0] for c, p in prep.items()}
    boxes = {c: P.bbox(p) for c, p in simp.items()}
    tot = inside = near = far = none = 0
    for u in master['unions']:
        c = u['derived_upazila']
        if c not in simp:
            none += 1; continue
        tot += 1
        if any(P.point_in_polygon(u['lon'], u['lat'], p) for p in simp[c]):
            inside += 1
        elif P.dist_to_rings_m(u['lon'], u['lat'], simp[c]) <= 500:
            near += 1
        else:
            far += 1
    print(f'{tol} m: points {tot}, inside derived parent {inside} ({100*inside/tot:.1f}%), outside but within 500 m {near}, outside by more than 500 m {far}, no polygon for parent {none}')
