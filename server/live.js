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

export async function live() {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data
  if (cache.pending) return cache.pending
  const key = process.env.NTA_API_KEY
  if (!key) throw Object.assign(new Error('Live data not configured'), { status: 503 })
  cache.pending = fetch('https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json', { headers: { 'x-api-key': key, 'Cache-Control': 'no-cache' } })
    .then(async (r) => { if (!r.ok) throw Object.assign(new Error(`NTA feed ${r.status}`), { status: 502 }); return summarise(await r.json()) })
    .then((d) => { cache = { at: Date.now(), data: d, pending: null }; return d })
    .catch((e) => { cache.pending = null; if (cache.data) return cache.data; throw e })
  return cache.pending
}
