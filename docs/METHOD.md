# Method

See the in-app page ("How we know this", `src/components/Method.jsx`) for the user-facing text. Technical details:

- **Routing**: Connection Scan Algorithm over NTA GTFS for one service day; access/egress walk up to 800 m, transfers up to 300 m, walking 1.25 m/s, straight-line x 1.3. Median over 13 departures (07:30 to 08:30, every 5 min).
- **Rent**: RTB average rent per named area for bedrooms (all/1/2/3/4+) and type (any/apartment). Confidence from populated cells and age.
- **Ranking**: eligible areas (within budget) scored 0..1 per criterion relative to each other, weighted sum.
- **Validation**: `pipeline/validate.js` fails the build on missing provenance or implausible values.
