"""Build src/data/master_areas.json: the canonical Bangladesh area list (BBS base) reconciled with the national portal list.

  BBS base   tools/sources/bbs_cod_ab_v03.json   (made by tools/extract_bbs_source.py from the official HDX tables, CC BY-IGO)
  Portal     src/data/areas_bangladesh.json      (national portal; adds the Bangla names)

Rules (docs/plans/nationwide/BUILD_PLAN_NATIONWIDE.md, M1 step 1.1; issue #346):
  * BBS is the base. Every BBS unit appears once in the master list, with its official code, name and parent.
  * A portal entry is linked to a BBS entry only when CODE and NAME both agree and the parent agrees. Never by name alone.
  * Links are one to one. Anything that cannot be linked stays UNRESOLVED and is listed in the report; nothing is guessed.
  * Old to new upazila codes (the 2020 point table uses 8-digit level-3 codes, the 2023 polygon table 10-digit ones):
    new = old[:6] + "00" + old[6:]. This is a derived rule, not an official table: every pair keeps a name_match grade
    (exact / spelling / differs) and the "differs" pairs are listed for confirmation from an official source.
  * No administrative name, code or parent is invented, and no fix from the plan is applied without a cited official source.

Usage: python tools/build_master_areas.py <data folder> [--source tools/sources/bbs_cod_ab_v03.json] [--report docs/reports/MASTER_AREAS_REVIEW.md]
Standard library only.
"""
import collections, difflib, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ARGV = sys.argv[1:]


def opt(name, default):
    if name in ARGV:
        i = ARGV.index(name)
        value = ARGV[i + 1]
        del ARGV[i:i + 2]
        return value
    return default


SOURCE = opt("--source", os.path.join(HERE, "sources", "bbs_cod_ab_v03.json"))
REPORT = opt("--report", os.path.join(HERE, "..", "docs", "reports", "MASTER_AREAS_REVIEW.md"))
DATA = ARGV[0] if ARGV else os.path.join(HERE, "..", "src", "data")
PLAN_EXPECTED = {"divisions": 8, "districts": 64, "upazila_level": 507, "union_points": 5160, "unions": 4565, "pourashava_ward_points": 595}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def key(s):
    """Spelling-tolerant key (the same idea as tools/build_locations.py): 'Senbag' ~ 'Senbagh', 'Noakhali Sadar (Sudharam)' ~ 'Noakhali Sadar'."""
    low = (s or "").lower()
    s = re.sub(r"\(.*?\)|union|paurashava|pourashava|municipality|city corporation|upazila|sadar|[^a-z]", "", low)
    if not s:                                    # a name that is only "Sadar": keep it
        s = re.sub(r"[^a-z]", "", low)
    for a, b in (("ph", "f"), ("kh", "k"), ("gh", "g"), ("bh", "b"), ("dh", "d"), ("th", "t"), ("sh", "s"), ("ch", "c"),
                 ("aa", "a"), ("ee", "i"), ("oo", "u"), ("ou", "u"), ("y", "i"), ("w", "o"), ("z", "j"), ("h", "")):
        s = s.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", s)


def similarity(a, b):
    ka, kb = key(a), key(b)
    if not ka or not kb:
        return 0.0
    return 1.0 if ka == kb else difflib.SequenceMatcher(None, ka, kb).ratio()


def grade(a, b):
    s = similarity(a, b)
    return "exact" if s == 1.0 else "spelling" if s >= 0.80 else "differs"


def best(name, entry):
    """Similarity to the current BBS name or to the 2020 BBS spelling of the same code (both are official BBS names)."""
    return max(similarity(name, entry["name_en"]), similarity(name, entry.get("legacy_name") or ""))


def best_grade(name, entry):
    s = best(name, entry)
    return "exact" if s == 1.0 else "spelling" if s >= 0.80 else "differs"


def code_int(value):
    value = str(value).strip()
    return int(value) if value.isdigit() else None


