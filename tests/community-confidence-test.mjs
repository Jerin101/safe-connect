// Plan section 5: confidence rises with more reports, fades with time, expires after 24 hours (js/community.js).
import { confidence } from '../src/js/community.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) bad++; };
const now = 1_000_000_000_000, H = 3600000;
ok(confidence(null, now).level === 'none', 'no report: none');
ok(confidence({ status: 'open', n: 1, at: now - 0.1 * H }, now).level === 'low', 'one fresh report: low');
ok(confidence({ status: 'open', n: 2, at: now - 0.1 * H }, now).level === 'medium', 'two fresh reports: medium');
ok(confidence({ status: 'open', n: 3, at: now - 0.1 * H }, now).level === 'high', 'three fresh reports: high');
ok(confidence({ status: 'open', n: 3, at: now - 12 * H }, now).level === 'low', 'three reports 12 hours old: faded to low');
ok(confidence({ status: 'open', n: 9, at: now - 25 * H }, now).level === 'expired', 'older than 24 hours: expired');
console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
