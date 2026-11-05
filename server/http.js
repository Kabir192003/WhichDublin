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
