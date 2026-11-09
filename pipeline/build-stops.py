"""Build a stop-number lookup for Dublin Bus: the number printed on a physical stop, the routes
serving it, each route's stop sequence, and scheduled departure times for one typical weekday
(the same service day used for the commute network), from NTA GTFS (CC BY 4.0).

A real stop_code (the printed pole number) is distinct from the internal stop_id. Several stop_ids
can share one stop_code (e.g. both directions of the road), so lookup is by stop_code but routes
and schedules are tracked per stop_id.

Output: data/build/stops.json
  { date, stops: { stopId: [code, name, lat, lon] },
    byCode: { code: [stopId, ...] },
    routes: { routeId: [shortName, longName, mode] },
    stopRoutes: { stopId: [[routeId, directionId], ...] },
    shapes: { "routeId:directionId": [stopId, ...] },                  # one representative pattern
    departures: { "stopId:routeId:directionId": [minutesAfterMidnight, ...] } }
"""
import sys, json, zipfile, datetime as dt
import pandas as pd

RAW, OUT = 'data/raw/gtfs/GTFS_Dublin_Bus.zip', 'data/build/stops.json'

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

day = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else next_wednesday()
print('service date', day, day.strftime('%A'))
z = zipfile.ZipFile(RAW)
svc = active_services(z, day)

stops = pd.read_csv(z.open('stops.txt'), dtype=str, usecols=['stop_id', 'stop_code', 'stop_name', 'stop_lat', 'stop_lon'])
trips = pd.read_csv(z.open('trips.txt'), dtype=str, usecols=['route_id', 'service_id', 'trip_id', 'direction_id'])
trips = trips[trips.service_id.isin(svc)]
routes = pd.read_csv(z.open('routes.txt'), dtype=str, usecols=['route_id', 'route_short_name', 'route_long_name', 'route_type'])
mode_of = {'0': 'tram', '1': 'rail', '2': 'rail', '3': 'bus'}
routes_out = {r.route_id: [r.route_short_name, r.route_long_name, mode_of.get(str(r.route_type), 'bus')] for r in routes.itertuples()}

want_trips = set(trips.trip_id)
trip_meta = trips.set_index('trip_id')[['route_id', 'direction_id']].to_dict('index')

stop_routes, shapes, best_len, departures = {}, {}, {}, {}
for chunk in pd.read_csv(z.open('stop_times.txt'), dtype={'trip_id': str, 'stop_id': str}, usecols=['trip_id', 'departure_time', 'stop_id', 'stop_sequence'], chunksize=1_500_000):
    chunk = chunk[chunk.trip_id.isin(want_trips)]
    if chunk.empty: continue
    chunk = chunk.sort_values(['trip_id', 'stop_sequence'])
    chunk['dep'] = secs(chunk.departure_time)
    for trip_id, g in chunk.groupby('trip_id', sort=False):
        meta = trip_meta.get(trip_id)
        if not meta: continue
        rid, did = meta['route_id'], meta['direction_id'] or '0'
        shape_key = f'{rid}:{did}'
        seq = g.stop_id.tolist()
        if len(seq) > best_len.get(shape_key, 0):
            shapes[shape_key] = seq; best_len[shape_key] = len(seq)
        for stop_id, dep in zip(g.stop_id, g.dep):
            stop_routes.setdefault(stop_id, set()).add((rid, did))
            departures.setdefault(f'{stop_id}:{rid}:{did}', []).append(int(dep) // 60)

for k in departures: departures[k] = sorted(set(departures[k]))

used_stops = set(stop_routes)
stops = stops[stops.stop_id.isin(used_stops)]
stops_out, by_code = {}, {}
for s in stops.itertuples():
    stops_out[s.stop_id] = [s.stop_code or '', s.stop_name, round(float(s.stop_lat), 5), round(float(s.stop_lon), 5)]
    if s.stop_code: by_code.setdefault(s.stop_code, []).append(s.stop_id)

used_routes = {rid for pairs in stop_routes.values() for rid, _ in pairs}
routes_out = {rid: v for rid, v in routes_out.items() if rid in used_routes}

out = {
    'date': day.isoformat(),
    'source': 'National Transport Authority GTFS (Dublin Bus), CC BY 4.0',
    'stops': stops_out,
    'byCode': by_code,
    'routes': routes_out,
    'stopRoutes': {k: sorted(v) for k, v in stop_routes.items()},
    'shapes': shapes,
    'departures': departures,
}
import os; os.makedirs('data/build', exist_ok=True)
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print('stops', len(stops_out), 'with code', len(by_code), 'routes', len(routes_out), 'shapes', len(shapes), 'departure lists', len(departures))
