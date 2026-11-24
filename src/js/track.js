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
// Minutes left (0 when over); expiresAt in ms.
export const minutesLeft = (expiresAt, nowMs) => Math.max(0, Math.ceil((expiresAt - nowMs) / 60000));
