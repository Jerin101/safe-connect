// Community features (impact plan, Nov 2026): "সমস্যা জানান, সমাধান দেখুন" and "এখন খোলা? তেল আছে?".
// Pure helpers, no Firebase: the page and tests/rules/community.rules.test.mjs both use them, so the fields the
// site writes are exactly the fields firestore.rules allows. Firestore calls are in js/firebase.js.
import { hasPhone } from './reports.js';

export const ISSUE_CATEGORIES = [
  ['road', 'রাস্তা ভাঙা'], ['water', 'খাবার পানি'], ['drain', 'জলাবদ্ধতা বা ড্রেন'], ['light', 'সড়কবাতি নষ্ট'],
  ['garbage', 'ময়লা'], ['power', 'বিদ্যুৎ'], ['health', 'স্বাস্থ্যসেবা'], ['safety', 'নিরাপত্তা'],
  ['place', 'জায়গার তথ্য ভুল বা বন্ধ'], ['other', 'অন্য সমস্যা'],
];
export const ISSUE_STATUSES = [
  ['open', 'জানানো হয়েছে'], ['verified', 'যাচাই হয়েছে'], ['sent', 'অফিসকে জানানো হয়েছে'],
  ['working', 'কাজ চলছে'], ['solved', 'সমাধান হয়েছে'], ['closed', 'বন্ধ (কারণ লেখা আছে)'],
];
export const PLACE_VALUES = [
  ['open', 'এখন খোলা'], ['closed', 'এখন বন্ধ'], ['fuel_yes', 'তেল আছে'], ['fuel_no', 'তেল নেই'], ['open_night', 'রাতেও খোলা'],
];
export const ISSUE_TEXT_MAX = 300;
export const ISSUE_LIMIT = { perDay: 10, gapMs: 60000 };
export const PLACE_GAP_MS = 30 * 60000;    // one answer per place per person in 30 minutes (the rules check it)
export const PLACE_FRESH_MS = 6 * 3600000; // older answers are shown as old

const label = (list, key) => (list.find((x) => x[0] === key) || [key, key])[1];
export const categoryBn = (k) => label(ISSUE_CATEGORIES, k);
export const statusBn = (k) => label(ISSUE_STATUSES, k);
export const placeValueBn = (k) => label(PLACE_VALUES, k);
// District key as the rules want it: lower-case letters only ("Cox's Bazar" -> "coxsbazar").
export const districtKey = (name) => String(name || '').toLowerCase().replace(/[^a-z]/g, '');

// Checks a draft the way the rules do. Returns { ok, error } with a Bangla message for the page.
export function checkIssue(d) {
  const t = (v) => String(v || '').trim();
  if (!ISSUE_CATEGORIES.some((x) => x[0] === d.category)) return { ok: false, error: 'সমস্যার ধরন বাছুন।' };
  if (!/^[a-z]{3,30}$/.test(districtKey(d.district))) return { ok: false, error: 'জেলা বাছুন।' };
  if (t(d.upazila).length < 2) return { ok: false, error: 'উপজেলা বাছুন।' };
  if (t(d.landmark).length < 2) return { ok: false, error: 'কাছের চেনা জায়গার নাম লিখুন (যেমন বাজার, স্কুল, মসজিদ)।' };
  if (t(d.text).length < 5) return { ok: false, error: 'সমস্যাটা অন্তত এক লাইনে লিখুন।' };
  if (t(d.text).length > ISSUE_TEXT_MAX || t(d.landmark).length > 80 || t(d.union).length > 80) return { ok: false, error: 'লেখা একটু ছোট করুন।' };
  if ([d.text, d.landmark, d.union, d.upazila].some(hasPhone)) return { ok: false, error: 'ফোন নম্বর লিখবেন না: সবার জন্য খোলা পাতায় নম্বর দেখানো নিরাপদ না।' };
  return { ok: true };
}

// The exact fields of a new problem (no person in it). createdAt/updatedAt are added by js/firebase.js.
export function issueFields(d) {
  const f = { category: d.category, district: districtKey(d.district), upazila: String(d.upazila).trim(), landmark: String(d.landmark).trim(),
    text: String(d.text).trim(), status: 'open', metoo: 0 };
  if (String(d.union || '').trim()) f.union = String(d.union).trim();
  return f;
}

export const issueAuditFields = (actorUid, issueId, from, to) =>
  ({ actorUid, action: 'ISSUE_STATUS_CHANGED', entity: 'issues', entityId: issueId, meta: { from, to } });

// The next public place status after one more answer (the rules check the same arithmetic).
export function nextPlaceStatus(old, value, nowMs) {
  const same = old && old.value === value && nowMs - toMs(old.at) <= PLACE_FRESH_MS;
  return { value, n: same ? old.n + 1 : 1 };
}
export const toMs = (at) => (at && typeof at.toMillis === 'function' ? at.toMillis() : at instanceof Date ? at.getTime() : Number(at) || 0);

// "৩ জন বলেছেন: তেল আছে · ২০ মিনিট আগে" (or null when nobody answered in the last 6 hours).
export function placeStatusText(st, nowMs, bn = (x) => String(x)) {
  if (!st || !st.value) return null;
  const age = nowMs - toMs(st.at);
  if (age > PLACE_FRESH_MS) return null;
  const min = Math.max(1, Math.round(age / 60000));
  const ago = min < 60 ? `${bn(min)} মিনিট আগে` : `${bn(Math.round(min / 60))} ঘণ্টা আগে`;
  return `${bn(st.n)} জন বলেছেন: ${placeValueBn(st.value)} · ${ago}`;
}
