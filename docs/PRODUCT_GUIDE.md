# Settld: the complete guide

How the product works, where every number comes from, and how it is built. Written for someone who has to explain it to other people and answer questions. Updated 16 November 2026.

**Live:** https://which-dublin.vercel.app  **Code:** https://github.com/Kabir192003/WhichDublin
(The app is called Settld. The web address and the code repository still carry the earlier name, Which Dublin.)

---

## 1. What Settld is, in one minute

Finding somewhere to live in Dublin, especially when you arrive from abroad, means juggling a listing site, Google Maps, forum posts, guesses about bills, and worry about scams. No single tool answers: **"Can I afford to live here, and how long will it take me to get to college?"**

Settld answers that for 106 named areas of Dublin and 9 colleges (TCD, UCD, DCU, TU Dublin, RCSI, NCI, DBS, Griffith, IADT). It combines:

- **what rent is** in each area (official data, not listing sites),
- **what a month really costs** (rent share, travel, bills, groceries, phone),
- **how you get to college** (real timetables for Dublin Bus, Go-Ahead, Bus Éireann, Luas and DART/Irish Rail),
- **where the cheap supermarkets are,**
- **what part-time work and legal hour limits apply,**
- **how to settle in** (immigration registration, Leap card, banking, mobile, energy ratings, rental scams),
- and a **live Commute page** that shows when buses, trams and trains actually arrive.

The rule that runs through everything: **every number shows its source, its date and how sure we are.** Rent figures say whether they were published, carried forward or estimated. Journey times say they are scheduled. Where we could not confirm something, the page says so or leaves it out.

What it is not: a listings site (it does not scrape Daft or Facebook), a booking service, or a replacement for checking a specific flat. It tells you whether an *area* works.

---

## 2. A tour of the product

| Page | What the person sees | Why it exists |
|---|---|---|
| **Start** | Five questions (college, how you will live, home type, monthly budget, travel mode), an Eircode box, and links to everything. | Gets a first answer in under a minute. |
| **Explore** | All areas on a map, coloured by typical rent. Click a dot for rents, colleges, shops, essentials, bikes and work. | Browse without committing to answers. |
| **Find my area** | The 106 areas ranked for your answers, with rent share, journey time, walk to Lidl/Aldi, tags, a map and a shortlist button. | The core "where should I live" result. |
| **Area page** | Your rent and how it was obtained, a monthly cost range, journey to your college, rent for all 25 home types and a trend, distance to every college, supermarkets, work nearby. | Everything about one place on one page. |
| **Compare / Shortlist** | Saved areas side by side, with plain-language differences ("Balgriffin costs €160 a month less in rent than Christchurch") and a share link. | Decide between a few areas, or share with housemates. |
| **Cost of living** | Pick an area, home size, people sharing, travel; get a low / typical / high monthly cost table you can override. | Shows the real monthly number, not just rent. |
| **Commute** | Look up any stop, see live departures, bus positions, Luas and train boards, and plan journeys with changes. | The part that makes it feel alive. |
| **Moving to Dublin** | Ordered checklist: immigration registration, Leap card, bank, mobile, energy rating; the scam checker and deposit rules. | Settling in. |
| **Part-time work** | Minimum wage, student hour limits (20 in term, 40 in holidays for non-EEA students), pay calculator, areas ranked by employers that often hire students. | Money side of student life. |
| **Eircode lookup** | Type an Eircode, see journeys from that exact address to every college. | Check a place you are about to view. |
| **Sources / How we know this** | Sources, methods and limits in plain language. | Trust. |

Also: an installable web app (works offline after the first visit), optional accounts to save areas, a feedback form, and an error monitor.

---

## 3. Where the data comes from

All core data is open and licensed. Nothing is scraped.

