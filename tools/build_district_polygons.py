"""M1.2 stage A: national per-district polygon layers from the verified BBS COD-AB v03 (OCHA HDX, CC BY-IGO) source.

Reads the downloaded geojson zip (all 507 level-3 units: 495 upazilas + 12 city corporations) and src/data/master_areas.json
(official BBS union points, derived upazila parent). Writes src/data/polygons/<district code>.json (64 files) and
src/data/polygons/index.json, plus docs/reports/m1_2_district_layers.json (sizes, coverage, agreement). Python standard library only.

Nothing is invented: a unit without a polygon in the source gets NO polygon (see "not_in_source" in index.json) and the
site must use the district fallback. A union point inside an upazila polygon says "probably in this upazila"; it is not a union boundary.

Run: python tools/build_district_polygons.py --zip PATH/bgd_admin_boundaries.geojson.zip [--tolerance 110]
"""
import argparse, gzip, hashlib, json, os, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import m12_polygon_pilot as P  # geometry helpers: prepare, simplify_polys, encode, bbox, sizes ...
import m12_topology as TOPO     # shared borders are simplified once, so neighbours leave no gaps or overlaps (M1.2 T2)

ROOT = P.ROOT
# Reported by news only (see docs/reports/M1_2_POLYGON_PILOT.md): NOT in the 2023 source, no polygon, district fallback.
NOT_IN_SOURCE = [
    {'name_en': 'Chandraganj', 'district_en': 'Lakshmipur', 'reported': '2026-06', 'evidence': 'news report only; gazette not opened'},
    {'name_en': 'Fatikchhari Uttar', 'district_en': 'Chattogram', 'reported': '2026-07', 'evidence': 'news report only; gazette not opened'},
    {'name_en': 'Dakshin Gafargaon', 'district_en': 'Mymensingh', 'reported': '2026-07', 'evidence': 'news report only; gazette not opened'},
    {'name_en': 'Bangra', 'district_en': 'Cumilla', 'reported': '2026-07', 'evidence': 'news report only; gazette not opened'},
]
KIND = {'union': 'u', 'pourashava': 'p', 'ward': 'w'}


def round_polys(polys):
    """Round to the file precision. Both sides of a shared border hold identical points, so they still match."""
    out = []
    for poly in polys:
        rings = []
        for k, ring in enumerate(poly):
            q = [(round(x, P.PRECISION), round(y, P.PRECISION)) for x, y in ring[:-1]]
            q = [p for i, p in enumerate(q) if i == 0 or p != q[i - 1]]
            if len(q) > 1 and q[0] == q[-1]:
                q.pop()
            q.append(q[0])
            if len(q) >= 4 and abs(P.ring_area(q)) > 0:
                rings.append(q)
            elif k == 0:
                rings = []; break
        if rings:
            out.append(rings)
    return out


