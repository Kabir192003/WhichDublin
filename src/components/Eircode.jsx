import React, { useEffect, useMemo, useState } from 'react'
import MapView from './MapView.jsx'
import { RentTable, Colleges, Groceries, Work, Dock } from './AreaParts.jsx'
import { parseEircode, nearest, haversine } from '../domain/geo.js'
import { streetTable, searchAddress } from '../domain/streets.js'
import { loadNetwork, planFrom, WHEN } from '../domain/route.js'
import { EircodeBox, SHORT, Icon } from './ui.jsx'
import { hasGoogle, geocodeEircode, routeMatrix } from '../domain/google.js'
import GoogleMap from './GoogleMap.jsx'

const BASE = import.meta.env.BASE_URL
const cache = new Map()
const routeCache = new Map()   // this visit only, so going back and forth doesn't repeat paid-tier calls

/** Exact spot from OpenStreetMap when the Eircode is mapped there; otherwise only the district, which is NOT an address. */
async function locate(e, data) {
  if (cache.has(e.full)) return cache.get(e.full)
  let res = null
  if (e.uid && hasGoogle()) {
    try {
      const g = await geocodeEircode(e.full)
      if (g) res = { lat: g.lat, lon: g.lon, precision: g.exact ? 'exact' : 'approx', radius: g.radius, label: g.address, via: 'google' }
    } catch { /* fall back to open data */ }
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

/**
 * Google version, kept inside Google's free monthly allowance: Google gives the exact location (geocoding), the map,
 * and walking routes only (about 15 route elements per lookup). Supermarkets come from our open store list (the two
 * nearest of each chain, then the shorter walk wins), cycling from the OpenStreetMap router, and public transport
 * from our own timetable planner. Throws on any Google failure so the caller can fall back.
 */
async function routeGoogle(point, data) {
  const campuses = data.campuses
  const shopCands = ['Lidl', 'Aldi', 'Tesco'].flatMap((b) => nearest(data.stores.filter((s) => s.brand === b), point, 2).map((x) => x.x))
  const walk = await routeMatrix(point, [...campuses, ...shopCands], 'WALK')
  const [bike, am, late, sat] = await Promise.all([
    streetTable('bike', point, campuses),
    loadNetwork('am', BASE).then((n) => planFrom(n, point, campuses, WHEN.am.departs)).catch(() => null),
    loadNetwork('late', BASE).then((n) => campuses.map((c) => planFrom(n, c, [point], WHEN.late.departs)[0])).catch(() => null),
    loadNetwork('sat', BASE).then((n) => planFrom(n, point, campuses, WHEN.sat.departs)).catch(() => null)
  ])
  const min = (x) => (x ? Math.round(x.secs / 60) : null)
  const colleges = campuses.map((c, i) => ({ id: c.id, name: c.name, km: walk[i]?.metres ? Math.round(walk[i].metres / 100) / 10 : Math.round(haversine(point, c) / 100) / 10, walk: min(walk[i]), cycle: min(bike?.[i]), transit: { am: am?.[i]?.minutes ?? null, late: late?.[i]?.minutes ?? null, sat: sat?.[i]?.minutes ?? null } })).sort((a, b) => a.km - b.km)
  const shops = ['Lidl', 'Aldi', 'Tesco'].map((brand) => {
    const opts = shopCands.map((s, j) => ({ s, r: walk[campuses.length + j] })).filter((o) => o.s.brand === brand && o.r).sort((x, y) => x.r.secs - y.r.secs)
    return opts[0] ? { brand, name: opts[0].s.name, lat: opts[0].s.lat, lon: opts[0].s.lon, walk: min(opts[0].r), metres: opts[0].r.metres } : { brand, walk: null }
  })
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
    return best ? { brand, name: best.s.name, lat: best.s.lat, lon: best.s.lon, walk: min(best.r.secs), metres: best.r.metres } : { brand, walk: null }
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
    locate(e, data).then((r) => { setFound(r); if (r?.precision === 'exact' || r?.precision === 'approx') setPoint(r); else if (r) setPicking(true) })
  }, [code])

  useEffect(() => {
    if (!point) return
    let live = true; setBusy(true); setRoutes(null)
    const k = `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`
    if (!routeCache.has(k)) routeCache.set(k, hasGoogle() ? routeGoogle(point, data).catch(() => routeFrom(point, data)) : routeFrom(point, data))
    const run = routeCache.get(k)
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
  const origin = point && (point.precision === 'pinned' || point.precision === 'address' || !e ? { lat: point.lat, lon: point.lon } : e.full)
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
          {point && point.precision === 'approx' && <p><span className="precision warn">Approximate location</span> Google only knows roughly where this Eircode is, not the exact building. <b>Tap the map at the property</b> (or drag the orange pin) and every time below updates.</p>}
          {point && point.precision !== 'approx' && <p><span className="precision ok"><Icon name="check" size={14} stroke={2.4} />{point.precision === 'exact' ? 'Exact address found' : point.precision === 'address' ? `Using the address you chose` : 'Using the spot you pinned'}</span> All times below are routed from this point.</p>}
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
            {(found?.via === 'google' || routes?.via === 'google') && point ? <GoogleMap point={point} campuses={data.campuses} shops={routes?.shops || []} draggable onMove={(p) => setPoint({ ...p, precision: 'pinned', label: 'your pin' })} /> : <MapView points={area ? [{ id: area.id, name: area.name, lat: area.lat, lon: area.lon, color: '#0B7A65' }] : []} campuses={campuses} pin={pin} fitKey={`${code}-${point ? 'p' : 'd'}`} picking={picking} onPick={(p) => choose(p, 'pinned')} />}
          </div>
          {point && !picking && routes?.via !== 'google' && <p className="hint" style={{ marginTop: -6 }}>Wrong spot? <button className="link" onClick={() => setPicking(true)}>Move the pin</button></p>}

          {point && (busy || !routes) && <p className="notice">Routing from this point: real streets for walking and cycling, and every bus, Luas and train timetable…</p>}
          {point && routes && (
            <div className="grid2" style={{ alignItems: 'start' }}>
              <div>
                <Colleges origin={origin} rows={routes.colleges} data={data} streets={routes.streets} transitFrom={routes.via === 'google' ? 'from this exact address (public transport from our timetable planner; walking from Google Maps; cycling from OpenStreetMap)' : 'from this exact point'} />
                {routes.via === 'google' && <p className="source" style={{ marginTop: -6 }}>Exact location, map and walking routes: Google Maps. Supermarkets: OpenStreetMap. Not stored.</p>}
                <Groceries origin={origin} shops={routes.shops} data={data} />
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
          <p className="disclaimer">{hasGoogle() ? 'Lookups go to Google Maps Platform (and OpenStreetMap services as a fallback): the Eircode you type is sent to them to find it. Nothing is stored by Settld.' : 'Lookups go to OpenStreetMap services: the Eircode or address you type is sent to Nominatim, and your point to the routing service. Nothing is stored by Settld.'}</p>
        </div>
      )}
    </>
  )
}