| Data | Source | Licence | Used for |
|---|---|---|---|
| Rent by area, bedrooms and home type | **RTB Average Monthly Rent Report**, published through the **CSO PxStat** table RIQ02. https://data.cso.ie | CC BY 4.0 | All rent figures |
| Timetables (Dublin Bus, Go-Ahead, Bus Éireann, Luas, Irish Rail) | **National Transport Authority (NTA) GTFS static**. https://www.transportforireland.ie/transitData/PT_Data.html | CC BY 4.0 | Journeys, departures, stop lookup |
| Live bus delays | **NTA GTFS-Realtime, TripUpdates**. https://developer.nationaltransport.ie | NTA developer terms | Live times |
| Live bus GPS positions | **NTA GTFS-Realtime, Vehicles** | NTA developer terms | Bus dots on the map |
| Live Luas times | **Transport Infrastructure Ireland (TII) Luas forecasting service** (luasforecasts.rpa.ie) | Public service | Luas board |
| Live trains and DART | **Irish Rail Realtime API** (api.irishrail.ie) | Public service | Station boards |
| Area positions, campuses, supermarkets, bike docks, employers, pharmacies | **OpenStreetMap**, via Nominatim and Overpass | ODbL | Maps, distances, essentials |
| Street routes (walking, cycling) | **OSRM** on routing.openstreetmap.de (FOSSGIS) | ODbL data | Walk and cycle times |
| Map tiles | **OpenFreeMap** (OpenStreetMap data) | ODbL | The maps |
| Exact Eircode location, walking routes and map on the Eircode page | **Google Maps Platform** | Google terms | Eircode page only, live, never stored |
| Minimum wage | Ibec, summarising the National Minimum Wage Order | Public | Work page |
| Energy ratings guide | **SEAI** (Sustainable Energy Authority of Ireland) | Public | Moving to Dublin |
| Deposit rules | **RTB**, Residential Tenancies (No. 2) Act 2021 | Public | Renting safely |
| Electricity, gas, broadband | CRU estimate quoted in an Oireachtas written answer; Selectra; Expat Focus | Public | Bills in the cost estimate |

Settling-in and work facts are hand-written in `src/content/facts.js`, each with a source link and the date it was checked. Several official sites could not be reached from our build environment, so many facts rest on universities, regulators and reputable outlets, and the page marks those as "secondary".

**Deliberately not used:** listing sites (terms of service and legal risk), and crime or safety scores (the data is not granular or reliable enough).

---

## 4. How rent works

### The source and its catch
The RTB publishes average monthly rent per named area, by number of bedrooms (all, 1, 2, 3, 4+) and by type (all, apartment, terraced, semi-detached, detached), for the latest quarter (2025 Q4) with 73 quarters of history.

Two facts shape everything:
1. The figure is the **average for the whole home**, not a room price. For "2-bed, own room", your share is the average divided by the number of people.
2. The RTB only publishes a cell when enough tenancies were registered. So some of the 25 combinations per area are missing.

### Every cell is filled, and labelled
- **Published:** the RTB figure for 2025 Q4.
- **Carried forward:** the latest RTB figure from the previous two years, adjusted by the area's rent growth since (or Dublin's).
- **Estimated:** the closest figure the RTB did publish for that area (same size, or same type, or all homes), scaled by how those two compare across Dublin.

We tested this: we hid 132 figures the RTB had published, estimated them, and compared. The median error was 2.0%; 8 in 10 were within 6.3%. Estimates anchored only on an area's all-homes average were looser (median 6.3%; 8 in 10 within 12.6%).

Confidence: **high** needs 12 or more published groups and data up to about 13 months old; **medium** 6 or more and up to 2 years; otherwise **low**. Carried figures are medium. Estimates are medium (specific anchor) or low (all-homes anchor).

### Existing versus new tenancies
The RTB figures cover registered tenancies, many long-running and capped by Rent Pressure Zone rules. Rents for a home let *today* are higher. The RTB itself reports a Dublin average of **€1,939 for existing** and **€2,232 for new** tenancies (2025 Q4). We scale every rent we show by 2,232 / 1,939 (about 1.15), so numbers reflect a tenancy starting now. The page explains this and compares with Daft.ie's asking-price report, which measures something different.

Code: `pipeline/build-rent.py` (cells, estimates, back-test), `src/domain/model.js` (`toMarket`, `rentPerPerson`, `rentForHome`).

---

## 5. How the monthly cost works

The Cost of living page builds a **low / typical / high** range for one person:

