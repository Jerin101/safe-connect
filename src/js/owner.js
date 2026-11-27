// Whose numbers are these? The family numbers, saved areas and the open ride or live share kept on a phone belong to the
// account that saved them. When another account signs in on the same phone, the first account's data is put away (not
// deleted) and the new account sees only its own; it comes back when the first account signs in again. Signed out, the
// phone keeps the last owner's numbers so "Send location" still works in an emergency. Nothing here leaves the phone.
// Pure functions on a localStorage-like object (getItem / setItem / removeItem), so tests need no browser.

export const OWNER_KEY = 'sc-owner';
export const BOUND_KEYS = ['sc-family', 'sc-places', 'sc-family-sync', 'sc-ride', 'sc-live', 'sc-arrive'];
const stashKey = (uid) => `sc-stash:${uid}`;
const safe = (fn) => { try { return fn(); } catch { return null; } };

// uid signed in. Returns { changed, restored }: changed = the data on screen is now another account's (or none).
export function switchOwner(storage, uid) {
  if (!uid || typeof uid !== 'string') return { changed: false, restored: false };
  const prev = safe(() => storage.getItem(OWNER_KEY));
  if (prev === uid) return { changed: false, restored: false };
  if (!prev) { safe(() => storage.setItem(OWNER_KEY, uid)); return { changed: false, restored: false }; }   // numbers typed before any sign-in become this account's
  const saved = {};
  for (const k of BOUND_KEYS) { const v = safe(() => storage.getItem(k)); if (typeof v === 'string' && v !== '') saved[k] = v; }
  if (Object.keys(saved).length) safe(() => storage.setItem(stashKey(prev), JSON.stringify(saved)));
  else safe(() => storage.removeItem(stashKey(prev)));
  for (const k of BOUND_KEYS) safe(() => storage.removeItem(k));
  let restored = false;
  const mine = safe(() => JSON.parse(storage.getItem(stashKey(uid)) || 'null'));
  if (mine && typeof mine === 'object') {
    for (const k of BOUND_KEYS) if (typeof mine[k] === 'string') { safe(() => storage.setItem(k, mine[k])); restored = true; }
  }
  safe(() => storage.removeItem(stashKey(uid)));
  safe(() => storage.setItem(OWNER_KEY, uid));
  return { changed: true, restored };
}

// "Also remove from this phone" at sign-out: the account's data and its put-away copy go.
export function forgetOwner(storage, uid) {
  for (const k of BOUND_KEYS) safe(() => storage.removeItem(k));
  if (uid) safe(() => storage.removeItem(stashKey(uid)));
  if (!uid || safe(() => storage.getItem(OWNER_KEY)) === uid) safe(() => storage.removeItem(OWNER_KEY));
}
