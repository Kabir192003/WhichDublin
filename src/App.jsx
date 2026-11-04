import React, { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView.jsx'
import Method from './components/Method.jsx'
import { rankAreas, PRESETS } from './domain/rank.js'
import { RENT_TYPES, MODES, buildRows, rentPerPerson, commuteFor, parseState, stateToSearch } from './domain/model.js'

const DATA_URL = `${import.meta.env.BASE_URL}data/areas.json`
const SHORT = { tcd: 'Trinity', ucd: 'UCD', dcu: 'DCU', tud: 'TU Dublin', rcsi: 'RCSI', nci: 'NCI', dbs: 'DBS', griffith: 'Griffith', iadt: 'IADT' }
const eur = (n) => `€${Math.round(n).toLocaleString('en-IE')}`
const CONF = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }

const Conf = ({ level }) => level ? <span className={`conf conf-${level}`}>{CONF[level]}</span> : null

function useRoute() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return hash
}

export default function App() {
  const [data, setData] = useState(null), [err, setErr] = useState(null)
  const hash = useRoute()
  useEffect(() => { fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then(setData).catch((e) => setErr(String(e))) }, [])

  if (err) return <Shell><p className="notice">Could not load the data ({err}). Please refresh.</p></Shell>
  if (!data) return <Shell><p className="notice">Loading data…</p></Shell>
  if (hash.startsWith('#/method')) return <Shell><Method data={data} /></Shell>
  return <Shell><Finder data={data} /></Shell>
}

function Shell({ children }) {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <a className="brand" href="#/" aria-label="Which Dublin, home"><span className="mark" aria-hidden="true" />Which Dublin</a>
        <nav aria-label="Main">
          <a href="#/method">How we know this</a>
          <a href="https://github.com/Kabir192003/WhichDublin/issues/new" target="_blank" rel="noreferrer">Report a problem</a>
        </nav>
      </header>
      <main id="main">{children}</main>
    </>
  )
}

