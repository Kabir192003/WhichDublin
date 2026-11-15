/**
 * Journey planner over the NTA timetable data in stops.json: bus, Luas, DART and rail, with walking changes.
 * A small RAPTOR (round-based earliest arrival): round k finds the earliest arrival at every stop using at most
 * k vehicle legs, so "1 change" is round 2. Pure and synchronous, so it is unit-tested.
 *
 * The data gives, per route pattern ("routeId:directionId"), an ordered stop list (shapes), the minutes from the
 * first stop to each stop (offsets), and the departure minutes at every stop (departures). A trip boarding at stop i
 * at minute d reaches stop j at d - offsets[i] + offsets[j]. Times are minutes after midnight.
 */

const WALK_M_PER_MIN = 80, DETOUR = 1.3, MAX_WALK_M = 300, CHANGE_BUFFER = 1

const rad = Math.PI / 180
export function metres(a, b) {
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}
const walkMins = (m) => Math.max(1, Math.ceil((m * DETOUR) / WALK_M_PER_MIN))

/** Index the data once: patterns, which patterns serve each stop, and walking links between nearby stops. */
export function buildIndex(data) {
  const patterns = new Map(), stopPatterns = new Map()
  for (const [key, stops] of Object.entries(data.shapes || {})) {
    const off = data.offsets?.[key]; if (!off || off.length !== stops.length) continue
    patterns.set(key, { key, stops, off })
    stops.forEach((sid, i) => { if (!stopPatterns.has(sid)) stopPatterns.set(sid, []); stopPatterns.get(sid).push([key, i]) })
  }
  // ~330 m grid cells for the walking links
  const cell = (lat, lon) => `${Math.floor(lat * 300)}:${Math.floor(lon * 190)}`
  const grid = new Map()
  for (const sid of stopPatterns.keys()) {
    const s = data.stops[sid]; if (!s) continue
    const c = cell(s[2], s[3]); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(sid)
  }
  const walks = new Map()
  for (const sid of stopPatterns.keys()) {
    const s = data.stops[sid]; if (!s) continue
    const out = []
    const [cy, cx] = [Math.floor(s[2] * 300), Math.floor(s[3] * 190)]
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) for (const o of grid.get(`${y}:${x}`) || []) {
      if (o === sid) continue
      const t = data.stops[o], m = metres([s[2], s[3]], [t[2], t[3]])
      if (m <= MAX_WALK_M) out.push([o, walkMins(m), Math.round(m)])
    }
    walks.set(sid, out)
  }
  const byName = new Map()
  for (const sid of stopPatterns.keys()) { const s = data.stops[sid]; const k = `${s[4]}|${s[1]}`; if (!byName.has(k)) byName.set(k, []); byName.get(k).push(sid) }
  return { data, patterns, stopPatterns, walks, byName }
}

/** All stops that belong to the same station or stop name (both Luas platforms, both sides of a street). */
export function stationGroup(idx, stopId) {
  const s = idx.data.stops[stopId]; if (!s) return [stopId]
  return (idx.byName.get(`${s[4]}|${s[1]}`) || [stopId]).filter((o) => { const t = idx.data.stops[o]; return o === stopId || metres([s[2], s[3]], [t[2], t[3]]) <= 400 })
}

function nextDeparture(list, t) {
  if (!list || !list.length) return null
  let lo = 0, hi = list.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid] < t) lo = mid + 1; else hi = mid }
  return lo < list.length ? list[lo] : list[0] + 1440   // nothing left today: the first one tomorrow
}

/**
 * Earliest-arrival journeys from any stop in `from` to any stop in `to`, leaving at `start`.
 * Returns the best journey for 1, 2 and 3 vehicle legs, only when each is faster than the one before.
 */
