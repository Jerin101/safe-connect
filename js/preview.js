// Logic for preview.html: the portal design (issues #38, #42; rules in docs/DESIGN.md). The real site (index.html, pages/) is built in P20-P36.
// Location is read only after a tap (CLAUDE.md rule 5). The area search lives in data.js (issue #36).
import { DISTRICTS, loadAll, upazilas, localAreas, areaContacts, norm, areaIndex as buildAreaIndex, findAreas } from './data.js';
import { loadLocations, getPosition, nearestPlace, mapsLink } from './location.js';
import { initAuth, ICON as ROLE_ICON } from './auth.js';

// Texts shown to people live in js/lang/bn.json and js/lang/en.json (CLAUDE.md); "ui" = buttons, labels and
// messages, "page" = the home page sections. {name} marks a blank that fill() puts a value into.
const loadLang = async (code) => {
  const res = await fetch(`js/lang/${code}.json`);
  if (!res.ok) throw new Error(`Could not load js/lang/${code}.json (${res.status})`);
  return res.json();
};
const LANG = {};
[LANG.bn, LANG.en] = await Promise.all([loadLang('bn'), loadLang('en')]);
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (all, key) => (key in values ? values[key] : all));
const NATIONAL_EVERYWHERE = ['national-emergency-999', 'women-children-violence-109', 'child-helpline-1098', 'health-call-centre-16263', 'fire-service-102', 'info-service-333'];
const VISIBLE = 6;

const $ = (id) => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
let lang = store.get('sc-lang') || 'bn';
let data = null, locations = null, current = null, areaIndex = [];
let activeTab = 'home'; // header tab that gets aria-current="page"
const t = () => LANG[lang].ui;
const digits = (s) => (lang === 'bn' ? String(s).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : String(s));
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const withPhone = (r) => r.phones && r.phones.length > 0;
const fmtDate = (iso) => { try { return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)); } catch { return iso; } };

/* ---------- names ---------- */
const districtOf = (key) => DISTRICTS.find((d) => d.key === key);
function upazilaName(dkey, en) {
  const u = upazilas(data.docs[dkey]).find((x) => x.en === en);
  return lang === 'bn' && u ? u.bn : en;
}
function areaName(a) {
  if (!a) return '';
  if (lang === 'en' && a.en) return a.en;
  return a.type === 'municipality' ? a.bn.split(/[,،]/)[0].trim() : a.bn;
}
function placeTitle(p) {
  if (p.label) return p.label;
  return p.area ? areaName(p.area) : `${upazilaName(p.district, p.upazila)} (${t().wholeUpazila})`;
}
function placeSub(p) {
  const d = districtOf(p.district);
  const parts = p.area ? [upazilaName(p.district, p.upazila)] : [];
  parts.push(lang === 'bn' ? d.bn : d.en);
  return parts.join(', ');
}

/* ---------- area search: any spelling, Bangla or English, never a dead end (search code in data.js) ---------- */
function itemLabel(h) {
  const p = { ...h.place };
  const named = h.named && (lang === 'bn' ? h.named.name_bn : h.named.name_en || h.named.name_bn);
  if (named) p.label = named;
  const kindWord = (h.kind === 'local' && t().kinds[h.named?.type]) || t().kinds[h.kind] || '';   // "হাসান হাট (হাট ও ডাকঘর)"
  let title;
  if (h.kind === 'village') title = h.village;
  else if (named) title = named;
  else if (h.place.area) title = areaName(h.place.area);
  else title = upazilaName(p.district, p.upazila);
  if (h.kind === 'village') p.label = `${h.village} (${kindWord})`;
  const where = (h.kind === 'village' || h.kind === 'local') && h.place.area ? `${areaName(h.place.area)}, ` : '';
  const ward = h.ward ? ` · ${t().ward} ${digits(h.ward)}` : '';
  return { p, title: `${title} (${kindWord})`, sub: where + placeSub(p) + ward };
}
function suggestButton(h) {
  const li = el('li');
  const b = el('button'); b.type = 'button';
  const { p, title, sub } = itemLabel(h);
  b.append(el('b', null, title), el('span', null, sub));
  b.addEventListener('click', () => openArea(p, null));
  li.append(b);
  return li;
}
function renderSuggest() {
  const q = $('areaInput').value;
  const box = $('suggest');
  if (norm(q).length < 2) { box.hidden = true; return; }
  const only = $('distSel').value;
  const { hits, close } = findAreas(areaIndex, q, { district: only });
  if (hits.length) { box.replaceChildren(...hits.map(suggestButton)); box.hidden = false; return; }
  // Never a dead end: similar names, then the upazila list, then GPS and 999.
  const s = t();
  const parts = [el('li', 'none', close.length ? s.noExact : s.noMatch)];
  if (close.length) { parts.push(el('li', 'group', s.didYouMean)); close.forEach((h) => parts.push(suggestButton(h))); }
  const ups = el('li', 'fallback-box');
  ups.append(el('p', null, s.pickUpazila));
  const chips = el('div', 'chips');
  for (const d of DISTRICTS) {
    if (only && d.key !== only) continue;
    const doc = data.docs[d.key]; if (!doc) continue;
    for (const u of upazilas(doc)) {
      const c = el('button', 'chip', lang === 'bn' ? u.bn : u.en); c.type = 'button';
      c.addEventListener('click', () => openArea({ district: d.key, upazila: u.en, area: null }, null));
      chips.append(c);
    }
  }
  ups.append(chips);
  const row = el('div', 'tools');
  const gps = el('button', 'btn violet', s.locate); gps.type = 'button'; gps.addEventListener('click', locate);
  const call = el('a', 'btn', s.call999); call.href = 'tel:999';
  row.append(gps, call);
  ups.append(row, el('p', 'privacy', s.tellUs));
  parts.push(ups);
  box.replaceChildren(...parts);
  box.hidden = false;
}

