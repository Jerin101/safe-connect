"""Shared rules for data/places/*.json (OSM places and manual places). Standard library only.

Used by validate_data.py, import_manual_places.py and the OSM build step, so every place is checked
the same way. Each check returns a list of (level, message) with level "error" or "warning".
"""
import datetime
import math
import re
import unicodedata
import urllib.parse

# MASTER_PLAN categories -> the subcategories we take from OpenStreetMap
OSM_SUBCATEGORIES = {
    "health": {"hospital", "clinic", "doctors", "pharmacy", "chemist"},
    "shops": {"supermarket", "convenience", "general", "mall", "marketplace"},
    "workshops": {"car_repair", "motorcycle_repair", "motorcycle", "bicycle", "mobile_phone", "craft"},
    "fuel_transport": {"fuel", "bus_station", "ferry_terminal"},
    "money": {"bank", "atm"},
    "public_offices": {"police", "fire_station"},
}
CATEGORY_OF = {sub: cat for cat, subs in OSM_SUBCATEGORIES.items() for sub in subs}
CATEGORIES = set(OSM_SUBCATEGORIES)

# verified_by -> MASTER_PLAN source
VERIFIED_BY = {"official_list": "official", "owner_page": "owner", "visited": "user"}
LOCATION_SOURCES = {"official_list", "owner_page", "visited_gps"}
TEAM = {"jerin101", "tasmintoshi"}

# Google Maps data never goes into our data. Each host also covers its subdomains
# (maps.google.com, docs.google.com, maps.app.goo.gl, www.google.com.bd, ...).
BANNED_HOSTS = ("google.com", "google.com.bd", "goo.gl", "g.page")
# Open Location Code ("plus code"), e.g. V3P8+2F or 7MJ4V3P8+2F
PLUS_CODE = re.compile(r"(?<![0-9A-Za-z])[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(?![0-9A-Za-z])", re.I)
# a banned host written anywhere in a text, with or without https:// and in any case: "maps.app.goo.gl/x", "WWW.GOOGLE.COM/maps"
BANNED_IN_TEXT = re.compile(r"(?<![a-z0-9.-])(?:[a-z0-9-]+\.)*(?:google\.com\.bd|google\.com|goo\.gl|g\.page)(?![a-z0-9-])", re.I)
OFFICIAL = re.compile(r"^https://([a-z0-9-]+\.)*(gov\.bd|acc\.org\.bd)(/|$)", re.I)
FACEBOOK = re.compile(r"^https://((www|m|web|mbasic|touch)\.)?(facebook\.com|fb\.com)/", re.I)
FACEBOOK_SHORT = re.compile(r"^https?://(fb\.me|fb\.watch|fb\.gg)/", re.I)
# a shop's own page is fine; groups and other people's posts are not
FACEBOOK_NOT_A_PAGE = re.compile(r"(facebook|fb)\.com/(groups/|share/|story\.php|permalink\.php|photo\.php|photos?/|watch/|"
                                 r"reel/|events/|p/|[^/?#]+/(posts|videos|photos|reels)/)", re.I)
PHONE_IN_TEXT = re.compile(r"(?<![0-9])(?:\+?88)?01[3-9][0-9]{2}[\s-]?[0-9]{6}(?![0-9])")
NOT_FREE_TEXT = {"phone", "id", "source_url", "place_node"}
OSM_URL = re.compile(r"^https://www\.openstreetmap\.org/(node|way|relation)/([0-9]+)$")
OSM_ID = re.compile(r"^osm-([nwr])([0-9]+)$")
MANUAL_ID = re.compile(r"^man-[a-z]+-[0-9]+$")
ISO_DATE = re.compile(r"^20[0-9]{2}-[01][0-9]-[0-3][0-9]$")
# [0-9], not \d: \d also matches Bangla digits
MOBILE = re.compile(r"^01[3-9][0-9]{8}$")
LANDLINE = re.compile(r"^0[2-9][0-9]{7,9}$")
BD_BOX = (20.5, 26.7, 88.0, 92.75)          # lat min, lat max, lon min, lon max
GOOGLE_WORD = re.compile(r"google|গুগল", re.I)
MAX_GZIP = 120 * 1024


