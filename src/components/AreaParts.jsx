import React from 'react'
import { WORK_CATEGORIES, cellConfidence } from '../domain/model.js'
import { eur, SHORT, Conf, Icon } from './ui.jsx'

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
      </>}>
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

/** Distance and travel time to every college. `transitFrom` explains when transit comes from a nearby area centre. */
export function Colleges({ rows, data, transitFrom }) {
  return (
    <Section icon="cap" badge="b-sky" title="Distance to every college" conf={null}
      source={`Timetables: NTA GTFS, service day ${data.sources.transit.serviceDate}, ${data.sources.transit.licence}. Distances: OpenStreetMap.`}
      how={<p>Bus/Luas/rail: middle value of 13 timetabled journeys leaving between 07:30 and 08:30{transitFrom ? `, from ${transitFrom}` : ''}. Bike: 15 km/h. Walk: 1.25 m/s. Bike and walk use straight-line distance times 1.3 for streets.</p>}>
      <div style={{ overflowX: 'auto' }}>
        <table className="rtable">
          <thead><tr><th scope="col">College</th><th scope="col">Distance</th><th scope="col">Bus/Luas</th><th scope="col">Bike</th><th scope="col">Walk</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><th scope="row" style={{ fontWeight: 600 }}>{SHORT[r.id] || r.name}</th><td className="num">{r.km} km</td><td className="num"><b>{r.transit != null ? `${r.transit} min` : '–'}</b></td><td className="num">{r.cycle} min</td><td className="num">{r.walk > 90 ? '90+ min' : `${r.walk} min`}</td></tr>))}</tbody>
        </table>
      </div>
    </Section>
  )
}

export function collegeRowsForArea(area, data) {
  return data.campuses.map((c) => { const t = area.toCampus[c.id]; return { id: c.id, name: c.name, km: t.distanceKm, transit: t.transit?.minutes ?? null, cycle: t.cycleMinutes, walk: t.walkMinutes } }).sort((a, b) => a.km - b.km)
}

export function Groceries({ shops, data }) {
  const src = data.sources.groceries
  const tint = { Lidl: 's-groc', Aldi: 's-time', Tesco: 's-rent' }
  return (
    <Section icon="cart" badge="b-sand" title="Nearest supermarkets" conf="medium" source={`${src.name}, fetched ${src.fetched}, ${src.licence}`} how={<p>Straight-line distance times 1.3, walked at 1.25 m/s. {src.note}</p>}>
      <div className="stats">{shops.map((s) => (
        <div key={s.brand} className={`stat ${tint[s.brand]}`}><small style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 13, marginTop: 0 }}>{s.brand}</small>
          {s.walk != null ? <><b>{s.walk} min</b><small>{s.metres >= 1000 ? (s.metres / 1000).toFixed(1) + ' km' : s.metres + ' m'} walk</small></> : <><b>–</b><small>none nearby</small></>}</div>))}
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
