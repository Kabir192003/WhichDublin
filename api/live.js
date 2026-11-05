// GET /api/live?routes=bus:39A,tram:Green  -> city-wide delays now, plus the requested routes.
import { live } from '../server/live.js'
import { send, fail } from '../server/http.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only')
  try {
    const d = await live()
    const want = String(req.query?.routes || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40)
    const routes = {}
    for (const k of want) if (d.routes[k]) routes[k] = d.routes[k]
    send(res, 200, { updated: d.updated, city: d.city, routes }, 'public, s-maxage=30, stale-while-revalidate=30')
  } catch (e) { fail(res, e.status || 500, e.status ? e.message : 'Live data unavailable') }
}