| Row | Low | Typical | High | Source and logic |
|---|---|---|---|---|
| Rent, your share | What existing tenancies pay (RTB figure, divided by people) | New-tenancy level (the scaled figure, divided by people) | Typical plus **10%** | The 10% asking premium is **our assumption**, explained on the page |
| Travel | Student fare, one fewer day on campus a week | Your chosen Leap card and days | Adult fare, one more day | Dublin 90-minute fare (€1 student, €2 adult), two trips a day. Fare caps are **not** applied because we could not confirm them. Walking, cycling and bikes show €0 |
| Bills, your share | Low | Typical | High | Household electricity (€90 / €150 / €180), gas (€0 / €60 / €125), broadband (€40 / €50 / €70), split between the people sharing; adjusted by the home's energy rating (BER) if chosen |
| Groceries | €90 | **€120** | €160 | Per person, mainly Lidl and Aldi, cooking at home. Published student guides quote more (€150 to €350), so you can override |
| Phone | €10 | €15 | €20 | A SIM-only plan |

Every part can be overridden with the person's own number, stored only in their browser. A check across 2,968 combinations of area, home size and people confirmed Low ≤ Typical ≤ High on every row (the travel row is ordered by construction: fewer days, then your days, then more days at the adult fare). People choose how many share a home, so students sharing a bedroom (2 in each room of a 2-bed, for example) are covered.

Code: `src/components/CostPage.jsx`, `src/components/Cost.jsx`, `src/domain/model.js` (`costRange`), assumptions in `src/content/facts.js`.

---

## 6. How areas are ranked

Areas over your budget are set aside. The rest are scored 0 to 1 on rent share, journey time and supermarket access **relative to each other**, then combined with weights for your sort (Best overall, Cheapest, Closest to college). Missing supermarket data scores neutrally and is flagged. A "How the order is worked out" note explains this on the page. Code: `src/domain/rank.js`.

---

## 7. How journeys to college work (area pages)

- **Public transport:** our own **Connection Scan Algorithm** (`src/domain/csa.js`) over the NTA timetables: walk to a stop (up to 800 m), ride, change (stops up to 300 m apart, 60 seconds minimum), walk to campus. Walking pace 1.25 m/s. For the weekday 8am journey we run 13 departures from 07:30 to 08:30 every 5 minutes and show the median with the fastest and slowest. There is also a home-at-night journey (22:00 to 23:00) and a Saturday journey.
- **Walking and cycling:** real street routes from OSRM for every area to every college, supermarket candidate and dock, precomputed.
- **Dublinbikes:** walk to a dock, ride, walk from the dock nearest campus, plus 2 minutes, only if both docks are within 1.5 km.
- **Eircode page:** the same planner runs in the browser from the exact address. Walking uses Google; cycling uses OpenStreetMap routing; public transport uses our planner.
- **Supermarkets:** 125 Lidl, Aldi and Tesco stores; nearest by street route among the closest candidates. We checked one area (Dublin 15) against Google Places and all matched within about 30 m.

Journeys are **scheduled** times, labelled as such. Rankings and area pages are built from a pipeline (`pipeline/`) that produces one dataset (`public/data/areas.json`, about 800 KB).

---

## 8. The Commute page, in depth

This is the most technical part of the product, so it gets the most space.

### 8.1 Finding a stop
Search by the number printed on a bus stop pole or by name (any mode, including Luas and DART, which have no pole numbers). A search box shows **recent stops** when you tap it (up to 10, kept only in your browser, with a Clear button), for both the "From" and the optional "To" box.

Data: `public/data/stops.json` (about 5.9 MB, 9,831 stops, 389 routes) built from the NTA timetables by `pipeline/build-stops.py`.

### 8.2 Which way is a route going?
A bus stop sits on one side of the road, so it serves one direction. Each route button says **where it is heading** ("38A to Burlington Road") and whether that is **towards or away from the city centre**. The destination is the last stop of the route's usual pattern. "Towards the city" means that last stop is more than 500 m closer to O'Connell Street than your stop is. This rule is ours, and it gives no label when the difference is small.

For the **other direction**, the page finds the nearest stop within 300 m where the same route runs the opposite way (the stop across the road) and offers one tap to switch.

### 8.3 Live bus times: how "Expected" is worked out
Three NTA data sets work together:
1. **Scheduled timetable** for today (weekday, Saturday or Sunday, in Dublin time).
2. **Trip updates** (GTFS-Realtime): for each running trip, its delay, for some stops an exact predicted time.
3. **Vehicle positions:** the latest GPS fix of each bus.

