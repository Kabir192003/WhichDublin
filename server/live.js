// Live delays from the NTA GTFS-Realtime feed.
//
// The feed is shared across every serverless instance via a single row in Postgres (server/db.js,
// live_cache table), not just an in-memory cache. Vercel functions are independent processes with
// no shared memory, so an in-memory-only cache (what this used to be) means every cold instance
// refreshes on its own: under real concurrent traffic, many instances can race to hit NTA within
// the same window. This is not theoretical — a handful of manual test requests during development
// were enough to get a 429 from NTA's upstream. A Postgres advisory lock (pg_try_advisory_lock)
// means only one instance actually fetches NTA at a time; any instance that loses the race waits
// briefly and reads what the winner wrote, rather than also calling NTA.
//
// The feed itself is only used to produce a compact trip->stop->delay index (route_id, and per
// stop: stop_id, delay seconds, absolute time); everything else in the raw payload is dropped
// before it's cached, so the shared row stays well under a megabyte instead of the multi-MB raw
// feed, cheap to read on every request. The key stays on the server.
import routes from './routes.js'
import { db, hasDb } from './db.js'

const TTL = 30_000
const LOCK_ID = 847_201
let cache = { at: 0, data: null, trips: null, pending: null }

export function compact(feed) {
  const out = []
  for (const e of feed.entity || []) {
    const tu = e.trip_update; if (!tu) continue
    const rid = tu.trip?.route_id; if (!rid) continue
    const stops = []
    for (const s of tu.stop_time_update || []) {
      const a = s.arrival || s.departure || {}
      const delaySec = a.delay ?? null
      const atMs = a.time ? Number(a.time) * 1000 : null
      if (delaySec == null && atMs == null) continue
      stops.push([s.stop_id, delaySec, atMs])
    }
    const t = tu.trip || {}
    if (stops.length) out.push([rid, stops, t.trip_id || null, t.start_time || null, t.direction_id ?? null])
  }
  return out
}

