"""Dublin's buildings in 3D, straight from OpenStreetMap, as one PMTiles file the map reads directly.

  python3 pipeline/build-buildings.py <dublin.osm.pbf> public/data/buildings.pmtiles

Input: an OSM extract of Dublin (BBBike's weekly Dublin.osm.pbf, ODbL). Needs: pip install osmium shapely
mapbox-vector-tile pmtiles mercantile.

Every building and building:part keeps its full outline (holes included). Heights, best first:
height / min_height tags, then levels (building:levels, roof:levels, building:min_level), then a default by
building type (a house is two storeys, apartments and offices taller, the city centre taller than the
suburbs). An outline whose parts are mapped separately is left out, as in every OSM 3D renderer, so a tower
or stepped roof is not buried in a box. Tiles: one layer "buildings", properties h (top, m) and b (base, m),
zoom 14 to 16; the map over-zooms beyond that."""
import gzip, math, re, sys
import mercantile, osmium, shapely
from mapbox_vector_tile import encode
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from shapely import wkb
from shapely.strtree import STRtree

SRC, OUT = sys.argv[1], sys.argv[2]
LEVEL, ROOF_LEVEL = 3.2, 2.5
CENTRE, CENTRE_KM = (53.3473, -6.2591), 1.8   # O'Connell Bridge; inside this the default is a city-centre block

DEFAULT = {   # building type -> height in metres when nothing is tagged
    **dict.fromkeys(['house', 'detached', 'semidetached_house', 'terrace', 'residential'], 7.5),
    'bungalow': 4.5, 'static_caravan': 3,
    **dict.fromkeys(['garage', 'garages', 'shed', 'carport', 'hut', 'roof', 'kiosk', 'cabin', 'toilets', 'greenhouse', 'service'], 3),
    **dict.fromkeys(['apartments', 'flats', 'dormitory'], 13),
    **dict.fromkeys(['church', 'cathedral', 'chapel', 'mosque', 'temple'], 15),
    **dict.fromkeys(['school', 'university', 'college', 'hospital', 'public', 'civic', 'government', 'train_station', 'transportation'], 11),
    **dict.fromkeys(['industrial', 'warehouse', 'factory', 'manufacture', 'retail', 'supermarket'], 8),
    **dict.fromkeys(['commercial', 'office', 'hotel'], 12),
}

def num(v):
    """'12', '12 m', '12,5', '12;15' -> 12.0 / 12.5; feet and junk -> None."""
    if not v: return None
    v = v.split(';')[0].strip().replace(',', '.')
    m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(m|metres|meters)?', v)
    return float(m.group(1)) if m else None

assert (num('12'), num('12 m'), num('12,5'), num('12;15'), num('40 ft'), num('')) == (12, 12, 12.5, 12, None, None)

def km_from_centre(lat, lon):
    return math.hypot((lat - CENTRE[0]) * 111.32, (lon - CENTRE[1]) * 111.32 * math.cos(math.radians(lat)))

def heights(t, lat, lon):
    top, lv, rlv = num(t.get('height')), num(t.get('building:levels')), num(t.get('roof:levels')) or 0
    if top is None and lv is not None: top = lv * LEVEL + rlv * ROOF_LEVEL
    if top is None:
        kind = t.get('building') if t.get('building') not in (None, 'yes') else t.get('building:part')
        top = DEFAULT.get(kind) or (13 if km_from_centre(lat, lon) < CENTRE_KM else 7)
    base = num(t.get('min_height'))
    if base is None: base = (num(t.get('building:min_level')) or 0) * LEVEL
    top = min(max(top, base + 1), 300)
    return round(top, 1), round(base, 1)

class Buildings(osmium.SimpleHandler):
    def __init__(self):
        super().__init__(); self.wkb = osmium.geom.WKBFactory(); self.outlines, self.parts = [], []
    def area(self, a):
        t = a.tags
        b, p = t.get('building'), t.get('building:part')
        if (not b or b == 'no') and (not p or p == 'no'): return
        if t.get('location') == 'underground' or t.get('layer', '0').startswith('-'): return
        try: g = wkb.loads(self.wkb.create_multipolygon(a), hex=True)
        except Exception: return
        if g.is_empty or not g.is_valid: g = g.buffer(0)
        if g.is_empty: return
        c = g.representative_point()
        h, base = heights({k.k: k.v for k in t}, c.y, c.x)
        (self.parts if p and p != 'no' else self.outlines).append((g, h, base))

