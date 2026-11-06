// "আগে থেকে প্রস্তুতি" (issue #161): the phone's own Emergency SOS, brand by brand, from each company's official help
// page only (checked by the source-researcher on 2026-11-06). The texts are in js/lang/*.json ("prepare.brands");
// where no official page was found, the page says so and names no menu (CLAUDE.md rule 1: never guess).
export const CHECKED = '2026-11-06';
export const BRANDS = [
  { key: 'apple', url: 'https://support.apple.com/guide/iphone/contact-emergency-services-iph3c99374c/ios' },
  { key: 'samsung', url: 'https://www.samsung.com/us/support/answer/ANS10001579/' },
  { key: 'pixel', url: 'https://support.google.com/pixelphone/answer/7055029?hl=en' },
  { key: 'xiaomi', url: 'https://www.mi.com/global/support/article/KA-36445/' },
  { key: 'realme', url: 'https://www.realme.com/in/support/kw/doc/2077523', unread: true },   // official, but its text loads only in a browser
  { key: 'oppo', url: null },
  { key: 'vivo', url: null },
  { key: 'infinix', url: null },
  { key: 'tecno', url: null },
];
// Live location in other apps (after sending): official help pages.
export const LIVE = {
  whatsapp: 'https://faq.whatsapp.com/480865177351335/?cms_platform=android',
  maps: 'https://support.google.com/maps/answer/15437054?hl=en&co=GENIE.Platform%3DAndroid',
};
