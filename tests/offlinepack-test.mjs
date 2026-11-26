// Plan section 3A: what the offline emergency pack keeps (js/offlinepack.js, the pure part).
import { buildPack } from '../src/js/offlinepack.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) bad++; };
const nat = [{ id: 'national-emergency-999', category: 'emergency', name_bn: '৯৯৯', phones: ['999'], source_url: 'https://www.police.gov.bd/', retrieved_on: '2026-10-21' },
  { id: 'x', name_bn: 'no phone', phones: [] }, { id: 'y', name_bn: 'bad phone', phones: ['call me'] }];
const p = buildPack({ national: nat, now: Date.UTC(2026, 10, 25) });
ok(p.national.length === 1 && p.national[0].id === 'national-emergency-999', 'keeps only records with a real phone number');
ok(p.national[0].checked_on === '2026-10-21' && p.national[0].source_url.startsWith('https://'), 'keeps the source link and the check date');
ok(p.area === null && p.savedAt.startsWith('2026-11-25'), 'no area unless given; saved date recorded');
const q = buildPack({ national: nat, area: Array.from({ length: 20 }, (_, i) => ({ id: 'a' + i, phones: ['01712345678'], script_check: { on: '2026-10-30' } })), areaLabel: 'Noakhali' });
ok(q.area.records.length === 12 && q.area.label === 'Noakhali', 'area numbers capped at 12, with the area name');
ok(buildPack({ national: [{ phones: ['999'], source_url: 'http://insecure' }] }).national[0].source_url === null, 'drops a non-https source link');
const sms = [{ situation: 'danger', label: 'In danger', bn: 'জরুরি! বিপদে আছি', en: 'URGENT! In danger' }, { situation: 5 }, null];
const r = buildPack({ national: nat, sms });
ok(r.sms.length === 1 && r.sms[0].situation === 'danger' && r.sms[0].en.startsWith('URGENT'), 'keeps the ready SOS message texts and drops broken ones');
ok(buildPack({ national: nat }).sms.length === 0, 'no message texts unless given');
console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0);
