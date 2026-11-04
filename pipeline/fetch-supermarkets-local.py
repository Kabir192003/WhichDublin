"""Gap-fill: for each area, ask Nominatim for Lidl/Aldi/Tesco in a ~3 km box around it. Catches stores the tile pass missed.
Output: data/raw/supermarkets_local.json (same shape as supermarkets.json). 1 request per 1.2 s."""
import json, time, urllib.request, urllib.parse, sys
UA = 'WhichDublin/0.1 (student research prototype; github.com/Kabir192003/whichdublin)'
geo = json.load(open('data/build/areas_geo.json'))['items']
known = {s['osm'] for s in json.load(open('data/raw/supermarkets.json'))['stores']}
out, seen = [], set(known)
def search(q, lat, lon, d=0.03):
    p = {'q': q, 'format': 'jsonv2', 'limit': 40, 'viewbox': f'{lon-d*1.6},{lat+d},{lon+d*1.6},{lat-d}', 'bounded': 1, 'countrycodes': 'ie', 'extratags': 1}
    req = urllib.request.Request('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(p), headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=40) as r: return json.load(r)
n = 0
for aid, g in geo.items():
    for brand in ('Lidl', 'Aldi', 'Tesco'):
        try: res = search(brand, g['lat'], g['lon'])
        except Exception as ex:
            time.sleep(4)
            try: res = search(brand, g['lat'], g['lon'])
            except Exception as ex2: print('FAILED', aid, brand, ex2, file=sys.stderr); continue
        for r in res:
            key = f"{r['osm_type']}/{r['osm_id']}"; name = r.get('name') or ''
            if key in seen or not name.lower().startswith(brand.lower()): continue
            if r.get('category') != 'shop' and r.get('type') not in ('supermarket', 'convenience', 'department_store'): continue
            seen.add(key)
            out.append({'brand': brand, 'name': name, 'lat': round(float(r['lat']), 5), 'lon': round(float(r['lon']), 5), 'type': r.get('type'), 'osm': key, 'opening_hours': (r.get('extratags') or {}).get('opening_hours')})
        time.sleep(1.2)
    n += 1
    if n % 10 == 0: print(n, 'areas, new stores', len(out), flush=True)
json.dump({'source': 'OpenStreetMap contributors via Nominatim, ODbL 1.0', 'fetched': time.strftime('%Y-%m-%d'), 'stores': out}, open('data/raw/supermarkets_local.json', 'w'), indent=1)
print('new stores', len(out))
