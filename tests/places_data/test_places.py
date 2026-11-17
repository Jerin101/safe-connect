"""Tests for the places data: shared rules, the manual-places import, and the validator.

Run: python -m unittest discover -s tests/places_data
Standard library only. The CSV rows in fixtures/ are made up (every name starts with TEST).
"""
import contextlib
import datetime
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import places_rules as R  # noqa: E402
import import_manual_places as I  # noqa: E402

DATA = os.path.join(ROOT, "data")
FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "notun-jayga-test.csv")
TODAY = datetime.date(2026, 11, 15)


def errors(results):
    return [m for lvl, m in results if lvl == "error"]


class GoogleAndPlusCodes(unittest.TestCase):
    def test_banned_hosts(self):
        for u in ("https://google.com/maps", "https://www.google.com/maps/place/x", "https://maps.google.com/?q=1",
                  "https://docs.google.com/spreadsheets/d/x", "https://drive.google.com/file/d/x",
                  "https://www.google.com.bd/maps", "https://google.com.bd", "https://goo.gl/maps/x",
                  "https://maps.app.goo.gl/abc", "https://g.page/shop", "https://MAPS.GOOGLE.COM/x"):
            self.assertTrue(R.is_banned_url(u), u)

    def test_allowed_hosts(self):
        for u in ("https://pocl.gov.bd/pages/x", "https://www.facebook.com/someshop", "https://notgoogle.com/x",
                  "https://google.com.example.org/x", "https://www.openstreetmap.org/node/1", "https://g.pages.dev/x"):
            self.assertFalse(R.is_banned_url(u), u)

    def test_plus_codes(self):
        for s in ("V3P8+2F", "7MJ4V3P8+2F", "near v3p8+2f, Maijdee", "(V3P8+2FX)"):
            self.assertTrue(R.PLUS_CODE.search(s), s)
        for s in ("01712345678", "A+B", "1+1", "C++", "Road 12+13", "এক+দুই"):
            self.assertFalse(R.PLUS_CODE.search(s), s)

    def test_google_link_anywhere_is_an_error(self):
        for text in ("see https://maps.app.goo.gl/xyz", "HTTPS://MAPS.APP.GOO.GL/x", "HTTPS://WWW.GOOGLE.COM/maps",
                     "maps.app.goo.gl/x", "goo.gl/maps/abc", "www.google.com/maps/place/x", "google.com.bd",
                     "g.page/shop", "Docs.Google.com/spreadsheets/d/x"):
            self.assertTrue(any("Google link" in m for m in errors(R.check_common({"note": text}))), text)
        msg = errors(R.check_common({"note": "see goo.gl/x"}))[0]
        self.assertIn("goo.gl", msg)
        self.assertNotIn("re.Match", msg)
        for text in ("notgoogle.com", "googleplex shop", "goo glass", "e-g page", "e.g.page", "সাধারণ দোকান"):
            self.assertFalse(errors(R.check_common({"note": text})), text)

    def test_phone_number_in_free_text_is_an_error(self):
        for text in ("call 01712345678", "০১৭১২৩৪৫৬৭৮", "+8801712345678", "01712-345678", "017-1234-5678",
                     "017 12 345 678", "+880 1712 345678"):
            self.assertTrue(any("phone number in note" in m for m in errors(R.check_common({"note": text}))), text)
        # OSM ids and links are not phone numbers
        self.assertEqual(errors(R.check_common({"id": "osm-n1361697420",
                                                "source_url": "https://www.openstreetmap.org/node/1361697420"})), [])


def good_manual():
    return {"id": "man-noakhali-1", "name_bn": "TEST", "name_en": None, "category": "fuel_transport",
            "subcategory": "fuel", "lat": None, "lon": None, "location_approx": True, "location_source": None,
            "division": "Chittagong", "district": "Noakhali", "upazila": "Begumganj", "union": None,
            "address_bn": None, "phone": None, "hours": None, "source": "official", "verified_by": "official_list",
            "source_url": "https://pocl.gov.bd/pages/x", "checked_by": "tasmintoshi", "checked_on": "2026-11-15",
            "note": None}


