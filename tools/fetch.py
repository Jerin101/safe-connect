"""Polite HTTP helper for official *.gov.bd portals.

Many district/upazila portals send an incomplete certificate chain (they leave out
Sectigo's intermediate certificate). Browsers repair this silently; Python does not.
We add the official intermediate (copied from Mozilla's CCADB list, SHA-256
8C54C334...EF22E0) to Python's normal trust store. Certificate checking stays ON.
"""
import json, os, ssl, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CTX = ssl.create_default_context()
CTX.load_verify_locations(os.path.join(HERE, "certs", "sectigo-public-server-auth-ca-dv-r36.pem"))
UA = {"User-Agent": "SafeConnect-collector/1.0 (student project; github.com/Jerin101/safe-connect)"}


def get(url, delay=0.35, tries=3, timeout=40):
    """Return (status, body). Waits `delay` seconds after each request to be gentle on servers."""
    err = ""
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), context=CTX, timeout=timeout) as r:
                body = r.read().decode("utf-8", "replace")
                time.sleep(delay)
                return r.status, body
        except urllib.error.HTTPError as e:
            time.sleep(delay)
            return e.code, ""
        except Exception as e:
            err = str(e)
            time.sleep(1.5 * (attempt + 1))
    return 0, err


def get_json(url, **kw):
    status, body = get(url, **kw)
    try:
        return json.loads(body)
    except ValueError:
        return None
