import React, { useEffect, useState } from 'react'
import { getJson, ago } from '../domain/api.js'

const label = (r) => r.medianMin == null ? 'no data' : r.medianMin <= 1 ? 'on time' : r.medianMin < 0 ? 'early' : `${r.medianMin} min late`
const tone = (r) => r.medianMin == null ? '' : r.medianMin <= 2 ? 'pub' : r.medianMin <= 5 ? 'carried' : 'estimated'

/** Live delay of the routes near an area, refreshed every 60 s while the page is open. Renders nothing if unavailable. */
export function LiveRoutes({ routes }) {
  const keys = [...(routes?.bus || []).map((x) => `bus:${x}`), ...(routes?.tram || []).map((x) => `tram:${x}`), ...(routes?.rail || []).map((x) => `rail:${x}`)].slice(0, 40)
  const [d, setD] = useState(null)
  useEffect(() => {
    if (!keys.length) return
    let alive = true
    const load = () => getJson(`/api/live?routes=${encodeURIComponent(keys.join(','))}`).then((x) => alive && setD(x)).catch(() => alive && setD(null))
    load(); const t = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [keys.join(',')])
  if (!d) return null
  const shown = Object.values(d.routes).filter((r) => r.trips > 0)
  return (
    <div className="live" aria-live="polite">
      <p className="live-head"><span className="dot" aria-hidden="true" /> <b>Live now</b> <span className="hint">updated {ago(d.updated)} · median delay of buses running on each route</span></p>
      {shown.length ? <div className="tags">{shown.map((r) => <span key={r.mode + r.name} className={`chip ${tone(r)}`}>{r.mode === 'tram' ? 'Luas ' : ''}{r.name} · {label(r)} <small style={{ fontWeight: 500 }}>({r.trips})</small></span>)}</div>
        : <p className="hint">None of these routes are reporting right now (they may not be running at this hour).</p>}
    </div>
  )
}

/** One line for the start page: how Dublin's buses are doing right now. */
export function CityLive() {
  const [d, setD] = useState(null)
  useEffect(() => { getJson('/api/live').then(setD).catch(() => setD(null)) }, [])
  if (!d || !d.city?.trips) return null
  const c = d.city
  return (
    <p className="city-live"><span className="dot" aria-hidden="true" /> <b>Right now:</b> {c.trips.toLocaleString('en-IE')} buses and trams reporting, {c.late5Pct}% running 5+ minutes late. <span className="hint" style={{ color: 'inherit', opacity: .75 }}>Live from the NTA, {ago(d.updated)}.</span></p>
  )
}
