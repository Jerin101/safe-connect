// Live location sharing and Safe Commute (SRS FR09–FR11). Pure helpers, no Firebase: the page, the family view and
// tests/rules/track.rules.test.mjs use the same ids, durations and checks as firestore.rules (live_shares/{shareId}).
// Firestore calls are in js/firebase.js (startShare, updateShare, setCommute, endShare, watchShare).

export const DURATIONS = [15, 60, 480];           // minutes: 15 minutes, 1 hour, 8 hours (the rules allow at most 8 h)
export const SEND_EVERY_MS = 8000;                // a new point every 5–10 s while sharing (the rules refuse < 4 s)
export const LOW_BATTERY = 10;                    // percent: below this the family view shows a warning
export const VEHICLE_TYPES = ['rickshaw', 'easybike', 'cng', 'bus', 'other'];

// A long random id (base62, 32 characters): nobody can guess a link, and shares cannot be listed.
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function newShareId(rand = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  let out = '';
  while (out.length < 32) for (const b of rand(48)) { if (b < 248 && out.length < 32) out += ABC[b % 62]; }
  return out;
}
export const SHARE_ID = /^[A-Za-z0-9]{24,40}$/;
// "#/track/<id>" (or "track/<id>") -> the id, or null for anything else.
export function parseTrack(hash) {
  const m = /^#?\/?track\/([A-Za-z0-9]{24,40})$/.exec(String(hash || '').trim());
  return m ? m[1] : null;
}

// Number plate as people write it, in Bangla or English: "ঢাকা মেট্রো-থ ১১-২৩৪৫", "Dhaka Metro-Th 11-2345".
// 2–30 characters of letters, digits, spaces, dots and dashes, and never a mobile number.
const MOBILE = /(?:\+?88)?0?1[3-9](?:[\s.-]?\d){8}|(?:\+?৮৮)?০?১[৩-৯](?:[\s.-]?[০-৯]){8}/;
export function plateOk(text) {
  const t = String(text || '').trim();
  return t.length >= 2 && t.length <= 30 && /^[\p{L}\p{M}\p{N} .-]+$/u.test(t) && !MOBILE.test(t);
}
export const destinationOk = (text) => { const t = String(text || '').trim(); return t.length >= 2 && t.length <= 60 && !MOBILE.test(t); };

// One point for live_shares: rounded to 5 decimals (about 1 m), speed in m/s and heading in degrees when the phone
// knows them, battery in whole percent when the browser tells it (Battery Status API: Chrome/Edge/Android; not Firefox
// or Safari, where it stays null).
export function pointFrom(coords, batteryLevel) {
  const r5 = (x) => Math.round(x * 1e5) / 1e5;
  const num = (x, lo, hi) => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? Math.round(x * 10) / 10 : null);
  return { lat: r5(coords.latitude), lon: r5(coords.longitude), speed: num(coords.speed, 0, 100), heading: num(coords.heading, 0, 360),
    battery: typeof batteryLevel === 'number' ? Math.max(0, Math.min(100, Math.round(batteryLevel * 100))) : null };
}
export const lowBattery = (b) => typeof b === 'number' && b < LOW_BATTERY;
export const kmh = (speed) => (typeof speed === 'number' ? Math.round(speed * 3.6) : null);
// A phone clock can be minutes wrong. The "Date" header of our own site gives the real time; add the result to Date.now().
// null when the header cannot be read. sentAt/receivedAt = the phone's clock before and after the request.
export const CLOCK_WARN_MS = 120000;              // more than 2 minutes off: tell the person
export function clockOffset(dateHeader, sentAt, receivedAt) {
  const d = Date.parse(dateHeader);
  return Number.isFinite(d) ? d - Math.round((sentAt + receivedAt) / 2) : null;
}
// Should a new GPS reading replace the kept one? prev / next = { accuracy (metres), at (ms) } or null. A reading that is
// clearly worse (8 m, then 900 m: a mobile-tower guess) does not replace a fresh good one, but an old one is replaced.
export function replaceFix(prev, next, now = Date.now()) {
  const acc = (f) => (f && Number.isFinite(f.accuracy) && f.accuracy > 0 ? f.accuracy : Infinity);
  if (!prev) return true;
  if (acc(next) <= 30 || acc(next) <= acc(prev) * 2) return true;
  return now - prev.at > 20000;
}
// How old is the last point? seconds, stale (over 60 s: the page must say "not live"), unit 's' | 'm' | 'h' and the number n to show.
// updatedAt / nowMs in ms; nowMs must be the real time (js/live.js adds the clock offset).
export const STALE_AFTER_S = 60;
export function liveAge(updatedAt, nowMs) {
  const seconds = Math.max(0, Math.round((nowMs - updatedAt) / 1000));
  const unit = seconds < 90 ? 's' : seconds < 5400 ? 'm' : 'h';
  return { seconds, stale: seconds > STALE_AFTER_S, unit, n: unit === 's' ? seconds : unit === 'm' ? Math.round(seconds / 60) : Math.round(seconds / 3600) };
}
// Minutes left (0 when over); expiresAt in ms.
export const minutesLeft = (expiresAt, nowMs) => Math.max(0, Math.ceil((expiresAt - nowMs) / 60000));
