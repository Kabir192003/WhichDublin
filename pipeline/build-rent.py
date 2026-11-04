"""Rent by named Dublin area from the RTB Average Monthly Rent Report, as published by the CSO (table RIQ02, CC BY 4.0).

The table gives average monthly rent for tenancies registered in a quarter, by area, bedrooms and property type.
Postal-district totals (Dublin 6 ...) stopped being published after 2021Q4; named areas (Rathmines, Dublin 6) continue
to the latest quarter, so those are our unit of comparison.
Output: data/build/rent.json"""
import json, re, datetime as dt

d = json.load(open('data/raw/RIQ02.json'))
size, dim, ids = d['size'], d['dimension'], d['id']
keys = lambda k: list(dim[k]['category']['index'].keys()) if isinstance(dim[k]['category']['index'], dict) else list(dim[k]['category']['index'])
lab = lambda k: dim[k]['category']['label']
per, loc, bed, prop = keys('TLIST(Q1)'), keys('C03004V03625'), keys('C02970V03592'), keys('C02969V03591')
nloc = len(loc); block = size[2] * size[3] * nloc; v = d['value']
def cell(p, b, pr, li): return v[p * block + (b * size[3] + pr) * nloc + li]

bi = {lab('C02970V03592')[k]: i for i, k in enumerate(bed)}
pi_ = {lab('C02969V03591')[k]: i for i, k in enumerate(prop)}
last = size[1] - 1; prev = last - 4                       # same quarter a year earlier
quarter = lab('TLIST(Q1)')[per[last]]; quarter_prev = lab('TLIST(Q1)')[per[prev]]
BEDS = [('all', 'All bedrooms'), ('1', 'One bed'), ('2', 'Two bed'), ('3', 'Three bed'), ('4', 'Four plus bed')]
TYPES = [('any', 'All property types'), ('apartment', 'Apartment')]

areas, county = [], None
for li, lc in enumerate(loc):
    name = lab('C03004V03625')[lc].strip()
    if 'Dublin' not in name: continue
    cells = {}
    for bk, bn in BEDS:
        for tk, tn in TYPES:
            x = cell(last, bi[bn], pi_[tn], li)
            if x is not None: cells[f'{bk}:{tk}'] = round(x)
    if name == 'Dublin':
        county = {'cells': cells, 'prev': {'all:any': round(cell(prev, bi['All bedrooms'], pi_['All property types'], li) or 0) or None}}
        continue
    if not cells: continue
    m = re.match(r'^(.*?)\s*,\s*Dublin(?:\s+(\d+W?))?$', name)
    if not m: continue
    place, dn = m.group(1).strip(), m.group(2)
    prev_all = cell(prev, bi['All bedrooms'], pi_['All property types'], li)
    areas.append({'id': re.sub(r'[^a-z0-9]+', '-', f'{place}-{dn or "co"}'.lower()).strip('-'), 'name': place, 'district': f'D{dn}' if dn else None,
                  'label': f'{place}, Dublin {dn}' if dn else f'{place}, Co. Dublin', 'rent': cells,
                  'prevAll': round(prev_all) if prev_all else None, 'populatedCells': len(cells)})

out = {'source': 'RTB Average Monthly Rent Report via CSO (table RIQ02), CC BY 4.0', 'sourceUrl': 'https://data.cso.ie/table/RIQ02',
       'quarter': quarter, 'quarterPrev': quarter_prev, 'tableUpdated': d['updated'], 'fetched': dt.date.today().isoformat(),
       'definition': 'Average monthly rent (EUR) for tenancies registered with the RTB in the quarter. Whole-property rent, not room rent.',
       'county': county, 'areas': areas}
json.dump(out, open('data/build/rent.json', 'w'), indent=1)
print(quarter, 'areas', len(areas), 'with district', sum(1 for a in areas if a['district']), 'county all-beds', county['cells'].get('all:any'))
print('1-bed any:', sum(1 for a in areas if '1:any' in a['rent']), '| 2-bed any:', sum(1 for a in areas if '2:any' in a['rent']), '| 3-bed any:', sum(1 for a in areas if '3:any' in a['rent']))
