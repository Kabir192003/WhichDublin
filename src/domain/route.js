/** Route planning in the browser, on the same timetable networks the pipeline uses. Networks load on demand. */
import { buildTransfers, journeys, summarise } from './csa.js'

const h = (hh, mm = 0) => hh * 3600 + mm * 60
const every = (from, to, step) => { const out = []; for (let t = from; t <= to; t += step) out.push(t); return out }
export const WHEN = {
  am: { label: 'Weekday, leaving 07:30 to 08:30', departs: every(h(7, 30), h(8, 30), 300) },
  late: { label: 'Weekday night, leaving 22:00 to 23:00', departs: every(h(22), h(23), 600) },
  sat: { label: 'Saturday, leaving 10:00 to 11:00', departs: every(h(10), h(11), 600) }
}

const loaded = {}
export function loadNetwork(kind, base = '/') {
  if (!loaded[kind]) loaded[kind] = fetch(`${base}data/network-${kind}.json`).then((r) => { if (!r.ok) throw new Error(`network ${kind}: ${r.status}`); return r.json() }).then(prepare)
  return loaded[kind]
}
export function prepare(raw) {
  const stops = raw.stops.map(([lat, lon, name]) => ({ lat, lon, name }))
  const c = raw.conn
  const conn = { dep: Int32Array.from(c.dep), arr: Int32Array.from(c.arr), from: Int32Array.from(c.from), to: Int32Array.from(c.to), trip: Int32Array.from(c.trip) }
  return { stops, conn, transfers: buildTransfers(stops, 300), date: raw.date }
}

/** One origin to many destinations: one scan per departure. */
export function planFrom(net, origin, dests, departs) {
  const per = departs.map((t) => journeys(net, origin, dests, t))
  return dests.map((_, i) => summarise(per.map((r) => r[i])))
}

/** Many origins to one destination, yielding to the browser between origins so the page stays responsive. */
export async function planTo(net, origins, dest, departs, onProgress) {
  const out = []
  for (let i = 0; i < origins.length; i++) {
    out.push(summarise(departs.map((t) => journeys(net, origins[i], [dest], t)[0])))
    if (i % 4 === 3) { onProgress && onProgress((i + 1) / origins.length); await new Promise((r) => setTimeout(r, 0)) }
  }
  onProgress && onProgress(1)
  return out
}