/* ---------- contacts ---------- */
function callLink(num, label, red = false) {
  const a = el('a', `call${red ? ' red' : ''}`);
  a.href = `tel:${num}`;
  a.append(el('small', null, label), document.createTextNode(digits(num)));
  return a;
}
// Warning badges from the record's flags (CLAUDE.md data rules); the same on every row that shows a number.
function flagTags(r, tags = el('div', 'tags')) {
  for (const f of r.flags || []) if (t().flags[f]) tags.append(el('span', 'tag warn', t().flags[f]));
  return tags;
}
function personRow(r) {
  const row = el('div', 'person');
  const info = el('div');
  const nm = r.kind === 'national' && lang === 'en' ? r.name_en : r.name_bn;
  info.append(el('span', 'name', nm || r.designation_bn || r.office_bn || '—'));   // some pages give no name or post
  const role = [nm && r.designation_bn !== nm ? r.designation_bn : '', r.office_bn].filter(Boolean).join(' · ');
  if (role && r.kind !== 'national') info.append(el('span', 'role', role));
  const tags = el('div', 'tags');
  if (r.ward_no) tags.append(el('span', 'tag', `${t().ward} ${digits(r.ward_no)}`));
  flagTags(r, tags);
  if (tags.children.length) info.append(tags);
  row.append(info);
  const calls = el('div', 'calls');
  (r.phones || []).slice(0, 2).forEach((p) => calls.append(callLink(p, t().call)));
  row.append(calls);
  if (r.source_url) {
    const src = el('p', 'src');
    const a = el('a', null, `${t().source} ↗`); a.href = r.source_url; a.target = '_blank'; a.rel = 'noopener';
    src.append(a, ` · ${t().checked} ${fmtDate(r.script_check?.on || r.checked_on || r.retrieved_on)}`);
    row.append(src);
  }
  return row;
}
function firstRow(what, r, red = false) {
  const row = el('div', 'first-row glass');
  const info = el('div');
  info.append(el('span', 'what', what));
  const who = r.kind === 'national' ? (lang === 'en' ? r.name_en : r.name_bn) : [r.name_bn, r.designation_bn].filter(Boolean).join(', ');
  info.append(el('span', 'who', who));
  const tags = flagTags(r);
  if (tags.children.length) info.append(tags);
  if (r.source_url) {                     // every number shows its source and check date (CLAUDE.md data rules)
    const src = el('span', 'src');
    const a = el('a', null, `${t().source} ↗`); a.href = r.source_url; a.target = '_blank'; a.rel = 'noopener';
    src.append(a, ` · ${t().checked} ${fmtDate(r.script_check?.on || r.checked_on || r.retrieved_on)}`);
    info.append(src);
  }
  row.append(info, callLink(r.phones[0], t().call, red));
  return row;
}

function renderArea() {
  const p = current.place;
  const groups = p.outside ? null : areaContacts(data, p);
  $('youAreIn').textContent = p.outside ? t().outsideTitle : t().youAreIn;
  $('placeName').textContent = p.outside ? `${digits(current.pos.lat.toFixed(4))}, ${digits(current.pos.lon.toFixed(4))}` : placeTitle(p);
  $('placeSub').textContent = p.outside ? '' : placeSub(p);
  $('outside').hidden = !p.outside;
  $('outside').textContent = t().outside;

  const note = p.placeId && data.docs[p.district].places.find((x) => x.id === p.placeId);
  $('placeNote').hidden = !note;
  if (note) $('placeNote').textContent = note.how_to_report_bn;

  // share
  $('share').hidden = !current.pos;
  if (current.pos) {
    const link = mapsLink(current.pos);
    const msg = fill(t().shareMsg, { link });
    const wa = el('a', 'btn', t().wa); wa.href = `https://wa.me/?text=${encodeURIComponent(msg)}`; wa.target = '_blank'; wa.rel = 'noopener';
    const sms = el('a', 'btn', t().smsShort); sms.href = `sms:?&body=${encodeURIComponent(msg)}`;
    const map = el('a', 'btn', t().map); map.href = link; map.target = '_blank'; map.rel = 'noopener';
    const copy = el('button', 'btn', t().copy); copy.type = 'button';
    copy.addEventListener('click', () => navigator.clipboard?.writeText(msg).then(() => { copy.textContent = t().copied; }, () => {}));
    const fam = el('button', 'btn violet', t().sendFamily); fam.type = 'button';
    fam.addEventListener('click', () => openSos(current.pos));
    $('shareBtns').replaceChildren(fam, wa, sms, copy, map);
  }

  // call these first
  const first = $('firstList');
  first.replaceChildren();
  const nat = (id) => data.national.find((n) => n.id === id);
  first.append(firstRow(t().what.emergency, nat('national-emergency-999'), true));
  if (groups) {
    const g = (id) => groups.find((x) => x.id === id);
    const pick = (id) => (g(id)?.items || []).find((r) => withPhone(r) && r.kind !== 'national');
    const police = pick('police');
    if (police) first.append(firstRow(t().what.police, police));
    if (p.area && pick('tourist_police') && p.district === 'coxsbazar') first.append(firstRow(t().what.tourist_police, nat('tourist-police-helpline')));
    const local = p.area?.type === 'municipality' ? pick('town') : pick('local');
    if (local) first.append(firstRow(p.area?.type === 'municipality' ? t().what.town : t().what.local, local));
    else { const uno = pick('administration'); if (uno) first.append(firstRow(t().what.administration, uno)); }
  }

  // more help
  const more = $('moreList');
  more.replaceChildren();
  const list = groups
    ? groups.filter((gr) => gr.id !== 'emergency')
    : [{ id: 'helplines', items: NATIONAL_EVERYWHERE.slice(1).map(nat).filter(Boolean) }];
  for (const gr of list) {
    const items = gr.items;
    const callable = items.filter(withPhone).length;
    const d = el('details', 'cat');
    const s = el('summary');
    s.append(el('span', null, t().groups[gr.id] || gr.id), el('span', 'count', digits(callable)));
    d.append(s);
    const body = el('div', 'cat-body');
    if (gr.fallback) body.append(el('p', 'fallback', t().fallback));
    if (gr.noNumbers) body.append(el('p', 'fallback', t().noNumbers));
    const sorted = [...items].sort((a, b) => withPhone(b) - withPhone(a));
    sorted.forEach((r, i) => { const row = personRow(r); if (i >= VISIBLE) row.hidden = true; body.append(row); });
    if (sorted.length > VISIBLE) {
      const b = el('button', 'btn showall', fill(t().showAll, { n: digits(sorted.length) })); b.type = 'button';
      b.addEventListener('click', () => { body.querySelectorAll('.person[hidden]').forEach((x) => { x.hidden = false; }); b.remove(); });
      body.append(b);
    }
    d.append(body);
    more.append(d);
  }
  if (!groups) more.firstChild.open = true;
}

/* ---------- views ---------- */
// Every view opens at the top with a short fade (no fade under prefers-reduced-motion, see preview.html).
function showView(name) {
  for (const view of ['home', 'area', 'sos', 'acct', 'ws']) $(view).hidden = name !== view;
  const v = $(name);
  v.classList.remove('page-in'); void v.offsetWidth; v.classList.add('page-in');   // restart the fade
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}
// Opening an area = going to its address (#/area/...); the router then calls showArea.
function openArea(place, pos) { go(areaPath(place), { place, pos }); }
function showArea(place, pos) {
  current = { place, pos };
  if (!place.outside) store.set('sc-last', JSON.stringify(place));
  renderChip();
  renderArea();
  showView('area');
}
function goHome() {
  $('areaInput').value = '';
  $('suggest').hidden = true;
  go('');
}

