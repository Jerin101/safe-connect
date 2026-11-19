// The site's own line icons (A1, DEMO_TO_REAL_PLAN; the same set as /demo/): 24 x 24, stroke only, one colour
// (currentColor). Built with createElementNS, never innerHTML, so they are safe under the CSP and need no file to load.
// Use: import { icon } from './icons.js'; button.prepend(icon('phone'));  icon('phone', { size: 'sm', label: 'ফোন' })
const NS = 'http://www.w3.org/2000/svg';

export const ICONS = {
  alert: [["path", {"d": "M12 3l9.5 17h-19z"}], ["path", {"d": "M12 10v4"}], ["path", {"d": "M12 17.2v.1"}]],
  amb: [["path", {"d": "M3 16V8a1 1 0 0 1 1-1h10v9"}], ["path", {"d": "M14 10h3.5l3.5 3.5V16h-7"}], ["path", {"d": "M8 9.5v4M6 11.5h4"}], ["circle", {"cx": "7", "cy": "17.5", "r": "1.8"}], ["circle", {"cx": "17", "cy": "17.5", "r": "1.8"}]],
  back: [["path", {"d": "M14.5 6l-6 6 6 6"}]],
  bag: [["path", {"d": "M5 8h14l-1 12H6z"}], ["path", {"d": "M9 10V6.5a3 3 0 0 1 6 0V10"}]],
  bank: [["rect", {"x": "3", "y": "6", "width": "18", "height": "12", "rx": "2"}], ["circle", {"cx": "12", "cy": "12", "r": "2.5"}], ["path", {"d": "M6.5 9.5v.1M17.5 14.5v.1"}]],
  basket: [["path", {"d": "M4 9h16l-1.6 9.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8z"}], ["path", {"d": "M8.5 9l3.5-5 3.5 5"}], ["path", {"d": "M10 13v3M14 13v3"}]],
  bed: [["path", {"d": "M3 19V7"}], ["path", {"d": "M3 15h18v4"}], ["path", {"d": "M21 15v-2a3 3 0 0 0-3-3h-7v5"}], ["circle", {"cx": "7", "cy": "12", "r": "2"}]],
  bike: [["circle", {"cx": "5.5", "cy": "16.5", "r": "3"}], ["circle", {"cx": "18.5", "cy": "16.5", "r": "3"}], ["path", {"d": "M5.5 16.5L9 10h6l3.5 6.5"}], ["path", {"d": "M12 16.5L9 10M14 6.5h2.5l-1.5 3.5"}]],
  boat: [["path", {"d": "M3 15l2 4h14l2-4z"}], ["path", {"d": "M6 15V9h12v6"}], ["path", {"d": "M12 9V4M9.5 6h5"}]],
  bus: [["rect", {"x": "5", "y": "3.5", "width": "14", "height": "14", "rx": "2.5"}], ["path", {"d": "M5 11h14"}], ["path", {"d": "M8 20.5v-3M16 20.5v-3"}], ["path", {"d": "M8.5 14.5v.1M15.5 14.5v.1"}]],
  cap: [["path", {"d": "M2.5 9.5L12 5l9.5 4.5L12 14z"}], ["path", {"d": "M6.5 11.5V16c1.5 1.4 3.5 2 5.5 2s4-.6 5.5-2v-4.5"}], ["path", {"d": "M21.5 9.5V14"}]],
  car: [["path", {"d": "M5 16V11l2-5h10l2 5v5"}], ["path", {"d": "M3 16h18v2H3z"}], ["circle", {"cx": "7.5", "cy": "18.5", "r": "1.5"}], ["circle", {"cx": "16.5", "cy": "18.5", "r": "1.5"}], ["path", {"d": "M5 11h14"}]],
  check: [["circle", {"cx": "12", "cy": "12", "r": "8.5"}], ["path", {"d": "M8.5 12.3l2.3 2.2 4.7-4.8"}]],
  chev: [["path", {"d": "M9.5 6l6 6-6 6"}]],
  cloud: [["path", {"d": "M7 18h10a4 4 0 0 0 .6-8A5.5 5.5 0 0 0 7 11a3.5 3.5 0 0 0 0 7z"}]],
  compass: [["circle", {"cx": "12", "cy": "12", "r": "8.5"}], ["path", {"d": "M15.5 8.5l-2 5-5 2 2-5z"}]],
  copy: [["rect", {"x": "8", "y": "8", "width": "12", "height": "12", "rx": "2"}], ["path", {"d": "M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"}]],
  doc: [["path", {"d": "M6 3h8l4 4v14H6z"}], ["path", {"d": "M14 3v4h4"}], ["path", {"d": "M9 12h6M9 15.5h6"}]],
  dome: [["path", {"d": "M5 20v-8a7 7 0 0 1 14 0v8"}], ["path", {"d": "M3 20h18"}], ["path", {"d": "M12 5V3"}], ["path", {"d": "M10 20v-4a2 2 0 0 1 4 0v4"}]],
  ext: [["path", {"d": "M14 4h6v6"}], ["path", {"d": "M20 4l-9 9"}], ["path", {"d": "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"}]],
  eye: [["path", {"d": "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"}], ["circle", {"cx": "12", "cy": "12", "r": "2.8"}]],
  flag: [["path", {"d": "M5 21V4"}], ["path", {"d": "M5 4h12l-2.5 4L17 12H5"}]],
  fuel: [["path", {"d": "M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15"}], ["path", {"d": "M4 20h11"}], ["path", {"d": "M7 8h5"}], ["path", {"d": "M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"}]],
  globe: [["circle", {"cx": "12", "cy": "12", "r": "8.5"}], ["path", {"d": "M3.5 12h17"}], ["path", {"d": "M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5z"}]],
  gov: [["path", {"d": "M3 9l9-5 9 5"}], ["path", {"d": "M5 9v9M9.5 9v9M14.5 9v9M19 9v9"}], ["path", {"d": "M3 20h18"}]],
  hands: [["path", {"d": "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"}]],
  health: [["rect", {"x": "4", "y": "4", "width": "16", "height": "16", "rx": "4"}], ["path", {"d": "M12 8v8M8 12h8"}]],
  home: [["path", {"d": "M4 11l8-7 8 7"}], ["path", {"d": "M6 10v10h12V10"}], ["path", {"d": "M10 20v-5h4v5"}]],
  info: [["circle", {"cx": "12", "cy": "12", "r": "8.5"}], ["path", {"d": "M12 11v5.5"}], ["path", {"d": "M12 7.8v.1"}]],
  locate: [["circle", {"cx": "12", "cy": "12", "r": "6.5"}], ["circle", {"cx": "12", "cy": "12", "r": "2"}], ["path", {"d": "M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"}]],
  mail: [["rect", {"x": "3", "y": "6", "width": "18", "height": "12", "rx": "2"}], ["path", {"d": "M3 8l9 6 9-6"}]],
  msg: [["path", {"d": "M4 5h16v11H9l-5 4z"}], ["path", {"d": "M8 9.5h8M8 12.5h5"}]],
  nav: [["path", {"d": "M3.5 11L20 4l-7 16.5-2-7.5z"}]],
  phone: [["path", {"d": "M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"}]],
  pill: [["rect", {"x": "3.5", "y": "8.5", "width": "17", "height": "7", "rx": "3.5", "transform": "rotate(-40 12 12)"}], ["path", {"d": "M9.3 9.3l5.4 5.4"}]],
  pin: [["path", {"d": "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"}], ["circle", {"cx": "12", "cy": "10", "r": "2.5"}]],
  search: [["circle", {"cx": "11", "cy": "11", "r": "6.5"}], ["path", {"d": "M20 20l-4.2-4.2"}]],
  share: [["circle", {"cx": "6", "cy": "12", "r": "2.5"}], ["circle", {"cx": "17.5", "cy": "6", "r": "2.5"}], ["circle", {"cx": "17.5", "cy": "18", "r": "2.5"}], ["path", {"d": "M8.3 10.8l7-3.6M8.3 13.2l7 3.6"}]],
  shelter: [["path", {"d": "M3 11l9-7 9 7"}], ["path", {"d": "M5.5 9.5V20h13V9.5"}], ["path", {"d": "M9 20v-4a3 3 0 0 1 6 0v4"}]],
  shield: [["path", {"d": "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"}], ["path", {"d": "M9 12l2 2 4-4"}]],
  sick: [["path", {"d": "M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"}], ["path", {"d": "M12 11v6"}]],
  store: [["path", {"d": "M4 9l1.5-5h13L20 9"}], ["path", {"d": "M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"}], ["path", {"d": "M5 11.5V20h14v-8.5"}], ["path", {"d": "M10 20v-4.5h4V20"}]],
  sun: [["circle", {"cx": "12", "cy": "12", "r": "4"}], ["path", {"d": "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"}]],
  sunrise: [["path", {"d": "M4 18h16"}], ["path", {"d": "M7.5 18a4.5 4.5 0 0 1 9 0"}], ["path", {"d": "M12 4v5M9.5 6.5L12 4l2.5 2.5"}], ["path", {"d": "M4.5 13.5l1.4 1M19.5 13.5l-1.4 1"}]],
  sunset: [["path", {"d": "M4 18h16"}], ["path", {"d": "M7.5 18a4.5 4.5 0 0 1 9 0"}], ["path", {"d": "M12 9V4M9.5 6.5L12 9l2.5-2.5"}], ["path", {"d": "M4.5 13.5l1.4 1M19.5 13.5l-1.4 1"}]],
  train: [["rect", {"x": "6", "y": "3", "width": "12", "height": "13", "rx": "3"}], ["path", {"d": "M6 10h12"}], ["path", {"d": "M8 20l2-4M16 20l-2-4"}], ["path", {"d": "M9 13.5v.1M15 13.5v.1"}]],
  wave: [["path", {"d": "M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2.5-1.5 4.5-1.5S19 15 21 15"}], ["path", {"d": "M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19"}], ["circle", {"cx": "16", "cy": "7", "r": "2.5"}]],
  wind: [["path", {"d": "M3 9h11a2.5 2.5 0 1 0-2.5-2.5"}], ["path", {"d": "M3 14h15a2.5 2.5 0 1 1-2.5 2.5"}], ["path", {"d": "M3 18.5h6"}]],
  wrench: [["path", {"d": "M14.5 5.5a4 4 0 0 0 4.9 4.9L11 18.8a2.1 2.1 0 0 1-3-3l8.4-8.4"}], ["path", {"d": "M14.5 5.5l2.3 2.3"}]],
};

// An <svg class="sc-ic"> element. Decorative by default (aria-hidden); with `label` it gets role="img" and a <title>.
// An unknown name draws the "info" icon, so a typo never leaves an empty box.
export function icon(name, { size = '', label = '' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', size ? `sc-ic ${size}` : 'sc-ic');
  if (label) {
    svg.setAttribute('role', 'img');
    const t = document.createElementNS(NS, 'title'); t.textContent = label; svg.append(t);
  } else svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of Object.hasOwn(ICONS, name) ? ICONS[name] : ICONS.info) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}
