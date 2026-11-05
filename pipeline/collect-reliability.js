// Collects live delays from the National Transport Authority GTFS-Realtime feed, for the reliability label.
// Needs a free API key from https://developer.nationaltransport.ie (set as the NTA_API_KEY secret).
// Each run appends one summary row per route to data/reliability/YYYY-MM-DD.ndjson on the
// reliability-data branch (kept off main so deploys aren't triggered every 15 minutes).
import fs from 'node:fs'
const key = process.env.NTA_API_KEY
if (!key) { console.log('NTA_API_KEY not set: skipping (reliability needs a free NTA developer key)'); process.exit(0) }
const r = await fetch('https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json', { headers: { 'x-api-key': key, 'Cache-Control': 'no-cache' } })
if (!r.ok) { console.error('GTFS-R', r.status); process.exit(1) }
const feed = await r.json()
const t = Number(feed.header?.timestamp) || Math.floor(Date.now() / 1000)
// One compact summary per route per run (the raw feed is far too big to keep for weeks):
// [feed time, route, trips seen, readings, late > 5 min, late > 10 min, early > 1 min, sum of delays in seconds]
const byRoute = new Map()
for (const e of feed.entity || []) {
  const tu = e.trip_update; if (!tu) continue
  const route = tu.trip?.route_id; if (!route) continue
  // the latest stop update on a trip is its current delay; earlier ones are history already counted in earlier runs
  const ups = (tu.stop_time_update || []).filter((s) => (s.arrival?.delay ?? s.departure?.delay) != null)
  if (!ups.length) continue
  const delay = ups[ups.length - 1].arrival?.delay ?? ups[ups.length - 1].departure?.delay
  const r = byRoute.get(route) || { trips: 0, n: 0, late5: 0, late10: 0, early: 0, sum: 0 }
  r.trips++; r.n++; r.sum += delay
  if (delay > 300) r.late5++
  if (delay > 600) r.late10++
  if (delay < -60) r.early++
  byRoute.set(route, r)
}
const rows = [...byRoute].map(([route, r]) => JSON.stringify([t, route, r.trips, r.n, r.late5, r.late10, r.early, r.sum]))
fs.mkdirSync('data/reliability', { recursive: true })
const day = new Date(t * 1000).toISOString().slice(0, 10)
fs.appendFileSync(`data/reliability/${day}.ndjson`, rows.join('\n') + (rows.length ? '\n' : ''))
console.log('routes summarised', rows.length)
