# Settld's own OpenStreetMap building archive

`public/data/dublin-buildings.pmtiles` is the sole local building map file. It is a PMTiles v3 archive with gzip-compressed vector data at zooms 14–16 (8,192-unit geometry extent; approximately 4.4 cm ground resolution at zoom 16 in Dublin). It is fetched on demand using HTTP Range requests, not downloaded in full at page load. The app's existing OpenFreeMap roads, water and labels remain intact. MapLibre renders the original mapped building footprints and parts; tagged roof shapes are rendered as local roof meshes at close zooms. No Google Maps, LiDAR-derived terrain buildings, third-party city-model meshes or inferred photographic façade details are used.

Source: [Geofabrik Ireland and Northern Ireland raw OSM data](https://download.geofabrik.de/europe/ireland-and-northern-ireland.html), data timestamp 2026-11-18 21:21:02 UTC. Coverage spans -6.65 to -5.95 longitude and 53.10 to 53.66 latitude (the Dublin region including all 106 Settld areas, not only the city centre). 679,451 source building polygons/multipolygons, including 3,489 building parts, after exact duplicate removal. All 16,056 nonempty tiles total 66.09 MiB. Original building outlines, tags, IDs, holes, building parts and the derived remaining footprint are retained. Raw building-related tags, including roof shape, roof direction, levels, material and color, are included in the vector features.

The building database is derived from OpenStreetMap and licensed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). The archive is itself the accessible derived database; its metadata records the source, date, attribution and license. The Settld code is separately licensed MIT.

## Height logic

1. Explicit OSM `height` (including meters or feet) takes priority.
2. OSM `building:levels`, building type-specific floor height and mapped roof height/levels.
3. A part without its own height can inherit the outline's mapped height or levels.
4. Otherwise estimate by use, actual footprint area and distance to central Dublin: houses normally 2 levels, apartments typically 3–5, offices and commercial buildings 3–5, and small outbuildings 1. Unknown buildings tend taller in the city centre than in suburbs. `min_height` and `building:min_level` create genuinely elevated parts.

Height provenance is stored as `osm_height`, `osm_levels`, `parent_height` or `estimated`. Estimated heights and roof dimensions are illustrative, not a measurement. A building with no explicitly mapped roof shape remains a flat extrusion; no fabricated shape is assigned. The Campanile has a 30.5m outline (way 44075420) and nine separately mapped parts, including its four piers and raised domed sections; the outline is archived but suppressed for rendering where its parts cover it. Its shape is derived from mapped features, not a manually sculpted replacement. Mapped `building:colour` and `roof:colour` are retained in the archive, and tinted towards the app's neutral palette for a readable map.

## Rebuild

Download the current `.osm.pbf` from Geofabrik (or the Dublin BBBike PBF when a smaller boundary is sufficient). Use Python 3.11+:

```sh
pip install osmium shapely numpy mercantile mapbox-vector-tile pmtiles
python pipeline/make-osm-buildings.py ireland-and-northern-ireland-latest.osm.pbf
```

The generator writes the archive and `src/domain/osm-buildings-data.json` with per-source counts, bounds and exact byte size. No running map tile server is required. Do not deploy or commit an archive until the size, attribution, source coverage and map rendering are verified.
