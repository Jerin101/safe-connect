// Place status ("এখন খোলা? তেল আছে?"): pure helpers, no Firebase. The page and tests/rules/community.rules.test.mjs both
// use them, so what the site writes is exactly what firestore.rules allow. Firestore calls are in js/firebase.js.
export const PLACE_VALUES = [
  ['open', 'এখন খোলা'], ['closed', 'এখন বন্ধ'], ['fuel_yes', 'তেল আছে'], ['fuel_no', 'তেল নেই'], ['open_night', 'রাতেও খোলা'], ['shelter_open', 'আশ্রয়কেন্দ্র খোলা'],
];
export const PLACE_GAP_MS = 30 * 60000;    // one answer per place per person in 30 minutes (the rules check it)
export const PLACE_FRESH_MS = 6 * 3600000; // older answers are shown as old

const label = (list, key) => (list.find((x) => x[0] === key) || [key, key])[1];
export const placeValueBn = (k) => label(PLACE_VALUES, k);
// District key as the rules want it: lower-case letters only ("Cox's Bazar" -> "coxsbazar").
export const districtKey = (name) => String(name || '').toLowerCase().replace(/[^a-z]/g, '');

// The next public place status after one more answer (the rules check the same arithmetic).
// Stored as { status, n, at } (ER diagram); the page may still pass the old name "value".
export function nextPlaceStatus(old, value, nowMs) {
  const prev = old && (old.status || old.value);
  const same = old && prev === value && nowMs - toMs(old.at) <= PLACE_FRESH_MS;
  return { status: value, value, n: same ? old.n + 1 : 1 };
}
// An answer older than 6 hours is shown with the label "Outdated" (SRS FR05), not hidden.
export const isOutdated = (st, nowMs) => !!st && nowMs - toMs(st.at) > PLACE_FRESH_MS;
export const toMs = (at) => (at && typeof at.toMillis === 'function' ? at.toMillis() : at instanceof Date ? at.getTime() : Number(at) || 0);

// "৩ জন বলেছেন: তেল আছে · ২০ মিনিট আগে" (or null when nobody answered in the last 6 hours).
// "৩ জন বলেছেন: তেল আছে · ২০ মিনিট আগে"; older than 6 hours: "… · পুরোনো (Outdated)"; nothing yet: null.
export function placeStatusText(st, nowMs, bn = (x) => String(x)) {
  const v = st && (st.status || st.value);
  if (!v) return null;
  const age = nowMs - toMs(st.at);
  const min = Math.max(1, Math.round(age / 60000));
  const ago = min < 60 ? `${bn(min)} মিনিট আগে` : min < 1440 ? `${bn(Math.round(min / 60))} ঘণ্টা আগে` : `${bn(Math.round(min / 1440))} দিন আগে`;
  return `${bn(st.n)} জন বলেছেন: ${placeValueBn(v)} · ${ago}${age > PLACE_FRESH_MS ? ' · পুরোনো (Outdated)' : ''}`;
}
