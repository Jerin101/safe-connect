// জরুরি সাহায্য (R5 of plan v4, #267): what the #/sos page adds around বিপদ বার্তা: a big 999 call, "এখন যা করবেন"
// for the chosen situation (short steps, then the nearest police station / hospital on the map), this area's
// emergency numbers (official where we have them; elsewhere 999 and the nearest police station, fire station and
// hospital, never an unofficial number), and the 19 national helplines grouped by need, each with its source.
// Nothing here reads the location or sends anything. Built with createElement + textContent.
import { icon } from './icons.js';
import { buildPack, savePack, loadPack, clearPack } from './offlinepack.js';
import { canSpeak, speak, stopSpeaking } from './speak.js';
import { canSiren, startSiren, stopSiren, isOn } from './siren.js';

// which national helplines go together, by what the person needs
const GROUPS = [
  ['emergency', ['emergency', 'fire']],
  ['women', ['women_children']],
  ['health', ['health']],
  ['police', ['police', 'tourist_police', 'legal', 'anti_corruption']],
  ['disaster', ['disaster', 'coast_river']],
  ['info', ['information']],
];
// the nearest places that help in each situation (category ids of js/near.js)
const SIT_CATS = { danger: ['police', 'hospital'], followed: ['police'], accident: ['hospital', 'police'], sick: ['hospital', 'pharmacy'], lost: ['police', 'transport'], harassment: ['police'] };
// a situation's own helpline (SRS FR07: harassment → নারী ও শিশু সহায়তা ১০৯, from data/national_hotlines.json)
const SIT_LINE = { harassment: 'women-children-violence-109', sick: 'health-call-centre-16263' };

