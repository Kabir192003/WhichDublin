// GET /api/live?routes=bus:39A,tram:Green  -> city-wide delays now, plus the requested routes.
import { live } from '../server/live.js'
import { send, fail, crash } from '../server/http.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only')
  try {
    const d = await live()
    if (req.query?.debug === 'trips') { const { liveTrips } = await import('../server/live.js'); const t = (liveTrips() || []).filter((x) => String(x[0]).includes(String(req.query.r || '38A'))); return send(res, 200, { n: t.length, sample: t.slice(0, 8).map((x) => [x[0], x[2] || null, x[3] || null, x[1].slice(0, 2)]) }, 'no-store') }
    const want = String(req.query?.routes || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40)
    const routes = {}
    for (const k of want) if (d.routes[k]) routes[k] = d.routes[k]
    send(res, 200, { updated: d.updated, city: d.city, routes }, 'public, s-maxage=30, stale-while-revalidate=30')
  } catch (e) { await crash(res, e, 'Live data unavailable') }
}
