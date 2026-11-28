"""M1.2 stage A tests: the 64 national per-district polygon layers (src/data/polygons).
Run: python -m unittest discover -s tests/polygons -v   (needs only the repo, not the 50 MB source)."""
import gzip, json, os, sys, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import m12_polygon_pilot as P  # noqa: E402

DIR = os.path.join(ROOT, 'src', 'data', 'polygons')
INDEX = json.load(open(os.path.join(DIR, 'index.json'), encoding='utf-8'))
MASTER = json.load(open(os.path.join(ROOT, 'src', 'data', 'master_areas.json'), encoding='utf-8'))
LAYERS = {d['code']: json.load(open(os.path.join(ROOT, 'src', d['file']), encoding='utf-8')) for d in INDEX['districts']}
raw = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def polys(u):
    return [[P.decode_ring(r) for r in poly] for poly in u['rings']]


class Coverage(unittest.TestCase):
    def test_all_64_districts_and_8_divisions(self):
        self.assertEqual(len(INDEX['districts']), 64)
        self.assertEqual({d['code'] for d in INDEX['districts']}, {d['code'] for d in MASTER['districts']})
        self.assertEqual(len({d['code'][:4] for d in MASTER['districts']}), 8)
        for d in INDEX['districts']:
            self.assertTrue(os.path.isfile(os.path.join(ROOT, 'src', d['file'])), d['file'])

    def test_every_master_upazila_level_unit_has_exactly_one_polygon(self):
        seen = [u['code'] for l in LAYERS.values() for u in l['upazilas']]
        self.assertEqual(len(seen), len(set(seen)), 'a unit appears in two layers')
        self.assertEqual(set(seen), {u['code'] for u in MASTER['upazilas']})
        self.assertEqual(len(seen), 507)

    def test_each_unit_is_in_the_layer_of_its_district(self):
        by = {u['code']: u for u in MASTER['upazilas']}
        for code, l in LAYERS.items():
            for u in l['upazilas']:
                self.assertEqual(by[u['code']]['district'], code)

    def test_2026_upazilas_have_no_polygon_and_are_listed_as_fallback(self):
        names = {x['name_en'] for x in INDEX['not_in_source']}
        self.assertTrue({'Chandraganj', 'Fatikchhari Uttar', 'Dakshin Gafargaon', 'Bangra'} <= names)
        for x in INDEX['not_in_source']:
            self.assertIn('news report only', x['evidence'])
        layer_names = {u['name_en'] for l in LAYERS.values() for u in l['upazila' + 's']}
        for n in ('Fatikchhari Uttar', 'Dakshin Gafargaon', 'Bangra'):
            self.assertNotIn(n, layer_names, 'a polygon was invented for ' + n)
        self.assertIn('No boundary is ever invented', INDEX['fallback_rule'])

    def test_index_counts_and_boxes_match_the_layers(self):
        for d in INDEX['districts']:
            l = LAYERS[d['code']]
            self.assertEqual(d['upazilas'], len(l['upazilas'])); self.assertEqual(d['unions'], len(l['unions']))
            b = [u['bbox'] for u in l['upazilas']]
            self.assertEqual(d['bbox'], [min(x[0] for x in b), min(x[1] for x in b), max(x[2] for x in b), max(x[3] for x in b)])


class Metadata(unittest.TestCase):
    def test_every_layer_keeps_source_licence_attribution_and_modification_notice(self):
        for code, l in LAYERS.items():
            m = l['meta']
            for k in ('source', 'source_url', 'licence', 'attribution', 'modification_notice', 'boundaries_valid_on', 'zip_sha256', 'scale'):
                self.assertTrue(m.get(k), f'{code} {k}')
            self.assertIn('CC BY-IGO', m['licence']); self.assertIn('Simplified', m['modification_notice']); self.assertIn('110', m['modification_notice'])
        for k in ('licence_url', 'union_points', 'use'):
            self.assertTrue(INDEX['meta'].get(k), k)
        self.assertIn('Never "exact union"', INDEX['meta']['use'])


class Validity(unittest.TestCase):
    def test_every_ring_is_valid(self):
        n = 0
        for code, l in LAYERS.items():
            for u in l['upazilas']:
                w, s, e, nn = u['bbox']
                for poly in polys(u):
                    n += 1
                    self.assertGreaterEqual(len(poly[0]), 4, u['code'])
                    self.assertGreater(P.ring_area(poly[0]), 0, f"{u['code']} exterior must be counter-clockwise")
                    self.assertEqual(P.self_intersections(poly), 0, f"{u['code']} {u['name_en']}")
                    for ring in poly:
                        self.assertEqual(ring[0], ring[-1])
                        for x, y in ring:
                            self.assertTrue(w - 1e-9 <= x <= e + 1e-9 and s - 1e-9 <= y <= nn + 1e-9)
                    for h in poly[1:]:
                        self.assertTrue(P.point_in_ring(h[0][0], h[0][1], poly[0]))
        self.assertGreaterEqual(n, 507)

    def test_polygons_are_inside_bangladesh(self):
        for l in LAYERS.values():
            for u in l['upazilas']:
                w, s, e, n = u['bbox']
                self.assertTrue(88 <= w and e <= 93 and 20 <= s and n <= 27, u['name_en'])


class Sizes(unittest.TestCase):
    def test_budgets(self):
        total = len(raw(INDEX)) + sum(len(raw(l)) for l in LAYERS.values())
        self.assertLess(total, 1_300_000, 'new always-cached data must stay under the approved 1.3 MB raw')
        self.assertLess(max(len(gzip.compress(raw(l), 9)) for l in LAYERS.values()), 150_000, 'per-district layer gzip budget')
        unions_raw = sum(len(raw({'unions': l['unions']})) for l in LAYERS.values())
        self.assertLess(unions_raw, 400_000, 'union points budget')


class UnionPoints(unittest.TestCase):
    def test_all_5160_points_present_with_coordinates_in_their_district(self):
        total = 0
        for code, l in LAYERS.items():
            for row in l['unions']:
                total += 1
                self.assertEqual(len(row), 7); self.assertEqual(row[0][2:6], code[2:6])
                self.assertTrue(isinstance(row[3], float) and isinstance(row[4], float) and 20 <= row[3] <= 27 and 88 <= row[4] <= 93, row[0])
        self.assertEqual(total, 5160)

    def test_agreement_with_derived_parent_is_reported_honestly(self):
        """Informational floor, NOT proof: about 96 % of points sit in the polygon of their derived parent upazila."""
        inside = outside = 0
        for l in LAYERS.values():
            by_lp = {u['lp']: u for u in l['upazilas'] if u['lp']}
            for row in l['unions']:
                u = by_lp.get(row[6])
                if not u:
                    continue
                if any(P.point_in_polygon(row[4], row[3], p) for p in polys(u)):
                    inside += 1
                else:
                    outside += 1
        self.assertGreater(inside / (inside + outside), 0.95)
        self.assertGreater(outside, 0, 'some points really do disagree (2020 points vs 2023 boundaries); do not hide it')


if __name__ == '__main__':
    unittest.main()