print('reading', SRC)
r = Buildings(); r.apply_file(SRC, locations=True)
print('outlines', len(r.outlines), 'parts', len(r.parts))

# leave out outlines that have parts mapped inside them
tree = STRtree([g for g, _, _ in r.outlines])
hidden = set()
for g, _, _ in r.parts:
    for i in tree.query(g.representative_point(), predicate='within'): hidden.add(int(i))
feats = [f for i, f in enumerate(r.outlines) if i not in hidden] + r.parts
print('outlines replaced by their parts', len(hidden), '-> features', len(feats))

# to web mercator metres, then cut into tiles
R = 6378137.0
def merc(g):
    return shapely.transform(g, lambda xy: [[R * math.radians(x), R * math.log(math.tan(math.pi / 4 + math.radians(y) / 2))] for x, y in xy])
mfeats = [(merc(g), h, b) for g, h, b in feats]
mtree = STRtree([g for g, _, _ in mfeats])

lons = [g.bounds[0] for g, _, _ in feats] + [g.bounds[2] for g, _, _ in feats]
lats = [g.bounds[1] for g, _, _ in feats] + [g.bounds[3] for g, _, _ in feats]
W, S, E, N = min(lons), min(lats), max(lons), max(lats)
MINZ, MAXZ = 14, 16
tiles = {}
for z in range(MINZ, MAXZ + 1):
    tol = {14: 1.0, 15: 0.4, 16: 0}[z]          # metres: lower zooms drop detail nobody can see
    min_area = {14: 30, 15: 8, 16: 0}[z]
    n = 0
    for t in mercantile.tiles(W, S, E, N, z):
        bx = mercantile.xy_bounds(t)
        pad = (bx.right - bx.left) * 8 / 4096
        clip = shapely.box(bx.left - pad, bx.bottom - pad, bx.right + pad, bx.top + pad)
        out = []
        for i in mtree.query(clip, predicate='intersects'):
            g, h, b = mfeats[int(i)]
            if g.area < min_area: continue
            gg = g.intersection(clip)
            if tol: gg = gg.simplify(tol, preserve_topology=True)
            if gg.is_empty or gg.geom_type not in ('Polygon', 'MultiPolygon'):
                if gg.geom_type == 'GeometryCollection': gg = shapely.union_all([x for x in gg.geoms if x.geom_type in ('Polygon', 'MultiPolygon')])
                if gg.is_empty: continue
            out.append({'geometry': gg, 'properties': {'h': h, 'b': b}})
        if not out: continue
        data = encode([{'name': 'buildings', 'features': out}], default_options={'quantize_bounds': (bx.left, bx.bottom, bx.right, bx.top), 'extents': 4096})
        tiles[zxy_to_tileid(z, t.x, t.y)] = gzip.compress(data, 9); n += 1
    print('zoom', z, 'tiles', n)

with open(OUT, 'wb') as f:
    w = Writer(f)
    for tid in sorted(tiles): w.write_tile(tid, tiles[tid])
    e7 = lambda v: int(v * 10_000_000)
    w.finalize({'tile_type': TileType.MVT, 'tile_compression': Compression.GZIP, 'min_zoom': MINZ, 'max_zoom': MAXZ,
                'min_lon_e7': e7(W), 'min_lat_e7': e7(S), 'max_lon_e7': e7(E), 'max_lat_e7': e7(N),
                'center_zoom': 15, 'center_lon_e7': e7(CENTRE[1]), 'center_lat_e7': e7(CENTRE[0])},
               {'name': 'Dublin buildings', 'attribution': '© OpenStreetMap contributors (ODbL)',
                'vector_layers': [{'id': 'buildings', 'fields': {'h': 'Number', 'b': 'Number'}, 'minzoom': MINZ, 'maxzoom': MAXZ}]})
print('wrote', OUT, round(sum(len(v) for v in tiles.values()) / 1e6, 1), 'MB of tiles')
