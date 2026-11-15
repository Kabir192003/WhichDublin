// GET /api/transit-live?mode=tram|rail&lat=53.35&lon=-6.26 -> the live board of the Luas stop or Irish Rail station at that spot.
import { luasBoard, railBoard } from '../server/transit.js'
import { send, fail, crash } from '../server/http.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only')
  const mode = String(req.query?.mode || ''), lat = Number(req.query?.lat), lon = Number(req.query?.lon)
  if (!['tram', 'rail'].includes(mode)) return fail(res, 400, 'mode must be tram or rail')
  if (!(lat > 52.5 && lat < 54.5 && lon > -7.5 && lon < -5.5)) return fail(res, 400, 'lat and lon must be in the Dublin area')
  try {
    const board = await (mode === 'tram' ? luasBoard(lat, lon) : railBoard(lat, lon))
    send(res, 200, { updated: new Date().toISOString(), board }, 'public, s-maxage=10, stale-while-revalidate=10')
  } catch (e) { await crash(res, e, 'Live times are unavailable right now') }
}
