# Settld: project overview

(App renamed from "Which Dublin" to "Settld" on 5 Nov 2026. The live URL and GitHub repo keep the old name for now — see §7.)

**Live:** https://which-dublin.vercel.app  
**Code:** https://github.com/Kabir192003/WhichDublin  
**Status:** working product, pre-launch (teaser stage). Last updated 5 November 2026.

Settld helps students, and anyone renting in Dublin, decide where to live. It puts rent, the real monthly cost of living, journey times to college, cheap supermarkets, part-time work and settling-in help in one place. Every number shows where it came from and how sure we are about it. No accounts, no cookies, no ads.

---

## Contents

1. [The problem](#1-the-problem)
2. [What the app does](#2-what-the-app-does)
3. [Data and methods](#3-data-and-methods)
4. [Architecture](#4-architecture)
5. [Repository layout](#5-repository-layout)
6. [Running and rebuilding](#6-running-and-rebuilding)
7. [Accounts, keys and settings](#7-accounts-keys-and-settings)
8. [Testing and quality checks](#8-testing-and-quality-checks)
9. [Design](#9-design)
10. [Privacy and security](#10-privacy-and-security)
11. [Known limits and open issues](#11-known-limits-and-open-issues)
12. [Competitive landscape](#12-competitive-landscape)
13. [Roadmap](#13-roadmap)
14. [Launch material](#14-launch-material)
15. [Timeline](#15-timeline)

---

## 1. The problem

Finding a place to live in Dublin is expensive and confusing, especially for international students arriving from abroad. A student typically juggles:

- a listing site (to see a flat),
- Google Maps (to check one commute at a time),
- searches like "average rent Rathmines",
- Reddit (to ask whether a price is fair),
- guesses about bills and groceries,
- worry about scams and deposits.

No single tool answers the real question: **"Can I afford to live here, and how long will it take me to get to college?"** Listing apps show a flat, journey planners show one trip, and cost-of-living guides give national averages. Settld combines them, starting from the student's college and budget.

**Audience:** incoming and existing students at nine Dublin colleges, and anyone renting in Dublin who wants the full picture before signing.

---

## 2. What the app does

| Page | What it does |
|---|---|
| **Start** | Five questions (college, how you'll live, home type, budget, travel mode), an Eircode box, a live "right now" line on bus delays, and links to every section. |
| **Explore** | Every area on a map coloured by typical rent, with no setup. Click a dot for rents, colleges, supermarkets, essentials, bikes and work. |
| **Find my area** | Ranks 106 areas for your answers. Filter pills, ranked cards (rent share, journey, walk to Lidl/Aldi, tags), a map, Save and Compare. |
| **Area page** | Your rent and how it was obtained; monthly cost range; journey to your college; average rent for all 25 home types with a 3-year trend; student-reported room rents; distance and journey to every college (weekday 8am / night / Saturday); supermarkets; everyday essentials and step-free stations; Dublinbikes; part-time work nearby; buses near home with **live delays**. "Route" links open Google Maps for every destination. |
| **Eircode lookup** | Type an Eircode. Google places it (exact or approximate, said honestly); you can tap the map or drag the pin to the building. Then live routing from that point: walking (Google), cycling (OpenStreetMap router), public transport (our timetable planner), nearest supermarkets, work nearby and rents. |
| **Compare** | Two areas side by side, better value marked per row. |
| **Shortlist** | Saved areas in one table with rent + travel, night journey and groceries; a share link for housemates. Stored in the link and the browser only. |
| **Part-time work** | Minimum wage (€14.15 from 1 Jan 2026, lower rates under 20), Stamp 2 hour limits (20 term / 40 in holidays, with today's limit), pay calculator, and areas ranked by places that hire students. |
| **Settling in** | Ordered checklist: IRP registration (€300, 90 days, booking, documents), Leap card fares, bank accounts (AIB, Bank of Ireland, PTSB, Revolut), mobile networks, and the BER energy-rating guide. |
| **Renting safely** | Interactive scam checker, the deposit rule (max 1 month deposit + 1 month in advance), digs/licence explainer, HAP note. |
| **How we know** | Sources, methods, confidence labels and limits in plain language. |
| **Feedback** | Top-bar form saved to the database (falls back to GitHub issues without a server). |
| **Installable app** | Web app manifest and service worker, so it can be added to a phone's home screen and works offline after a first visit. |

### Ranking (Find my area)

Areas over budget are set aside. The rest are scored 0–1 on rent share, commute and supermarket access relative to each other, then combined with weights for the chosen sort (Best overall, Cheapest, Closest to college). Missing grocery data scores neutrally and is flagged. Code: `src/domain/rank.js`.

### Living options

"Own 1-bed", "Own 2-bed", and "2-, 3- or 4-bed, own room" (each person has their own bedroom; rent is the whole-home average divided by the number of people), plus home type: any, apartment, terraced, semi-detached, detached.

---

## 3. Data and methods

All core data is open and licensed. Nothing is scraped from listing sites.

| Data | Source | Licence | Notes |
|---|---|---|---|
| Rent by area, size and type | RTB Average Monthly Rent Report via CSO PxStat, table RIQ02 | CC BY 4.0 | Latest quarter 2025 Q4; 73 quarters of history |
| Timetables | National Transport Authority GTFS (Dublin Bus, Go-Ahead, Bus Éireann, Luas, Irish Rail) | CC BY 4.0 | Weekday, weekday night and Saturday networks |
| Live delays | NTA GTFS-Realtime (TripUpdates) | NTA developer terms | Through our server only |
| Areas, campuses, supermarkets, docks, employers, essentials, stations | OpenStreetMap via Nominatim (and one Overpass mirror attempt) | ODbL | Fetched November 2026 |
| Street routes (walk, bike) | OSRM on routing.openstreetmap.de (FOSSGIS) | ODbL data | Precomputed for areas; live for Eircodes |
| Exact Eircode location, walking routes, map on the Eircode page | Google Maps Platform | Google terms | Live only, never stored, capped to the free allowance |
| Postal district boundaries | OpenStreetMap | ODbL | Used to check area locations |

### Rent: every home type, labelled

The RTB only publishes a figure when enough tenancies were registered. Every one of the 25 combinations per area (1, 2, 3, 4+ beds, all sizes × any, apartment, terraced, semi-detached, detached) is filled and labelled:

- **Published:** the RTB figure for 2025 Q4.
- **Carried forward:** the latest RTB figure from the previous two years, adjusted by the area's rent growth since (or Dublin's).
- **Estimated:** the closest figure the RTB did publish for that area (same size, or same type, or all homes), scaled by how the two compare across Dublin.

**Back-test:** estimates for 132 figures the RTB did publish (hidden, then estimated) were within 2.0% at the median and 6.3% for 8 in 10. Estimates anchored only on an area's all-homes average: median 6.3%, 8 in 10 within 12.6%.

Rent confidence: high needs ≥12 published groups and data ≤ ~13 months old; medium ≥6 groups and ≤2 years; otherwise low. Carried figures are medium; estimates are medium (specific anchor) or low (all-homes anchor). Code: `pipeline/build-rent.py`, `src/domain/model.js`.

### Journeys

- **Public transport:** our own Connection Scan Algorithm (`src/domain/csa.js`) over the NTA timetables: walk to a stop (≤800 m), ride, change (stops ≤300 m apart, 60 s minimum), walk to campus. Walking pace 1.25 m/s.
  - Weekday 8am: 13 departures 07:30–08:30 every 5 min; median shown with fastest and slowest.
  - Home at night: from college, 7 departures 22:00–23:00.
  - Saturday: to college, 7 departures 10:00–11:00.
- **Walking and cycling:** real street routes from OSRM for all 106 areas to every college, supermarket candidate and dock (previously straight-line × 1.3).
- **Dublinbikes:** walk to the nearest dock + ride + walk from the dock nearest campus + 2 minutes, only when both docks are within 1.5 km. 107 of about 115 docks are mapped.
- **In the browser:** the same planner runs on the Eircode page from the exact address (networks load on demand, ~1 MB compressed each).

### Supermarkets, work, essentials

- **Lidl, Aldi, Tesco:** 125 stores (tile search + per-area gap-fill). Nearest by street route among the three closest candidates per chain. Checked against Google Places in Dublin 15: all matched within ~30 m.
- **Part-time work:** counts of OSM places that often hire students within ~1 km: retail, food and drink, hotels, gyms and cinemas. Clearly labelled as employers, not vacancies. Counts cap at 40 per place type ("+").
- **Everyday essentials:** nearest pharmacy, GP and laundrette; nearby Luas and rail stops with step-free status where OSM records it. Libraries were dropped (unreliable data).

### Monthly cost

Rent share + travel (Dublin 90-minute fare, €1 student / €2 adult, twice a day, days per week, no caps) + bills (household electricity, gas and broadband, split between sharers, moved by the BER rating if chosen) + groceries (€150–€300, mostly Lidl/Aldi) + phone (€15). Shown as low / typical / high. Every part can be overridden by the user's own figure.

Sources: CRU electricity estimated annual bill €1,794 (Aug 2025, via a Dáil answer); gas ~€1,430–€1,480/yr and broadband €40–€70/month (comparison sites); groceries from student cost guides.

### Areas and geocoding

106 RTB named areas, geocoded with OpenStreetMap and checked against postal district boundaries. County areas outside the districts were re-geocoded as towns and villages only, after a bug placed Rush at a pub in Dublin 2. Areas more than 25 km from every campus are excluded.

### Settling-in and work facts

Hand-written in `src/content/facts.js`, each with sources and the date checked. Official sites (irishimmigration.ie, leapcard.ie, operators) were not reachable from the build environment, so most facts come from universities, regulators and reputable outlets, and the page says so. Prices that could not be confirmed (mobile plans, bank fees, Leap card fee and caps) are left out.

### Confidence labels and validation

Every rent, journey and supermarket figure carries a source, a date and a confidence label. `pipeline/validate.js` fails the build on impossible values or missing provenance (rent range, all 25 cells, journey ordering, coordinates inside Dublin, employer counts, bike-share plausibility, source dates).

---

## 4. Architecture

```
Browser (React + Vite app)
  │  same site
  ▼
Vercel  (team: style-book-ai, project: which-dublin, functions in London lhr1)
  ├─ static site: dist/ (app + public/data/*.json, timetable networks)
  └─ /api functions (Node, ESM)
       ├─ /api/health     what is configured
       ├─ /api/live       NTA live feed → per-route and city delays (30 s shared cache)
       ├─ /api/reports    anonymous room-rent reports (POST) and medians (GET)
       └─ /api/feedback   problem reports
  │
  ▼
Neon Postgres (via Vercel Storage, London, free plan)
  ├─ rent_reports   area_id, room, rent, bills, since, ip_hash, created_at
  ├─ feedback       kind, message, page, ip_hash, created_at
  └─ reliability    observed_at, route_id, trips, late5, late10, early, sum_delay (reserved)

GitHub Actions
  ├─ pages.yml          old GitHub Pages address → forwards to Vercel
  ├─ reliability.yml    every 15 min, 06:00–24:00: NTA live feed → per-route summaries on branch reliability-data
  └─ rent-reports.yml   daily aggregation of GitHub-issue rent reports (legacy path)

Third parties called from the browser
  ├─ Google Maps Platform (Eircode page only, capped)
  ├─ Nominatim (address search fallback)
  ├─ routing.openstreetmap.de (cycling; walking fallback)
  └─ OpenFreeMap tiles (MapLibre maps)
```

**Front end:** React 18, Vite 5, MapLibre GL 4 (OpenFreeMap tiles), Lucide icons, Inter. Hash routing (`#/explore`, `#/areas`, `#/eircode/D15X0HA`, …); settings live in the URL query so links are shareable.

**Data pipeline:** Python and Node scripts produce one dataset (`public/data/areas.json`, ~790 KB) plus timetable networks for the browser.

**Database:** tables are created automatically on first use (`server/db.js`); no separate migration step.

---

## 5. Repository layout

```
api/                 Vercel functions: health, live, reports, feedback
server/              server-only code: db, http helpers, live summariser, generated route and area lists
src/
  App.jsx            routes, top bar
  components/        pages and parts (Home, Explore, Finder, Detail, Eircode, Work, Settle, Renting, Shortlist, …)
  domain/            pure logic: rank, model (rent, commute, work, cost), csa, route, geo, streets, google, api, shortlist
  content/facts.js   hand-maintained facts with sources (wage, hours, IRP, Leap, banks, mobile, renting, bills, BER)
  styles.css         design tokens and styles
pipeline/            data fetching and building (see section 6)
public/data/         areas.json, network-am/late/sat.json, reports.json
tests/               node --test suite (27 tests)
docs/                PROJECT.md (this file), METHOD.md, DATA_SOURCES.md, launch/linkedin-teaser.txt
.github/             workflows, rent-report issue form
vercel.json          build, region, headers
```

---

## 6. Running and rebuilding

```bash
npm install
npm run dev        # local app at http://localhost:5173 (no /api locally unless using `vercel dev`)
npm test           # 27 tests
npm run build      # validates data, then builds to dist/
```

Rebuilding the data (Python 3 + Node 20; respects Nominatim's 1 request per second policy, so full runs take a while):

```bash
python3 pipeline/build-rent.py                 # RTB rent, 25 cells per area, back-test
python3 pipeline/build-network.py 2026-11-11                          # weekday 06:30–11:00
python3 pipeline/build-network.py 2026-11-11 21:30-26:30 network-late # weekday night
python3 pipeline/build-network.py 2026-11-14 09:00-13:30 network-sat  # Saturday
python3 pipeline/geocode-areas.py && python3 pipeline/fix-county-geocodes.py
python3 pipeline/fetch-supermarkets.py
python3 pipeline/fetch-enrich.py               # supermarket gap-fill, employers, bike docks (resumable)
python3 pipeline/fetch-bikes-central.py        # finer central pass; then re-run fetch-enrich.py
python3 pipeline/fetch-essentials.py           # pharmacies, GPs, laundrettes, stations (resumable)
python3 pipeline/route-streets.py              # OSRM street routes per area
python3 pipeline/build-routes.py               # route id → name for live delays
node pipeline/compute.js                       # writes public/data/areas.json and server/area-ids.js
node pipeline/validate.js
cp data/build/network*.json public/data/       # network.json → network-am.json
```

Raw GTFS zips live in `data/raw/gtfs/` (not committed).

---

## 7. Accounts, keys and settings

**Never commit keys.** They live only in Vercel and GitHub settings.

| Where | What | Notes |
|---|---|---|
| **Vercel** (iCloud login, team *style-book-ai*, project *which-dublin*) | `DATABASE_URL` (from Neon), `NTA_API_KEY` (secret), `VITE_GOOGLE_MAPS_KEY` | Functions region lhr1. Production URL which-dublin.vercel.app; team URLs are behind Vercel login. |
| **Neon** (via Vercel Storage) | Postgres, London, free plan | 1 GB, scales to zero. View data via Vercel → Storage → open in Neon. |
| **GitHub** (repo secrets) | `GOOGLE_MAPS_KEY`, `NTA_API_KEY` | Used by Pages build (legacy) and the reliability collector. |
| **Google Cloud** (project *My First Project*, key *which-dublin-web*) | Browser key | Website restrictions: `https://which-dublin.vercel.app/*`, `https://kabir192003.github.io/*`. API restrictions: Geocoding, Maps JavaScript, Places (New), Routes. |
| **NTA developer portal** | GTFS-Realtime key (primary in use, secondary spare) | |

### Google free-usage safety net

| API | Daily cap set | Why |
|---|---|---|
| Routes, ComputeRouteMatrix elements | 300 | ~9,300/month under the 10,000 free |
| Routes, ComputeRoutes | 0 | not used |
| Geocoding v3 requests | 300 | used by the in-browser geocoder |
| Geocoding v4 rows | 0 | not used |
| Maps JavaScript map loads | 300 | |
| Maps JavaScript 3D map loads | 0 | not used |
| Places (New) Text Search | 150 | not used by the app now; kept as headroom |
| Places (New) other | 0 | |

A ₹1 budget alert emails on any charge. When a cap is reached, the Eircode page falls back to the open-data path (approximate location + tap-to-pin, OSRM routes). Per lookup the app uses 1 geocode, 1 map load and ~15 route elements, so about 650 Google lookups a month fit in the free tier. Google is never used elsewhere in the app.

---

## 8. Testing and quality checks

- **Unit tests** (`npm test`, 27): confidence rules, ranking (budget, weights, missing data, ties), rent per person and rent methods, commute modes including Dublinbikes, URL state sanitising, routing on a toy network (transfers, many destinations), Eircode parsing, point-based lookups, work hour limits across the new year, pay, work mix, cost and cost ranges, room-report parsing and aggregation (5+ rule), live delay summaries.
- **Data validation** (`pipeline/validate.js`): runs before every build and fails on implausible or unsourced data.
- **Browser checks:** Playwright screenshots of every page at desktop and phone width during development; live-site checks of the API (health, live, reports validation, feedback, cross-site blocking) after each deploy.
- **Real-world check:** D15 X0HA verified against Google (Lidl 1.47 km / 20 min, Aldi 1.64 km, Tesco 2.0 km), which exposed and fixed the district-centre and straight-line issues.

---

## 9. Design

- **Look ("Liffey"):** deep teal `#0B4F45` / `#0B7A65`, coral `#E8613C` for highlights and top picks, warm sand for notes, neutral tint `#F3F6F4` for number tiles. Inter for all text. Lucide line icons.
- **Designed first on a Claude Design canvas:** https://claude.ai/artifact/FoVfYnAAw1tDcVi9FrFx2h (start page, results, Eircode on phone).
- **Principles:** plain language; sources visible but folded ("How this is worked out"); honest labels (published / carried forward / estimated; approximate location); works at phone width; keyboard-accessible controls; confidence shown in words, not colour alone.
- **Recent refinement:** consistent Lucide icons replaced hand-drawn ones and text symbols; quieter cards (no pastel icon squares, one neutral tile tint, smaller radii, softer shadows).

---

## 10. Privacy and security

- No accounts, no cookies, no tracking or analytics.
- Shortlist and cost settings stay in the browser (and the share link).
- Rent reports and feedback store only what's asked plus a salted hash of the IP for rate limiting (3 reports a day, 5 feedback messages an hour).
- Writes accept same-origin requests only; JSON bodies are size-limited and validated.
- The NTA key is only on the server. The Google key is a browser key restricted to the site and four APIs, with daily caps.
- Third parties that receive data when a user acts: Google (Eircode lookups), Nominatim (address search), OSRM (route points), OpenFreeMap (map tiles). The page says so.
- Security headers via `vercel.json` (nosniff, referrer policy, frame denial, permissions policy).

---

## 11. Known limits and open issues

**Data**
- Rent is the average for new tenancies of whole homes, not room asking prices. Shared rent divides it by people.
- About four-fifths of rent figures are estimates (mostly house types); each is labelled.
- Journey times are scheduled; live delays are shown separately. Reliability labels need 3–4 weeks of collected data.
- Luas may not report live delays in the NTA feed (to be confirmed in daytime).
- Many Eircodes are only approximate in Google and missing in OpenStreetMap; the page says so and offers tap-to-pin.
- OpenStreetMap may miss new shops and some Dublinbikes docks (107 of ~115).
- Area descriptions from Wikipedia are not in the current dataset (the fetch did not finish); the field is empty.
- Settling-in facts rely on secondary sources because official sites were unreachable when written.

**Operations**
- **Set `HASH_SALT`** in Vercel (any long random string). Without it, IP hashes use a default salt.
- **Rotate keys:** the NTA and Google keys appeared in a chat transcript. Regenerate both, then update Vercel (`NTA_API_KEY`, `VITE_GOOGLE_MAPS_KEY`) and GitHub secrets.
- GitHub pauses scheduled workflows after 60 days without repo activity; re-enable under Actions if the collector stops.
- Commit `b24d03e` shows as "Unverified" on GitHub (author email); fixing it needs a force-push.
- The reliability summaries are on the `reliability-data` branch; moving them into the `reliability` table is pending.
- `rent-reports.yml` (GitHub-issue reports) is a legacy path now that reports go to the database.

---

## 12. Competitive landscape

Full one-page scan: https://claude.ai/artifact/JhJD2mjy5xUUjTYijNj38M

- **HomeScout** (Dublin, founded 2025): AI rental search with a neighbourhood rent map and comparison; closest competitor.
- **Daft.ie:** market-leading listings and rent reports; no commute filter found.
- **Spotahome / HousingAnywhere:** verified rooms and payment protection.
- **Students' union services** (e.g. TCDSU): advice and SU-only listings; better as partners.
- **Google Maps / TFI:** one journey at a time.
- **UK precedent:** Zoopla and Rightmove offer travel-time search (TravelTime API), proving demand.

**Positioning:** "Listing sites show you a flat. Settld shows you whether the area works for your college, your budget and your first months here, before you pay a deposit." The defensible edge is the combination (college-first, full monthly cost, real journeys, groceries, work, settling-in, sources on every number), trust, and future students' union partnerships, not the open data itself.

---

## 13. Roadmap

**Next**
1. "Is this rent fair?" checker: paste a listing's rent, compare with the area average (and Rent Pressure Zone rules once verified).
2. A page per college ("Living near DCU") for search traffic.
3. Bus reliability labels from the collected data (first rough version after ~1 week).
4. Set `HASH_SALT`, rotate keys.

**Then**
- Move-in condition record (photos and notes kept on the phone) and a viewing checklist.
- Second destination (rank by college + job).
- Languages (Hindi, Portuguese, Spanish, Chinese, Irish).
- Email the NTA for historical punctuality data.
- Purpose-built student accommodation prices near each campus.
- Students' union partner pages.
- Housemate finder (needs accounts and moderation; later).
- Logo and brand mark (requested; five concepts with variations).
- More colleges and cities (deliberately out of scope for now).

**Out of scope by decision:** scraping listing sites, paid routing, crime or "safety" scores.

---

## 14. Launch material

- LinkedIn teaser (bold text and spacing ready to paste): `docs/launch/linkedin-teaser.txt`.
- Suggested launch visual: a 15–20 second screen recording of an Eircode lookup with the site address blurred.

---

## 15. Timeline

All on 4–5 November 2026.

| Commit | Change |
|---|---|
| `021b199` | First version: RTB rent, NTA timetable routing, OSM geography and supermarkets; React + MapLibre finder |
| `ef227bc` | Clearer redesign; part-time work, Dublinbikes mode, Settling-in guide |
| `b24d03e` | "Liffey" redesign (Claude Design), Explore map, Eircode lookup, rent for every home type, county geocoding fix |
| `d8ca8be` | Employer counts, Dublinbikes docks, supermarket gap-fill |
| `02135ed` | Night and Saturday journeys; route planner usable in the browser |
| `5eb9e4a` | Eircode page never presents a district centre as an address; live routing |
| `e5b5180` | Shortlist and share, monthly cost, Renting safely |
| `a8ce0f8` | Rent trend; installable offline app |
| `9167988` | Student rent reports (GitHub form) and reliability collector |
| `fc8c257` | Google Maps Platform on the Eircode page |
| `1d6ad63` | Street-routed walking and cycling for every area; everyday essentials |
| `b75eff8` | Google usage kept inside the free allowance |
| `55344d3` | Approximate Google results labelled; tap or drag to the building |
| `5c62844`, `f0ea647` | "Route" links to Google Maps on the Eircode and area pages |
| `6b5958a` | Part-time work page rebuilt in the current design |
| `cddce81` | Monthly cost as a sourced range; BER guide |
| `014c496` | Reliability collector stores per-route summaries |
| `89cb1e7` | Server side on Vercel: live delays, in-app reports and feedback, Postgres |
| `cf17f38` | "2-bed, own room" wording |
| `3807653` – `0856473` | Hosting moved to Vercel; old address forwards; function fixes; London region |
| `062d057` | Calmer UI: Lucide icons, quieter cards |
