import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui.jsx'
import { getJson, ago } from '../domain/api.js'
import { haversine, walkMin } from '../domain/geo.js'
import RouteMap from './RouteMap.jsx'
import { buildIndex, plan, stationGroup } from '../domain/planner.js'

const delayColor = (sec) => (sec == null ? '#6B7C85' : sec <= 60 ? '#1F9D6B' : sec <= 300 ? '#2F6FD0' : '#D4522A')   // same bands as the Expected chips

const STOPS_URL = `${import.meta.env.BASE_URL}data/stops.json`
const PATHS_URL = `${import.meta.env.BASE_URL}data/stop-paths.json`
const HIST_KEY = 'settld-stop-history'
const hhmm = (mins) => { const h = Math.floor((mins % 1440) / 60), m = mins % 60; return `${h}:${String(m).padStart(2, '0')}` }
/** The time and weekday in Dublin, whatever time zone the device is in: every timetable here is in Dublin time. */
const dublinNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]))
  return { mins: Number(p.hour) * 60 + Number(p.minute), day: p.weekday }
}
const nowMins = () => dublinNow().mins
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

const CITY = { lat: 53.3498, lon: -6.2603 }   // O'Connell Street: "the city centre" for direction wording
/** Which way a route runs from a stop: its last stop, and whether that is towards or away from the city centre. */
function direction(data, rid, did, stopId) {
  const sh = data.shapes[`${rid}:${did}`], last = sh?.length ? data.stops[sh[sh.length - 1]] : null, here = data.stops[stopId]
  if (!last || !here) return null
  const dLast = haversine({ lat: last[2], lon: last[3] }, CITY), dHere = haversine({ lat: here[2], lon: here[3] }, CITY)
  return { to: last[1], way: dLast < dHere - 500 ? 'towards the city centre' : dLast > dHere + 500 ? 'away from the city centre' : null }
}

const LINE_COLOR = { Red: '#D52027', Green: '#00A651' }
const legColor = (data, l) => {
  if (l.type === 'walk') return '#6B7C85'
  const rid = l.pattern.split(':')[0], r = data.routes[rid], mode = r?.[2]
  return mode === 'tram' ? LINE_COLOR[r[0]] || '#00A651' : mode === 'rail' ? '#1D4ED8' : '#0B6B57'
}
const legCoords = (data, l) => (l.type === 'walk' ? [l.from, l.to] : l.stops).map((id) => [data.stops[id][2], data.stops[id][3]])
const stopLabel = (data, id) => `${data.stops[id][1]}${data.stops[id][0] && data.stops[id][4] === 'bus' ? ` (stop ${data.stops[id][0]})` : ''}`

/** The step-by-step list for one journey: which vehicle, where to board, how far, where to get off, and the walks between. */
function JourneyLegs({ data, journey }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'grid', gap: 0 }}>
      {journey.legs.map((l, i) => {
        const color = legColor(data, l)
        if (l.type === 'walk') return (
          <li key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderLeft: `3px dotted ${color}`, marginLeft: 10, paddingLeft: 14 }}>
            <span className="hint">Walk {l.mins} min ({l.metres} m) to {stopLabel(data, l.to)}</span>
          </li>)
        const rid = l.pattern.split(':')[0], did = l.pattern.split(':')[1], r = data.routes[rid], dir = direction(data, rid, did, l.from)
        return (
          <li key={i} style={{ padding: '8px 0 8px 14px', marginLeft: 10, borderLeft: `3px solid ${color}` }}>
            <p style={{ margin: 0, fontWeight: 700 }}><Icon name={MODE_ICON[data.stops[l.from][4]] || 'bus'} size={15} /> {MODE_NAME[data.stops[l.from][4]] === 'Bus' ? 'Bus' : ''} {r?.[0]}{dir ? ` towards ${dir.to}` : ''}</p>
            <p style={{ margin: '2px 0 0', fontSize: 14 }}>{hhmm(l.depart)} board at {stopLabel(data, l.from)}</p>
            <p className="hint" style={{ margin: '2px 0' }}>{l.stops.length - 1} stop{l.stops.length - 1 === 1 ? '' : 's'}, about {l.arrive - l.depart} min on board</p>
            <p style={{ margin: 0, fontSize: 14 }}>{hhmm(l.arrive)} get off at {stopLabel(data, l.to)}</p>
          </li>)
      })}
    </ol>
  )
}

