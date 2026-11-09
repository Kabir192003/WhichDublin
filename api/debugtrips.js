// TEMP debug endpoint, to be removed after trip_id matching is confirmed.
import { sampleTrips } from '../server/live.js'
import { send, fail } from '../server/http.js'

export default async function handler(req, res) {
  try {
    const route = String(req.query?.route || '11')
    send(res, 200, await sampleTrips(route), 'no-store')
  } catch (e) { fail(res, e.status || 500, e.status ? e.message : 'error') }
}