/* ---------- pages (issue #71): hash addresses inside preview.html, so they also work offline ---------- */
// #/ home · #/numbers · #/area (search) · #/area/<district>/<upazila>[/<union or town>[/<place id>]] · #/send
// #/guide · #/about · #/faq · #/account. Anything else opens home. The home sections carry data-pages="..."
// in preview.html: each page shows the sections that list its name, so no content or id is copied.
const PAGES = ['home', 'numbers', 'area', 'send', 'guide', 'about', 'faq', 'account'];
const HEADING = { home: 'hello', numbers: 'numbersTitle', area: 'findTitle', guide: 'guideTitle', about: 'aboutTitle', faq: 'faqTitle' };
let pending = null;          // what the tap wants (e.g. the place with its name, or "ask for location"), used once
let firstRoute = true;       // the first page after loading does not move focus
let routeMsg = false;        // the "area not found" line is showing
let pageTitle = () => '';
const slug = (s) => norm(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function go(path, intent = null) {
  pending = intent;
  const hash = `#/${path}`;
  if (location.hash === hash || (!path && !location.hash)) route(); else location.hash = hash;
}
// Address of a place, built from the ids already in the data: district key, upazila and union names, place id.
function areaPath(p) {
  if (p.outside) return 'area/outside';
  const parts = ['area', p.district, slug(p.upazila)];
  const doc = data?.docs[p.district];
  if (p.area && doc) {
    const all = localAreas(doc, p.upazila);
    const full = all.find((a) => a.type === p.area.type && a.bn === norm(p.area.bn));
    if (full?.type === 'union' && full.en) parts.push(slug(full.en));
    else if (full?.type === 'municipality') {
      const i = all.filter((a) => a.type === 'municipality').indexOf(full);
      parts.push(i ? `town-${i + 1}` : 'town');
    }
  }
  if (p.placeId && parts.length === 4) parts.push(p.placeId);
  return parts.join('/');
}
// The place for an address, or null when it is not in the data.
function placeFromPath([dkey, upz, areaSlug, placeId]) {
  const doc = data?.docs[dkey];
  if (!doc || !upz) return null;
  const u = upazilas(doc).find((x) => slug(x.en) === upz);
  if (!u) return null;
  const place = { district: dkey, upazila: u.en, area: null };
  if (!areaSlug) return place;
  const all = localAreas(doc, u.en);
  const towns = all.filter((a) => a.type === 'municipality');
  const m = /^town(?:-(\d+))?$/.exec(areaSlug);
  place.area = m ? towns[(m[1] ? Number(m[1]) : 1) - 1] : all.find((a) => a.type === 'union' && a.en && slug(a.en) === areaSlug);
  if (!place.area) return null;
  const named = placeId && (doc.places || []).find((x) => x.id === placeId && norm(x.union_bn) === place.area.bn);
  if (named) { place.placeId = named.id; place.label = lang === 'bn' ? named.name_bn : named.name_en || named.name_bn; }
  return place;
}
function readHash() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
}
// Home and the pages made of home sections.
function showPage(page) {
  $('main').dataset.page = page;
  document.querySelectorAll('#home [data-pages]').forEach((e) => { e.hidden = !e.dataset.pages.split(' ').includes(page); });
  if (!$('iconSrc').hidden) $('iconSrc').open = page === 'numbers';
  if (page === 'home') renderRecent();
  showView('home');
}
function setTitle() { const x = pageTitle(); document.title = x ? `${x} · SafeConnect` : 'SafeConnect'; }
function finish(tab, title, headingId, intent) {
  activeTab = tab; markTab();
  pageTitle = title; setTitle();
  if (!firstRoute) $(headingId)?.focus({ preventScroll: true });
  firstRoute = false;
  intent?.after?.();
}
async function route() {
  const intent = pending; pending = null;
  if (routeMsg) { msg(''); routeMsg = false; }
  let [name = 'home', ...rest] = readHash();
  if (!PAGES.includes(name)) { history.replaceState(null, '', '#/'); name = 'home'; rest = []; }
  const titleOf = (key) => () => P().titles[key];
  if (name === 'area' && rest.length) {
    const path = ['area', ...rest].join('/');
    const same = current && areaPath(current.place) === path;
    const place = intent?.place || (same ? current.place : placeFromPath(rest));
    if (place) {
      $('main').dataset.page = 'place';
      showArea(place, intent ? intent.pos : same ? current.pos : null);
      finish('area', () => (current.place.outside ? t().outsideTitle : placeTitle(current.place)), 'placeName', intent);
      return;
    }
    // Not in the data (old link, typo): home with a calm line, never an empty page.
    history.replaceState(null, '', '#/');
    showPage('home');
    msg(P().notFound); routeMsg = true;
    finish('home', titleOf('home'), 'hello', null);
    return;
  }
  if (name === 'send') {
    $('main').dataset.page = 'send';
    showSos(intent?.pos || null, Boolean(intent?.ask));
    finish('send', titleOf('send'), 'sosTitle', intent);
    return;
  }
  if (name === 'account') {
    $('main').dataset.page = 'account';
    // Never loads Firebase by itself (issue #73): only a tap that brought the person here may.
    auth.open(intent);
    finish(null, titleOf('account'), $('ws').hidden ? 'acctTitle' : 'wsTitle', intent);
    return;
  }
  showPage(name);
  finish(name, titleOf(name), HEADING[name], intent);
}
// Header area chip: the last opened area (saved on this phone only), or "choose your area".
function renderChip() {
  let last = null;
  try { last = JSON.parse(store.get('sc-last') || 'null'); } catch {}
  const h = P().head;
  $('areaChipT').textContent = last && data && data.docs[last.district] ? placeTitle(last) : h.chipEmpty;
  $('areaChipS').textContent = h.chipSub;
}
function renderRecent() {
  renderChip();
  let last = null;
  try { last = JSON.parse(store.get('sc-last') || 'null'); } catch {}
  const b = $('recentBtn');
  if (!last || !data || !data.docs[last.district]) { b.hidden = true; return; }   // home can open before the data is loaded
  b.textContent = fill(t().recent, { n: placeTitle(last) });
  b.onclick = () => openArea(last, null);
  b.hidden = false;
}

/* ---------- location ---------- */
function msg(text) { $('locMsg').textContent = text; $('locMsg').hidden = !text; }
function resolvePlace(pos) {
  const found = locations && nearestPlace(locations, pos);
  if (!found) return { outside: true };
  const place = { district: found.district, upazila: found.upazila, area: found.area };
  const doc = data.docs[found.district];
  const named = found.area && (doc.places || []).find((x) => norm(x.union_bn) === found.area.bn);
  if (named) place.placeId = named.id;
  if (found.area) {
    const full = localAreas(doc, found.upazila).find((a) => a.type === found.area.type && a.bn === found.area.bn);
    if (full) place.area = full;
  }
  return place;
}
function applyPosition(pos) { lastFix = { pos, at: Date.now() }; openArea(resolvePlace(pos), pos); }
function demoPicks() {
  if (!locations) return [];
  const picks = [
    [locations.municipalities.find((m) => m.municipality_bn.includes('চৌমুহনী')), 'chowmuhani'],
    [locations.unions.find((u) => u.union_en === 'Jaliapalong'), 'inani'],
    [locations.unions.find((u) => u.district === 'Noakhali' && u.upazila_en === 'Hatiya'), 'hatiya'],
    [{ lat: 23.8103, lon: 90.4125 }, 'dhaka'],
  ].filter(([p]) => p);
  return picks;
}
function fillDemo(box, textEl, chipsEl, onPick) {
  if (!locations) return;
  textEl.textContent = t().demo;
  chipsEl.replaceChildren(...demoPicks().map(([p, name]) => {
    const b = el('button', 'chip', t().demoPlaces[name]); b.type = 'button';
    b.addEventListener('click', () => onPick({ lat: p.lat + 0.004, lon: p.lon - 0.003, accuracy: 20 }));
    return b;
  }));
  box.hidden = false;
}
function showDemo() { fillDemo($('demo'), $('demoText'), $('demoChips'), applyPosition); }
async function locate() {
  if ($('main').dataset.page !== 'home') go('');   // the location messages and the demo are on home
  const btn = $('locateBtn');
  btn.setAttribute('aria-busy', 'true');
  msg(t().locating);
  try {
    const pos = await getPosition();
    msg('');
    applyPosition(pos);
  } catch (err) {
    msg(t()[err.code] || t().unavailable);
    showDemo();
  } finally {
    btn.removeAttribute('aria-busy');
  }
}

