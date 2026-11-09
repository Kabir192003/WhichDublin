// GET /api/auth/me -> { username } if signed in, { username: null } otherwise. Never errors just
// for being signed out, so the client can call this on every load without special-casing it.
import { db, hasDb } from '../../server/db.js'
import { send, fail, getSessionToken } from '../../server/http.js'
import { sessionUser } from '../../server/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only')
  try {
    if (!hasDb()) return send(res, 200, { username: null })
    const token = getSessionToken(req)
    const user = await sessionUser(await db(), token)
    send(res, 200, { username: user?.username || null })
  } catch (e) { fail(res, e.status || 500, e.status ? e.message : 'Something went wrong') }
}
