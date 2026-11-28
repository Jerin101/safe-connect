"""M1.2 T2: no gaps and no overlaps between neighbouring upazila polygons (shared borders are simplified once).
Run: python -m unittest discover -s tests/polygons -v
Why these numbers: simplifying every polygon on its own gave 97.6 km2 of overlap (864 pairs) and 107 km2 in 2,004 small gaps at 0.002 deg;
with shared borders the layers have 0.09 km2 of overlap and about the same few enclosed holes as the original BBS polygons (~6-8 km2)."""
import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'tools'))
import m12_t2_check as T2  # noqa: E402


class GapsAndOverlaps(unittest.TestCase):
    def test_pull_request_grid_0_05(self):
        r = T2.run(0.05)
        self.assertEqual(r['units'], 507)
        self.assertEqual(r['overlap_cells'], 0, r['worst_overlaps'])

    def test_fine_grid_0_01(self):
        r = T2.run(0.01)
        self.assertEqual(r['overlap_cells'], 0, r['worst_overlaps'])
        self.assertLess(r['gap_km2'], 40, r['worst_gaps'])

    def test_release_grid_0_002(self):
        r = T2.run(0.002)
        self.assertLess(r['overlap_km2'], 0.5, r['worst_overlaps'])
        self.assertLess(r['gap_km2'], 12, r['worst_gaps'][:3])        # the original BBS polygons themselves have about 8 km2 of enclosed holes
        self.assertLess(r['gap_components'], 80)
        self.assertGreater(r['covered_km2'], 145000)                  # about the area of Bangladesh


if __name__ == '__main__':
    unittest.main()