def main():
    bbs = load(SOURCE)
    portal = load(os.path.join(DATA, "areas_bangladesh.json"))
    unresolved = collections.defaultdict(list)       # category -> list of dicts
    note = lambda cat, **kw: unresolved[cat].append(kw)

    # ---------- BBS base ----------
    divisions = {d["code"]: d for d in bbs["divisions"]}
    districts = {d["code"]: d for d in bbs["districts"]}
    upazilas = {u["code"]: u for u in bbs["upazilas"]}
    assert len(divisions) == len(bbs["divisions"]) and len(districts) == len(bbs["districts"]) and len(upazilas) == len(bbs["upazilas"]), "duplicate BBS code"
    old3 = {p["code"]: p for p in bbs["points3"]}
    legacy_div = {p["code"]: p["name"] for p in bbs["points1"]}
    legacy_dis = {p["code"]: p["name"] for p in bbs["points2"]}

    master_div = {c: {"code": c, "name_en": d["name"], "legacy_name": legacy_div.get(c), "name_bn": None, "portal": None} for c, d in divisions.items()}
    master_dis = {c: {"code": c, "name_en": d["name"], "legacy_name": legacy_dis.get(c), "name_bn": None, "division": d["division"], "portal": None} for c, d in districts.items()}
    master_upz = {}
    for c, u in upazilas.items():
        city = "city corporation" in u["name"].lower()
        master_upz[c] = {"code": c, "name_en": u["name"], "name_bn": None, "district": u["district"], "kind": "city_corporation" if city else "upazila",
                         "lat": u["lat"], "lon": u["lon"], "legacy_code": None, "legacy_name": None, "legacy_name_match": None, "portal": None}
    # old 8-digit -> new 10-digit (derived rule, graded by name)
    legacy_to_new = {}
    for c in upazilas:
        old = c[:6] + c[8:]
        if old in old3:
            legacy_to_new[old] = c
            m = master_upz[c]
            m["legacy_code"], m["legacy_name"] = old, old3[old]["name"]
            m["legacy_name_match"] = grade(upazilas[c]["name"], old3[old]["name"])
    for c, m in master_upz.items():
        if m["kind"] == "upazila" and m["legacy_code"] is None:
            note("upazila_without_legacy_code", code=c, name=m["name_en"], district=districts[m["district"]]["name"],
                 reason="no 2020 point with the derived old code: a new upazila; its unions are still filed under an older upazila in the 2020 point table")
        if m["legacy_name_match"] == "differs":
            note("legacy_pair_name_differs", code=c, name=m["name_en"], legacy_code=m["legacy_code"], legacy_name=m["legacy_name"], district=districts[m["district"]]["name"],
                 reason="same derived code, different name (rename or different spelling): confirm from an official source")
    for old, p in old3.items():
        if old not in legacy_to_new:
            note("old_point_without_new_upazila", code=old, name=p["name"], district=districts[p["district"]]["name"],
                 reason="old upazila or metropolitan thana point with no 2023 unit: its union / ward points cannot be given a 2023 parent")

    master_uni = {}
    for p in bbs["points4"]:
        n = p["name"].lower()
        kind = "pourashava" if re.search(r"p(?:au|ou)rashav?a?\b|municipal", n) else "ward" if re.search(r"\bward\b", n) else "union"
        parent = legacy_to_new.get(p["parent"])
        status = "no_portal_match" if parent else "parent_unresolved"
        master_uni[p["code"]] = {"code": p["code"], "name_en": p["name"], "name_bn": None, "kind_hint": kind, "upazila": parent,
                                 "legacy_upazila_code": p["parent"], "lat": p["lat"], "lon": p["lon"], "portal": None, "status": status}
        if not parent:
            note("union_point_parent_unresolved", code=p["code"], name=p["name"], legacy_parent=p["parent"],
                 parent_name=old3[p["parent"]]["name"], district=districts[p["district"]]["name"], reason="its old parent has no 2023 unit")

    # ---------- portal: divisions and districts ----------
    used_div, used_dis = set(), set()
    for pdiv in portal["divisions"]:
        code = f"BD{int(pdiv['bbs']):02d}" if code_int(pdiv.get("bbs")) is not None else None
        target = master_div.get(code)
        if target and code not in used_div and best(pdiv["en"], target) >= 0.75:
            used_div.add(code)
            target["name_bn"], target["portal"] = pdiv["bn"], {"code": str(pdiv["bbs"]), "name_en": pdiv["en"], "match": "code+name", "name_match": best_grade(pdiv["en"], target)}
        else:
            by_name = next((f"{c} {d['name_en']}" for c, d in master_div.items() if best(pdiv["en"], d) >= 0.9), None)
            note("portal_division_unlinked", portal_code=pdiv.get("bbs"), name=pdiv["en"], same_name_bbs_division_with_other_code=by_name,
                 reason="no BBS division with the same code and a matching name (a name-only candidate is NOT accepted)")
        for pdis in pdiv["districts"]:
            # BBS district codes (2 digits) are unique across the country. The parent is checked by the division NAME,
            # because the portal's division code for Sylhet (70) differs from BBS (BD60).
            dnum = code_int(pdis.get("bbs"))
            cands = [c for c, d in master_dis.items() if dnum is not None and int(c[-2:]) == dnum and c not in used_dis]
            target = next((master_dis[c] for c in cands if best(pdis["en"], master_dis[c]) >= 0.75 and best(pdiv["en"], master_div[master_dis[c]["division"]]) >= 0.75), None)
            if target:
                used_dis.add(target["code"])
                target["name_bn"], target["portal"] = pdis["bn"], {"code": str(pdis["bbs"]), "name_en": pdis["en"], "match": "code+name+parent(name)", "name_match": best_grade(pdis["en"], target)}
            else:
                other = cands[0] if cands else None
                note("portal_district_unlinked", portal_code=pdis.get("bbs"), name=pdis["en"], portal_division=pdiv["en"],
                     bbs_candidate_same_district_code=other and f"{other} {master_dis[other]['name_en']} (division {master_dis[other]['division']})",
                     reason="no BBS district with the same district code, a matching name and a matching division name")
    for c, m in master_dis.items():
        if m["portal"] is None:
            note("bbs_district_without_portal", code=c, name=m["name_en"], reason="no portal district linked")

    # ---------- portal: upazilas and unions ----------
    upz_by_district = collections.defaultdict(list)
    for c, m in master_upz.items():
        upz_by_district[m["district"]].append(c)
    uni_by_upazila = collections.defaultdict(list)
    for c, m in master_uni.items():
        if m["upazila"]:
            uni_by_upazila[m["upazila"]].append(c)
    used_upz, used_uni = set(), set()
    portal_counts = collections.Counter()
    for pdiv in portal["divisions"]:
        for pdis in pdiv["districts"]:
            dcode = next((c for c, m in master_dis.items() if m["portal"] and m["portal"]["code"] == str(pdis["bbs"]) and m["portal"]["name_en"] == pdis["en"]), None)
            portal_counts["districts"] += 1
            for pupz in pdis["upazilas"]:
                portal_counts["upazilas"] += 1
                pcode = code_int(pupz.get("bbs"))
                hit = None
                if dcode and pcode is not None:
                    hit = next((c for c in upz_by_district[dcode] if master_upz[c]["kind"] == "upazila" and int(c[-4:]) == pcode and c not in used_upz
                                and best(pupz["en"], {"name_en": master_upz[c]["name_en"], "legacy_name": master_upz[c]["legacy_name"]}) >= 0.75), None)
                if hit:
                    used_upz.add(hit)
                    m = master_upz[hit]
                    m["name_bn"], m["portal"] = pupz["bn"], {"code": str(pupz["bbs"]), "name_en": pupz["en"], "match": "code+name+parent", "name_match": best_grade(pupz["en"], {"name_en": m["name_en"], "legacy_name": m["legacy_name"]})}
                else:
                    cand = next((c for c in upz_by_district.get(dcode, []) if best(pupz["en"], {"name_en": master_upz[c]["name_en"], "legacy_name": master_upz[c]["legacy_name"]}) >= 0.9), None)
                    cand_code_name = next((f"{c} {master_upz[c]['name_en']}" for c in upz_by_district.get(dcode, []) if pcode is not None and int(c[-4:]) == pcode), None)
                    note("portal_upazila_unlinked", portal_code=pupz.get("bbs") or "(empty)", name=pupz["en"], district=pdis["en"], unions=len(pupz.get("unions", [])),
                         same_name_bbs_candidate=cand and f"{cand} {master_upz[cand]['name_en']}",
                         bbs_unit_with_same_code=cand_code_name,
                         reason="code and name do not both match a BBS upazila of this district (a name-only candidate is NOT accepted)")
                for puni in pupz.get("unions", []):
                    portal_counts["unions"] += 1
                    ucode = code_int(puni.get("bbs"))
                    uhit = None
                    if hit and ucode is not None:
                        uhit = next((c for c in uni_by_upazila[hit] if c not in used_uni and int(c[-2:]) == ucode and similarity(puni["en"], master_uni[c]["name_en"]) >= 0.75), None)
                    if uhit:
                        used_uni.add(uhit)
                        mu = master_uni[uhit]
                        mu["name_bn"], mu["portal"], mu["status"] = puni["bn"], {"code": str(puni["bbs"]), "name_en": puni["en"], "match": "code+name+parent", "name_match": grade(puni["en"], mu["name_en"])}, "linked"
                    else:
                        note("portal_union_unlinked", portal_code=puni.get("bbs") or "(empty)", name=puni["en"], upazila=pupz["en"], district=pdis["en"],
                             reason="parent upazila not linked" if not hit else "no BBS union under this upazila with the same code and a matching name")
    for level, items in (("upazila", master_upz.values()), ("union", master_uni.values())):
        for m in items:
            if m["portal"] and m["portal"]["name_match"] == "differs":
                note("linked_name_differs", level=level, code=m["code"], bbs_name=m["name_en"], portal_name=m["portal"]["name_en"], portal_code=m["portal"]["code"],
                     reason="code and parent agree, names are only similar: confirm from an official source")
    # ---------- BBS units without a portal partner ----------
    for c, m in master_upz.items():
        if m["portal"] is None:
            note("bbs_upazila_without_portal", code=c, name=m["name_en"], kind=m["kind"], district=districts[m["district"]]["name"],
                 reason="city corporation: not in the portal" if m["kind"] == "city_corporation" else "no portal upazila linked")
    unions_without_portal = collections.Counter()
    for c, m in master_uni.items():
        if m["status"] == "no_portal_match":
            unions_without_portal[m["upazila"]] += 1

    # ---------- counts ----------
    kinds = collections.Counter(m["kind_hint"] for m in master_uni.values())
    counts = {
        "bbs": {"divisions": len(master_div), "districts": len(master_dis), "upazila_level": len(master_upz),
                "upazilas": sum(1 for m in master_upz.values() if m["kind"] == "upazila"), "city_corporations": sum(1 for m in master_upz.values() if m["kind"] == "city_corporation"),
                "union_points": len(master_uni), "by_name_pattern": dict(kinds)},
        "portal": {"divisions": len(portal["divisions"]), "districts": portal_counts["districts"], "upazila_entries": portal_counts["upazilas"], "union_entries": portal_counts["unions"]},
        "linked": {"divisions": sum(1 for m in master_div.values() if m["portal"]), "districts": sum(1 for m in master_dis.values() if m["portal"]),
                   "upazilas": sum(1 for m in master_upz.values() if m["portal"]), "unions": sum(1 for m in master_uni.values() if m["portal"])},
        "unresolved": {k: len(v) for k, v in sorted(unresolved.items())},
    }

    # ---------- write master_areas.json ----------
    src = bbs["source"]
    master = {
        "meta": {
            "what": "Canonical Bangladesh area list: BBS base, reconciled one to one with the national portal list. Used by tools and tests, not loaded by phones.",
            "built_by": "tools/build_master_areas.py",
            "bbs_source": {k: src[k] for k in ("dataset", "publisher", "original_source", "page", "file_url", "file_last_modified_on_hdx", "retrieved_on", "file_sha256",
                                               "polygon_table_valid_on", "point_table_valid_on", "licence", "attribution", "modification_notice")},
            "portal_source": {"file": "src/data/areas_bangladesh.json", "retrieved_on": portal.get("retrieved_on"), "source": portal.get("source")},
            "code_rules": ["division BDnn; district BDnnnn (division + BBS district code); upazila-level unit: 10-digit 2023 code",
                           "union code: 10-digit code of the 2020 point table (old 8-digit parent + 2 digits), official; legacy_upazila_code is its official old parent code",
                           "DERIVED (not official): upazilas[].legacy (old 8-digit code, name and the grade of the name match) and unions[].derived_upazila (the 2023 parent, null when unresolved); "
                           "the old to new link is the rule new = old[:6] + '00' + old[6:], see tools/build_master_areas.py"],
            "usage_rules": ["A position matched to a union point is the NEAREST UNION CENTRE, never an exact union: the current HDX dataset (v03) has no union polygons.",
                            "A 2020 BBS / OCHA ROAP union polygon set (5,160 units) exists only as a third-party copy (geoBoundaries; 12.5 MB simplified, 341 MB full; HDX origin page returns 404; "
                            "licence statements conflict). It is not used."],
            "portal_link_rule": "linked only when code, name and parent all agree; one to one; never by name alone",
            "counts": counts,
        },
        "divisions": sorted(master_div.values(), key=lambda x: x["code"]),
        "districts": sorted(master_dis.values(), key=lambda x: x["code"]),
        "upazilas": [upazila_out(m) for m in sorted(master_upz.values(), key=lambda x: x["code"])],
        "unions": [union_out(m) for m in sorted(master_uni.values(), key=lambda x: x["code"])],
        "unresolved": {k: v for k, v in sorted(unresolved.items()) if k not in ("old_point_without_new_upazila", "union_point_parent_unresolved")},
    }
    out = os.path.join(DATA, "master_areas.json")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(master, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {out}: {os.path.getsize(out):,} bytes")
    write_report(REPORT, bbs, portal, master, counts, unresolved, kinds, unions_without_portal)


def upazila_out(m):
    """Output shape of an upazila-level unit: the official fields stay as they are; the old-to-new link is nested and marked as derived."""
    o = {k: v for k, v in m.items() if not k.startswith("legacy_")}
    o["legacy"] = ({"code": m["legacy_code"], "name": m["legacy_name"], "link": "derived", "name_match": m["legacy_name_match"]} if m["legacy_code"] else None)
    return o


def union_out(m):
    """Output shape of a union point: the 2023 parent depends on the derived link, so it is named derived_upazila."""
    o = {k: v for k, v in m.items() if k != "upazila"}
    o["derived_upazila"] = m["upazila"]
    return o


def table(rows, headers):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(x).replace("|", "/") if x not in (None, "") else "-" for x in r) + " |")
    return out