/** Live Luas or Irish Rail board for a tram or rail stop: next vehicles per direction, straight from the operators' own feeds. */
function LiveBoard({ origin, data }) {
  const [st, setSt] = useState({ board: undefined })
  const here = data.stops[origin.stopId]
  useEffect(() => {
    if (!here) return
    let alive = true; setSt({ board: undefined })
    const load = () => getJson(`/api/transit-live?mode=${origin.mode}&lat=${here[2]}&lon=${here[3]}`).then((x) => alive && setSt({ board: x.board, updated: x.updated })).catch(() => alive && setSt({ board: null, error: true }))
    load(); const t = setInterval(() => { if (!document.hidden) load() }, 15_000)
    return () => { alive = false; clearInterval(t) }
  }, [origin.stopId, origin.mode])
  const b = st.board
  const box = { margin: '0 0 14px', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--r)', background: 'var(--tint)' }
  if (b === undefined) return <p className="hint" style={{ margin: '0 0 12px' }}>Loading live {origin.mode === 'tram' ? 'Luas' : 'train'} times…</p>
  if (!b) return <p className="hint" style={{ margin: '0 0 12px' }}>{st.error ? 'Live times are unavailable right now.' : 'No live board found for this stop.'}</p>
  const due = (m) => (m <= 0 ? 'Due' : `${m} min`)
  return (
    <div style={box} aria-live="polite">
      <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Live {b.kind === 'tram' ? 'Luas' : 'trains'} at {b.station}{st.updated ? <span className="hint" style={{ fontWeight: 400 }}> · updated {ago(st.updated)}</span> : null}</p>
      {b.kind === 'tram' ? (
        <>
          {b.message && <p className="hint" style={{ margin: '0 0 8px' }}>{b.message}</p>}
          {b.directions.length === 0 && <p className="hint" style={{ margin: 0 }}>No trams are due at the moment.</p>}
          {b.directions.map((d) => (
            <div key={d.name} style={{ marginBottom: 8 }}>
              <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 14 }}>{d.name === 'Inbound' ? 'Inbound' : 'Outbound'}: towards {[...new Set(d.trams.slice(0, 3).map((t) => t.destination))].join(' / ')}</p>
              <ul className="rows" style={{ margin: 0 }}>{d.trams.slice(0, 4).map((t, i) => <li key={i} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t.destination}</span><b>{due(t.due)}</b></li>)}</ul>
            </div>
          ))}
        </>
      ) : (
        <>
          {b.trains.length === 0 && <p className="hint" style={{ margin: 0 }}>No trains are due at the moment.</p>}
          <ul className="rows" style={{ margin: 0 }}>{b.trains.slice(0, 6).map((t, i) => (
            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>{t.departs && t.departs !== '00:00' ? t.departs : ''} to {t.destination}{t.late > 0 ? <span className="hint"> · {t.late} min late</span> : null}</span><b>{due(t.due)}</b>
            </li>))}</ul>
        </>
      )}
      <p className="hint" style={{ margin: '8px 0 0' }}>From {b.kind === 'tram' ? "Transport Infrastructure Ireland's Luas forecasts" : "Irish Rail's real-time service"}.</p>
    </div>
  )
}

/** Enter a stop (by number or name): routes serving it, live-adjusted departures and the route on
 * a map. Add a destination to see direct routes between the two, with a typical journey time. */
const DAYTYPE = (() => { const d = dublinNow().day; return d === 'Sat' ? 'sat' : d === 'Sun' ? 'sun' : 'wk' })()   // which timetable is running today (in Dublin)
const SHARDS = 256   // same rule as pipeline/shard-trips.py (FNV-1a)
const shardOf = (stopId) => { let h = 0x811c9dc5; for (const c of stopId) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) } return (h >>> 0) % SHARDS }
const AHEAD = 60   // minutes: a bus further out than this has no meaningful live delay yet

