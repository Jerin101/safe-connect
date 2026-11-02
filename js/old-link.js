// Old address (issue #141): the site moved from preview.html to index.html ("./").
// Keeps "?..." and "#/..." so old links, SMS help links and apps installed from preview.html open the same page.
// Loop guard: a phone with an old offline copy of "./" (the start page before #141) sends people straight back here.
// If we redirected a moment ago and arrived from our own site, we stop and the page shows its own links
// (open SafeConnect, call 999). Links from an SMS, another app or the home screen always go on.
const KEY = 'sc-old-link';
let last = 0;
try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch {}
const bounced = Date.now() - last < 10000 && document.referrer.startsWith(location.origin);
if (!bounced) {
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch {}
  location.replace(`./${location.search}${location.hash}`);
}