def write_report(path, bbs, portal, master, counts, unresolved, kinds, unions_without_portal):
    src = bbs["source"]
    L = ["# Master area list: review report (M1.1, issue #346)", "",
         "Generated by `python tools/build_master_areas.py src/data`. Do not edit by hand.", "",
         "## 1. Sources", "",
         f"- **BBS base:** {src['dataset']}, {src['publisher']}; original source {src['original_source']}.",
         f"  - Page: {src['page']}",
         f"  - File used: `{src['file']}` (tabular data only), HDX last modified {src['file_last_modified_on_hdx']}, retrieved {src['retrieved_on']}, SHA-256 `{src['file_sha256']}`.",
         f"  - Validity: polygon tables {src['polygon_table_valid_on']} (levels 1 to 3, 2023 codes); point table {src['point_table_valid_on']} (union points, OLD 8-digit upazila codes).",
         f"  - **Licence: {src['licence']}.** Attribution: {src['attribution']}.",
         "- **National portal:** `src/data/areas_bangladesh.json` (bangladesh.gov.bd), used only for Bangla names and as the list to reconcile.",
         f"- **Modification notice:** {src['modification_notice']}",
         "- **No boundary polygons were downloaded or used.** The current HDX dataset (v03) has polygons for divisions, districts and upazila-level units only; unions are **points**. "
         "A 2020 BBS / OCHA ROAP union polygon set (5,160 units) exists only as a third-party copy (geoBoundaries: simplified file 12.5 MB, full file 341 MB, sizes read from headers only). "
         "Its HDX origin page returns 404 and its licence statements conflict (CC BY 3.0 IGO there, ODbL on another HDX entry), so it is **not used**. "
         "**Rule:** a result from these points is called the *nearest union centre*, never an exact union.", "",
         "## 2. Expected vs actual counts", ""]
    c = counts
    rows = [
        ("Divisions", PLAN_EXPECTED["divisions"], c["bbs"]["divisions"], c["portal"]["divisions"], c["linked"]["divisions"]),
        ("Districts", PLAN_EXPECTED["districts"], c["bbs"]["districts"], c["portal"]["districts"], c["linked"]["districts"]),
        ("Upazila-level units (495 upazilas + 12 city corporations)", PLAN_EXPECTED["upazila_level"], c["bbs"]["upazila_level"], c["portal"]["upazila_entries"], c["linked"]["upazilas"]),
        ("Union / pourashava / ward points", PLAN_EXPECTED["union_points"], c["bbs"]["union_points"], c["portal"]["union_entries"], c["linked"]["unions"]),
    ]
    L += table(rows, ["Level", "Plan expects (BBS)", "BBS actual", "Portal entries", "Linked 1:1 (portal to BBS)"]) + [""]
    L += [f"- BBS upazilas: {c['bbs']['upazilas']}; city corporations: {c['bbs']['city_corporations']}.",
          f"- Union points by name pattern (whole words): {dict(kinds)}. The plan expects {PLAN_EXPECTED['unions']} unions + {PLAN_EXPECTED['pourashava_ward_points']} pourashava/ward points; "
          f"the name pattern gives {kinds['union']} + {kinds['pourashava'] + kinds['ward']} "
          f"({'the same as the plan' if (kinds['union'], kinds['pourashava'] + kinds['ward']) == (PLAN_EXPECTED['unions'], PLAN_EXPECTED['pourashava_ward_points']) else 'DIFFERENT from the plan: review'}). "
          "The split is a hint only (`kind_hint`), not an official classification.",
          "- The T1 tests fail if any of these counts changes silently.", "",
          "## 3. Unresolved records (nothing here was guessed)", "",
          "| Category | Count | Meaning |", "|---|---|---|"]
    meaning = {
        "portal_division_unlinked": "portal division with no BBS division of the same code and name",
        "portal_district_unlinked": "portal district with no BBS district of the same division + district code and name",
        "bbs_district_without_portal": "BBS district with no portal partner",
        "portal_upazila_unlinked": "portal upazila whose code and name do not both match a BBS upazila of the district",
        "bbs_upazila_without_portal": "BBS upazila-level unit with no portal partner (all 12 city corporations are expected here)",
        "portal_union_unlinked": "portal union with no BBS union of the same code and name under the linked upazila",
        "upazila_without_legacy_code": "2023 upazila with no old 8-digit code (new upazila): its unions are filed under an older upazila",
        "legacy_pair_name_differs": "old and new upazila share the derived code but the names differ (rename or spelling)",
        "linked_name_differs": "portal and BBS entries linked by code + parent, but the names are only similar",
        "old_point_without_new_upazila": "2020 upazila / metropolitan thana point with no 2023 unit",
        "union_point_parent_unresolved": "BBS union / ward point whose old parent has no 2023 unit (not given a 2023 parent)",
    }
    for k in sorted(unresolved):
        L.append(f"| `{k}` | {len(unresolved[k])} | {meaning.get(k, '')} |")
    L += ["", f"BBS union points linked to a portal union: **{c['linked']['unions']}** of {c['bbs']['union_points']}; "
          f"with a 2023 parent but no portal partner: **{sum(unions_without_portal.values())}**.", "",
          "## 4. Cases named in the plan (`BUILD_PLAN_NATIONWIDE.md` / `COVERAGE_PLAN.md`): status after M1.1", "",
          "The plan lists fixes that need an official upazila or union website. **None is applied in M1.1** (no cited source yet); each stays explicitly unresolved.", ""]
    L += plan_cases(bbs, portal, master)
    L += ["", "## 5. Full lists", "", "The complete records are in `src/data/master_areas.json` (`unresolved`, and `status` on every union). Lists of the smaller categories follow; the union lists are summarised per upazila.", ""]
    for cat in ("portal_division_unlinked", "portal_district_unlinked", "bbs_district_without_portal", "bbs_upazila_without_portal", "portal_upazila_unlinked",
                "legacy_pair_name_differs", "linked_name_differs", "upazila_without_legacy_code"):
        items = unresolved.get(cat, [])
        L += [f"### `{cat}` ({len(items)})", ""]
        if items:
            heads = list(items[0].keys())
            L += table([[i.get(h) for h in heads] for i in items], heads)
        L += [""]
    per = collections.Counter((i["upazila"], i["district"]) for i in unresolved.get("portal_union_unlinked", []))
    L += [f"### `portal_union_unlinked` ({sum(per.values())}), by portal upazila", ""]
    L += table([[u, d, n] for (u, d), n in sorted(per.items())], ["Portal upazila", "District", "Unions unlinked"]) + [""]
    per2 = collections.Counter((i["parent_name"], i["district"]) for i in unresolved.get("union_point_parent_unresolved", []))
    L += [f"### `union_point_parent_unresolved` ({sum(per2.values())}), by old parent point", ""]
    L += table([[u, d, n] for (u, d), n in sorted(per2.items())], ["Old parent (2020 point)", "District", "Union / ward points"]) + [""]
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L) + "\n")
    print(f"wrote {path}: {len(L)} lines")


