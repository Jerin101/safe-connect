// Old address (issue #141): the site moved from preview.html to index.html ("./").
// Keeps "?..." and "#/..." so old links, SMS help links and apps installed from preview.html open the same page.
location.replace(`./${location.search}${location.hash}`);
