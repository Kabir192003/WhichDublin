import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui.jsx'
import { getJson, ago } from '../domain/api.js'

const STOPS_URL = `${import.meta.env.BASE_URL}data/stops.json`
const hhmm = (mins) => { const h = Math.floor((mins % 1440) / 60), m = mins % 60; return `${h}:${String(m).padStart(2, '0')}` }
const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }
const delayTone = (sec) => sec == null ? '' : sec <= 60 ? 'pub' : sec <= 300 ? 'carried' : 'estimated'
const delayLabel = (sec) => sec == null ? null : Math.abs(sec) < 60 ? 'on time' : sec < 0 ? `${Math.round(-sec / 60)} min early` : `${Math.round(sec / 60)} min late`

/** Enter the number printed on a Dublin Bus stop: see the routes that serve it, pick one, see its
 * full path and the next scheduled departures, with today's live delay for that route alongside. */
export default function Stop() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState('')
  const [code, setCode] = useState(null)
  const [sel, setSel] = useState(null)         // { stopId, routeId, directionId }
  const [delays, setDelays] = useState(null)   // { updated, delays: { tripId: seconds|null } }

  useEffect(() => { fetch(STOPS_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then(setData).catch((e) => setErr(String(e))) }, [])

  const stopIds = data && code ? (data.byCode[code] || []) : []

  const shape = sel && data ? data.shapes[`${sel.routeId}:${sel.directionId}`] : null
  const departures = useMemo(() => {
    if (!sel || !data) return []
    const list = data.departures[`${sel.stopId}:${sel.routeId}:${sel.directionId}`] || []
    const now = nowMins()
    const upcoming = list.filter(([m]) => m % 1440 >= now)
    return (upcoming.length ? upcoming : list).slice(0, 6).map(([mins, ti]) => ({ mins, tripId: data.trips[ti] }))
  }, [sel, data])

  useEffect(() => {
    if (!sel || !departures.length) { setDelays(null); return }
    let alive = true
    const load = () => getJson(`/api/stop-live?stop=${encodeURIComponent(sel.stopId)}&trips=${departures.map((d) => encodeURIComponent(d.tripId)).join(',')}`)
      .then((x) => alive && setDelays(x)).catch(() => alive && setDelays(null))
    load(); const t = setInterval(load, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [sel?.stopId, sel?.routeId, sel?.directionId, departures.map((d) => d.tripId).join(',')])

  const submit = (e) => { e.preventDefault(); setSel(null); setDelays(null); setCode(q.trim()) }

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
                      onClick={() => { setSel({ stopId, routeId: rid, directionId: did }); setDelays(null) }}>{r[0]}</button>
                  })}
                </div>

                {sel && sel.stopId === stopId && (() => {
                  const route = data.routes[sel.routeId]
                  const anyLive = delays && Object.values(delays.delays).some((v) => v != null)
                  return (
                    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                      <p style={{ margin: '0 0 10px', fontWeight: 700 }}>Route {route[0]}{route[1] ? ` · ${route[1]}` : ''}</p>
                      <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 14 }}>Next departures from here</p>
                      {departures.length ? (
                        <ul className="rows" style={{ margin: '0 0 10px' }}>
                          {departures.map((d, i) => {
                            const sec = delays?.delays?.[d.tripId]
                            const expected = sec != null ? hhmm(Math.round(d.mins + sec / 60)) : null
                            return (
                              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ fontVariantNumeric: 'tabular-nums', textDecoration: expected && expected !== hhmm(d.mins) ? 'line-through' : 'none', color: expected ? 'var(--muted)' : 'inherit' }}>{hhmm(d.mins)}</span>
                                {expected
                                  ? <span className={`chip ${delayTone(sec)}`}><span className="dot" aria-hidden="true" /> Expected {expected} ({delayLabel(sec)})</span>
                                  : delays ? <span className="hint">no live update for this one yet</span> : null}
                              </li>
                            )
                          })}
                        </ul>
                      ) : <p className="hint" style={{ margin: '0 0 12px' }}>No more scheduled departures today.</p>}
                      {delays && !anyLive && <p className="hint" style={{ margin: '0 0 10px' }}>None of these are reporting live right now (may not be running yet, or too far off to be in the feed).</p>}
                      <p className="hint" style={{ margin: '0 0 6px' }}>Scheduled times are {data.date}'s timetable. "Expected" is that specific bus's live delay from the NTA feed, matched to this stop, not a city-wide average{delays?.updated ? `, updated ${ago(delays.updated)}` : ''}.</p>
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
