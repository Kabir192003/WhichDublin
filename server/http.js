// Small helpers shared by the API functions.
import crypto from 'node:crypto'

export function send(res, status, body, cache = 'no-store') {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', cache)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(body))
}
export const fail = (res, status, message) => send(res, status, { error: message })

/** A salted hash of the caller's IP: enough to rate-limit, never stored in readable form. */
export function ipHash(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
  return crypto.createHash('sha256').update((process.env.HASH_SALT || 'which-dublin') + '|' + ip).digest('hex').slice(0, 32)
}

/** Reads a JSON body with a size cap. Rejects anything that isn't a JSON object. */
export async function readJson(req, max = 8 * 1024) {
  if (req.body && typeof req.body === 'object') return req.body
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > max) throw Object.assign(new Error('Too large'), { status: 413 }) }
  try { const v = JSON.parse(raw || '{}'); if (v && typeof v === 'object' && !Array.isArray(v)) return v } catch { /* fall through */ }
  throw Object.assign(new Error('Send a JSON object'), { status: 400 })
}

/** Same-origin browsers only for writes: a light CSRF and drive-by spam guard. */
export function sameOrigin(req) {
  const o = req.headers.origin, h = req.headers['x-forwarded-host'] || req.headers.host
  return !o || (h && new URL(o).host === h)
}

const COOKIE = 'settld_session'
export function setSessionCookie(res, token, maxAgeSec) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`)
}
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`)
}
export function getSessionToken(req) {
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) return v.join('=')
  }
  return null
}

/** Ends a request that threw. Expected failures (ones we raised with a status) go back as-is;
 * anything else is a bug, so it is logged (visible in Vercel's function logs) and, when a
 * SENTRY_DSN is configured, reported there before the generic message is sent. */
let sentry = null
export async function crash(res, e, fallback = 'Something went wrong; try again') {
  if (e?.status) return fail(res, e.status, e.message)
  console.error(e)
  if (process.env.SENTRY_DSN) {
    try {
      if (!sentry) { sentry = await import('@sentry/node'); sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 }) }
      sentry.captureException(e); await sentry.flush(2000)
    } catch { /* monitoring must never break the response */ }
  }
  fail(res, 500, fallback)
}
