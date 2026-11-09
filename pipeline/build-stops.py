"""Build a stop lookup across Dublin Bus, Go-Ahead, Bus Eireann, Luas and Irish Rail: the number
printed on a physical bus stop (or, for Luas/DART, the station name, since those don't have a
printed pole number), the routes serving it, each route's stop sequence, and scheduled departure
times for one typical weekday (the same service day used for the commute network), from NTA GTFS
(CC BY 4.0).

Dublin Bus and Go-Ahead share the same stop_id for a shared physical stop (confirmed against the
raw feeds: identical stop_id, name and coordinates for 1,407 stops), so stops merge directly by
stop_id with no renamespacing needed. Luas and Irish Rail use a distinct stop_id scheme, so no
collision risk there either. Bus Eireann and Irish Rail stops are filtered to the Dublin commuter
area (BBOX) since their feeds cover the whole country.

Output:
  data/build/stops.json
    { date, stops: { stopId: [code, name, lat, lon, mode] },
      byCode: { code: [stopId, ...] },         # printed stop number -> internal id(s); bus only
      routes: { routeId: [shortName, longName, mode] },
      stopRoutes: { stopId: [[routeId, directionId], ...] },
      shapes: { "routeId:directionId": [stopId, ...] },                # one representative pattern
      departures: { "stopId:routeId:directionId": [minutesAfterMidnight, ...] } }
  data/build/stop-paths.json
    { "routeId:directionId": [[lat, lon], ...] }   # road-following geometry (simplified), loaded
                                                    # only when a route's map is actually shown
"""
import sys, json, zipfile, datetime as dt
import pandas as pd
sys.setrecursionlimit(5000)

BBOX = (53.10, 53.55, -6.60, -5.90)   # lat min/max, lon min/max: Dublin commuter area
FEEDS = [('Dublin_Bus', 'bus', True), ('GoAhead', 'bus', True), ('Bus_Eireann', 'bus', False), ('LUAS', 'tram', False), ('Irish_Rail', 'rail', False)]
# (feed file, mode, national feed needing a bbox filter)
OUT = 'data/build/stops.json'

def next_wednesday(today=None):
    d = (today or dt.date.today()) + dt.timedelta(days=1)
    while d.weekday() != 2: d += dt.timedelta(days=1)
    return d

def secs(col):
    p = col.str.split(':', expand=True).astype('int64')
    return p[0] * 3600 + p[1] * 60 + p[2]

def active_services(z, day):
    ymd = int(day.strftime('%Y%m%d')); col = day.strftime('%A').lower()
    cal = pd.read_csv(z.open('calendar.txt'), dtype=str)
    ok = cal[(cal[col] == '1') & (cal.start_date.astype(int) <= ymd) & (cal.end_date.astype(int) >= ymd)].service_id
    svc = set(ok)
    if 'calendar_dates.txt' in z.namelist():
        cd = pd.read_csv(z.open('calendar_dates.txt'), dtype=str)
        cd = cd[cd.date.astype(int) == ymd]
        svc |= set(cd[cd.exception_type == '1'].service_id); svc -= set(cd[cd.exception_type == '2'].service_id)
    return svc

def rdp(pts, eps=0.00006):
    """Ramer-Douglas-Peucker line simplification (eps in degrees, ~6m), so a 500+ point GTFS
    shape becomes a few dozen points without losing the road-following shape on a city map."""
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = (dx * dx + dy * dy) ** 0.5 or 1e-9
    best_i, best_d = 0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
        if d > best_d: best_i, best_d = i, d
    if best_d > eps:
        left = rdp(pts[:best_i + 1], eps); right = rdp(pts[best_i:], eps)
        return left[:-1] + right
    return [pts[0], pts[-1]]

day = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else next_wednesday()
print('service date', day, day.strftime('%A'))

stops_out, by_code, routes_out, stop_routes, shapes, paths, best_len, shape_for, departures = {}, {}, {}, {}, {}, {}, {}, {}, {}

