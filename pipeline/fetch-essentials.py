"""Student essentials near each area and step-free rail/tram stations, from OpenStreetMap via Nominatim (ODbL).
Same politeness as fetch-enrich.py: 1 request / 1.3 s, backs off on 429, resumable cache.
Output: data/raw/essentials.json  { areas: { id: { pharmacy:[...], doctors:[...], library:[...], laundry:[...] } }, stations:[...] }"""
import json, os, time, urllib.request, urllib.parse, urllib.error
UA = 'WhichDublin/0.1 (student research prototype; github.com/Kabir192003/whichdublin)'
CACHE = 'data/raw/essentials_cache.json'
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
geo = json.load(open('data/build/areas_geo.json'))['items']
last = [0.0]
def q(query, box):
    w, n, e, s = box
    p = {'q': query, 'format': 'jsonv2', 'limit': 40, 'viewbox': f'{w},{n},{e},{s}', 'bounded': 1, 'countrycodes': 'ie', 'extratags': 1}
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(p)
    for attempt in range(6):
        time.sleep(max(0, 1.3 - (time.time() - last[0]))); last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40) as r: return json.load(r)
        except urllib.error.HTTPError as ex:
            if ex.code == 429: time.sleep(20 * (attempt + 1)); continue
            raise
        except Exception: time.sleep(5)
    return []
def save(): json.dump(cache, open(CACHE + '.tmp', 'w')); os.replace(CACHE + '.tmp', CACHE)
def slim(r): x = r.get('extratags') or {}; return {'osm': f"{r['osm_type']}/{r['osm_id']}", 'name': r.get('name') or '', 'lat': round(float(r['lat']), 5), 'lon': round(float(r['lon']), 5), 'type': r.get('type'), 'wheelchair': x.get('wheelchair'), 'opening_hours': x.get('opening_hours')}

# stations: tiles over Dublin, rail + tram
S, N, W, E = 53.22, 53.62, -6.50, -6.03
for kind, term in (('rail', 'railway station'), ('tram', 'tram stop')):
    for i in range(5):
        for j in range(5):
            key = f'st:{kind}:{i}:{j}'
            if key in cache: continue
            dl, dn = (N - S) / 5, (E - W) / 5
            cache[key] = [slim(r) | {'kind': kind} for r in q(term, (W + j * dn, S + (i + 1) * dl, W + (j + 1) * dn, S + i * dl)) if r.get('type') in ('station', 'stop', 'tram_stop', 'halt', 'platform')]
            save()
print('stations done', flush=True)

TERMS = {'pharmacy': 'pharmacy', 'doctors': 'doctors', 'library': 'library', 'laundry': 'laundry'}
n = 0
for aid, g in geo.items():
    if g.get('insideDistrict') is False: continue
    d = 0.018   # ~2 km half-height box
    for cat, term in TERMS.items():
        key = f'es:{aid}:{cat}'
        if key in cache: continue
        cache[key] = [slim(r) for r in q(term, (g['lon'] - d * 1.6, g['lat'] + d, g['lon'] + d * 1.6, g['lat'] - d))]
    save(); n += 1
    if n % 10 == 0: print(n, 'areas', flush=True)

out = {'source': 'OpenStreetMap contributors via Nominatim, ODbL 1.0', 'fetched': time.strftime('%Y-%m-%d'), 'areas': {}, 'stations': []}
seen = set()
for k, v in cache.items():
    if k.startswith('st:'):
        for r in v:
            if r['osm'] not in seen: seen.add(r['osm']); out['stations'].append(r)
    elif k.startswith('es:'):
        _, aid, cat = k.split(':')
        out['areas'].setdefault(aid, {})[cat] = v
json.dump(out, open('data/raw/essentials.json', 'w'))
print('done: stations', len(out['stations']), 'areas', len(out['areas']))
