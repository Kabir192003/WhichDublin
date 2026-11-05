import React from 'react'
import { WORK_CATEGORIES, cellConfidence } from '../domain/model.js'
import { eur, SHORT, Conf, Icon, gmapsDir } from './ui.jsx'

const BEDS = [['1', '1 bed'], ['2', '2 bed'], ['3', '3 bed'], ['4', '4+ bed'], ['all', 'All sizes']]
const TYPES = [['any', 'Any'], ['apartment', 'Apartment'], ['terrace', 'Terraced'], ['semi', 'Semi-d'], ['detached', 'Detached']]
const HOW = { published: 'published by the RTB', carried: 'carried forward from an earlier quarter', estimated: 'estimated' }

export function Section({ icon, badge, title, conf, children, source, how }) {
  return (
    <section className="fact">
      <div className="fact-head"><h2>{icon && <span className={`badge ${badge}`} style={{ width: 32, height: 32, borderRadius: 9 }}><Icon name={icon} size={18} /></span>}{title}</h2><Conf level={conf} /></div>
      {children}
      {how && <details className="how"><summary>How this is worked out</summary><div>{how}</div></details>}
      {source && <p className="source">Source: {source}</p>}
    </section>
  )
}

/** Rent over the last three years for this area against Dublin, all homes, published quarters only. */
export function RentTrend({ area, data }) {
  const a = area.rent.trend || [], c = data.sources.rent.countyTrend || []
  if (a.length < 4) return <p className="hint">Not enough published quarters here to show a trend.</p>
  const qs = c.map((x) => x[0]), all = [...a.map((x) => x[1]), ...c.map((x) => x[1])]
  const lo = Math.min(...all) * 0.95, hi = Math.max(...all) * 1.03, W = 300, H = 70
  const xy = (q, v) => [((qs.indexOf(q) < 0 ? 0 : qs.indexOf(q)) / (qs.length - 1)) * W, H - ((v - lo) / (hi - lo)) * H]
  const path = (pts) => pts.map(([q, v], i) => `${i ? 'L' : 'M'}${xy(q, v).map((n) => n.toFixed(1)).join(',')}`).join('')
  const pct = (pts) => Math.round(((pts.at(-1)[1] - pts[0][1]) / pts[0][1]) * 100)
  const sign = (n) => (n > 0 ? '+' : '') + n + '%'
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0 10px' }}>
      <svg width={W} height={H + 6} viewBox={`0 -3 ${W} ${H + 6}`} role="img" aria-label={`All-homes rent here went from ${a[0][1]} to ${a.at(-1)[1]} euro between ${a[0][0]} and ${a.at(-1)[0]}; Dublin ${sign(pct(c))}.`} style={{ maxWidth: '100%' }}>
        <path d={path(c)} fill="none" stroke="#B7C3C9" strokeWidth="2" strokeDasharray="4 3" />
        <path d={path(a)} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx={xy(...a.at(-1))[0]} cy={xy(...a.at(-1))[1]} r="3.5" fill="var(--teal)" />
      </svg>
      <div style={{ fontSize: 13 }}>
        <p style={{ margin: 0 }}><b style={{ fontSize: 18, color: 'var(--teal-900)' }}>{sign(pct(a))}</b> here since {a[0][0]}</p>
        <p style={{ margin: 0 }} className="hint">Dublin {sign(pct(c))} (dashed). All homes, new tenancies.</p>
      </div>
    </div>
  )
}

