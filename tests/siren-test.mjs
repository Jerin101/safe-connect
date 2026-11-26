// The siren's tone and limits (src/js/siren.js). Run: node tests/siren-test.mjs
import assert from 'node:assert/strict';
import { toneAt, HIGH, LOW, STEP_MS, MAX_MS, canSiren, isOn, stopSiren } from '../src/js/siren.js';

assert.equal(toneAt(0), HIGH);
assert.equal(toneAt(STEP_MS - 1), HIGH);
assert.equal(toneAt(STEP_MS), LOW);
assert.equal(toneAt(STEP_MS * 2), HIGH);
assert.equal(toneAt(-50), HIGH);               // a clock step back never breaks it
assert.ok(MAX_MS <= 60000, 'the siren must stop by itself within one minute');
assert.equal(canSiren(), false);                // no Web Audio in node: the button stays hidden
assert.equal(isOn(), false);
stopSiren();                                    // safe to call when nothing plays
console.log('siren-test: ok');