for feed_name, mode, needs_bbox in FEEDS:
    z = zipfile.ZipFile(f'data/raw/gtfs/GTFS_{feed_name}.zip')
    svc = active_services(z, day)
    stops = pd.read_csv(z.open('stops.txt'), dtype=str, usecols=['stop_id', 'stop_code', 'stop_name', 'stop_lat', 'stop_lon'])
    if needs_bbox:
        stops = stops[stops.stop_lat.astype(float).between(BBOX[0], BBOX[1]) & stops.stop_lon.astype(float).between(BBOX[2], BBOX[3])]
    in_box = set(stops.stop_id)

    has_shapes = 'shapes.txt' in z.namelist()
    trip_cols = ['route_id', 'service_id', 'trip_id', 'direction_id'] + (['shape_id'] if has_shapes else [])
    trips = pd.read_csv(z.open('trips.txt'), dtype=str, usecols=trip_cols)
    trips = trips[trips.service_id.isin(svc)]
    routes = pd.read_csv(z.open('routes.txt'), dtype=str, usecols=['route_id', 'route_short_name', 'route_long_name', 'route_type'])
    mode_of = {'0': 'tram', '1': 'rail', '2': 'rail', '3': 'bus'}
    for r in routes.itertuples():
        routes_out[r.route_id] = [r.route_short_name or mode.upper(), r.route_long_name, mode_of.get(str(r.route_type), mode)]

    want_trips = set(trips.trip_id)
    trip_meta = trips.set_index('trip_id')[['route_id', 'direction_id'] + (['shape_id'] if has_shapes else [])].to_dict('index')

    n_conn, feed_routes = 0, set()
    for chunk in pd.read_csv(z.open('stop_times.txt'), dtype={'trip_id': str, 'stop_id': str}, usecols=['trip_id', 'departure_time', 'stop_id', 'stop_sequence'], chunksize=1_500_000):
        chunk = chunk[chunk.trip_id.isin(want_trips) & chunk.stop_id.isin(in_box)]
        if chunk.empty: continue
        chunk = chunk.sort_values(['trip_id', 'stop_sequence'])
        chunk['dep'] = secs(chunk.departure_time)
        for trip_id, g in chunk.groupby('trip_id', sort=False):
            meta = trip_meta.get(trip_id)
            if not meta: continue
            rid, did = meta['route_id'], meta['direction_id'] or '0'
            feed_routes.add(rid)
            shape_key = f'{rid}:{did}'
            seq = g.stop_id.tolist()
            if len(seq) > best_len.get(shape_key, 0):
                shapes[shape_key] = seq; best_len[shape_key] = len(seq)
                if has_shapes and meta.get('shape_id'): shape_for[shape_key] = (feed_name, meta['shape_id'])
            for stop_id, dep in zip(g.stop_id, g.dep):
                stop_routes.setdefault(stop_id, set()).add((rid, did))
                departures.setdefault(f'{stop_id}:{rid}:{did}', []).append(int(dep) // 60)
            n_conn += len(g)

    if has_shapes:
        want_shape_ids = {sid for (fn, sid) in shape_for.values() if fn == feed_name}
        if want_shape_ids:
            sh = pd.read_csv(z.open('shapes.txt'), dtype=str, usecols=['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence'])
            sh = sh[sh.shape_id.isin(want_shape_ids)]
            sh['seq'] = sh.shape_pt_sequence.astype(int)
            sh = sh.sort_values(['shape_id', 'seq'])
            for sid, g in sh.groupby('shape_id', sort=False):
                pts = rdp([[round(float(a), 5), round(float(b), 5)] for a, b in zip(g.shape_pt_lat, g.shape_pt_lon)])
                for key, (fn, s) in shape_for.items():
                    if fn == feed_name and s == sid: paths[key] = pts

    used = {s for s in stop_routes if s in in_box}
    these_stops = stops[stops.stop_id.isin(used)]
    for s in these_stops.itertuples():
        if s.stop_id not in stops_out:
            stops_out[s.stop_id] = [s.stop_code or '', s.stop_name, round(float(s.stop_lat), 5), round(float(s.stop_lon), 5), mode]
        if s.stop_code and mode == 'bus':
            by_code.setdefault(s.stop_code, [])
            if s.stop_id not in by_code[s.stop_code]: by_code[s.stop_code].append(s.stop_id)
    print(feed_name, 'active services', len(svc), 'trips', len(want_trips), 'connections', n_conn, 'routes', len(feed_routes), flush=True)

for k in departures: departures[k] = sorted(set(departures[k]))
used_routes = {rid for pairs in stop_routes.values() for rid, _ in pairs}
routes_out = {rid: v for rid, v in routes_out.items() if rid in used_routes}
stop_routes = {k: v for k, v in stop_routes.items() if k in stops_out}

out = {
    'date': day.isoformat(),
    'source': 'National Transport Authority GTFS (Dublin Bus, Go-Ahead, Bus Éireann, Luas, Irish Rail), CC BY 4.0',
    'stops': stops_out,
    'byCode': by_code,
    'routes': routes_out,
    'stopRoutes': {k: sorted(v) for k, v in stop_routes.items()},
    'shapes': shapes,
    'departures': departures,
}
import os; os.makedirs('data/build', exist_ok=True)
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
json.dump(paths, open('data/build/stop-paths.json', 'w'), separators=(',', ':'))
print('stops', len(stops_out), 'with code', len(by_code), 'routes', len(routes_out), 'shapes', len(shapes), 'paths', len(paths), 'departure lists', len(departures))
