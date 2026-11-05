"""Real street routes (walking and cycling) from each area to every college, its nearest Lidl/Aldi/Tesco and nearest
Dublinbikes docks, using the OpenStreetMap community OSRM servers run by FOSSGIS (routing.openstreetmap.de).
Light use, 1 request per second. Replaces the straight-line x 1.3 estimates.
Output: data/build/streets.json  { areas: { id: { foot: {key: [metres, secs]}, bike: {...} } } }"""
import json, math, os, time, urllib.request
OUT = 'data/build/streets.json'
done = json.load(open(OUT)) if os.path.exists(OUT) else {'areas': {}}
geo = json.load(open('data/build/areas_geo.json'))['items']
campuses = json.load(open('data/raw/campuses_geocoded.json'))
campuses = campuses if isinstance(campuses, list) else campuses.get('campuses', campuses)
stores = json.load(open('data/raw/supermarkets.json'))['stores'] + (json.load(open('data/raw/supermarkets_local.json'))['stores'] if os.path.exists('data/raw/supermarkets_local.json') else [])
docks = json.load(open('data/raw/bikes.json'))['docks'] if os.path.exists('data/raw/bikes.json') else []
docks = [d for d in docks if any(k in (d.get('operator', '') + d.get('brand', '')).lower() for k in ('jcdecaux', 'cyclocity', 'deceaux')) or 'dublinbikes' in d.get('name', '').lower()]
def hav(a, b):
    r = math.pi / 180; dl = (b[0] - a[0]) * r; dn = (b[1] - a[1]) * r
    h = math.sin(dl / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin(dn / 2) ** 2
    return 12742000 * math.asin(math.sqrt(h))
def table(profile, pts):
    coords = ';'.join(f'{lon},{lat}' for lat, lon in pts)
    url = f'https://routing.openstreetmap.de/routed-{profile}/table/v1/{profile}/{coords}?sources=0&annotations=duration,distance'
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'WhichDublin/0.1 (github.com/Kabir192003/whichdublin)'}), timeout=60) as r:
                d = json.load(r)
            if d.get('code') == 'Ok': return d['distances'][0], d['durations'][0]
        except Exception as ex: print('retry', profile, ex)
        time.sleep(5 * (attempt + 1))
    return None, None
n = 0
for aid, g in geo.items():
    if g.get('insideDistrict') is False or aid in done['areas']: continue
    here = (g['lat'], g['lon'])
    keys, pts = [], [here]
    for c in campuses: keys.append('c:' + c['id']); pts.append((c['lat'], c['lon']))
    for brand in ('Lidl', 'Aldi', 'Tesco'):
        for s in sorted((s for s in stores if s['brand'] == brand), key=lambda s: hav(here, (s['lat'], s['lon'])))[:3]:
            keys.append(f's:{brand}:{s["osm"]}'); pts.append((s['lat'], s['lon']))
    for d in sorted(docks, key=lambda d: hav(here, (d['lat'], d['lon'])))[:3]:
        keys.append('d:' + d['osm']); pts.append((d['lat'], d['lon']))
    rec = {}
    for profile in ('foot', 'bike'):
        dist, dur = table(profile, pts)
        if dist is None: rec = None; break
        rec[profile] = {k: [round(dist[i + 1]) if dist[i + 1] is not None else None, round(dur[i + 1]) if dur[i + 1] is not None else None] for i, k in enumerate(keys)}
        time.sleep(1.1)
    if rec: done['areas'][aid] = rec
    n += 1
    if n % 10 == 0:
        json.dump(done, open(OUT, 'w')); print(n, 'areas', flush=True)
done['source'] = 'OpenStreetMap contributors, routed with OSRM on routing.openstreetmap.de (FOSSGIS)'
done['fetched'] = time.strftime('%Y-%m-%d')
json.dump(done, open(OUT, 'w')); print('done', len(done['areas']))
