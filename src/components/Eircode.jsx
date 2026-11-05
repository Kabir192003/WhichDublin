import React, { useEffect, useMemo, useState } from 'react'
import MapView from './MapView.jsx'
import { RentTable, Colleges, Groceries, Work, Dock } from './AreaParts.jsx'
import { parseEircode, nearest, haversine } from '../domain/geo.js'
import { streetTable, searchAddress } from '../domain/streets.js'
import { loadNetwork, planFrom, WHEN } from '../domain/route.js'
import { EircodeBox, SHORT, Icon } from './ui.jsx'
import { hasGoogle, geocodeEircode, nearestStore, routeMatrix } from '../domain/google.js'
import GoogleMap from './GoogleMap.jsx'

const BASE = import.meta.env.BASE_URL
const cache = new Map()

/** Exact spot from OpenStreetMap when the Eircode is mapped there; otherwise only the district, which is NOT an address. */
async function locate(e, data) {
  if (cache.has(e.full)) return cache.get(e.full)
  let res = null
  if (e.uid && hasGoogle()) {
    try { const g = await geocodeEircode(e.full); if (g?.exact) res = { lat: g.lat, lon: g.lon, precision: 'exact', label: g.address, via: 'google' } } catch { /* fall back to open data */ }
  }
  if (!res && e.uid) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ie&limit=1&postalcode=${encodeURIComponent(e.full)}`)
      const j = r.ok ? await r.json() : []
      if (j[0]) res = { lat: +j[0].lat, lon: +j[0].lon, precision: 'exact', label: e.full }
    } catch { /* fall through */ }
  }
  if (!res && data.routingKeys[e.key]) { const k = data.routingKeys[e.key]; res = { lat: k.lat, lon: k.lon, precision: 'district', label: k.label } }
  cache.set(e.full, res)
  return res
}

/** Google version: stores from Places, routes from the Routes API. Throws on any failure so the caller can fall back. */
async function routeGoogle(point, data) {
  const campuses = data.campuses
  const stores = await Promise.all(['Lidl', 'Aldi', 'Tesco'].map((b) => nearestStore(b, point)))
  const found = stores.filter((x) => x.name)
  const [walk, bike, transit] = await Promise.all([
    routeMatrix(point, [...campuses, ...found], 'WALK'),
    routeMatrix(point, campuses, 'BICYCLE'),
    routeMatrix(point, campuses, 'TRANSIT')
  ])
  const [late, sat] = await Promise.all([
    loadNetwork('late', BASE).then((n) => campuses.map((c) => planFrom(n, c, [point], WHEN.late.departs)[0])).catch(() => null),
    loadNetwork('sat', BASE).then((n) => planFrom(n, point, campuses, WHEN.sat.departs)).catch(() => null)
  ])
  const min = (x) => (x ? Math.round(x.secs / 60) : null)
  const colleges = campuses.map((c, i) => ({ id: c.id, name: c.name, km: walk[i]?.metres ? Math.round(walk[i].metres / 100) / 10 : Math.round(haversine(point, c) / 100) / 10, walk: min(walk[i]), cycle: min(bike[i]), transit: { am: min(transit[i]), late: late?.[i]?.minutes ?? null, sat: sat?.[i]?.minutes ?? null } })).sort((a, b) => a.km - b.km)
  const shops = stores.map((st) => { const j = found.indexOf(st); const w = j >= 0 ? walk[campuses.length + j] : null; return st.name ? { brand: st.brand, name: st.name, address: st.address, lat: st.lat, lon: st.lon, walk: min(w), metres: w?.metres ?? null } : { brand: st.brand, walk: null } })
  const [dk] = nearest(data.docks || [], point)
  return { colleges, shops, dock: dk && dk.m < 2500 ? { name: dk.x.name, walk: Math.round(dk.m * 1.3 / 1.25 / 60) } : null, streets: true, via: 'google' }
}

/** Everything routed live from one exact point: street walking and cycling, and timetabled public transport. */
async function routeFrom(point, data) {
  const campuses = data.campuses
  const shopCands = ['Lidl', 'Aldi', 'Tesco'].flatMap((b) => nearest(data.stores.filter((s) => s.brand === b), point, 3).map((x) => ({ ...x.x })))
  const dockCands = nearest(data.docks || [], point, 3).filter((x) => x.m < 2500).map((x) => x.x)
  const dests = [...campuses, ...shopCands, ...dockCands]
  const streetsP = streetTable('foot', point, dests).then(async (f) => [f, await streetTable('bike', point, campuses)])
  const [[foot, bike], am, late, sat] = await Promise.all([
    streetsP,
    loadNetwork('am', BASE).then((n) => planFrom(n, point, campuses, WHEN.am.departs)).catch(() => null),
    loadNetwork('late', BASE).then((n) => campuses.map((c) => planFrom(n, c, [point], WHEN.late.departs)[0])).catch(() => null),
    loadNetwork('sat', BASE).then((n) => planFrom(n, point, campuses, WHEN.sat.departs)).catch(() => null)
  ])
  const min = (s) => s ? Math.round(s / 60) : null
  const colleges = campuses.map((c, i) => ({
    id: c.id, name: c.name,
    km: foot?.[i] ? Math.round(foot[i].metres / 100) / 10 : Math.round(haversine(point, c) / 100) / 10,
    walk: foot?.[i] ? min(foot[i].secs) : null, cycle: bike?.[i] ? min(bike[i].secs) : null,
    transit: { am: am?.[i]?.minutes ?? null, late: late?.[i]?.minutes ?? null, sat: sat?.[i]?.minutes ?? null }
  })).sort((a, b) => a.km - b.km)
  const shops = ['Lidl', 'Aldi', 'Tesco'].map((brand) => {
    const opts = shopCands.map((s, j) => ({ s, r: foot?.[campuses.length + j] })).filter((o) => o.s.brand === brand && o.r)
    const best = opts.sort((a, b) => a.r.secs - b.r.secs)[0]
    return best ? { brand, walk: min(best.r.secs), metres: best.r.metres } : { brand, walk: null }
  })
  const docks = dockCands.map((d, j) => ({ d, r: foot?.[campuses.length + shopCands.length + j] })).filter((o) => o.r).sort((a, b) => a.r.secs - b.r.secs)
  const dock = docks[0] ? { name: docks[0].d.name, walk: min(docks[0].r.secs) } : null
  return { colleges, shops, dock, streets: !!foot }
}

export default function Eircode({ data, code }) {
  const e = parseEircode(code)
  const [found, setFound] = useState(undefined)         // what the Eircode lookup returned
  const [point, setPoint] = useState(null)               // the exact spot we route from
  const [picking, setPicking] = useState(false)
  const [routes, setRoutes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [addr, setAddr] = useState(''), [addrRes, setAddrRes] = useState(null)

  useEffect(() => {
    setFound(undefined); setPoint(null); setRoutes(null); setPicking(false); setAddrRes(null)
    if (!e) { setFound(null); return }
    locate(e, data).then((r) => { setFound(r); if (r?.precision === 'exact') setPoint(r); else if (r) setPicking(true) })
  }, [code])

  useEffect(() => {
    if (!point) return
    let live = true; setBusy(true); setRoutes(null)
    const run = hasGoogle() ? routeGoogle(point, data).catch(() => routeFrom(point, data)) : routeFrom(point, data)
    run.then((r) => { if (live) { setRoutes(r); setBusy(false) } })
    return () => { live = false }
  }, [point])

  const near = useMemo(() => point && nearest(data.areas, point, 8), [point, data])
  const area = near?.[0]?.x
  const hubs = useMemo(() => {
    if (!near) return null
    const out = {}
    for (const cat of ['retail', 'food', 'hotels', 'leisure']) { const b = near.filter((a) => a.m <= 3000 && a.x.work?.[cat]).sort((p, q) => q.x.work[cat].n - p.x.work[cat].n)[0]; if (b) out[cat] = { name: b.x.label } }
    return out
  }, [near])
  const campuses = data.campuses.map((c) => ({ ...c, short: SHORT[c.id] }))
  const pin = point || (found && { ...found })

  const findAddress = async (ev) => { ev.preventDefault(); if (addr.trim().length < 3) return; setAddrRes(await searchAddress(addr.trim())) }
  const choose = (p, how) => { setPoint({ lat: p.lat, lon: p.lon, precision: how, label: p.label || 'your pin' }); setPicking(false); setAddrRes(null) }

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <h1>{e ? e.full : 'Look up an Eircode'}</h1>
          {found === undefined && e && <p>Finding this Eircode…</p>}
          {found === null && <p>{e ? `We could not place ${e.full}. Is it a Dublin Eircode?` : 'Enter a Dublin Eircode.'}</p>}
          {point && <p><span className="precision ok"><Icon name="check" size={14} stroke={2.4} />{point.precision === 'exact' ? 'Exact address found' : point.precision === 'address' ? `Using the address you chose` : 'Using the spot you pinned'}</span> All times below are routed from this point.</p>}
          {found?.precision === 'district' && !point && <p><span className="precision warn">Exact spot not in open map data</span> Only {found.label} is known. Pin the place on the map or search its street address below.</p>}
          <div style={{ marginTop: 16 }}><EircodeBox initial={e ? e.full : ''} /></div>
        </div>
      </section>

      {found && (
        <div className="wrap page-body">
          {picking && (
            <div className="card lift">
              <div className="pickbar"><Icon name="pin" /> <span style={{ flex: 1 }}><b>Where exactly is it?</b> Eircodes are only partly in open map data. The orange dot is just the centre of {found.label}, not the property. Click the map at the property, or search its street address.</span></div>
              <form onSubmit={findAddress} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label htmlFor="addr" className="sr">Street address</label>
                <input id="addr" className="select" style={{ flex: '1 1 260px', minHeight: 46, fontWeight: 500 }} placeholder="e.g. 12 Main Street, Blanchardstown" value={addr} onChange={(ev) => setAddr(ev.target.value)} />
                <button className="btn" type="submit">Search address</button>
              </form>
              {addrRes && (addrRes.length ? <ul className="addr-results">{addrRes.map((r, i) => <li key={i}><button onClick={() => choose(r, 'address')}>{r.label}</button></li>)}</ul> : <p className="hint">No match in the Dublin area. Try fewer words, or pin it on the map.</p>)}
            </div>
          )}
          <div className="card lift" style={{ padding: 0, overflow: 'hidden', height: picking ? 440 : 340, position: 'relative' }}>
            {routes?.via === 'google' ? <GoogleMap point={point} campuses={data.campuses} shops={routes.shops} /> : <MapView points={area ? [{ id: area.id, name: area.name, lat: area.lat, lon: area.lon, color: '#0B7A65' }] : []} campuses={campuses} pin={pin} fitKey={`${code}-${point ? 'p' : 'd'}`} picking={picking} onPick={(p) => choose(p, 'pinned')} />}
          </div>
          {point && !picking && routes?.via !== 'google' && <p className="hint" style={{ marginTop: -6 }}>Wrong spot? <button className="link" onClick={() => setPicking(true)}>Move the pin</button></p>}

          {point && (busy || !routes) && <p className="notice">Routing from this point: real streets for walking and cycling, and every bus, Luas and train timetable…</p>}
          {point && routes && (
            <div className="grid2" style={{ alignItems: 'start' }}>
              <div>
                <Colleges rows={routes.colleges} data={data} streets={routes.streets} transitFrom={routes.via === 'google' ? 'from this exact address; weekday 8am times from Google Maps, night and Saturday from our timetable planner' : 'from this exact point'} />
                {routes.via === 'google' && <p className="source" style={{ marginTop: -6 }}>Location, supermarkets and weekday routes: Google Maps. Not stored.</p>}
                <Groceries shops={routes.shops} data={data} />
                {routes.dock && <Dock home={routes.dock} data={data} />}
                {!routes.streets && <p className="notice-inline">The street-routing service did not answer, so walking and cycling times are missing. Try again in a minute.</p>}
              </div>
              <div>
                {area?.work && <Work work={area.work} data={data} hubs={hubs} />}
                {area && <RentTable area={area} data={data} />}
                {area && <p className="hint">Work and rent figures are for {area.label}, the nearest area with RTB figures ({(near[0].m / 1000).toFixed(1)} km).</p>}
                <a className="btn ghost" href={`https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lon}`} target="_blank" rel="noreferrer">Check in Google Maps</a>
              </div>
            </div>
          )}
          <p className="disclaimer">{hasGoogle() ? 'Lookups go to Google Maps Platform (and OpenStreetMap services as a fallback): the Eircode you type is sent to them to find it. Nothing is stored by Which Dublin.' : 'Lookups go to OpenStreetMap services: the Eircode or address you type is sent to Nominatim, and your point to the routing service. Nothing is stored by Which Dublin.'}</p>
        </div>
      )}
    </>
  )
}