def r6(v):
    return round(float(v), 5)  # about 1 m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip', required=True)
    ap.add_argument('--tolerance', type=float, default=110)
    ap.add_argument('--out', default=os.path.join(ROOT, 'src', 'data', 'polygons'))
    ap.add_argument('--report', default=os.path.join(ROOT, 'docs', 'reports', 'm1_2_district_layers.json'))
    a = ap.parse_args()

    zip_sha = hashlib.sha256(open(a.zip, 'rb').read()).hexdigest()
    gj = json.loads(zipfile.ZipFile(a.zip).read('bgd_admin3.geojson').decode('utf-8'))
    M = json.load(open(os.path.join(ROOT, 'src', 'data', 'master_areas.json'), encoding='utf-8'))
    upz = {u['code']: u for u in M['upazilas']}
    dis = {d['code']: d for d in M['districts']}
    feats = {f['properties']['adm3_pcode']: f for f in gj['features']}
    missing_in_source = sorted(set(upz) - set(feats))     # master unit without a polygon
    extra_in_source = sorted(set(feats) - set(upz))       # polygon without a master unit
    print('source polygons', len(feats), '| master upazila-level units', len(upz), '| master without polygon', len(missing_in_source), '| polygon without master', len(extra_in_source))

    meta = {
        'purpose': 'Upazila (and city corporation) boundaries for one district, plus official BBS union centre points. NOT union boundaries.',
        'source': 'Bangladesh Bureau of Statistics (BBS) administrative boundaries COD-AB v03, via OCHA / UN Humanitarian Data Exchange',
        'source_url': 'https://data.humdata.org/dataset/cod-ab-bgd', 'file': 'bgd_admin_boundaries.geojson.zip / bgd_admin3.geojson',
        'zip_sha256': zip_sha, 'boundaries_valid_on': '2023-05-21', 'retrieved_on': '2026-11-27',
        'licence': 'CC BY-IGO (Creative Commons Attribution for Intergovernmental Organisations)',
        'licence_url': 'https://creativecommons.org/licenses/by/3.0/igo/',
        'attribution': 'Contains BBS administrative boundaries (COD-AB v03) distributed by OCHA through HDX under CC BY-IGO.',
        'modification_notice': f'Simplified (Douglas-Peucker, {a.tolerance:g} m), coordinates rounded to {P.PRECISION} decimals and delta-encoded; grouped by district. Not the original data.',
        'union_points': 'Union centre points: BBS COD-AB v03 point table dated 2020-11-13 (same source, same licence). The parent upazila (field p) is DERIVED from the 2020 code, not an official 2023 link.',
        'encoding': f'ring = flat list of integers, degrees x {10 ** P.PRECISION}; first pair absolute, then differences; closes to its first point. rings[0] of each polygon is the exterior, the rest are holes.',
        'scale': 10 ** P.PRECISION, 'tolerance_m': a.tolerance,
        'use': 'Say "inside the boundary of upazila X" and "nearest union centre". Never "exact union": no union boundary exists in the official data.',
    }
    # every layer keeps the attribution, licence and modification notice; the long explanations live once in index.json
    short = {k: meta[k] for k in ('source', 'source_url', 'licence', 'attribution', 'modification_notice', 'boundaries_valid_on', 'zip_sha256', 'scale', 'tolerance_m')}
    by_dis = {}
    for code, f in feats.items():
        by_dis.setdefault(f['properties']['adm2_pcode'], []).append(code)
    unions_by_dis = {}
    for u in M['unions']:
        unions_by_dis.setdefault(u['code'][:6], []).append(u)
    os.makedirs(a.out, exist_ok=True)
    for old in os.listdir(a.out):
        if old.endswith('.json'):
            os.remove(os.path.join(a.out, old))

    index, rep = [], {}
    tot = {'raw': 0, 'gzip': 0, 'unions': 0, 'union_no_coord': 0, 'retried': 0}
    prepared = {c: P.prepare(f['geometry'])[0] for c, f in feats.items()}
    shared, topo = TOPO.simplify_shared(prepared, a.tolerance)
    print('shared-border simplification:', topo)
    for dcode in sorted(dis):
        d = dis[dcode]
        codes = sorted(by_dis.get(dcode, []))
        uf, dbox, problems = [], [], []
        for c in codes:
            simp = round_polys(shared[c])
            tot['retried'] = topo['retried_rings']
            flat = [r for poly in simp for r in poly]
            if P.self_intersections(flat) or not flat:
                problems.append(f'{c}: invalid after simplification')
            m = upz[c]
            e = P.encode(c, m['name_en'], d['name_en'], simp)
            e.pop('district')
            e['name_bn'] = m.get('name_bn') or ''
            e['kind'] = 'city_corporation' if m['kind'] == 'city_corporation' else 'upazila'
            e['lp'] = (m['legacy']['code'][6:8] if m.get('legacy') else '')
            uf.append(e); dbox.append(e['bbox'])
        pts, nocoord = [], 0
        for u in unions_by_dis.get(dcode, []):
            try:
                lat, lon = r6(u['lat']), r6(u['lon'])
                assert -90 <= lat <= 90 and -180 <= lon <= 180
            except (TypeError, ValueError, AssertionError, KeyError):
                nocoord += 1; continue
            pts.append([u['code'], u['name_en'], u.get('name_bn') or '', lat, lon, KIND.get(u.get('kind_hint'), 'u'), u['code'][6:8]])
        # agreement of union points with the polygon of their derived parent (informational, per district)
        dec = {e['code']: [[P.decode_ring(r) for r in poly] for poly in e['rings']] for e in uf}
        by_lp = {e['lp']: e['code'] for e in uf if e['lp']}
        inside = outside = 0
        for p in pts:
            c = by_lp.get(p[6])
            if c is None:
                continue
            if any(P.point_in_polygon(p[4], p[3], poly) for poly in dec[c]):
                inside += 1
            else:
                outside += 1
        doc = {'meta': short, 'district': {'code': dcode, 'name_en': d['name_en'], 'name_bn': d.get('name_bn') or ''},
               'upazilas': uf, 'unions': pts}
        raw, gz = P.sizes(doc)
        with open(os.path.join(a.out, dcode + '.json'), 'w', encoding='utf-8', newline='\n') as fh:
            json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
        ub = P.sizes({'unions': pts})
        box = [min(b[0] for b in dbox), min(b[1] for b in dbox), max(b[2] for b in dbox), max(b[3] for b in dbox)] if dbox else None
        index.append({'code': dcode, 'name_en': d['name_en'], 'name_bn': d.get('name_bn') or '', 'file': f'data/polygons/{dcode}.json', 'bbox': box, 'upazilas': len(uf), 'unions': len(pts)})
        rep[dcode] = {'name': d['name_en'], 'upazila_polygons': len(uf), 'master_upazila_units': sum(1 for u in upz.values() if u['district'] == dcode),
                      'union_points': len(pts), 'union_points_without_coordinates': nocoord, 'raw_bytes': raw, 'gzip_bytes': gz,
                      'union_points_raw_bytes': ub[0], 'points_inside_derived_parent': inside, 'points_outside_derived_parent': outside, 'problems': problems}
        tot['raw'] += raw; tot['gzip'] += gz; tot['unions'] += len(pts); tot['union_no_coord'] += nocoord
    idx_doc = {'meta': meta, 'union_fields': ['code', 'name_en', 'name_bn', 'lat', 'lon', 'kind (u union, p pourashava, w ward)', 'lp (2-digit 2020 upazila code = derived parent)'],
               'divisions': [{'code': v['code'], 'name_en': v['name_en'], 'name_bn': v.get('name_bn') or ''} for v in sorted(M['divisions'], key=lambda v: v['code'])], 'districts': index, 'not_in_source': NOT_IN_SOURCE,
               'fallback_rule': 'A position in an area with no polygon (new 2026 upazilas, sea, outside Bangladesh) gets no upazila answer: use the district / upazila-centre fallback. No boundary is ever invented.'}
    with open(os.path.join(a.out, 'index.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(idx_doc, fh, ensure_ascii=False, separators=(',', ':'))
    iraw, igz = P.sizes(idx_doc)
    out = {'zip_sha256': zip_sha, 'tolerance_m': a.tolerance, 'source_polygons': len(feats), 'master_units': len(upz),
           'master_units_without_polygon': missing_in_source, 'polygons_without_master_unit': extra_in_source,
           'districts': len(index), 'index_raw_bytes': iraw, 'index_gzip_bytes': igz, 'total_layers_raw_bytes': tot['raw'], 'total_layers_gzip_bytes': tot['gzip'],
           'total_union_points': tot['unions'], 'union_points_without_coordinates': tot['union_no_coord'], 'rings_retried': tot['retried'], 'shared_border_arcs': topo['arcs'], 'arcs_shared_by_two_units': topo['shared_arcs'],
           'largest_raw': max(rep.items(), key=lambda kv: kv[1]['raw_bytes'])[0], 'largest_gzip': max(rep.items(), key=lambda kv: kv[1]['gzip_bytes'])[0], 'per_district': rep}
    json.dump(out, open(a.report, 'w', encoding='utf-8', newline='\n'), indent=1, ensure_ascii=False)
    bad = [c for c, r in rep.items() if r['problems']]
    print('districts', len(index), '| total raw', tot['raw'], 'gzip', tot['gzip'], '| index', iraw, igz, '| union points', tot['unions'], '| problems', bad or 'none')
    return 1 if bad or missing_in_source else 0


if __name__ == '__main__':
    sys.exit(main())
