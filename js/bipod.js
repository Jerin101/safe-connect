// বিপদ বার্তা (issue #134): the help link, the SMS text and its SMS part count.
// No page, no storage, no network: the coordinates live only in the SMS and after the # of the link
// (CLAUDE.md rule 5). Tested in tests/bipod-test.mjs.

export const SITE_URL = 'https://jerin101.github.io/safe-connect/preview.html';
export const SITUATIONS = ['danger', 'followed', 'accident', 'sick', 'lost'];

// A box around Bangladesh (incl. St Martin's Island): a link outside it shows the calm "check the link" page.
const BD = { south: 20.5, north: 26.7, west: 88.0, east: 92.7 };
export const inBangladesh = (lat, lon) => lat >= BD.south && lat <= BD.north && lon >= BD.west && lon <= BD.east;

// help/<lat>,<lng>,<unix seconds>[,<situation>] with 5 decimals (about 1 m).
export function helpPath(pos, at, situation = '') {
  const sit = SITUATIONS.includes(situation) ? `,${situation}` : '';
  return `help/${pos.lat.toFixed(5)},${pos.lon.toFixed(5)},${Math.floor(at / 1000)}${sit}`;
}
export const helpLink = (pos, at, situation) => `${SITE_URL}#/${helpPath(pos, at, situation)}`;

// The part after "#/help/". Returns { ok: true, lat, lon, at, situation } or { ok: false, reason }.
// reason: 'broken' (not a help link, or a time far in the future) or 'outside' (not in Bangladesh).
const LINK = /^(-?\d{1,2}\.\d{1,6}),(-?\d{1,3}\.\d{1,6}),(\d{9,11})(?:,([a-z]{1,12}))?$/;
export function parseHelp(text, now = Date.now()) {
  const m = LINK.exec(String(text || '').trim());
  if (!m) return { ok: false, reason: 'broken' };
  const lat = Number(m[1]), lon = Number(m[2]), at = Number(m[3]) * 1000;
  if (at > now + 10 * 60000) return { ok: false, reason: 'broken' };   // a phone clock a few minutes off is fine
  if (!inBangladesh(lat, lon)) return { ok: false, reason: 'outside' };
  return { ok: true, lat, lon, at, situation: SITUATIONS.includes(m[4]) ? m[4] : null };
}

export const minutesAgo = (at, now = Date.now()) => Math.max(0, Math.floor((now - at) / 60000));

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (all, key) => (key in values ? values[key] : all));

// texts: { urgent, area, call999, police, link, noLoc } from js/lang/*.json ("bipod.sms" and "noLoc").
// area: "হাতিয়া, নোয়াখালী" or '' (outside our data); police: a number with normal digits or '';
// link: the help link, or '' when there is no location yet.
export function buildSms({ texts, situation, area = '', police = '', link = '' }) {
  const lines = [`${texts.urgent} ${situation}`];
  if (area) lines.push(fill(texts.area, { a: area }));
  lines.push(police ? `${texts.call999} ${fill(texts.police, { p: police })}` : texts.call999);
  lines.push(link ? fill(texts.link, { l: link }) : texts.noLoc);
  return lines.join('\n');
}

// SMS parts: plain GSM letters fit 160 per SMS (153 each when split); anything else (Bangla) fits 70 (67).
const GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€';
export function smsParts(text) {
  const chars = [...text];
  const gsm = chars.every((c) => GSM.includes(c) || GSM_EXT.includes(c));
  if (gsm) {
    const n = chars.reduce((s, c) => s + (GSM_EXT.includes(c) ? 2 : 1), 0);
    return { unicode: false, length: n, parts: n <= 160 ? 1 : Math.ceil(n / 153) };
  }
  const n = text.length;                    // UTF-16 units; Bangla letters are one each
  return { unicode: true, length: n, parts: n <= 70 ? 1 : Math.ceil(n / 67) };
}
