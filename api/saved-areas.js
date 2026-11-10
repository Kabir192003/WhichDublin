// GET    /api/saved-areas             -> { areas: [areaId, ...] } for the signed-in user
// POST   /api/saved-areas { area }     -> save one area
// DELETE /api/saved-areas?area=<id>    -> remove one area
// Requires a signed-in session; this is the only account-gated data the app has, and it's just an
// area id list, nothing else.
import { db } from '../server/db.js'
import { send, fail, sameOrigin, readJson, getSessionToken, crash } from '../server/http.js'
import { sessionUser } from '../server/auth.js'
import areaIds from '../server/area-ids.js'
const AREAS = new Set(areaIds)

export default async function handler(req, res) {
  try {
    const sql = await db()
    const user = await sessionUser(sql, getSessionToken(req))
    if (!user) return fail(res, 401, 'Sign in to save areas')

    if (req.method === 'GET') {
      const rows = await sql`select area_id from saved_areas where user_id = ${user.id} order by created_at desc`
      return send(res, 200, { areas: rows.map((r) => r.area_id) })
    }
    if (req.method === 'POST') {
      if (!sameOrigin(req)) return fail(res, 403, 'Wrong origin')
      const b = await readJson(req)
      const area = String(b.area || '')
      if (!AREAS.has(area)) return fail(res, 400, 'Unknown area')
      await sql`insert into saved_areas (user_id, area_id) values (${user.id}, ${area}) on conflict do nothing`
      return send(res, 201, { ok: true })
    }
    if (req.method === 'DELETE') {
      if (!sameOrigin(req)) return fail(res, 403, 'Wrong origin')
      const area = String(req.query?.area || '')
      await sql`delete from saved_areas where user_id = ${user.id} and area_id = ${area}`
      return send(res, 200, { ok: true })
    }
    fail(res, 405, 'GET, POST or DELETE only')
  } catch (e) { await crash(res, e, 'Something went wrong; try again') }
}
