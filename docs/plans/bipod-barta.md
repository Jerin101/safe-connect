# বিপদ বার্তা (danger message): plan and SMS texts

Issue #134 (step 1, merged in PR #136) and #143 (review fixes). Step 2 is listed below.

## What it does

A person in danger taps one big red button. Their phone's messages app opens with a message ready for their saved people (up to 3). The message gives:
- the situation
- the area
- the area's police number
- "call 999 first" ("আগে 999-এ কল করো", with normal digits so phones make it tappable)
- a link

The family opens the link and gets a calm page: where the person is, a map link, what to read out to 999, and the local numbers to call.

## Rules (unchanged from CLAUDE.md)

- **Nothing is stored or uploaded.** The coordinates live only in the SMS text and after the `#` of the link (the part after `#` never reaches a server). The help page reads them from the address and saves nothing. CLAUDE.md rule 5 is unchanged.
- **No sign-in.** Works offline for the sender: SMS needs no internet, and the page and data are in the offline cache.
- **We never claim a message was sent.** We only open the messages app. After a tap we say "the messages app was opened X min ago; check that you tapped Send".
- **Numbers come only from our data** (`data/`, with sources).
  - The police number is the thana's officer-in-charge: in the person's upazila, the record whose office contains "থানা" and whose post contains "অফিসার ইনচার্জ" (so an outpost listed first, like Chowmuhani's in Begumganj, is never picked).
  - If there is no such record, it is the first police record of the upazila (or the district police), and the SMS says "পুলিশ:" instead of "থানা:". Today that is Cox's Bazar Sadar, Eidgaon, Kutubdia and Maheshkhali.
- **No outside resources.** There is no map tile server, so the CSP is unchanged. The help page shows a pin icon, the coordinates and an "Open in Google Maps" link (plain navigation).

## Step 1 (built)

| # | Part | Where |
|---|---|---|
| 1 | Big red "বিপদ বার্তা পাঠান" button. Android opens one SMS to all saved people; iPhone opens it for the first person, and the list below has the others. With no saved people it opens the "আমার প্রিয়জন" form. | `#/send`, top |
| 1 | Situation chips (already there): বিপদে আছি / কেউ পিছু নিয়েছে / দুর্ঘটনা / অসুস্থ / পথ হারিয়েছি | `#/send` |
| 2 | SMS text with the help link `https://jerin101.github.io/safe-connect/#/help/<lat>,<lng>,<unix seconds>[,<situation>]` (5 decimals; old `preview.html#/help/…` links still work) | `js/bipod.js` |
| 2 | "ছোট ইংরেজি বার্তা পাঠান (কম SMS লাগে)" checkbox (Bangla mode only) and the SMS part count under the message | `#/send` |
| 3 | "৯৯৯-কে যা বলবেন" card, large text | `#/send` |
| 4 | After a tap: "শেষবার মেসেজ অ্যাপ খোলা হয়েছিল X মিনিট আগে" with two buttons: "নতুন লোকেশন পাঠান" (asks for the location again and rebuilds the message) and "আমি এখন নিরাপদ" (turns the button green and switches the message to the safe text for the same people) | `#/send` |
| 5 | Help page for the family: age of the location (warns after 1 hour), situation, area, coordinates with a pin, Google Maps link, "৯৯৯-কে এই ঠিকানা পড়ে শোনান", then call steps: 1. ৯৯৯, 2. থানা, 3. স্বাস্থ্য কমপ্লেক্স, 4. ইউএনও. For the situation "কেউ পিছু নিয়েছে" a warning comes first: "ফোন করার আগে মেসেজ করুন। ফোন বাজলে বিপদ বাড়তে পারে। সরাসরি ৯৯৯-এ কল করুন।" A broken link, a cut-off link or a link outside Bangladesh shows a calm message with ৯৯৯ and the national numbers. | `#/help/...` |
| 7 | Tests: link maker and parser, SMS text (bn/en, inside/outside our data, no location), SMS part counts, the police choice on the real data | `tests/bipod-test.mjs` (`node --test`) |

## Step 2 (later)

- **"আগে থেকে প্রস্তুতি" page (item 8):** how to turn on the phone's own Emergency SOS for iPhone, Samsung, Pixel, Xiaomi/Redmi, Realme/Oppo, vivo and Infinix/Tecno.
  - Each brand needs its **official** help page, checked and linked with a check date (source-researcher). Where there is none, we say so instead of guessing menu names.
  - Also: the checklist (SOS চালু, প্রিয়জনের নম্বর সেভ, একবার পরীক্ষা) and the warning never to test by calling 999.
- **"WhatsApp-এ লাইভ লোকেশন চালু করুন" (item 9):** 3 short steps from WhatsApp's official help page, with Google Maps location sharing as the second option. We'll explain that these keep working when the phone is locked; our page does not.

## SMS texts (exact)

The example is Hatiya, situation "followed". The police number is Hatiya thana's officer-in-charge from our data. Placeholders: `{situation}`, `{area}`, `{police}`, `{link}`.

### Bangla

```
জরুরি! কেউ আমার পিছু নিয়েছে, আমি ভয় পাচ্ছি।
এলাকা: হাতিয়া, নোয়াখালী
আগে 999-এ কল করো। থানা: 01320111137
লোকেশন: https://jerin101.github.io/safe-connect/#/help/22.29580,91.10660,1793624400,followed
```

### English (also the short version offered in Bangla mode)

```
URGENT! Someone is following me and I am scared.
Area: Hatiya, Noakhali
Call 999 first. Police station: 01320111137
Location: https://jerin101.github.io/safe-connect/#/help/22.29580,91.10660,1793624400,followed
```

### Variations

| Case | Bangla | English |
|---|---|---|
| Outside our two districts | situation + "আগে 999-এ কল করো।" + link (no area, no police) | situation + "Call 999 first." + link |
| No location yet | situation + area/police if known + "আমার লোকেশন পাওয়া যায়নি। আমাকে মেসেজ করো, উত্তর না পেলে 999-এ কল করো।" (being called can be dangerous when followed) | "… I could not get my location. Text me; if I don't answer, call 999." |
| No thana officer-in-charge in our data | "পুলিশ: {police}" | "Police: {police}" |
| Safe | "আমি এখন নিরাপদ, চিন্তা কোরো না।" | "I am safe now, don't worry." |

### SMS parts

- Bangla is sent as Unicode: 70 characters fit one SMS, and a longer message is split into parts of 67.
- English uses plain letters: 160 fit one SMS, and parts of 153.
- The link alone is 84 characters. **Every Bangla message fits in 3 SMS.**
- Counted with `smsParts()` in `js/bipod.js`:

| Message (Hatiya, with link) | Bangla: chars → SMS | English: chars → SMS |
|---|---|---|
| বিপদে আছি / In danger | 196 → **3** | 203 → **2** |
| কেউ পিছু নিয়েছে / Being followed | 200 → **3** | 210 → **2** |
| দুর্ঘটনা / Accident | 183 → **3** | 188 → **2** |
| অসুস্থ / Sick | 188 → **3** | 193 → **2** |
| পথ হারিয়েছি / Lost | 179 → **3** | 180 → **2** |
| Outside our data | 152 → **3** | 152 → **1** |
| No location | 175 → **3** | 175 → **2** |
| Safe | 31 → **1** | 27 → **1** |

### Review decisions (Jerin + Claude chat, 2 Nov 2026)

1. **Digits:** "999" with normal digits in the SMS. OK as it is.
2. **Tone:** "তুমি" forms in the SMS, "আপনি" on the pages. OK as it is.
3. **Dropped lines:** no sign-off and no time line in the SMS. OK as it is.
4. **Shorter link:** done, `https://jerin101.github.io/safe-connect/#/help/…` (#141, #143). Every Bangla message now fits in 3 SMS.
5. **"থানা" label:** only for the thana's officer-in-charge; anything else is "পুলিশ:" (#143).
6. **iPhone:** keep as it is (the big button opens the SMS for the first person; the list has the others).
7. **Safety when followed** (new): the no-location text asks for a message first, and the help page for "কেউ পিছু নিয়েছে" starts with "ফোন করার আগে মেসেজ করুন…" (#143).
