// Live Luas and Irish Rail (DART, commuter, intercity) times. Neither is in the NTA bus feed:
//   Luas: the TII forecasting service (luasforecasts.rpa.ie), by stop abbreviation
//   Irish Rail: api.irishrail.ie realtime service, by station code
// Both are public, so no key. Stops are found by coordinates, so the page does not need to know their codes.
import { metresBetween } from './geo.js'

const UA = { 'User-Agent': 'Settld-transit-info/1.0' }
const get = async (url) => {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw Object.assign(new Error(`Upstream ${r.status}`), { status: 502 })
  return r.text()
}
const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

// ---- Luas ----
export function parseLuasStops(xml) {
  return [...xml.matchAll(/<stop abrev="([^"]+)"[^>]*lat="([-\d.]+)"[^>]*long="([-\d.]+)"[^>]*>([^<]*)<\/stop>/g)]
    .map(([, abv, lat, lon, name]) => ({ abv, lat: Number(lat), lon: Number(lon), name: decode(name) }))
}
export function parseLuasForecast(xml) {
  const directions = [...xml.matchAll(/<direction name="([^"]*)">([\s\S]*?)<\/direction>/g)].map(([, name, body]) => ({
    name,
    trams: [...body.matchAll(/<tram dueMins="([^"]*)" destination="([^"]*)"/g)]
      .map(([, due, dest]) => ({ due: due === 'DUE' ? 0 : Number(due), destination: decode(dest) }))
      .filter((t) => Number.isFinite(t.due) && !/^No /i.test(t.destination))
  }))
  const message = decode((xml.match(/<message>([\s\S]*?)<\/message>/) || [])[1] || '')
  return { directions: directions.filter((d) => d.trams.length), message }
}
let luasStopsCache = { at: 0, list: [] }
async function luasStops() {
  if (luasStopsCache.list.length && Date.now() - luasStopsCache.at < 24 * 3600e3) return luasStopsCache.list
  const list = parseLuasStops(await get('https://luasforecasts.rpa.ie/xml/get.ashx?action=stops&encrypt=false'))
  if (list.length) luasStopsCache = { at: Date.now(), list }
  return list
}
export async function luasBoard(lat, lon) {
  const stops = await luasStops()
  let best = null
  for (const s of stops) { const m = metresBetween(lat, lon, s.lat, s.lon); if (m <= 250 && (!best || m < best.m)) best = { s, m } }
  if (!best) return null
  const f = parseLuasForecast(await get(`https://luasforecasts.rpa.ie/xml/get.ashx?action=forecast&stop=${encodeURIComponent(best.s.abv)}&encrypt=false`))
  return { kind: 'tram', station: best.s.name, ...f }
}

// ---- Irish Rail ----
export function parseRailStations(xml) {
  return [...xml.matchAll(/<objStation>([\s\S]*?)<\/objStation>/g)].map(([, b]) => {
    const f = (t) => (b.match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1]
    return { code: (f('StationCode') || '').trim(), name: decode(f('StationDesc') || ''), lat: Number(f('StationLatitude')), lon: Number(f('StationLongitude')) }
  }).filter((s) => s.code && Number.isFinite(s.lat) && s.lat !== 0)
}
export function parseRailBoard(xml) {
  return [...xml.matchAll(/<objStationData>([\s\S]*?)<\/objStationData>/g)].map(([, b]) => {
    const f = (t) => decode((b.match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1] || '')
    return { destination: f('Destination'), origin: f('Origin'), due: Number(f('Duein')), late: Number(f('Late')), departs: f('Expdepart') !== '00:00' ? f('Expdepart') : f('Schdepart'), arrives: f('Exparrival') !== '00:00' ? f('Exparrival') : f('Scharrival'), direction: f('Direction'), status: f('Status'), type: f('Traintype'), lastLocation: f('Lastlocation') }
  }).filter((t) => Number.isFinite(t.due)).sort((a, b) => a.due - b.due)
}
let railStationsCache = { at: 0, list: [] }
async function railStations() {
  if (railStationsCache.list.length && Date.now() - railStationsCache.at < 24 * 3600e3) return railStationsCache.list
  const list = parseRailStations(await get('https://api.irishrail.ie/realtime/realtime.asmx/getAllStationsXML'))
  if (list.length) railStationsCache = { at: Date.now(), list }
  return list
}
export async function railBoard(lat, lon) {
  const stations = await railStations()
  let best = null
  for (const s of stations) { const m = metresBetween(lat, lon, s.lat, s.lon); if (m <= 500 && (!best || m < best.m)) best = { s, m } }
  if (!best) return null
  const trains = parseRailBoard(await get(`https://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML?StationCode=${encodeURIComponent(best.s.code)}`))
  return { kind: 'rail', station: best.s.name, trains: trains.slice(0, 8) }
}