/** Every size and type of home, with a marker for how each figure was obtained. */
export function RentTable({ area, data, highlight }) {
  const src = data.sources.rent, bt = src.backtest
  return (
    <Section icon="home" badge="b-teal" title="Average rent, whole home per month" conf={area.rent.confidence}
      source={`RTB via CSO, ${src.asOf}, ${src.licence}`}
      how={<>
        <p><b>Published</b>: the RTB average for new tenancies in {src.asOf}. <b>Carried forward</b>: the latest published figure from up to two years earlier, adjusted for rent growth since. <b>Estimated</b>: the RTB published nothing for that home here, so we take the closest figure it did publish for this area (same size, or same type) and scale it by how the two compare across Dublin.</p>
        {bt?.specific && <p>We tested the estimates by hiding {bt.specific.n} published figures and estimating them: half were within {bt.specific.medianPct}% and 8 in 10 within {bt.specific.p80Pct}%. Estimates from the area's all-homes average only are rougher (half within {bt.all?.medianPct}%).</p>}
        <p>Whole-home rent. Sharing? Divide by the number of people. These are averages, not asking prices for a specific listing.</p>
        <p>The trend line uses only quarters the RTB published for this area. Small areas have few new tenancies each quarter, so single quarters can jump.</p>
      </>}>
      <RentTrend area={area} data={data} />
      <div style={{ overflowX: 'auto' }}>
        <table className="rtable">
          <thead><tr><th scope="col"><span className="sr">Bedrooms</span></th>{TYPES.map(([k, l]) => <th key={k} scope="col">{l}</th>)}</tr></thead>
          <tbody>{BEDS.map(([b, bl]) => (
            <tr key={b}><th scope="row">{bl}</th>{TYPES.map(([t]) => {
              const c = area.rent.cells[`${b}:${t}`]
              const on = highlight && highlight.bed === b && highlight.ptype === t
              return <td key={t} className={on ? 'on num' : 'num'} title={c ? `${HOW[c.how]}${c.how === 'carried' ? ` (${c.q})` : ''}, ${cellConfidence(area, c)} confidence` : ''}>
                {c ? eur(c.v) : '–'}{c && <span className={`mk ${c.how}`} aria-label={HOW[c.how]} />}
              </td>
            })}</tr>))}</tbody>
        </table>
      </div>
      <p className="hint" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '8px 0 0' }}>
        <span><span className="mk published" /> Published</span><span><span className="mk carried" /> Carried forward</span><span><span className="mk estimated" /> Estimated</span>
      </p>
    </Section>
  )
}

const WHEN_TABS = [['am', 'Weekday 8am'], ['late', 'Home at night'], ['sat', 'Saturday']]
const WHEN_NOTE = { am: 'to college, leaving 07:30 to 08:30', late: 'from college home, leaving 22:00 to 23:00', sat: 'to college on Saturday, leaving 10:00 to 11:00' }

/** Distance and travel time to every college, with a switch for weekday morning, late night and Saturday. */
export function Colleges({ rows, data, transitFrom, streets, origin }) {
  const [when, setWhen] = React.useState('am')
  const hasLate = rows.some((r) => r.transit?.late != null), hasSat = rows.some((r) => r.transit?.sat != null)
  return (
    <Section icon="cap" badge="b-sky" title="Distance to every college" conf={null}
      source={`Timetables: NTA GTFS, ${data.sources.transit.licence}. ${streets ? 'Walking and cycling: real street routes, OpenStreetMap (OSRM).' : 'Distances: OpenStreetMap.'}`}
      how={<p>Bus, Luas and rail: middle value of several timetabled journeys {WHEN_NOTE[when]}, door to door{transitFrom ? `, ${transitFrom}` : ''}. {streets ? 'Walking and cycling follow real streets and paths on OpenStreetMap.' : 'Walking (1.25 m/s) and cycling (15 km/h) use straight-line distance times 1.3 for streets.'} Scheduled times, not live.</p>}>
      {origin && <p className="hint" style={{ margin: '0 0 6px' }}>“Route ↗” opens Google Maps with the journey from this address already set, for live times.</p>}
      <div className="seg-tabs" role="group" aria-label="When">
        {WHEN_TABS.map(([k, l]) => <button key={k} type="button" aria-pressed={when === k} disabled={(k === 'late' && !hasLate) || (k === 'sat' && !hasSat)} onClick={() => setWhen(k)}>{l}</button>)}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="rtable">
          <thead><tr><th scope="col">College</th><th scope="col">{streets ? 'By street' : 'Distance'}</th><th scope="col">Bus/Luas</th><th scope="col">Bike</th><th scope="col">Walk</th>{origin && <th scope="col"><span className="sr">Route</span></th>}</tr></thead>
          <tbody>{rows.map((r) => { const t = r.transit?.[when]; return (
            <tr key={r.id}><th scope="row" style={{ fontWeight: 600 }}>{SHORT[r.id] || r.name}</th><td className="num">{r.km} km</td><td className="num"><b>{t != null ? `${t} min` : '–'}</b></td><td className="num">{r.cycle != null ? `${r.cycle} min` : '–'}</td><td className="num">{r.walk == null ? '–' : r.walk > 90 ? '90+ min' : `${r.walk} min`}</td>{origin && (() => { const c = data.campuses.find((x) => x.id === r.id); const dest = `${c.name}, Dublin`; const href = when === 'late' ? gmapsDir(dest, origin, 'transit') : gmapsDir(origin, dest, 'transit'); return <td><a className="maplink" href={href} target="_blank" rel="noreferrer" aria-label={`Route ${when === 'late' ? 'from' : 'to'} ${c.name} in Google Maps`}>Route ↗</a></td> })()}</tr>) })}</tbody>
        </table>
      </div>
    </Section>
  )
}

