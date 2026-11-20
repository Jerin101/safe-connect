// Place status ("এখন খোলা? তেল আছে?"): pure helpers, no Firebase. The page and tests/rules/community.rules.test.mjs both
// use them, so what the site writes is exactly what firestore.rules allow. Firestore calls are in js/firebase.js.
export const PLACE_VALUES = [
  ['open', 'এখন খোলা'], ['closed', 'এখন বন্ধ'], ['fuel_yes', 'তেল আছে'], ['fuel_no', 'তেল নেই'], ['open_night', 'রাতেও খোলা'],
];
export const PLACE_GAP_MS = 30 * 60000;    // one answer per place per person in 30 minutes (the rules check it)
export const PLACE_FRESH_MS = 6 * 3600000; // older answers are shown as old

const label = (list, key) => (list.find((x) => x[0] === key) || [key, key])[1];
export const placeValueBn = (k) => label(PLACE_VALUES, k);
// District key as the rules want it: lower-case letters only ("Cox's Bazar" -> "coxsbazar").
export const districtKey = (name) => String(name || '').toLowerCase().replace(/[^a-z]/g, '');

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
