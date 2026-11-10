import React, { useEffect, useMemo, useState } from 'react'
import MapView from './MapView.jsx'
import Detail from './Detail.jsx'
import Controls from './Controls.jsx'
import { SaveButton, ShortlistBar } from './Shortlist.jsx'
import { rankAreas, PRESETS } from '../domain/rank.js'
import { RENT_TYPES, HOME_TYPES, MODES, WORK_CATEGORIES, buildRows, workMix } from '../domain/model.js'
import { eur, SHORT, Pill, HOW_CHIP, Icon, Modal, ExploreSwitch } from './ui.jsx'

const BUDGETS = Array.from({ length: 23 }, (_, i) => 400 + i * 100)
const MODE_LABEL = { transit: 'Bus / Luas', bikeshare: 'Dublinbikes', cycle: 'Own bike', walk: 'Walk' }

export default function Finder({ data, s, set, initial }) {
  const [selected, setSelected] = useState(initial || null)
  useEffect(() => { if (initial) setSelected(initial) }, [initial])
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState('list')
  const [q, setQ] = useState('')
  const campus = data.campuses.find((c) => c.id === s.campus)

  const rows = useMemo(() => buildRows(data.areas, s), [data, s.campus, s.type, s.mode, s.ptype])
  const result = useMemo(() => rankAreas(rows, { budget: s.budget, weights: PRESETS[s.priority].weights }), [rows, s.budget, s.priority])
  const byId = useMemo(() => Object.fromEntries(data.areas.map((a) => [a.id, a])), [data])
  const rowById = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows])
  const scoreOf = Object.fromEntries(result.ranked.map((r) => [r.id, r]))
  const filtered = result.ranked.filter((r) => !q || byId[r.id].label.toLowerCase().includes(q.toLowerCase()))

  const points = data.areas.map((a) => {
    const r = scoreOf[a.id]
    const color = !r ? '#C3CCC8' : r.rank <= 3 ? '#E8613C' : r.score > 0.5 ? '#0B7A65' : '#7FB5A8'
    return { id: a.id, name: a.name, lat: a.lat, lon: a.lon, color, shown: !!r }
  })
  const area = selected && byId[selected]
  const budgets = BUDGETS.includes(s.budget) ? BUDGETS : [...BUDGETS, s.budget].sort((a, b) => a - b)
  const timeNote = s.mode === 'transit' ? 'at 8am' : 'estimate'
  const pick = (id) => { setSelected(id); setTab('list') }

  return (
    <div className="finder" data-tab={tab}>
      <div className="filters" role="group" aria-label="Your choices">
        <ExploreSwitch view="matched" />
        <span className="sep" />
        <button type="button" className="filter-summary" onClick={() => setEditing(true)}><span>{SHORT[s.campus]} · up to {eur(s.budget)} · {RENT_TYPES[s.type].label} · {MODE_LABEL[s.mode]}</span><b>Edit</b></button>
        <Pill className="collapsible" label="College" value={s.campus} onChange={(v) => set({ campus: v })} options={data.campuses.map((c) => [c.id, SHORT[c.id]])} />
        <Pill className="collapsible" label="Living" value={s.type} onChange={(v) => set({ type: v })} options={Object.entries(RENT_TYPES).map(([k, v]) => [k, v.label])} />
        <Pill className="collapsible" label="Home" value={s.ptype} onChange={(v) => set({ ptype: v })} options={Object.entries(HOME_TYPES)} />
        <Pill className="collapsible" label="Budget" value={s.budget} onChange={(v) => set({ budget: Number(v) })} options={budgets.map((b) => [b, `up to ${eur(b)}`])} />
        <Pill className="collapsible" label="Travel" value={s.mode} onChange={(v) => set({ mode: v })} options={Object.keys(MODES).map((k) => [k, MODE_LABEL[k]])} />
      </div>
      <div className="tabs" role="tablist" aria-label="View">
        <button role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>List</button>
        <button role="tab" aria-selected={tab === 'map'} onClick={() => setTab('map')}>Map</button>
      </div>

      <aside className="panel" aria-label="Areas">
        {area ? (
          <Detail area={area} s={s} campus={campus} rank={scoreOf[area.id]} data={data}
            onBack={() => setSelected(null)} />
        ) : (
          <>
            <ShortlistBar />
            <div className="res-head">
              <h1>{result.ranked.length} {result.ranked.length === 1 ? 'area fits' : 'areas fit'} your budget</h1>
              <Pill label="Sort" value={s.priority} onChange={(v) => set({ priority: v })} options={Object.entries(PRESETS).map(([k, v]) => [k, v.label])} />
            </div>
            <input className="select" style={{ width: '100%', minHeight: 40, marginBottom: 8 }} type="search" placeholder="Search these areas by name" aria-label="Search areas" value={q} onChange={(e) => setQ(e.target.value)} />
            <p className="hint" style={{ margin: 0 }}>{PRESETS[s.priority].label} first, for {RENT_TYPES[s.type].short}{s.ptype !== 'any' ? `, ${HOME_TYPES[s.ptype].toLowerCase()}` : ''}. Rent is an area average, not a quote.</p>
            <details className="explain"><summary>How the order is worked out</summary>
              <p>Areas over your budget are set aside. The rest are compared with each other on three things: rent, travel time to {SHORT[s.campus]} and the walk to a Lidl or Aldi. Your sort choice decides how much each one counts. The number is a position in this list for your choices, not a rating of the area, and it says nothing about safety or what a place is like to live in. <a href="#/method">Sources and methods</a></p></details>

            {result.ranked.length === 0 && (
              <div className="notice-inline">
                {result.overBudget.length ? <>Nothing fits {eur(s.budget)} a month for {RENT_TYPES[s.type].short}. The cheapest is <b>{byId[result.overBudget[0].id].label}</b> at {eur(rowById[result.overBudget[0].id].rent)}.{' '}
                  <button className="link" onClick={() => set({ budget: Math.ceil(rowById[result.overBudget[0].id].rent / 100) * 100 })}>Raise my budget to {eur(Math.ceil(rowById[result.overBudget[0].id].rent / 100) * 100)}</button></>
                  : <>No areas have a usable journey for this travel mode. Try another.</>}
              </div>)}

            <ol className="list">
              {filtered.map((r) => {
                const a = byId[r.id], row = rowById[r.id], mix = workMix(a, data.areas)
                return (
                  <li key={r.id} className={`acard ${selected === r.id ? 'sel' : ''}`}>
                    <div className="ahead">
                      <span className={`rank ${r.rank <= 3 ? 'top' : ''}`} title={`Position ${r.rank} for your choices`}>{r.rank}</span>
                      <button className="aname" onClick={() => pick(r.id)}><b>{a.name}</b><span>{a.district ? `Dublin ${a.district.slice(1)}` : 'Co. Dublin'}</span></button>
                      <SaveButton id={r.id} small />
                    </div>
                    <button className="stats" onClick={() => pick(r.id)} aria-label={`Open ${a.label}`}>
                      <span className="stat s-rent"><b>{eur(row.rent)}</b><small>your share / month</small></span>
                      <span className="stat s-time"><b>{row._commute.minutes} min</b><small>to {SHORT[s.campus]} {timeNote}</small></span>
                      <span className="stat s-groc"><b>{a.nearestBudgetGroceryMinutes ?? '–'} min</b><small>walk to Lidl/Aldi</small></span>
                    </button>
                    <div className="tags">
                      <span className={`chip ${row._rent.how === 'published' ? 'pub' : row._rent.how}`}>{HOW_CHIP[row._rent.how]}</span>
                      {mix?.top && <span className="chip">Good for {WORK_CATEGORIES[mix.top].label.toLowerCase()} work</span>}
                      {a.nearestDock && a.nearestDock.walkMinutes <= 6 && <span className="chip">Dublinbikes {a.nearestDock.walkMinutes} min</span>}
                      {a.transit?.routes?.tram?.length > 0 && <span className="chip">Luas {a.transit.routes.tram.join(' / ')}</span>}
                    </div>
                  </li>)
              })}
            </ol>

            {result.overBudget.length > 0 && (
              <details className="more"><summary>{result.overBudget.length} {result.overBudget.length === 1 ? 'area is' : 'areas are'} over budget</summary>
                <ul>{result.overBudget.slice(0, 20).map((o) => <li key={o.id}><button className="link" onClick={() => pick(o.id)}>{byId[o.id].label}</button> <span className="muted">{eur(o.over)} over</span></li>)}</ul></details>)}
            {result.missing.length > 0 && (
              <details className="more"><summary>{result.missing.length} {result.missing.length === 1 ? 'area has' : 'areas have'} no {MODE_LABEL[s.mode].toLowerCase()} journey to {SHORT[s.campus]}</summary>
                <ul>{result.missing.map((id) => <li key={id}>{byId[id].label}</li>)}</ul></details>)}
          </>
        )}
      </aside>

      <section className="mapwrap" aria-label="Map">
        <MapView points={points} campuses={[{ ...campus, short: SHORT[campus.id] }]} selectedId={selected} onSelect={pick} fitKey={campus.id} />
        <div className="legend" aria-hidden="true">
          <span><i style={{ background: '#E8613C' }} />Top 3</span><span><i style={{ background: '#0B7A65' }} />Good match</span><span><i style={{ background: '#7FB5A8' }} />Fits budget</span><span><i style={{ background: '#C3CCC8' }} />Over budget</span><span><i style={{ background: '#10212B', boxShadow: '0 0 0 2px #F4B740' }} />{SHORT[s.campus]}</span>
        </div>
      </section>
      {editing && (
        <Modal title="Your choices" onClose={() => setEditing(false)} width={520}>
          <Controls data={data} s={s} set={set} />
          <div className="field" style={{ marginTop: 18 }}>
            <span className="flabel" id="sort-l">Show first</span>
            <div className="choices" role="group" aria-labelledby="sort-l">{Object.entries(PRESETS).map(([k, v]) => <button key={k} type="button" className="choice" aria-pressed={s.priority === k} onClick={() => set({ priority: k })}>{v.label}</button>)}</div>
          </div>
          <button className="btn block" style={{ marginTop: 20 }} onClick={() => setEditing(false)}>Show {result.ranked.length} {result.ranked.length === 1 ? 'area' : 'areas'}</button>
        </Modal>)}
    </div>
  )
}