export const areaStreets = (data) => !!data.sources.streets
export function collegeRowsForArea(area, data) {
  return data.campuses.map((c) => {
    const t = area.toCampus[c.id]
    return { id: c.id, name: c.name, km: t.streetKm ?? t.distanceKm, transit: { am: t.transit?.minutes ?? null, late: t.late?.minutes ?? null, sat: t.sat?.minutes ?? null }, cycle: t.cycleMinutes, walk: t.walkMinutes }
  }).sort((a, b) => a.km - b.km)
}

export function Groceries({ shops, data, origin }) {
  const src = data.sources.groceries, streets = !!data.sources.streets
  const tint = { Lidl: 's-groc', Aldi: 's-time', Tesco: 's-rent' }
  return (
    <Section icon="cart" badge="b-sand" title="Nearest supermarkets" conf="medium" source={`${src.name}, fetched ${src.fetched}, ${src.licence}`} how={<p>{streets ? 'Walking route along real streets and paths (OpenStreetMap, OSRM).' : 'Straight-line distance times 1.3, walked at 1.25 m/s.'} {src.note}</p>}>
      <div className="stats">{shops.map((s) => (
        <div key={s.brand} className={`stat ${tint[s.brand]}`}><small style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 13, marginTop: 0 }}>{s.brand}</small>
          {s.walk != null ? <><b>{s.walk} min</b><small>{s.metres >= 1000 ? (s.metres / 1000).toFixed(1) + ' km' : s.metres + ' m'} walk</small>{origin && s.lat != null && <a className="maplink" href={gmapsDir(origin, s, 'walking')} target="_blank" rel="noreferrer" aria-label={`Walking route to ${s.brand} in Google Maps`}>Route ↗</a>}</> : <><b>–</b><small>none nearby</small></>}</div>))}
      </div>
    </Section>
  )
}
export const shopsForArea = (area) => ['Lidl', 'Aldi', 'Tesco'].map((b) => { const g = area.groceries?.[b]; return g ? { brand: b, walk: g.walkMinutes, metres: g.metres } : { brand: b, walk: null } })

export function Work({ work, data, hubs }) {
  const src = data.sources.employers
  const max = Math.max(1, ...Object.values(work).map((w) => w.n))
  const col = { retail: 'var(--teal)', food: 'var(--coral)', hotels: 'var(--sky-700)', leisure: 'var(--sand-700)' }
  return (
    <Section icon="work" badge="b-coral" title="Part-time work nearby" source={src && `${src.name}, fetched ${src.fetched}, ${src.licence}`} how={src && <p>{src.note}</p>}>
      <p className="hint" style={{ margin: '0 0 6px' }}>Places within about 1 km that often hire students. Not vacancies.</p>
      {Object.entries(WORK_CATEGORIES).map(([k, v]) => (
        <div className="hbar" key={k}><span className="lab">{v.label}</span><span className="track"><span className="fill" style={{ width: `${(work[k].n / max) * 100}%`, background: col[k] }} /></span><span className="n num">{work[k].n}{work[k].capped ? '+' : ''}</span></div>))}
      {hubs && Object.keys(hubs).length > 0 && <p className="hint">Busiest within 3 km: {Object.entries(hubs).map(([k, h]) => `${WORK_CATEGORIES[k].label.toLowerCase()} in ${h.name}`).join('; ')}.</p>}
      <p style={{ marginTop: 8 }}><a href="#/work">Pay, hours and where to look</a></p>
    </Section>
  )
}

