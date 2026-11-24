// Stopgap while GitHub Pages still serves the repository root: the website now lives in src/, so these tiny root pages
// send old links to it and keep the query and the #/route (reset-password emails, family live links, installed apps).
// Not used once Pages is switched to "GitHub Actions" (the deploy publishes only src/).
const to = document.currentScript.dataset.to;
location.replace(to + location.search + location.hash);
