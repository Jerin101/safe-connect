// Offline emergency pack (plan section 3A): 999, the national helplines and (if the person lets the phone remember the
// area) this area's key numbers, kept in IndexedDB on the phone, each with its source link and check date. The service worker
// keeps the app and data files; this copy is a second safety net the page can show when the data files cannot load.
// Nothing leaves the phone. A saved number is never shown as live: the page always shows its check date and "saved copy".
const DB = 'safeconnect', STORE = 'pack', KEY = 'emergency';
const checkedOf = (r) => r.script_check?.on || r.checked_on || r.retrieved_on || null;
const slim = (r) => ({
  id: r.id || null, category: r.category || null, kind: r.kind || null,
  name_bn: r.name_bn || null, name_en: r.name_en || null, designation_bn: r.designation_bn || null, office_bn: r.office_bn || null,
  phones: (r.phones || []).filter((p) => /^\+?[0-9]{3,15}$/.test(p)).slice(0, 2),
  source_url: /^https:\/\//.test(r.source_url || '') ? r.source_url : null, checked_on: checkedOf(r),
});
// Pure: what is kept. Only records with a phone number.
export function buildPack({ national, area = null, areaLabel = '', now = Date.now() }) {
  const keep = (list) => (list || []).filter((r) => r && r.phones && r.phones.length).map(slim).filter((r) => r.phones.length);
  return { version: 1, savedAt: new Date(now).toISOString(), national: keep(national), area: area ? { label: String(areaLabel || '').slice(0, 120), records: keep(area).slice(0, 12) } : null };
}
function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore(STORE);
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
export async function savePack(pack) { try { await run('readwrite', (s) => s.put(pack, KEY)); return true; } catch { return false; } }
export async function loadPack() { try { const p = await run('readonly', (s) => s.get(KEY)); return p && p.version === 1 && Array.isArray(p.national) ? p : null; } catch { return null; } }
export async function clearPack() { try { await run('readwrite', (s) => s.delete(KEY)); return true; } catch { return false; } }