export function Dock({ home, campusDock, campusName, data }) {
  if (!home) return null
  return (
    <Section icon="bike" badge="b-sky" title="Dublinbikes" source={`${data.sources.bikes.name}, fetched ${data.sources.bikes.fetched}, ${data.sources.bikes.licence}`} how={<p>{data.sources.bikes.note}</p>}>
      <p>Nearest dock: <b>{home.name}</b>, {home.walk ?? home.walkMinutes} min walk.</p>
      {campusName && <p>Nearest to {campusName}: {campusDock ? <><b>{campusDock.name}</b>, {campusDock.walkMinutes} min walk.</> : 'none within 1.5 km.'}</p>}
    </Section>
  )
}

let reportsP = null
const REPORT_URL = 'https://github.com/Kabir192003/WhichDublin/issues/new?template=rent-report.yml'
/** Room rents students reported for this area (medians only once 5+ people reported). */
export function RoomReports({ area }) {
  const [r, setR] = React.useState(null)
  React.useEffect(() => { reportsP ||= fetch(`${import.meta.env.BASE_URL}data/reports.json`).then((x) => (x.ok ? x.json() : null)).catch(() => null); reportsP.then(setR) }, [])
  const mine = r?.areas?.[area.id]
  const rows = mine ? Object.entries(mine) : []
  return (
    <Section icon="home" badge="b-sand" title="Room rents students report" source={r?.updated ? `Student reports via GitHub, updated ${r.updated}. Medians shown only with ${r.minReports}+ reports.` : null}>
      {rows.length ? <ul className="rows">{rows.map(([room, v]) => <li key={room}><span>{room}</span><b className="num">{v.median ? `€${v.median.toLocaleString('en-IE')} median (${v.n})` : `${v.n} of ${r.minReports} reports so far`}</b></li>)}</ul>
        : <p>No reports for {area.name} yet. The RTB does not publish room prices, so these come from students.</p>}
      <p style={{ marginTop: 8 }}><a href={REPORT_URL} target="_blank" rel="noreferrer">Report what you pay</a> <span className="hint">(public, needs a free GitHub account; no address needed)</span></p>
    </Section>
  )
}

const ESS = { pharmacy: 'Pharmacy', doctors: 'GP / doctor', laundry: 'Laundrette' }
const STEP = { yes: 'step-free', limited: 'partly step-free', no: 'not step-free' }
/** Everyday essentials and nearby stations, with step-free status where OpenStreetMap records it. */
export function Essentials({ area, data }) {
  if (!area.essentials && !area.stations) return null
  const src = data.sources.essentials
  return (
    <Section icon="check" badge="b-plum" title="Everyday essentials" source={src && `${src.name}, fetched ${src.fetched}, ${src.licence}`} how={src && <p>{src.note}</p>}>
      <ul className="rows">
        {Object.entries(ESS).map(([k, l]) => { const e = area.essentials?.[k]; return <li key={k}><span>{l}</span><span>{e ? <><b>{e.walkMinutes} min</b> <small className="muted">{e.name || ''}</small></> : <span className="muted">none found within 2 km</span>}</span></li> })}
      </ul>
      {area.stations?.length > 0 && <>
        <h3 style={{ fontSize: 14, margin: '12px 0 4px' }}>Luas and train stops nearby</h3>
        <ul className="rows">{area.stations.map((x) => <li key={x.name + x.kind}><span>{x.name} <small className="muted">{x.kind === 'tram' ? 'Luas' : 'Rail'}</small></span><span><b>{x.walkMinutes} min</b> {x.wheelchair ? <span className={`chip ${x.wheelchair === 'yes' ? 'pub' : 'estimated'}`}>{STEP[x.wheelchair] || x.wheelchair}</span> : <span className="chip">step-free not recorded</span>}</span></li>)}</ul>
      </>}
    </Section>
  )
}