The key idea is **matching by trip ID**. Each scheduled departure has a trip ID such as `6055_12724`, and the live feed uses the same IDs. So a live bus is tied to its own scheduled slot exactly. (An earlier version matched by nearest time, which guessed wrong. Trip IDs also change every week, which is why the timetable is rebuilt weekly; see 8.7.)

What you see on a departure:
- **Expected 18:49 (on time):** the feed gave a time for this exact stop.
- **~Expected 18:30 (1 min late):** the feed has not reported this stop yet, so the bus's delay from the last stop it reported is carried forward. This is how real-time transit apps normally do it.
- **On the road, 21 stops away:** the bus has a GPS position but the delay feed has no time for it yet (for example a bus just starting out). We show its position and distance, **not an invented delay**.
- **No badge:** no live information for that trip yet. The NTA usually only lists a bus 20 to 40 minutes before it reaches a stop, so later departures show only the schedule. Live badges only appear for buses due within an hour.

Where do the delays come from? The NTA's system combines the GPS units on the buses with the timetable to predict arrivals. The feed is therefore a prediction, not the bus's exact position, and a bus can drop out of it for a refresh or two.

### 8.4 The map
Pick a route and the map draws it with each live bus as a dot labelled with the route number and coloured by lateness (green on time, blue a few minutes late, orange more than five, grey no delay reported). **Tap a bus** to see its lateness and distance. Only buses going **the same direction** you picked are shown (we check each bus's trip ID against that route's timetable at your stop). Data refreshes every **15 seconds**, pauses when the tab is hidden, and a **Refresh** button reloads it immediately.

### 8.5 Luas and trains
The NTA bus feed has no Luas or Irish Rail data, so these come from the operators' own services:
- **Luas:** TII's forecasting service gives the next trams in each direction (inbound and outbound), with a service message. Our server finds the right Luas stop by coordinates (within 250 m).
- **DART, commuter and intercity rail:** Irish Rail's real-time service gives each station's next trains with destination, time, minutes late and status. Our server finds the station by coordinates (within 500 m).

Both appear as a live board at the top of a Luas or rail stop page, with the same Refresh button.

### 8.6 Journey planner (with changes)
Type a destination in "To" and the planner finds journeys across **bus, Luas, DART and rail**, with up to **two changes** and **short walks (up to 300 m)** between stops.

How it works:
- The timetable build records, for each route, **how many minutes each stop is from the route's first stop** (`offsets` in `stops.json`). A bus boarding stop A at minute d reaches stop B at d minus A's offset plus B's offset.
- We use a **round-based earliest-arrival search (RAPTOR style)**: round 1 finds the earliest arrival at every stop with one vehicle, round 2 with two vehicles (one change), round 3 with three. Walking links join nearby stops. Code: `src/domain/planner.js`, with a test.
- **Stations are grouped**: both Luas platforms, or both sides of a street, count as one place. That fixed a bug where Museum to Jervis said "no direct route" although both are on the Red line.
- The page shows up to five options (leaving now, +12 and +25 minutes), each step by step: which vehicle, where to board and when, how many stops, where to get off, and the walks between. The chosen journey is drawn on the map in colour (Luas Red and Green use their own colours; walks are dashed).
- Anything over four hours is hidden, because that means "no service tonight", not a journey.

Example: Museum to Dundrum gives the Red line to Abbey Street, a 2-minute walk, then the Green line, about 35 minutes.

**Limits:** times are scheduled, not live, and use the weekday timetable (the page warns at weekends). It plans stop to stop, not door to door: no addresses, no walking directions, no cycling, no fares.

### 8.7 Keeping it correct
- **Timetable files** are built from the NTA's latest GTFS download for three day types (weekday, Saturday, Sunday). Per-departure trip IDs are split into 256 small files so a phone downloads only the few kilobytes for the stop it is looking at.
- **Weekly refresh:** the NTA's trip IDs change every week, so a **GitHub Action** ("Refresh bus timetable") runs every Sunday at 02:30 UTC, rebuilds everything, checks the output is not truncated, and commits. If the download fails the run fails and the old data stays live.
- **Time zone:** all times use Dublin time whatever the device is set to.
- **Server:** live feeds are fetched once and shared through the database for 15 to 30 seconds so many visitors do not hammer the NTA. Everything is optional: if a live feed fails, the page shows the schedule.

