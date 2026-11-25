// Trust and verification (teacher's plan, section 1). Every contact shows WHO checked it, HOW, WHEN and when the next
// check is due. A contact whose check date is too old stops being shown as verified. Nothing is invented: the dates and
// the method come from the data file (script_check.on, checked_on, retrieved_on, status).
// The review periods are an INITIAL OPERATIONAL POLICY of the team, not an official standard.
export const POLICY = {
  national: 90,          // national helplines
  health: 30, police: 30, fire: 30, village_police: 30, local_representative: 30,   // local emergency and union contacts
  default: 30,
};
export const SOON_DAYS = 7;          // "check due soon" starts this many days before the end
const DAY = 86400000;
const EMERGENCY = new Set(['police', 'fire', 'health', 'women_children', 'disaster', 'village_police']);

export const reviewDays = (r) => (r.kind === 'national' ? POLICY.national : POLICY[r.category] || POLICY.default);
export const isEmergency = (r) => r.kind === 'national' || EMERGENCY.has(r.category);
const day = (s) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// -> { state: 'ok' | 'soon' | 'expired' | 'unknown', checkedOn, nextOn, daysLeft, method, by, days }
export function review(r, now = Date.now()) {
  const checkedOn = r.script_check?.on || r.checked_on || r.retrieved_on || null, t = day(checkedOn), days = reviewDays(r);
  const human = r.status === 'verified';
  const base = { checkedOn, days, method: human ? 'human' : 'script', by: human ? 'team' : 'script' };
  if (t === null) return { ...base, state: 'unknown', nextOn: null, daysLeft: null };
  const next = t + days * DAY, daysLeft = Math.floor((next - (Math.floor(now / DAY) * DAY)) / DAY);
  return { ...base, nextOn: iso(next), daysLeft, state: daysLeft < 0 ? 'expired' : daysLeft <= SOON_DAYS ? 'soon' : 'ok' };
}
export const isStale = (r, now) => { const s = review(r, now).state; return s === 'expired' || s === 'unknown'; };

// Admin task list: how many records need a new check, by category (most first).
export function tasks(records, now = Date.now()) {
  const by = {}; let total = 0, due = 0, soon = 0, sourced = 0;
  for (const r of records) {
    total++;
    if (r.source_url && (r.script_check?.on || r.checked_on || r.retrieved_on)) sourced++;
    const s = review(r, now).state;
    if (s === 'expired' || s === 'unknown') { due++; by[r.category || 'other'] = (by[r.category || 'other'] || 0) + 1; }
    else if (s === 'soon') soon++;
  }
  return { total, sourced, due, soon, fresh: total - due - soon, by: Object.entries(by).sort((a, b) => b[1] - a[1]) };
}