class ManualPlaceRules(unittest.TestCase):
    UPZ = {"Begumganj", "Hatiya"}

    def check(self, **changes):
        p = good_manual()
        p.update(changes)
        return R.check_manual_place(p, "Noakhali", self.UPZ, TODAY)

    def test_pin_far_from_its_upazila_is_a_warning(self):
        p = dict(good_manual(), lat=22.34816, lon=91.0914, location_approx=False, location_source="visited_gps")
        res = R.check_in_upazila(p, {}, {("Noakhali", "Begumganj"): (22.93091, 91.09426)})
        self.assertEqual([lvl for lvl, _ in res], ["warning"])
        self.assertEqual(R.check_in_upazila(dict(p, lat=22.93, lon=91.09), {}, {("Noakhali", "Begumganj"): (22.93091, 91.09426)}), [])

    def test_real_shape_is_an_error_check_collapsed_shape_is_ignored(self):
        square = [[[[91.0, 22.9], [91.2, 22.9], [91.2, 23.0], [91.0, 23.0], [91.0, 22.9]]]]
        collapsed = [[[[91.048, 22.9907], [91.048, 22.9907]]]]
        p = dict(good_manual(), lat=22.5, lon=91.1, location_approx=False, location_source="visited_gps")
        self.assertEqual([l for l, _ in R.check_in_upazila(p, {("Noakhali", "Begumganj"): square})], ["error"])
        self.assertEqual(R.check_in_upazila(dict(p, lat=22.95), {("Noakhali", "Begumganj"): square}), [])
        self.assertEqual(R.check_in_upazila(p, {("Noakhali", "Begumganj"): collapsed}), [])

    def test_good(self):
        self.assertEqual(self.check(), [])

    def test_visited_needs_no_source_url_but_checked_by_and_on(self):
        self.assertEqual(errors(self.check(verified_by="visited", source="user", source_url=None)), [])
        self.assertIn("checked_by is needed", errors(self.check(verified_by="visited", source="user", source_url=None, checked_by=None)))
        self.assertIn("checked_on must be YYYY-MM-DD", errors(self.check(verified_by="visited", source="user", source_url=None, checked_on=None)))

    def test_owner_page_and_official_list_need_source_url(self):
        self.assertTrue(errors(self.check(source_url=None)))
        self.assertTrue(errors(self.check(verified_by="owner_page", source="owner", source_url=None)))

    def test_facebook_page_ok_group_or_post_not(self):
        ok = dict(verified_by="owner_page", source="owner")
        self.assertEqual(errors(self.check(source_url="https://www.facebook.com/someshop", **ok)), [])
        for u in ("https://www.facebook.com/groups/abc", "https://www.facebook.com/someone/posts/123",
                  "https://www.facebook.com/permalink.php?story_fbid=1", "https://www.facebook.com/share/p/abc"):
            self.assertTrue(errors(self.check(source_url=u, **ok)), u)

    def test_official_list_must_be_government(self):
        self.assertTrue(errors(self.check(source_url="https://example.com/x.pdf")))
        self.assertEqual(errors(self.check(source_url="https://Police.GOV.BD/x")), [])

    def test_more_facebook_links(self):
        ok = dict(verified_by="owner_page", source="owner")
        for u in ("https://www.facebook.com/photoclickstudiobd", "https://www.facebook.com/watchhousebd",
                  "https://m.facebook.com/someshop", "https://www.facebook.com/p/Some-Shop-100064123456789/",
                  "https://www.facebook.com/profile.php?id=100064123456789"):
            self.assertEqual(errors(self.check(source_url=u, **ok)), [], u)
        for u in ("https://fb.com/groups/x", "https://mbasic.facebook.com/groups/x", "https://www.facebook.com/reel/123",
                  "https://fb.me/x", "https://www.facebook.com/photo.php?fbid=1",
                  "https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com"):
            self.assertTrue(errors(self.check(source_url=u, **ok)), u)

    def test_id_must_name_this_district(self):
        self.assertTrue(errors(self.check(id="man-feni-1")))

    def test_lat_without_lon_does_not_crash(self):
        p = dict(good_manual(), lat=22.9, lon=None, location_approx=False, location_source="visited_gps")
        self.assertTrue(errors(R.check_manual_place(p, "Noakhali", self.UPZ, TODAY)))
        self.assertEqual(R.check_in_upazila(p, {}, {("Noakhali", "Begumganj"): (22.93, 91.09)}), [])
        p = dict(good_manual(), lat="22.9", lon=91.1, location_approx=False, location_source="visited_gps")
        self.assertIn("lat and lon must be numbers", errors(R.check_manual_place(p, "Noakhali", self.UPZ, TODAY)))
        self.assertEqual(R.check_in_upazila(p, {}, {("Noakhali", "Begumganj"): (22.93, 91.09)}), [])

    def test_location_rules(self):
        self.assertTrue(errors(self.check(lat=22.9, lon=91.1, location_approx=False)))           # no location_source
        self.assertEqual(errors(self.check(lat=22.9, lon=91.1, location_approx=False, location_source="official_list")), [])
        self.assertTrue(errors(self.check(lat=22.9, lon=91.1, location_approx=True, location_source="official_list")))
        self.assertTrue(errors(self.check(location_approx=False)))
        self.assertTrue(errors(self.check(lat=22.9, location_approx=False, location_source="official_list")))

    def test_phone_only_with_a_published_source(self):
        self.assertEqual(errors(self.check(phone="01712345678")), [])
        self.assertTrue(errors(self.check(phone="01712345678", verified_by="visited", source="user", source_url=None)))
        self.assertTrue(errors(self.check(phone="12345")))

    def test_unknown_upazila_and_future_date(self):
        self.assertTrue(errors(self.check(upazila="Nowhere")))
        self.assertTrue(errors(self.check(checked_on="2027-01-01")))

    def test_union_needs_official_page(self):
        self.assertEqual(errors(self.check(union="X ইউনিয়ন")), [])
        self.assertTrue(errors(self.check(union="X ইউনিয়ন", verified_by="visited", source="user", source_url=None)))


