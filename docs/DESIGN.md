# SafeConnect – Design guide

Follow this for every screen, button and sentence on the site. Reference page: `design/portal-v2.html` (the earlier `design/portal.html` is kept only as history).
If a change breaks a rule here, fix the change, not the rule. To change a rule, open an issue first.

## 1. Who it is for
People in Noakhali and Cox's Bazar, often in a hurry or afraid, often on a cheap phone with a weak network,
many not used to websites. Every screen must work for them on the first try.

## 2. Voice: warm, calm, reliable
| Do | Don't |
|---|---|
| Short, plain sentences: "আগে ৯৯৯-এ কল করুন।" | Long or formal sentences |
| Calm and kind: "শান্ত থাকুন। আপনার এলাকার সরকারি নম্বর এখানেই আছে।" | Slogans or drama ("বিপদে সাহায্য!", "জীবন বাঁচান!") |
| Tell people what to do next | Blame, scare or lecture |
| Facts we can prove: "সরকারি ওয়েবসাইট থেকে, প্রতি সপ্তাহে যাচাই" | Promises we can't keep ("সবসময় কাজ করে", "১০০% সঠিক") |
| Say honestly when something isn't ready: "শীঘ্রই" | Claim a feature works before it does (offline!) |
| Bangla first; English is the same meaning, not a word-by-word copy | Mixed Banglish in one sentence |
| Use the person's words: থানা, চেয়ারম্যান, গ্রাম পুলিশ, ইউএনও | Technical words: database, GPS coordinates, API |

Warm touches that are allowed: a time-of-day greeting ("শুভ সকাল!"; at night "রাতেও ৯৯৯ খোলা থাকে, ২৪ ঘণ্টা, বিনা খরচে"),
a one-time welcome for first visitors (3 short steps, closes with "বুঝেছি"), trust badges (শুধু সরকারি নম্বর · লগইন লাগে না · বিনা খরচে ব্যবহার · বাংলা ও English).
Never block the screen with a welcome, pop-up or loading splash: 999 must be one tap away from the first second.

## 3. Page order (portal layout)
1. Two-row header: logo · **999 button (always visible, every page)** · EN/বাং · night/day. Second row: menu (scrolls sideways on phones).
2. Banner: greeting · "বিপদে আছেন?" · calm line · the 3 big actions: **999** (red), **প্রিয়জনকে লোকেশন পাঠান** (violet), **আমার কাছের সাহায্য** (soft violet). Visible without scrolling on a 360 px phone. On wide screens, the signal ring panel sits beside the text.
3. National numbers row: one bordered row of quiet single-colour tiles (only 999's tile is soft red), numbers from `data/national_hotlines.json` (tap = call), plus "লোকেশন পাঠান" and "কাছের সাহায্য".
4. Search band: "আপনার এলাকা কোথায়?" + one search box (any spelling, Bangla or English).
5. Situation cards: "কী হয়েছে?" (night danger, lost/stolen → GD, storm/flood/fire).
6. Known places + numbers strip.
7. Two side cards: save family numbers · report a wrong number.
8. About (3 points) · How can we help (4 round icons) · weak-network band · FAQ · column footer.

No carousels, no auto-sliding, no autoplay video, no flashing (except the siren page, P30).

## 3b. v3 layout (`design/portal-v3.html`, issue #68)
The reference shows the look; it is not code to copy (it uses outside fonts, a QR library from the web, `innerHTML` and fixed colours).
Build each part from its own issue in milestone v1.0.
- **Header:** logo · area picker ("এলাকা বেছে নিন") · **999 first** · সাইন ইন · EN/বাং · night/day. Second row: tabs with icons and a round search pill.
  On phones the area picker hides and the search pill sits above the tabs.
- **Sidebar (desktop):** a QR card ("ফোনে রাখুন") and filters (district, type of service). On phones the filters go below the feed and the QR card is hidden.
- **Banner:** greeting, "বিপদে আছেন?", one calm line, and the **3 big actions**, side by side on wide screens (999 red, send location violet, help near me soft violet).
- **Rows of cards:** national numbers as big tiles that scroll sideways by hand (with arrows, never by themselves), "আপনার এলাকা কোথায়?" with example searches,
  known places, "কী হয়েছে?" cards, the two side cards.
- **Sign-in:** a two-panel modal over the current page. Left: the red "বিপদে আছেন? সাইন ইন লাগবে না।" box (999, send location, help near me).
  Right: three options, Google, email. Esc and × close it.
- **Not in v1.0:** partner strip and "for organisations" page (revenue plan paused).
- Every rule in §5 "Must always be true" still applies to every v3 part.

## 4. Look (classy, calm, ours: `docs/SYSTEM_DESIGN.md` §7)
- **Background:** warm white by day, near-black by night. Thin 1 px borders; soft shadows only on parts that float (cards over the banner, menus).
- **One accent colour: violet**, for main buttons, links, focus rings and small accent eyebrows ("● জরুরি সাহায্য").
  - **Red only for 999 and danger.**
  - **Amber only for warnings** (e.g. "পুরোনো তথ্য হতে পারে", the offline notice).
  - **Green only for "done"** (e.g. a tick, "ঠিক করা হয়েছে").
  - No other colours for decoration.
- **Icons:** single-colour line icons in quiet tiles. No rainbow icon circles.
- **Every colour is a CSS variable** in `:root`, with night values in both dark-mode blocks. No colour written directly in a component.
- **Fonts:** Manrope (English) + Noto Sans Bengali (Bangla), self-hosted (#50). No letter-spacing on Bangla text.
  Headlines can be two-tone: a bright first line and a softer second line ("বিপদে আছেন? / সরকারি নম্বর, এক জায়গায়।").
- **Sizes:** body 16–17 px, buttons at least 44 px tall, phone numbers large and in Bangla digits on screen (`tel:` links keep 0–9).
- **Cards and corners:** one look for all cards. 12 px corners on small parts, slightly rounder cards, as in the reference page.
- **One signature element: the "signal ring"** (a soft location ping) on the home banner and the sign-in page. Nothing else animates.
- **Motion:** turn all motion off when the phone asks for less motion (`prefers-reduced-motion: reduce`).
- No other company's logo, colours, photos or text.
  Exception: sign-in buttons may show the provider's official logo exactly as the provider's
  branding guidelines say (the multicolour Google 'G', not recoloured, not stretched).
- Not allowed: bookings, prices, stock photos, heavy 3D/WebGL, slogans.

## 5. Must always be true
- 999 visible on every page; nothing covers it.
- Every service works without signing in; sign-in pages always show 999 and send location first.
- A search never ends empty: similar names → upazila buttons → "Find help near me" + 999.
- Every number shows its official source link and check date.
- Location is read only after the person taps, or while "Update my area automatically" is on (off by default; turning it on explains first, then the browser asks). Only the area name is saved, never the position; the area changes with a small note and never moves the person away from the page they are on. Family numbers stay on the phone.
- Works at 360 px width, in night and day, in Bangla and English, with keyboard and screen reader.

## 6. Check before every PR that changes the page
- [ ] Read every new sentence aloud: is it short, calm, true?
- [ ] bangla-reviewer agent checked the Bangla
- [ ] 360 px phone, night and day, Bangla and English
- [ ] `tests/search-test.html` says 0 failed
