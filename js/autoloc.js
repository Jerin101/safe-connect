// Auto location, opt-in (issue #105). Off by default. When the person turns on "Update my area
// automatically", the position is read when the page opens and while it is visible, and the page finds
// the area on the phone. Positions stay in memory only: never stored, never uploaded (CLAUDE.md rule 5).

import { permissionState, distanceKm } from './location.js';

const KEY = 'sc-autoloc';           // '1' = on (this phone only)
const MOVE_KM = 0.3;                // act after moving at least 300 m ...
const EVERY_MS = 120000;            // ... or after 2 minutes
const ROUGH_M = 1000;               // a position less exact than this never changes the area
const FIRST = { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 };
const WATCH = { enableHighAccuracy: true, maximumAge: 120000 };   // no timeout: a still phone sends nothing
const CODES = ['unavailable', 'denied', 'unavailable', 'timeout'];

// onPosition(pos) gets every reading { lat, lon, accuracy, at }; onFix(pos) only the ones that may change the area;
// onError(code) gets 'denied' | 'unavailable' | 'timeout' | 'unsupported'.
export function createAutoLoc({ store, onPosition, onFix, onError }) {
  let watchId = null;
  let last = null;                  // { pos, at } of the last position acted on
  const isOn = () => store.get(KEY) === '1';
  const geo = () => ('geolocation' in navigator ? navigator.geolocation : null);
  const toPos = (p) => ({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), at: p.timestamp || Date.now() });

  function act(p, force) {
    const pos = toPos(p);
    const now = Date.now();
    onPosition(pos);
    if (pos.accuracy > ROUGH_M) return;
    if (!force && last && distanceKm(last.pos, pos) < MOVE_KM && now - last.at < EVERY_MS) return;
    last = { pos, at: now };
    onFix(pos);
  }
  function stop() {
    if (watchId !== null) geo()?.clearWatch(watchId);
    watchId = null;
  }
  // A "no" from the browser turns the setting off, so the switch shows the real state.
  function fail(err) {
    const code = CODES[err.code] || 'unavailable';
    if (code === 'denied') { store.set(KEY, '0'); stop(); }
    onError(code);
  }
  function start() {
    const g = geo();
    if (!g) { onError('unsupported'); return; }
    g.getCurrentPosition((p) => act(p, true), fail, FIRST);
    if (watchId === null) watchId = g.watchPosition((p) => act(p, false), (e) => { if (e.code === 1) fail(e); }, WATCH);
  }
  // Page open, or the page is visible again: only when on and the browser already allows it (never a surprise prompt).
  async function resume() {
    if (!isOn() || document.visibilityState !== 'visible' || watchId !== null) return;
    const state = await permissionState();
    if (!isOn() || document.visibilityState !== 'visible' || watchId !== null) return;   // changed while waiting
    if (state === 'denied') fail({ code: 1 });
    else if (state === 'granted' || state === 'unknown') start();
  }
  // The caller has shown the explanation first; this lets the browser ask.
  function turnOn() {
    store.set(KEY, '1');
    if (document.visibilityState === 'visible') start();
  }
  function turnOff() {
    store.set(KEY, '0');
    stop();
    last = null;
  }

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resume(); else stop(); });
  return { isOn, resume, turnOn, turnOff };
}
