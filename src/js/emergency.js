// জরুরি সাহায্য (R5 of plan v4, #267): what the #/sos page adds around বিপদ বার্তা: a big 999 call, "এখন যা করবেন"
// for the chosen situation (short steps, then the nearest police station / hospital on the map), this area's
// emergency numbers (official where we have them; elsewhere 999 and the nearest police station, fire station and
// hospital, never an unofficial number), and the 19 national helplines grouped by need, each with its source.
// Nothing here reads the location or sends anything. Built with createElement + textContent.
import { icon } from './icons.js';

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
    box.replaceChildren(a);
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
    box.replaceChildren(h, ol, near);
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
  function helplines(box) {
    const all = ctx.national();
    const h = el('h2', null, T().linesTitle); h.id = 'sosLinesTitle';
    if (!all) { box.replaceChildren(h, el('div', 'skeleton')); return; }
    const kids = [h, el('p', 'muted', T().linesText)];
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
    box.replaceChildren(...kids);
  }

  return {
    show({ call, sit, steps: stepsBox, area: areaBox, lines }) {
      call999(call); steps(stepsBox, sit); area(areaBox); helplines(lines);
    },
    steps,
    helplines,
  };
}
