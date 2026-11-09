// Live delays from the NTA GTFS-Realtime feed. The key stays on the server; one fetch is shared for 30 seconds.
import routes from './routes.js'

const TTL = 30_000
let cache = { at: 0, data: null, pending: null }

export function summarise(feed) {
  const per = new Map()
  const all = []
  for (const e of feed.entity || []) {
    const tu = e.trip_update; if (!tu) continue
    const rid = tu.trip?.route_id; if (!rid) continue
    const ups = (tu.stop_time_update || []).filter((s) => (s.arrival?.delay ?? s.departure?.delay) != null)
    if (!ups.length) continue
    const last = ups[ups.length - 1]
    const d = last.arrival?.delay ?? last.departure?.delay
    const [name, op, mode] = routes[rid] || [rid, '', 'other']
    const key = `${mode}:${name}`
    const r = per.get(key) || { name, operator: op, mode, delays: [] }
    r.delays.push(d); per.set(key, r); all.push(d)
  }
  const stat = (ds) => {
    const s = [...ds].sort((a, b) => a - b)
    return { trips: s.length, medianMin: s.length ? Math.round(s[s.length >> 1] / 60) : null, late5Pct: s.length ? Math.round((100 * s.filter((x) => x > 300).length) / s.length) : null, late10: s.filter((x) => x > 600).length }
  }
  const out = {}
  for (const [k, r] of per) out[k] = { name: r.name, operator: r.operator, mode: r.mode, ...stat(r.delays) }
  return { updated: new Date((Number(feed.header?.timestamp) || Date.now() / 1000) * 1000).toISOString(), city: stat(all), routes: out }
}

async function fetchFeed() {
  const key = process.env.NTA_API_KEY
  if (!key) throw Object.assign(new Error('Live data not configured'), { status: 503 })
  const r = await fetch('https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json', { headers: { 'x-api-key': key, 'Cache-Control': 'no-cache' } })
  if (!r.ok) throw Object.assign(new Error(`NTA feed ${r.status}`), { status: 502 })
  return r.json()
}

export async function live() {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data
  if (cache.pending) return cache.pending
  cache.pending = fetchFeed()
    .then((feed) => { const d = summarise(feed); cache = { at: Date.now(), data: d, feed, pending: null }; return d })
    .catch((e) => { cache.pending = null; if (cache.data) return cache.data; throw e })
  return cache.pending
}

/** Live buses of one route currently due at one stop, straight from the raw feed. Matches by
 * route_id + stop_id, not trip_id: the live feed's trip_id can use a different numbering from
 * whatever static GTFS snapshot we last built the timetable from (operators re-version their
 * schedule periodically), so trip_id matching silently finds nothing once that drifts.
 *
 * NTA's feed does not carry a stop_time_update entry for every stop on a trip, only a sparse
 * subset, so a bus can be genuinely due in a minute with no explicit update for that exact stop
 * yet. When that happens, `shapeStopIds` (the route's ordered stop list, as the caller already
 * has it) lets us place each live update by its position on the route and propagate the most
 * recent known delay forward to the stop in question, the same way any GTFS-RT consumer has to.
 * A trip whose latest known position is already past our stop is dropped, not shown as upcoming.
 * Each result is one bus, tagged `exact: true` only when the feed named our stop directly.
 * Shares live()'s 30 s cache. */
export async function stopRouteLive(stopId, routeId, shapeStopIds = []) {
  await live()
  const targetIdx = shapeStopIds.indexOf(stopId)
  const out = []
  for (const e of cache.feed?.entity || []) {
    const tu = e.trip_update; if (!tu || tu.trip?.route_id !== routeId) continue
    const updates = tu.stop_time_update || []
    const exactHit = updates.find((s) => s.stop_id === stopId)
    if (exactHit) {
      const a = exactHit.arrival || exactHit.departure || {}
      const atMs = a.time ? Number(a.time) * 1000 : null, delaySec = a.delay ?? null
      if (atMs != null || delaySec != null) out.push({ atMs, delaySec, exact: true })
      continue
    }
    if (targetIdx === -1) continue   // no shape given, or stop not on it: can't place this trip
    let best = null, passedUs = false
    for (const s of updates) {
      const idx = shapeStopIds.indexOf(s.stop_id); if (idx === -1) continue
      if (idx > targetIdx) { passedUs = true; break }
      const a = s.arrival || s.departure || {}
      const delaySec = a.delay ?? null
      if (delaySec != null && (!best || idx > best.idx)) best = { idx, delaySec }
    }
    if (!passedUs && best) out.push({ atMs: null, delaySec: best.delaySec, exact: false })
  }
  return { updated: cache.data?.updated, live: out }
}
