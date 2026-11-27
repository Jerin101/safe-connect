"""M1.2 pilot tests: geometry helpers, the pilot file (licence notice, size, validity) and point-in-polygon on official BBS points.
Run: python -m unittest discover -s tests/polygons -v   (needs only the repo; the big source zip is NOT needed)."""
import gzip, json, os, sys, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import m12_polygon_pilot as P  # noqa: E402

PILOT = json.load(open(os.path.join(ROOT, 'src', 'data', 'pilot', 'upazila_polygons_pilot.json'), encoding='utf-8'))
MASTER = json.load(open(os.path.join(ROOT, 'src', 'data', 'master_areas.json'), encoding='utf-8'))
SQUARE = [(0, 0), (4, 0), (4, 4), (0, 4), (0, 0)]
HOLE = [(1, 1), (1, 3), (3, 3), (3, 1), (1, 1)]


def decoded(feature):
    return [[P.decode_ring(r) for r in poly] for poly in feature['rings']]


class Geometry(unittest.TestCase):
    def test_point_in_polygon_with_hole(self):
        poly = [SQUARE, HOLE]
        self.assertTrue(P.point_in_polygon(0.5, 0.5, poly))
        self.assertFalse(P.point_in_polygon(2, 2, poly), 'inside the hole is outside')
        self.assertFalse(P.point_in_polygon(5, 5, poly))

    def test_bowtie_is_detected_and_square_is_not(self):
        self.assertEqual(P.self_intersections([[(0, 0), (2, 2), (2, 0), (0, 2), (0, 0)]]), 1)
        self.assertEqual(P.self_intersections([SQUARE]), 0)

    def test_repair_closes_ring_and_drops_repeats(self):
        notes = []
        r = P.clean_ring([(0, 0), (0, 0), (1, 0), (1, 1), (0, 1)], notes)
        self.assertEqual(r[0], r[-1]); self.assertIn('ring closed', notes); self.assertIn('repeated point dropped', notes)

    def test_orientation(self):
        self.assertGreater(P.ring_area(P.orient(SQUARE[::-1], True)), 0)
        self.assertLess(P.ring_area(P.orient(SQUARE, False)), 0)

    def test_simplify_keeps_corners_and_drops_tiny_wiggles(self):
        wig = [(0, 0), (0.5, 0.00001), (1, 0), (1, 1), (0, 1), (0, 0)]
        s = P.douglas_peucker(wig, 50)
        self.assertEqual(len(s), 5); self.assertEqual(s[0], s[-1])

    def test_encode_decode_roundtrip(self):
        ring = [(90.12345, 22.54321), (90.2, 22.6), (90.3, 22.5), (90.12345, 22.54321)]
        back = P.decode_ring(P.encode_ring(ring))
        self.assertEqual([(round(x, 5), round(y, 5)) for x, y in back], [(round(x, 5), round(y, 5)) for x, y in ring])


class PilotFile(unittest.TestCase):
    def test_meta_has_source_licence_attribution_and_modification_notice(self):
        m = PILOT['meta']
        for k in ('source', 'source_url', 'zip_sha256', 'boundaries_valid_on', 'licence', 'licence_url', 'attribution', 'modification_notice', 'scale'):
            self.assertTrue(m.get(k), k)
        self.assertIn('CC BY-IGO', m['licence']); self.assertIn('Simplified', m['modification_notice'])
        self.assertIn('NOT union', m['purpose'])

    def test_five_pilot_upazilas_exist_in_master_and_are_distinct(self):
        codes = [f['code'] for f in PILOT['features']]
        self.assertEqual(sorted(codes), sorted(P.PILOT))
        known = {u['code']: u for u in MASTER['upazilas']}
        for f in PILOT['features']:
            self.assertEqual(known[f['code']]['name_en'], f['name_en'])

    def test_size_budget(self):
        raw = json.dumps(PILOT, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        self.assertLess(len(raw), 20_000); self.assertLess(len(gzip.compress(raw, 9)), 10_000)

    def test_rings_are_valid(self):
        for f in PILOT['features']:
            for poly in decoded(f):
                self.assertTrue(len(poly[0]) >= 4)
                for ring in poly:
                    self.assertEqual(ring[0], ring[-1]); self.assertNotEqual(P.ring_area(ring), 0)
                self.assertEqual(P.self_intersections(poly), 0, f['name_en'])
                self.assertGreater(P.ring_area(poly[0]), 0, 'exterior counter-clockwise')
                for h in poly[1:]:
                    self.assertTrue(P.point_in_ring(h[0][0], h[0][1], poly[0]))

    def test_bbox_covers_every_vertex(self):
        for f in PILOT['features']:
            w, s, e, n = f['bbox']
            for poly in decoded(f):
                for ring in poly:
                    for x, y in ring:
                        self.assertTrue(w - 1e-9 <= x <= e + 1e-9 and s - 1e-9 <= y <= n + 1e-9)


class PointInPolygon(unittest.TestCase):
    """Reference points = official BBS 2020 union points whose derived parent is the pilot upazila (derived, not official)."""
    def test_official_union_points_fall_in_their_upazila(self):
        for f in PILOT['features']:
            polys = decoded(f)
            pts = [u for u in MASTER['unions'] if u['derived_upazila'] == f['code']]
            if not pts:
                continue  # new upazila with no 2020 point code: nothing to compare, and that is reported, not hidden
            inside = [u for u in pts if any(P.point_in_polygon(u['lon'], u['lat'], p) for p in polys)]
            self.assertEqual(len(inside), len(pts), f"{f['name_en']}: {len(pts) - len(inside)} reference point(s) outside")

    def test_points_of_far_upazilas_are_not_inside(self):
        for f in PILOT['features']:
            polys = decoded(f)
            far = [u for u in MASTER['unions'] if u['code'][:4] != f['code'][:4]][:3000]
            self.assertFalse([u for u in far if any(P.point_in_polygon(u['lon'], u['lat'], p) for p in polys)], f['name_en'])

    def test_unresolved_unions_are_not_claimed(self):
        # Eidgaon has no 2020 code: its unions are still filed under the old upazila, so none may be linked to it here.
        eid = [u for u in MASTER['unions'] if u['derived_upazila'] == 'BD20220032']
        self.assertEqual(eid, [])


if __name__ == '__main__':
    unittest.main()
