// POST /api/auth/logout
import { db, hasDb } from '../../server/db.js'
import { send, fail, sameOrigin, getSessionToken, clearSessionCookie } from '../../server/http.js'
import { deleteSession } from '../../server/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only')
  if (!sameOrigin(req)) return fail(res, 403, 'Wrong origin')
  try {
    const token = getSessionToken(req)
    if (token && hasDb()) await deleteSession(await db(), token)
    clearSessionCookie(res)
    send(res, 200, { ok: true })
  } catch (e) { fail(res, e.status || 500, e.status ? e.message : 'Something went wrong; try again') }
}
