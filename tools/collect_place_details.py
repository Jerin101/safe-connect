"""Collect the public details of the places in data/places/<district>.json from OpenStreetMap.

Each place id is an OpenStreetMap object (osm-n123 = node, osm-w123 = way, osm-r123 = relation). This script asks the
free Overpass API for the tags of those objects and keeps only a short list of useful, public ones: phone, website,
opening hours, fee, speciality, facilities... Nothing is guessed or filled in: a value that is not in OpenStreetMap
stays missing, and the website shows "not published". The result is data/details/details_<district>.json
(OpenStreetMap data, ODbL licence; the website labels it "from OpenStreetMap, not official").

Usage:  python tools/collect_place_details.py src/data/places coxsbazar noakhali
Polite: 80 ids per request, 2 seconds between requests, certificate checking on, standard library only.
"""
import datetime, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
HOSTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
UA = {"User-Agent": "SafeConnect-collector/1.0 (student project; github.com/Jerin101/safe-connect)"}
BATCH, DELAY = 80, 2.0
TODAY = datetime.date.today().isoformat()

# output key -> OpenStreetMap tags to read (first one that has a value wins)
TAGS = {
    "phone": ["phone", "contact:phone", "contact:mobile", "mobile"],
    "website": ["website", "contact:website", "url"],
    "facebook": ["contact:facebook", "facebook"],
    "hours": ["opening_hours", "service_times"],
    "description": ["description:bn", "description:en", "description"],
    "wikipedia": ["wikipedia"],
    "operator": ["operator", "operator:en"],
    "brand": ["brand", "brand:en"],
    "address": ["addr:full"],
    "street": ["addr:street"],
    "housename": ["addr:housename"],
    "fee": ["fee", "charge"],
    "wheelchair": ["wheelchair"],
    "toilets": ["toilets"],
    "parking": ["parking", "parking:fee"],
    "speciality": ["healthcare:speciality"],
    "emergency": ["emergency"],
    "beds": ["beds"],
    "capacity": ["capacity"],
    "cuisine": ["cuisine"],
    "stars": ["stars"],
    "rooms": ["rooms"],
    "internet": ["internet_access"],
    "air_conditioning": ["air_conditioning"],
    "outdoor_seating": ["outdoor_seating"],
    "takeaway": ["takeaway"],
    "delivery": ["delivery"],
    "atm": ["atm"],
    "cash_in": ["cash_in"],
    "fuel_diesel": ["fuel:diesel"],
    "fuel_octane": ["fuel:octane_92", "fuel:octane_95", "fuel:octane_97", "fuel:octane_100"],
    "fuel_cng": ["fuel:cng"],
    "fuel_lpg": ["fuel:lpg"],
    "level": ["level"],
}
PHONE = re.compile(r"^\+?[0-9][0-9 \-()]{5,18}[0-9]$")
YESNO = {"yes", "no", "limited", "designated"}
URL = re.compile(r"^https?://[^\s<>\"']{4,200}$")
LINK_KEYS = {"website", "facebook"}
SHORT_KEYS = {"wheelchair", "toilets", "emergency", "internet", "air_conditioning", "outdoor_seating", "takeaway",
              "delivery", "atm", "cash_in", "fuel_diesel", "fuel_octane", "fuel_cng", "fuel_lpg"}
NUMBER_KEYS = {"beds", "capacity", "rooms", "stars"}


def clean_phone(v):
    out = []
    for part in re.split(r"[;,/]", v):
        part = part.strip()
        if PHONE.match(part) and 6 <= len(re.sub(r"\D", "", part)) <= 14:
            out.append(re.sub(r"\s+", " ", part))
    return "; ".join(dict.fromkeys(out)) or None


def clean(key, v):
    v = re.sub(r"[\x00-\x1f\x7f<>]", " ", str(v)).strip()
    v = re.sub(r"\s+", " ", v)
    if not v:
        return None
    if key == "phone":
        return clean_phone(v)
    if key in LINK_KEYS:
        if key == "facebook" and not v.startswith("http"):
            v = "https://www.facebook.com/" + v.lstrip("/@")
        return v if URL.match(v) else None
    if key == "wikipedia":
        return v if re.match(r"^[a-z]{2,3}:.{2,120}$", v) else None
    if key in NUMBER_KEYS:
        return v if re.match(r"^\d{1,5}$", v) else None
    if key in SHORT_KEYS and key not in ("fuel_octane",):
        return v.lower() if v.lower() in YESNO or key in ("fuel_octane",) else None
    return v[:300]


def read_tags(tags):
    out = {}
    for key, names in TAGS.items():
        for n in names:
            if n in tags:
                if key == "fuel_octane":      # "yes" for any grade
                    if tags[n].lower() == "yes":
                        out[key] = "yes"; break
                    continue
                v = clean(key, tags[n])
                if v:
                    out[key] = v; break
    return out


def ask(query):
    last = ""
    for attempt in range(8):
        host = HOSTS[attempt % len(HOSTS)]
        try:
            req = urllib.request.Request(host, data=urllib.parse.urlencode({"data": query}).encode(), headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                body = json.load(r)
            time.sleep(DELAY)
            return body["elements"]
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as e:
            last = str(e)
            time.sleep(5 * (attempt + 1))
    raise SystemExit(f"Overpass failed: {last}")


def collect(places):
    by_kind = {"n": [], "w": [], "r": []}
    for p in places:
        m = re.match(r"^osm-([nwr])(\d+)$", p["id"])
        if m:
            by_kind[m.group(1)].append(m.group(2))
    kinds = {"n": "node", "w": "way", "r": "relation"}
    found = {}
    for k, ids in by_kind.items():
        for i in range(0, len(ids), BATCH):
            chunk = ids[i:i + BATCH]
            q = f"[out:json][timeout:60];{kinds[k]}(id:{','.join(chunk)});out tags;"
            for el in ask(q):
                d = read_tags(el.get("tags", {}))
                if d:
                    found[f"osm-{k}{el['id']}"] = d
            print(f"  {kinds[k]} {min(i + BATCH, len(ids))}/{len(ids)}")
    return found


def main(folder, slugs):
    for slug in slugs:
        path = os.path.join(folder, f"{slug}.json")
        places = json.load(open(path, encoding="utf-8"))["places"]
        print(f"{slug}: {len(places)} places")
        details = collect(places)
        out = {"source": "osm", "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors",
               "attribution_url": "https://www.openstreetmap.org/copyright", "checked_on": TODAY,
               "details": dict(sorted(details.items()))}
        dest = os.path.join(os.path.dirname(folder.rstrip("/\\")), "details", f"details_{slug}.json")
        with open(dest, "w", encoding="utf-8", newline="\n") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        phones = sum(1 for d in details.values() if "phone" in d)
        print(f"  -> {dest}: {len(details)} places with details, {phones} with a phone")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2:])
