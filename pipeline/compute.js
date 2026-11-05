/**
 * Joins everything into the dataset the app reads: public/data/areas.json.
 *
 * Inputs  (data/build, data/raw):  rent.json, areas_geo.json, network.json, campuses_geocoded.json, supermarkets*.json, descriptions.json
 * Output: every number carries { value, source, asOf, confidence }. Nothing is estimated: a missing input means a missing number.
 */
import fs from 'node:fs'
import { journeys, summarise, buildTransfers, nearbyStops, haversineMetres, walkSecs } from './csa.js'
import { confidence } from '../src/domain/confidence.js'

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const rent = read('data/build/rent.json'), geo = read('data/build/areas_geo.json').items
const net = read('data/build/network.json'), campusesRaw = read('data/raw/campuses_geocoded.json')
const descr = fs.existsSync('data/raw/descriptions.json') ? read('data/raw/descriptions.json') : { items: {} }
const storeFiles = ['data/raw/supermarkets.json', 'data/raw/supermarkets_local.json'].filter((f) => fs.existsSync(f))
const today = new Date()

// ---- network in columnar form
const stops = net.stops.map(([lat, lon, name]) => ({ lat, lon, name }))
const conn = { dep: Int32Array.from(net.conn.dep), arr: Int32Array.from(net.conn.arr), from: Int32Array.from(net.conn.from), to: Int32Array.from(net.conn.to), trip: Int32Array.from(net.conn.trip) }
const network = { stops, conn, transfers: buildTransfers(stops, 300) }
console.log('network', stops.length, 'stops', conn.dep.length, 'connections')

// route labels served at each stop (for "which buses can I catch near home")
const routesAt = stops.map(() => new Map())
for (let i = 0; i < conn.dep.length; i++) {
  const [name, mode] = net.tripRoute[conn.trip[i]] || ['?', 'other']
  const m = routesAt[conn.from[i]]; if (!m.has(name)) m.set(name, mode)
}
const campuses = campusesRaw.map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon, osm: c.osm }))

// ---- supermarkets (union of tile search and local gap-fill, de-duplicated by OSM id)
const storeMap = new Map(); let storeFetched = null
for (const f of storeFiles) { const s = read(f); storeFetched = s.fetched; for (const st of s.stores) storeMap.set(st.osm, st) }
const stores = [...storeMap.values()]
console.log('supermarkets', stores.length, ['Lidl', 'Aldi', 'Tesco'].map((b) => b + ' ' + stores.filter((s) => s.brand === b).length).join(', '))

// ---- bike share docks (Dublinbikes is run by JCDecaux/Cyclocity) and employer counts, both optional inputs
const bikeFile = fs.existsSync('data/raw/bikes.json') ? read('data/raw/bikes.json') : null
const docks = bikeFile ? bikeFile.docks.filter((d) => /jcdecaux|cyclocity|deceaux/i.test(d.operator + ' ' + d.brand) || /dublinbikes/i.test(d.name)).map((d) => ({ ...d, name: d.name && !/^dublinbikes$/i.test(d.name) ? d.name : 'Dublinbikes dock' })) : []
const empFile = fs.existsSync('data/raw/employers.json') ? read('data/raw/employers.json') : null
const nearestDock = (pt, maxMetres = 1500) => { let best = null; for (const d of docks) { const m = haversineMetres(pt, d); if (m <= maxMetres && (!best || m < best.m)) best = { d, m } } return best }
const dockOut = (b) => b && { name: b.d.name, lat: b.d.lat, lon: b.d.lon, metres: Math.round(b.m * 1.3 / 10) * 10, walkMinutes: Math.round(walkSecs(b.m) / 60) }
console.log('bike docks', docks.length)
for (const c of campuses) c.dock = dockOut(nearestDock(c))

// departures: arrive for a 09:00 start. Leave between 07:30 and 08:30 every 5 minutes.
const DEPARTURES = Array.from({ length: 13 }, (_, i) => 7.5 * 3600 + i * 300)
const asOfRent = rent.quarter
const ageDays = Math.round((today - new Date('2025-12-31')) / 86400000)   // end of the latest rent quarter

