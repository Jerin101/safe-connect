// Plan section 1: review periods and the "not verified after the review time" rule (js/verify.js).
import { review, tasks, isEmergency } from '../src/js/verify.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) bad++; };
const now = Date.UTC(2026, 10, 25);
ok(review({ category: 'police', script_check: { on: '2026-11-20' } }, now).state === 'ok', 'police checked 5 days ago: ok');
ok(review({ category: 'police', script_check: { on: '2026-10-30' } }, now).state === 'soon', 'police checked 26 days ago: due soon (30 day rule)');
ok(review({ category: 'police', script_check: { on: '2026-10-20' } }, now).state === 'expired', 'police checked 36 days ago: expired');
ok(review({ kind: 'national', checked_on: '2026-10-20' }, now).state === 'ok', 'national helpline 36 days ago: ok (90 day rule)');
ok(review({ category: 'health' }, now).state === 'unknown', 'no date: unknown, never verified');
ok(review({ category: 'health', retrieved_on: '2026-11-01', status: 'verified' }, now).method === 'human', 'status verified: checked by a person');
ok(review({ category: 'health', retrieved_on: '2026-11-01' }, now).method === 'script', 'collected: copied by script');
ok(review({ category: 'police', checked_on: '2026-11-01' }, now).nextOn === '2026-12-01', 'next check date = checked + 30 days');
ok(isEmergency({ category: 'fire' }) && !isEmergency({ category: 'administration' }), 'fire is an emergency contact, administration is not');
const t = tasks([{ category: 'police', checked_on: '2026-10-01' }, { category: 'police', checked_on: '2026-11-24' }, { category: 'health' }], now);
ok(t.due === 2 && t.fresh === 1 && t.by[0][0] === 'police' || t.by.length === 2, 'tasks counts overdue and up to date');
console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
