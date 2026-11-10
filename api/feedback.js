// POST /api/feedback { kind, message, page }  -- "report a problem" without needing a GitHub account
import { db } from '../server/db.js'
import { send, fail, ipHash, readJson, sameOrigin, crash } from '../server/http.js'
const KINDS = ['wrong-data', 'bug', 'idea', 'other']

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only')
  try {
    if (!sameOrigin(req)) return fail(res, 403, 'Wrong origin')
    const b = await readJson(req)
    const message = String(b.message || '').trim().slice(0, 2000)
    if (!KINDS.includes(b.kind)) return fail(res, 400, 'Pick a type')
    if (message.length < 3) return fail(res, 400, 'Tell us a little more')
    const page = String(b.page || '').slice(0, 300)
    const sql = await db(), ip = ipHash(req)
    const [{ n }] = await sql`select count(*)::int as n from feedback where ip_hash = ${ip} and created_at > now() - interval '1 hour'`
    if (n >= 5) return fail(res, 429, 'Thanks! Please wait a little before sending more')
    await sql`insert into feedback (kind, message, page, ip_hash) values (${b.kind}, ${message}, ${page}, ${ip})`
    send(res, 201, { ok: true })
  } catch (e) { await crash(res, e, 'Something went wrong; try again') }
}