def plan_cases(bbs, portal, master):
    """For each case in the plan, what the two data sets actually contain today (looked up by name; no fix is applied)."""
    def bbs_up(name):
        return [u for u in master["upazilas"] if key(u["name_en"]) == key(name)]
    def portal_up(name):
        return [(d["en"], u["en"], len(u.get("unions", [])), u.get("bbs")) for v in portal["divisions"] for d in v["districts"] for u in d["upazilas"] if key(u["en"]) == key(name)]
    cases = [("Khetlal (Joypurhat) and its 5 unions", "Khetlal"), ("Kabirhat (Noakhali) and its 7 unions", "Kabirhat"), ("Mokamtala (Bogura): not an upazila", "Mokamtala"),
             ("Bhulli / Ruhia / Chandraganj / Dakkhin Gafargaon: not upazilas", "Bhulli"), ("Osmaninagar (1 union only)", "Osmaninagar"), ("Shayestaganj (1 union only)", "Shayestaganj"),
             ("Bandar (portal code is Rupganj's)", "Bandar"), ("Rupganj", "Rupganj"), ("Eidgaon (new upazila)", "Eidgaon"), ("Lalmai (new upazila)", "Lalmai"),
             ("Guimara (new upazila)", "Guimara"), ("Karnaphuli (new upazila)", "Karnaphuli"), ("Dasar (new upazila)", "Dasar"), ("Naldanga (new upazila)", "Naldanga"),
             ("Madhyanagar (new upazila)", "Madhyanagar"), ("Indurkani (old name Zianagar)", "Indurkani"), ("Shantiganj (old name Dakshin Sunamganj)", "Shantiganj"),
             ("Char Fasson (no union list in the portal)", "Char Fasson"), ("Rajapur (no union list)", "Rajapur"), ("Galachipa (no union list)", "Galachipa"),
             ("Bagerhat Sadar (no union list)", "Bagerhat Sadar"), ("Panchbibi (no union list)", "Panchbibi"), ("Purbadhala (no union list)", "Purbadhala")]
    rows = []
    for label, name in cases:
        b = bbs_up(name)
        p = portal_up(name)
        b_txt = "; ".join(f"{u['code']} {u['name_en']} ({u['kind']}), linked to portal: {'yes' if u['portal'] else 'no'}, unions with this 2023 parent: {sum(1 for x in master['unions'] if x['derived_upazila'] == u['code'])}" for u in b) or "not in BBS 2023 units"
        p_txt = "; ".join(f"{d}: {n} (code {c or 'empty'}, {k} unions)" for d, n, k, c in p) or "not in the portal"
        rows.append([label, b_txt, p_txt, "unresolved: needs the official upazila / union website"])
    return table(rows, ["Case in the plan", "BBS 2023 now", "Portal now", "Status"])


if __name__ == "__main__":
    main()
