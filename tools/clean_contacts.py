"""Clean a built contacts_<district>.json file (rules from issue #20). build_contacts.py also runs this.

Usage: python tools/clean_contacts.py data/contacts_noakhali.json data/contacts_coxsbazar.json
(the files are cleaned in place; a short report of every change is printed)

What it fixes, without guessing anything:
  - a row number in the name cell with the real name in the designation cell -> the name moves back;
    the number is a row number, not the ward, so it is dropped
  - a job title in the name cell ("চেয়ারম্যান", "গ্রাম পুলিশ") -> moved to the designation; the name stays empty
  - ID numbers glued to names ("নাম(১৬১১৭)"), repeated vowel signs ("বাচ্চুূুুু"), extra spaces
  - phones: a date (DDMMYYYY) is not a phone; landlines need 9-11 digits, mobiles 01[3-9] + 8 digits.
    Anything else is removed and the record gets "needs_manual_check". A number is never built from another field.
  - emails: only valid addresses are kept (lower case); anything else becomes empty
  - an upazila OC or health officer filed as "administration" gets the right category
  - lower-case English union names ("toitong" -> "Toitong")
  - UDC entrepreneurs are removed: they are private people, not government officials
"""
import collections as C, json, re, sys, unicodedata as U

N = lambda s: " ".join(U.normalize("NFC", s or "").replace("‍", "").replace("‌", "").split())
DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
ONLY_NUMBER = re.compile(r"[০-৯0-9 ]+")
DATE = re.compile(r"(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(19|20)\d\d")
MOBILE = re.compile(r"01[3-9]\d{8}")
EMAIL = re.compile(r"[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}")
GLUED_ID = re.compile(r"\s*[(\-–]\s*[০-৯0-9]{3,}\s*\)?$")
REPEATED_SIGNS = re.compile(r"([া-ৌৗ])[া-ৌৗ]+")
JOB_TITLE = re.compile(N(r"চেয়ারম্যান|মেম্বার|সদস্য|সচিব|জনপ্রতিনিধি|প্রশাসক|দফাদার|গ্রাম পুলিশ|মহল্লাদার|"
                          r"অফিসার|কর্মকর্তা|এম\.?ইউ\.?পি|এসআই|এএসআই|ইন্সপেক্টর"))
FILLER = re.compile(N(r"ইউনিয়ন|পরিষদের|পরিষদ|ইউপি|পৌর|নির্বাহী|ডিউটি|সেকেন্ড|মহিলা|সংরক্ষিত|আসন|নং|ওয়ার্ড|নিরস্ত্র|প্যানেল|প্রোফাইল|"
                       r"[০-৯0-9(),.\-–’'/:]"))
MEMBER = re.compile(N(r"সদস্য|মেম্বার"))
NOT_A_TITLE = re.compile(N(r"[০-৯0-9 ]*|সকল ওয়ার্ড|.*নং ওয়ার্ড"))   # a cell holding only a number or a ward
SPLIT = re.compile(r"(?P<name>.+?)\s*[(\-–]\s*(?P<title>[^()\-–]+?)\s*\)?")   # "নাম (দফাদার)", "নাম -গ্রাম পুলিশ"
PRIVATE = re.compile(N(r"উদ্যোক্তা|উদ্দ্যোক্তা|ইউডিসি|\bUDC\b"), re.I)
CATEGORY = [("police", re.compile(N(r"অফিসার ইনচার্জ"))),
            ("health", re.compile(N(r"স্বাস্থ্য ও পরিবার পরিকল্পনা কর্মকর্তা")))]


def fix_text(s):
    s = REPEATED_SIGNS.sub(r"\1", N(s)).replace("প্রোফাইল", "")
    s = GLUED_ID.sub("", N(s)).strip(" ,।-:◙")
    return None if not s or ONLY_NUMBER.fullmatch(s) else s


def is_title(s):
    """True if the text is only a job title (no person's name left after removing title words)."""
    return bool(JOB_TITLE.search(s)) and not FILLER.sub("", JOB_TITLE.sub("", s)).strip()


def phone_ok(p):
    if DATE.fullmatch(p):
        return False
    return bool(MOBILE.fullmatch(p)) if p.startswith("01") else 9 <= len(p) <= 11