def slug(district_en):
    """File name part for a district: "Cox's Bazar" -> "coxsbazar" (same as data/landmarks/)."""
    return re.sub(r"[^a-z]", "", (district_en or "").lower())


def nfc(s):
    return " ".join(unicodedata.normalize("NFC", s or "").split())


def name_key(s):
    """Loose key to spot the same name written twice."""
    return re.sub(r"[\s.,'’()\-]+", "", nfc(s).lower())


def host(url):
    try:
        return (urllib.parse.urlsplit(url).hostname or "").lower().rstrip(".")
    except ValueError:
        return ""


def is_banned_url(url):
    h = host(url)
    return any(h == b or h.endswith("." + b) for b in BANNED_HOSTS)


def find_urls(text):
    return re.findall(r"https?://[^\s\"'<>]+", text or "", re.I)


def number_or_none(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def to_ascii_digits(s):
    return (s or "").translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789"))


def clean_phone(s):
    p = re.sub(r"[\s\-()]", "", to_ascii_digits(s))
    if p.startswith("+88"):
        p = p[3:]
    elif p.startswith("88") and len(p) == 13:
        p = p[2:]
    return p


def in_bd(lat, lon):
    return (isinstance(lat, (int, float)) and isinstance(lon, (int, float))
            and BD_BOX[0] <= lat <= BD_BOX[1] and BD_BOX[2] <= lon <= BD_BOX[3])


def _all_text(p):
    out = []
    for v in p.values():
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, dict):
            out.extend(str(x) for x in v.values())
        elif isinstance(v, list):
            out.extend(str(x) for x in v)
    return out


def check_common(p):
    """Rules for every place, OSM or manual: no Google data, no plus codes."""
    res = []
    for key, v in p.items():
        for text in _all_text({key: v}):
            if PLUS_CODE.search(text):
                res.append(("error", f"plus code found ({PLUS_CODE.search(text).group(0)}): Google Maps data is not allowed"))
            if any(is_banned_url(u) for u in find_urls(text)) or BANNED_IN_TEXT.search(text):
                res.append(("error", f"Google link not allowed in {key}: {(BANNED_IN_TEXT.search(text) or find_urls(text))}"))
            if key not in NOT_FREE_TEXT and PHONE_IN_TEXT.search(to_ascii_digits(text)):
                res.append(("error", f"phone number in {key}: a number goes only in the phone field, with its source"))
    return res


def check_osm_place(p, district_en, upazilas, extract_date):
    """One place from data/places/<district>.json (source: osm)."""
    res = check_common(p)
    m = OSM_ID.match(p.get("id") or "")
    if not m:
        res.append(("error", "id must be osm-<n|w|r><number>"))
    if not (p.get("name_bn") or p.get("name_en")):
        res.append(("error", "name_bn or name_en is needed (nameless places are dropped)"))
    if p.get("category") not in CATEGORIES:
        res.append(("error", f"unknown category {p.get('category')!r}"))
    elif p.get("subcategory") not in OSM_SUBCATEGORIES[p["category"]]:
        res.append(("error", f"subcategory {p.get('subcategory')!r} is not in {p['category']}"))
    if not in_bd(p.get("lat"), p.get("lon")):
        res.append(("error", "lat/lon missing or outside Bangladesh"))
    if p.get("district") != district_en:
        res.append(("error", f"district {p.get('district')!r} is not this file's district {district_en!r}"))
    if p.get("upazila") is not None and p.get("upazila") not in upazilas:
        res.append(("error", f"upazila {p.get('upazila')!r} is not in areas_bangladesh.json for {district_en}"))
    if p.get("union") is not None:
        res.append(("error", "union must be null for OSM places (only an official page can give it)"))
    if p.get("source") != "osm":
        res.append(("error", "source must be osm"))
    u = OSM_URL.match(p.get("source_url") or "")
    if not u:
        res.append(("error", "source_url must be https://www.openstreetmap.org/<node|way|relation>/<id>"))
    elif m and (u.group(1)[0], u.group(2)) != (m.group(1), m.group(2)):
        res.append(("error", "source_url does not match the id"))
    if p.get("phone") is not None:
        res.append(("error", "no phone numbers from OSM (not an official source)"))
    if p.get("checked_on") != extract_date:
        res.append(("error", "checked_on must be the extract date"))
    return res


