// Sync queue for reports made offline (plan section 3C). A wrong-number report or a "missing place" request written with no
// internet is kept in IndexedDB on the phone and sent when the internet is back and the person is signed in.
// Privacy: the queue holds only what the report itself holds (record id, district, problem, short note, area). It does NOT
// keep the user id, name, email or location: the uid is added at send time from the signed-in account, so a queued item
// cannot be sent by anyone else. Notes with phone numbers are refused here too (CLAUDE.md rule 5).
import { reportFields, missingFields } from './reports.js';
import { PLACE_VALUES, nextPlaceStatus } from './community.js';

const DB = 'safeconnect-queue', STORE = 'items';
export const MAX_ITEMS = 10;      // a short queue: this is for a few reports, not a log
export const MAX_TRIES = 5;       // an item that keeps failing is dropped, so it cannot block the rest
// An answer to "How is it now?" (open / closed / fuel) is only true for a short time. The server stamps it with the time it
// arrives, so an old answer sent late would look fresh. Therefore a queued answer is dropped after 1 hour.
export const VOTE_MAX_AGE_MS = 3600000;
const PLACE_ID = /^[a-z0-9-]{3,80}$/;   // the same pattern firestore.rules check

// Pure: the item to keep, or null if the draft is not a valid report. kind: 'report' | 'missing'.
export function makeItem(kind, draft, now = Date.now()) {
  if (kind === 'vote') {   // only the place and the answer; the uid is added by the signed-in account at send time
    const okVote = draft && PLACE_ID.test(String(draft.placeId || '')) && PLACE_VALUES.some(([k]) => k === draft.value);
    return okVote ? { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, kind, data: { placeId: draft.placeId, value: draft.value }, queuedAt: now, tries: 0 } : null;
  }
  const f = kind === 'missing' ? missingFields('queued', draft) : kind === 'report' ? reportFields('queued', draft) : null;
  if (!f) return null;
  const { uid, status, ...rest } = f;
  return { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, kind, data: rest, queuedAt: now, tries: 0 };
}
// Pure: the document to send for a queued item, with the real uid of the signed-in person (or null).
export function itemFields(item, uid) {
  if (!item || !item.data || !uid) return null;
  return item.kind === 'missing' ? missingFields(uid, item.data) : item.kind === 'report' ? reportFields(uid, item.data) : null;
}
const same = (a, b) => a.kind === b.kind && (a.kind === 'vote' ? a.data.placeId === b.data.placeId : JSON.stringify(a.data) === JSON.stringify(b.data));

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore(STORE, { keyPath: 'id' });
    q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error);
  });
}
async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), r = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(r && r.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function listQueue() { try { return ((await run('readonly', (s) => s.getAll())) || []).sort((a, b) => a.queuedAt - b.queuedAt); } catch { return []; } }
export async function countQueue() { return (await listQueue()).length; }
// 'saved' | 'duplicate' | 'full' | 'invalid' | 'unavailable'
export async function enqueue(kind, draft, now = Date.now()) {
  const item = makeItem(kind, draft, now);
  if (!item) return 'invalid';
  try {
    const all = await listQueue();
    if (item.kind === 'vote') {   // the newest answer for a place replaces the older one
      const old = all.find((x) => same(x, item));
      if (old) { await removeItem(old.id); all.splice(all.indexOf(old), 1); }
    } else if (all.some((x) => same(x, item))) return 'duplicate';
    if (all.length >= MAX_ITEMS) return 'full';
    await run('readwrite', (s) => s.put(item));
    return 'saved';
  } catch { return 'unavailable'; }
}
export const removeItem = (id) => run('readwrite', (s) => s.delete(id)).catch(() => {});
const bump = (item) => run('readwrite', (s) => s.put({ ...item, tries: item.tries + 1 })).catch(() => {});

// Sends the queued items one by one with the signed-in account. session: { fb, user }.
// Stops at the first limit or unverified email (the rest stay queued). Returns { sent, left }.
export async function flushQueue(session) {
  let sent = 0;
  if (!session || !session.fb || !session.user || !navigator.onLine) return { sent, left: await countQueue() };
  const items = await listQueue();
  for (const item of items) {
    if (item.kind === 'vote') {
      if (Date.now() - item.queuedAt > VOTE_MAX_AGE_MS) { await removeItem(item.id); continue; }   // too old to still be true
      try {
        if (!(await session.fb.isVerified())) break;
        const old = await session.fb.readPlaceStatus(item.data.placeId);
        await session.fb.sendPlaceStatus(item.data.placeId, item.data.value, nextPlaceStatus(old, item.data.value, Date.now()));
        await removeItem(item.id); sent++;
      } catch (e) {
        if (e && e.code === 'permission-denied') { await removeItem(item.id); continue; }   // the 30-minute limit or a refused answer: drop it
        if (item.tries + 1 >= MAX_TRIES) await removeItem(item.id); else await bump(item);
        break;
      }
      continue;
    }
    const fields = itemFields(item, session.user.uid);
    if (!fields) { await removeItem(item.id); continue; }
    try {
      if (!(await session.fb.isVerified())) break;
      await session.fb.sendReport(fields);
      await removeItem(item.id); sent++;
    } catch (e) {
      if (e && (e.code === 'limit-wait' || e.code === 'limit-day')) break;
      if (item.tries + 1 >= MAX_TRIES) await removeItem(item.id); else await bump(item);
      break;
    }
  }
  return { sent, left: await countQueue() };
}