/* ---------- send location to family (no login) ---------- */
let lastFix = null;          // { pos, at }
let sos = { situation: 'danger', pos: null, place: null, state: 'idle', edited: false };
const toAscii = (s) => String(s).replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d));
function normPhone(raw) {
  let d = toAscii(raw).replace(/\D/g, '');
  if (d.startsWith('880')) d = d.slice(2);
  else if (d.startsWith('88') && d.length === 13) d = d.slice(2);
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}
function getPeople() { try { return JSON.parse(store.get('sc-family') || '[]').filter((p) => p && normPhone(p.phone)); } catch { return []; } }
function setPeople(list) { store.set('sc-family', JSON.stringify(list)); }

function renderHomeSos() {
  const people = getPeople();
  const sub = $('sosBtnSub');
  sub.replaceChildren();
  if (!people.length) { sub.textContent = t().sosBtnSubNone; return; }
  sub.textContent = t().sosBtnSub;
  const chips = el('span', 'who-list');
  people.forEach((p) => chips.append(el('span', null, p.rel || p.name)));
  sub.append(chips);
}

function sosMessage() {
  const s = t();
  const lines = [`${s.urgent} ${s.sits[sos.situation][1]}`];
  if (sos.place && !sos.place.outside) lines.push(fill(s.area, { n: `${placeTitle(sos.place)}, ${placeSub(sos.place)}` }));
  lines.push(sos.pos ? fill(s.mapLine, { l: mapsLink(sos.pos) }) : s.noLoc);
  const time = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { hour: 'numeric', minute: '2-digit' }).format(new Date());
  lines.push(`${fill(s.timeLine, { x: time })} ${s.sign}`);
  return lines.join('\n');
}
function refreshMessage() { if (!sos.edited) $('sosMsg').value = sosMessage(); renderSend(); }

function renderSituations() {
  $('situations').replaceChildren(...Object.entries(t().sits).map(([k, [label]]) => {
    const b = el('button', 'chip', label); b.type = 'button';
    b.setAttribute('aria-pressed', String(k === sos.situation));
    b.addEventListener('click', () => { sos.situation = k; sos.edited = false; renderSituations(); refreshMessage(); });
    return b;
  }));
}
function renderLoc() {
  const line = $('sosLoc');
  line.className = 'locline';
  const btn = $('sosLocBtn');
  btn.textContent = t().locBtn;
  btn.hidden = !(sos.state === 'idle' || sos.state === 'failed');
  if (sos.state === 'idle') line.textContent = t().locIdle;
  else if (sos.state === 'getting') line.textContent = t().gettingLoc;
  else if (sos.pos && sos.place && !sos.place.outside) {
    line.classList.add('ok');
    const acc = sos.pos.accuracy ? digits(Math.round(sos.pos.accuracy)) : '';
    const place = `${placeTitle(sos.place)}, ${placeSub(sos.place)}`;
    line.textContent = acc ? fill(t().gotLocAcc, { place, m: acc }) : fill(t().gotLoc, { place });
  } else if (sos.pos) { line.classList.add('ok'); line.textContent = t().outsideLoc; }
  else { line.classList.add('bad'); line.textContent = `${sos.error === 'denied' ? t().sosDenied : t().sosNoLoc} ${t().noLocYet}`; }
}
function setSosPos(pos) {
  sos.pos = pos; sos.place = resolvePlace(pos); sos.state = 'done';
  lastFix = { pos, at: Date.now() };
  $('sosDemo').hidden = true;
  renderLoc(); refreshMessage();
}
function renderSend() {
  const people = getPeople();
  const body = () => $('sosMsg').value;
  const list = $('sendList');
  list.replaceChildren();
  if (!people.length) {
    list.append(el('p', 'msg plain', t().noPeople));
    $('peopleBox').open = true;
  }
  for (const p of people) {
    const row = el('div', 'contact');
    const av = el('span', 'avatar', (p.name || '?').trim().charAt(0).toUpperCase());
    const info = el('div');
    info.append(el('b', null, p.rel ? `${p.name} (${p.rel})` : p.name), el('span', 'num', digits(p.phone)));
    const sendRow = el('div', 'send-row');
    const sms = el('a', 'send'); sms.href = `sms:${p.phone}?&body=${encodeURIComponent(body())}`;
    sms.append(document.createTextNode(t().sms), el('small', null, t().smsNoNet));
    const wa = el('a', 'send alt', t().wa); wa.href = `https://wa.me/88${p.phone}?text=${encodeURIComponent(body())}`; wa.target = '_blank'; wa.rel = 'noopener';
    const call = el('a', 'send alt', t().call); call.href = `tel:${p.phone}`;
    const pair = el('div', 'pair'); pair.append(wa, call);
    sendRow.append(sms, pair);
    row.append(av, info, sendRow);
    list.append(row);
  }
  const tools = $('sendTools');
  tools.replaceChildren();
  if (people.length > 1) {
    const all = el('a', 'btn', fill(t().smsAll, { n: digits(people.length) }));
    all.href = `sms:${people.map((p) => p.phone).join(',')}?&body=${encodeURIComponent(body())}`;
    tools.append(all);
  }
  const copy = el('button', 'btn', t().copyMsg); copy.type = 'button';
  copy.addEventListener('click', () => navigator.clipboard?.writeText(body()).then(() => { copy.textContent = t().copied; }, () => { $('sosMsg').select(); }));
  tools.append(copy);
  if (navigator.share) {
    const other = el('button', 'btn', t().other); other.type = 'button';
    other.addEventListener('click', () => navigator.share({ text: body() }).catch(() => {}));
    tools.append(other);
  }
}
function renderPeople() {
  const people = getPeople();
  $('peopleCount').textContent = digits(people.length);
  $('savedList').replaceChildren(...people.map((p, i) => {
    const row = el('div', 'saved');
    row.append(el('span', null, `${p.name}${p.rel ? ` (${p.rel})` : ''} · ${digits(p.phone)}`));
    const rm = el('button', 'linkbtn', t().remove); rm.type = 'button';
    rm.addEventListener('click', () => { const l = getPeople(); l.splice(i, 1); setPeople(l); renderPeople(); renderSend(); renderHomeSos(); });
    row.append(rm);
    return row;
  }));
  $('addForm').hidden = people.length >= 3;
}
// askLocation = false: open the page without asking for location (e.g. only to save family numbers).
// Location is then read only when the person taps "Get my location" (CLAUDE.md rule 5).
// Opening #/send by Back, reload or a link never asks for location: only a tap does.
function openSos(pos, askLocation = true, after = null) { go('send', { pos, ask: askLocation, after }); }
function showSos(pos, askLocation) {
  sos = { situation: sos.situation || 'danger', pos: null, place: null, state: 'idle', edited: false, error: null };
  renderSituations(); renderPeople();
  showView('sos');
  const fresh = pos || (lastFix && Date.now() - lastFix.at < 120000 ? lastFix.pos : null);
  if (fresh) { setSosPos(fresh); return; }
  if (askLocation) { requestSosLocation(); return; }
  renderLoc(); refreshMessage();
}
async function requestSosLocation() {
  sos.state = 'getting'; sos.error = null;
  $('sosDemo').hidden = true;
  renderLoc(); refreshMessage();
  try { setSosPos(await getPosition()); }
  catch (err) {
    sos.state = 'failed'; sos.error = err.code;
    renderLoc(); refreshMessage();
    fillDemo($('sosDemo'), $('sosDemoText'), $('sosDemoChips'), setSosPos);
  }
}
$('sosLocBtn').addEventListener('click', requestSosLocation);
$('sosBtn').addEventListener('click', () => openSos(null));
$('sosBack').addEventListener('click', goHome);
$('sosMsg').addEventListener('input', () => { sos.edited = true; renderSend(); });
$('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('formErr');
  const name = $('pName').value.trim();
  const phone = normPhone($('pPhone').value);
  const people = getPeople();
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  if (people.length >= 3) return fail(t().maxPeople);
  if (!name) return fail(t().needName);
  if (!phone) return fail(t().badPhone);
  err.hidden = true;
  people.push({ name, rel: $('pRel').value.trim(), phone });
  setPeople(people);
  $('pName').value = ''; $('pRel').value = ''; $('pPhone').value = '';
  renderPeople(); renderSend(); renderHomeSos();
});