---

## 9. The rest of the product

- **Eircode lookup:** Google Geocoding places the code and says honestly whether it is exact or approximate; you can tap the map or drag the pin. Then live routing from that point to every college. Google is used only here, never stored, and capped by daily limits so it stays inside the free allowance; if a cap is reached the page falls back to open data.
- **Part-time work:** minimum wage €14.15 from 1 January 2026 (lower under 20), student hour limits (20 per week in term, 40 in 1 June to 30 September and 15 December to 15 January, for non-EEA students on Stamp 2), a pay calculator, and areas ranked by counts of OpenStreetMap places that often hire students (retail, food and drink, hotels, gyms and cinemas). These are employers, not vacancies.
- **Moving to Dublin:** immigration registration (IRP), Leap card, bank accounts, mobile, and the energy-rating (BER) guide, an ordered checklist with progress saved in the browser.
- **Renting safely:** an interactive scam checker, the deposit rule (at most one month's deposit and one month's rent in advance), digs and licence explainer.
- **Accounts (optional):** username and password (scrypt hashing, httpOnly session cookie) to save areas across devices. Nobody needs an account to use the product.
- **Feedback and monitoring:** a feedback form saved to the database; errors are logged on the server and reported to Sentry only if a Sentry key is configured.
- **Installable app:** a web app manifest and service worker; pages and data try the network first and fall back to the saved copy offline.

---

## 10. How it is built

**Front end:** React 18, Vite 5, MapLibre GL (maps, OpenFreeMap tiles), Lucide icons, Inter font. Hash routing, so settings live in the web address and links are shareable. About 3,200 lines of application code.

**Back end:** Vercel serverless functions (`api/`) in London; Neon Postgres for feedback, rent reports, accounts and the shared live cache.

| Function | Purpose |
|---|---|
| `/api/stop-live` | Live buses for one stop and route: delays, matched by trip ID, plus vehicle positions |
| `/api/live` | City-wide and per-route delay summary |
| `/api/transit-live` | Live Luas or Irish Rail board for a point |
| `/api/auth/*`, `/api/saved-areas` | Optional accounts and saved areas |
| `/api/reports`, `/api/feedback`, `/api/health` | Anonymous room-rent reports, feedback, status |

**Data pipeline (`pipeline/`)** produces the datasets: rent, area geocoding, supermarkets, bike docks, employers, essentials, street routes, journey networks, the stop lookup and trip files.

**Automation (GitHub Actions):** the weekly timetable refresh, a collector that samples live delays every 15 minutes for future reliability labels, and a daily rent-report aggregation.

**Hosting and secrets:** Vercel hosts the site and functions. The NTA key and database address are server-side secrets. The Google key is a browser key restricted to the site and four APIs, with daily caps.

### Security and privacy
- No tracking or analytics, no listing-site scraping. Shortlists and cost settings stay in the browser and the share link.
- Security headers on every page: a strict Content Security Policy, no framing, no sniffing, a restrictive permissions policy and HSTS.
- Writes accept same-origin requests only; request bodies are size-limited and validated (malformed JSON returns a clear 400); IP addresses are stored only as salted hashes for rate limiting.
- The dependency audit reports zero known vulnerabilities, and an accessibility scan (axe, WCAG 2 A and AA) is clean on every page at phone and desktop widths.

### Quality checks
- **33 automated tests:** rent logic, ranking, routing, cost ranges, live matching (including underscore and space route IDs), vehicle parsing, Luas and rail parsing, and the journey planner.
- **Data validation** runs before every build and fails on impossible values or missing sources.
- **Browser checks:** screenshots and measurements of every page at phone and desktop sizes (no sideways scrolling, tap-target sizes, text sizes), and live-site checks against real NTA, Luas and Irish Rail data.

---

## 11. Honest limits and assumptions

Say these out loud; they build trust.

