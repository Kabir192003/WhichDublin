// Collects live delays from the National Transport Authority GTFS-Realtime feed, for the reliability label.
// Needs a free API key from https://developer.nationaltransport.ie (set as the NTA_API_KEY secret).
// Each run appends one compact sample per trip update to data/reliability/YYYY-MM-DD.ndjson on the
// reliability-data branch (kept off main so deploys aren't triggered every 15 minutes).
import fs from 'node:fs'
const key = process.env.NTA_API_KEY
if (!key) { console.log('NTA_API_KEY not set: skipping (reliability needs a free NTA developer key)'); process.exit(0) }
const r = await fetch('https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json', { headers: { 'x-api-key': key, 'Cache-Control': 'no-cache' } })
if (!r.ok) { console.error('GTFS-R', r.status); process.exit(1) }
const feed = await r.json()
const t = Number(feed.header?.timestamp) || Math.floor(Date.now() / 1000)
const rows = []
for (const e of feed.entity || []) {
  const tu = e.trip_update; if (!tu) continue
  const route = tu.trip?.route_id
  for (const s of tu.stop_time_update || []) {
    const delay = s.arrival?.delay ?? s.departure?.delay
    if (delay == null || !s.stop_id) continue
    rows.push(JSON.stringify([t, route, s.stop_id, delay]))   // [feed time, route, stop, delay seconds]
  }
}
fs.mkdirSync('data/reliability', { recursive: true })
const day = new Date(t * 1000).toISOString().slice(0, 10)
fs.appendFileSync(`data/reliability/${day}.ndjson`, rows.join('\n') + (rows.length ? '\n' : ''))
console.log('samples', rows.length)
