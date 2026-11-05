import React, { useEffect, useMemo, useState } from 'react'
import MapView from './MapView.jsx'
import { RentTable, Colleges, Groceries, Work, Dock } from './AreaParts.jsx'
import { parseEircode, fromPoint } from '../domain/geo.js'
import { EircodeBox, SHORT } from './ui.jsx'

const cache = new Map()
async function locate(e, data) {
  if (cache.has(e.full)) return cache.get(e.full)
  let res = null
  if (e.uid) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ie&limit=1&postalcode=${encodeURIComponent(e.full)}`, { headers: { Accept: 'application/json' } })
      const j = r.ok ? await r.json() : []
      if (j[0]) res = { lat: +j[0].lat, lon: +j[0].lon, precision: 'exact', label: e.full }
    } catch { /* fall through to the routing key */ }
  }
  if (!res && data.routingKeys[e.key]) { const k = data.routingKeys[e.key]; res = { lat: k.lat, lon: k.lon, precision: 'area', label: k.label } }
  cache.set(e.full, res)
  return res
}

export default function Eircode({ data, code }) {
  const e = parseEircode(code)
  const [loc, setLoc] = useState(undefined)
  useEffect(() => { setLoc(undefined); if (e) locate(e, data).then(setLoc); else setLoc(null) }, [code])
  const r = useMemo(() => loc && fromPoint(loc, data), [loc, data])
  const campuses = data.campuses.map((c) => ({ ...c, short: SHORT[c.id] }))

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <h1>{e ? e.full : 'Look up an Eircode'}</h1>
          {loc === undefined && e && <p>Finding this Eircode…</p>}
          {loc === null && <p>{e ? `We could not place ${e.full}. Outside Dublin, or not yet in our sources.` : 'Enter a Dublin Eircode.'}</p>}
          {loc && r && <p>{loc.precision === 'exact' ? `Found the exact address. Nearest area we have data for: ${r.area.label} (${(r.areaMetres / 1000).toFixed(1)} km).` : `Full code not found in OpenStreetMap, so this uses the centre of ${loc.label}. Times are approximate.`}</p>}
          <div style={{ marginTop: 16 }}><EircodeBox initial={e ? e.full : ''} /></div>
        </div>
      </section>
      {loc && r && (
        <div className="wrap page-body">
          <div className="card lift" style={{ padding: 0, overflow: 'hidden', height: 340, position: 'relative' }}>
            <MapView points={data.areas.filter((a) => a.id === r.area.id).map((a) => ({ id: a.id, name: a.name, lat: a.lat, lon: a.lon, color: '#0B7A65' }))} campuses={campuses} pin={{ lat: loc.lat, lon: loc.lon, label: e.full }} fitKey={code} />
          </div>
          <div className="grid2" style={{ alignItems: 'start' }}>
            <div>
              <Colleges rows={r.colleges} data={data} transitFrom={`the centre of ${r.area.label}, the nearest area we have timetable results for`} />
              <Groceries shops={r.shops} data={data} />
              <Dock home={r.dock} data={data} />
            </div>
            <div>
              {r.area.work && <Work work={r.area.work} data={data} hubs={r.hubs} />}
              <RentTable area={r.area} data={data} />
              <p className="hint">Rent shown for {r.area.label}, the nearest area with RTB figures.</p>
              <a className="btn ghost" href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lon}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
            </div>
          </div>
          <p className="disclaimer">Address lookup uses OpenStreetMap's Nominatim service; the Eircode you type is sent to it to find the location. Planning aid only.</p>
        </div>
      )}
    </>
  )
}
