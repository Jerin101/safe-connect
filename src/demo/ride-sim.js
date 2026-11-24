// Live ride simulation (a demo, no real people): the rider drives along a real road (OSRM) towards the customer, and
// both "phones" show what the real service shows: the customer sees the rider coming closer, the rider sees the
// customer and the distance. Click the customer's map to move the customer: the rider is sent along a new road.
// Uses the same routemap.js as the real pages. Texts are Bangla and fixed here because this page is a demo.
import { roadRoute, drawRoad } from '../js/routemap.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const bn = (n) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]);
const rad = (x) => (x * Math.PI) / 180;
const metres = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};
const fmt = (m) => (m < 1000 ? `${bn(Math.round(m / 10) * 10)} মিটার` : `${bn((m / 1000).toFixed(1))} কিমি`);
const KMH = 30;                                            // the rider's speed at "normal" pace
const CUSTOMER = { lat: 21.4272, lon: 91.9702 };           // Cox's Bazar town (the start; the customer can be moved)
const RIDER_START = { lat: 21.4437, lon: 91.9780 };        // about 2 km away

let L, custMap, ridMap, cust = { ...CUSTOMER }, rider = null, path = [], at = 0, timer = null, speed = 4, roadLine = null, running = false;
const marks = { custMe: null, custRider: null, ridMe: null, ridCust: null };

function pin(map, p, cls, label) {
  const icon = L.divIcon({ className: 'mk-wrap', html: el('span', cls), iconSize: [34, 40], iconAnchor: [17, 38] });
  return L.marker([p.lat, p.lon], { icon, keyboard: false }).addTo(map).bindTooltip(label, { direction: 'top', offset: [0, -30] });
}
function dot(map, p, label) {
  const icon = L.divIcon({ className: 'mk-wrap', html: el('span', 'mk-me'), iconSize: [22, 22], iconAnchor: [11, 11] });
  return L.marker([p.lat, p.lon], { icon, keyboard: false }).addTo(map).bindTooltip(label, { direction: 'top', offset: [0, -10] });
}
function tiles(map) {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
}
function build() {
  custMap = L.map('custMap').setView([cust.lat, cust.lon], 14); tiles(custMap);
  ridMap = L.map('ridMap').setView([cust.lat, cust.lon], 14); tiles(ridMap);
  marks.custMe = dot(custMap, cust, 'আপনি');
  marks.ridCust = pin(ridMap, cust, 'mk-pin near', 'গ্রাহক');
  custMap.on('click', (e) => moveCustomer({ lat: e.latlng.lat, lon: e.latlng.lng }));
}
function fit() {
  const pts = [[cust.lat, cust.lon]]; if (rider) pts.push([rider.lat, rider.lon]);
  for (const m of [custMap, ridMap]) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16, animate: false });
}

// positions along the road: cumulative metres
function along(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + metres({ lat: coords[i - 1][0], lon: coords[i - 1][1] }, { lat: coords[i][0], lon: coords[i][1] }));
  return { coords, cum, total: cum[cum.length - 1] };
}
function pointAt(route, s) {
  if (s >= route.total) { const c = route.coords[route.coords.length - 1]; return { lat: c[0], lon: c[1] }; }
  let i = 1; while (route.cum[i] < s) i++;
  const f = (s - route.cum[i - 1]) / ((route.cum[i] - route.cum[i - 1]) || 1), a = route.coords[i - 1], b = route.coords[i];
  return { lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f };
}

async function plan(from) {
  const r = await roadRoute(from, cust);
  const coords = r ? r.coords : [[from.lat, from.lon], [cust.lat, cust.lon]];     // offline: the straight line
  path = along(coords); at = 0;
  if (roadLine) roadLine.remove();
  roadLine = drawRoad(L, ridMap, { coords }, '#0B6E73');
  return !!r;
}
function paintRider() {
  if (!marks.custRider) marks.custRider = pin(custMap, rider, 'mk-pin', 'রাইডার');
  else marks.custRider.setLatLng([rider.lat, rider.lon]);
  if (!marks.ridMe) marks.ridMe = dot(ridMap, rider, 'আপনি');
  else marks.ridMe.setLatLng([rider.lat, rider.lon]);
}
function chips() {
  const left = Math.max(0, path.total - at), mins = Math.max(1, Math.round(left / ((KMH * 1000) / 60)));
  const c = $('custChip'), r = $('ridChip');
  if (left < 30) {
    c.textContent = 'রাইডার পৌঁছে গেছেন!'; c.className = 'sim-chip near';
    r.textContent = 'আপনি গ্রাহকের কাছে পৌঁছে গেছেন।'; r.className = 'sim-chip near';
  } else if (left < 300) {
    c.textContent = `রাইডার খুব কাছে: ${fmt(left)}`; c.className = 'sim-chip near';
    r.textContent = `গ্রাহক খুব কাছে: ${fmt(left)}`; r.className = 'sim-chip near';
  } else {
    c.textContent = `রাইডার আসছেন: ${fmt(left)} দূরে · প্রায় ${bn(mins)} মিনিট`; c.className = 'sim-chip';
    r.textContent = `গ্রাহকের কাছে যান: ${fmt(left)} · প্রায় ${bn(mins)} মিনিট`; r.className = 'sim-chip';
  }
}
function tick() {
  at = Math.min(path.total, at + ((KMH * 1000) / 3600) * speed);
  rider = pointAt(path, at); paintRider(); chips();
  if (at >= path.total) stop();
}
function stop() { clearInterval(timer); timer = null; running = false; $('simStart').disabled = false; }

async function start() {
  stop(); $('simStart').disabled = true; running = true;
  $('custChip').textContent = 'রাইডার খোঁজা হচ্ছে…'; $('ridChip').textContent = 'নতুন কাজ এসেছে…';
  rider = { ...RIDER_START };
  await plan(rider); paintRider(); fit(); chips();
  timer = setInterval(tick, 1000);
}
async function moveCustomer(p) {
  cust = { lat: Math.round(p.lat * 1e5) / 1e5, lon: Math.round(p.lon * 1e5) / 1e5 };
  marks.custMe.setLatLng([cust.lat, cust.lon]); marks.ridCust.setLatLng([cust.lat, cust.lon]);
  if (running && rider) { clearInterval(timer); await plan(rider); timer = setInterval(tick, 1000); chips(); }
}
function reset() {
  stop(); rider = null; cust = { ...CUSTOMER };
  for (const k of ['custRider', 'ridMe']) { if (marks[k]) { marks[k].remove(); marks[k] = null; } }
  if (roadLine) { roadLine.remove(); roadLine = null; }
  marks.custMe.setLatLng([cust.lat, cust.lon]); marks.ridCust.setLatLng([cust.lat, cust.lon]);
  custMap.setView([cust.lat, cust.lon], 14); ridMap.setView([cust.lat, cust.lon], 14);
  $('custChip').textContent = 'রাইডার ডাকুন চাপুন।'; $('custChip').className = 'sim-chip';
  $('ridChip').textContent = 'কাজ আসার অপেক্ষায়।'; $('ridChip').className = 'sim-chip';
}

addEventListener('load', () => {
  L = window.L;
  build();
  $('simStart').addEventListener('click', start);
  $('simReset').addEventListener('click', reset);
  $('simSpeed').addEventListener('change', (e) => { speed = Number(e.target.value); });
});
