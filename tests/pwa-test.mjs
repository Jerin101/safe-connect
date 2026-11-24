// SRS NFR01 / NFR09 (plan PR-8): the site is an installable PWA that works offline.
// Run: node --test tests/pwa-test.mjs (no browser, no network). Checks what Chrome's install rules need: a linked
// manifest with name, start_url, standalone display and 192 + 512 px PNG icons (sizes read from the PNG files), and a
// service worker with a fetch handler whose offline FILES list only files that exist (every page script included).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8'));
const sw = readFileSync('src/service-worker.js', 'utf8');
const files = [...sw.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const pngSize = (path) => { const b = readFileSync(path); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('index.html links the manifest and registers the service worker', () => {
  assert.match(readFileSync('src/index.html', 'utf8'), /<link rel="manifest" href="manifest.json">/);
  assert.match(readFileSync('src/js/preview.js', 'utf8'), /serviceWorker\.register\('service-worker\.js'\)/);
});

test('manifest: name, short name, start page and standalone display', () => {
  assert.ok(manifest.name && manifest.short_name);
  assert.ok(manifest.start_url);
  assert.ok(['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display));
});

test('manifest: 192 px and 512 px PNG icons that really have that size', () => {
  for (const want of [192, 512]) {
    const ic = manifest.icons.find((i) => i.type === 'image/png' && i.sizes === `${want}x${want}`);
    assert.ok(ic, `${want} px icon listed`);
    assert.ok(existsSync('src/' + ic.src), `${ic.src} exists`);
    assert.deepEqual(pngSize('src/' + ic.src), [want, want], `${ic.src} is ${want}x${want}`);
  }
});

test('service worker: a fetch handler, and every offline file exists', () => {
  assert.match(sw, /addEventListener\('fetch'/);
  for (const f of files) if (f !== './') assert.ok(existsSync('src/' + f), `${f} is in FILES but missing`);
});

test('every page script in js/ is in the offline list (NFR01)', () => {
  // firebase.js / firebase-config.js load only online (sign-in); the rest must open with no internet
  const scripts = readdirSync('src/js').filter((f) => f.endsWith('.js'));
  const missing = scripts.filter((f) => !files.includes(`js/${f}`));
  assert.deepEqual(missing, [], `not in FILES: ${missing.join(', ')}`);
});
