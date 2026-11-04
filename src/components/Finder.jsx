import React, { useMemo, useState } from 'react'
import MapView from './MapView.jsx'
import Controls from './Controls.jsx'
import Detail from './Detail.jsx'
import Compare from './Compare.jsx'
import { rankAreas, PRESETS } from '../domain/rank.js'
import { RENT_TYPES, MODES, buildRows } from '../domain/model.js'
import { eur, SHORT } from './ui.jsx'

export default function Finder({ data, s, set }) {
  const [selected, setSelected] = useState(null)
  const [compare, setCompare] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [tab, setTab] = useState('list')
  const [editing, setEditing] = useState(false)
  const [q, setQ] = useState('')
  const campus = data.campuses.find((c) => c.id === s.campus)

  const rows = useMemo(() => buildRows(data.areas, s), [data, s.campus, s.type, s.mode])
  const result = useMemo(() => rankAreas(rows, { budget: s.budget, weights: PRESETS[s.priority].weights }), [rows, s.budget, s.priority])
  const byId = useMemo(() => Object.fromEntries(data.areas.map((a) => [a.id, a])), [data])
  const rowById = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows])
  const scoreOf = Object.fromEntries(result.ranked.map((r) => [r.id, r]))
  const filtered = result.ranked.filter((r) => !q || byId[r.id].label.toLowerCase().includes(q.toLowerCase()))

  const points = data.areas.map((a) => {
    const r = scoreOf[a.id]
    const color = !r ? '#cdd5dd' : r.rank <= 3 ? '#1b6b57' : r.score > 0.5 ? '#4f86a8' : '#8a97a6'
    return { id: a.id, name: a.name, lat: a.lat, lon: a.lon, color, shown: !!r }
  })
  const toggleCompare = (id) => setCompare((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length >= 2 ? [c[1], id] : [...c, id])
  const area = selected && byId[selected]
  const timeLabel = s.mode === 'transit' ? 'scheduled' : 'estimate'

  return (
    <div className="finder" data-tab={tab}>
      <div className="tabs" role="tablist" aria-label="View">
        <button role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>List</button>
        <button role="tab" aria-selected={tab === 'map'} onClick={() => setTab('map')}>Map</button>
      </div>
      <aside className="panel" aria-label="Areas">
        {area ? (
          <Detail area={area} s={s} campus={campus} row={rowById[area.id]} rank={scoreOf[area.id]} data={data}
            onBack={() => setSelected(null)} inCompare={compare.includes(area.id)} onCompare={() => toggleCompare(area.id)} />
        ) : (
          <>
            <section className="summary" aria-label="Your choices">
              <p className="sumline"><b>{SHORT[s.campus]}</b> · {RENT_TYPES[s.type].label.toLowerCase()} · up to <b>{eur(s.budget)}</b> each · {MODES[s.mode].label.toLowerCase()} · {PRESETS[s.priority].label.toLowerCase()}</p>
              <button className="btn ghost sm" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Change'}</button>
              {editing && <div className="editbox"><Controls data={data} s={s} set={set} /></div>}
            </section>

            <section className="results" aria-label="Ranked areas">
              <div className="results-head">
                <h2>{result.ranked.length} {result.ranked.length === 1 ? 'area fits' : 'areas fit'} your budget</h2>
                <input className="search" type="search" placeholder="Search areas" aria-label="Search areas" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <p className="hint">Best match first. Tap an area for the details. Rent is a published average, not a quote.</p>

              {compare.length > 0 && (
                <div className="compare-bar" role="status">
                  <span>{compare.length === 1 ? 'Pick one more area to compare' : '2 areas picked'}</span>
                  <button className="btn sm" disabled={compare.length < 2} onClick={() => setShowCompare(true)}>Compare</button>
                  <button className="link" onClick={() => setCompare([])}>Clear</button>
                </div>)}

              {result.ranked.length === 0 && (
                <div className="notice-inline">
                  {result.overBudget.length ? <>Nothing fits {eur(s.budget)} a month for {RENT_TYPES[s.type].short}. The cheapest is <b>{byId[result.overBudget[0].id].label}</b> at {eur(rowById[result.overBudget[0].id].rent)}.{' '}
                    <button className="link" onClick={() => set({ budget: Math.min(2500, Math.ceil(rowById[result.overBudget[0].id].rent / 25) * 25) })}>Raise budget to {eur(Math.ceil(rowById[result.overBudget[0].id].rent / 25) * 25)}</button></>
                    : <>No areas have a published figure for this setup. Try a different size of home.</>}
                </div>)}

              <ol className="list">
                {filtered.map((r) => {
                  const a = byId[r.id], row = rowById[r.id], on = compare.includes(r.id)
                  return (
                    <li key={r.id} className="card-item">
                      <button className="card-main" onClick={() => setSelected(r.id)} aria-label={`${a.label}, rank ${r.rank}. Open details`}>
                        <span className="card-top"><span className="rank">{r.rank}</span><span className="name">{a.label}</span>{r.rank <= 3 && <span className="pick">Top pick</span>}</span>
                        <span className="stats">
                          <span className="stat"><b>{eur(row.rent)}</b><small>your share a month</small></span>
                          <span className="stat"><b>{row._commute.minutes} min</b><small>to {SHORT[s.campus]} ({timeLabel})</small></span>
                          <span className="stat"><b>{a.nearestBudgetGroceryMinutes ?? '–'} min</b><small>walk to Lidl or Aldi</small></span>
                        </span>
                      </button>
                      <button className={`cmp ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleCompare(r.id)}>{on ? '✓ Added' : '+ Compare'}</button>
                    </li>)
                })}
              </ol>

              {result.overBudget.length > 0 && (
                <details className="more"><summary>{result.overBudget.length} {result.overBudget.length === 1 ? 'area is' : 'areas are'} over budget</summary>
                  <ul>{result.overBudget.slice(0, 15).map((o) => <li key={o.id}><button className="link" onClick={() => setSelected(o.id)}>{byId[o.id].label}</button> <span className="muted">{eur(o.over)} over</span></li>)}</ul></details>)}
              {result.missing.length > 0 && (
                <details className="more"><summary>{result.missing.length} {result.missing.length === 1 ? 'area has' : 'areas have'} no figure for this setup</summary>
                  <p className="muted">The RTB did not publish an average for this size of home there, or there is no usable journey to {SHORT[s.campus]}. We leave it blank rather than guess.</p>
                  <ul>{result.missing.map((id) => <li key={id}>{byId[id].label}</li>)}</ul></details>)}
            </section>
          </>
        )}
      </aside>

      <section className="mapwrap" aria-label="Map">
        <MapView campus={{ ...campus, short: SHORT[campus.id] }} points={points} selectedId={selected} onSelect={(id) => { setSelected(id); setTab('list') }} />
        <div className="legend" aria-hidden="true">
          <span><i style={{ background: '#1b6b57' }} />Top 3</span><span><i style={{ background: '#4f86a8' }} />Good match</span><span><i style={{ background: '#8a97a6' }} />Fits budget</span><span><i style={{ background: '#cdd5dd' }} />Over budget / no data</span><span><i className="sq" />{SHORT[s.campus]}</span>
        </div>
      </section>
      {showCompare && compare.length === 2 && <Compare a={byId[compare[0]]} b={byId[compare[1]]} s={s} onClose={() => setShowCompare(false)} />}
    </div>
  )
}
