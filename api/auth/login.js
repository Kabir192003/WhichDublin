// POST /api/auth/login { username, password }
import { db } from '../../server/db.js'
import { send, fail, ipHash, readJson, sameOrigin, setSessionCookie } from '../../server/http.js'
import { verifyPassword, createSession, tooManyAttempts, recordAttempt } from '../../server/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only')
  if (!sameOrigin(req)) return fail(res, 403, 'Wrong origin')
  try {
    const b = await readJson(req)
    const username = String(b.username || '').trim()
    const password = String(b.password || '')
    if (!username || !password) return fail(res, 400, 'Enter a username and password')

    const sql = await db(), ip = ipHash(req)
    if (await tooManyAttempts(sql, ip, 'login', 20, '1 hour')) return fail(res, 429, 'Too many attempts, try again later')
    await recordAttempt(sql, ip, 'login')

    const rows = await sql`select id, password_hash from users where lower(username) = lower(${username})`
    const user = rows[0]
    if (!user || !verifyPassword(password, user.password_hash)) return fail(res, 401, 'Wrong username or password')

    const { token, maxAgeSec } = await createSession(sql, user.id)
    setSessionCookie(res, token, maxAgeSec)
    send(res, 200, { username })
  } catch (e) { fail(res, e.status || 500, e.status ? e.message : 'Something went wrong; try again') }
}
