// "Where the map puts you" (M1.2): division, district and upazila from the official BBS boundaries, plus the NEAREST UNION
// CENTRE. Shown on the area page when the position comes from the phone. Rules:
//  - Names appear only when a boundary supports them. No boundary -> a plain message, never a guess.
//  - A union is never named as "your union": only "nearest union centre", with a distance and a warning.
//  - Near a boundary (the boundaries are simplified 100 m, and GPS has its own error) -> a boundary warning.
//  - Everything runs on the phone against files saved on the phone; the position is never stored or sent (CLAUDE.md rule 5).
//  - All words come from lang/*.json (ui.where); this file only chooses which words and fills numbers.
import { nearestUnionCentre } from './unioncentre.js';

export const BOUNDARY_MIN_M = 150;     // simplified 100 m + a margin; the GPS accuracy is used when it is larger
export const ROUGH_M = 2000;           // a position this rough does not name an upazila

const plain = (s) => String(s || '').toLowerCase().replace(/\(.*?\)|upazila|sadar|city corporation|[^a-z]/g, '');

// -> a model with codes only (no sentences): { state, ... }
//   state 'ok' | 'rough' | 'no_polygon' | 'unavailable' | 'invalid'
export async function whereAmI(pos, service, contact = null) {
  const lat = Number(pos?.lat), lon = Number(pos?.lon);
  if (pos?.lat == null || pos?.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return { state: 'invalid' };
  const accuracy = Number.isFinite(Number(pos.accuracy)) && Number(pos.accuracy) > 0 ? Math.round(Number(pos.accuracy)) : null;
  if (accuracy !== null && accuracy > ROUGH_M) return { state: 'rough', accuracy_m: accuracy };
  const where = await service.locate(lat, lon);
  const index = (await service.getIndex?.()) || null;
  const reported = (index?.not_in_source || []);
  if (where.status === 'unavailable') return { state: 'unavailable' };
  if (where.status !== 'inside') {
    const names = (where.districts || []).map((c) => index?.districts.find((d) => d.code === c)?.name_en).filter(Boolean);
    return { state: where.status === 'no_polygon' ? 'no_polygon' : 'invalid', inside_district_box: names.length > 0,
      new_upazilas: reported.filter((x) => names.includes(x.district_en)).map((x) => x.name_en) };
  }
  const dEntry = index?.districts.find((d) => d.code === where.district);
  const dvEntry = index?.divisions?.find((v) => v.code === where.district.slice(0, 4));
  const centre = nearestUnionCentre(lat, lon, where.districtDoc, where.upazila);
  const limit = Math.max(BOUNDARY_MIN_M, accuracy || 0);
  const up = where.upazila;
  const model = {
    state: 'ok', accuracy_m: accuracy,
    division: dvEntry ? { en: dvEntry.name_en, bn: dvEntry.name_bn } : null,
    district: dEntry ? { en: dEntry.name_en, bn: dEntry.name_bn } : null,
    upazila: { en: up.name_en, bn: up.name_bn, city_corporation: up.kind === 'city_corporation' },
    edge_m: where.edge_m, near_boundary: where.edge_m <= limit,
    centre: centre.status === 'ok' ? centre : null, centre_status: centre.status,
    new_upazilas: reported.filter((x) => x.district_en === dEntry?.name_en).map((x) => x.name_en),
    exact_union: false,
  };
  if (contact && contact.district && model.district) {
    if (plain(contact.district) !== plain(model.district.en)) model.mismatch = { contact: contact.district, map: model.district.en, level: 'district' };
    else if (contact.upazila && plain(contact.upazila) !== plain(up.name_en)) model.mismatch = { contact: contact.upazila, map: up.name_en, level: 'upazila' };
  }
  return model;
}

// Draw the model into `box` with createElement + textContent only. S = ui.where strings, h = { lang, num, fill, doc }.
export function renderWhere(box, m, S, h) {
  const doc = h.doc || document;
  const mk = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const name = (o) => (h.lang === 'bn' ? o.bn || o.en : o.en || o.bn);
  const dist = (metres) => (metres >= 1000 ? h.fill(S.km, { n: h.num((metres / 1000).toFixed(1)) }) : h.fill(S.m, { n: h.num(Math.max(10, Math.round(metres / 10) * 10)) }));
  const kids = [mk('h2', null, S.title)];
  const dl = mk('dl', 'where-list');
  const row = (k, v) => { const r = mk('div', 'where-row'); r.append(mk('dt', null, k), mk('dd', null, v)); dl.append(r); };
  if (m.state === 'ok') {
    if (m.division) row(S.division, name(m.division));
    if (m.district) row(S.district, name(m.district));
    row(m.upazila.city_corporation ? S.cityCorp : S.upazila, name(m.upazila));
    kids.push(dl);
    if (m.near_boundary) kids.push(mk('p', 'note where-warn', h.fill(S.nearBoundary, { m: h.num(Math.max(10, Math.round(m.edge_m / 10) * 10)) })));
    if (m.centre) {
      const c = m.centre;
      kids.push(mk('h3', null, S.centreTitle));
      kids.push(mk('p', 'where-centre', h.fill(S.centreLine, { n: name({ en: c.name_en, bn: c.name_bn }), d: dist(c.distance_m) })));
      kids.push(mk('p', 'note', S.centreNote));
      if (c.ambiguous) kids.push(mk('p', 'note where-warn', S.centreAmbiguous));
      if (!c.limited_to_upazila) kids.push(mk('p', 'note', S.centreWide));
    } else {
      kids.push(mk('p', 'note', S.centreNone));
    }
    if (m.new_upazilas?.length) kids.push(mk('p', 'note', h.fill(S.newUpazilas, { n: m.new_upazilas.join(', ') })));
    if (m.mismatch) kids.push(mk('p', 'note where-warn', h.fill(S.mismatch, { a: m.mismatch.contact, b: m.mismatch.map })));
    kids.push(mk('p', 'where-source', S.source));
  } else if (m.state === 'rough') {
    kids.push(mk('p', 'note where-warn', h.fill(S.rough, { m: h.num(m.accuracy_m) })));
  } else if (m.state === 'no_polygon') {
    kids.push(mk('p', 'note', S.noPolygon));
    if (m.new_upazilas?.length) kids.push(mk('p', 'note', h.fill(S.newUpazilas, { n: m.new_upazilas.join(', ') })));
  } else if (m.state === 'unavailable') {
    kids.push(mk('p', 'note', S.unavailable));
  } else {
    box.replaceChildren(); box.hidden = true; return;
  }
  box.replaceChildren(...kids);
  box.hidden = false;
}
