// Siren (guide: "Siren and silent SOS"). A loud two-tone sound from the phone's own speaker (Web Audio API) to attract
// attention. It starts ONLY after a tap, stops by itself after one minute and has a stop button. Nothing is recorded or sent.
// If the browser has no Web Audio, the button is not shown. Tested (the tone part) in tests/siren-test.mjs.
export const MAX_MS = 60000;            // never longer than one minute
export const STEP_MS = 500;             // the tone changes twice a second
export const HIGH = 1200;
export const LOW = 700;
// Which tone to play at a given time since the start (pure, so it can be tested).
export const toneAt = (ms) => (Math.floor(Math.max(0, ms) / STEP_MS) % 2 === 0 ? HIGH : LOW);
const AC = () => globalThis.AudioContext || globalThis.webkitAudioContext;
export const canSiren = () => typeof AC() === 'function';

let audio = null, osc = null, tick = null, stopper = null;
export const isOn = () => osc !== null;

export function stopSiren() {
  clearInterval(tick); clearTimeout(stopper); tick = stopper = null;
  try { osc?.stop(); } catch { /* already stopped */ }
  try { audio?.close(); } catch { /* fine */ }
  osc = audio = null;
}
// onEnd runs when the siren stops by itself after MAX_MS.
export function startSiren(onEnd) {
  if (!canSiren() || isOn()) return false;
  try {
    audio = new (AC())();
    osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square'; gain.gain.value = 0.4;
    osc.connect(gain); gain.connect(audio.destination);
    const t0 = Date.now();
    osc.frequency.value = toneAt(0);
    tick = setInterval(() => { if (osc) osc.frequency.value = toneAt(Date.now() - t0); }, STEP_MS / 2);
    stopper = setTimeout(() => { stopSiren(); if (onEnd) onEnd(); }, MAX_MS);
    osc.start();
    return true;
  } catch { stopSiren(); return false; }
}
