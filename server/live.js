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
 * schedule periodically), so trip_id matching silently finds nothing once that drifts. Each
 * result is one bus; the caller matches these to its own scheduled times by closest arrival.
 * Shares live()'s 30 s cache. */
export async function stopRouteLive(stopId, routeId) {
  await live()
  const out = []
  for (const e of cache.feed?.entity || []) {
    const tu = e.trip_update; if (!tu || tu.trip?.route_id !== routeId) continue
    const hit = (tu.stop_time_update || []).find((s) => s.stop_id === stopId)
    if (!hit) continue
    const a = hit.arrival || hit.departure || {}
    const atMs = a.time ? Number(a.time) * 1000 : null
    const delaySec = a.delay ?? null
    if (atMs == null && delaySec == null) continue
    out.push({ atMs, delaySec })
  }
  return { updated: cache.data?.updated, live: out }
}
