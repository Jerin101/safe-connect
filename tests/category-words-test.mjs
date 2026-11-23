// Everyday category words (SRS FR03): the examples of the SRS and the tricky ones.
// Run: node --test tests/category-words-test.mjs (no browser, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCategory, CATEGORY_WORDS } from '../js/category-words.js';

test('the SRS examples: "osudher dokan" is pharmacy, "teler pump" is a filling station', () => {
  assert.equal(matchCategory('osudher dokan'), 'pharmacy');
  assert.equal(matchCategory('Teler Pump'), 'fuel');
  assert.equal(matchCategory('ওষুধের দোকান কোথায়'), 'pharmacy');
  assert.equal(matchCategory('তেলের পাম্প'), 'fuel');
});
test('every one of the 12 categories has words; longer words win; whole Latin words only', () => {
  assert.deepEqual(Object.keys(CATEGORY_WORDS).sort(), ['bank', 'food', 'fuel', 'hospital', 'market', 'pharmacy', 'police', 'post', 'repair', 'shelter', 'tourism', 'transport']);
  assert.equal(matchCategory('bhater hotel'), 'food');
  assert.equal(matchCategory('cyclone shelter'), 'shelter');
  assert.equal(matchCategory('hatiya'), null);          // not "hat"
  assert.equal(matchCategory('chowmuhoni'), null);       // a place name stays for the place search
  assert.equal(matchCategory('x'), null);
});
