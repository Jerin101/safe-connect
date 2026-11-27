// Whose numbers are these (src/js/owner.js)? Run: node tests/owner-test.mjs
import assert from 'node:assert/strict';
import { switchOwner, forgetOwner, OWNER_KEY, BOUND_KEYS } from '../src/js/owner.js';

const fake = (init = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const FAM_A = JSON.stringify([{ name: 'Iffat', phone: '01775339810' }]), FAM_B = JSON.stringify([{ name: 'Mother', phone: '01711000000' }]);

// numbers typed before any sign-in: the first account to sign in keeps them
let s = fake({ 'sc-family': FAM_A });
assert.deepEqual(switchOwner(s, 'uidA'), { changed: false, restored: false });
assert.equal(s.getItem('sc-family'), FAM_A, 'numbers typed while signed out stay for the first account');
assert.equal(s.getItem(OWNER_KEY), 'uidA');
assert.deepEqual(switchOwner(s, 'uidA'), { changed: false, restored: false }, 'the same account again: nothing happens');

// account B signs in on the same phone: B must not see A's numbers, ride or share
s.setItem('sc-ride', 'ride-of-A'); s.setItem('sc-live', '{"id":"x"}'); s.setItem('sc-places', '[{"district":"dhaka"}]'); s.setItem('sc-family-sync', '1');
assert.deepEqual(switchOwner(s, 'uidB'), { changed: true, restored: false });
for (const k of BOUND_KEYS) assert.equal(s.getItem(k), null, `${k} is hidden from account B`);
assert.equal(s.getItem(OWNER_KEY), 'uidB');
assert.ok(s.getItem('sc-stash:uidA'), "A's data is put away, not deleted");

// B saves a number, then A signs in again: A gets A's data back, B's is put away
s.setItem('sc-family', FAM_B);
assert.deepEqual(switchOwner(s, 'uidA'), { changed: true, restored: true });
assert.equal(s.getItem('sc-family'), FAM_A, 'A sees only the numbers A saved');
assert.equal(s.getItem('sc-ride'), 'ride-of-A');
assert.equal(s.getItem('sc-stash:uidA'), null, 'the put-away copy is used up');
assert.ok(s.getItem('sc-stash:uidB'));
assert.deepEqual(switchOwner(s, 'uidB'), { changed: true, restored: true });
assert.equal(s.getItem('sc-family'), FAM_B, 'and B gets B back');

// an account with no data at all: nothing shown, nothing broken
s = fake({ [OWNER_KEY]: 'uidA' });
assert.deepEqual(switchOwner(s, 'uidC'), { changed: true, restored: false });
assert.equal(s.getItem('sc-stash:uidA'), null, 'no empty stash is written');

// broken stash is ignored; bad input does nothing
s = fake({ [OWNER_KEY]: 'uidA', 'sc-stash:uidB': '{not json' });
assert.deepEqual(switchOwner(s, 'uidB'), { changed: true, restored: false });
assert.deepEqual(switchOwner(s, ''), { changed: false, restored: false });
assert.deepEqual(switchOwner(s, null), { changed: false, restored: false });
const broken = { getItem() { throw new Error('no storage'); }, setItem() { throw new Error('no storage'); }, removeItem() { throw new Error('no storage'); } };
assert.deepEqual(switchOwner(broken, 'uidA'), { changed: false, restored: false }, 'a phone without storage does not crash the sign-in');

// "also remove from this phone": the account's data, its put-away copy and the owner go
s = fake({ [OWNER_KEY]: 'uidA', 'sc-family': FAM_A, 'sc-ride': 'r', 'sc-stash:uidA': '{"sc-family":"[]"}', 'sc-stash:uidB': '{}' });
forgetOwner(s, 'uidA');
for (const k of BOUND_KEYS) assert.equal(s.getItem(k), null);
assert.equal(s.getItem('sc-stash:uidA'), null);
assert.equal(s.getItem(OWNER_KEY), null);
assert.ok(s.getItem('sc-stash:uidB'), "another account's put-away data is not touched");

console.log('owner-test: ok');
