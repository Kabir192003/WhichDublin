"""Route id -> [short name, operator, mode] from the NTA GTFS zips, so live delays can be shown as "39A", "Luas Green".
Output: server/routes.json (bundled with the API functions)."""
import csv, io, json, zipfile, glob
OPS = {'1': 'Dublin Bus', '2': 'Bus Éireann', '03C': 'Go-Ahead Ireland', 'IR': 'Irish Rail', '10000': 'Luas'}
MODE = {'0': 'tram', '2': 'rail', '3': 'bus'}
out = {}
for z in glob.glob('data/raw/gtfs/*.zip'):
    with zipfile.ZipFile(z) as f:
        for r in csv.DictReader(io.TextIOWrapper(f.open('routes.txt'), 'utf-8-sig')):
            out[r['route_id']] = [r['route_short_name'] or r['route_long_name'], OPS.get(r['agency_id'], r['agency_id']), MODE.get(r['route_type'], 'other')]
json.dump(out, open('server/routes.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('routes', len(out))