export default function Stop() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [origin, setOrigin] = useState(null)   // { stopId, name, code, mode }
  const [dest, setDest] = useState(null)
  const [sel, setSel] = useState(null)         // { routeId, directionId } chosen route (no-destination mode)
  const [live, setLive] = useState(null)
  const [history, setHistory] = useState([])
  const [trips, setTrips] = useState(null)   // today's departures at this stop with exact trip ids, or null while loading
  const [paths, setPaths] = useState(null)   // road-following route geometry, fetched only once a map is actually needed

  useEffect(() => { fetch(STOPS_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then(setData).catch((e) => setErr(String(e))) }, [])
  useEffect(() => {
    if (paths || (!sel && !dest)) return
    fetch(PATHS_URL).then((r) => r.ok ? r.json() : {}).then(setPaths).catch(() => setPaths({}))
  }, [sel, dest, paths])
  const [tripsTry, setTripsTry] = useState(0)
  useEffect(() => {
    setTrips(null); if (!origin) return
    let alive = true
    const url = `${import.meta.env.BASE_URL}data/trips/${DAYTYPE}/${shardOf(origin.stopId)}.json`
    const get = () => fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() })
    get().catch(() => new Promise((res) => setTimeout(res, 800)).then(get)).then((x) => alive && setTrips({ stopId: origin.stopId, data: x })).catch(() => alive && setTrips('error'))
    return () => { alive = false }
  }, [origin?.stopId, tripsTry])
  useEffect(() => { setHistory(loadHistory()) }, [])
  useEffect(() => { if (origin) { pushHistory(origin); setHistory(loadHistory()) } }, [origin?.stopId])

  const routes = origin && data ? (data.stopRoutes[origin.stopId] || []) : []
  const shape = sel && data ? data.shapes[`${sel.routeId}:${sel.directionId}`] : null
  const tripsHere = trips && trips !== 'error' && trips.stopId === origin?.stopId ? trips.data : null   // never use another stop's file while the new one loads
  const tripList = sel && origin && tripsHere ? tripsHere[`${origin.stopId}:${sel.routeId}:${sel.directionId}`] || [] : null   // [[minutes, tripId], ...] for today
  const departures = useMemo(() => {
    if (!sel || !origin || !data) return []
    const key = `${origin.stopId}:${sel.routeId}:${sel.directionId}`
    const list = tripList ? [...new Set(tripList.map((t) => t[0]))].sort((a, b) => a - b) : (DAYTYPE === 'wk' ? data.departures[key] || [] : [])
    const now = nowMins()
    const upcoming = list.filter((m) => m % 1440 >= now)
    return (upcoming.length ? upcoming : list).slice(0, 6).map((mins) => ({ mins }))
  }, [sel, origin, data, tripList])

  useEffect(() => {
    if (!sel || !origin) { setLive(null); return }
    let alive = true
    const shapeParam = shape ? `&shape=${shape.map(encodeURIComponent).join(',')}` : ''
    const load = () => getJson(`/api/stop-live?stop=${encodeURIComponent(origin.stopId)}&route=${encodeURIComponent(sel.routeId)}${shapeParam}`)
      .then((x) => alive && setLive(x)).catch(() => alive && setLive(null))
    load(); const t = setInterval(() => { if (!document.hidden) load() }, 15_000)   // 15 s: the map's bus dots move at that pace
    return () => { alive = false; clearInterval(t) }
  }, [origin?.stopId, sel?.routeId, shape])

  /** Each live bus is tied to its scheduled slot by the feed's trip id, which is the same id the timetable uses. */
  const matched = useMemo(() => {
    const out = new Map()
    if (!live?.live?.length || !tripList?.length || !departures.length) return out
    const slotOf = new Map(tripList.map(([m, id]) => [id, m]))
    for (const c of live.live) {
      const slot = c.tripId != null ? slotOf.get(c.tripId) : undefined
      if (slot == null) continue
      const i = departures.findIndex((d) => d.mins === slot); if (i < 0) continue
      if (slot - nowMins() > AHEAD) continue
      const expMin = c.atMs != null ? Math.round(nowMins() + (c.atMs - Date.now()) / 60000) : Math.round(slot + (c.delaySec || 0) / 60)
      out.set(i, { expMin, delaySec: c.delaySec, exact: c.exact, tripId: c.tripId })
    }
    return out
  }, [live, departures, tripList])

  /** GPS fixes of this route's buses, coloured by how late each is, and each bus's straight-line distance to this stop. */
  const busPos = useMemo(() => {
    const here = origin && data?.stops[origin.stopId]
    const delayOf = new Map((live?.live || []).map((c) => [c.tripId, c.delaySec]))
    const routeName = sel && data?.routes[sel.routeId]?.[0] || ''
    const byTrip = new Map()
    const thisWay = new Set((tripList || []).map((t) => t[1]))   // trips scheduled at this stop in this direction: the other way's buses are left out
    for (const v of live?.vehicles || []) {
      if (!thisWay.has(v.tripId)) continue
      const d = delayOf.get(v.tripId)
      const metres = here ? Math.round(haversine({ lat: v.lat, lon: v.lon }, { lat: here[2], lon: here[3] })) : null
      const km = metres == null ? '' : metres < 1000 ? `, ${Math.max(50, Math.round(metres / 50) * 50)} m from this stop` : `, ${(metres / 1000).toFixed(1)} km from this stop`
      byTrip.set(v.tripId, { ...v, color: delayColor(d), name: routeName, label: `Route ${routeName}: ${d == null ? 'no delay reported' : delayLabel(d)}${km}`, metres })
    }
    return byTrip
  }, [live, origin?.stopId, data, sel?.routeId, tripList])
  /** The nearest stop (within 300 m) where this same route runs the other way: the stop across the road. */
  const opposite = useMemo(() => {
    if (!sel || !origin || !data) return null
    const here = data.stops[origin.stopId]; if (!here) return null
    let best = null
    for (const [sid, st] of Object.entries(data.stops)) {
      if (sid === origin.stopId) continue
      const hit = (data.stopRoutes[sid] || []).find(([r, d]) => r === sel.routeId && d !== sel.directionId)
      if (!hit) continue
      const m = haversine({ lat: here[2], lon: here[3] }, { lat: st[2], lon: st[3] })
      if (m <= 300 && (!best || m < best.m)) best = { stopId: sid, name: st[1], code: st[0], mode: st[4], directionId: hit[1], m: Math.round(m) }
    }
    return best
  }, [sel?.routeId, sel?.directionId, origin?.stopId, data])
  const away = (m) => (m == null ? null : m < 1000 ? `${Math.max(50, Math.round(m / 50) * 50)} m away` : `${(m / 1000).toFixed(1)} km away`)

  /** Journeys from the origin station to the destination station: direct or with changes, any mix of bus, Luas, DART and rail. */
  const idx = useMemo(() => (data ? buildIndex(data) : null), [data])
  const plans = useMemo(() => {
    if (!idx || !origin || !dest || origin.stopId === dest.stopId) return null
    const from = stationGroup(idx, origin.stopId), to = stationGroup(idx, dest.stopId)
    const now = nowMins(), seen = new Set(), out = []
    for (const later of [0, 12, 25]) for (const j of plan(idx, from, to, now + later)) {
      const key = j.legs.map((l) => (l.type === 'ride' ? l.pattern + l.depart : 'w')).join('|')
      if (!seen.has(key)) { seen.add(key); out.push(j) }
    }
    return out.filter((j) => j.minutes <= 240).sort((x, y) => x.arrive - y.arrive || x.changes - y.changes).slice(0, 5)   // nothing over 4 hours: that is 'no service tonight', not a journey
  }, [idx, origin, dest])
  const [pick, setPick] = useState(0)
  useEffect(() => { setPick(0) }, [origin?.stopId, dest?.stopId])
  const journeyMap = useMemo(() => {   // memoised so the map is not re-fitted on every re-render
    if (!data || !origin || !dest || !data.stops[origin.stopId] || !data.stops[dest.stopId]) return null
    const j = plans?.[pick], o = data.stops[origin.stopId], d2 = data.stops[dest.stopId]
    const mid = j ? [...new Set(j.legs.flatMap((l) => (l.type === 'ride' ? [l.from, l.to] : [])))].filter((id) => id !== origin.stopId && id !== dest.stopId) : []
    const pt = (id, st) => ({ id, name: st[1], lat: st[2], lon: st[3] })
    return {
      stops: [pt(origin.stopId, o), pt(dest.stopId, d2), ...mid.map((id) => pt(id, data.stops[id]))],
      legs: j ? j.legs.map((l) => ({ color: legColor(data, l), dashed: l.type === 'walk', coords: legCoords(data, l) })) : undefined
    }
  }, [plans, pick, data, origin, dest])

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
          <p className="hint" style={{ marginTop: 8 }}>Covers Dublin Bus, Go-Ahead, Bus Éireann, Luas and Irish Rail stops in the Dublin area, from the National Transport Authority's current timetables.</p>

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
              {DAYTYPE !== 'wk' && <p className="hint" style={{ margin: '8px 0 0' }}>Journey planning uses the weekday timetable. At weekends some services run less often or not at all, so check the times.</p>}
              {!plans ? null : !plans.length ? <p className="notice">No journey of up to two changes and under 4 hours was found between these two places, even allowing short walks between stops. Services may have finished for tonight, or try a stop nearer your destination.</p> : (
                <>
                  <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 8 }}>
                    {plans.map((j, n) => (
                      <li key={n}>
                        <button type="button" onClick={() => setPick(n)} aria-pressed={pick === n} className="card" style={{ width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer', padding: '10px 12px', borderColor: pick === n ? 'var(--teal)' : undefined, boxShadow: pick === n ? '0 0 0 2px var(--teal-50)' : undefined }}>
                          <b>{hhmm(j.depart)} → {hhmm(j.arrive)}</b> <span className="hint">· {j.minutes} min · {j.changes === 0 ? 'direct' : `${j.changes} change${j.changes > 1 ? 's' : ''}`}</span>
                          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                            {j.legs.map((l, i) => l.type === 'walk'
                              ? <span key={i} className="hint">walk {l.mins} min</span>
                              : <span key={i} className="chip" style={{ background: legColor(data, l), color: '#fff' }}><Icon name={MODE_ICON[data.stops[l.from]?.[4]] || 'bus'} size={13} />{data.routes[l.pattern.split(':')[0]]?.[0]}</span>)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  {plans[pick] && <JourneyLegs data={data} journey={plans[pick]} />}
                </>
              )}
              <p className="hint" style={{ marginTop: 10 }}>Times come from each route's scheduled timetable, with the time between stops taken from a typical trip. They are scheduled, not live: use the live times on a stop's own page for the bus that is actually coming.</p>
              {journeyMap && <RouteMap stops={journeyMap.stops} youId={[origin.stopId, dest.stopId]} color="#1D4ED8" legs={journeyMap.legs} />}
            </section>
          )}

          {origin && !dest && (
            <section className="fact" style={{ marginTop: 18 }}>
              <button type="button" className="link" style={{ marginBottom: 8 }} onClick={() => { setOrigin(null); setSel(null); setLive(null) }}><Icon name="back" size={15} />Search a different stop</button>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={MODE_ICON[origin.mode] || 'bus'} size={18} />{origin.name}{origin.code && origin.mode === 'bus' ? <span className="hint">· stop {origin.code}</span> : null}</h2>
              {(origin.mode === 'tram' || origin.mode === 'rail') && <LiveBoard origin={origin} data={data} />}
              <p className="hint" style={{ margin: '4px 0 10px' }}>{routes.length} route{routes.length === 1 ? '' : 's'} serve this stop.</p>
              <div className="tags">
                {routes.map(([rid, did]) => {
                  const r = data.routes[rid]; if (!r) return null
                  const on = sel && sel.routeId === rid && sel.directionId === did
                  const dir = direction(data, rid, did, origin.stopId)
                  return <button key={rid + did} type="button" className={`chip route-chip ${on ? 'pub' : ''}`} style={{ cursor: 'pointer', border: on ? 'none' : '1px solid var(--line)' }} aria-pressed={on}
                    onClick={() => { setSel({ routeId: rid, directionId: did }); setLive(null) }}><b>{r[0]}</b>{dir && <small>to {dir.to}</small>}</button>
                })}
              </div>

              {sel && (() => {
                const route = data.routes[sel.routeId]
                return (
                  <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                    <button type="button" className="link" style={{ marginBottom: 8 }} onClick={() => { setSel(null); setLive(null) }}><Icon name="back" size={15} />Back to all routes at this stop</button>
                    {(() => { const dir = direction(data, sel.routeId, sel.directionId, origin.stopId); return <p style={{ margin: '0 0 10px', fontWeight: 700 }}>Route {route[0]}{dir ? ` towards ${dir.to}` : ''}{dir?.way && <span className="hint" style={{ fontWeight: 500 }}> ({dir.way})</span>}</p> })()}
                    {opposite && (() => { const od = direction(data, sel.routeId, opposite.directionId, opposite.stopId); return <p style={{ margin: '0 0 10px', fontSize: 14 }}>Want the other direction? <button type="button" className="link" onClick={() => { setOrigin({ stopId: opposite.stopId, name: opposite.name, code: opposite.code, mode: opposite.mode }); setSel({ routeId: sel.routeId, directionId: opposite.directionId }); setLive(null) }}>{route[0]} {od ? `to ${od.to}` : 'the other way'}, from {opposite.name}{opposite.code ? ` (stop ${opposite.code})` : ''}, {opposite.m} m away</button></p> })()}
                    <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 14 }}>Next departures from here</p>
                    {departures.length ? (
                      <ul className="rows" style={{ margin: '0 0 10px' }}>
                        {departures.map((d, i) => {
                          const m = matched.get(i)
                          const expected = m ? hhmm(m.expMin) : null
                          const sec = m?.delaySec ?? (m ? (m.expMin - d.mins) * 60 : null)
                          return (
                            <li key={i} style={{ display: 'flex', gap: '2px 10px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontVariantNumeric: 'tabular-nums', color: expected ? 'var(--muted)' : 'inherit' }}>{hhmm(d.mins)}</span>
                              {expected
                                ? <span className={`chip ${delayTone(sec)}`} title={m.exact ? 'Reported directly at this stop' : "Estimated: this bus's delay carried forward from its last reported stop, since the feed hasn't updated this exact stop yet"}><span className="dot" aria-hidden="true" /> {m.exact ? 'Expected' : '~Expected'} {expected}{sec != null ? ` (${delayLabel(sec)})` : ''}</span>
                                : null}
                              {m && busPos.get(m.tripId)?.metres != null && <span className="hint" style={{ whiteSpace: 'nowrap', marginLeft: 'auto' }} title="Straight-line distance from the bus's latest GPS fix to this stop">{away(busPos.get(m.tripId).metres)}</span>}
                            </li>
                          )
                        })}
                      </ul>
                    ) : <p className="hint" style={{ margin: '0 0 12px' }}>{trips === 'error' ? <>Could not load today's timetable. <button type="button" className="link" onClick={() => setTripsTry((n) => n + 1)}>Try again</button></> : !tripsHere ? 'Loading today\'s timetable…' : tripList && !tripList.length ? 'This route does not run today.' : 'No more scheduled departures today.'}</p>}
                    {live && !matched.size && <p className="hint" style={{ margin: '0 0 10px' }}>No live bus on this route is due within the hour, so these are scheduled times only.</p>}
                    <p className="hint" style={{ margin: '0 0 6px' }}>Scheduled times are today's timetable. Each live bus is matched to its own scheduled trip by the National Transport Authority's trip id{live?.updated ? `, updated ${ago(live.updated)}` : ''}. "~Expected" means the feed hasn't reported that bus at this exact stop yet, so its delay is carried forward from the last stop it reported. Live times show for buses due within the next hour.</p>
                    {shape && <>
                      <RouteMap stops={shape.map((sid) => { const s = data.stops[sid]; return { id: sid, name: s?.[1] || sid, lat: s?.[2], lon: s?.[3] } })} youId={origin.stopId} path={paths?.[`${sel.routeId}:${sel.directionId}`]} buses={[...busPos.values()]} />
                      {busPos.size > 0 && <p className="hint" style={{ margin: '6px 0 0' }}>Labelled dots are this route's buses at their latest GPS position (tap one for details) ({busPos.size} right now): green on time, blue a few minutes late, orange more than five, grey no delay reported. Only buses going this way are shown; the map refreshes every 15 seconds.</p>}
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
