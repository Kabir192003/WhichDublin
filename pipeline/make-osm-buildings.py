"""Build a lossless-at-map-scale, ODbL-licensed Dublin building PMTiles archive.

Input: a raw Geofabrik or BBBike .osm.pbf with nodes, ways and relations.
Dependencies: osmium, shapely, numpy, mercantile, mapbox-vector-tile, pmtiles.
No external 3D model or generalised basemap building tiles are used.
"""
import argparse, gzip, json, math, re, time
from collections import Counter
from pathlib import Path
import numpy as np
import osmium
import shapely
from shapely.geometry import box, Polygon, MultiPolygon
from shapely.strtree import STRtree
import mercantile
import mapbox_vector_tile
from pmtiles.tile import TileType, Compression, zxy_to_tileid
from pmtiles.writer import Writer

BOUNDS=(-6.65,53.10,-5.95,53.66)
CENTRE=(-6.2603,53.3498)
WORLD=6378137.0
EXTENT=8192
SOURCE_URL='https://download.geofabrik.de/europe/ireland-and-northern-ireland.html'
TAG_PREFIXES=('building:', 'roof:', 'height', 'min_height')
TAG_KEYS={'building','name','man_made','tower:type','historic','amenity','shop','office','leisure','landuse','type'}
HOUSE={'house','detached','semidetached_house','terrace','bungalow','cabin','farm','residential'}
SMALL={'garage','garages','shed','hut','carport','outbuilding','greenhouse','service','roof','toilets','kiosk'}
COMMERCIAL={'office','commercial','retail','hotel','hospital','university','college','public','civic','government','train_station'}
WAREHOUSE={'warehouse','industrial','hangar','barn','farm_auxiliary','supermarket'}
ROOF_SHAPES={'gabled','hipped','half-hipped','pyramidal','skillion','dome','onion','cone','gambrel','mansard','round','saltbox','double_saltbox','quadruple_saltbox','flat'}

def meters(raw):
    if not raw: return None
    s=str(raw).strip().lower().replace(',','.')
    feet=re.fullmatch(r"(\d+(?:\.\d+)?)\s*(?:ft|feet|')\s*(?:(\d+(?:\.\d+)?)\s*(?:in|\"))?",s)
    if feet: return float(feet[1])*.3048+float(feet[2] or 0)*.0254
    m=re.fullmatch(r'(-?\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)?',s)
    if m: return float(m[1])
    return None

def number(raw):
    a=meters(raw)
    return a if a is not None and 0<=a<=100 else None

def merc(xy):
    lon,lat=xy[:,0],xy[:,1]; return np.column_stack((WORLD*np.radians(lon),WORLD*np.arcsinh(np.tan(np.radians(lat)))))

def distance_from_centre(lon,lat):
    return math.hypot((lon-CENTRE[0])*111.32*math.cos(math.radians(lat)),(lat-CENTRE[1])*111.32)

def polygonal(g):
    if g.is_empty: return None
    if g.geom_type in ('Polygon','MultiPolygon'): return g
    parts=[p for p in shapely.get_parts(g) if p.geom_type=='Polygon' and p.area>0]
    return MultiPolygon(parts) if parts else None

def use_type(tags,parent=None):
    parent=parent or {}; t=tags.get('building','yes')
    if t in ('yes','no','part','building') or tags.get('building:part') not in (None,'no'):
        t=tags.get('building:use') or parent.get('building:use') or (parent.get('building') if parent.get('building') not in (None,'yes','no') else None) or tags.get('building:part') or t
    if t in ('yes','no','part','building'):
        if tags.get('office') or parent.get('office'): t='office'
        elif tags.get('shop') or parent.get('shop'): t='retail'
        elif tags.get('amenity') in ('school','college','university','hospital','place_of_worship'): t=tags['amenity']
        elif tags.get('man_made')=='tower': t='tower'
        elif tags.get('leisure')=='sports_hall': t='sports_hall'
    return t

