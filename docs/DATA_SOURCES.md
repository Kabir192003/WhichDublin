# Data sources (week-1 verification log)

Rule from the plan: every number shown carries its source, its date and a confidence level; if a source can't be used, the indicator is dropped and the site says so.

**Status of this log:** the build environment blocks all of these hosts, so *nothing below has been verified yet*. The "expected" columns are what the plan and general knowledge say; each row must be confirmed by running `npm run data:fetch` on a machine with open network access and recording the result in the "Verified" column.

| ID | Need | Source | Expected licence | Expected granularity | Verified (date, by whom, result) |
| --- | --- | --- | --- | --- | --- |
| S1 | Rent by area | RTB Rent Index, also as CSO tables (CSO PxStat `RIQ` series) | Open data, attribution (check) | Dublin postal districts or electoral areas? **Must confirm.** New tenancies, by property type | not yet |
| S2 | Scheduled commute | NTA / Transport for Ireland GTFS static (`transportforireland.ie/transitData`) | Open, attribution (check) | Stops, routes, timetables for Dublin Bus, Luas, DART, Irish Rail, Go-Ahead | not yet |
| S3 | Reliability | NTA GTFS-Realtime trip updates (needs a free API key from the NTA developer portal) | Check terms | Per trip, per stop, live | not yet |
| S4 | District boundaries | CSO / Tailte Éireann boundary data, or OpenStreetMap postal-district relations | CSO: CC BY 4.0 (check). OSM: ODbL | Check: is there an official Dublin postal-district layer? | not yet |
| S5 | Campus locations | Public addresses, geocoded with OpenStreetMap (Nominatim) | ODbL | Point | not yet (coordinates in `data/campuses.json` are approximate) |

## Explicitly not used
- Listing sites (Daft, Rent.ie, Facebook groups): scraping is out of scope in the plan (terms of service and legal risk). Rent comes from RTB tenancy data only.
- Crime or safety scores: data isn't granular or reliable enough.

## What would change the plan
- If S1 is by electoral area rather than postal district, a documented mapping from area to district is needed and every rent figure is labelled approximate.
- If S3 is unusable, reliability is dropped and the site says "scheduled times only".