def check_manual_place(p, district_en, upazilas, today=None):
    """One place from data/places/manual_<district>.json (checked by the team)."""
    today = today or datetime.date.today()
    res = check_common(p)
    vb, url = p.get("verified_by"), p.get("source_url")
    if not MANUAL_ID.match(p.get("id") or "") or not (p.get("id") or "").startswith(f"man-{slug(district_en)}-"):
        res.append(("error", f"id must be man-{slug(district_en)}-<row_id>"))
    if not (p.get("name_bn") or p.get("name_en")):
        res.append(("error", "name_bn or name_en is needed"))
    if p.get("category") not in CATEGORIES:
        res.append(("error", f"unknown category {p.get('category')!r} (one of {', '.join(sorted(CATEGORIES))})"))
    if not p.get("subcategory"):
        res.append(("error", "subcategory is needed"))
    if p.get("district") != district_en:
        res.append(("error", f"district {p.get('district')!r} is not {district_en!r}"))
    if p.get("upazila") not in upazilas:
        res.append(("error", f"upazila {p.get('upazila')!r} is not in areas_bangladesh.json for {district_en}"))
    if vb not in VERIFIED_BY:
        res.append(("error", "verified_by must be official_list, owner_page or visited"))
    elif p.get("source") != VERIFIED_BY[vb]:
        res.append(("error", f"source must be {VERIFIED_BY[vb]} when verified_by is {vb}"))
    # source_url: needed except for visited (Jerin, 2026-11-15)
    if url:
        if not url.startswith("https://"):
            res.append(("error", "source_url must start with https://"))
        if is_banned_url(url):
            res.append(("error", f"source_url on a Google site is not allowed: {url}"))
        if vb == "official_list" and not OFFICIAL.match(url):
            res.append(("error", "official_list needs a *.gov.bd (or acc.org.bd) source_url"))
        if vb == "owner_page" and FACEBOOK.match(url) and FACEBOOK_NOT_A_PAGE.search(url):
            res.append(("error", "owner_page must be the shop's own Facebook page, not a group or a post"))
        if FACEBOOK_SHORT.match(url):
            res.append(("error", "use the page's full facebook.com address, not a short fb.me / fb.watch link"))
    elif vb in ("official_list", "owner_page"):
        res.append(("error", f"source_url is needed for {vb}"))
    if not p.get("checked_by"):
        res.append(("error", "checked_by is needed"))
    elif p["checked_by"] not in TEAM:
        res.append(("warning", f"checked_by {p['checked_by']!r} is not a known team login"))
    co = p.get("checked_on") or ""
    if not ISO_DATE.match(co):
        res.append(("error", "checked_on must be YYYY-MM-DD"))
    else:
        try:
            if datetime.date.fromisoformat(co) > today + datetime.timedelta(days=1):
                res.append(("error", "checked_on is in the future"))
        except ValueError:
            res.append(("error", "checked_on is not a real date"))
    if p.get("union") and not OFFICIAL.match(url or ""):
        res.append(("error", "union only when an official page names it (source_url on *.gov.bd)"))
    lat, lon = p.get("lat"), p.get("lon")
    if (lat is not None and not number_or_none(lat)) or (lon is not None and not number_or_none(lon)):
        res.append(("error", "lat and lon must be numbers"))
        return res
    if (lat is None) != (lon is None):
        res.append(("error", "give both lat and lon, or neither"))
    if lat is not None:
        if not in_bd(lat, lon):
            res.append(("error", "lat/lon outside Bangladesh"))
        if p.get("location_source") not in LOCATION_SOURCES:
            res.append(("error", "location_source must be official_list, owner_page or visited_gps when lat/lon are given"))
    elif p.get("location_source"):
        res.append(("error", "location_source without lat/lon"))
    if p.get("location_approx") is not (lat is None):
        res.append(("error", "location_approx must be true exactly when lat/lon are empty"))
    if p.get("phone"):
        if vb not in ("official_list", "owner_page"):
            res.append(("error", "a phone number only when it is printed on the official list or the owner's page"))
        if not (MOBILE.match(p["phone"]) or LANDLINE.match(p["phone"])):
            res.append(("error", f"bad phone number format: {p['phone']}"))
    for k in ("note", "address_bn", "hours"):
        if GOOGLE_WORD.search(p.get(k) or ""):
            res.append(("warning", f"{k} mentions Google: make sure nothing was copied from Google Maps"))
    return res


