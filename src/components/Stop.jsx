import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui.jsx'
import { getJson, ago } from '../domain/api.js'
import { haversine, walkMin } from '../domain/geo.js'
import RouteMap from './RouteMap.jsx'

const STOPS_URL = `${import.meta.env.BASE_URL}data/stops.json`
const PATHS_URL = `${import.meta.env.BASE_URL}data/stop-paths.json`
const HIST_KEY = 'settld-stop-history'
const hhmm = (mins) => { const h = Math.floor((mins % 1440) / 60), m = mins % 60; return `${h}:${String(m).padStart(2, '0')}` }
const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }
const delayTone = (sec) => sec == null ? '' : sec <= 60 ? 'pub' : sec <= 300 ? 'carried' : 'estimated'
const delayLabel = (sec) => sec == null ? null : Math.abs(sec) < 60 ? 'on time' : sec < 0 ? `${Math.round(-sec / 60)} min early` : `${Math.round(sec / 60)} min late`
const MODE_ICON = { bus: 'bus', tram: 'tram', rail: 'train' }
const MODE_NAME = { bus: 'Bus', tram: 'Luas', rail: 'Rail/DART' }

function loadHistory() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]') } catch { return [] } }
function pushHistory(entry) {
  try {
    const h = loadHistory().filter((x) => x.stopId !== entry.stopId)
    h.unshift(entry)
    localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 8)))
  } catch { /* storage unavailable */ }
}

/** Search box that resolves a stop by the number on the pole (bus) or by name (any mode,
 * including Luas and DART, which don't have a printed stop number). */
