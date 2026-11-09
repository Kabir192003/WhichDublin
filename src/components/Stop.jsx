import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui.jsx'
import { getJson, ago } from '../domain/api.js'
import RouteMap from './RouteMap.jsx'

const STOPS_URL = `${import.meta.env.BASE_URL}data/stops.json`
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
    for (const [sid, s] of Object.entries(data.stops)) {
      if (out.length >= 15) break
      if (out.some((x) => x.stopId === sid)) continue
      if (s[1].toLowerCase().includes(query)) out.push({ stopId: sid, code: s[0], name: s[1], mode: s[4] })
    }
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

  useEffect(() => { fetch(STOPS_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then(setData).catch((e) => setErr(String(e))) }, [])
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

  return (
    <>
      <section className="page-hero"><div className="wrap"><h1>Find your stop</h1><p>Search by the number on a bus stop, or by name for any bus, Luas or DART stop. Add a destination to see a direct journey.</p></div></section>
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
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={MODE_ICON[origin.mode] || 'bus'} size={18} />{origin.name} <Icon name="arrow" size={15} /> <Icon name={MODE_ICON[dest.mode] || 'bus'} size={18} />{dest.name}</h2>
              {journeys.length ? journeys.map((j) => (
                <div key={j.routeId + j.directionId} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Route {j.route[0]}{j.route[1] ? ` · ${j.route[1]}` : ''}</p>
                  <ul className="rows">
                    {j.legs.map((l, i) => <li key={i}>Leave {hhmm(l.depart)} → arrive ~{hhmm(l.arrive)} <span className="hint">(~{l.mins} min, typical)</span></li>)}
                  </ul>
                </div>
              )) : <p className="notice">No direct route found between these two stops in today's timetable. (A route that needs a change isn't covered yet.)</p>}
              <p className="hint" style={{ marginTop: 10 }}>Journey time is the gap to the nearest later scheduled departure at your destination on the same route, since the feed doesn't let us tie one specific bus's two stop times together exactly. Treat it as typical, not exact.</p>
            </section>
          )}

          {origin && !dest && (
            <section className="fact" style={{ marginTop: 18 }}>
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
                      <RouteMap stops={shape.map((sid) => { const s = data.stops[sid]; return { id: sid, name: s?.[1] || sid, lat: s?.[2], lon: s?.[3] } })} youId={origin.stopId} />
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
