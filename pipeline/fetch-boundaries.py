"""Fetch Dublin postal-district boundaries from OpenStreetMap via Nominatim (ODbL).
One request per 1.2 s, per the Nominatim usage policy. Output: data/raw/districts.geojson"""
import json, time, urllib.request, urllib.parse, sys

UA = 'WhichDublin/0.1 (student research prototype; github.com/Kabir192003/whichdublin)'
DISTRICTS = ['1','2','3','4','5','6','6W','7','8','9','10','11','12','13','14','15','16','17','18','20','22','24']

def get(params):
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)

features = []
for d in DISTRICTS:
    name = f'Dublin {d}'
    res = get({'q': name, 'countrycodes': 'ie', 'format': 'jsonv2', 'limit': 5, 'polygon_geojson': 1, 'polygon_threshold': 0.0003})
    hit = next((r for r in res if r.get('type') == 'postal_district' and r.get('name', '').replace(' ', '') == name.replace(' ', '')), None)
    if not hit:
        hit = next((r for r in res if r.get('type') == 'postal_district'), None)
    if not hit:
        print('MISSING', name, file=sys.stderr)
    else:
        features.append({'type': 'Feature', 'properties': {'id': 'D' + d, 'name': name, 'osm': f"{hit['osm_type']}/{hit['osm_id']}"}, 'geometry': hit['geojson']})
        print('ok', name, hit['osm_type'], hit['osm_id'], hit['geojson']['type'])
    time.sleep(1.2)

json.dump({'type': 'FeatureCollection', 'features': features,
           '_source': 'OpenStreetMap contributors via Nominatim, ODbL 1.0', '_fetched': time.strftime('%Y-%m-%d')},
          open('data/raw/districts.geojson', 'w'))
print('features', len(features))
