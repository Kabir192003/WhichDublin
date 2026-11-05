import React, { useMemo, useState } from 'react'
import MapView from './MapView.jsx'
import { Essentials, RoomReports, RentTable, Colleges, collegeRowsForArea, Groceries, shopsForArea, Work, Dock } from './AreaParts.jsx'
import { eur, SHORT, Icon } from './ui.jsx'
import { SaveButton } from './Shortlist.jsx'

const SCALE = ['#BFE3D8', '#7FC2AE', '#2E9A80', '#0B6B57', '#0B3F37']

/** Browse every area with no setup: a map coloured by typical rent, and a panel for whichever area you click. */
export default function Explore({ data }) {
  const [sel, setSel] = useState(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')
  const [tab, setTab] = useState('list')
  const rent = (a) => a.rent.cells['all:any'].v
  const breaks = useMemo(() => { const v = data.areas.map(rent).sort((a, b) => a - b); return [0.2, 0.4, 0.6, 0.8].map((p) => v[Math.floor(p * v.length)]) }, [data])
  const color = (v) => SCALE[breaks.filter((b) => v >= b).length]
  const points = useMemo(() => data.areas.map((a) => ({ id: a.id, name: a.name, lat: a.lat, lon: a.lon, color: color(rent(a)) })), [data, breaks])
  const campuses = data.campuses.map((c) => ({ ...c, short: SHORT[c.id] }))
  const list = data.areas.filter((a) => !q || a.label.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'rent' ? rent(a) - rent(b) : sort === 'district' ? (a.district || 'Z').localeCompare(b.district || 'Z', undefined, { numeric: true }) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name))
  const area = sel && data.areas.find((a) => a.id === sel)
  const pick = (id) => { setSel(id); setTab('list') }

  return (
    <div className="finder" data-tab={tab}>
      <div className="filters">
        <strong style={{ fontSize: 15 }}>Explore all {data.areas.length} areas</strong>
        <span className="hint">Click any dot or name. No setup needed.</span>
        <label className="pill grow" htmlFor="ex-sort"><span className="k">Sort</span>
          <select id="ex-sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">A to Z</option><option value="rent">Cheapest first</option><option value="district">By postal district</option></select>
          <span className="chev"><Icon name="chev" size={14} stroke={2.2} /></span></label>
      </div>
      <div className="tabs" role="tablist" aria-label="View">
        <button role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>{area ? area.name : 'List'}</button>
        <button role="tab" aria-selected={tab === 'map'} onClick={() => setTab('map')}>Map</button>
      </div>

      <aside className="panel" aria-label="Areas">
        {area ? (
          <article className="detail">
            <button className="link back" onClick={() => setSel(null)}><Icon name="back" size={16} />All areas</button>
            <h1>{area.label}</h1>
            {area.about && <p className="about">{area.about.text} <a href={area.about.url} target="_blank" rel="noreferrer">Wikipedia</a></p>}
            <div className="glance">
              <div className="stat s-rent"><b>{eur(area.rent.cells['1:any'].v)}</b><small>1-bed average</small></div>
              <div className="stat s-time"><b>{eur(area.rent.cells['2:any'].v)}</b><small>2-bed average</small></div>
              <div className="stat s-groc"><b>{eur(area.rent.cells['3:any'].v)}</b><small>3-bed average</small></div>
            </div>
            <div className="actions"><SaveButton id={area.id} /><a className="btn sm" href={`#/areas`}>Rank areas for my needs</a></div>
            <RentTable area={area} data={data} />
            <RoomReports area={area} />
            <Colleges rows={collegeRowsForArea(area, data)} data={data} streets={!!data.sources.streets} origin={{ lat: area.lat, lon: area.lon }} originLabel={`the centre of ${area.name}`} />
            <Groceries shops={shopsForArea(area)} data={data} origin={{ lat: area.lat, lon: area.lon }} />
            <Essentials area={area} data={data} origin={{ lat: area.lat, lon: area.lon }} />
      <Dock origin={{ lat: area.lat, lon: area.lon }} home={area.nearestDock} data={data} />
            {area.work && <Work work={area.work} data={data} />}
          </article>
        ) : (
          <>
            <div className="res-head">
              <h1>All areas</h1>
              <input className="select" style={{ minHeight: 40, maxWidth: 220, fontWeight: 500 }} type="search" placeholder="Search areas" aria-label="Search areas" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <ul className="list">
              {list.map((a) => (
                <li key={a.id}>
                  <button className="acard" style={{ width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer', flexDirection: 'row', alignItems: 'center' }} onClick={() => pick(a.id)}>
                    <span className="rank" style={{ background: color(rent(a)), color: rent(a) >= breaks[2] ? '#fff' : 'var(--ink)' }} aria-hidden="true"><Icon name="home" size={16} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', fontSize: 16 }}>{a.label}</b><span className="hint">1-bed {eur(a.rent.cells['1:any'].v)} · 2-bed {eur(a.rent.cells['2:any'].v)} · {a.toCampus.tcd.distanceKm} km to Trinity</span></span>
                    <Icon name="arrow" size={16} />
                  </button>
                </li>))}
            </ul>
          </>
        )}
      </aside>

      <section className="mapwrap" aria-label="Map">
        <MapView points={points} campuses={campuses} selectedId={sel} onSelect={pick} fitKey="explore" />
        <div className="legend" aria-hidden="true">
          <b style={{ fontSize: 12 }}>Typical rent, all homes</b>
          {SCALE.map((c, i) => <span key={c}><i style={{ background: c }} />{i === 0 ? `under ${eur(breaks[0])}` : i === 4 ? `${eur(breaks[3])} and up` : `${eur(breaks[i - 1])} to ${eur(breaks[i])}`}</span>)}
          <span><i style={{ background: '#10212B', boxShadow: '0 0 0 2px #F4B740' }} />College</span>
        </div>
      </section>
    </div>
  )
}
