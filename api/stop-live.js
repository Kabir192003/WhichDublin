// GET /api/stop-live?stop=<stopId>&trips=<tripId1,tripId2,...> -> live delay for these specific
// trips at this specific stop, from the raw GTFS-RT feed, not the route-wide aggregate.
import { tripStopDelays } from '../server/live.js'
import { send, fail } from '../server/http.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only')
  const stop = String(req.query?.stop || '').trim()
  const trips = String(req.query?.trips || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10)
  if (!stop || !trips.length) return fail(res, 400, 'stop and trips are required')
  try {
    const d = await tripStopDelays(trips, stop)
    send(res, 200, d, 'public, s-maxage=30, stale-while-revalidate=30')
  } catch (e) { fail(res, e.status || 500, e.status ? e.message : 'Live data unavailable') }
}