class Item4Validator(unittest.TestCase):
    def test_one_letter_subdomains(self):
        for text in ("m.google.com/maps/x", "M.GOOGLE.COM", "x.goo.gl/a", "m.google.com.bd", "my.g.page"):
            self.assertTrue(errors(R.check_common({"note": text})), text)
        self.assertFalse(errors(R.check_common({"note": "e.g.page"})))

    def test_landlines(self):
        for text in ("02-9555555", "০২-৯৫৫৫৫৫৫", "031-612345", "0321-61234", "০৩২১-৬১২৩৪", "(031) 612345",
                     "+880 2 9555555", "02 9555555"):
            self.assertTrue(any("phone number" in m for m in errors(R.check_common({"note": text}))), text)
        for text in ("02-11-2026", "০২/১১/২০২৬", "Ward 03-5", "Holding 0321", "Mo-Su 08:00-22:00",
                     "07:00-23:00; Fr 14:00-23:00", "1,250 taka", "Road 12, House 5"):
            self.assertFalse(errors(R.check_common({"note": text})), text)


class OsmPlaceRules(unittest.TestCase):
    BASE = {"id": "osm-n123", "category": "health", "subcategory": "pharmacy", "lat": 22.87, "lon": 91.1,
            "district": "Noakhali", "upazila": None, "union": None, "phone": None, "source": "osm",
            "source_url": "https://www.openstreetmap.org/node/123", "checked_on": "2026-11-13"}

    def osm(self, **changes):
        return errors(R.check_osm_place(dict(self.BASE, **changes), "Noakhali", set(), "2026-11-13"))

    def test_unnamed_kinds(self):
        self.assertEqual(self.osm(unnamed=True), [])
        self.assertTrue(self.osm(unnamed=True, name_bn="X"))
        self.assertTrue(self.osm(unnamed=True, category="shops", subcategory="marketplace"))
        self.assertTrue(self.osm())                                   # no name and not marked unnamed
        self.assertEqual(set(R.UNNAMED_LABELS), {"hospital", "clinic", "pharmacy", "fuel", "atm", "bank", "police",
                                                 "fire_station", "bus_station", "ferry_terminal"})
        for sub, lab in R.UNNAMED_LABELS.items():
            self.assertTrue(lab["bn"].endswith("(নাম জানা নেই)") and lab["en"].endswith("(name not known)"), sub)

    def test_crafts(self):
        self.assertEqual(self.osm(name_en="T", category="workshops", subcategory="tailor", osm_key="craft"), [])
        self.assertEqual(self.osm(name_en="T", category="other_services", subcategory="sawmill", osm_key="craft"), [])
        self.assertTrue(self.osm(name_en="T", category="workshops", subcategory="sawmill", osm_key="craft"))
        self.assertTrue(self.osm(name_en="T", category="other_services", subcategory="tailor", osm_key="craft"))
        self.assertTrue(self.osm(name_en="T", category="other_services", subcategory="sawmill"))   # needs osm_key craft
        self.assertEqual(R.category_for("shoemaker", "craft"), "workshops")
        self.assertEqual(R.category_for("photographer", "craft"), "other_services")

    def test_osm_place(self):
        p = {"id": "osm-n123", "name_bn": "TEST", "category": "health", "subcategory": "pharmacy",
             "lat": 22.87, "lon": 91.1, "district": "Noakhali", "upazila": None, "union": None, "phone": None,
             "source": "osm", "source_url": "https://www.openstreetmap.org/node/123", "checked_on": "2026-11-13"}
        self.assertEqual(R.check_osm_place(p, "Noakhali", set(), "2026-11-13"), [])
        self.assertTrue(errors(R.check_osm_place(dict(p, source_url="https://www.openstreetmap.org/node/124"), "Noakhali", set(), "2026-11-13")))
        self.assertTrue(errors(R.check_osm_place(dict(p, phone="01712345678"), "Noakhali", set(), "2026-11-13")))
        self.assertTrue(errors(R.check_osm_place(dict(p, name_bn=None), "Noakhali", set(), "2026-11-13")))
        self.assertTrue(errors(R.check_osm_place(dict(p, subcategory="fuel"), "Noakhali", set(), "2026-11-13")))


