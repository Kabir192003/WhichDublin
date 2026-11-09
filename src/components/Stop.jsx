import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui.jsx'
import { getJson, ago } from '../domain/api.js'

const STOPS_URL = `${import.meta.env.BASE_URL}data/stops.json`
const hhmm = (mins) => { const h = Math.floor((mins % 1440) / 60), m = mins % 60; return `${h}:${String(m).padStart(2, '0')}` }
const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }
const liveLabel = (r) => !r || r.medianMin == null ? null : r.medianMin <= 1 ? 'on time' : r.medianMin < 0 ? 'running early' : `~${r.medianMin} min late`
const liveTone = (r) => !r || r.medianMin == null ? '' : r.medianMin <= 2 ? 'pub' : r.medianMin <= 5 ? 'carried' : 'estimated'

/** Enter the number printed on a Dublin Bus stop: see the routes that serve it, pick one, see its
 * full path and the next scheduled departures, with today's live delay for that route alongside. */
export default function Stop() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const [code, setCode] = useState(null)
  const [sel, setSel] = useState(null)         // { stopId, routeId, directionId }
  const [live, setLive] = useState(null)

  useEffect(() => { fetch(STOPS_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then(setData).catch((e) => setErr(String(e))) }, [])

  const stopIds = data && code ? (data.byCode[code] || []) : []

  useEffect(() => {
    if (!sel) return
    const route = data.routes[sel.routeId]
    if (!route) return
    let alive = true
    const load = () => getJson(`/api/live?routes=${encodeURIComponent(`bus:${route[0]}`)}`).then((x) => alive && setLive(x)).catch(() => alive && setLive(null))
    load(); const t = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [sel?.routeId])

  const shape = sel && data ? data.shapes[`${sel.routeId}:${sel.directionId}`] : null
  const departures = useMemo(() => {
    if (!sel || !data) return []
    const list = data.departures[`${sel.stopId}:${sel.routeId}:${sel.directionId}`] || []
    const now = nowMins()
    const upcoming = list.filter((m) => m % 1440 >= now)
    return (upcoming.length ? upcoming : list).slice(0, 6)
  }, [sel, data])

  const submit = (e) => { e.preventDefault(); setSel(null); setLive(null); setCode(q.trim()) }

  return (
    <>
      <section className="page-hero"><div className="wrap"><h1>Find your bus stop</h1><p>Enter the number on the stop. See what serves it, and when the next one's due.</p></div></section>
      <article className="wrap page-body"><div className="card lift doc">
        {err && <p className="notice">Could not load stop data ({err}). Please refresh.</p>}
        {!data && !err && <p className="notice">Loading Dublin Bus stops…</p>}
        {data && <>
          <form onSubmit={submit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="pill" htmlFor="stop-code" style={{ flex: '1 1 220px' }}>
              <span className="k">Stop number</span>
              <input id="stop-code" className="select" inputMode="numeric" placeholder="e.g. 273" value={q} onChange={(e) => setQ(e.target.value)} style={{ border: 'none', minHeight: 34, width: '100%' }} />
            </label>
            <button className="btn" type="submit">Find stop</button>
          </form>
          <p className="hint" style={{ marginTop: 8 }}>Dublin Bus stops only for now, from {data.date} scheduled timetables. Not Luas or DART.</p>

          {code && stopIds.length === 0 && <p className="notice">No Dublin Bus stop found for "{code}". Check the number on the pole and try again.</p>}

          {stopIds.map((stopId) => {
            const [, name, lat, lon] = data.stops[stopId]
            const routes = data.stopRoutes[stopId] || []
            return (
              <section key={stopId} className="fact" style={{ marginTop: 18 }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="bus" size={18} />{name} <span className="hint">· stop {code}</span></h2>
                <p className="hint" style={{ margin: '4px 0 10px' }}>{routes.length} route{routes.length === 1 ? '' : 's'} serve this stop.</p>
                <div className="tags">
                  {routes.map(([rid, did]) => {
                    const r = data.routes[rid]; if (!r) return null
                    const on = sel && sel.stopId === stopId && sel.routeId === rid && sel.directionId === did
                    return <button key={rid + did} type="button" className={`chip ${on ? 'pub' : ''}`} style={{ cursor: 'pointer', border: on ? 'none' : '1px solid var(--line)' }}
                      onClick={() => { setSel({ stopId, routeId: rid, directionId: did }); setLive(null) }}>{r[0]}</button>
                  })}
                </div>

                {sel && sel.stopId === stopId && (() => {
                  const route = data.routes[sel.routeId]
                  const key = `bus:${route[0]}`
                  const r = live?.routes?.[key]
                  return (
                    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Route {route[0]}{route[1] ? ` · ${route[1]}` : ''}</p>
                      {live && <p className="hint" style={{ margin: '0 0 10px' }}>
                        {r && r.trips > 0
                          ? <span className={`chip ${liveTone(r)}`}><span className="dot" aria-hidden="true" /> Live: {liveLabel(r)} right now, updated {ago(live.updated)}</span>
                          : 'Not reporting live right now (may not be running at this hour).'}
                      </p>}
                      <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 14 }}>Next scheduled departures from here</p>
                      {departures.length
                        ? <p style={{ margin: '0 0 12px', fontVariantNumeric: 'tabular-nums' }}>{departures.map(hhmm).join(' · ')}</p>
                        : <p className="hint" style={{ margin: '0 0 12px' }}>No more scheduled departures today.</p>}
                      <p className="hint" style={{ margin: '0 0 6px' }}>Scheduled times for {data.date}'s timetable, not vehicle-tracked. Live status is the route's typical delay right now, not a per-stop prediction.</p>
                      {shape && <details>
                        <summary>Full route ({shape.length} stops)</summary>
                        <ol className="rows" style={{ marginTop: 8 }}>
                          {shape.map((sid) => <li key={sid} style={{ fontWeight: sid === stopId ? 700 : 400 }}>{data.stops[sid]?.[1] || sid}{sid === stopId ? ' (this stop)' : ''}</li>)}
                        </ol>
                      </details>}
                    </div>
                  )
                })()}
              </section>
            )
          })}
        </>}
      </div></article>
    </>
  )
}
