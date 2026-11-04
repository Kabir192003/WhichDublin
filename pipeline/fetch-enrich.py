"""One throttled, resumable Nominatim pass (1 request / 1.3 s, backs off on 429) for everything that needs per-area OSM lookups:
  1. Lidl/Aldi/Tesco gap-fill around each area   -> data/raw/supermarkets_local.json
  2. Employer counts by category within ~1 km     -> data/raw/employers.json   (counts of OSM places, capped at 40 per query)
  3. Bicycle rental docks across Dublin (tiles)   -> data/raw/bikes.json
Progress is saved to data/raw/enrich_cache.json, so a restart resumes where it stopped. ODbL, (c) OpenStreetMap contributors."""
import json, os, sys, time, urllib.request, urllib.parse, urllib.error
UA = 'WhichDublin/0.1 (student research prototype; github.com/Kabir192003/whichdublin)'
CACHE = 'data/raw/enrich_cache.json'
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
geo = json.load(open('data/build/areas_geo.json'))['items']
known = {s['osm'] for s in json.load(open('data/raw/supermarkets.json'))['stores']}
last = [0.0]

def q(query, box):
    w, n, e, s = box
    p = {'q': query, 'format': 'jsonv2', 'limit': 40, 'viewbox': f'{w},{n},{e},{s}', 'bounded': 1, 'countrycodes': 'ie', 'extratags': 1}
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(p)
    for attempt in range(6):
        wait = 1.3 - (time.time() - last[0]); time.sleep(max(0, wait)); last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40) as r: return json.load(r)
        except urllib.error.HTTPError as ex:
            if ex.code == 429: time.sleep(20 * (attempt + 1)); continue
            raise
        except Exception: time.sleep(5)
    raise RuntimeError('gave up: ' + query)

def save():
    json.dump(cache, open(CACHE + '.tmp', 'w')); os.replace(CACHE + '.tmp', CACHE)

def around(g, d): return (g['lon'] - d * 1.6, g['lat'] + d, g['lon'] + d * 1.6, g['lat'] - d)

# ---- 3. bike docks first (small): tiles over Dublin
S, N, W, E = 53.22, 53.46, -6.45, -6.05
for i in range(4):
    for j in range(5):
        key = f'bike:{i}:{j}'
        if key in cache: continue
        dl, dn = (N - S) / 4, (E - W) / 5
        res = q('bicycle rental', (W + j * dn, S + (i + 1) * dl, W + (j + 1) * dn, S + i * dl))
        cache[key] = [{'osm': f"{r['osm_type']}/{r['osm_id']}", 'name': r.get('name') or '', 'lat': round(float(r['lat']), 5), 'lon': round(float(r['lon']), 5),
                       'operator': (r.get('extratags') or {}).get('operator', ''), 'brand': (r.get('extratags') or {}).get('brand', ''), 'capacity': (r.get('extratags') or {}).get('capacity', ''), 'capped': len(res) >= 40} for r in res if r.get('type') == 'bicycle_rental']
        save()
print('bikes done', flush=True)

CATS = {'retail': ['supermarket', 'clothes shop', 'convenience store'], 'food': ['restaurant', 'cafe', 'fast food', 'pub'], 'hotels': ['hotel'], 'leisure': ['gym', 'cinema']}
n = 0
for aid, g in geo.items():
    if g.get('insideDistrict') is False: continue
    for brand in ('Lidl', 'Aldi', 'Tesco'):
        key = f'sm:{aid}:{brand}'
        if key in cache: continue
        res = q(brand, around(g, 0.03))
        cache[key] = [{'brand': brand, 'name': r.get('name') or '', 'lat': round(float(r['lat']), 5), 'lon': round(float(r['lon']), 5), 'type': r.get('type'), 'category': r.get('category'), 'osm': f"{r['osm_type']}/{r['osm_id']}", 'opening_hours': (r.get('extratags') or {}).get('opening_hours')} for r in res]
    for cat, terms in CATS.items():
        for t in terms:
            key = f'job:{aid}:{t}'
            if key in cache: continue
            res = q(t, around(g, 0.009))
            cache[key] = {'n': len(res), 'capped': len(res) >= 40, 'ids': [f"{r['osm_type']}/{r['osm_id']}" for r in res]}
    save(); n += 1
    if n % 5 == 0: print(n, 'areas', flush=True)

# ---- outputs
stores, seen = [], set(known)
for k, v in cache.items():
    if k.startswith('sm:'):
        for r in v:
            if r['osm'] in seen or not r['name'].lower().startswith(r['brand'].lower()): continue
            if r['category'] != 'shop' and r['type'] not in ('supermarket', 'convenience', 'department_store'): continue
            seen.add(r['osm']); stores.append(r)
json.dump({'source': 'OpenStreetMap contributors via Nominatim, ODbL 1.0', 'fetched': time.strftime('%Y-%m-%d'), 'stores': stores}, open('data/raw/supermarkets_local.json', 'w'), indent=1)

emp = {}
for k, v in cache.items():
    if not k.startswith('job:'): continue
    _, aid, term = k.split(':', 2)
    emp.setdefault(aid, {})[term] = {'n': v['n'], 'capped': v['capped'], 'ids': v['ids']}
json.dump({'source': 'OpenStreetMap contributors via Nominatim, ODbL 1.0', 'fetched': time.strftime('%Y-%m-%d'), 'radiusMetres': 1000, 'categories': CATS, 'areas': emp}, open('data/raw/employers.json', 'w'))

bikes, seenb = [], set()
for k, v in cache.items():
    if k.startswith('bike:'):
        for r in v:
            if r['osm'] in seenb: continue
            seenb.add(r['osm']); bikes.append(r)
if os.path.exists('data/raw/bikes_central.json'):
    for r in json.load(open('data/raw/bikes_central.json'))['docks']:
        if r['osm'] not in seenb: seenb.add(r['osm']); bikes.append(r)
json.dump({'source': 'OpenStreetMap contributors via Nominatim, ODbL 1.0', 'fetched': time.strftime('%Y-%m-%d'), 'docks': bikes}, open('data/raw/bikes.json', 'w'), indent=1)
print('done: new stores', len(stores), 'bike docks', len(bikes))
