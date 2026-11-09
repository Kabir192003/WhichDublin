// Fully optional accounts: no personal information, just a username and a password, used only so
// someone can keep a saved-areas list if they want one. Nothing on the site requires an account.
// Password rule is deliberately simple (min 5 characters, nothing else enforced) per how this was
// asked for; hashing and rate-limiting below are baseline server-side handling, not an addition to
// that rule, since storing a plain password is never acceptable regardless of how simple the rule is.
import crypto from 'node:crypto'

const SESSION_DAYS = 30
const USERNAME_RE = /^[a-z0-9_.-]{3,24}$/i

export function validUsername(u) { return typeof u === 'string' && USERNAME_RE.test(u) }
export function validPassword(p) { return typeof p === 'string' && p.length >= 5 && p.length <= 200 }

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}
export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const got = crypto.scryptSync(password, salt, 64)
  const want = Buffer.from(hash, 'hex')
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}

export async function createSession(sql, userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000)
  await sql`insert into sessions (token, user_id, expires_at) values (${token}, ${userId}, ${expires.toISOString()})`
  return { token, maxAgeSec: SESSION_DAYS * 86400 }
}

export async function sessionUser(sql, token) {
  if (!token) return null
  const rows = await sql`select u.id, u.username from sessions s join users u on u.id = s.user_id
                          where s.token = ${token} and s.expires_at > now()`
  return rows[0] || null
}

export async function deleteSession(sql, token) {
  if (token) await sql`delete from sessions where token = ${token}`
}

/** Per-IP throttle for auth attempts, independent of anything per-account, so one bad actor can't
 * use it to lock other people out or brute-force a password via sheer volume. */
export async function tooManyAttempts(sql, ipHash, kind, limit, windowInterval) {
  const [{ n }] = await sql`select count(*)::int as n from auth_attempts where ip_hash = ${ipHash} and kind = ${kind} and created_at > now() - ${windowInterval}::interval`
  return n >= limit
}
export async function recordAttempt(sql, ipHash, kind) {
  await sql`insert into auth_attempts (ip_hash, kind) values (${ipHash}, ${kind})`
}