const out = []
let n = 0
for (const a of rent.areas) {
  const g = geo[a.id]
  if (!g || g.insideDistrict === false) continue   // geocode did not land inside its postal district: excluded, not guessed
  if (Math.min(...campuses.map((c) => haversineMetres({ lat: g.lat, lon: g.lon }, c))) > 25000) continue   // outside the commuter area covered
  const origin = { lat: g.lat, lon: g.lon }
  const perDeparture = DEPARTURES.map((t) => journeys(network, origin, campuses, t))
  const toCampus = {}
  campuses.forEach((c, ci) => {
    const s = summarise(perDeparture.map((r) => r[ci]))
    const direct = haversineMetres(origin, c)
    toCampus[c.id] = {
      distanceKm: Math.round(direct / 100) / 10,
      walkMinutes: Math.round(walkSecs(direct) / 60),
      cycleMinutes: Math.round(((direct * 1.3) / 4.2) / 60),     // 15 km/h
      transit: s && { minutes: s.minutes, bestMinutes: s.bestMinutes, worstMinutes: s.worstMinutes, changes: s.changes, walkMinutes: s.walkMinutes, departures: s.departures,
                      confidence: confidence('commute', { departures: s.departures, walkShare: s.walkShare }) }
    }
  })

  const homeDock = nearestDock(origin)
  if (homeDock) for (const c of campuses) {
    const cd = c.dock; if (!cd) continue
    const hd = dockOut(homeDock)
    if (hd.name === cd.name && hd.lat === cd.lat) continue
    const rideM = haversineMetres(hd, cd) * 1.3
    const rideMin = Math.round(rideM / 4.2 / 60)
    const total = hd.walkMinutes + rideMin + cd.walkMinutes + 2          // +2 minutes to undock and dock
    toCampus[c.id].bikeshare = { minutes: total, walkFromHomeMinutes: hd.walkMinutes, rideMinutes: rideMin, walkToCampusMinutes: cd.walkMinutes, rideKm: Math.round(rideM / 100) / 10, fromDock: hd.name, toDock: cd.name }
  }

  const work = {}
  const emp = empFile && empFile.areas[a.id]
  if (emp) for (const [cat, terms] of Object.entries(empFile.categories)) {
    const ids = new Set(); let capped = false
    for (const t of terms) { const e = emp[t]; if (!e) continue; e.ids.forEach((i) => ids.add(i)); capped = capped || e.capped }
    work[cat] = { n: ids.size, capped }
  }

  const near = nearbyStops(stops, origin, 800).sort((x, y) => x.secs - y.secs)
  const nearest = near[0]
  const serving = new Map()
  for (const s of near.filter((x) => x.secs <= 600)) for (const [name, mode] of routesAt[s.stop]) if (!serving.has(name)) serving.set(name, mode)
  const modes = { bus: [], tram: [], rail: [] }
  for (const [name, mode] of serving) if (modes[mode]) modes[mode].push(name)
  for (const k of Object.keys(modes)) modes[k].sort((p, q) => p.localeCompare(q, undefined, { numeric: true }))

  const groceries = {}
  for (const brand of ['Lidl', 'Aldi', 'Tesco']) {
    const ranked = stores.filter((s) => s.brand === brand).map((s) => ({ s, d: haversineMetres(origin, s) })).sort((x, y) => x.d - y.d)
    const best = ranked[0]
    groceries[brand] = best && { name: best.s.name, walkMinutes: Math.round(walkSecs(best.d) / 60), metres: Math.round(best.d * 1.3 / 10) * 10, osm: best.s.osm, within1km: ranked.filter((r) => r.d * 1.3 <= 1000).length }
  }
  const budget = ['Lidl', 'Aldi'].map((b) => groceries[b]).filter(Boolean)
  const nearestBudget = budget.length ? Math.min(...budget.map((b) => b.walkMinutes)) : null

  const d = descr.items[a.id]
  const sentences = d ? (d.extract.match(/[^.!?]+[.!?]+(\s|$)/g) || [d.extract]).slice(0, 2).join('').trim() : null
  out.push({
    id: a.id, name: a.name, district: a.district, label: a.label, lat: g.lat, lon: g.lon,
    rent: { cells: a.rent, quarter: rent.quarter, prevAll: a.prevAll, populatedCells: a.populatedCells,
            confidence: confidence('rent', { cells: a.populatedCells, ageDays }) },
    transit: { nearestStop: nearest ? { name: stops[nearest.stop].name, walkMinutes: Math.round(nearest.secs / 60) } : null, routes: modes },
    toCampus, groceries, nearestBudgetGroceryMinutes: nearestBudget,
    nearestDock: dockOut(homeDock), work: emp ? work : null,
    about: d ? { text: sentences, title: d.title, url: d.url } : null
  })
  if (++n % 20 === 0) console.log('areas', n, '/', rent.areas.length)
}