export function initEmergency(ctx) {
  const { el } = ctx;
  const T = () => ctx.texts();
  const num = (s) => ctx.digits(s);
  let areaRun = 0;

  function call999(box) {
    const a = el('a', 'sos-call'); a.href = 'tel:999';
    const ring = el('span', 'sos-ring'); ring.append(icon('phone'));
    const txt = el('span'); txt.append(el('b', null, T().call999), el('small', null, T().call999Sub));
    a.append(ring, txt);
    const ask = el('div', 'esc'); ask.hidden = true;
    // The page cannot know whether the call connected, so the person tells us; the next steps are guided, never automatic.
    a.addEventListener('click', () => { ask.hidden = false; escalate(ask, 'ask'); });
    box.replaceChildren(a, ask);
  }
  // Emergency escalation (plan section 2): 999 first, then one step at a time. Nothing is dialled or sent for the person.
  function escalate(box, stage) {
    const E = T().esc, line = el('div', 'esc-box');
    line.append(el('b', null, E.asked), el('small', null, E.note));
    const row = el('div', 'pills');
    const yes = el('button', 'btn', E.yes); yes.type = 'button'; yes.addEventListener('click', () => { box.replaceChildren(el('p', 'esc-ok', E.thanks)); });
    const no = el('button', 'btn red', E.no); no.type = 'button'; no.addEventListener('click', () => escalate(box, 'next'));
    row.append(yes, no); line.append(row);
    if (stage === 'next') {
      const ol = el('ol', 'sos-steps');
      const li = (txt, node) => { const x = el('li'); x.append(node || txt); ol.append(x); return x; };
      const again = el('a', 'btn red', E.s1); again.href = 'tel:999'; li('', again);
      const sit = ctx.situation && ctx.situation();
      const hl = sit && SIT_LINE[sit] && (ctx.national() || []).find((r) => r.id === SIT_LINE[sit]);
      if (hl && hl.phones && hl.phones.length) { const c = el('a', 'btn', `${E.s2}: ${num(hl.phones[0])}`); c.href = `tel:${hl.phones[0]}`; li('', c); }
      const pol = el('button', 'btn', E.s3); pol.type = 'button'; pol.addEventListener('click', () => ctx.go('c/police')); li('', pol);
      const sms = el('button', 'btn', E.s4); sms.type = 'button'; sms.addEventListener('click', () => ctx.go('send')); li('', sms);
      const fam = el('button', 'btn', E.s5); fam.type = 'button'; fam.addEventListener('click', () => ctx.go('live')); li('', fam);
      line.append(el('p', null, E.next), ol);
    }
    box.replaceChildren(line);
  }

  // "এখন যা করবেন" for the chosen situation; hidden while none is chosen
  function steps(box, sit) {
    const s = T().steps[sit];
    if (!s) { box.hidden = true; box.replaceChildren(); return; }
    const h = el('h2', null, `${s.title}: ${T().whatNow}`); h.id = 'sitStepsTitle';
    const ol = el('ol', 'sos-steps');
    for (const x of s.do) ol.append(el('li', null, x));
    const near = el('div', 'pills');
    const line = SIT_LINE[sit] && (ctx.national() || []).find((r) => r.id === SIT_LINE[sit]);
    if (line && line.phones && line.phones.length) {
      const c = el('a', 'btn red', `${ctx.lang() === 'en' ? line.name_en || line.name_bn : line.name_bn} ${num(line.phones[0])}`); c.href = `tel:${line.phones[0]}`; c.prepend(icon('phone', { size: 'sm' }));
      near.append(c);
    }
    for (const c of SIT_CATS[sit] || []) {
      const b = el('button', 'btn', T().nearest[c]); b.type = 'button'; b.prepend(icon('pin', { size: 'sm' }));
      b.addEventListener('click', () => ctx.go(`c/${c}`));
      near.append(b);
    }
    const tools = el('div', 'pills');
    if (canSpeak()) {   // voice help: read the steps aloud (the phone's own voice; nothing is sent)
      const rd = el('button', 'btn loud', T().speak.read); rd.type = 'button'; rd.setAttribute('aria-pressed', 'false');
      const idle = () => { rd.textContent = T().speak.read; rd.setAttribute('aria-pressed', 'false'); };
      rd.addEventListener('click', () => { if (speak([`${s.title}.`, ...s.do], ctx.lang(), idle)) { rd.textContent = T().speak.reading; rd.setAttribute('aria-pressed', 'true'); } });
      const sp = el('button', 'btn ghost loud', T().speak.stop); sp.type = 'button'; sp.addEventListener('click', () => { stopSpeaking(); idle(); });
      tools.append(rd, sp);
    }
    box.replaceChildren(h, ol, ...(tools.children.length ? [tools] : []), near);
    box.hidden = false;
  }

  // this area's numbers: the official list (pilot data) or 999 + the nearest police station, fire station and hospital
  async function area(box) {
    const run = ++areaRun;
    const a = await ctx.near.area();
    if (run !== areaRun) return;
    const h = el('h2', null, T().areaTitle); h.id = 'sosAreaTitle';
    if (!a) {
      const b = el('button', 'btn', T().chooseArea); b.type = 'button'; b.prepend(icon('pin', { size: 'sm' }));
      b.addEventListener('click', () => ctx.pickArea());
      box.replaceChildren(h, el('p', 'muted', T().noArea), b);
      return;
    }
    const rows = ctx.officialRows(a);
    if (rows && rows.length) {
      const list = el('div', 'first'); list.append(...rows);
      box.replaceChildren(h, el('p', 'muted', ctx.near.label(a)), list);
      return;
    }
    const inner = el('div', 'sos-area-near');
    box.replaceChildren(h, el('p', 'muted', ctx.near.label(a)), inner);
    await ctx.near.homeNums(inner, a, { titleId: 'sosAreaNumsTitle', title: false });
  }

  // the 19 national helplines, grouped by need, each with its call button and source
  function helplines(box, list = ctx.national(), note = '') {
    const all = list;
    const h = el('h2', null, T().linesTitle); h.id = 'sosLinesTitle';
    if (!all) { box.replaceChildren(h, el('div', 'skeleton')); return; }
    // folded by default: the page stays short; the area's numbers above are what most people need
    const fold = el('details', 'fold'); const sum = el('summary'); sum.append(h);
    const kids = [sum];
    for (const [key, cats] of GROUPS) {
      const rs = all.filter((r) => cats.includes(r.category) && r.phones && r.phones.length);
      if (!rs.length) continue;
      kids.push(el('h3', null, T().groups[key]));
      const rows = el('div', 'rows');
      for (const r of rs) {
        const row = el('div', 'r near-row');
        const sq = el('span', 'cat-ic sm'); sq.append(icon(['emergency', 'fire'].includes(r.category) ? 'alert' : r.category === 'health' ? 'health' : 'phone', { size: 'sm' }));
        const b = el('div'); b.append(el('div', 't', ctx.lang() === 'en' ? r.name_en || r.name_bn : r.name_bn || r.name_en));
        const acts = el('div', 'acts');
        const c = el('a', r.category === 'emergency' ? 'btn red' : 'btn', num(r.phones[0])); c.href = `tel:${r.phones[0]}`; c.prepend(icon('phone', { size: 'sm' }));
        acts.append(c);
        if (/^https:\/\//.test(r.source_url || '')) { const s = el('a', 'btn ghost', T().source); s.href = r.source_url; s.target = '_blank'; s.rel = 'noopener noreferrer'; acts.append(s); }
        row.append(sq, b, acts); rows.append(row);
      }
      kids.push(rows);
    }
    fold.replaceChildren(...kids);
    box.replaceChildren(...(note ? [el('p', 'muted', note)] : []), fold);
  }

  // Disaster mode (plan section 6): cyclone / flood / river danger. Only the official national lines already in
  // data/national_hotlines.json (with their source), then the nearest shelters. No instruction is written here that is not official.
  function disaster(box) {
    const D = T().disaster, all = ctx.national();
    const h = el('h2', null, D.title); h.id = 'sosDisasterTitle';
    if (!all) { box.replaceChildren(h, el('p', 'muted', D.none)); return; }
    const rows = all.filter((r) => ['disaster', 'coast_river'].includes(r.category) && r.phones && r.phones.length);
    const list = el('div', 'rows');
    for (const r of rows) {
      const row = el('div', 'r near-row');
      const sq = el('span', 'cat-ic sm'); sq.append(icon('alert', { size: 'sm' }));
      const b = el('div'); b.append(el('div', 't', ctx.lang() === 'en' ? r.name_en || r.name_bn : r.name_bn || r.name_en));
      const acts = el('div', 'acts');
      const c = el('a', 'btn', num(r.phones[0])); c.href = `tel:${r.phones[0]}`; c.prepend(icon('phone', { size: 'sm' })); acts.append(c);
      if (/^https:\/\//.test(r.source_url || '')) { const s = el('a', 'btn ghost', T().source); s.href = r.source_url; s.target = '_blank'; s.rel = 'noopener noreferrer'; acts.append(s); }
      row.append(sq, b, acts); list.append(row);
    }
    const sh = el('button', 'btn', D.shelters); sh.type = 'button'; sh.prepend(icon('pin', { size: 'sm' })); sh.addEventListener('click', () => ctx.go('c/shelter'));
    box.replaceChildren(h, el('p', 'muted', D.text), list, sh);
  }

  // Siren and silent SOS (guide section B). Both start only after a tap. "Quiet mode" hides every button that makes a sound
  // (siren, read aloud) and opens the messages app with the help message ready; the person still taps send.
  function quiet(on) { document.documentElement.dataset.quiet = on ? '1' : '0'; if (on) { stopSiren(); stopSpeaking(); } }
  function extras(box) {
    const X = T().extras, kids = [];
    if (canSiren()) {
      const b = el('button', 'btn loud siren-btn', X.siren); b.type = 'button'; b.prepend(icon('alert', { size: 'sm' }));
      const paint = () => { b.textContent = isOn() ? X.sirenStop : X.siren; b.prepend(icon('alert', { size: 'sm' })); b.setAttribute('aria-pressed', String(isOn())); };
      b.addEventListener('click', () => { if (isOn()) stopSiren(); else startSiren(paint); paint(); });
      kids.push(b);
    }
    const q = el('button', 'btn ghost', X.silent); q.type = 'button'; q.prepend(icon('msg', { size: 'sm' }));
    const state = () => document.documentElement.dataset.quiet === '1';
    q.addEventListener('click', () => {
      if (state()) { quiet(false); q.textContent = X.silent; q.prepend(icon('msg', { size: 'sm' })); note.textContent = X.silentNote; return; }
      if (!ctx.people().length) { ctx.sendHelp(); note.textContent = X.silentNoFamily; return; }   // no number to send to: the form opens, quiet mode stays off
      quiet(true); q.textContent = X.silentEnd; ctx.sendHelp(); note.textContent = X.silentOn;
    });
    const note = el('p', 'small muted', X.silentNote); note.setAttribute('role', 'status');
    const row = el('div', 'pills'); row.append(...kids, q);
    box.replaceChildren(el('h2', null, X.title), row, note, el('p', 'small muted', X.sirenNote));
  }

  // Emergency readiness check (guide section 6): are my family numbers and the offline pack ready BEFORE I need them?
  // It reads only what is already on this phone. Nothing is sent and the location is not read.
  let readyBox = null;   // the box on the page, so it can be drawn again
  addEventListener('sc-people', () => { if (readyBox && readyBox.isConnected) readiness(readyBox).catch(() => {}); });
  async function readiness(box) {
    readyBox = box;
    const R = T().ready, n = ctx.people().length;
    let pack = null; try { pack = await loadPack(); } catch { pack = null; }
    const row = (ok, text, action) => {
      const r = el('li', ok ? 'ready-ok' : 'ready-no'); r.append(icon(ok ? 'check' : 'alert', { size: 'sm' }), el('span', null, text));
      if (!ok && action) { const b = el('button', 'linkbtn', action.label); b.type = 'button'; b.addEventListener('click', action.run); r.append(b); }
      return r;
    };
    const list = el('ul', 'ready-list');
    list.append(
      row(n > 0, n > 0 ? ctx.fill(R.family, { n: num(n) }) : R.noFamily, { label: R.addFamily, run: ctx.openPeople }),
      row(!!pack, pack ? R.pack : R.noPack, null),
    );
    const done = n > 0 && !!pack;
    box.replaceChildren(el('h2', null, R.title), el('p', 'small muted', done ? R.allGood : R.todo), list);
  }

  // Offline emergency pack (plan section 3A): keep the numbers on the phone; show them when the data cannot load.
  // The saved SOS message texts (shown with the saved copy when the data files cannot load): one tap opens the messages app.
  function smsTexts(box, pack) {
    if (!pack.sms || !pack.sms.length) return;
    const P = T().pack, to = ctx.people().map((p) => p.phone).join(',');
    const d = el('details', 'sms-pack'); d.append(el('summary', null, P.smsTitle), el('p', 'small muted', P.smsNote));
    for (const x of pack.sms) {
      const text = ctx.lang() === 'en' ? x.en : x.bn;
      const a = el('a', 'btn ghost', `${x.label}: ${P.smsOpen}`); a.href = `sms:${to}?&body=${encodeURIComponent(text)}`;
      d.append(a);
    }
    box.append(d);
  }
  async function keepPack(box, noteBox) {
    const P = T().pack, nat = ctx.national();
    let pack = null;
    if (nat) {
      const a = await ctx.near.area().catch(() => null);
      const recs = a && ctx.remembers() && ctx.areaRecords ? ctx.areaRecords(a) : null;   // the area only if the phone may remember it
      pack = buildPack({ national: nat, area: recs, areaLabel: a && recs ? ctx.near.label(a) : '', sms: ctx.smsTemplates ? ctx.smsTemplates() : [] });
      await savePack(pack);
      if (readyBox && readyBox.isConnected) readiness(readyBox).catch(() => {});   // the card now sees the saved pack
    } else {
      pack = await loadPack();
      if (pack && pack.national.length) { helplines(box, pack.national, ctx.fill(P.copy, { date: ctx.fmtDate(pack.savedAt) })); smsTexts(box, pack); }
    }
    if (!pack) { noteBox.replaceChildren(); return; }
    const n = pack.national.length + (pack.area ? pack.area.records.length : 0);
    const kids = [el('p', 'small', ctx.fill(P.saved, { n: num(n), date: ctx.fmtDate(pack.savedAt) }))];
    if (pack.area && pack.area.records.length) kids.push(el('p', 'small', ctx.fill(P.area, { area: pack.area.label })));
    const rm = el('button', 'linkbtn', P.clear); rm.type = 'button';
    rm.addEventListener('click', async () => { await clearPack(); noteBox.replaceChildren(el('p', 'small', P.cleared)); });
    kids.push(rm);
    noteBox.replaceChildren(...kids);
  }

  return {
    show({ call, sit, steps: stepsBox, area: areaBox, lines, extras: extrasBox, ready: readyBox }) {
      if (extrasBox) extras(extrasBox);
      if (readyBox) readiness(readyBox).catch(() => {});
      call999(call); steps(stepsBox, sit); area(areaBox); helplines(lines);
      const dz = lines.previousElementSibling; if (dz && dz.id === 'sosDisaster') disaster(dz);
      const note = lines.nextElementSibling && lines.nextElementSibling.id === 'sosPack' ? lines.nextElementSibling : null;
      if (note) keepPack(lines, note).catch(() => {});
    },
    steps,
    helplines,
  };
}
