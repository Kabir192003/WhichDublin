"""Build the scheduled-transit network for one typical weekday morning from the NTA GTFS feeds (CC BY 4.0).

Output (data/build/):  network.json  { date, stops:[[id,lat,lon]], conn:{dep,arr,from,to,trip} (parallel arrays), routes }
Only Dublin-area stops are kept, and only connections departing between WINDOW_START and WINDOW_END.
Usage: python3 pipeline/build-network.py [YYYY-MM-DD]   (default: the next Wednesday)
"""
import sys, json, zipfile, io, datetime as dt
import pandas as pd

FEEDS = ['Dublin_Bus', 'GoAhead', 'LUAS', 'Irish_Rail']
BBOX = (53.20, 53.47, -6.52, -6.00)           # lat min/max, lon min/max
# usage: build-network.py [YYYY-MM-DD] [HH:MM-HH:MM] [name]   default: next Wednesday, 06:30-11:00, network.json
_win = sys.argv[2] if len(sys.argv) > 2 else '06:30-11:00'
_h = lambda t: int(t.split(':')[0]) * 3600 + int(t.split(':')[1]) * 60
WINDOW_START, WINDOW_END = (_h(x) for x in _win.split('-'))   # times past midnight are written 25:00 etc, as in GTFS
NAME = sys.argv[3] if len(sys.argv) > 3 else 'network'
RAW, OUT = 'data/raw/gtfs/', 'data/build/'

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
stops_out, trips_seen = {}, 0
cols = {k: [] for k in ('dep', 'arr', 'from', 'to', 'trip')}
routes_out = {}
stop_index, trip_index = {}, {}

for feed in FEEDS:
    z = zipfile.ZipFile(f'{RAW}GTFS_{feed}.zip')
    svc = active_services(z, day)
    stops = pd.read_csv(z.open('stops.txt'), dtype={'stop_id': str}, usecols=['stop_id', 'stop_lat', 'stop_lon', 'stop_name'])
    stops = stops[stops.stop_lat.between(BBOX[0], BBOX[1]) & stops.stop_lon.between(BBOX[2], BBOX[3])]
    in_box = set(stops.stop_id)
    trips = pd.read_csv(z.open('trips.txt'), dtype=str, usecols=['route_id', 'service_id', 'trip_id'])
    trips = trips[trips.service_id.isin(svc)]
    routes = pd.read_csv(z.open('routes.txt'), dtype=str, usecols=['route_id', 'route_short_name', 'route_type'])
    rmap = trips.merge(routes, on='route_id').set_index('trip_id')[['route_short_name', 'route_type']]
    want = set(trips.trip_id)
    n_conn = 0
    for chunk in pd.read_csv(z.open('stop_times.txt'), dtype={'trip_id': str, 'stop_id': str}, usecols=['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'], chunksize=1_500_000):
        chunk = chunk[chunk.trip_id.isin(want)]
        if chunk.empty: continue
        chunk = chunk.sort_values(['trip_id', 'stop_sequence'])
        chunk['dep'] = secs(chunk.departure_time); chunk['arr'] = secs(chunk.arrival_time)
        nxt = chunk.groupby('trip_id').shift(-1)
        c = pd.DataFrame({'trip': chunk.trip_id, 'dep': chunk.dep, 'from': chunk.stop_id, 'arr': nxt.arr, 'to': nxt.stop_id}).dropna()
        c = c[c['from'].isin(in_box) & c['to'].isin(in_box) & c.dep.between(WINDOW_START, WINDOW_END)]
        for t in c.trip.unique(): routes_out.setdefault(f'{feed}:{t}', None)
        for _, r in c.iterrows() if False else []: pass
        key = lambda s: f'{feed}:{s}'
        for s in pd.unique(pd.concat([c['from'], c['to']])): stop_index.setdefault(key(s), len(stop_index))
        for t in c.trip.unique(): trip_index.setdefault(key(t), len(trip_index))
        cols['dep'] += c.dep.astype(int).tolist(); cols['arr'] += c.arr.astype(int).tolist()
        cols['from'] += [stop_index[key(s)] for s in c['from']]; cols['to'] += [stop_index[key(s)] for s in c['to']]
        cols['trip'] += [trip_index[key(t)] for t in c.trip]
        n_conn += len(c)
    for _, s in stops.iterrows():
        k = f'{feed}:{s.stop_id}'
        if k in stop_index: stops_out[stop_index[k]] = [round(float(s.stop_lat), 5), round(float(s.stop_lon), 5), s.stop_name]
    mode = {'0': 'tram', '1': 'rail', '2': 'rail', '3': 'bus'}
    for t, row in rmap.iterrows():
        k = f'{feed}:{t}'
        if k in trip_index: routes_out[trip_index[k]] = [row.route_short_name, mode.get(str(row.route_type), 'other')]
    print(feed, 'active services', len(svc), 'trips', len(want), 'connections', n_conn, flush=True)

order = sorted(range(len(cols['dep'])), key=lambda i: cols['dep'][i])
conn = {k: [v[i] for i in order] for k, v in cols.items()}
import os; os.makedirs(OUT, exist_ok=True)
stops_list = [stops_out.get(i, [0, 0, '']) for i in range(len(stop_index))]
route_list = [routes_out.get(i) if isinstance(routes_out.get(i), list) else ['?', 'other'] for i in range(len(trip_index))]
json.dump({'date': day.isoformat(), 'window': [WINDOW_START, WINDOW_END], 'source': 'National Transport Authority GTFS, CC BY 4.0', 'stops': stops_list, 'conn': conn, 'tripRoute': route_list}, open(OUT + NAME + '.json', 'w'), separators=(',', ':'))
print('stops', len(stops_list), 'connections', len(order), 'trips', len(trip_index))