def height_props(tags,lon,lat,area,parent=None):
    parent=parent or {}; t=use_type(tags,parent); city=distance_from_centre(lon,lat)
    floor=3.6 if t in COMMERCIAL else 3.1
    base=meters(tags.get('min_height') or tags.get('building:min_height'))
    minlevel=number(tags.get('building:min_level'))
    if base is None: base=(minlevel or 0)*floor
    base=max(0,base)
    explicit=meters(tags.get('height') or tags.get('building:height'))
    levels=number(tags.get('building:levels')); roof=meters(tags.get('roof:height')); rooflevels=number(tags.get('roof:levels'))
    shape=tags.get('roof:shape','flat').lower(); mapped_shape=shape in ROOF_SHAPES and shape!='flat'
    if roof is None and rooflevels is not None: roof=rooflevels*2.5
    if roof is None: roof= min(3.2,max(1.1,math.sqrt(area)*.12)) if mapped_shape else 0
    roof=max(0,roof)
    if explicit is not None and explicit>base:
        h=explicit; source='osm_height'
    elif levels is not None and levels>0:
        h=levels*floor+roof; source='osm_levels'
    elif tags.get('building:part') not in (None,'no') and (meters(parent.get('height')) or number(parent.get('building:levels'))):
        h=meters(parent.get('height')) or number(parent.get('building:levels'))*floor+roof; source='parent_height'
    else:
        # Area thresholds are footprint area in real m², not Web Mercator pixels.
        if t in HOUSE: levels=1 if t=='bungalow' else 2
        elif t in SMALL: levels=1; floor=2.5
        elif t in WAREHOUSE: levels=1; floor=6.0 if area>150 else 4.5
        elif t in ('apartments','dormitory'): levels=5 if city<3 else 4 if city<7 else 3; floor=3.1
        elif t in COMMERCIAL: levels=5 if city<2.5 and area>170 else 4 if city<5 else 2 if area<250 else 3
        elif t in ('church','cathedral','chapel','place_of_worship'): levels=2; floor=5.5
        elif t in ('school','kindergarten','sports_hall'): levels=2 if area>200 else 1; floor=3.8
        elif t=='tower': levels=4; floor=3.5
        elif area<32: levels=1; floor=2.7
        elif city<2.5: levels=4 if area>190 else 3
        elif city<6: levels=3 if area>250 else 2
        else: levels=3 if area>450 else 2
        h=levels*floor+roof; source='estimated'
    # Never silently truncate an explicit mapped height, and respect elevated parts.
    if h<=base: h=base+max(1.5,floor); source='estimated'
    roof=min(roof,max(0,h-base-.3))
    return {'kind':t,'height':round(h,2),'base':round(base,2),'roof_height':round(roof,2),'eave':round(h-roof,2),'roof_shape':shape,'height_source':source,'levels':round(levels,1) if levels is not None else 0,'estimated':source=='estimated'}

