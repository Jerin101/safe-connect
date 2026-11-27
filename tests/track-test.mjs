// Live share helpers (src/js/track.js): the clock check and the choice between GPS readings. Run: node tests/track-test.mjs
import assert from 'node:assert/strict';
import { clockOffset, replaceFix, CLOCK_WARN_MS } from '../src/js/track.js';

// ---- the phone clock: "real time minus the phone clock"
const real = Date.parse('Fri, 27 Nov 2026 06:00:00 GMT');
assert.equal(clockOffset('Fri, 27 Nov 2026 06:00:00 GMT', real, real), 0, 'a correct clock has no offset');
assert.equal(clockOffset('Fri, 27 Nov 2026 06:00:00 GMT', real - 600000, real - 600000), 600000, 'a phone 10 minutes behind: add 10 minutes');
assert.equal(clockOffset('Fri, 27 Nov 2026 06:00:00 GMT', real + 900000, real + 900000), -900000, 'a phone 15 minutes ahead: subtract 15 minutes');
assert.equal(clockOffset('Fri, 27 Nov 2026 06:00:00 GMT', real - 1000, real + 1000), 0, 'the middle of the request is used (slow network)');
assert.equal(clockOffset(null, real, real), null, 'no Date header: unknown, the page trusts the phone clock');
assert.equal(clockOffset('not a date', real, real), null, 'a broken header is ignored');
assert.ok(CLOCK_WARN_MS === 120000, 'more than 2 minutes off is worth a warning');

// a 15 minute share made on a phone 20 minutes behind would be "already over" for the server: the corrected end time fixes it
const phoneNow = real - 20 * 60000, off = clockOffset('Fri, 27 Nov 2026 06:00:00 GMT', phoneNow, phoneNow);
const endCorrected = phoneNow + off + 15 * 60000, endOld = phoneNow + 15 * 60000;
assert.ok(endCorrected > real, 'corrected: 15 minutes from the real time');
assert.ok(endOld < real, 'uncorrected: it would end before it starts (the "link expired" bug)');

// ---- which GPS reading to keep
const T0 = 1_000_000;
assert.equal(replaceFix(null, { accuracy: 900, at: T0 }, T0), true, 'the first reading is always kept');
assert.equal(replaceFix({ accuracy: 8, at: T0 }, { accuracy: 900, at: T0 + 3000 }, T0 + 3000), false, 'a fresh 8 m fix is not replaced by a 900 m tower guess');
assert.equal(replaceFix({ accuracy: 8, at: T0 }, { accuracy: 900, at: T0 + 25000 }, T0 + 25000), true, 'but after 25 s the old fix is too old to keep');
assert.equal(replaceFix({ accuracy: 40, at: T0 }, { accuracy: 60, at: T0 + 2000 }, T0 + 2000), true, 'a slightly worse reading is fine (up to twice as wide)');
assert.equal(replaceFix({ accuracy: 200, at: T0 }, { accuracy: 20, at: T0 + 2000 }, T0 + 2000), true, 'a better reading always wins');
assert.equal(replaceFix({ accuracy: 8, at: T0 }, { accuracy: 25, at: T0 + 2000 }, T0 + 2000), true, '30 m or better is always accepted');
assert.equal(replaceFix({ accuracy: 8, at: T0 }, { accuracy: NaN, at: T0 + 2000 }, T0 + 2000), false, 'a reading with no accuracy does not replace a fresh good one');

console.log('track-test: ok');
