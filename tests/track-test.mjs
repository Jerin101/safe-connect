// Live share helpers (src/js/track.js): the clock check and the choice between GPS readings. Run: node tests/track-test.mjs
import assert from 'node:assert/strict';
import { clockOffset, replaceFix, liveAge, STALE_AFTER_S, CLOCK_WARN_MS, compassIndex, distanceParts } from '../src/js/track.js';

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

// ---- how old is the point (the family page must not pretend an old point is live)
const U = 5_000_000;
assert.deepEqual(liveAge(U, U + 8000), { seconds: 8, stale: false, unit: 's', n: 8 }, '8 s old: live');
assert.equal(liveAge(U, U + 60000).stale, false, 'exactly 60 s is still live');
assert.equal(liveAge(U, U + 61000).stale, true, 'over 60 s is "not live"');
assert.deepEqual(liveAge(U, U + 120000), { seconds: 120, stale: true, unit: 'm', n: 2 }, '2 minutes');
assert.deepEqual(liveAge(U, U + 3 * 3600000), { seconds: 10800, stale: true, unit: 'h', n: 3 }, '3 hours');
assert.equal(liveAge(U, U - 5000).seconds, 0, 'a point "from the future" (clock difference) counts as 0 s, never negative');
assert.equal(STALE_AFTER_S, 60);

// ---- which way, how far (the family page's "what is around here")
const here = { lat: 23.97, lon: 90.27 };
assert.equal(compassIndex(here, { lat: 23.98, lon: 90.27 }), 0, 'north');
assert.equal(compassIndex(here, { lat: 23.98, lon: 90.28 }), 1, 'north-east');
assert.equal(compassIndex(here, { lat: 23.97, lon: 90.28 }), 2, 'east');
assert.equal(compassIndex(here, { lat: 23.96, lon: 90.28 }), 3, 'south-east');
assert.equal(compassIndex(here, { lat: 23.96, lon: 90.27 }), 4, 'south');
assert.equal(compassIndex(here, { lat: 23.96, lon: 90.26 }), 5, 'south-west');
assert.equal(compassIndex(here, { lat: 23.97, lon: 90.26 }), 6, 'west');
assert.equal(compassIndex(here, { lat: 23.98, lon: 90.26 }), 7, 'north-west');
assert.deepEqual(distanceParts(0.004), { value: 10, unit: 'm' }, 'never "0 m"');
assert.deepEqual(distanceParts(0.254), { value: 250, unit: 'm' }, 'metres rounded to 10');
assert.deepEqual(distanceParts(1.26), { value: 1.3, unit: 'km' }, 'one decimal above 1 km');
assert.deepEqual(distanceParts(0.999), { value: 1000, unit: 'm' });

console.log('track-test: ok');
