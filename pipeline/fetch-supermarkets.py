"""Lidl, Aldi and Tesco locations across Dublin from OpenStreetMap via Nominatim (ODbL).
Dublin is split into tiles so the 40-result cap per query never hides a store. 1 request per 1.2 s.
Output: data/raw/supermarkets.json"""
import json, time, urllib.request, urllib.parse, sys

UA = 'WhichDublin/0.1 (student research prototype; github.com/Kabir192003/whichdublin)'
S, N, W, E = 53.22, 53.46, -6.45, -6.05           # Dublin city and suburbs
ROWS, COLS = 6, 8
BRANDS = {'Lidl': 'Lidl', 'Aldi': 'Aldi', 'Tesco': 'Tesco'}

def search(q, box):
    w, n, e, s = box
    p = {'q': q, 'format': 'jsonv2', 'limit': 40, 'viewbox': f'{w},{n},{e},{s}', 'bounded': 1, 'countrycodes': 'ie', 'addressdetails': 0, 'extratags': 1}
    req = urllib.request.Request('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(p), headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)

seen, out, capped = {}, [], []
dlat, dlon = (N - S) / ROWS, (E - W) / COLS
for brand, q in BRANDS.items():
    for i in range(ROWS):
        for j in range(COLS):
            box = (W + j * dlon, S + (i + 1) * dlat, W + (j + 1) * dlon, S + i * dlat)
            try:
                res = search(q, box)
            except Exception as ex:
                print('retry', brand, i, j, ex, file=sys.stderr); time.sleep(3)
                try: res = search(q, box)
                except Exception as ex2: print('FAILED', brand, i, j, ex2, file=sys.stderr); continue
            if len(res) >= 40: capped.append((brand, i, j))
            for r in res:
                key = (r['osm_type'], r['osm_id'])
                name = (r.get('name') or '')
                if key in seen or not name.lower().startswith(brand.lower()): continue
                if r.get('category') != 'shop' and r.get('type') not in ('supermarket', 'convenience', 'department_store'): continue
                seen[key] = 1
                out.append({'brand': brand, 'name': name, 'lat': round(float(r['lat']), 5), 'lon': round(float(r['lon']), 5),
                            'type': r.get('type'), 'osm': f"{r['osm_type']}/{r['osm_id']}", 'opening_hours': (r.get('extratags') or {}).get('opening_hours')})
            time.sleep(1.2)
    print(brand, sum(1 for o in out if o['brand'] == brand), flush=True)

json.dump({'source': 'OpenStreetMap contributors via Nominatim, ODbL 1.0', 'fetched': time.strftime('%Y-%m-%d'), 'bbox': [S, W, N, E], 'cappedTiles': capped, 'stores': out},
          open('data/raw/supermarkets.json', 'w'), indent=1)
print('total', len(out), 'capped tiles', len(capped))
