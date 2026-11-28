// New-call alert for an online driver (#365). Free and server-less: while the driver's page is open and "online", a new request
// for their service in their district gives a message on screen, a sound, vibration, the page title and, if allowed, a system
// notification. A closed app cannot be woken without a paid server (Firebase Spark has no Cloud Functions), so the page says so.
// Nothing here stores or sends anything. `env` is injected so tests run without a browser.

export const BEEP = [[880, 0.18], [0, 0.08], [880, 0.18], [0, 0.08], [1175, 0.3]];   // Hz, seconds
export const VIBRATE = [300, 120, 300, 120, 600];

export function createCallAlert(env = {}) {
  const nav = env.navigator ?? (typeof navigator !== 'undefined' ? navigator : {});
  const doc = env.document ?? (typeof document !== 'undefined' ? document : null);
  const Ctx = env.AudioContext ?? (typeof AudioContext !== 'undefined' ? AudioContext : null);
  const Notif = env.Notification ?? (typeof Notification !== 'undefined' ? Notification : null);
  const seen = new Set();
  let first = true, audio = null, lock = null, baseTitle = null, armed = false;

  // Call from a tap (the "go online" button): browsers allow sound and permission questions only after a tap.
  async function arm() {
    armed = true;
    try { if (Ctx && !audio) audio = new Ctx(); if (audio && audio.state === 'suspended') Promise.resolve(audio.resume()).catch(() => {}); } catch { audio = null; }   // never wait: a blocked browser would hold the page
    // The question may wait for the person: never hold up the page for it (the in-page alert already works).
    try { if (Notif && Notif.permission === 'default') Promise.resolve(Notif.requestPermission()).catch(() => {}); } catch { /* ignore */ }
    try { if (nav.wakeLock && !lock) { lock = await nav.wakeLock.request('screen'); lock.addEventListener?.('release', () => { lock = null; }); } } catch { lock = null; }
    return state();
  }
  function disarm() {
    armed = false; first = true; seen.clear();
    try { lock?.release?.(); } catch { /* ignore */ }
    lock = null;
    if (doc && baseTitle !== null) { doc.title = baseTitle; baseTitle = null; }
  }
  const state = () => ({ armed, sound: !!audio, notifications: !!Notif && Notif.permission === 'granted', screenOn: !!lock });

  function beep() {
    if (!audio) return;
    try {
      let t = audio.currentTime;
      for (const [hz, sec] of BEEP) {
        if (hz) { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = hz; g.gain.value = 0.25; o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + sec); }
        t += sec;
      }
    } catch { /* silent is fine, the message still shows */ }
  }

  // list = the open requests for this driver (ride objects); returns the NEW ones. The first list after arm() is the baseline
  // and is not announced as new (the page already shows them), unless announceFirst is set.
  function check(list, { announceFirst = false, silent = false, title = '', body = (r) => '' } = {}) {
    const fresh = [];
    for (const r of list || []) {
      if (!r || !r.id) continue;
      if (!seen.has(r.id)) { seen.add(r.id); if (!first || announceFirst) fresh.push(r); }
    }
    first = false;
    for (const id of [...seen]) if (!(list || []).some((r) => r && r.id === id)) seen.delete(id);   // answered or cancelled
    if (armed && fresh.length && !silent) {
      beep();
      try { nav.vibrate?.(VIBRATE); } catch { /* not supported */ }
      if (doc) { if (baseTitle === null) baseTitle = doc.title; doc.title = `(${fresh.length}) ${title || baseTitle}`; }
      if (Notif && Notif.permission === 'granted' && (!doc || doc.hidden !== false)) {
        try { new Notif(title || 'New call', { body: body(fresh[0]), tag: 'sc-new-call', renotify: true }); } catch { /* some phones only allow it from a service worker */ }
      }
    }
    if (!fresh.length && doc && baseTitle !== null && !(list || []).length) { doc.title = baseTitle; baseTitle = null; }
    return fresh;
  }
  return { arm, disarm, check, state };
}