function StopSearch({ label, data, value, onPick, placeholder }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const results = useMemo(() => {
    if (!data || q.trim().length < 2) return []
    const query = q.trim().toLowerCase()
    const out = []
    if (/^\d+$/.test(query) && data.byCode[query]) {
      for (const sid of data.byCode[query]) { const s = data.stops[sid]; if (s) out.push({ stopId: sid, code: s[0], name: s[1], mode: s[4] }) }
    }
    const named = []
    for (const [sid, s] of Object.entries(data.stops)) {
      if (out.some((x) => x.stopId === sid)) continue
      const name = s[1].toLowerCase()
      if (name.includes(query)) named.push({ stopId: sid, code: s[0], name: s[1], mode: s[4], rank: name === query ? 0 : name.startsWith(query) ? 1 : 2 })
    }
    // Exact and prefix matches first, then shortest name (so "Connolly" the Luas/rail stop outranks
    // "Connolly Hospital", which also contains the word but isn't what someone searching it means).
    named.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length)
    out.push(...named.slice(0, 15 - out.length))
    return out.slice(0, 15)
  }, [q, data])

  return (
    <div style={{ position: 'relative', flex: '1 1 240px' }}>
      <label className="pill" style={{ width: '100%' }}>
        <span className="k">{label}</span>
        <input className="select" placeholder={placeholder} value={value ? value.name : q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); if (value) onPick(null) }}
          onFocus={() => setOpen(true)} style={{ border: 'none', minHeight: 34, width: '100%' }} />
      </label>
      {open && results.length > 0 && (
        <ul className="rows" style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, right: 0, background: 'var(--surface, #fff)', border: '1px solid var(--line)', borderRadius: 10, marginTop: 4, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
          {results.map((r) => (
            <li key={r.stopId}>
              <button type="button" className="link" style={{ width: '100%', textAlign: 'left', padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center' }}
                onClick={() => { onPick(r); setQ(''); setOpen(false) }}>
                <Icon name={MODE_ICON[r.mode] || 'bus'} size={15} />
                <span style={{ flex: 1 }}>{r.name}</span>
                <span className="hint">{MODE_NAME[r.mode] || r.mode}{r.code && r.mode === 'bus' ? ` · ${r.code}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Enter a stop (by number or name): routes serving it, live-adjusted departures and the route on
 * a map. Add a destination to see direct routes between the two, with a typical journey time. */
export default function Stop() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [origin, setOrigin] = useState(null)   // { stopId, name, code, mode }
  const [dest, setDest] = useState(null)
  const [sel, setSel] = useState(null)         // { routeId, directionId } chosen route (no-destination mode)
  const [live, setLive] = useState(null)
  const [history, setHistory] = useState([])
  const [paths, setPaths] = useState(null)   // road-following route geometry, fetched only once a map is actually needed

  useEffect(() => { fetch(STOPS_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then(setData).catch((e) => setErr(String(e))) }, [])
  useEffect(() => {
    if (paths || (!sel && !dest)) return
    fetch(PATHS_URL).then((r) => r.ok ? r.json() : {}).then(setPaths).catch(() => setPaths({}))
  }, [sel, dest, paths])
  useEffect(() => { setHistory(loadHistory()) }, [])
  useEffect(() => { if (origin) { pushHistory(origin); setHistory(loadHistory()) } }, [origin?.stopId])

  const routes = origin && data ? (data.stopRoutes[origin.stopId] || []) : []
  const shape = sel && data ? data.shapes[`${sel.routeId}:${sel.directionId}`] : null
  const departures = useMemo(() => {
    if (!sel || !origin || !data) return []
    const list = data.departures[`${origin.stopId}:${sel.routeId}:${sel.directionId}`] || []
    const now = nowMins()
    const upcoming = list.filter((m) => m % 1440 >= now)
    return (upcoming.length ? upcoming : list).slice(0, 6).map((mins) => ({ mins }))
  }, [sel, origin, data])

  useEffect(() => {
    if (!sel || !origin) { setLive(null); return }
    let alive = true
    const shapeParam = shape ? `&shape=${shape.map(encodeURIComponent).join(',')}` : ''
    const load = () => getJson(`/api/stop-live?stop=${encodeURIComponent(origin.stopId)}&route=${encodeURIComponent(sel.routeId)}${shapeParam}`)
      .then((x) => alive && setLive(x)).catch(() => alive && setLive(null))
    load(); const t = setInterval(load, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [origin?.stopId, sel?.routeId, shape])

  const matched = useMemo(() => {
    const out = new Map()
    if (!live?.live?.length || !departures.length) return out
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
    const candidates = live.live.map((x) => ({ ...x, expMin: x.atMs != null ? Math.round((x.atMs - midnight.getTime()) / 60000) : null })).filter((x) => x.expMin != null || x.delaySec != null)
    const pairs = []
    departures.forEach((d, i) => candidates.forEach((c, j) => { const exp = c.expMin != null ? c.expMin : d.mins + c.delaySec / 60; pairs.push({ i, j, diff: Math.abs(exp - d.mins), exp, delaySec: c.delaySec, exact: c.exact }) }))
    pairs.sort((a, b) => a.diff - b.diff)
    const usedDep = new Set(), usedCand = new Set()
    for (const p of pairs) { if (p.diff > 25 || usedDep.has(p.i) || usedCand.has(p.j)) continue; out.set(p.i, { expMin: Math.round(p.exp), delaySec: p.delaySec, exact: p.exact }); usedDep.add(p.i); usedCand.add(p.j) }
    return out
  }, [live, departures])

  // Direct routes serving both origin and destination, in the right order, with a typical journey time
  // estimated from the nearest later departure at the destination on the same route — not a specific
  // trip match (the feeds don't give us one reliably), so this is a typical duration, not an exact one.
  const journeys = useMemo(() => {
    if (!origin || !dest || !data || origin.stopId === dest.stopId) return []
    const originRoutes = new Map((data.stopRoutes[origin.stopId] || []).map(([r, d2]) => [`${r}:${d2}`, [r, d2]]))
    const destRoutes = new Set((data.stopRoutes[dest.stopId] || []).map(([r, d2]) => `${r}:${d2}`))
    const out = []
    for (const [key, [rid, did]] of originRoutes) {
      if (!destRoutes.has(key)) continue
      const shape = data.shapes[key]; if (!shape) continue
      const oi = shape.indexOf(origin.stopId), di = shape.indexOf(dest.stopId)
      if (oi === -1 || di === -1 || oi >= di) continue
      const oTimes = (data.departures[`${origin.stopId}:${key}`] || [])
      const dTimes = (data.departures[`${dest.stopId}:${key}`] || [])
      if (!oTimes.length || !dTimes.length) continue
      const now = nowMins()
      const upcoming = oTimes.filter((m) => m >= now).slice(0, 4)
      const legs = upcoming.map((ot) => { const at = dTimes.find((t) => t > ot); return at != null ? { depart: ot, arrive: at, mins: at - ot } : null }).filter(Boolean)
      if (legs.length) out.push({ routeId: rid, directionId: did, route: data.routes[rid], legs })
    }
    return out.sort((a, b) => (a.legs[0]?.depart ?? 1e9) - (b.legs[0]?.depart ?? 1e9))
  }, [origin, dest, data])

  // When no single route covers both stops: find a walking connection between a stop reachable
  // from origin and a stop that reaches destination, picking the shortest walk. This only covers
  // one change, not a general multi-leg planner, and timing is typical (same nearest-after method
  // as direct journeys above), not a specific trip matched end to end.
  const transfer = useMemo(() => {
    if (!origin || !dest || !data || journeys.length || origin.stopId === dest.stopId) return null
    const reachFromOrigin = new Map()   // stopId -> [routeId, directionId]
    for (const [rid, did] of data.stopRoutes[origin.stopId] || []) {
      const shape = data.shapes[`${rid}:${did}`]; if (!shape) continue
      const oi = shape.indexOf(origin.stopId); if (oi === -1) continue
      for (let i = oi + 1; i < shape.length && reachFromOrigin.size < 400; i++) if (!reachFromOrigin.has(shape[i])) reachFromOrigin.set(shape[i], [rid, did])
    }
    const reachToDest = new Map()
    for (const [rid, did] of data.stopRoutes[dest.stopId] || []) {
      const shape = data.shapes[`${rid}:${did}`]; if (!shape) continue
      const di = shape.indexOf(dest.stopId); if (di === -1) continue
      for (let i = 0; i < di && reachToDest.size < 400; i++) if (!reachToDest.has(shape[i])) reachToDest.set(shape[i], [rid, did])
    }
    let best = null
    for (const [aId, [r1, d1]] of reachFromOrigin) {
      const a = data.stops[aId]; if (!a) continue
      for (const [bId, [r2, d2]] of reachToDest) {
        if (aId === bId && r1 === r2 && d1 === d2) continue
        const b = data.stops[bId]; if (!b) continue
        const metres = haversine({ lat: a[2], lon: a[3] }, { lat: b[2], lon: b[3] })
        if (metres > 800) continue
        if (!best || metres < best.metres) best = { aId, bId, r1, d1, r2, d2, metres }
      }
    }
    if (!best) return null
    const { aId, bId, r1, d1, r2, d2, metres } = best
    const now = nowMins()
    const leg1Dep = (data.departures[`${origin.stopId}:${r1}:${d1}`] || []).filter((m) => m >= now)[0]
    if (leg1Dep == null) return null
    const leg1Arr = (data.departures[`${aId}:${r1}:${d1}`] || []).find((t) => t > leg1Dep)
    if (leg1Arr == null) return null
    const walkAt = leg1Arr + walkMin(metres)
    const leg2Dep = (data.departures[`${bId}:${r2}:${d2}`] || []).find((t) => t >= walkAt)
    if (leg2Dep == null) return null
    const leg2Arr = (data.departures[`${dest.stopId}:${r2}:${d2}`] || []).find((t) => t > leg2Dep)
    if (leg2Arr == null) return null
    return { leg1: { route: data.routes[r1], depart: leg1Dep, arrive: leg1Arr, at: data.stops[aId][1] },
      walkMinutes: walkMin(metres), walkMetres: Math.round(metres),
      leg2: { route: data.routes[r2], depart: leg2Dep, arrive: leg2Arr, from: data.stops[bId][1] },
      totalMins: leg2Arr - leg1Dep }
  }, [origin, dest, data, journeys])

  return (
    <>
      <section className="page-hero"><div className="wrap"><h1>Commute</h1><p>Look up any bus, Luas or rail stop by number or name to see its routes and next departures. Add a destination to plan a journey.</p></div></section>
      <article className="wrap page-body"><div className="card lift doc">
        {err && <p className="notice">Could not load stop data ({err}). Please refresh.</p>}
        {!data && !err && <p className="notice">Loading Dublin's stops…</p>}
        {data && <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', position: 'relative' }}>
            <StopSearch label="From" data={data} value={origin} placeholder="Stop number or name" onPick={(r) => { setOrigin(r); setSel(null); setLive(null) }} />
            <StopSearch label="To (optional)" data={data} value={dest} placeholder="Where you're going" onPick={setDest} />
            {(origin || dest) && <button type="button" className="btn ghost sm" onClick={() => { setOrigin(null); setDest(null); setSel(null); setLive(null) }}>Clear</button>}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Covers Dublin Bus, Go-Ahead, Bus Éireann, Luas and Irish Rail stops in the Dublin area, from {data.date}'s scheduled timetables.</p>

          {!origin && history.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p className="hint" style={{ margin: '0 0 6px' }}>Recent</p>
              <div className="tags">{history.map((h) => <button key={h.stopId} type="button" className="chip" style={{ cursor: 'pointer', border: '1px solid var(--line)' }} onClick={() => setOrigin(h)}>{h.name}</button>)}</div>
            </div>
          )}

          {origin && dest && (
            <section className="fact" style={{ marginTop: 18 }}>
              <button type="button" className="link" style={{ marginBottom: 8 }} onClick={() => { setDest(null) }}><Icon name="back" size={15} />Change destination</button>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={MODE_ICON[origin.mode] || 'bus'} size={18} />{origin.name} <Icon name="arrow" size={15} /> <Icon name={MODE_ICON[dest.mode] || 'bus'} size={18} />{dest.name}</h2>
              {journeys.length ? journeys.map((j) => (
                <div key={j.routeId + j.directionId} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Route {j.route[0]}{j.route[1] ? ` · ${j.route[1]}` : ''}</p>
                  <ul className="rows">
                    {j.legs.map((l, i) => <li key={i}>Leave {hhmm(l.depart)} → arrive ~{hhmm(l.arrive)} <span className="hint">(~{l.mins} min, typical)</span></li>)}
                  </ul>
                </div>
              )) : transfer ? (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700 }}>One change, ~{transfer.totalMins} min total (typical)</p>
                  <ul className="rows">
                    <li>Route {transfer.leg1.route[0]}{transfer.leg1.route[1] ? ` · ${transfer.leg1.route[1]}` : ''}: leave {hhmm(transfer.leg1.depart)} → arrive {transfer.leg1.at} ~{hhmm(transfer.leg1.arrive)}</li>
                    <li>Walk to {transfer.leg2.from}, ~{transfer.walkMinutes} min ({transfer.walkMetres} m)</li>
                    <li>Route {transfer.leg2.route[0]}{transfer.leg2.route[1] ? ` · ${transfer.leg2.route[1]}` : ''}: leave {hhmm(transfer.leg2.depart)} → arrive ~{hhmm(transfer.leg2.arrive)}</li>
                  </ul>
                  <p className="hint" style={{ marginTop: 8 }}>No route runs directly between these two stops, so this is the shortest walking link we found between a route from your stop and a route to your destination. Only one change is covered; journeys needing two or more aren't yet.</p>
                </div>
              ) : <p className="notice">No direct route, and no one-change connection within 800 m, found between these two stops in today's timetable.</p>}
              <p className="hint" style={{ marginTop: 10 }}>Journey time is the gap to the nearest later scheduled departure at your destination on the same route, since the feed doesn't let us tie one specific bus's two stop times together exactly. Treat it as typical, not exact.</p>
              {data.stops[origin.stopId] && data.stops[dest.stopId] && (() => {
                const o = data.stops[origin.stopId], d2 = data.stops[dest.stopId]
                return <RouteMap
                  stops={[{ id: origin.stopId, name: o[1], lat: o[2], lon: o[3] }, { id: dest.stopId, name: d2[1], lat: d2[2], lon: d2[3] }]}
                  youId={[origin.stopId, dest.stopId]} color="#1D4ED8" />
              })()}
            </section>
          )}

          {origin && !dest && (
            <section className="fact" style={{ marginTop: 18 }}>
              <button type="button" className="link" style={{ marginBottom: 8 }} onClick={() => { setOrigin(null); setSel(null); setLive(null) }}><Icon name="back" size={15} />Search a different stop</button>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={MODE_ICON[origin.mode] || 'bus'} size={18} />{origin.name}{origin.code && origin.mode === 'bus' ? <span className="hint">· stop {origin.code}</span> : null}</h2>
              <p className="hint" style={{ margin: '4px 0 10px' }}>{routes.length} route{routes.length === 1 ? '' : 's'} serve this stop.</p>
              <div className="tags">
                {routes.map(([rid, did]) => {
                  const r = data.routes[rid]; if (!r) return null
                  const on = sel && sel.routeId === rid && sel.directionId === did
                  return <button key={rid + did} type="button" className={`chip ${on ? 'pub' : ''}`} style={{ cursor: 'pointer', border: on ? 'none' : '1px solid var(--line)' }}
                    onClick={() => { setSel({ routeId: rid, directionId: did }); setLive(null) }}>{r[0]}</button>
                })}
              </div>

              {sel && (() => {
                const route = data.routes[sel.routeId]
                return (
                  <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                    <button type="button" className="link" style={{ marginBottom: 8 }} onClick={() => { setSel(null); setLive(null) }}><Icon name="back" size={15} />Back to all routes at this stop</button>
                    <p style={{ margin: '0 0 10px', fontWeight: 700 }}>Route {route[0]}{route[1] ? ` · ${route[1]}` : ''}</p>
                    <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 14 }}>Next departures from here</p>
                    {departures.length ? (
                      <ul className="rows" style={{ margin: '0 0 10px' }}>
                        {departures.map((d, i) => {
                          const m = matched.get(i)
                          const expected = m ? hhmm(m.expMin) : null
                          const sec = m?.delaySec ?? (m ? (m.expMin - d.mins) * 60 : null)
                          return (
                            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <span style={{ fontVariantNumeric: 'tabular-nums', textDecoration: expected && expected !== hhmm(d.mins) ? 'line-through' : 'none', color: expected ? 'var(--muted)' : 'inherit' }}>{hhmm(d.mins)}</span>
                              {expected
                                ? <span className={`chip ${delayTone(sec)}`} title={m.exact ? 'Reported directly at this stop' : "Estimated: this bus's delay carried forward from its last reported stop, since the feed hasn't updated this exact stop yet"}><span className="dot" aria-hidden="true" /> {m.exact ? 'Expected' : '~Expected'} {expected}{sec != null ? ` (${delayLabel(sec)})` : ''}</span>
                                : live ? <span className="hint">no live bus matched to this one yet</span> : null}
                            </li>
                          )
                        })}
                      </ul>
                    ) : <p className="hint" style={{ margin: '0 0 12px' }}>No more scheduled departures today.</p>}
                    {live && !matched.size && <p className="hint" style={{ margin: '0 0 10px' }}>No buses on this route are reporting live near this stop right now.</p>}
                    <p className="hint" style={{ margin: '0 0 6px' }}>Scheduled times are {data.date}'s timetable. "Expected" matches a live vehicle on this route to the nearest scheduled time at this stop, not a city-wide average{live?.updated ? `, updated ${ago(live.updated)}` : ''}. "~Expected" means the feed hasn't reported this bus at this exact stop yet, so the delay is carried forward from where it was last seen on this route. Live tracking only covers buses already on the road, so it usually only shows for the next departure or two, not ones further out.</p>
                    {shape && <>
                      <RouteMap stops={shape.map((sid) => { const s = data.stops[sid]; return { id: sid, name: s?.[1] || sid, lat: s?.[2], lon: s?.[3] } })} youId={origin.stopId} path={paths?.[`${sel.routeId}:${sel.directionId}`]} />
                      <details style={{ marginTop: 10 }}>
                        <summary>Full route ({shape.length} stops)</summary>
                        <ol className="rows" style={{ marginTop: 8 }}>
                          {shape.map((sid) => <li key={sid} style={{ fontWeight: sid === origin.stopId ? 700 : 400 }}>{data.stops[sid]?.[1] || sid}{sid === origin.stopId ? ' (this stop)' : ''}</li>)}
                        </ol>
                      </details>
                    </>}
                  </div>
                )
              })()}
            </section>
          )}
        </>}
      </div></article>
    </>
  )
}
