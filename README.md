# SafeConnect

**Official emergency and public-service contacts for every location in Noakhali and Cox's Bazar, in Bangla and English, working even without internet.**

When something goes wrong (an attack, a theft, an accident, a fire or a flood), SafeConnect shows the right official numbers for *where you are*:

- **999**, always first
- the nearest **police outpost or police station**
- your ward's **village police**
- your **union chairman and members**
- the **UNO**, the hospital and the fire station
- national helplines

It also lets you send your **location to family in one tap**.

> Pilot districts: **Noakhali** and **Cox's Bazar** · Budget: **0** · Data: **official `*.gov.bd` sources only**

## Roadmap

- **Phase 1 (now):** Noakhali and Cox's Bazar: full data, every union and municipality
- **Phase 2:** All 64 districts of Bangladesh, using the same data tools (one data file per district)
- **Phase 3:** Partner with local authorities to keep numbers up to date

## Status

🚧 In development (2-week student project). See [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md).

## Team

| Member | GitHub | Role |
|---|---|---|
| Jerin | [@jerin101](https://github.com/jerin101) | Lead: data, backend tools, Firebase, GitHub |
| Tasmin | [@tasmintoshi](https://github.com/tasmintoshi) | Frontend: UI, design, features in the browser |

## Main features

- Area picker for the whole country, with full data for Noakhali and Cox's Bazar
- One-tap "Find help near me" (GPS, works offline), plus village search
- Contact cards with tap-to-call, the source link and the date each number was checked
- A fallback chain, so a missing number never leaves you with an empty screen
- SOS with location sharing (WhatsApp / SMS / share), Silent SOS, siren
- Safe Journey (number-plate photo + route + "I arrived safely")
- Lost/stolen item GD helper, "how to report a crime" guides
- Works offline first (installable app), Bangla / English, dark / light theme
- Verified volunteers in your union (logged-in users can apply)

Full list: [`docs/FEATURES.md`](docs/FEATURES.md) · Technology and workflow: [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md)

## Data promise

Every number comes from an official Bangladesh government website, and the exact page link is stored with it. Nothing is guessed. Scripts re-check every number against its source before release.

## Run locally

*(Available after the first frontend tasks are merged.)* Open the folder in VS Code → right-click `index.html` → **Open with Live Server**.

## License

MIT. See [`LICENSE`](LICENSE).