function Finder({ data }) {
  const campusIds = data.campuses.map((c) => c.id)
  const [s, setS] = useState(() => parseState(location.search, campusIds))
  const [selected, setSelected] = useState(null)
  const [compare, setCompare] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [tab, setTab] = useState('list')
  const [q, setQ] = useState('')

  useEffect(() => { history.replaceState(null, '', `?${stateToSearch(s)}${location.hash}`) }, [s])
  const set = (patch) => setS((p) => ({ ...p, ...patch }))
  const campus = data.campuses.find((c) => c.id === s.campus)

  const rows = useMemo(() => buildRows(data.areas, s), [data, s.campus, s.type, s.mode])
  const result = useMemo(() => rankAreas(rows, { budget: s.budget, weights: PRESETS[s.priority].weights }), [rows, s.budget, s.priority])
  const byId = useMemo(() => Object.fromEntries(data.areas.map((a) => [a.id, a])), [data])
  const rowById = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows])
  const scoreOf = Object.fromEntries(result.ranked.map((r) => [r.id, r]))

  const filtered = result.ranked.filter((r) => !q || byId[r.id].label.toLowerCase().includes(q.toLowerCase()))
  const points = data.areas.map((a) => {
    const r = scoreOf[a.id]
    const color = !r ? '#cdd5dd' : r.score > 0.66 ? '#1b6b57' : r.score > 0.4 ? '#4f86a8' : '#8a97a6'
    return { id: a.id, name: a.name, lat: a.lat, lon: a.lon, color, shown: !!r }
  })
  const toggleCompare = (id) => setCompare((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length >= 2 ? [c[1], id] : [...c, id])
  const area = selected && byId[selected]

  return (
    <div className="finder" data-tab={tab}>
      <aside className="panel" aria-label="Search and results">
        <section className="controls" aria-label="Your situation">
          <label className="field"><span>College</span>
            <select value={s.campus} onChange={(e) => set({ campus: e.target.value })}>
              {data.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <fieldset className="field"><legend>How you rent</legend>
            <div className="seg">{Object.entries(RENT_TYPES).map(([k, v]) => (
              <button key={k} type="button" aria-pressed={s.type === k} onClick={() => set({ type: k })}>{v.label}</button>))}</div>
            <small>{RENT_TYPES[s.type].hint}</small>
          </fieldset>
          <label className="field"><span>Budget per person per month: <b>{eur(s.budget)}</b></span>
            <input type="range" min="300" max="2500" step="25" value={Math.min(Math.max(s.budget, 300), 2500)} onChange={(e) => set({ budget: Number(e.target.value) })} />
          </label>
          <div className="row2">
            <fieldset className="field"><legend>Getting to college</legend>
              <div className="seg">{Object.entries(MODES).map(([k, v]) => (
                <button key={k} type="button" aria-pressed={s.mode === k} onClick={() => set({ mode: k })}>{v.label}</button>))}</div>
            </fieldset>
          </div>
          <fieldset className="field"><legend>What matters most</legend>
            <div className="seg">{Object.entries(PRESETS).map(([k, v]) => (
              <button key={k} type="button" aria-pressed={s.priority === k} onClick={() => set({ priority: k })}>{v.label}</button>))}</div>
          </fieldset>
        </section>

        <div className="tabs" role="tablist" aria-label="View">
          <button role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>List</button>
          <button role="tab" aria-selected={tab === 'map'} onClick={() => setTab('map')}>Map</button>
        </div>

        {area ? (
          <Detail area={area} s={s} campus={campus} row={rowById[area.id]} rank={scoreOf[area.id]} data={data}
            onBack={() => setSelected(null)} inCompare={compare.includes(area.id)} onCompare={() => toggleCompare(area.id)} />
        ) : (
          <section className="results" aria-label="Ranked areas">
            <div className="results-head">
              <h2>{result.ranked.length} {result.ranked.length === 1 ? 'area' : 'areas'} within budget</h2>
              <input className="search" type="search" placeholder="Find an area" aria-label="Find an area" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <p className="hint">Ranked for {SHORT[s.campus]} · {RENT_TYPES[s.type].short} · {PRESETS[s.priority].label.toLowerCase()}. Rent is a published average, not a quote.</p>
            {compare.length > 0 && (
              <div className="compare-bar"><span>{compare.length} selected</span>
                <button className="btn" disabled={compare.length < 2} onClick={() => setShowCompare(true)}>Compare</button>
                <button className="link" onClick={() => setCompare([])}>Clear</button></div>)}
            {result.ranked.length === 0 && (
              <p className="notice-inline">{result.overBudget.length ? <>Nothing fits {eur(s.budget)} for {RENT_TYPES[s.type].short}. The cheapest is {byId[result.overBudget[0].id].label} at {eur(rowById[result.overBudget[0].id].rent)}. <button className="link" onClick={() => set({ budget: Math.min(2500, Math.ceil(rowById[result.overBudget[0].id].rent / 25) * 25) })}>Raise budget to {eur(Math.ceil(rowById[result.overBudget[0].id].rent / 25) * 25)}</button></> : <>No areas have a published figure for this setup. Try another size of home.</>}</p>)}
            <ol className="list">
              {filtered.map((r) => <Item key={r.id} a={byId[r.id]} r={r} row={rowById[r.id]} s={s} onOpen={() => setSelected(r.id)} checked={compare.includes(r.id)} onCheck={() => toggleCompare(r.id)} />)}
            </ol>
            {result.overBudget.length > 0 && (
              <details className="more"><summary>{result.overBudget.length} {result.overBudget.length === 1 ? 'area' : 'areas'} over your budget</summary>
                <ul>{result.overBudget.slice(0, 12).map((o) => <li key={o.id}><button className="link" onClick={() => setSelected(o.id)}>{byId[o.id].label}</button> <span className="muted">{eur(o.over)} over</span></li>)}</ul></details>)}
            {result.missing.length > 0 && (
              <details className="more"><summary>{result.missing.length} areas with no figure for this setup</summary>
                <p className="muted">The RTB has not published an average for this size of home or there is no usable journey to {SHORT[s.campus]}. We show nothing rather than guess.</p>
                <ul>{result.missing.map((id) => <li key={id}>{byId[id].label}</li>)}</ul></details>)}
          </section>
        )}
      </aside>

      <section className="mapwrap" aria-label="Map">
        <MapView campus={{ ...campus, short: SHORT[campus.id] }} points={points} selectedId={selected} onSelect={(id) => { setSelected(id); setTab('list') }} />
      </section>
      {showCompare && compare.length === 2 && <Compare a={byId[compare[0]]} b={byId[compare[1]]} s={s} campus={campus} onClose={() => setShowCompare(false)} />}
    </div>
  )
}

function Item({ a, r, row, s, onOpen, checked, onCheck }) {
  const c = row._commute
  return (
    <li className="item">
      <label className="pick"><input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Select ${a.label} to compare`} /></label>
      <button className="item-main" onClick={onOpen}>
        <span className="rank">{r.rank}</span>
        <span className="name">{a.label}</span>
        <span className="nums">
          <span><b>{eur(row.rent)}</b> <small>/ person / mo</small></span>
          <span><b>{c.minutes} min</b> <small>{s.mode === 'transit' ? 'scheduled' : 'estimate'}</small></span>
          <span><b>{a.nearestBudgetGroceryMinutes ?? '–'} min</b> <small>walk to Lidl/Aldi/Tesco</small></span>
        </span>
      </button>
    </li>
  )
}

const mapsLink = (a, campus, mode) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lon}&destination=${campus.lat},${campus.lon}&travelmode=${mode === 'transit' ? 'transit' : mode === 'cycle' ? 'bicycling' : 'walking'}`

function Detail({ area, s, campus, row, rank, data, onBack, inCompare, onCompare }) {
  const rent = rentPerPerson(area, s.type), commute = commuteFor(area, s.campus, s.mode)
  const src = data.sources
  return (
    <article className="detail" aria-label={area.label}>
      <button className="link back" onClick={onBack}>← All areas</button>
      <h2>{area.label}</h2>
      {rank && <p className="muted">Ranked {rank.rank} for your setup</p>}
      {area.about && <p className="about">{area.about.text} <a href={area.about.url} target="_blank" rel="noreferrer">Wikipedia</a></p>}

      <Fact title="Rent" conf={area.rent.confidence}
        value={rent ? <><b>{eur(rent.perPerson)}</b> per person per month</> : <>No figure published</>}
        detail={rent ? <>{RENT_TYPES[s.type].label.toLowerCase()}: average {eur(rent.total)} {rent.people > 1 ? `÷ ${rent.people} people` : 'for the whole home'}. Average over new tenancies registered in {src.rent.asOf}; based on {area.rent.populatedCells} size and type groups with data. Previous-year average for all homes here: {area.rent.prevAll ? eur(area.rent.prevAll) : 'n/a'}.</> : <>The RTB has not published an average for this size of home in this area. We do not estimate it.</>}
        source={`${src.rent.name}, ${src.rent.asOf}, ${src.rent.licence}`} />

      <Fact title={`To ${SHORT[s.campus]}`} conf={commute?.confidence}
        value={commute ? <><b>{commute.minutes} min</b> {MODES[s.mode].label.toLowerCase()}</> : <>No usable journey</>}
        detail={commute ? (commute.kind === 'scheduled'
          ? <>Median of 13 timetabled departures between 07:30 and 08:30 (range {commute.best} to {commute.worst} min), door to door, including {commute.walkMinutes} min walking and {commute.changes} change{commute.changes === 1 ? '' : 's'}. Scheduled times, not a guarantee: real buses can be late.</>
          : <>{commute.detail}. An estimate, not a routed journey.</>) : <>No bus, tram or train journey was found in the timetable within walking range of both ends.</>}
        source={s.mode === 'transit' ? `${src.transit.name}, service day ${src.transit.serviceDate}, ${src.transit.licence}` : 'Straight-line distance from OpenStreetMap locations'} />

      <section className="fact">
        <h3>Cheapest supermarkets nearby <Conf level="medium" /></h3>
        <ul className="stores">{['Lidl', 'Aldi', 'Tesco'].map((b) => { const g = area.groceries?.[b]; return (
          <li key={b}><b>{b}</b> {g ? <>{g.walkMinutes} min walk <small>({g.metres >= 1000 ? (g.metres / 1000).toFixed(1) + ' km' : g.metres + ' m'}){g.within1km > 1 ? `, ${g.within1km} within 1 km` : ''}</small></> : <span className="muted">none found nearby</span>}</li>) })}</ul>
        <p className="source">Source: {src.groceries.name}, fetched {src.groceries.fetched}, {src.groceries.licence}. {src.groceries.note}</p>
      </section>

      <section className="fact">
        <h3>Transport at home</h3>
        {area.transit?.nearestStop ? <p>Nearest stop: <b>{area.transit.nearestStop.name}</b>, {area.transit.nearestStop.walkMinutes} min walk.</p> : <p className="muted">No stop within a 10 minute walk.</p>}
        {area.transit?.routes && <p className="routes">{[['Bus', area.transit.routes.bus], ['Luas', area.transit.routes.tram], ['Rail', area.transit.routes.rail]].filter(([, r]) => r?.length).map(([l, r]) => <span key={l}><b>{l}</b> {r.join(', ')}</span>)}</p>}
        <p className="source">Routes with a stop within 10 minutes' walk. Source: {src.transit.name}, {src.transit.licence}.</p>
      </section>

      <div className="actions">
        <a className="btn" href={mapsLink(area, campus, s.mode)} target="_blank" rel="noreferrer">Live route in Google Maps</a>
        <button className="btn ghost" onClick={onCompare}>{inCompare ? 'Remove from compare' : 'Add to compare'}</button>
      </div>
      <p className="disclaimer">Planning aid only. Check live listings and current timetables before you decide.</p>
    </article>
  )
}

function Fact({ title, value, detail, source, conf }) {
  return (
    <section className="fact">
      <h3>{title} <Conf level={conf} /></h3>
      <p className="big">{value}</p>
      <p>{detail}</p>
      <p className="source">Source: {source}</p>
    </section>
  )
}

function Compare({ a, b, s, campus, onClose }) {
  const cols = [a, b]
  const rows = [
    ['Rent per person', (x) => { const r = rentPerPerson(x, s.type); return r ? eur(r.perPerson) : 'No figure' }],
    ['Rent confidence', (x) => CONF[x.rent.confidence]],
    [`To ${SHORT[s.campus]} (${MODES[s.mode].label.toLowerCase()})`, (x) => { const c = commuteFor(x, s.campus, s.mode); return c ? `${c.minutes} min` : 'No journey' }],
    ['Changes', (x) => { const c = commuteFor(x, s.campus, s.mode); return c?.changes ?? '–' }],
    ['Lidl', (x) => x.groceries?.Lidl ? `${x.groceries.Lidl.walkMinutes} min walk` : 'none nearby'],
    ['Aldi', (x) => x.groceries?.Aldi ? `${x.groceries.Aldi.walkMinutes} min walk` : 'none nearby'],
    ['Tesco', (x) => x.groceries?.Tesco ? `${x.groceries.Tesco.walkMinutes} min walk` : 'none nearby'],
    ['Nearest stop', (x) => x.transit?.nearestStop ? `${x.transit.nearestStop.name} (${x.transit.nearestStop.walkMinutes} min)` : 'none within 10 min']
  ]
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Compare two areas" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>Compare</h2><button className="link" onClick={onClose}>Close</button></div>
        <table><thead><tr><th scope="col"><span className="sr">Measure</span></th>{cols.map((c) => <th key={c.id} scope="col">{c.label}</th>)}</tr></thead>
          <tbody>{rows.map(([l, f]) => <tr key={l}><th scope="row">{l}</th>{cols.map((c) => <td key={c.id}>{f(c)}</td>)}</tr>)}</tbody></table>
        <p className="source">Same sources and dates as the area pages. Rent is an average, commute is scheduled time.</p>
      </div>
    </div>
  )
}