class Buildings(osmium.SimpleHandler):
    def __init__(self,bounds):
        super().__init__(); self.bounds=bounds; self.features=[]; self.parents={}; self.factory=osmium.geom.WKBFactory(); self.bad=0
    def relation(self,r):
        if r.tags.get('type')=='building':
            outlines=[f'{m.type}{m.ref}' for m in r.members if m.role=='outline' and m.type in ('w','r')]
            parts=[f'{m.type}{m.ref}' for m in r.members if m.role=='part' and m.type in ('w','r')]
            if outlines:
                for part in parts: self.parents[part]=outlines[0]
    def area(self,a):
        tags=a.tags; building=tags.get('building'); part=tags.get('building:part')
        if building in (None,'no','demolished','razed') and part in (None,'no'): return
        w,s,e,n=self.bounds
        # Avoid constructing nationwide geometries outside the Dublin window.
        found=False
        for ring in a.outer_rings():
            for node in ring:
                if node.location.valid() and w-.002<=node.lon<=e+.002 and s-.002<=node.lat<=n+.002:
                    found=True; break
            if found: break
        if not found: return
        try:
            g=shapely.from_wkb(self.factory.create_multipolygon(a),on_invalid='ignore')
            if g is None: self.bad+=1; return
            g=polygonal(shapely.make_valid(g))
            if g is None or not g.intersects(box(*self.bounds)): return
            p=g.representative_point(); geom=shapely.transform(g,merc)
            if geom.area<.001: return
            useful={t.k:t.v for t in tags if t.k in TAG_KEYS or t.k.startswith(TAG_PREFIXES)}
            id=f'{"w" if a.from_way() else "r"}{a.orig_id()}'
            self.features.append({'id':id,'geom':geom,'tags':useful,'lon':p.x,'lat':p.y,'is_part':part not in (None,'no')})
        except (RuntimeError, ValueError, shapely.GEOSException): self.bad+=1

def prepare(handler):
    features=handler.features
    # Relation multipolygons sometimes repeat their own outer way. Identical
    # polygons are kept once per outline/part, preferring the relation's tags.
    dedup={}
    for f in sorted(features,key=lambda a:a['id'][0]=='r'):
        key=(f['is_part'],shapely.to_wkb(shapely.normalize(f['geom'])))
        if key not in dedup or len(f['tags'])>=len(dedup[key]['tags']): dedup[key]=f
    features=list(dedup.values()); byid={a['id']:a for a in features}
    outlines=[a for a in features if not a['is_part']]; parts=[a for a in features if a['is_part']]; otree=STRtree([f['geom'] for f in outlines])
    grouped={}; parents={}
    for p in parts:
        parent=byid.get(handler.parents.get(p['id']))
        if parent is None:
            candidates=otree.query(p['geom'],predicate='intersects'); best=None
            for i in candidates:
                o=outlines[i]; ratio=o['geom'].intersection(p['geom']).area/p['geom'].area
                if ratio>.6 and (best is None or (ratio,-o['geom'].area)>best[0]): best=((ratio,-o['geom'].area),o)
            parent=best[1] if best else None
        if parent: grouped.setdefault(parent['id'],[]).append(p); parents[p['id']]=parent
    output=[]; counts=Counter()
    for f in features:
        t=f['tags']; p=parents.get(f['id']); area=f['geom'].area*math.cos(math.radians(f['lat']))**2
        hp=height_props(t,f['lon'],f['lat'],area,p['tags'] if p else None)
        props={**hp,'osm_id':f['id'],'role':'part' if f['is_part'] else 'outline','render':1,'building':t.get('building','yes'),'building_part':t.get('building:part','no'),'name':t.get('name',''),'raw_tags':json.dumps(t,separators=(',',':'),ensure_ascii=False)}
        for k in ('building:colour','roof:colour','building:material','roof:material','roof:orientation','roof:direction'):
            if k in t: props[k.replace(':','_')]=t[k]
        if p: props['parent_id']=p['id']
        counts[hp['height_source']]+=1; counts[props['role']]+=1
        if not f['is_part'] and f['id'] in grouped:
            # Archive the full original outline, but avoid duplicate roof/volume
            # where detailed parts already exist. Render any unmapped remainder.
            props['render']=0; output.append((f['geom'],props))
            covered=shapely.union_all([x['geom'] for x in grouped[f['id']]])
            remainder=polygonal(f['geom'].difference(covered))
            if remainder is not None and remainder.area>1:
                output.append((remainder,{**props,'role':'remainder','render':1})); counts['remainder']+=1
        else: output.append((f['geom'],props))
    return output,counts

