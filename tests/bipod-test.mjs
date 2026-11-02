// বিপদ বার্তা (#134): help link, link parser, SMS text and SMS part count.
// Run: node --test tests/bipod-test.mjs (no browser, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { helpPath, helpLink, parseHelp, buildSms, smsParts, minutesAgo, inBangladesh, SITE_URL } from '../js/bipod.js';

const LANG = { bn: JSON.parse(readFileSync('js/lang/bn.json', 'utf8')).ui, en: JSON.parse(readFileSync('js/lang/en.json', 'utf8')).ui };
const texts = (l) => ({ ...LANG[l].bipod.sms, noLoc: LANG[l].noLoc });
const HATIYA = { lat: 22.36123456, lon: 91.12987654 };
const AT = Date.UTC(2026, 10, 2, 13, 0, 0);
const NOW = AT + 5 * 60000;
const SEC = AT / 1000;

test('help path: 5 decimals, unix seconds, known situation only', () => {
  assert.equal(helpPath(HATIYA, AT, 'followed'), `help/22.36123,91.12988,${SEC},followed`);
  assert.equal(helpPath(HATIYA, AT, 'nonsense'), `help/22.36123,91.12988,${SEC}`);
  assert.equal(helpLink(HATIYA, AT), `${SITE_URL}#/help/22.36123,91.12988,${SEC}`);
});

test('parser: a good link round-trips', () => {
  const h = parseHelp(helpPath(HATIYA, AT, 'lost').slice(5), NOW);
  assert.deepEqual(h, { ok: true, lat: 22.36123, lon: 91.12988, at: AT, situation: 'lost' });
  assert.equal(parseHelp(`22.36123,91.12988,${SEC}`, NOW).situation, null);
  assert.equal(parseHelp(`22.36123,91.12988,${SEC},xyz`, NOW).situation, null);
});

test('parser: broken, cut-off, future and outside links', () => {
  for (const bad of ['', undefined, 'abc', '22.36123,91.12988', '22.36123,91.12988,17937', `22.36,91.12,${SEC},a,b`, '<script>,1,2', `22.3e1,91.1,${SEC}`])
    assert.deepEqual(parseHelp(bad, NOW), { ok: false, reason: 'broken' }, String(bad));
  assert.deepEqual(parseHelp(`22.36123,91.12988,${Math.floor((NOW + 3600000) / 1000)}`, NOW), { ok: false, reason: 'broken' });
  assert.equal(parseHelp(`22.36123,91.12988,${Math.floor((NOW + 5 * 60000) / 1000)}`, NOW).ok, true);   // clock a bit ahead
  assert.deepEqual(parseHelp(`23.81030,90.41250,${SEC}`, NOW).ok, true);                              // Dhaka
  assert.deepEqual(parseHelp(`28.61390,77.20900,${SEC}`, NOW), { ok: false, reason: 'outside' });   // Delhi
  assert.deepEqual(parseHelp(`-22.36123,91.12988,${SEC}`, NOW), { ok: false, reason: 'outside' });
  assert.equal(inBangladesh(20.6274, 92.3238), true);                                                       // St Martin's Island
});

test('SMS (bn): situation, area, police, call 999 first, link', () => {
  const link = helpLink(HATIYA, AT, 'followed');
  const sms = buildSms({ texts: texts('bn'), situation: LANG.bn.sits.followed[1], area: 'হাতিয়া, নোয়াখালী', police: '01320101478', link });
  assert.equal(sms, `জরুরি! কেউ আমার পিছু নিয়েছে, আমি ভয় পাচ্ছি।\nএলাকা: হাতিয়া, নোয়াখালী\nআগে 999-এ কল করো। থানা: 01320101478\nলোকেশন: ${link}`);
  assert.equal(smsParts(sms).unicode, true);
});

test('SMS (en): short and in plain letters (fewer parts)', () => {
  const link = helpLink(HATIYA, AT, 'followed');
  const sms = buildSms({ texts: texts('en'), situation: LANG.en.sits.followed[1], area: 'Hatiya, Noakhali', police: '01320101478', link });
  assert.equal(sms.split('\n')[0], `URGENT! ${LANG.en.sits.followed[1]}`);
  const p = smsParts(sms);
  assert.equal(p.unicode, false);
  assert.ok(p.parts < smsParts(buildSms({ texts: texts('bn'), situation: LANG.bn.sits.followed[1], area: 'হাতিয়া, নোয়াখালী', police: '01320101478', link })).parts);
});

test('SMS outside our data: no area, no police, 999 only', () => {
  const sms = buildSms({ texts: texts('bn'), situation: LANG.bn.sits.danger[1], link: helpLink({ lat: 23.8103, lon: 90.4125 }, AT) });
  assert.equal(sms.split('\n').length, 3);
  assert.equal(sms.split('\n')[1], 'আগে 999-এ কল করো।');
});