1. **Rent** is an average for new tenancies of whole homes, not an asking price for one flat or room. About four-fifths of the 25 figures per area are estimates; each is labelled.
2. **The 10% asking premium, the grocery range, the phone range and the one-day travel variation** are our assumptions and are marked as such.
3. **Journey times** on area pages are scheduled, not live. Reliability labels need weeks of collected live data.
4. **Live matching depends on the NTA feed.** A bus can disappear from it briefly, and buses are only listed shortly before they arrive.
5. **The journey planner** uses the weekday timetable, plans stop to stop, and stops at two changes. At weekends some services differ.
6. **The "towards or away from the city" label** is a simple distance rule.
7. **Many Eircodes** are only approximate in Google and missing in OpenStreetMap; the page says so.
8. **OpenStreetMap** may miss new shops and some bike docks (107 of about 115 are mapped).
9. **Settling-in facts** rely on secondary sources where official sites could not be reached; mobile plan prices, bank fees and Leap card caps are left out because they could not be confirmed.
10. **The weekly timetable refresh** matters: if it fails for more than a week, live bus badges stop matching until it is fixed (schedules still work).

---

## 12. Demo script and likely questions (5 to 7 minutes)

**Suggested order**
1. **Start page** (30 s): "Five questions give a ranked list of areas." Pick a college and a budget.
2. **Find my area** (60 s): open the top result; show rent with its label (published / carried forward / estimated), then the monthly cost range.
3. **Cost of living** (45 s): change how many people share the home; show Low / Typical / High and override a number.
4. **Compare** (30 s): shortlist three areas; read the plain-language differences.
5. **Commute** (2 min): search a stop (try 786 Leeson Street Lwr, or 2338 Waterville Row), pick a route, show the direction label, live times, the bus dots on the map and the Refresh button. Then Museum to Jervis, and Museum to Dundrum for a change.
6. **Moving to Dublin** (45 s): the checklist and scam checker.
7. **Close** (30 s): "Every number shows its source and how sure we are."

**Likely questions**
- *Where does rent come from?* The RTB's official rent data through the CSO, not listing sites.
- *Is it live?* Rent and area journeys are scheduled. The Commute page is live from the NTA (buses), TII (Luas) and Irish Rail (trains).
- *How accurate are the live bus times?* They come from the NTA's real-time system built on bus GPS units. We match each bus to its own scheduled trip and say when a time is estimated.
- *Do you store my data?* No tracking. Settings stay in your browser. Accounts are optional.
- *What does it cost?* The data is open. Running costs are small and capped.
- *What about students who share a bedroom?* You choose how many people share the home and how rooms are divided.

---

## 13. Glossary

- **GTFS:** the standard file format for public-transport timetables. **GTFS-Realtime:** the live companion feed (delays, positions).
- **Trip ID:** the unique code for one scheduled run of a bus; the link between timetable and live feed.
- **RTB:** the Residential Tenancies Board, which publishes rent data. **CSO:** the Central Statistics Office, which hosts it. **NTA:** the National Transport Authority. **TII:** Transport Infrastructure Ireland (runs Luas forecasts).
- **IRP:** Irish Residence Permit. **Stamp 2:** the immigration permission for many non-EEA students.
- **BER:** Building Energy Rating, A1 (efficient) to G.
- **RAPTOR:** a journey-planning method that finds the fastest trip using one vehicle, then two, then three.
- **OSRM, Nominatim, Overpass:** open services built on OpenStreetMap data (routing, address search, map queries).

---

## 14. Source links

- RTB Rent Index and reports: https://www.rtb.ie
- CSO PxStat (table RIQ02): https://data.cso.ie
- NTA GTFS static: https://www.transportforireland.ie/transitData/PT_Data.html
- NTA developer portal (GTFS-Realtime): https://developer.nationaltransport.ie
- Luas forecasting (TII): https://luasforecasts.rpa.ie
- Irish Rail Realtime API: http://api.irishrail.ie/realtime/
- OpenStreetMap: https://www.openstreetmap.org (ODbL); OpenFreeMap: https://openfreemap.org; OSRM (FOSSGIS): https://routing.openstreetmap.de
- Minimum wage (Ibec): https://www.ibec.ie
- SEAI energy ratings: https://www.seai.ie/home-energy/building-energy-rating-ber/
- Deposits and tenancy rules (RTB): https://www.rtb.ie
- Wider project notes: `docs/PROJECT.md`, `docs/METHOD.md`