def write_pmtiles(output, path, bounds, stats, date, source_url):
    geoms=np.array([v[0] for v in output],dtype=object); props=[v[1] for v in output]; tree=STRtree(geoms); fields={k:'Number' if isinstance(v,(int,float)) else 'Boolean' if isinstance(v,bool) else 'String' for k,v in props[0].items()}
    for p in props:
        for k in p: fields.setdefault(k,'String')
    tile_list=sorted((zxy_to_tileid(t.z,t.x,t.y),t) for t in mercantile.tiles(*bounds,zooms=[14,15,16]))
    count=0
    with path.open('wb') as f:
        writer=Writer(f)
        for i,(tileid,tile) in enumerate(tile_list):
            b=mercantile.xy_bounds(tile); bb=box(*b); margin=(b.right-b.left)*8/256
            clip=bb.buffer(margin,cap_style='square',join_style='mitre'); ids=tree.query(clip,predicate='intersects')
            if not len(ids): continue
            feats=[]
            for idx in sorted(ids):
                g=geoms[idx]; g=polygonal(g.intersection(clip)) if not clip.covers(g) else g
                if g is None: continue
                feats.append({'geometry':g,'properties':props[idx],'id':int(idx)+1})
            if not feats: continue
            data=mapbox_vector_tile.encode({'name':'buildings','features':feats},default_options={'quantize_bounds':tuple(b),'extents':EXTENT})
            writer.write_tile(tileid,gzip.compress(data,compresslevel=6)); count+=1
            if i%100==0: print('Tiles',i,'/',len(tile_list),flush=True)
        w,s,e,n=bounds
        header={'tile_type':TileType.MVT,'tile_compression':Compression.GZIP,'min_zoom':14,'max_zoom':16,'min_lon_e7':round(w*1e7),'min_lat_e7':round(s*1e7),'max_lon_e7':round(e*1e7),'max_lat_e7':round(n*1e7),'center_zoom':15,'center_lon_e7':round(CENTRE[0]*1e7),'center_lat_e7':round(CENTRE[1]*1e7)}
        metadata={'name':'Settld Dublin buildings','description':'Raw OSM buildings and parts with explicit height provenance. Original outlines retained, overlapping volume removed.','attribution':'© OpenStreetMap contributors | ODbL 1.0','version':date,'source':source_url,'license':'ODbL 1.0','vector_layers':[{'id':'buildings','minzoom':14,'maxzoom':16,'fields':fields}],'stats':dict(stats),'bounds':','.join(map(str,bounds))}
        writer.finalize(header,metadata)
    print('Archive:',count,'tiles',round(path.stat().st_size/1024**2,2),'MiB',flush=True)

def main():
    p=argparse.ArgumentParser(); p.add_argument('source',type=Path); p.add_argument('--out',type=Path,default=Path('public/data/dublin-buildings.pmtiles')); p.add_argument('--stats',type=Path,default=Path('src/domain/osm-buildings-data.json')); p.add_argument('--bounds',nargs=4,type=float,default=BOUNDS); p.add_argument('--source-url',default=SOURCE_URL); args=p.parse_args()
    bounds=tuple(args.bounds); h=Buildings(bounds)
    with osmium.io.Reader(str(args.source)) as r: date=r.header().get('osmosis_replication_timestamp') or 'unknown'
    print('Reading raw OSM:',args.source,date,flush=True); h.apply_file(str(args.source),locations=True,idx='flex_mem')
    print('Extracted',len(h.features),'building geometries;',h.bad,'invalid/unresolved',flush=True)
    output,stats=prepare(h); stats['source_geometries']=stats['outline']+stats['part']; stats['invalid_or_unresolved']=h.bad
    print(dict(stats),flush=True); args.out.parent.mkdir(parents=True,exist_ok=True)
    write_pmtiles(output,args.out,bounds,stats,date,args.source_url)
    args.stats.write_text(json.dumps({'bounds':bounds,'date':date,'stats':dict(stats),'source':args.source_url,'bytes':args.out.stat().st_size},indent=2)+'\n')

if __name__=='__main__': main()