def fix_names(r, report):
    name, des = (N(N(r.get(k)).replace("প্রোফাইল", "").replace("◙", "")) for k in ("name_bn", "designation_bn"))
    name_is_empty = not name or ONLY_NUMBER.fullmatch(name) or is_title(name)
    split_name, split_des = SPLIT.fullmatch(name), SPLIT.fullmatch(des)
    if (split_name and (not des or NOT_A_TITLE.fullmatch(des))
            and is_title(split_name["title"]) and not is_title(split_name["name"])):
        name, des = split_name["name"], split_name["title"]          # "জসিম উদ্দিন (দফাদার)"
        report["name and title split"] += 1
    elif (split_des and name_is_empty
            and is_title(split_des["title"]) and not is_title(split_des["name"]) and not ONLY_NUMBER.fullmatch(split_des["name"])):
        name, des = split_des["name"], split_des["title"]            # "৩" | "মোঃ জহির উদ্দিন -গ্রাম পুলিশ"
        report["name and title split"] += 1
    elif ONLY_NUMBER.fullmatch(name) and des and not JOB_TITLE.search(des) and not NOT_A_TITLE.fullmatch(des):
        name, des = des, ""
        report["name moved back from designation"] += 1
    elif name and is_title(name) and des and not JOB_TITLE.search(des) and not NOT_A_TITLE.fullmatch(des):
        name, des = des, name                                      # title and name in swapped cells
        report["name and title swapped"] += 1
    elif name and is_title(name):
        if sum(c.isdigit() for c in des.translate(DIGITS)) >= 6:   # a broken phone number in the designation cell
            r["flags"].append("needs_manual_check")
        if des and JOB_TITLE.search(des) and not NOT_A_TITLE.fullmatch(des):
            des = des if name in des else f"{name}, {des}"         # both cells are titles: keep both
        else:
            des = name
        name = ""
        report["job title moved from name to designation"] += 1
    if len(MEMBER.findall(f"{name} {des}")) >= 3 and "needs_manual_check" not in r["flags"]:
        r["flags"].append("needs_manual_check")                    # several council members listed in one cell
        report["several people in one cell (flagged)"] += 1
    new_name, new_des = fix_text(name), fix_text(des)
    if name and not new_name:
        report["number-only name removed"] += 1
    elif name and new_name != name:
        report["name tidied (ID number, vowel signs)"] += 1
    r["name_bn"], r["designation_bn"] = new_name, new_des
    if new_des and "designation_missing" in r["flags"]:
        r["flags"].remove("designation_missing")
    if not new_des and "designation_missing" not in r["flags"]:
        r["flags"].append("designation_missing")


def fix_phones(r, report):
    good = [p for p in r["phones"] if phone_ok(p)]
    for p in r["phones"]:
        if p not in good:
            report["date removed from phones" if DATE.fullmatch(p) else "invalid number removed"] += 1
    if len(good) < len(r["phones"]):
        r["phones"] = good
        r["flags"].append("needs_manual_check")
        return True
    return False


def fix_email(r, report):
    old = r.get("email")
    parts = [p.lower() for p in re.split(r"[,/;\s]+", N(old)) if p]
    new = ", ".join(p for p in parts if EMAIL.fullmatch(p)) or None
    if new != old:
        report["email cleaned" if new else "invalid email removed"] += 1
        r["email"] = new


def fix_category(r, report):
    if r["category"] == "administration":
        for category, pattern in CATEGORY:
            if pattern.search(r.get("designation_bn") or ""):
                r["category"] = category
                report[f"category administration -> {category}"] += 1
                return


def fix_union_en(item, report):
    if item.get("union_en") and item["union_en"][0].islower():
        item["union_en"] = item["union_en"].title()
        report["union_en capitalised"] += 1


def clean_doc(doc):
    """Clean one district document in place and return a Counter describing every change."""
    report = C.Counter()
    keep = []
    for r in doc["records"]:
        if PRIVATE.search((r.get("designation_bn") or "") + " " + (r.get("name_bn") or "")):
            report["private person (UDC entrepreneur) removed"] += 1
            continue
        fix_names(r, report)
        phones_changed = fix_phones(r, report)
        fix_email(r, report)
        fix_category(r, report)
        fix_union_en(r, report)
        r["flags"] = list(dict.fromkeys(r["flags"]))
        r["_phones_changed"] = phones_changed
        keep.append(r)
    counts = C.Counter(p for r in keep for p in r["phones"])
    for r in keep:                            # re-check the shared-number flag only where phones changed
        if r.pop("_phones_changed"):
            shared = any(counts[p] > 2 for p in r["phones"])
            r["flags"] = [f for f in r["flags"] if f != "number_shared_by_several_records"] + (["number_shared_by_several_records"] if shared else [])
    for u in doc.get("unions", []):
        fix_union_en(u, report)
    doc["records"] = keep
    return report


def main(paths):
    for path in paths:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        before = len(doc["records"])
        report = clean_doc(doc)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
        print(f"{path}: {before} -> {len(doc['records'])} records")
        for change, n in report.most_common():
            print(f"  {n:4d}  {change}")


if __name__ == "__main__":
    main(sys.argv[1:])