/* ---------- home extras ---------- */
const ICONS = {
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  map: 'M15 4 9 2 3 4v18l6-2 6 2 6-2V2l-6 2Zm-1 15.3-4-1.3V4.7l4 1.3v13.3Z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L21 7.5l-1.4-1.4z',
  open: 'M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v8H3V5h2Z',
};
const svg = (d) => { const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); n.setAttribute('viewBox', '0 0 24 24'); n.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d); n.append(p); return n; };
function renderStats() {
  const docs = Object.values(data.docs);
  const numbers = docs.reduce((n, d) => n + d.records.filter(withPhone).length, 0) + data.national.length;
  const areas = docs.reduce((n, d) => n + d.unions.length + d.municipalities.length, 0);
  const upz = docs.reduce((n, d) => n + upazilas(d).length, 0);
  const checked = docs.map((d) => d.records.find((r) => r.script_check?.on)?.script_check.on).find(Boolean) || docs[0]?.retrieved_on;
  const fmt = (n) => digits(new Intl.NumberFormat('en-US').format(n));
  const vals = [[fmt(numbers), ICONS.phone], [fmt(areas), ICONS.map], [fmt(upz), ICONS.pin], [checked ? fmtDate(checked) : '', ICONS.check]];
  $('stats').replaceChildren(...vals.map(([v, ic], i) => {
    const d = el('div', 'stat');
    const icon = el('span', 'ic'); icon.append(svg(ic));
    d.append(icon, el('b', null, v), el('span', null, t().stats[i]));
    return d;
  }));
}
function quickPlaces() {
  const find = (fn) => areaIndex.find(fn);
  return [
    ['chowmuhani', 'town', find((x) => x.place.area?.type === 'municipality' && x.place.area.bn.includes('চৌমুহনী'))],
    ['inani', 'beach', find((x) => x.named && x.named.id === 'place-inani-beach')],
    ['hatiya', 'island', find((x) => !x.place.area && x.place.upazila === 'Hatiya')],
    ['coxtown', 'city', find((x) => x.place.district === 'coxsbazar' && x.place.area?.type === 'municipality')],
  ].filter(([, , item]) => item);
}
// Known places (v3 card style): a line icon and the name; data-district lets the district filter hide them.
const PLACE_ICON = { town: ICONS.map, beach: ICONS.pin, island: ICONS.map, city: ICONS.pin };
function renderPlaces() {
  $('places').replaceChildren(...quickPlaces().map(([key, art, item]) => {
    const [name, sub] = t().places[key];
    const b = el('button', 'place'); b.type = 'button'; b.dataset.district = item.place.district;
    const label = el('span', 'label'); label.append(el('b', null, name), el('small', null, sub));
    const thumb = el('span', 'thumb'); thumb.append(svg(PLACE_ICON[art] || ICONS.pin));
    b.append(thumb, label);
    b.addEventListener('click', () => { const p = { ...item.place }; if (item.named) p.label = lang === 'bn' ? item.named.name_bn : item.named.name_en; openArea(p, null); });
    return b;
  }));
  applyDistrict();
}
// District filter (sidebar) and the district select in the search box are the same choice.
function setDistrict(key) {
  $('distSel').value = key; $('railDist').value = key;
  applyDistrict();
  renderSuggest();
}
function applyDistrict() {
  const key = $('distSel').value;
  $('places').querySelectorAll('.place').forEach((b) => { b.hidden = Boolean(key) && b.dataset.district !== key; });
}
function districtOptions(sel, allLabel) {
  const v = sel.value;
  sel.replaceChildren(...[['', allLabel], ...DISTRICTS.map((d) => [d.key, lang === 'bn' ? d.bn : d.en])].map(([k, l]) => { const o = el('option', null, l); o.value = k; return o; }));
  sel.value = v;
}
function saveNumbers() { openSos(null, false, () => { $('peopleBox').open = true; setTimeout(() => $('peopleBox').scrollIntoView({ block: 'start' }), 50); }); }


const SITE = {
  repo: 'https://github.com/Jerin101/safe-connect',
  report: 'https://github.com/Jerin101/safe-connect/issues/new?labels=data-gap&title=Wrong%20number',
};
const P = () => LANG[lang].page;
const MORE_ICONS = {
  signal: 'M2 9.5a15 15 0 0 1 20 0l-1.4 1.4a13 13 0 0 0-17.2 0L2 9.5Zm3.5 3.5a10 10 0 0 1 13 0l-1.4 1.4a8 8 0 0 0-10.2 0L5.5 13Zm3.5 3.5a5 5 0 0 1 6 0L12 19.5l-3-3Z',
  lock: 'M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3Z',
};
// The area search page; focusInput = true when the person tapped a search box or "change area".
function findArea(district = '', focusInput = true) {
  go('area', { after: () => { setDistrict(district); if (focusInput) $('areaInput').focus({ preventScroll: true }); } });
}
// The questions page with one answer open.
function openFaq(key) {
  go('faq', { after: () => {
    const d = document.querySelector(`#faqList details[data-key="${key}"]`);
    if (!d) return;
    d.open = true; d.scrollIntoView({ block: 'center' }); d.querySelector('summary').focus({ preventScroll: true });
  } });
}
function openQuick(key) { const q = quickPlaces().find(([k]) => k === key); if (!q) return; const [, , item] = q; const p = { ...item.place }; if (item.named) p.label = lang === 'bn' ? item.named.name_bn : item.named.name_en; openArea(p, null); }
const textBtn = (label, fn) => { const b = el('button', null, label); b.type = 'button'; b.addEventListener('click', fn); return b; };
const extLink = (label, href) => { const a = el('a', null, `${label} ↗`); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };

