// SafeConnect offline app (P34). After one visit with internet, the site opens with no internet.
// Change VERSION whenever a file in FILES changes in a way that must reach every phone at once
// (new data, a new page or script): the old cache is then deleted and everything is saved again.
const VERSION = 'v84-2026-11-29';
const CACHE = `safeconnect-${VERSION}`;

// Every page, script, data file, font and icon the site needs (paths relative to this file).
const FILES = [
  './',
  'index.html',
  'preview.html',            // old address: sends old links and installed apps on to ./ (#141)
  'js/old-link.js',
  'reset.html',
  'css/base.css',
  'css/preview.css', 'css/ui.css',
  'manifest.json',
  'js/preview.js',
  'js/icons.js',             // line icons (A1)
  'js/near.js',              // categories near the person (R1)
  'js/areapoly.js',            // M1.2: which upazila boundary a position is inside (data/polygons)
  'js/unioncentre.js',         // M1.2: nearest union centre (never an exact union)
  'js/whereami.js',            // M1.2: the "where the map puts you" card on the area page
  'js/locate.js',              // M1.3: the five location rules on the official boundaries
  'js/routemap.js', 'js/verify.js', 'js/netstatus.js', 'js/offlinepack.js', 'js/reportqueue.js', 'js/speak.js', 'js/siren.js',          // directions inside the site: road route and live route map (#309)
  'js/dakun.js',             // সেবা ডাকুন (R3)
  'js/provide.js',           // সেবা দিন (R4)
  'js/driveralert.js',
  'js/driverwatch.js',         // new-call sound, vibration and message for an online driver (#365)
  'js/emergency.js',         // জরুরি সাহায্য (R5)
  'js/live.js',              // লাইভ লোকেশন শেয়ার + family view (SRS PR-2)
  'js/track.js',
  'js/category-words.js',   // everyday-word search, offline (SRS FR03)
  'js/community.js',        // এখন কেমন? helpers
  'js/ride.js',
  'js/bipod.js',
  'js/prepare.js',
  'js/data.js',
  'js/phonetic.js',
  'js/location.js',
  'js/geo.js',               // one two-step way to read the phone position (network first or GPS first)
  'js/autoloc.js',
  'js/auth.js',
  'js/owner.js',
  'js/workspace.js',
  'js/reports.js',
  'js/admin.js',
  'js/reset.js',
  'js/firebase.js',
  'js/firebase-config.js',
  'js/lang/bn.json',
  'js/lang/en.json',
  'data/national_hotlines.json',
  'data/upazila_centres.json',   // the area picker and "my location" (R1)
  // M1.2: official BBS upazila boundaries (simplified 100 m, CC BY-IGO) and union centre points, one file per district (about 1.3 MB)
  'data/polygons/index.json',
  'data/polygons/BD1004.json',
  'data/polygons/BD1006.json',
  'data/polygons/BD1009.json',
  'data/polygons/BD1042.json',
  'data/polygons/BD1078.json',
  'data/polygons/BD1079.json',
  'data/polygons/BD2003.json',
  'data/polygons/BD2012.json',
  'data/polygons/BD2013.json',
  'data/polygons/BD2015.json',
  'data/polygons/BD2019.json',
  'data/polygons/BD2022.json',
  'data/polygons/BD2030.json',
  'data/polygons/BD2046.json',
  'data/polygons/BD2051.json',
  'data/polygons/BD2075.json',
  'data/polygons/BD2084.json',
  'data/polygons/BD3026.json',
  'data/polygons/BD3029.json',
  'data/polygons/BD3033.json',
  'data/polygons/BD3035.json',
  'data/polygons/BD3048.json',
  'data/polygons/BD3054.json',
  'data/polygons/BD3056.json',
  'data/polygons/BD3059.json',
  'data/polygons/BD3067.json',
  'data/polygons/BD3068.json',
  'data/polygons/BD3082.json',
  'data/polygons/BD3086.json',
  'data/polygons/BD3093.json',
  'data/polygons/BD4001.json',
  'data/polygons/BD4018.json',
  'data/polygons/BD4041.json',
  'data/polygons/BD4044.json',
  'data/polygons/BD4047.json',
  'data/polygons/BD4050.json',
  'data/polygons/BD4055.json',
  'data/polygons/BD4057.json',
  'data/polygons/BD4065.json',
  'data/polygons/BD4087.json',
  'data/polygons/BD4539.json',
  'data/polygons/BD4561.json',
  'data/polygons/BD4572.json',
  'data/polygons/BD4589.json',
  'data/polygons/BD5010.json',
  'data/polygons/BD5038.json',
  'data/polygons/BD5064.json',
  'data/polygons/BD5069.json',
  'data/polygons/BD5070.json',
  'data/polygons/BD5076.json',
  'data/polygons/BD5081.json',
  'data/polygons/BD5088.json',
  'data/polygons/BD5527.json',
  'data/polygons/BD5532.json',
  'data/polygons/BD5549.json',
  'data/polygons/BD5552.json',
  'data/polygons/BD5573.json',
  'data/polygons/BD5577.json',
  'data/polygons/BD5585.json',
  'data/polygons/BD5594.json',
  'data/polygons/BD6036.json',
  'data/polygons/BD6058.json',
  'data/polygons/BD6090.json',
  'data/polygons/BD6091.json',
  'data/places/index.json',      // which places file each district uses (R1)
  'data/manual_additions.json',
  'data/villages.json',
  'data/villages_bbs.json',
  'data/aliases.json',
  'data/thanas.json',
  'vendor/leaflet/leaflet.js',    // the live map and the near-me map
  'vendor/leaflet/leaflet.css',
  'data/landmarks/noakhali.json',
  'data/landmarks/coxsbazar.json',
  'data/contacts_noakhali.json',
  'data/contacts_coxsbazar.json',
  'data/locations.json',
  'data/verify_report.json',
  'fonts/manrope-latin-wght.woff2',
  'fonts/noto-sans-bengali-wght.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

// Install: save all files. Each one is checked with the server first ("no-cache"): an unchanged file costs only a
// tiny "not modified" answer, so a slow network does not download everything twice, but a stale copy from the
// browser's own cache (e.g. the old start page of v29) can never be saved (#141).
// redirect: a page load keeps its own mode ('manual'), so an address that redirects (a folder without its final /)
// still opens; the browser does not accept a followed redirect as a page (#141).
const fresh = (url, redirect = 'follow') => new Request(url, { cache: 'no-cache', credentials: 'same-origin', redirect });
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => fresh(f))))
      .then(() => self.skipWaiting()),
  );
});

// Activate: delete caches from older versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('safeconnect-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Fetch: our own files come from the cache first (fast, works offline); while online, a fresh copy
// is downloaded in the background for next time. Other sites (tel:, sms:, WhatsApp, maps,
// gov.bd source links) are never touched.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(fromCache(event, req));
});

async function fromCache(event, req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  // Save under the address without "?..." so a one-time code (e.g. reset.html?oobCode=...) is never stored.
  const key = new URL(req.url); key.search = '';
  const update = fetch(fresh(req.url, req.redirect))      // checked with the server, never a stale browser copy (#141)
    .then((res) => { if (res.ok) cache.put(key.href, res.clone()); return res; })
    .catch(() => null);
  if (cached) {
    event.waitUntil(update);   // update quietly in the background
    return cached;
  }
  const res = await update;
  if (res) return res;
  // Offline and not saved: open the main page instead of a browser error.
  if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
  return Response.error();
}
