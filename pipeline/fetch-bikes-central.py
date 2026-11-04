"""Second pass for central Dublin, where one tile hit Nominatim's 40-result cap: 5x5 sub-tiles. Output data/raw/bikes_central.json.
Run after fetch-enrich.py (shares the 1 request per 1.3 s politeness limit)."""
import json, time, urllib.request, urllib.parse
UA = 'WhichDublin/0.1 (student research prototype; github.com/Kabir192003/whichdublin)'
# bike:2:2 in fetch-enrich.py: rows of 0.06 deg lat from 53.22, columns of 0.08 deg lon from -6.45
S, N, W, E = 53.22 + 2 * 0.06, 53.22 + 3 * 0.06, -6.45 + 2 * 0.08, -6.45 + 3 * 0.08
R = 5; out = {}
for i in range(R):
    for j in range(R):
        w, n, e, s = W + j * (E - W) / R, S + (i + 1) * (N - S) / R, W + (j + 1) * (E - W) / R, S + i * (N - S) / R
        p = {'q': 'bicycle rental', 'format': 'jsonv2', 'limit': 40, 'viewbox': f'{w},{n},{e},{s}', 'bounded': 1, 'countrycodes': 'ie', 'extratags': 1}
        for attempt in range(5):
            try:
                res = json.load(urllib.request.urlopen(urllib.request.Request('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(p), headers={'User-Agent': UA}), timeout=40)); break
            except Exception: time.sleep(15 * (attempt + 1)); res = []
        for r in res:
            if r.get('type') != 'bicycle_rental': continue
            x = r.get('extratags') or {}
            out[f"{r['osm_type']}/{r['osm_id']}"] = {'osm': f"{r['osm_type']}/{r['osm_id']}", 'name': r.get('name') or '', 'lat': round(float(r['lat']), 5), 'lon': round(float(r['lon']), 5), 'operator': x.get('operator', ''), 'brand': x.get('brand', ''), 'capacity': x.get('capacity', ''), 'capped': len(res) >= 40}
        time.sleep(1.3)
json.dump({'docks': list(out.values())}, open('data/raw/bikes_central.json', 'w'), indent=1)
print('central docks', len(out), 'capped', sum(1 for v in out.values() if v['capped']))