// Second header row: one button per page (DESIGN.md §3). Each tab changes the address; the router shows the page.
const NAV = [
  ['home', goHome],
  ['numbers', () => go('numbers')],
  ['area', () => findArea('', false)],
  ['send', () => openSos(null)],
  ['guide', () => go('guide')],
  ['about', () => go('about')],
  ['faq', () => go('faq')],
];
function renderNav() {
  $('nav').replaceChildren(...NAV.map(([key, fn]) => {
    const b = textBtn(P().nav[key], fn);
    b.dataset.key = key;
    return b;
  }));
  markTab();
}
function markTab() {
  $('nav').querySelectorAll('button').forEach((b) => {
    if (b.dataset.key === activeTab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
// Header texts and labels (row 1 and the search pill in row 2).
function renderHead() {
  const h = P().head;
  $('homeBtn').setAttribute('aria-label', h.home);
  $('nav').setAttribute('aria-label', h.navLabel);
  $('langBtn').setAttribute('aria-label', h.langLabel);
  $('themeBtn').setAttribute('aria-label', h.themeLabel);
  $('h999').setAttribute('aria-label', t().call999);
  $('ctaSend').textContent = h.cta;
  $('hFinderText').textContent = h.search;
  renderChip();
}
function renderAbout() {
  const a = P().about;
  $('aboutEyebrow').textContent = a.eyebrow; $('aboutTitle').textContent = a.title; $('aboutText').textContent = a.text; $('aboutMore').textContent = P().seeMore;
  $('points').replaceChildren(...a.points.map(([ic, title, text]) => {
    const d = el('div', 'point'); const i = el('span', 'ic'); i.append(svg(MORE_ICONS[ic] || ICONS[ic]));
    d.append(i, el('b', null, title), el('span', null, text)); return d;
  }));
}
function renderFaq() {
  const f = P().faq;
  $('faqEyebrow').textContent = f.eyebrow; $('faqTitle').textContent = f.title; $('faqMore').textContent = P().seeMore;
  $('faqList').replaceChildren(...f.items.map(([key, q, a]) => {
    const d = el('details'); d.dataset.key = key; d.append(el('summary', null, q), el('p', null, a)); return d;
  }));
}
function renderFooter() {
  const f = P().foot;
  const brand = el('div', 'foot-brand');
  const logo = $('homeBtn').cloneNode(true); logo.removeAttribute('id'); logo.addEventListener('click', goHome);
  brand.append(logo, el('p', null, f.tagline), el('small', null, f.small));
  const col = (title, items) => { const c = el('div', 'foot-col'); c.append(el('h3', null, title), ...items); return c; };
  const [sT, s] = f.services, [aT, a] = f.areas, [iT, i] = f.info;
  const call = el('a', null, s[0]); call.href = 'tel:999';
  const help = el('div', 'foot-col foot-help');
  help.append(el('h3', null, f.helpTitle), el('p', null, f.helpText), extLink('github.com/Jerin101/safe-connect', SITE.repo));
  $('footGrid').replaceChildren(brand,
    col(sT, [call, textBtn(s[1], () => openSos(null)), textBtn(s[2], locate), textBtn(s[3], () => findArea(''))]),
    col(aT, [textBtn(a[0], () => findArea('noakhali')), textBtn(a[1], () => findArea('coxsbazar')), textBtn(a[2], () => openQuick('chowmuhani')), textBtn(a[3], () => openQuick('inani'))]),
    col(iT, [textBtn(i[0], () => go('about')), textBtn(i[1], () => go('faq')), extLink(i[2], SITE.report), textBtn(i[3], () => openFaq('source'))]),
    help);
  const nav = el('nav'); nav.setAttribute('aria-label', 'Footer');
  const tests = el('a', null, f.bottom[3]); tests.href = 'tests/search-test.html';
  nav.append(textBtn(f.bottom[0], () => openFaq('privacy')), textBtn(f.bottom[1], () => openFaq('source')), extLink(f.bottom[2], SITE.repo), tests);
  $('footBottom').replaceChildren(el('span', null, f.copy), nav, el('p', 'credit', f.credit));
}
const GP_ICONS = {
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  fire: 'M13.5 2s1 3.5-1.5 6.5c-1.6 1.9-4 3.4-4 6.6A6 6 0 0 0 20 15c0-3-1.4-4.6-2.6-6-.4 1.6-1.3 2.6-2.4 3 .9-3.6-.2-7.4-1.5-10Z',
  health: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z',
  woman: 'M12 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-1 10h2a5 5 0 0 1 5 5v1h-3v4h-6v-4H6v-1a5 5 0 0 1 5-5Z',
  child: 'M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-4 8h8l-1 6h-2v4h-2v-4H9l-1-6Z',
  bag: 'M9 3h6a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V4a1 1 0 0 1 1-1Zm1 3h4V5h-4v1Z',
  info: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 8v7h2v-7h-2Zm0-4v2h2V6h-2Z',
  send: 'M2.5 11.2 20.6 3.4c.8-.34 1.6.46 1.26 1.26L14.1 22.8c-.37.86-1.62.78-1.87-.12l-1.9-6.98-6.98-1.9c-.9-.25-.98-1.5-.12-1.87Zm8.7 3.2 1.3 4.8 5.5-12.8-6.8 8Zm-1.2-1.2 8-6.8-12.8 5.5 4.8 1.3Z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z',
  flag: 'M5 3h2v18H5V3Zm3 1h11l-2.5 4L19 12H8V4Z',
  question: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 14v2h2v-2h-2Zm1-10a4 4 0 0 0-4 4h2a2 2 0 1 1 3 1.7c-1.2.7-2 1.6-2 3.3h2c0-1 .4-1.4 1.2-1.9A4 4 0 0 0 12 6Z',
  db: 'M12 2c4.4 0 8 1.3 8 3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5c0-1.7 3.6-3 8-3Zm6 6.2C16.5 9 14.4 9.5 12 9.5S7.5 9 6 8.2V11c0 .6 2.4 1.6 6 1.6s6-1 6-1.6V8.2Zm0 6c-1.5.8-3.6 1.3-6 1.3s-4.5-.5-6-1.3V17c0 .6 2.4 1.6 6 1.6s6-1 6-1.6v-2.8Z',
  lock: 'M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3Z',
  arrow: 'M13.2 5.3 20 12l-6.8 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z',
};
// Quiet single-colour tiles; only 999's tile is soft red (DESIGN.md §3).
const ICON_ROW = [['national-emergency-999', 'phone', 'soft-red'], ['fire-service-102', 'fire', ''], ['health-call-centre-16263', 'health', ''],
  ['women-children-violence-109', 'woman', ''], ['child-helpline-1098', 'child', ''], ['tourist-police-helpline', 'bag', ''], ['info-service-333', 'info', '']];
// Numbers that appear inside card text (situation cards); listed with their sources too.
const TEXT_NUMBERS = ['disaster-warning-1090'];
function iconCircle(path, cls) { const c = el('span', cls ? `circle ${cls}` : 'circle'); c.append(svg(path)); return c; }
// Round icon row: national numbers from data/national_hotlines.json (tap = call), plus "send location" and "help near me".
// Under it, the official source and check date of each number (DESIGN.md §5).
function renderIconRow() {
  const items = [], shown = [];
  if (data) {
    for (const [id, ic, cls] of ICON_ROW) {
      const n = data.national.find((x) => x.id === id);
      if (!n || !withPhone(n)) continue;
      const a = el('a', 'icon-item'); a.href = `tel:${n.phones[0]}`;
      a.append(iconCircle(GP_ICONS[ic], cls), el('b', null, P().icons[id]), el('small', null, digits(n.phones[0])));
      items.push(a); shown.push(n);
    }
    for (const id of TEXT_NUMBERS) { const n = data.national.find((x) => x.id === id); if (n && withPhone(n)) shown.push(n); }
  }
  const act = (label, sub, ic, cls, fn) => { const b = el('button', 'icon-item'); b.type = 'button'; b.append(iconCircle(GP_ICONS[ic], cls), el('b', null, label), el('small', null, sub)); b.addEventListener('click', fn); return b; };
  items.splice(1, 0, act(P().iconSend, P().iconSendSub, 'send', '', () => openSos(null)), act(P().iconNear, P().iconNearSub, 'pin', '', () => locate()));
  $('iconRow').replaceChildren(...items);
  $('iconSrc').hidden = !shown.length;
  if ($('main').dataset.page === 'numbers') $('iconSrc').open = true;   // the numbers page shows the sources open
  $('iconSrcTitle').textContent = P().iconSrc;
  $('iconSrcList').replaceChildren(...shown.map((n) => {
    const line = el('p', 'src');
    const a = el('a', null, `${t().source} ↗`); a.href = n.source_url; a.target = '_blank'; a.rel = 'noopener';
    line.append(`${P().icons[n.id]} (${digits(n.phones[0])}): `, a, ` · ${t().checked} ${fmtDate(n.checked_on)}`);
    return line;
  }));
}

function primaryBtn(label, fn, href) {
  const b = el(href ? 'a' : 'button', 'btn-primary');
  if (href) { b.href = href; b.target = '_blank'; b.rel = 'noopener'; } else { b.type = 'button'; b.addEventListener('click', fn); }
  b.append(document.createTextNode(label), svg(GP_ICONS.arrow));
  return b;
}
// "What happened?" cards. Numbers in the text come from data/national_hotlines.json, never typed in (CLAUDE.md rule 1).
function renderGuides() {
  $('guideTitle').textContent = P().guideTitle; $('guideText').textContent = P().guideText; $('guideMore').textContent = P().seeMore;
  const num = (id) => data?.national.find((x) => x.id === id)?.phones?.[0];
  const n = num('fire-service-102') && num('disaster-warning-1090') ? { fire: digits(num('fire-service-102')), warn: digits(num('disaster-warning-1090')) } : null;
  const actions = { sos: () => openSos(null), find: () => findArea(''), locate };
  const artIcon = { night: GP_ICONS.send, lost: GP_ICONS.flag, storm: GP_ICONS.fire };
  $('guideCards').replaceChildren(...P().guides.map(([art, title, text, btn, act]) => {
    const c = el('article', 'card');
    const body = el('div', 'body');
    body.append(el('h3', null, title), el('p', null, text.includes('{fire}') ? (n ? fill(text, n) : P().guideStormNoNumbers) : text), primaryBtn(btn, actions[act]));
    const top = el('div', 'art'); top.setAttribute('aria-hidden', 'true');
    const ic = el('span', 'ico'); ic.append(svg(artIcon[art] || GP_ICONS.info)); top.append(ic);
    c.append(top, body);
    return c;
  }));
}

// Two side cards: save family numbers · report a wrong number.
function renderDuo() {
  const [[ic1, t1, p1, b1], [ic2, t2, p2, b2]] = P().duo;
  const card = (ic, cls, title, text, btn) => {
    const c = el('div', 'duo-card'); const d = el('div');
    d.append(el('h3', null, title), el('p', null, text), btn);
    const badge = el('span', `badge-ic ${cls}`); badge.append(svg(GP_ICONS[ic]));
    c.append(d, badge); return c;
  };
  $('duoCards').replaceChildren(card(ic1, 'c-violet', t1, p1, primaryBtn(b1, saveNumbers)), card(ic2, 'c-amber', t2, p2, primaryBtn(b2, null, SITE.report)));
}
function renderHelp() {
  $('helpTitle').textContent = P().helpTitle;
  const [q, src, priv, rep] = P().help;
  const item = (label, ic, fn, href) => {
    const b = el(href ? 'a' : 'button', 'help-item');
    if (href) { b.href = href; b.target = '_blank'; b.rel = 'noopener'; } else { b.type = 'button'; b.addEventListener('click', fn); }
    const c = el('span', 'circle'); c.append(svg(GP_ICONS[ic])); b.append(c, el('span', null, label)); return b;
  };
  $('helpRow').replaceChildren(item(q, 'question', () => go('faq')), item(src, 'db', () => openFaq('source')), item(priv, 'lock', () => openFaq('privacy')), item(rep, 'flag', null, SITE.report));
}
// Weak-network band: only what works today gets a tick; the rest says "coming soon" (DESIGN.md §2).
function renderNet() {
  $('netTitle').textContent = P().netTitle;
  $('netList').replaceChildren(...P().net.map(([k, text]) => el('li', k === 'soon' ? 'soon' : null, text)));
}

// Sidebar (v3): "keep it on your phone" card with the short address, and the district filter.
function renderRail() {
  const r = P().rail;
  $('rail').setAttribute('aria-label', r.label);
  $('appTitle').textContent = r.appTitle; $('appText').textContent = r.appText;
  $('fTitle').textContent = r.fTitle; $('fDist').textContent = r.fDist; $('fNote').textContent = r.fNote; $('fReset').textContent = r.fReset;
  districtOptions($('railDist'), t().distAll);
}
// "Three roles, one goal" (from #66): one line each, honest about what is not built yet; signing in is never needed for help.
const ROLES = ['user', 'volunteer', 'admin'];
function renderRoles() {
  const r = P().roles, names = LANG[lang].auth.roles;
  $('rolesEyebrow').textContent = r.eyebrow; $('rolesT1').textContent = r.t1; $('rolesT2').textContent = r.t2; $('rolesText').textContent = r.text;
  $('rolesSignin').textContent = r.signIn;
  $('rolesGrid').replaceChildren(...ROLES.map((key) => {
    const d = el('div', 'role');
    const h = el('h3'); const i = el('span', 'ico'); i.append(svg(ROLE_ICON[key])); h.append(i, names[key].name);
    const tag = key === 'volunteer' ? r.volunteerTag : names[key].tag;
    d.append(h, el('p', null, r[key]), el('span', 'tag', tag));
    return d;
  }));
  $('rolesNote').replaceChildren(el('b', null, r.noteB), document.createTextNode(r.note));
}
// Arrows beside the numbers row: scroll by hand only, never by themselves (DESIGN.md §3b).
function scrollRow(dir) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('iconRow').scrollBy({ left: dir * 260, behavior: calm ? 'auto' : 'smooth' });
}

// Warm opening (DESIGN.md §2): greeting by time of day, trust ticks, a one-time welcome that never covers 999.
function renderWarm() {
  const h = new Date().getHours();
  const part = h >= 21 || h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'noon' : 'evening';
  const dot = el('span', 'dot', part === 'night' ? '☾' : '☀');
  dot.setAttribute('aria-hidden', 'true');
  $('greet').replaceChildren(dot, document.createTextNode(part === 'night' ? P().greet.night : `${P().greet[part]}! ${P().greetTail}`));
  $('trust').replaceChildren(...P().trust.map((x) => el('li', null, x)));
  const w = $('welcome');
  w.hidden = store.get('sc-welcomed') === '1';
  if (w.hidden) return;
  const close = () => { store.set('sc-welcomed', '1'); w.hidden = true; };
  const ok = el('button', 'btn', P().welcomeOk); ok.type = 'button';
  ok.addEventListener('click', close);
  const save = el('button', 'btn violet', P().welcomeSave); save.type = 'button';
  save.addEventListener('click', () => { close(); saveNumbers(); });
  const ol = el('ol'); P().welcomeSteps.forEach((x) => ol.append(el('li', null, x)));
  const row = el('div', 'row'); row.append(save, ok);
  const title = el('h2', null, P().welcomeTitle); title.id = 'welcomeTitle';
  w.replaceChildren(title, ol, row);
}
function renderPage() {
  renderWarm(); renderIconRow(); renderGuides(); renderDuo(); renderHelp(); renderNet(); renderHead(); renderNav(); renderAbout(); renderFaq(); renderFooter();
  renderRail(); renderRoles();
  $('findTitle').textContent = P().findTitle; $('numbersTitle').textContent = P().titles.numbers; $('findText').textContent = P().findText;
  $('numRowTitle').textContent = P().numRow.title;
  $('rowBack').setAttribute('aria-label', P().numRow.back); $('rowMore').setAttribute('aria-label', P().numRow.more);
}

/* ---------- text ---------- */
function setText() {
  const s = t();
  document.documentElement.lang = lang;
  $('langBtn').textContent = s.lang;
  $('hello1').textContent = s.hello1; $('hello2').textContent = s.hello2;
  $('lead').textContent = s.lead; $('h999Text').textContent = s.h999;
  $('quickEyebrow').textContent = s.quickEyebrow; $('quickTitle').textContent = s.quickTitle; $('quickText').textContent = s.quickText;
  districtOptions($('distSel'), s.distAll);
  $('call999Title').textContent = s.call999; $('call999Sub').textContent = s.call999Sub;
  $('locateTitle').textContent = s.locate; $('locateSub').textContent = s.locateSub;
  $('orText').textContent = s.or;
  $('areaLabel').textContent = s.areaLabel; $('areaHint').textContent = s.areaHint; $('areaInput').placeholder = s.areaLabel; $('areaInput').setAttribute('aria-label', s.areaLabel);
  $('backBtn').textContent = s.back; $('changeBtn').textContent = s.change;
  $('shareTitle').textContent = s.shareTitle; $('shareText').textContent = s.shareText;
  $('firstTitle').textContent = s.first; $('firstCalm').textContent = s.firstCalm; $('moreTitle').textContent = s.more;
  $('sosBtnTitle').textContent = s.sosBtn;
  $('sosBack').textContent = s.back; $('sosTitle').textContent = s.sosTitle;
  $('sitTitle').textContent = s.sit; $('locTitle').textContent = s.loc; $('sendTitle').textContent = s.send; $('msgTitle').textContent = s.msgT;
  $('smsHint').textContent = s.smsHint; $('peopleTitle').textContent = s.people;
  $('lblName').textContent = s.name; $('lblRel').textContent = s.rel; $('lblPhone').textContent = s.phone; $('saveBtn').textContent = s.save;
  $('privacy').textContent = s.privacy;
  $('offlineText').textContent = s.offline;
  renderHomeSos();
  renderPage();
}

$('locateBtn').addEventListener('click', locate);
$('areaInput').addEventListener('input', renderSuggest);
$('distSel').addEventListener('change', () => setDistrict($('distSel').value));
$('railDist').addEventListener('change', () => setDistrict($('railDist').value));
$('fReset').addEventListener('click', () => setDistrict(''));
$('rowBack').addEventListener('click', () => scrollRow(-1));
$('rowMore').addEventListener('click', () => scrollRow(1));
$('backBtn').addEventListener('click', goHome);
$('homeBtn').addEventListener('click', goHome);
$('areaChip').addEventListener('click', () => findArea(''));
$('hFinder').addEventListener('click', () => findArea(''));
$('ctaSend').addEventListener('click', () => openSos(null));
$('changeBtn').addEventListener('click', () => findArea(''));
$('langBtn').addEventListener('click', () => {
  lang = lang === 'bn' ? 'en' : 'bn';
  store.set('sc-lang', lang);
  setText();
  if (!$('demo').hidden) showDemo();
  if (data) { renderRecent(); renderSuggest(); renderStats(); renderPlaces(); if (current) renderArea(); }
  if (!$('sos').hidden) { renderSituations(); renderLoc(); renderPeople(); refreshMessage(); if (!$('sosDemo').hidden) fillDemo($('sosDemo'), $('sosDemoText'), $('sosDemoChips'), setSosPos); }
  auth.setText();
  setTitle();
});
$('themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
});

setText();
// Sign-in (P45, #73): the account button, the sign-in modal and #/account; help never waits for it.
const auth = initAuth({ $, el, store, fill, lang: () => lang, texts: () => LANG[lang], showView, goHome, openSos, locate, go });
// Pages: show the page in the address now; an area address waits for the data it needs.
history.scrollRestoration = 'manual';
window.addEventListener('hashchange', () => route());
const isPlace = () => readHash()[0] === 'area' && readHash().length > 1;
if (!isPlace()) route();
try {
  [data, locations] = await Promise.all([loadAll('data/'), loadLocations('data/').catch(() => null)]);
  areaIndex = buildAreaIndex(data);
  renderRecent(); renderStats(); renderPlaces(); renderIconRow(); renderGuides();
} catch (err) {
  msg(`${err.message}. Please reload the page.`);
}
if (isPlace()) route();

// Calm notice while the phone has no internet; it goes away by itself when the internet is back.
function showOnline() { $('offlineNote').hidden = navigator.onLine; }
window.addEventListener('online', showOnline);
window.addEventListener('offline', showOnline);
showOnline();

// Offline app (P34): save the site on this phone after the first visit, so it opens with no internet.
// Registered after the data is loaded, so it does not slow down the first view.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
