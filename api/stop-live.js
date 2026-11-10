// GET /api/stop-live?stop=<stopId>&route=<routeId>&shape=<stopId,stopId,...> -> every bus of that
// route currently due at that stop, from the raw GTFS-RT feed. Matched by route + stop, not
// trip_id (the live feed's trip_id can drift from whatever static GTFS snapshot the timetable
// was last built from). `shape` (the route's ordered stop list) lets the server place a bus that
// hasn't reported an update for this exact stop yet by its last known position on the route.
import { stopRouteLive } from '../server/live.js'
import { send, fail, crash } from '../server/http.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only')
  const stop = String(req.query?.stop || '').trim()
  const route = String(req.query?.route || '').trim()
  const shape = String(req.query?.shape || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 400)
  if (!stop || !route) return fail(res, 400, 'stop and route are required')
  try {
    const d = await stopRouteLive(stop, route, shape)
    send(res, 200, d, 'public, s-maxage=30, stale-while-revalidate=30')
  } catch (e) { await crash(res, e, 'Live data unavailable') }
}
