// POST /api/reports  { area, room, rent, bills, since }   anonymous room-rent report (rate-limited, validated)
// GET  /api/reports?area=<id>                             medians per room type, only once 5+ people reported
import { createRequire } from 'node:module'
import { db } from '../server/db.js'
import { send, fail, ipHash, readJson, sameOrigin } from '../server/http.js'
import { ROOMS, MIN_REPORTS } from '../server/rooms.js'
const AREAS = new Set(createRequire(import.meta.url)('../server/area-ids.json'))

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const area = String(req.query?.area || '')
      if (!AREAS.has(area)) return fail(res, 400, 'Unknown area')
      const sql = await db()
      const rows = await sql`select room, count(*)::int as n, percentile_cont(0.5) within group (order by rent) as median
                             from rent_reports where area_id = ${area} and created_at > now() - interval '2 years' group by room`
      const out = {}
      for (const r of rows) out[r.room] = r.n >= MIN_REPORTS ? { n: r.n, median: Math.round(r.median) } : { n: r.n }
      return send(res, 200, { area, minReports: MIN_REPORTS, rooms: out }, 'public, s-maxage=300')
    }
    if (req.method === 'POST') {
      if (!sameOrigin(req)) return fail(res, 403, 'Wrong origin')
      const b = await readJson(req)
      const rent = Math.round(Number(b.rent))
      const bills = ['no', 'yes', 'some'].includes(b.bills) ? b.bills : null
      const since = /^\d{4}-(0[1-9]|1[0-2])$/.test(b.since || '') ? b.since : null
      if (!AREAS.has(b.area)) return fail(res, 400, 'Pick an area from the list')
      if (!ROOMS.includes(b.room)) return fail(res, 400, 'Pick what you rent from the list')
      if (!(rent >= 250 && rent <= 4000)) return fail(res, 400, 'Rent must be a monthly amount between €250 and €4,000')
      if (!bills) return fail(res, 400, 'Say whether bills are included')
      if (b.consent !== true) return fail(res, 400, 'Please confirm the consent box')
      const sql = await db(), ip = ipHash(req)
      const [{ n }] = await sql`select count(*)::int as n from rent_reports where ip_hash = ${ip} and created_at > now() - interval '1 day'`
      if (n >= 3) return fail(res, 429, 'Thanks! You have already sent several reports today')
      await sql`insert into rent_reports (area_id, room, rent, bills, since, ip_hash) values (${b.area}, ${b.room}, ${rent}, ${bills}, ${since}, ${ip})`
      return send(res, 201, { ok: true })
    }
    fail(res, 405, 'GET or POST only')
  } catch (e) { fail(res, e.status || 500, e.status ? e.message : 'Something went wrong; try again') }
}
