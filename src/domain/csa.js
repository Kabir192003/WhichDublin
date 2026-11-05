/**
 * Connection Scan Algorithm for scheduled public transport, earliest arrival, with walking
 * transfers and walking access/egress. Pure functions (no I/O), tested on a toy network.
 *
 * Times are seconds since midnight.
 * network: {
 *   stops: [{ lat, lon }],                          // index = stop id
 *   conn: { dep, arr, from, to, trip }              // parallel arrays (Int32Array or arrays), sorted by dep
 *   transfers: Array<Array<{ to, secs }>>           // footpaths between nearby stops, index = stop id
 * }
 */
const WALK_SPEED_MS = 1.25   // 4.5 km/h
const DETOUR = 1.3           // street distance ~ straight line x 1.3
const MIN_TRANSFER_SECS = 60

export function haversineMetres(a, b) {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
export const walkSecs = (metres) => Math.round((metres * DETOUR) / WALK_SPEED_MS)

/** Footpaths between stops closer than maxMetres. Grid-bucketed so 6,000 stops stay fast. */
export function buildTransfers(stops, maxMetres = 300) {
  const out = stops.map(() => [])
  const cell = 0.004, grid = new Map()
  const key = (la, lo) => Math.floor(la / cell) + ':' + Math.floor(lo / cell)
  stops.forEach((s, i) => { const k = key(s.lat, s.lon); (grid.get(k) || grid.set(k, []).get(k)).push(i) })
  stops.forEach((s, i) => {
    const gi = Math.floor(s.lat / cell), gj = Math.floor(s.lon / cell)
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const j of grid.get((gi + di) + ':' + (gj + dj)) || []) {
      if (j <= i) continue
      const d = haversineMetres(s, stops[j])
      if (d <= maxMetres) { const secs = walkSecs(d); out[i].push({ to: j, secs }); out[j].push({ to: i, secs }) }
    }
  })
  return out
}

/** Stops within maxMetres of a point, with walking seconds. */
export function nearbyStops(stops, point, maxMetres = 800) {
  const out = []
  for (let i = 0; i < stops.length; i++) {
    if (Math.abs(stops[i].lat - point.lat) > 0.01 || Math.abs(stops[i].lon - point.lon) > 0.02) continue
    const d = haversineMetres(stops[i], point)
    if (d <= maxMetres) out.push({ stop: i, secs: walkSecs(d), metres: d })
  }
  return out
}

function firstConnectionAtOrAfter(dep, t) {
  let lo = 0, hi = dep.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (dep[mid] < t) lo = mid + 1; else hi = mid }
  return lo
}

/**
 * One scan from an origin at one departure time to many destinations.
 * @returns array parallel to `destinations`: { totalSecs, walkSecs, rides } | null
 */
export function journeys(network, origin, destinations, departAt, opts = {}) {
  const { conn, stops, transfers } = network
  const maxAccess = opts.maxAccessMetres ?? 800, horizon = opts.horizonSecs ?? 3 * 3600
  const maxWalkOnly = opts.maxWalkOnlyMetres ?? 2500

  const n = stops.length
  const bestT = new Float64Array(n).fill(Infinity), bestWalk = new Float64Array(n), bestRides = new Int16Array(n)
  const relax = (s, t, w, r) => { if (t < bestT[s]) { bestT[s] = t; bestWalk[s] = w; bestRides[s] = r; return true } return false }
  for (const a of nearbyStops(stops, origin, maxAccess)) relax(a.stop, departAt + a.secs, a.secs, 0)

  const tripWalk = new Map(), tripRides = new Map() // state when first boarded
  const start = firstConnectionAtOrAfter(conn.dep, departAt), limit = departAt + horizon
  for (let i = start; i < conn.dep.length; i++) {
    const dep = conn.dep[i]
    if (dep > limit) break
    const trip = conn.trip[i], from = conn.from[i]
    let w = tripWalk.get(trip), r = tripRides.get(trip)
    if (w === undefined) {
      const t = bestT[from]
      if (t === Infinity) continue
      const need = bestRides[from] > 0 ? MIN_TRANSFER_SECS : 0
      if (t + need > dep) continue
      w = bestWalk[from]; r = bestRides[from] + 1
      tripWalk.set(trip, w); tripRides.set(trip, r)
    }
    const to = conn.to[i], arr = conn.arr[i]
    if (relax(to, arr, w, r)) for (const f of transfers[to]) relax(f.to, arr + f.secs, w + f.secs, r)
  }

  return destinations.map((dest) => {
    let best = null
    for (const e of nearbyStops(stops, dest, maxAccess)) {
      if (bestT[e.stop] === Infinity) continue
      // a journey that never boards a vehicle is just walking; handled below
      if (bestRides[e.stop] === 0) continue
      const total = bestT[e.stop] + e.secs - departAt
      if (!best || total < best.totalSecs) best = { totalSecs: total, walkSecs: bestWalk[e.stop] + e.secs, rides: bestRides[e.stop] }
    }
    const d = haversineMetres(origin, dest)
    if (d <= maxWalkOnly) { const ws = walkSecs(d); if (!best || ws <= best.totalSecs) return { totalSecs: ws, walkSecs: ws, rides: 0 } }
    return best
  })
}

export const journey = (network, origin, destination, departAt, opts) => journeys(network, origin, [destination], departAt, opts)[0]

/** Median door-to-door minutes across departures, plus what the confidence label needs. */
export function summarise(results) {
  const ok = results.filter(Boolean)
  if (!ok.length) return null
  const secs = ok.map((r) => r.totalSecs).sort((a, b) => a - b)
  const mid = secs.length >> 1
  const median = secs.length % 2 ? secs[mid] : (secs[mid - 1] + secs[mid]) / 2
  const walk = ok.reduce((s, r) => s + r.walkSecs, 0), total = ok.reduce((s, r) => s + r.totalSecs, 0)
  const typical = ok.slice().sort((a, b) => Math.abs(a.totalSecs - median) - Math.abs(b.totalSecs - median))[0]
  return {
    minutes: Math.round(median / 60),
    bestMinutes: Math.round(secs[0] / 60),
    worstMinutes: Math.round(secs[secs.length - 1] / 60),
    departures: ok.length, attempted: results.length,
    walkShare: total ? walk / total : 1,
    walkMinutes: Math.round(typical.walkSecs / 60),
    changes: Math.max(0, typical.rides - 1)
  }
}

export function medianCommute(network, origin, destination, departures, opts) {
  return summarise(departures.map((t) => journey(network, origin, destination, t, opts)))
}
