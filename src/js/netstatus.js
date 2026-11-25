// Network status (plan section 3B): a small chip says Online, Slow connection or Offline, so the person knows whether the
// numbers on screen are fresh or the copy saved on this phone (every saved number still shows its check date).
// Nothing is sent: it only reads the browser's own online flag and, where the browser has it, the connection speed.
export function netState(nav = navigator) {
  if (!nav.onLine) return 'offline';
  const c = nav.connection;
  if (c && (c.saveData || /^(slow-2g|2g)$/.test(c.effectiveType || '') || (c.rtt && c.rtt > 1500))) return 'slow';
  return 'online';
}
import { countQueue } from './reportqueue.js';
export function initNetStatus(texts) {
  const chip = document.createElement('div');
  chip.className = 'netchip'; chip.setAttribute('role', 'status'); chip.setAttribute('aria-live', 'polite');
  document.body.append(chip);
  let waiting = 0;   // reports saved on this phone, not sent yet (js/reportqueue.js)
  const paint = () => {
    const s = netState(), T = texts();
    chip.dataset.state = s; chip.textContent = T[s] + (waiting ? T.pending.replace('{n}', waiting) : ''); chip.hidden = s === 'online' && !waiting;   // quiet while everything is fine
  };
  const count = () => countQueue().then((n) => { waiting = n; paint(); }).catch(() => {});
  addEventListener('online', () => { paint(); count(); }); addEventListener('offline', paint); addEventListener('sc-queue', count);
  navigator.connection?.addEventListener?.('change', paint);
  paint(); count();
  return paint;
}
