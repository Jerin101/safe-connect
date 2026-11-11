"""Fill in the service worker's VERSION for a deploy (the repository keeps VERSION = 'dev').

VERSION is the date and commit of the last change to service-worker.js or to any file in its FILES list, e.g.
'v20261111-62fe7c3'. So every phone saves the site again exactly when a saved file changed, and never because of a
change to docs or tests. Nobody has to raise VERSION by hand any more, so two PRs can no longer clash on it.

Usage: python stamp_version.py <site folder>   (run in the repository, after copying the site into <site folder>)
Used by .github/workflows/pages.yml. Exit code 1 if a file in FILES is missing or VERSION is not 'dev'.
"""
import os, re, subprocess, sys

PLACEHOLDER = "const VERSION = 'dev';"


def files_of(worker):
    block = re.search(r"const FILES = \[(.*?)\];", worker, re.S)
    if not block:
        sys.exit("service-worker.js: no FILES list")
    names = re.findall(r"^\s*'([^']+)',", block.group(1), re.M)
    return ["index.html" if n == "./" else n for n in names]


def main(site):
    path = os.path.join(site, "service-worker.js")
    with open(path, encoding="utf-8") as f:
        worker = f.read()
    if worker.count(PLACEHOLDER) != 1:
        sys.exit(f"service-worker.js must contain {PLACEHOLDER!r} exactly once (the repository keeps 'dev')")
    files = files_of(worker)
    missing = [n for n in files if not os.path.isfile(os.path.join(site, n))]
    if missing:
        sys.exit("files in FILES that are not in the site: " + ", ".join(missing))
    last = subprocess.run(["git", "log", "-1", "--format=%cd-%h", "--date=format:%Y%m%d", "--", "service-worker.js", *files],
                          capture_output=True, text=True, check=True).stdout.strip()
    if not re.fullmatch(r"[0-9]{8}-[0-9a-f]{7,}", last):
        sys.exit(f"could not read the last change from git: {last!r}")
    version = f"v{last}"
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(worker.replace(PLACEHOLDER, f"const VERSION = '{version}';"))
    print(f"VERSION = {version} ({len(files)} files in FILES)")


if __name__ == "__main__":
    main(sys.argv[1])
