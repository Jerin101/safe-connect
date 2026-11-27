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
// Keep watching for improving fixes. High accuracy is a request to the device, not a GPS guarantee.
// At the deadline return the best reported estimate; the SOS UI decides whether sharing it needs confirmation.
export function locateBest(ok, bad, { timeout = 20000, targetAccuracy = 50, maximumAge = 0 } = {}) {
  const g = typeof navigator !== 'undefined' ? navigator.geolocation : null;
  if (!g || typeof g.watchPosition !== 'function') { bad({ code: 0 }); return; }

  const duration = Number.isFinite(Number(timeout)) && Number(timeout) > 0 ? Number(timeout) : 20000;
  const target = Number.isFinite(Number(targetAccuracy)) && Number(targetAccuracy) > 0 ? Number(targetAccuracy) : 50;
  let watchId = null, timer = null, settled = false, best = null;

  function stop() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    if (watchId !== null) {
      const id = watchId; watchId = null;
      try { g.clearWatch?.(id); } catch {}
    }
  }
  function finish(err) {
    if (settled) return;
    settled = true;
    stop();
    if (err?.code === 1) { bad(err); return; } // permission denied must never reuse an earlier fix
    if (best) { ok(best); return; }
    bad(err || { code: 3 });
  }

  timer = setTimeout(() => finish({ code: 3 }), duration);
  try {
    const id = g.watchPosition((position) => {
      if (settled) return;
      const coords = position?.coords;
      const lat = Number(coords?.latitude), lon = Number(coords?.longitude), accuracy = Number(coords?.accuracy);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(accuracy) || accuracy <= 0) return;
      if (!best || accuracy < Number(best.coords.accuracy)) best = position;
      if (accuracy <= target) finish();
    }, (err) => {
      if (err?.code === 1 || err?.code === 2 || err?.code === 3) finish(err);
    }, { enableHighAccuracy: true, timeout: duration, maximumAge: Math.max(0, Number(maximumAge) || 0) });
    watchId = id;
    // Some test doubles and unusual implementations can call success synchronously.
    if (settled && watchId !== null) { try { g.clearWatch?.(watchId); } catch {} watchId = null; }
  } catch {
    finish({ code: 2 });
  }
}

// 'unsupported' | 'denied' | 'unavailable' | 'timeout'
export const geoCode = (e) => (e && e.code === 0 ? 'unsupported' : ['unavailable', 'denied', 'unavailable', 'timeout'][e && e.code] || 'unavailable');
