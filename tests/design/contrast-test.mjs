// A1 (DEMO_TO_REAL_PLAN): text colours on their backgrounds meet WCAG AA (4.5:1) in day and both night blocks of
// css/base.css. The colours are read from the file, so a later change that breaks a pair fails here.
// Run: node --test tests/design/contrast-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ICONS, icon } from '../../js/icons.js';

const css = readFileSync('css/base.css', 'utf8');
// the three colour blocks: day (:root {), night when the phone asks for it, night chosen with the switch
const blocks = {
  day: css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')),
  nightAuto: css.slice(css.indexOf(':root:not([data-theme="light"]) {'), css.indexOf(':root[data-theme="dark"] {')),
  nightSwitch: css.slice(css.indexOf(':root[data-theme="dark"] {')),
};
const vars = (block) => Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1], m[2]]));
const day = vars(blocks.day);
const theme = (name) => (name === 'day' ? day : { ...day, ...vars(blocks[name].slice(0, blocks[name].indexOf('}'))) });
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [text, background] pairs as the site uses them (css/base.css, css/preview.css)
const PAIRS = [
  ['--ink', '--bg'], ['--ink', '--surface'], ['--ink', '--surface-2'], ['--ink-2', '--surface'], ['--muted', '--bg'], ['--muted', '--surface'],
  ['--link', '--bg'], ['--link', '--surface'], ['--accent-ink', '--accent'], ['--on-color', '--violet-1'], ['--on-color', '--violet-2'],
  ['--on-color', '--danger'], ['--on-color', '--red-1'], ['--on-color', '--red-2'], ['--foot-ink', '--foot-bg'], ['--foot-muted', '--foot-bg'],
  // the two-tone gradient titles (.grad) on the page and on the soft banner backgrounds
  ['--title-2', '--bg'], ['--title-2', '--tint'], ['--title-2', '--tint-2'], ['--title-3', '--bg'], ['--title-3', '--tint'], ['--title-3', '--tint-2'],
  // white text on the coloured tiles and buttons
  ['--on-color', '--teal-2'], ['--on-color', '--green-2'],
];

for (const name of Object.keys(blocks)) {
  test(`text contrast is at least 4.5:1 (${name})`, () => {
    const t = theme(name), bad = [];
    for (const [fg, bg] of PAIRS) {
      assert.ok(t[fg] && t[bg], `${name}: ${fg} or ${bg} is missing`);
      const r = ratio(t[fg], t[bg]);
      if (r < 4.5) bad.push(`${fg} on ${bg} = ${r.toFixed(2)}`);
    }
    assert.deepEqual(bad, []);
  });
}

test('both night blocks have the same colours', () => {
  assert.deepEqual(vars(blocks.nightAuto.slice(0, blocks.nightAuto.indexOf('}'))), vars(blocks.nightSwitch.slice(0, blocks.nightSwitch.indexOf('}'))));
});

test('the accent colour is teal in day and night', () => {
  for (const name of Object.keys(blocks)) {
    const a = theme(name)['--accent'];
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    assert.ok(g > r && b > r, `${name}: --accent ${a} is not teal`);
  }
});

test('every icon has shapes made only of path, circle and rect', () => {
  assert.ok(Object.keys(ICONS).length >= 45);
  for (const [name, parts] of Object.entries(ICONS)) {
    assert.ok(parts.length > 0, name);
    for (const [tag] of parts) assert.ok(['path', 'circle', 'rect'].includes(tag), `${name}: ${tag}`);
  }
  assert.equal(typeof icon, 'function');
});
