// "ডাকুন" (service engine): request → accept → live map on both sides → bill. Pure helpers, no Firebase, so the page,
// the rules tests and the end-to-end test all use the same fare and status logic. Firestore calls are in js/firebase.js;
// firestore.rules checks the same arithmetic (a final fare must match the rates within 5 taka).

export const RIDE_TYPES = [
  // id, Bangla name, provider word, average speed (km/h) for the arrival estimate, needs a destination
  { id: 'ambulance', bn: 'অ্যাম্বুলেন্স', who: 'চালক', kmh: 30, dest: true },
  { id: 'cng', bn: 'সিএনজি', who: 'চালক', kmh: 20, dest: true },
  { id: 'bike', bn: 'বাইক', who: 'চালক', kmh: 25, dest: true },
  { id: 'technician', bn: 'কারিগর (ইলেকট্রিশিয়ান, প্লাম্বার, মেকানিক)', who: 'কারিগর', kmh: 20, dest: false },
  { id: 'help', bn: 'বিপদে কাছের সাহায্যকারী', who: 'স্বেচ্ছাসেবক', kmh: 15, dest: false },
];
export const typeOf = (id) => RIDE_TYPES.find((t) => t.id === id);
// Example rates (admin sets the real ones in rates/{type}); "help" is never billed.
export const DEFAULT_RATES = {
  ambulance: { base: 300, perKm: 40, perMin: 5, minFare: 500 },
  cng: { base: 40, perKm: 20, perMin: 2, minFare: 60 },
  bike: { base: 25, perKm: 15, perMin: 1, minFare: 40 },
  technician: { base: 150, perKm: 0, perMin: 3, minFare: 200 },
  help: { base: 0, perKm: 0, perMin: 0, minFare: 0 },
};
export const FREE_WAIT_MIN = 3;
export const ROAD_FACTOR = 1.3;
export const STATUSES = ['requested', 'accepted', 'arrived', 'on_trip', 'completed', 'paid', 'cancelled'];
export const STATUS_BN = { requested: 'চালক খোঁজা হচ্ছে', accepted: 'আসছেন', arrived: 'পৌঁছেছেন', on_trip: 'যাত্রা চলছে',
  completed: 'শেষ: বিল তৈরি', paid: 'পরিশোধ হয়েছে', cancelled: 'বাতিল' };
export const ACTIVE = ['requested', 'accepted', 'arrived', 'on_trip', 'completed'];
export const LIVE = ['accepted', 'arrived', 'on_trip'];

const R = 6371000, rad = Math.PI / 180;
// metres between two {lat, lon}
export function metres(a, b) {
  const dLa = (b.lat - a.lat) * rad, dLo = (b.lon - a.lon) * rad;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// The estimated road distance before the ride: straight line × 1.3, in whole metres.
export const estimateMetres = (from, to) => (to ? Math.round(metres(from, to) * ROAD_FACTOR) : 0);
export const etaMinutes = (m, type) => Math.max(1, Math.round(m / 1000 / ((typeOf(type) || { kmh: 20 }).kmh) * 60));

// fare in whole taka: max(minimum, base + perKm × km + perMin × (wait − 3)), rounded up to 5 taka; "help" is 0.
export function fare(rates, distM, waitMin = 0) {
  if (!rates) return 0;
  const raw = rates.base + rates.perKm * (distM / 1000) + rates.perMin * Math.max(0, waitMin - FREE_WAIT_MIN);
  if (raw <= 0 && rates.minFare <= 0) return 0;
  return Math.max(rates.minFare, Math.ceil(raw / 5) * 5);
}
export function fareParts(rates, distM, waitMin = 0) {
  const km = distM / 1000, w = Math.max(0, waitMin - FREE_WAIT_MIN);
  return { base: rates.base, distance: Math.round(rates.perKm * km), waiting: Math.round(rates.perMin * w), km, waitPaid: w, total: fare(rates, distM, waitMin) };
}
// Cancelling after the provider arrived costs half the base fare (rounded up to 5 taka); before that, nothing.
export const cancelFee = (rates, status) => (status === 'arrived' && rates ? Math.ceil(rates.base / 2 / 5) * 5 : 0);

// Distance actually driven: adds up GPS points, ignoring jumps under 8 m (GPS jitter) and impossible jumps (> 60 m/s).
export function trackAdd(track, p) {
  const t = track || { m: 0, last: null };
  if (!t.last) return { m: t.m, last: p };
  const d = metres(t.last, p), dt = Math.max(1, ((p.at || 0) - (t.last.at || 0)) / 1000);
  if (d < 8) return t;
  if (p.at && t.last.at && d / dt > 60) return { m: t.m, last: t.last };
  return { m: t.m + d, last: p };
}

// The "is the bill fair" check the rules also make: within 5 taka of the formula, and the distance not more than
// twice the estimate plus 3 km (a longer one is flagged for the rider and an admin).
export const billLooksRight = (rates, distM, waitMin, f) => Math.abs(f - fare(rates, distM, waitMin)) <= 5;
export const distanceSuspicious = (estM, distM) => distM > estM * 2 + 3000;

// Round a position for the "online providers" list (about 100 m), so nobody's exact spot is shown before a booking.
export const coarse = (x) => Math.round(x * 1000) / 1000;
export const inBangladesh = (lat, lon) => lat >= 20.5 && lat <= 26.7 && lon >= 88.0 && lon <= 92.7;

export function receiptText(r, bn = (x) => String(x)) {
  const t = typeOf(r.type) || { bn: r.type, who: 'সেবাদাতা' };
  const lines = [`SafeConnect রসিদ #${String(r.id || '').slice(0, 8).toUpperCase()}`, `সেবা: ${t.bn}`,
    `${t.who}: ${r.providerName || ''}${r.vehicle ? ' (' + r.vehicle + ')' : ''}`,
    `দূরত্ব: ${bn(((r.distM || 0) / 1000).toFixed(1))} কিমি · অপেক্ষা: ${bn(r.waitMin || 0)} মিনিট`,
    `ভাড়া: ${bn(r.fare || 0)} টাকা (নগদ) · ${r.payStatus === 'paid' ? 'পরিশোধিত' : 'বাকি'}`];
  return lines.join('\n');
}
