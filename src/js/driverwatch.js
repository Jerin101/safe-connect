// #369: an online driver is told about new calls on EVERY page, not only on "Provide a service".
// This phone remembers "my driver was working" (a convenience flag in localStorage: nothing personal). If it is set, after sign-in is
// restored and the driver is approved, we listen to the open calls for their service and district (the same query as the provide page),
// show a bar on every page and sound the alert. Nothing is sent anywhere except the "online" marker the provide page already writes.
// A browser lets sound start only after a tap, so after a reload the bar offers "Turn sound on". A closed app still cannot be woken (no paid server).
import { createCallAlert } from './driveralert.js';

export const ONLINE_KEY = 'sc-driver-online';

export function initDriverWatch(ctx) {
  const alerts = createCallAlert();
  const T = () => ctx.texts();
  let bar = null, count = 0, started = false;

  function paintBar() {
    if (!bar) {
      bar = ctx.el('div', 'drv-bar'); bar.setAttribute('role', 'status'); bar.hidden = true; document.body.append(bar);
    }
    const st = alerts.state();
    const hide = ctx.onProvidePage() || (!count && st.sound);
    bar.hidden = hide;
    if (hide) return;
    const text = ctx.el('span', null, count ? T().watchCalls.replace('{n}', count) : T().watchIdle);
    const open = ctx.el('button', 'btn solid sm', T().watchOpen); open.type = 'button'; open.addEventListener('click', () => ctx.go('provide'));
    const kids = [text, open];
    if (!st.sound) {
      const snd = ctx.el('button', 'btn sm', T().watchSound); snd.type = 'button';
      snd.addEventListener('click', async () => { await alerts.arm(); paintBar(); });
      kids.push(snd);
    }
    bar.replaceChildren(...kids);
  }

  async function start() {
    if (started || ctx.store.get(ONLINE_KEY) !== '1') return;
    started = true;
    try {
      const fb = await import('./firebase.js');
      const user = await fb.currentUser();
      const prov = user ? await fb.myProvider() : null;
      if (!prov || !prov.approved) { started = false; ctx.store.set(ONLINE_KEY, '0'); return; }
      fb.goOnline(prov).catch(() => {});
      await alerts.arm();
      paintBar();
      fb.watchRequests(prov, (list) => {
        count = list.length;
        alerts.check(list, { silent: ctx.onProvidePage(), title: T().newCallTitle, body: (r) => r.pickup?.label || '' });
        paintBar();
      }, () => {});
      addEventListener('hashchange', paintBar);
      addEventListener('pagehide', () => { fb.goOffline().catch(() => {}); });
    } catch { started = false; }
  }
  start();
  return { start, paintBar };
}
