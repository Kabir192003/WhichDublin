# Which Dublin

Compare Dublin areas for renting near your college: **rent per person**, **door-to-campus commute**, and the **nearest Lidl, Aldi and Tesco**. Every number shows its source, date and a confidence label. No accounts, no cookies, no listing-site scraping.

Also: part-time work (pay, weekly hour limits, employer counts by area), Dublinbikes as a travel mode, and a Settling-in guide (IRP, Leap card, bank account, mobile plan).

Covers 107 named areas and 9 colleges (TCD, UCD, DCU, TU Dublin, RCSI, NCI, DBS, Griffith, IADT).

## Data (all open)

| What | Source | Licence |
| --- | --- | --- |
| Average rent by area, size, type | RTB Average Monthly Rent Report via CSO PxStat (RIQ02) | CC BY 4.0 |
| Bus, Luas, rail timetables | National Transport Authority GTFS | CC BY 4.0 |
| Area positions, campuses, supermarkets | OpenStreetMap via Nominatim | ODbL |
| Area descriptions | Wikipedia | CC BY-SA 4.0 |

See `docs/METHOD.md` for the method and its limits, also shown in the app under "How we know this".

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # domain logic: confidence, ranking, routing
npm run build    # validates the data (fails on impossible values), then builds
```

## Rebuild the data

Needs Python 3 and Node 20. Respects Nominatim's usage policy (1 request per 1.2 s), so a full run takes a while.

```bash
python3 pipeline/fetch-boundaries.py
python3 pipeline/fetch-supermarkets.py
python3 pipeline/build-rent.py
python3 pipeline/build-network.py        # needs the GTFS zip in data/raw/gtfs/
python3 pipeline/geocode-areas.py
python3 pipeline/fetch-enrich.py         # supermarket gap-fill, employer counts, bike docks (resumable, ~40 min)
python3 pipeline/fetch-bikes-central.py  # finer pass for central Dublin docks, then re-run fetch-enrich.py
python3 pipeline/fetch-descriptions.py
node pipeline/compute.js                 # writes public/data/areas.json
node pipeline/validate.js
```

## Known limits

- Rent is a published **average for new tenancies for the whole property**, not a room price. Shared-room rent is that average divided by people.
- Commute is **scheduled**, not live. Reliability needs weeks of real-time data and is not shown yet.
- OpenStreetMap supermarkets may miss new stores.
- Areas outside the commuter belt (north Fingal towns) are not covered.

Deployed to GitHub Pages by `.github/workflows/pages.yml`.
