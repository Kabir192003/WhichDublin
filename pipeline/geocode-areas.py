"""Geocode each rent area to a point with Nominatim (OpenStreetMap, ODbL), then check the point sits inside the postal
district the RTB table says it belongs to. Areas that fail the check are reported, not silently kept.
Output: data/build/areas_geo.json"""
import json, time, urllib.request, urllib.parse, urllib.error

UA = 'WhichDublin/0.1 (student research prototype; github.com/Kabir192003/whichdublin)'
OVERRIDES = {  # names OSM does not carry as a plain place; verified by hand against the postal district named in the RTB label
    'I.F.S.C.': 'IFSC, Dublin 1', 'Spencer Dock': 'Spencer Dock, Dublin', 'Parnell Street': 'Parnell Street, Dublin 1',
    'Charlemont Street': 'Charlemont Street, Dublin 2', 'Pearse Street': 'Pearse Street, Dublin 2', 'Townsend Street': 'Townsend Street, Dublin 2',
    'Lower Mount Street': 'Lower Mount Street, Dublin 2', 'Royal Canal Park': 'Royal Canal Park, Dublin 15', 'North Circular Road': 'North Circular Road, Dublin 7',
    'South Circular Road': 'South Circular Road, Dublin 8', 'Cork Street': 'Cork Street, Dublin 8', 'Malahide Road': 'Malahide Road, Dublin 17',
}
def get(q, tries=4):
    for i in range(tries):
        try:
            url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': q, 'countrycodes': 'ie', 'format': 'jsonv2', 'limit': 6, 'viewbox': '-6.55,53.50,-6.00,53.18', 'bounded': 1})
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40))
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < tries - 1: time.sleep(5 * (i + 1)); continue
            raise

def inside(pt, geom):
    def ring_in(ring):
        x, y = pt; c = False
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
        return c
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    return any(ring_in(p[0]) and not any(ring_in(h) for h in p[1:]) for p in polys)

districts = {f['properties']['id']: f['geometry'] for f in json.load(open('data/raw/districts.geojson'))['features']}
areas = json.load(open('data/build/rent.json'))['areas']
PLACE = {'suburb', 'neighbourhood', 'quarter', 'village', 'town', 'hamlet', 'locality', 'city_block', 'residential', 'administrative', 'street', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street', 'yes'}
out, bad = {}, []
for a in areas:
    q = OVERRIDES.get(a['name'], f"{a['name']}, Dublin {a['district'][1:]}" if a['district'] else f"{a['name']}, County Dublin")
    res = get(q); time.sleep(1.2)
    if not res: res = get(f"{a['name']}, Dublin"); time.sleep(1.2)
    pick = None
    for r in res:
        pt = (float(r['lon']), float(r['lat']))
        ok = (a['district'] is None) or (a['district'] in districts and inside(pt, districts[a['district']]))
        if ok and (r.get('category') in ('place', 'boundary', 'highway', 'landuse') or r.get('type') in PLACE): pick = (r, ok); break
    if not pick and res:
        r = res[0]; pt = (float(r['lon']), float(r['lat'])); pick = (r, a['district'] is None or (a['district'] in districts and inside(pt, districts[a['district']])))
    if not pick: bad.append((a['label'], 'no result')); print('NONE', a['label']); continue
    r, ok = pick
    out[a['id']] = {'lat': round(float(r['lat']), 5), 'lon': round(float(r['lon']), 5), 'osm': f"{r['osm_type']}/{r['osm_id']}", 'matched': r['display_name'][:100], 'insideDistrict': ok}
    if not ok: bad.append((a['label'], r['display_name'][:80]))
    print('ok  ' if ok else 'OUT ', a['label'], out[a['id']]['lat'], out[a['id']]['lon'], flush=True)
json.dump({'source': 'OpenStreetMap contributors via Nominatim, ODbL 1.0', 'fetched': time.strftime('%Y-%m-%d'), 'items': out, 'failedDistrictCheck': bad}, open('data/build/areas_geo.json', 'w'), indent=1, ensure_ascii=False)
print('geocoded', len(out), 'of', len(areas), '| failed district check:', len(bad))