class ImportManualPlaces(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        for f in ("areas_bangladesh.json", "locations.json", "upazila_centres.json"):
            shutil.copy(os.path.join(DATA, f), self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_import(self, csv_path):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = I.main(csv_path, self.tmp, TODAY)
        return code, out.getvalue()

    def test_fixture(self):
        code, out = self.run_import(FIXTURE)
        self.assertEqual(code, 1, out)
        doc = json.load(open(os.path.join(self.tmp, "places", "manual_noakhali.json"), encoding="utf-8"))
        self.assertEqual([p["id"] for p in doc["places"]], ["man-noakhali-1", "man-noakhali-2", "man-noakhali-3"])
        p1, p2, p3 = doc["places"]
        self.assertTrue(p1["location_approx"])
        self.assertIsNone(p1["lat"])
        self.assertEqual((p2["district"], p2["upazila"], p2["source"], p2["location_approx"]), ("Noakhali", "Begumganj", "user", False))
        self.assertEqual(p3["phone"], "01712345678")
        expected = {9: "outside Begumganj", 5: "Google", 6: "plus code", 7: "checked_on", 8: "Facebook page", 10: "Google", 11: "official_list needs", 12: "phone number only", 13: "used twice",
                    14: "Google", 15: "Google"}
        for row, text in expected.items():
            self.assertTrue(any(line.startswith(f"ERROR   row {row}:") and text in line for line in out.splitlines()),
                            f"row {row} should fail with {text!r}\n{out}")
        # with the real upazila shapes (#221) a pin in Hatiya labelled Begumganj is an error, not only a warning
        self.assertIn("3 places written", out)

    def test_unquoted_comma_and_lat_without_lon(self):
        bad = os.path.join(self.tmp, "bad.csv")
        with open(FIXTURE, encoding="utf-8") as f:
            header = f.readline()
        with open(bad, "w", encoding="utf-8") as f:
            f.write(header)
            f.write("1,TEST এক,,shops,general,Noakhali,Begumganj,,,,,,,,visited,,tasmintoshi,2026-11-15,a note, with a comma\n")
            f.write("2,TEST দুই,,shops,general,Noakhali,Begumganj,,,22.93,,visited_gps,,,visited,,tasmintoshi,2026-11-15,lat only\n")
        code, out = self.run_import(bad)
        self.assertEqual(code, 1)
        self.assertIn("ERROR   row 2: too many cells", out)
        self.assertIn("ERROR   row 3: give both lat and lon", out)

    def test_wrong_header(self):
        bad = os.path.join(self.tmp, "bad.csv")
        open(bad, "w", encoding="utf-8").write("name,district\nx,Noakhali\n")
        code, out = self.run_import(bad)
        self.assertEqual(code, 1)
        self.assertIn("header row", out)


class Validator(unittest.TestCase):
    def run_validator(self, data):
        return subprocess.run([sys.executable, os.path.join(ROOT, "tools", "validate_data.py"), data],
                              capture_output=True, text=True, encoding="utf-8")

    def test_repo_data_is_clean(self):
        r = self.run_validator(DATA)
        self.assertEqual(r.returncode, 0, r.stdout[-2000:])

    def test_bad_manual_file_fails(self):
        tmp = tempfile.mkdtemp()
        try:
            shutil.copytree(DATA, os.path.join(tmp, "data"))
            p = dict(good_manual(), source_url="https://maps.app.goo.gl/x", verified_by="owner_page", source="owner")
            json.dump({"district_en": "Noakhali", "places": [p]},
                      open(os.path.join(tmp, "data", "places", "manual_noakhali.json"), "w", encoding="utf-8"))
            r = self.run_validator(os.path.join(tmp, "data"))
            self.assertEqual(r.returncode, 1)
            self.assertIn("Google", r.stdout)
        finally:
            shutil.rmtree(tmp)

    def with_copy(self, change):
        tmp = tempfile.mkdtemp()
        try:
            shutil.copytree(DATA, os.path.join(tmp, "data"))
            change(os.path.join(tmp, "data"))
            return self.run_validator(os.path.join(tmp, "data"))
        finally:
            shutil.rmtree(tmp)

    def test_manual_file_with_bom_or_without_places_list(self):
        def bom(d):
            body = json.dumps({"district_en": "Noakhali", "places": []}).encode("utf-8")
            open(os.path.join(d, "places", "manual_noakhali.json"), "wb").write(b"\xef\xbb\xbf" + body)
        r = self.with_copy(bom)
        self.assertEqual(r.returncode, 1)
        self.assertIn("BOM", r.stdout)

        def no_list(d):
            json.dump({"district_en": "Noakhali", "place": []}, open(os.path.join(d, "places", "manual_noakhali.json"), "w", encoding="utf-8"))
        r = self.with_copy(no_list)
        self.assertIn('"places" list', r.stdout)

        def not_objects(d):
            json.dump({"district_en": "Noakhali", "places": ["x", None]}, open(os.path.join(d, "places", "manual_noakhali.json"), "w", encoding="utf-8"))
        r = self.with_copy(not_objects)
        self.assertEqual(r.returncode, 1)
        self.assertIn("each place must be an object", r.stdout)
        self.assertNotIn("Traceback", r.stderr)

        def upper_ext(d):
            json.dump({"district_en": "Noakhali", "places": []}, open(os.path.join(d, "places", "manual_noakhali.JSON"), "w", encoding="utf-8"))
        r = self.with_copy(upper_ext)
        self.assertIn("lower-case extension", r.stdout)

    def test_centre_far_from_its_district_fails(self):
        def move(d):
            fp = os.path.join(d, "upazila_centres.json")
            c = json.load(open(fp, encoding="utf-8"))
            for x in c["centres"]:
                if (x["district"], x["upazila_en"]) == ("Cox's Bazar", "Teknaf"):
                    x["lat"], x["lon"] = 23.81, 90.41          # Dhaka
            json.dump(c, open(fp, "w", encoding="utf-8"), ensure_ascii=False)
        r = self.with_copy(move)
        self.assertEqual(r.returncode, 1)
        self.assertIn("km from the district's other centres", r.stdout)

    def test_osm_file_over_120_kb_fails(self):
        def grow(d):
            fp = os.path.join(d, "places", "noakhali.json")
            doc = json.load(open(fp, encoding="utf-8"))
            doc["padding"] = os.urandom(130 * 1024).hex()          # random text does not compress
            json.dump(doc, open(fp, "w", encoding="utf-8"), ensure_ascii=False)
        r = self.with_copy(grow)
        self.assertEqual(r.returncode, 1)
        self.assertIn("over 120 KB gzip", r.stdout)

    def test_osm_file_over_limit_or_unlisted_fails(self):
        tmp = tempfile.mkdtemp()
        try:
            shutil.copytree(DATA, os.path.join(tmp, "data"))
            with open(os.path.join(tmp, "data", "places", "extra.json"), "w", encoding="utf-8") as fh:
                fh.write("{}")
            r = self.run_validator(os.path.join(tmp, "data"))
            self.assertEqual(r.returncode, 1)
            self.assertIn("not listed", r.stdout)
        finally:
            shutil.rmtree(tmp)


class OfficialListRules(unittest.TestCase):
    LISTS = {"padma_2019": {"source_url": "https://pocl.gov.bd/pages/static-pages/x", "list_date": "2019-07-23",
                            "badge_bn": "২০১৯ সালের সরকারি তালিকা, এখন বদলে থাকতে পারে", "badge_en": "2019 official list, may have changed",
                            "source_file": {"url": "https://objectstorage.example.gov.bd/x.pdf", "sha256": "a" * 64}}}
    BASE = {"id": "padma-noakhali-1", "name_en": "TEST FILLING STATION", "category": "fuel_transport", "subcategory": "fuel",
            "lat": None, "lon": None, "location_approx": True, "district": "Noakhali", "upazila": "Begumganj", "union": None,
            "phone": None, "checked_on": "2026-11-17", "source": "official", "list": "padma_2019",
            "source_url": "https://pocl.gov.bd/pages/static-pages/x", "flags": ["source_older_than_2_years"]}

    def check(self, **changes):
        return errors(R.check_official_place(dict(self.BASE, **changes), "Noakhali", {"Begumganj"}, self.LISTS))

    def test_good(self):
        self.assertEqual(self.check(), [])
        self.assertEqual(errors(R.check_official_list("padma_2019", self.LISTS["padma_2019"])), [])

    def test_no_account_numbers_or_people(self):
        self.assertTrue(self.check(address_en="CHOWKBAZAR, NEW A/C=1210707"))
        self.assertTrue(self.check(address_en="MD. EMDADUL HAQUE DIARBAGHAIL"))
        self.assertTrue(self.check(address_en="C/O. A.H.SARKER DAUDKANDI"))
        self.assertTrue(self.check(address_en="DHAKA-CHATTOGRAM HIGHWAY, MIRSHARAI"))   # address text is never kept
        self.assertTrue(self.check(name_en="M/S.MST.FEROZA BEGUM"))                  # a person-only name
        self.assertEqual(self.check(name_en="MD. YUNUS & CO."), [])                   # a company named after a person

    def test_hidden_person_name(self):
        lists = {"padma_2019": dict(self.LISTS["padma_2019"], hidden_name_label_bn="পেট্রোল পাম্প (পদ্মা অয়েলের ডিলার)",
                                    hidden_name_label_en="Petrol pump (Padma Oil dealer)")}
        chk = lambda **c: errors(R.check_official_place(dict(self.BASE, **c), "Noakhali", {"Begumganj"}, lists))
        self.assertEqual(chk(name_en=None, name_hidden=True), [])
        self.assertTrue(chk(name_hidden=True))                              # hidden but the name is still there
        self.assertTrue(errors(R.check_official_place(dict(self.BASE, name_en=None, name_hidden=True), "Noakhali", {"Begumganj"}, self.LISTS)))
        self.assertTrue(chk(name_en=None))                                  # no name and not marked

    def test_no_location_and_flags(self):
        self.assertTrue(self.check(lat=22.9, lon=91.1))
        self.assertTrue(self.check(flags=[]))                          # 2019 list must be flagged
        self.assertTrue(self.check(upazila="Hatiya"))                  # not in this district's list given
        self.assertTrue(self.check(source_url="https://example.com/x"))
        self.assertTrue(self.check(id="padma-feni-1"))

    def test_list_needs_badge_and_file(self):
        meta = dict(self.LISTS["padma_2019"], badge_bn=None)
        self.assertTrue(errors(R.check_official_list("padma_2019", meta)))
        meta = dict(self.LISTS["padma_2019"], source_file={"url": "https://drive.google.com/file/d/x", "sha256": "a" * 64})
        self.assertTrue(errors(R.check_official_list("padma_2019", meta)))


if __name__ == "__main__":
    unittest.main()
