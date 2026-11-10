// POST /api/auth/signup { username, password } -> creates an account and signs you in.
// No personal info is asked for or stored. The client UI should already tell people not to use
// their real name or a password they use elsewhere; this endpoint doesn't re-check that, since
// there's no reliable way to.
import { db } from '../../server/db.js'
import { send, fail, ipHash, readJson, sameOrigin, setSessionCookie, crash } from '../../server/http.js'
import { validUsername, validPassword, hashPassword, createSession, tooManyAttempts, recordAttempt } from '../../server/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only')
  if (!sameOrigin(req)) return fail(res, 403, 'Wrong origin')
  try {
    const b = await readJson(req)
    const username = String(b.username || '').trim()
    const password = String(b.password || '')
    if (!validUsername(username)) return fail(res, 400, '3-24 characters: letters, numbers, . _ or - only')
    if (!validPassword(password)) return fail(res, 400, 'Password needs at least 5 characters')

    const sql = await db(), ip = ipHash(req)
    if (await tooManyAttempts(sql, ip, 'signup', 10, '1 hour')) return fail(res, 429, 'Too many attempts, try again later')
    await recordAttempt(sql, ip, 'signup')

    const existing = await sql`select id from users where lower(username) = lower(${username})`
    if (existing.length) return fail(res, 409, 'That username is taken')

    const [{ id }] = await sql`insert into users (username, password_hash) values (${username}, ${hashPassword(password)}) returning id`
    const { token, maxAgeSec } = await createSession(sql, id)
    setSessionCookie(res, token, maxAgeSec)
    send(res, 201, { username })
  } catch (e) { await crash(res, e, 'Something went wrong; try again') }
}
