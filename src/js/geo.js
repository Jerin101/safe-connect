// One way to ask the phone for its position, used by every page (live share, SOS, near me, ডাকুন, my area).
// Why two tries: a phone indoors, or with location set to "device only", often cannot give a GPS fix in 15 s,
// while the network/Wi-Fi position arrives in 1–2 s. So: try one kind, and if it fails for any reason other than
// "the person said no", try the other. The position never leaves the phone here.
//   precise = true  -> GPS first (SOS, live share), then network.   precise = false -> network first (near me), then GPS.
// ok(position) / bad(error): the same callbacks as navigator.geolocation. error.code: 1 denied, 2 unavailable, 3 timeout,
// 0 = this browser has no location at all.
export function locate(ok, bad, { precise = false, timeout = 15000, maximumAge = 60000 } = {}) {
  const g = typeof navigator !== 'undefined' ? navigator.geolocation : null;
  if (!g) { bad({ code: 0 }); return; }
  const gps = (ms) => ({ enableHighAccuracy: true, timeout: ms, maximumAge });
  const net = (ms) => ({ enableHighAccuracy: false, timeout: ms, maximumAge: Math.max(maximumAge, 0) });
  const [first, second] = precise ? [gps(10000), net(timeout)] : [net(8000), gps(timeout)];
  g.getCurrentPosition(ok, (e) => { if (e && e.code === 1) bad(e); else g.getCurrentPosition(ok, bad, second); }, first);
}
// 'unsupported' | 'denied' | 'unavailable' | 'timeout'
export const geoCode = (e) => (e && e.code === 0 ? 'unsupported' : ['unavailable', 'denied', 'unavailable', 'timeout'][e && e.code] || 'unavailable');
