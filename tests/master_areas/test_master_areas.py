"""T1 for the master area list (M1.1, issue #346): every official unit is in the master list, and every master entry maps back
to exactly one official unit, in both directions, with code, name and parent checked. Also: the links to the national portal list,
and the rule that DERIVED values are never mixed with official ones.

Run:  python -m unittest discover -s tests/master_areas
Standard library only. It reads:
  tools/sources/bbs_cod_ab_v03.json   the official BBS tables (CC BY-IGO, via OCHA HDX), made by tools/extract_bbs_source.py
  src/data/master_areas.json          made by tools/build_master_areas.py
  src/data/areas_bangladesh.json      the national portal list
A change in any count makes a test fail: nothing may go missing or double silently.
"""
import collections, json, os, unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def load(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return json.load(f)


BBS = load("tools", "sources", "bbs_cod_ab_v03.json")
MASTER = load("src", "data", "master_areas.json")
PORTAL = load("src", "data", "areas_bangladesh.json")

# What the official data has today. If the source is replaced by a newer version, these numbers are changed on purpose, in review.
EXPECTED = {"divisions": 8, "districts": 64, "upazila_level": 507, "upazilas": 495, "city_corporations": 12, "union_points": 5160, "old_level3_points": 544}
# The plan (BUILD_PLAN_NATIONWIDE.md): 4,565 unions + 595 pourashava / ward points = 5,160. The name pattern (a hint, not an official class) gives the same.
EXPECTED_SPLIT = {"union": 4565, "pourashava": 310, "ward": 285}


def codes(items):
    return [x["code"] for x in items]


class BbsSource(unittest.TestCase):
    def test_official_counts(self):
        self.assertEqual(len(BBS["divisions"]), EXPECTED["divisions"])
        self.assertEqual(len(BBS["districts"]), EXPECTED["districts"])
        self.assertEqual(len(BBS["upazilas"]), EXPECTED["upazila_level"])
        self.assertEqual(sum("City Corporation" in u["name"] for u in BBS["upazilas"]), EXPECTED["city_corporations"])
        self.assertEqual(len(BBS["points4"]), EXPECTED["union_points"])
        self.assertEqual(len(BBS["points3"]), EXPECTED["old_level3_points"])

    def test_codes_are_unique(self):
        for level in ("divisions", "districts", "upazilas", "points3", "points4"):
            c = codes(BBS[level])
            self.assertEqual(len(c), len(set(c)), f"duplicate code in {level}")

    def test_source_licence_and_modification_notice_are_recorded(self):
        s = BBS["source"]
        for k in ("dataset", "publisher", "original_source", "page", "file_url", "file_sha256", "retrieved_on", "polygon_table_valid_on", "point_table_valid_on",
                  "licence", "attribution", "modification_notice"):
            self.assertTrue(s.get(k), f"source.{k} is missing")
        self.assertIn("CC BY-IGO", s["licence"])
        self.assertIn("do not endorse", s["modification_notice"], "the licence forbids implying endorsement: say so")
        self.assertEqual(MASTER["meta"]["bbs_source"]["file_sha256"], s["file_sha256"], "master_areas.json was built from another source file: rebuild it")
        self.assertEqual(MASTER["meta"]["bbs_source"]["modification_notice"], s["modification_notice"])

    def test_union_identification_is_never_called_exact(self):
        rules = " ".join(MASTER["meta"]["usage_rules"])
        self.assertIn("NEAREST UNION CENTRE", rules)
        self.assertIn("never an exact union", rules)


class BothWays(unittest.TestCase):
    """T1: official -> master and master -> official, for every level."""

    def check(self, source_items, master_items, level, fields):
        src = collections.Counter(codes(source_items))
        mst = collections.Counter(codes(master_items))
        self.assertEqual(max(src.values()), 1, f"{level}: official code repeated")
        self.assertEqual(max(mst.values()), 1, f"{level}: master code repeated")
        missing = sorted(set(src) - set(mst))
        extra = sorted(set(mst) - set(src))
        self.assertEqual(missing, [], f"{level}: official units missing from the master list (first: {missing[:5]})")
        self.assertEqual(extra, [], f"{level}: master entries with no official unit (first: {extra[:5]})")
        by_code = {x["code"]: x for x in master_items}
        for s in source_items:
            m = by_code[s["code"]]
            for sf, mf in fields:
                self.assertEqual(m[mf], s[sf], f"{level} {s['code']}: {mf} differs from the official {sf}")

    def test_divisions(self):
        self.check(BBS["divisions"], MASTER["divisions"], "division", [("name", "name_en")])

    def test_districts(self):
        self.check(BBS["districts"], MASTER["districts"], "district", [("name", "name_en"), ("division", "division")])

    def test_upazila_level_units(self):
        self.check(BBS["upazilas"], MASTER["upazilas"], "upazila", [("name", "name_en"), ("district", "district"), ("lat", "lat"), ("lon", "lon")])

    def test_union_points(self):
        self.check(BBS["points4"], MASTER["unions"], "union", [("name", "name_en"), ("parent", "legacy_upazila_code"), ("lat", "lat"), ("lon", "lon")])

    def test_old_division_and_district_names_are_the_official_2020_names(self):
        old_div = {p["code"]: p["name"] for p in BBS["points1"]}
        old_dis = {p["code"]: p["name"] for p in BBS["points2"]}
        for d in MASTER["divisions"]:
            self.assertEqual(d["legacy_name"], old_div[d["code"]])
        for d in MASTER["districts"]:
            self.assertEqual(d["legacy_name"], old_dis[d["code"]])

    def test_counts_in_meta_match(self):
        c = MASTER["meta"]["counts"]["bbs"]
        self.assertEqual((c["divisions"], c["districts"], c["upazila_level"], c["union_points"]), (len(MASTER["divisions"]), len(MASTER["districts"]), len(MASTER["upazilas"]), len(MASTER["unions"])))
        self.assertEqual((c["upazilas"], c["city_corporations"]), (EXPECTED["upazilas"], EXPECTED["city_corporations"]))
        self.assertEqual(sum(1 for u in MASTER["upazilas"] if u["kind"] == "city_corporation"), EXPECTED["city_corporations"])

    def test_union_pourashava_ward_split_is_the_plans(self):
        split = collections.Counter(u["kind_hint"] for u in MASTER["unions"])
        self.assertEqual(dict(split), EXPECTED_SPLIT)
        self.assertEqual(split["union"] + split["pourashava"] + split["ward"], EXPECTED["union_points"])
        names = {u["name_en"]: u["kind_hint"] for u in MASTER["unions"]}
        for union_with_ward_inside in ("Parameshwardi", "Baneshwardi", "Char Ishwardia", "Ishwardi"):
            self.assertEqual(names[union_with_ward_inside], "union", f"{union_with_ward_inside} is a union: 'ward' inside a name is not a ward")
        self.assertEqual(names["Gopalpur (Lalpur) Paurashav"], "pourashava", "a pourashava whose official name is cut short")


class DerivedVersusOfficial(unittest.TestCase):
    """Official values are copied from BBS. Derived values (the old-to-new upazila link and what depends on it) live only in marked fields."""

    def test_derived_fields_are_marked_and_apart(self):
        for u in MASTER["upazilas"]:
            self.assertFalse([k for k in u if k.startswith("legacy_")], f"{u['code']}: an unmarked legacy_* field")
            if u["legacy"] is not None:
                self.assertEqual(u["legacy"]["link"], "derived")
                self.assertEqual(u["legacy"]["code"], u["code"][:6] + u["code"][8:])
                self.assertIn(u["legacy"]["name_match"], ("exact", "spelling", "differs"))
        for n in MASTER["unions"]:
            self.assertNotIn("upazila", n, "union parent must be called derived_upazila")
            self.assertIn("derived_upazila", n)
        rules = " ".join(MASTER["meta"]["code_rules"])
        self.assertIn("DERIVED (not official)", rules)

    def test_official_codes_are_never_built_by_the_derivation(self):
        # the 10-digit upazila code and the union code are copied from the BBS tables; none was made by the old-to-new rule
        src_upz = set(codes(BBS["upazilas"]))
        src_uni = set(codes(BBS["points4"]))
        for u in MASTER["upazilas"]:
            self.assertIn(u["code"], src_upz)
        for n in MASTER["unions"]:
            self.assertIn(n["code"], src_uni)
            self.assertIn(n["legacy_upazila_code"], {p["code"] for p in BBS["points3"]}, "the old parent code is an official point code")

    def test_old_to_new_upazila_links_are_one_to_one(self):
        legacy = [u["legacy"]["code"] for u in MASTER["upazilas"] if u["legacy"]]
        self.assertEqual(len(legacy), len(set(legacy)), "two 2023 upazilas share one old code")
        self.assertTrue(set(legacy) <= {p["code"] for p in BBS["points3"]}, "a legacy code is not in the official point table")


class Hierarchy(unittest.TestCase):
    def test_parents_exist_and_codes_agree(self):
        div = set(codes(MASTER["divisions"]))
        dis = {d["code"]: d for d in MASTER["districts"]}
        upz = {u["code"]: u for u in MASTER["upazilas"]}
        for d in dis.values():
            self.assertIn(d["division"], div)
            self.assertTrue(d["code"].startswith(d["division"]), f"{d['code']} is not under {d['division']}")
        for u in upz.values():
            self.assertIn(u["district"], dis)
            self.assertTrue(u["code"].startswith(u["district"]), f"{u['code']} is not under {u['district']}")
        for n in MASTER["unions"]:
            self.assertTrue(n["code"].startswith(n["legacy_upazila_code"]), f"{n['code']}: code does not start with its old parent code")
            if n["derived_upazila"] is None:
                self.assertEqual(n["status"], "parent_unresolved", f"{n['code']}: no parent and not marked unresolved")
            else:
                self.assertIn(n["derived_upazila"], upz)
                self.assertNotEqual(n["status"], "parent_unresolved")
                self.assertEqual(upz[n["derived_upazila"]]["legacy"]["code"], n["legacy_upazila_code"], f"{n['code']}: derived parent does not use its old parent code")

    def test_city_corporations_have_no_unions(self):
        cc = {u["code"] for u in MASTER["upazilas"] if u["kind"] == "city_corporation"}
        self.assertEqual(len(cc), EXPECTED["city_corporations"])
        for n in MASTER["unions"]:
            self.assertNotIn(n["derived_upazila"], cc, f"{n['code']} sits directly under a city corporation: city areas have wards, not unions")


class PortalLinks(unittest.TestCase):
    """The portal list is linked only by code AND name AND parent, one to one; whatever is not linked is listed (never dropped)."""

    @classmethod
    def setUpClass(cls):
        cls.p_div, cls.p_dis, cls.p_upz, cls.p_uni = [], [], [], []
        for v in PORTAL["divisions"]:
            cls.p_div.append((str(v["bbs"]), v["en"]))
            for d in v["districts"]:
                cls.p_dis.append((str(d["bbs"]), d["en"], v["en"]))
                for u in d["upazilas"]:
                    cls.p_upz.append((str(u["bbs"]), u["en"], d["en"]))
                    for n in u.get("unions", []):
                        cls.p_uni.append((str(n["bbs"]), n["en"], u["en"], d["en"]))

    def linked(self, items):
        return [x for x in items if x["portal"]]

    def test_each_portal_entry_is_linked_at_most_once(self):
        for level, items in (("divisions", MASTER["divisions"]), ("districts", MASTER["districts"])):
            seen = collections.Counter((x["portal"]["code"], x["portal"]["name_en"]) for x in self.linked(items))
            self.assertTrue(all(v == 1 for v in seen.values()), f"{level}: one portal entry linked twice")
        up = collections.Counter((x["portal"]["code"], x["portal"]["name_en"], x["district"]) for x in self.linked(MASTER["upazilas"]))
        self.assertTrue(all(v == 1 for v in up.values()), "upazilas: a portal upazila (code, name, district) is linked twice")
        un = collections.Counter((x["portal"]["code"], x["portal"]["name_en"], x["derived_upazila"]) for x in self.linked(MASTER["unions"]))
        self.assertTrue(all(v == 1 for v in un.values()), "unions: a portal union (code, name, upazila) is linked twice")

    def test_every_link_agrees_on_code_and_the_portal_entry_exists(self):
        dnames = {d["code"]: d for d in MASTER["districts"]}
        pdis = {(c, n) for c, n, _ in self.p_dis}
        pupz = {(c, n, d) for c, n, d in self.p_upz}
        puni = {(c, n, u, d) for c, n, u, d in self.p_uni}
        for d in self.linked(MASTER["districts"]):
            self.assertIn((d["portal"]["code"], d["portal"]["name_en"]), pdis)
            self.assertEqual(int(d["portal"]["code"]), int(d["code"][-2:]), f"district {d['code']}: code differs")
        for u in self.linked(MASTER["upazilas"]):
            district = dnames[u["district"]]["portal"]["name_en"]
            self.assertIn((u["portal"]["code"], u["portal"]["name_en"], district), pupz, f"upazila {u['code']}: no such portal entry")
            self.assertEqual(int(u["portal"]["code"]), int(u["code"][-4:]), f"upazila {u['code']}: code differs")
            self.assertEqual(u["kind"], "upazila", "a city corporation was linked to a portal upazila")
        upz = {u["code"]: u for u in MASTER["upazilas"]}
        for n in self.linked(MASTER["unions"]):
            parent = upz[n["derived_upazila"]]
            self.assertIsNotNone(parent["portal"], f"union {n['code']} is linked but its upazila is not")
            self.assertIn((n["portal"]["code"], n["portal"]["name_en"], parent["portal"]["name_en"], dnames[parent["district"]]["portal"]["name_en"]), puni, f"union {n['code']}: no such portal entry")
            self.assertEqual(int(n["portal"]["code"]), int(n["code"][-2:]), f"union {n['code']}: code differs")

    def test_no_portal_entry_is_lost(self):
        un = MASTER["unresolved"]
        self.assertEqual(len(self.linked(MASTER["divisions"])) + len(un.get("portal_division_unlinked", [])), len(self.p_div))
        self.assertEqual(len(self.linked(MASTER["districts"])) + len(un.get("portal_district_unlinked", [])), len(self.p_dis))
        self.assertEqual(len(self.linked(MASTER["upazilas"])) + len(un.get("portal_upazila_unlinked", [])), len(self.p_upz))
        self.assertEqual(len(self.linked(MASTER["unions"])) + len(un.get("portal_union_unlinked", [])), len(self.p_uni))

    def test_no_official_unit_is_silently_left_without_a_status(self):
        un = MASTER["unresolved"]
        self.assertEqual(len([u for u in MASTER["upazilas"] if not u["portal"]]), len(un.get("bbs_upazila_without_portal", [])))
        self.assertEqual(len([d for d in MASTER["districts"] if not d["portal"]]), len(un.get("bbs_district_without_portal", [])))
        self.assertEqual(len([u for u in MASTER["upazilas"] if u["kind"] == "upazila" and not u["legacy"]]), len(un.get("upazila_without_legacy_code", [])))
        counts = MASTER["meta"]["counts"]["unresolved"]
        for k, v in un.items():
            self.assertEqual(counts[k], len(v), f"meta count of {k} differs from the list")

    def test_name_only_links_are_never_made(self):
        for level in ("divisions", "districts", "upazilas", "unions"):
            for x in self.linked(MASTER[level]):
                self.assertIn("code", x["portal"]["match"], f"{level} {x['code']}: not a code-based link")
                self.assertIn("name", x["portal"]["match"])
        for u in MASTER["unresolved"].get("portal_upazila_unlinked", []):
            self.assertIn("NOT accepted", u["reason"])

    def test_pairs_whose_names_only_look_alike_are_listed_for_review(self):
        listed = {(x["level"], x["code"]) for x in MASTER["unresolved"].get("linked_name_differs", [])}
        for level, items in (("upazila", MASTER["upazilas"]), ("union", MASTER["unions"])):
            for x in self.linked(items):
                if x["portal"]["name_match"] == "differs":
                    self.assertIn((level, x["code"]), listed)


if __name__ == "__main__":
    unittest.main()