export function plan(idx, from, to, start, { maxLegs = 3 } = {}) {
  const { data, patterns, stopPatterns, walks } = idx
  const INF = 1e9
  const rounds = []        // rounds[k]: Map stop -> { arr, via }
  const best = new Map()   // best arrival so far over all rounds
  const r0 = new Map()
  for (const sid of from) { r0.set(sid, { arr: start, via: { type: 'start' } }); best.set(sid, start) }
  const walkFrom = (round, marked) => {
    const add = []
    for (const sid of marked) {
      const here = round.get(sid)
      for (const [o, w, m] of walks.get(sid) || []) {
        const arr = here.arr + w
        if (arr < (best.get(o) ?? INF) - 1e-9) { add.push([o, { arr, via: { type: 'walk', from: sid, mins: w, metres: m } }]); best.set(o, arr) }
      }
    }
    for (const [o, e] of add) { round.set(o, e); marked.add(o) }
  }
  const marked0 = new Set(from); walkFrom(r0, marked0); rounds.push(r0)
  let marked = new Set(r0.keys())

  for (let k = 1; k <= maxLegs; k++) {
    const prev = rounds[k - 1], cur = new Map(), improved = new Set()
    // the earliest marked position on each pattern
    const queue = new Map()
    for (const sid of marked) for (const [key, i] of stopPatterns.get(sid) || []) { const q = queue.get(key); if (q === undefined || i < q) queue.set(key, i) }
    for (const [key, startIdx] of queue) {
      const pat = patterns.get(key)
      let boardT0 = null, boardIdx = -1, boardStop = null, boardDep = 0   // boardT0: the trip's time at the pattern's first stop
      for (let i = startIdx; i < pat.stops.length; i++) {
        const sid = pat.stops[i]
        if (boardT0 !== null) {
          const arr = boardT0 + pat.off[i]
          if (arr < Math.min(best.get(sid) ?? INF, cur.get(sid)?.arr ?? INF) - 1e-9) {
            cur.set(sid, { arr, via: { type: 'ride', pattern: key, from: boardStop, fromIdx: boardIdx, toIdx: i, depart: boardDep, arrive: arr } })
            best.set(sid, arr); improved.add(sid)
          }
        }
        const pe = prev.get(sid)
        if (pe && marked.has(sid)) {
          const ready = pe.arr + (k > 1 ? CHANGE_BUFFER : 0)
          const d = nextDeparture(data.departures[`${sid}:${key}`], ready)
          if (d !== null && (boardT0 === null || d - pat.off[i] < boardT0)) { boardT0 = d - pat.off[i]; boardIdx = i; boardStop = sid; boardDep = d }
        }
      }
    }
    walkFrom(cur, improved)
    rounds.push(cur)
    marked = improved
    if (!improved.size) break
  }

  const results = []
  let bestArr = INF
  for (let k = 1; k < rounds.length; k++) {
    let hit = null
    for (const sid of to) { const e = rounds[k].get(sid); if (e && e.via.type !== 'start' && (!hit || e.arr < hit.e.arr)) hit = { sid, e } }
    if (!hit || hit.e.arr >= bestArr - 1e-9) continue
    bestArr = hit.e.arr
    results.push(trace(idx, rounds, k, hit.sid, start))
  }
  return results
}

function trace(idx, rounds, k, stopId, start) {
  const legs = []
  let sid = stopId, round = k
  for (let guard = 0; guard < 40; guard++) {
    const e = rounds[round].get(sid)
    if (!e || e.via.type === 'start') break
    const v = e.via
    if (v.type === 'walk') { legs.unshift({ type: 'walk', from: v.from, to: sid, mins: v.mins, metres: v.metres }); sid = v.from; continue }
    const pat = idx.patterns.get(v.pattern)
    legs.unshift({ type: 'ride', pattern: v.pattern, from: v.from, to: sid, depart: v.depart, arrive: v.arrive, stops: pat.stops.slice(v.fromIdx, v.toIdx + 1) })
    sid = v.from; round -= 1
  }
  const rides = legs.filter((l) => l.type === 'ride')
  const departAt = rides.length ? rides[0].depart : start
  const arriveAt = rides.length ? Math.max(rides[rides.length - 1].arrive, 0) + (legs[legs.length - 1].type === 'walk' ? legs[legs.length - 1].mins : 0) : start
  return { legs, changes: rides.length - 1, depart: departAt, arrive: arriveAt, minutes: arriveAt - start }
}
