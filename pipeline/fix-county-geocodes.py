"""Areas outside the postal districts ("Rush, Co. Dublin") have no boundary to check against, so a free-text match can
land on a pub or a road with the same word in it. Re-geocode them as settlements only (towns, villages, suburbs).
Updates data/build/areas_geo.json in place and prints what changed."""
import json, time, urllib.request, urllib.parse
UA = 'WhichDublin/0.1 (student research prototype; github.com/Kabir192003/whichdublin)'
P = 'data/build/areas_geo.json'; g = json.load(open(P)); rent = json.load(open('data/build/rent.json'))
names = {a['id']: a['name'] for a in rent['areas']}
for aid in sorted(k for k in g['items'] if k.endswith('-co')):
    name = names.get(aid, aid.replace('-co', '').replace('-', ' ').title())
    p = {'q': f'{name}, County Dublin', 'format': 'jsonv2', 'limit': 5, 'countrycodes': 'ie', 'featureType': 'settlement', 'viewbox': '-6.6,53.65,-5.95,53.15', 'bounded': 1}
    res = json.load(urllib.request.urlopen(urllib.request.Request('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(p), headers={'User-Agent': UA}), timeout=40))
    res = [r for r in res if r.get('category') in ('place', 'boundary') and r.get('type') in ('town', 'village', 'suburb', 'hamlet', 'neighbourhood', 'quarter', 'administrative', 'locality')]
    if not res: print('NONE', aid, name); g['items'][aid]['insideDistrict'] = False; time.sleep(1.3); continue
    r = res[0]; old = g['items'][aid]
    new = {'lat': round(float(r['lat']), 5), 'lon': round(float(r['lon']), 5), 'osm': f"{r['osm_type']}/{r['osm_id']}", 'matched': r['display_name'][:100], 'insideDistrict': True, 'kind': r['type']}
    moved = ((new['lat'] - old['lat']) ** 2 + (new['lon'] - old['lon']) ** 2) ** .5 * 111
    print(f"{aid:18} {r['type']:10} moved {moved:5.1f} km  {new['matched'][:60]}")
    g['items'][aid] = new
    time.sleep(1.3)
json.dump(g, open(P, 'w'), indent=1)
