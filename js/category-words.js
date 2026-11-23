// Everyday words for the 12 categories (SRS FR03, LOC-02): "osudher dokan" -> pharmacy, "teler pump" -> fuel.
// Bangla, Banglish (Latin letters) and English, as people type them. Pure data and one matcher, no network; the search
// (js/preview.js) asks matchCategory() first and opens that category near the person. Category ids are those of js/near.js.
export const CATEGORY_WORDS = {
  hospital: ['হাসপাতাল', 'হাসপাতাল', 'ক্লিনিক', 'ডাক্তার', 'ডাক্তারখানা', 'মেডিকেল', 'স্বাস্থ্য কমপ্লেক্স', 'জরুরি বিভাগ',
    'haspatal', 'hashpatal', 'hospital', 'clinic', 'klinik', 'daktar', 'doctor', 'medical', 'shastho complex', 'emergency'],
  pharmacy: ['ফার্মেসি', 'ফার্মেসী', 'ওষুধ', 'ঔষধ', 'ওষুধের দোকান', 'ঔষধের দোকান', 'ডিসপেনসারি',
    'osudh', 'oshudh', 'osud', 'oushod', 'oushodh', 'osudher dokan', 'oshudher dokan', 'oushodher dokan', 'pharmacy', 'farmesi', 'medicine', 'dispensary'],
  police: ['থানা', 'পুলিশ', 'ফাঁড়ি', 'ফায়ার সার্ভিস', 'দমকল', 'ফায়ার স্টেশন',
    'thana', 'police', 'polis', 'fari', 'fanri', 'fire service', 'fire station', 'domkol'],
  fuel: ['পেট্রোল পাম্প', 'তেলের পাম্প', 'ফিলিং স্টেশন', 'সিএনজি স্টেশন', 'গ্যাস স্টেশন', 'অকটেন', 'ডিজেল',
    'teler pump', 'teler pamp', 'petrol pump', 'filling station', 'cng station', 'gas station', 'octane', 'diesel', 'pump'],
  transport: ['বাস স্ট্যান্ড', 'বাসস্ট্যান্ড', 'বাস টার্মিনাল', 'টার্মিনাল', 'লঞ্চঘাট', 'লঞ্চ ঘাট', 'ফেরিঘাট', 'ঘাট', 'রেলস্টেশন', 'রেল স্টেশন', 'স্টেশন',
    'bus stand', 'bus terminal', 'terminal', 'launch ghat', 'ferry ghat', 'ghat', 'rail station', 'railway station', 'station', 'bus'],
  bank: ['ব্যাংক', 'এটিএম', 'টাকা তোলা', 'bank', 'atm', 'taka tola', 'taka tolar jayga'],
  market: ['বাজার', 'হাট', 'সুপারশপ', 'মুদি দোকান', 'দোকান', 'মার্কেট',
    'bazar', 'bajar', 'haat', 'hat', 'supershop', 'super shop', 'mudi dokan', 'dokan', 'market', 'shop'],
  repair: ['গ্যারেজ', 'ওয়ার্কশপ', 'মেকানিক', 'মিস্ত্রি', 'সারাই', 'মেরামত',
    'garage', 'workshop', 'mechanic', 'mekanik', 'mistri', 'sarai', 'meramot', 'repair'],
  food: ['হোটেল', 'রেস্টুরেন্ট', 'রেস্তোরাঁ', 'খাবার', 'ভাতের হোটেল', 'খাওয়ার জায়গা',
    'hotel', 'restaurant', 'resturant', 'khabar', 'bhater hotel', 'khawar jayga', 'food'],
  post: ['পোস্ট অফিস', 'ডাকঘর', 'post office', 'dakghor', 'dak ghor', 'post'],
  tourism: ['দর্শনীয় স্থান', 'ঘোরার জায়গা', 'পর্যটন', 'বেড়ানোর জায়গা', 'সৈকত', 'ghurar jayga', 'berabar jayga', 'porjoton', 'tourist spot', 'tourist', 'beach', 'sea beach'],
  shelter: ['আশ্রয়কেন্দ্র', 'আশ্রয় কেন্দ্র', 'সাইক্লোন শেল্টার', 'বন্যা আশ্রয়কেন্দ্র', 'ashroy kendro', 'ashroykendro', 'shelter', 'cyclone shelter', 'flood shelter'],
};
const norm = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
// Longest words first, so "osudher dokan" wins over "dokan" and "teler pump" over "pump".
const PAIRS = Object.entries(CATEGORY_WORDS).flatMap(([id, ws]) => ws.map((w) => [norm(w), id])).sort((a, b) => b[0].length - a[0].length);
const isLatin = (w) => /^[a-z0-9 ]+$/.test(w);
// The category a text asks for, or null. Latin words must match whole words ("hat" is not "hatiya"); Bangla words may
// match inside the text ("ওষুধের দোকান কোথায়").
export function matchCategory(text) {
  const t = norm(text);
  if (t.length < 2) return null;
  for (const [w, id] of PAIRS) {
    if (isLatin(w) ? new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t) : t.includes(w)) return id;
  }
  return null;
}
