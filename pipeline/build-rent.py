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
TYPES = [('any', 'All property types'), ('apartment', 'Apartment'), ('terrace', 'Terrace house'), ('semi', 'Semi detached house'), ('detached', 'Detached house')]
LOOKBACK = 8          # quarters we are willing to carry a figure forward
qlabel = lambda p: lab('TLIST(Q1)')[per[p]]

def series(li, bn, tn):
    return [cell(p, bi[bn], pi_[tn], li) for p in range(size[1])]

def grow(ser, frm, to):
    """Rent growth between quarters from a series, or None."""
    a, b = ser[frm], ser[to]
    return b / a if a and b else None

# Dublin-wide reference: county series per cell, used for growth and for ratios
dub = next(li for li, lc in enumerate(loc) if lab('C03004V03625')[lc].strip() == 'Dublin')
county_ser = {(bk, tk): series(dub, bn, tn) for bk, bn in BEDS for tk, tn in TYPES}
county_last = {k: v[last] for k, v in county_ser.items()}
ratio = {k: (v / county_last[('all', 'any')]) for k, v in county_last.items() if v}

def fill(li):
    """Every bed x type cell for one area: published, else carried forward and indexed, else estimated by ratio."""
    out, area_all = {}, series(li, 'All bedrooms', 'All property types')
    # the area's own all-homes level for the latest quarter (published or carried forward)
    base, base_how = area_all[last], 'published'
    if base is None:
        for p in range(last - 1, last - 1 - LOOKBACK, -1):
            if area_all[p]:
                g = grow(county_ser[('all', 'any')], p, last) or 1
                base, base_how = area_all[p] * g, qlabel(p); break
    order = [(bk, bn, tk, tn) for bk, bn in BEDS for tk, tn in TYPES]
    order.sort(key=lambda x: 0 if (x[2] == 'any' or x[0] == 'all') else 1)
    for bk, bn, tk, tn in order:
            ser = series(li, bn, tn)
            if ser[last] is not None:
                out[f'{bk}:{tk}'] = {'v': round(ser[last]), 'how': 'published', 'q': quarter}; continue
            got = None
            for p in range(last - 1, last - 1 - LOOKBACK, -1):
                if ser[p]:
                    g = grow(area_all, p, last) or grow(county_ser[(bk, tk)], p, last) or grow(county_ser[('all', 'any')], p, last) or 1
                    got = {'v': round(ser[p] * g), 'how': 'carried', 'q': qlabel(p), 'growth': round(g, 3)}; break
            if not got and county_last.get((bk, tk)):
                # anchor on the most specific figure this area does have, scaled by the Dublin-wide relationship
                for anchor in ((bk, 'any'), ('all', tk), ('all', 'any')):
                    known = out.get(f'{anchor[0]}:{anchor[1]}') if anchor != ('all', 'any') else ({'v': base} if base else None)
                    if known and known.get('how') != 'estimated' and county_last.get(anchor):
                        got = {'v': round(known['v'] * county_last[(bk, tk)] / county_last[anchor]), 'how': 'estimated', 'q': quarter, 'anchor': f'{anchor[0]}:{anchor[1]}'}; break
            if got: out[f'{bk}:{tk}'] = got
    return out

areas, county = [], None
for li, lc in enumerate(loc):
    name = lab('C03004V03625')[lc].strip()
    if 'Dublin' not in name: continue
    if name == 'Dublin':
        county_trend = [[qlabel(p), round(county_ser[('all', 'any')][p])] for p in range(last - 12, last + 1) if county_ser[('all', 'any')][p]]
        county = {'trend': county_trend, 'cells': {f'{bk}:{tk}': round(v) for (bk, tk), v in county_last.items() if v}, 'prev': {'all:any': round(county_ser[('all', 'any')][prev] or 0) or None}}
        continue
    m = re.match(r'^(.*?)\s*,\s*Dublin(?:\s+(\d+W?))?$', name)
    if not m: continue
    cells = fill(li)
    if not cells: continue
    place, dn = m.group(1).strip(), m.group(2)
    prev_all = cell(prev, bi['All bedrooms'], pi_['All property types'], li)
    ser = series(li, 'All bedrooms', 'All property types')
    trend = [[qlabel(p), round(ser[p])] for p in range(last - 12, last + 1) if ser[p]]
    areas_trend = trend
    areas.append({'trend': trend, 'id': re.sub(r'[^a-z0-9]+', '-', f'{place}-{dn or "co"}'.lower()).strip('-'), 'name': place, 'district': f'D{dn}' if dn else None,
                  'label': f'{place}, Dublin {dn}' if dn else f'{place}, Co. Dublin', 'rent': cells,
                  'prevAll': round(prev_all) if prev_all else None, 'populatedCells': sum(1 for c in cells.values() if c['how'] == 'published')})

out = {'source': 'RTB Average Monthly Rent Report via CSO (table RIQ02), CC BY 4.0', 'sourceUrl': 'https://data.cso.ie/table/RIQ02',
       'quarter': quarter, 'quarterPrev': quarter_prev, 'tableUpdated': d['updated'], 'fetched': dt.date.today().isoformat(),
       'definition': 'Average monthly rent (EUR) for tenancies registered with the RTB in the quarter. Whole-property rent, not room rent.',
       'methods': {'published': 'Published by the RTB for this area, size and type in the latest quarter.', 'carried': 'The latest published figure from an earlier quarter (up to 2 years), adjusted by this area\'s rent growth since then (or Dublin\'s, if the area has no figure).', 'estimated': 'Not published for this area. This area\'s all-homes average multiplied by how this size and type compares with the all-homes average across Dublin.'},
       'county': county, 'areas': areas}
json.dump(out, open('data/build/rent.json', 'w'), indent=1)
import collections
cnt = collections.Counter(c['how'] for a in areas for c in a['rent'].values())
print(quarter, 'areas', len(areas), 'cells', sum(len(a['rent']) for a in areas), 'of', len(areas) * 25, dict(cnt))

# ---- back-test the estimator on cells that ARE published: pretend each is missing, estimate it, measure the error
import statistics as st
cc = out['county']['cells']; errs = {'specific': [], 'all': []}
for a in areas:
    c = a['rent']
    for k, x in c.items():
        if x['how'] != 'published' or k == 'all:any': continue
        bk, tk = k.split(':')
        for anc, kind in ((f'{bk}:any', 'specific'), (f'all:{tk}', 'specific'), ('all:any', 'all')):
            if anc != k and anc in c and c[anc]['how'] == 'published' and anc in cc and k in cc:
                kind = 'all' if anc == 'all:any' else 'specific'
                errs[kind].append(abs(c[anc]['v'] * cc[k] / cc[anc] - x['v']) / x['v']); break
bt = {kind: {'n': len(e), 'medianPct': round(st.median(e) * 100, 1), 'p80Pct': round(sorted(e)[int(len(e) * .8)] * 100, 1)} for kind, e in errs.items() if e}
out['backtest'] = bt
json.dump(out, open('data/build/rent.json', 'w'), indent=1)
print('backtest', bt)