// Eircode routing keys -> approximate centre, used when a full Eircode is not in OpenStreetMap
const districtsGeo = read('data/raw/districts.geojson')
const routingKeys = {}
for (const f of districtsGeo.features) {
  const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates.flatMap((p) => p[0])
  const lon = ring.reduce((t, c) => t + c[0], 0) / ring.length, lat = ring.reduce((t, c) => t + c[1], 0) / ring.length
  const id = f.properties.id === 'D6W' ? 'D6W' : 'D' + f.properties.id.slice(1).padStart(2, '0')
  routingKeys[id] = { lat: +lat.toFixed(5), lon: +lon.toFixed(5), label: f.properties.name }
}
const TOWN_KEYS = { A94: 'blackrock-co', A96: 'glenageary-co', K32: 'balbriggan-co', K36: 'malahide-co', K45: 'lusk-co', K56: 'rush-co', K67: 'swords-co', K78: 'lucan-co' }
for (const [k, id] of Object.entries(TOWN_KEYS)) { const a = out.find((x) => x.id === id); if (a) routingKeys[k] = { lat: a.lat, lon: a.lon, label: a.name + ' area' } }

const dataset = {
  version: new Date().toISOString().slice(0, 10),
  sources: {
    rent: { name: 'RTB Average Monthly Rent Report via CSO (RIQ02)', licence: 'CC BY 4.0', url: rent.sourceUrl, asOf: asOfRent, definition: rent.definition, countyAverage: rent.county.cells['all:any'], methods: rent.methods, backtest: rent.backtest },
    transit: { name: 'National Transport Authority GTFS static timetables', licence: 'CC BY 4.0', url: 'https://www.transportforireland.ie/transitData/PT_Data.html', serviceDate: net.date, sampled: '07:30 to 08:30, every 5 minutes (13 departures)' },
    geography: { name: 'OpenStreetMap contributors via Nominatim', licence: 'ODbL 1.0', url: 'https://www.openstreetmap.org/copyright' },
    groceries: { name: 'OpenStreetMap contributors via Nominatim', licence: 'ODbL 1.0', fetched: storeFetched, note: 'May be incomplete: community-maintained map data.' },
    bikes: { name: 'OpenStreetMap contributors (Dublinbikes docks)', licence: 'ODbL 1.0', fetched: bikeFile && bikeFile.fetched, note: 'Docks mapped in OpenStreetMap; not every station may be included. See dublinbikes.ie for the live map.' },
    employers: { name: 'OpenStreetMap contributors via Nominatim', licence: 'ODbL 1.0', fetched: empFile && empFile.fetched, radiusMetres: 1000, categories: empFile && empFile.categories, note: 'Counts places that could employ students within about 1 km. Not vacancies. Counts stop at 40 per place type.' },
    descriptions: { name: 'Wikipedia', licence: 'CC BY-SA 4.0', url: 'https://en.wikipedia.org' }
  },
  campuses, areas: out, routingKeys,
  stores: stores.map((x) => ({ brand: x.brand, name: x.name, lat: x.lat, lon: x.lon })),
  docks: docks.map((x) => ({ name: x.name && !/^dublinbikes$/i.test(x.name) ? x.name : 'Dublinbikes dock', lat: x.lat, lon: x.lon }))
}
fs.mkdirSync('public/data', { recursive: true })
fs.writeFileSync('public/data/areas.json', JSON.stringify(dataset))
console.log('wrote public/data/areas.json', out.length, 'areas,', (fs.statSync('public/data/areas.json').size / 1024).toFixed(0), 'KB')
