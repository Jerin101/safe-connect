// SafeConnect offline app (P34). After one visit with internet, the site opens with no internet.
// Change VERSION whenever a file in FILES changes in a way that must reach every phone at once
// (new data, a new page or script): the old cache is then deleted and everything is saved again.
const VERSION = 'v13-2026-10-29';
const CACHE = `safeconnect-${VERSION}`;

// Every page, script, data file, font and icon the site needs (paths relative to this file).
const FILES = [
  './',
  'index.html',
  'preview.html',
  'reset.html',
  'css/base.css',
  'manifest.json',
  'js/preview.js',
  'js/data.js',
  'js/location.js',
  'js/auth.js',
  'js/workspace.js',
  'js/reports.js',
  'js/reset.js',
  'js/firebase.js',
  'js/firebase-config.js',
  'js/lang/bn.json',
  'js/lang/en.json',
  'data/national_hotlines.json',
  'data/manual_additions.json',
  'data/villages.json',
  'data/aliases.json',
  'data/contacts_noakhali.json',
  'data/contacts_coxsbazar.json',
  'data/locations.json',
  'fonts/manrope-latin-wght.woff2',
  'fonts/noto-sans-bengali-wght.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

// Install: save all files. They were just downloaded by the page, so the browser can reuse its copy
// (no second download on a slow network); the background update in `fromCache` keeps them fresh.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES))
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
  const fresh = fetch(req)
    .then((res) => { if (res.ok) cache.put(key.href, res.clone()); return res; })
    .catch(() => null);
  if (cached) {
    event.waitUntil(fresh);   // update quietly in the background
    return cached;
  }
  const res = await fresh;
  if (res) return res;
  // Offline and not saved: open the main page instead of a browser error.
  if (req.mode === 'navigate') return (await cache.match('preview.html')) || Response.error();
  return Response.error();
}