export function summarise(trips, feedUpdatedAt) {
  const per = new Map()
  const all = []
  for (const [rid, stops] of trips) {
    const last = stops[stops.length - 1]
    const d = last[1]; if (d == null) continue
    const [name, op, mode] = routes[rid] || routes[String(rid).replace(/ /g, '_')] || routes[rkey(rid)] || [rid, '', 'other']
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
  return { updated: feedUpdatedAt || new Date().toISOString(), city: stat(all), routes: out }
}

async function fetchFeed() {
  const key = process.env.NTA_API_KEY
  if (!key) throw Object.assign(new Error('Live data not configured'), { status: 503 })
  const r = await fetch('https://api.nationaltransport.ie/gtfsr/v2/TripUpdates?format=json', { headers: { 'x-api-key': key, 'Cache-Control': 'no-cache' } })
  if (!r.ok) throw Object.assign(new Error(`NTA feed ${r.status}`), { status: 502 })
  return r.json()
}

async function refreshSharedCache(q) {
  const feed = await fetchFeed()
  const trips = compact(feed)
  const feedUpdatedAt = new Date((Number(feed.header?.timestamp) || Date.now() / 1000) * 1000).toISOString()
  await q`insert into live_cache (id, payload, feed_updated_at, fetched_at) values (1, ${JSON.stringify(trips)}::jsonb, ${feedUpdatedAt}, now())
          on conflict (id) do update set payload = excluded.payload, feed_updated_at = excluded.feed_updated_at, fetched_at = excluded.fetched_at`
  return { trips, feedUpdatedAt }
}

async function loadShared() {
  const q = await db()
  const rows = await q`select payload, feed_updated_at, fetched_at from live_cache where id = 1`
  const row = rows[0]
  if (row && Date.now() - new Date(row.fetched_at).getTime() < TTL) return { trips: row.payload, feedUpdatedAt: row.feed_updated_at }

  const [{ locked }] = await q`select pg_try_advisory_lock(${LOCK_ID}) as locked`
  if (locked) {
    try { return await refreshSharedCache(q) } finally { await q`select pg_advisory_unlock(${LOCK_ID})` }
  }
  // Another instance is refreshing right now: wait briefly for it rather than also calling NTA.
  await new Promise((r) => setTimeout(r, 400))
  const rows2 = await q`select payload, feed_updated_at from live_cache where id = 1`
  if (rows2[0]) return { trips: rows2[0].payload, feedUpdatedAt: rows2[0].feed_updated_at }
  return refreshSharedCache(q)   // nothing cached anywhere yet; fetch directly as a last resort
}

export async function live() {
  if (cache.data && Date.now() - cache.at < TTL) return cache.data
  if (cache.pending) return cache.pending
  cache.pending = (async () => {
    const { trips, feedUpdatedAt } = hasDb() ? await loadShared() : { trips: compact(await fetchFeed()), feedUpdatedAt: null }
    const d = summarise(trips, feedUpdatedAt)
    cache = { at: Date.now(), data: d, trips, pending: null }
    return d
  })().catch((e) => { cache.pending = null; if (cache.data) return cache.data; throw e })
  return cache.pending
}

/** Live buses of one route currently due at one stop, from the shared compacted feed. Matches by
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
 * Each result is one bus, tagged `exact: true` only when the feed named our stop directly. */
/** The live feed writes route ids with underscores ("1_38A_c_a"), the static timetable with spaces. */
const rkey = (id) => String(id).replace(/_/g, ' ')

export function matchStopRoute(trips, stopId, routeId, shapeStopIds = [], dir = null) {
  const want = rkey(routeId)
  const targetIdx = shapeStopIds.indexOf(stopId)
  const out = []
  for (const [rid, stops, tripId, startTime, d] of trips || []) {
    if (rkey(rid) !== want) continue
    if (dir != null && d != null && String(d) !== String(dir)) continue   // the other way: can share a start time
    const id = { ...(tripId ? { tripId } : {}), ...(startTime ? { startTime } : {}) }   // startTime (with route + direction) matches the timetable; tripId ties a delay to its GPS fix   // the feed's trip id: matches the timetable's exactly
    const exactHit = stops.find(([sid]) => sid === stopId)
    if (exactHit) { out.push({ atMs: exactHit[2], delaySec: exactHit[1], exact: true, ...id }); continue }
    if (targetIdx === -1) continue   // no shape given, or stop not on it: can't place this trip
    let best = null, passedUs = false
    for (const [sid, delaySec] of stops) {
      const idx = shapeStopIds.indexOf(sid); if (idx === -1) continue
      if (idx > targetIdx) { passedUs = true; break }
      if (delaySec != null && (!best || idx > best.idx)) best = { idx, delaySec }
    }
    if (!passedUs && best) out.push({ atMs: null, delaySec: best.delaySec, exact: false, ...id })
  }
  return out
}

export async function stopRouteLive(stopId, routeId, shapeStopIds = [], dir = null) {
  await live()
  const vs = await vehicles()
  return { updated: cache.data?.updated, live: matchStopRoute(cache.trips, stopId, routeId, shapeStopIds, dir), vehicles: routeVehicles(vs, routeId, new Map((cache.trips || []).map((t) => [t[2], t[3]])), dir) }
}

// ---- vehicle positions (GPS), shown on the route map and as "x km away" ----------------------------
// A second NTA feed (Vehicles) with each bus's latest GPS fix. Cached in the shared live_cache table (row 2)
// the same way as the trip updates (row 1). Optional: any failure here just means no bus markers.
const VLOCK = 847_202
const VTTL = 15_000   // bus positions refresh faster than delays: the map polls every 15 s
let vcache = { at: 0, data: null }

export function compactVehicles(feed) {
  const out = []
  for (const e of feed.entity || []) {
    const v = e.vehicle; if (!v) continue
    const t = v.trip || {}, p = v.position || {}
    if (!t.trip_id || p.latitude == null || p.longitude == null) continue
    out.push([t.trip_id, t.route_id || null, p.latitude, p.longitude, v.timestamp ? Number(v.timestamp) : null, t.start_time || null, t.direction_id ?? null])
  }
  return out
}

async function fetchVehicles() {
  const key = process.env.NTA_API_KEY
  if (!key) throw new Error('Live data not configured')
  const r = await fetch('https://api.nationaltransport.ie/gtfsr/v2/Vehicles?format=json', { headers: { 'x-api-key': key, 'Cache-Control': 'no-cache' } })
  if (!r.ok) throw new Error(`NTA vehicles ${r.status}`)
  return compactVehicles(await r.json())
}

async function vehiclesShared() {
  const q = await db()
  const save = async (list) => { await q`insert into live_cache (id, payload, feed_updated_at, fetched_at) values (2, ${JSON.stringify(list)}::jsonb, now(), now())
    on conflict (id) do update set payload = excluded.payload, feed_updated_at = excluded.feed_updated_at, fetched_at = excluded.fetched_at`; return list }
  const row = (await q`select payload, fetched_at from live_cache where id = 2`)[0]
  if (row && Date.now() - new Date(row.fetched_at).getTime() < VTTL) return row.payload
  const [{ locked }] = await q`select pg_try_advisory_lock(${VLOCK}) as locked`
  if (locked) { try { return await save(await fetchVehicles()) } finally { await q`select pg_advisory_unlock(${VLOCK})` } }
  await new Promise((r) => setTimeout(r, 400))
  const row2 = (await q`select payload from live_cache where id = 2`)[0]
  return row2 ? row2.payload : fetchVehicles()
}

export async function vehicles() {
  if (vcache.data && Date.now() - vcache.at < VTTL) return vcache.data
  try {
    const list = hasDb() ? await vehiclesShared() : await fetchVehicles()
    vcache = { at: Date.now(), data: list }
    return list
  } catch { return vcache.data || [] }   // optional extra: never break the departures if this feed is down
}

/** Buses of one route with their latest GPS fix: [{ tripId, startTime, lat, lon, ts }]. startOf: trip id -> start time from the trip updates. */
export function routeVehicles(list, routeId, startOf = new Map(), dir = null) {
  const want = rkey(routeId)
  return (list || []).filter((v) => v[1] && rkey(v[1]) === want && (dir == null || v[6] == null || String(v[6]) === String(dir))).map(([tripId, , lat, lon, ts, st]) => ({ tripId, startTime: st || startOf.get(tripId) || null, lat, lon, ts }))
}