test('SMS without a location: asks to be called, no link', () => {
  const sms = buildSms({ texts: texts('en'), situation: LANG.en.sits.lost[1], area: 'Hatiya, Noakhali' });
  assert.ok(sms.endsWith(LANG.en.noLoc));
  assert.ok(!sms.includes('http'));
});

test('SMS part counts', () => {
  assert.deepEqual(smsParts('a'.repeat(160)), { unicode: false, length: 160, parts: 1 });
  assert.equal(smsParts('a'.repeat(161)).parts, 2);
  assert.equal(smsParts('[' .repeat(80)).parts, 1);
  assert.equal(smsParts('[' .repeat(81)).parts, 2);              // [ counts twice
  assert.deepEqual(smsParts('ক'.repeat(70)), { unicode: true, length: 70, parts: 1 });
  assert.equal(smsParts('ক'.repeat(71)).parts, 2);
  assert.equal(smsParts('ক'.repeat(135)).parts, 3);
});

test('minutes ago never goes below 0', () => {
  assert.equal(minutesAgo(AT, NOW), 5);
  assert.equal(minutesAgo(NOW + 60000, NOW), 0);
});

test('every situation has a short and a full text in both languages', () => {
  for (const l of ['bn', 'en']) for (const k of ['danger', 'followed', 'accident', 'sick', 'lost']) {
    assert.equal(LANG[l].sits[k].length, 2);
    assert.ok(LANG[l].sits[k].every(Boolean));
  }
});

// Police number for the SMS (#143), on the real data: the thana's officer-in-charge, never an outpost.
import { loadAll, localAreas, areaContacts } from '../js/data.js';
import { pickPolice } from '../js/bipod.js';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => { try { return { ok: true, json: async () => JSON.parse(readFileSync(url, 'utf8')) }; } catch { return { ok: false, status: 404 }; } };
const DATA = await loadAll('data/');
globalThis.fetch = realFetch;
const police = (district, upazila, areaBn = null) => {
  const doc = DATA.docs[district];
  const area = areaBn ? localAreas(doc, upazila).find((a) => a.bn.includes(areaBn)) : null;
  const g = areaContacts(DATA, { district, upazila, area }).find((x) => x.id === 'police');
  return { g, p: pickPolice(g.items) };
};

test('SMS police: Begumganj gives the thana OC, also in Chowmuhani where an outpost is listed first', () => {
  const whole = police('noakhali', 'Begumganj');
  assert.equal(whole.p.thana, true);
  assert.match(whole.p.record.designation_bn, /অফিসার ইনচার্জ/);
  assert.equal(whole.p.record.phones[0], '01320111008');
  const town = police('noakhali', 'Begumganj', 'চৌমুহনী');
  assert.notEqual(town.g.items[0].phones[0], '01320111008', 'the outpost should be first in the list, or this test proves nothing');
  assert.equal(town.p.record.phones[0], '01320111008');
});

test('SMS police: Hatiya and Ukhia give the thana OC; Cox\'s Bazar Sadar has none, so "পুলিশ:"', () => {
  assert.deepEqual([police('noakhali', 'Hatiya').p.thana, police('noakhali', 'Hatiya').p.record.phones[0]], [true, '01320111137']);
  assert.equal(police('coxsbazar', 'Ukhia').p.thana, true);
  const sadar = police('coxsbazar', "Cox's Bazar Sadar");
  assert.equal(sadar.p.thana, false);
  assert.equal(sadar.p.record, sadar.g.items[0]);
});

test('pickPolice: empty or national-only lists give null', () => {
  assert.equal(pickPolice([]), null);
  assert.equal(pickPolice([{ kind: 'national', phones: ['999'] }]), null);
});

test('new SMS texts: no-location asks for a message first; every Bangla message with a link fits in 3 SMS', () => {
  assert.equal(LANG.bn.noLoc, 'আমার লোকেশন পাওয়া যায়নি। আমাকে মেসেজ করো, উত্তর না পেলে 999-এ কল করো।');
  assert.equal(LANG.en.noLoc, "I could not get my location. Text me; if I don't answer, call 999.");
  const link = helpLink(HATIYA, AT, 'followed');
  for (const k of Object.keys(LANG.bn.sits)) {
    const sms = buildSms({ texts: texts('bn'), situation: LANG.bn.sits[k][1], area: 'হাতিয়া, নোয়াখালী', police: '01320111137', link });
    assert.ok(smsParts(sms).parts <= 3, `${k}: ${smsParts(sms).length} chars`);
  }
});
