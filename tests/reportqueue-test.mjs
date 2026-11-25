// Plan section 3C: the offline report queue keeps only the report, never the person (js/reportqueue.js, the pure part).
import { makeItem, itemFields, MAX_ITEMS } from '../src/js/reportqueue.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) bad++; };
const draft = { recordId: 'abc123', district: 'noakhali', area: 'সোনাইমুড়ী', problem: 'changed', note: 'number changed last week' };
const it = makeItem('report', draft, 1000);
ok(it && it.kind === 'report' && it.queuedAt === 1000 && it.tries === 0, 'a valid report becomes a queue item');
ok(it && !('uid' in it.data) && !('status' in it.data) && !JSON.stringify(it).includes('"queued"'), 'no user id is stored in the queue');
ok(makeItem('report', { ...draft, note: 'call me 01712345678' }) === null, 'a note with a phone number is refused');
ok(makeItem('report', { ...draft, problem: 'nonsense' }) === null, 'an unknown problem is refused');
ok(makeItem('report', { ...draft, district: 'Bad District!' }) === null, 'a bad district key is refused');
const f = itemFields(it, 'user-1');
ok(f && f.uid === 'user-1' && f.status === 'open' && f.recordId === 'abc123', 'at send time the signed-in uid is added');
ok(itemFields(it, '') === null, 'without a signed-in user nothing can be sent');
const m = makeItem('missing', { district: 'noakhali', place: 'Rahim Pharmacy', upazila: 'Begumganj' }, 2000);
ok(m && itemFields(m, 'u2').problem === 'missing_place', 'a missing-place request is queued the same way');
ok(makeItem('other', draft) === null, 'an unknown kind is refused');
ok(MAX_ITEMS === 10, 'the queue is short (10 items)');
console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