CSV_COLUMNS = ["row_id", "name_bn", "name_en", "category", "subcategory", "district", "upazila", "union", "address_bn",
               "lat", "lon", "location_source", "phone", "hours", "verified_by", "source_url", "checked_by",
               "checked_on", "note"]
EDGE_TOLERANCE_DEG = 0.005      # ~500 m: data/locations.json shapes are simplified (~150 m)


FAR_FROM_CENTRE_KM = 25


def km(lat1, lon1, lat2, lon2):
    dy = (lat2 - lat1) * 111.32
    dx = (lon2 - lon1) * 111.32 * math.cos(math.radians((lat1 + lat2) / 2))
    return (dx * dx + dy * dy) ** 0.5


def check_in_upazila(p, polygons_by_upazila, centres=None):
    """A given pin should be in the stated upazila.
    With a real shape (data/locations.json, a ring of 4+ points) this is an error check.
    Otherwise (no shape, or the collapsed 2-point rings now in locations.json) only a warning when the pin is
    far from the upazila's centre (data/upazila_centres.json)."""
    if not (number_or_none(p.get("lat")) and number_or_none(p.get("lon"))):
        return []                                    # missing or broken lat/lon: check_manual_place reports it
    key = (p.get("district"), p.get("upazila"))
    polys = [poly for poly in polygons_by_upazila.get(key, []) if poly and len(poly[0]) >= 4]
    if polys:
        if point_in_polygons(p["lat"], p["lon"], polys):
            return []
        if distance_to_polygons_deg(p["lat"], p["lon"], polys) <= EDGE_TOLERANCE_DEG:
            return [("warning", "pin is just outside the upazila's (simplified) shape: please check")]
        return [("error", f"lat/lon are outside {p.get('upazila')} upazila")]
    c = (centres or {}).get(key)
    if c and km(p["lat"], p["lon"], c[0], c[1]) > FAR_FROM_CENTRE_KM:
        return [("warning", f"pin is {km(p['lat'], p['lon'], c[0], c[1]):.0f} km from the centre of "
                            f"{p.get('upazila')} upazila: please check the upazila")]
    return []


def upazila_polygons(locations_doc):
    return {(u["district"], u["upazila_en"]): u["polygons"] for u in locations_doc.get("upazilas", []) if u.get("polygons")}


def upazila_centre_points(centres_doc):
    return {(c["district"], c["upazila_en"]): (c["lat"], c["lon"]) for c in centres_doc.get("centres", [])}


def point_in_polygons(lat, lon, polygons):
    """polygons: GeoJSON-like MultiPolygon coordinates [[[ [lon, lat], ... ]]] (outer rings only are used)."""
    for poly in polygons:
        ring = poly[0]
        inside = False
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i][0], ring[i][1]
            xj, yj = ring[j][0], ring[j][1]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi:
                inside = not inside
            j = i
        if inside:
            return True
    return False


def distance_to_polygons_deg(lat, lon, polygons):
    best = 1e9
    for poly in polygons:
        ring = poly[0]
        for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
            dx, dy = x2 - x1, y2 - y1
            t = max(0.0, min(1.0, ((lon - x1) * dx + (lat - y1) * dy) / ((dx * dx + dy * dy) or 1e-12)))
            best = min(best, ((x1 + t * dx - lon) ** 2 + (y1 + t * dy - lat) ** 2) ** 0.5)
    return best
