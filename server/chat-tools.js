// Tools the Settld assistant can call for live transport: find a stop, and the next departures (with live
// NTA times) from one place to another. Uses the same timetable files and live matching as the Commute page.
import { stopRouteLive } from './live.js'
import { luasBoard, railBoard } from './transit.js'
import { buildIndex, plan } from '../src/domain/planner.js'
import { rentForHome } from '../src/domain/model.js'
import { areaLine, campusesOf } from './chat-knowledge.js'

const SHARDS = 256, LATE = 45, AHEAD = 120
const shardOf = (stopId) => { let h = 0x811c9dc5; for (const c of stopId) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) } return (h >>> 0) % SHARDS }
const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
const clock = (mins) => { const x = ((Math.round(mins) % 1440) + 1440) % 1440; return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}` }
export function dublinNow(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((x) => [x.type, x.value]))
  return { mins: Number(p.hour) * 60 + Number(p.minute), daytype: p.weekday === 'Sat' ? 'sat' : p.weekday === 'Sun' ? 'sun' : 'wk' }
}

/** Static files of this site (the timetable), fetched once per warm function. */
const cache = new Map()
async function file(origin, path) {
  const hit = cache.get(path); if (hit && Date.now() - hit.at < 3_600_000) return hit.p
  const p = fetch(`${origin}${path}`).then((r) => { if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json() })
  cache.set(path, { at: Date.now(), p }); p.catch(() => cache.delete(path))
  return p
}
let index = null
const stopsData = (origin) => file(origin, '/data/stops.json')

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/\b(o|mc|mac) (?=[a-z]{3})/g, '$1')   // "O Connell" = "O'Connell"
  .replace(/\bstreet\b/g, 'st').replace(/\broad\b/g, 'rd').replace(/\bupper\b/g, 'upr').replace(/\blower\b/g, 'lwr')

/** Places people say that aren't stop names: the stops that serve them. */
const LANDMARKS = {
  trinity: ['College Green', 'Westmoreland St', 'Nassau St', 'Trinity'], tcd: ['College Green', 'Westmoreland St', 'Nassau St', 'Trinity'],
  ucd: ['UCD', 'Belfield'], dcu: ['DCU', 'Collins Avenue', 'Ballymun Rd'], spire: ['Spire', "O'Connell St Upper", "O'Connell - GPO"],
  town: ["O'Connell St", 'College Green', 'Westmoreland St', 'Abbey St'], 'city centre': ["O'Connell St", 'College Green', 'Westmoreland St', 'Abbey St'],
  'city center': ["O'Connell St", 'College Green', 'Westmoreland St', 'Abbey St'], gpo: ["O'Connell - GPO", "O'Connell St Lwr"]
}
export function searchPlace(data, query, limit = 4) {
  const keys = LANDMARKS[norm(query).replace(/^(the|dublin) /, '')]
  if (!keys) return searchStops(data, query, limit)
  const seen = new Set(), out = []
  for (const k of keys) for (const g of searchStops(data, k, 3)) { const key = `${g.name}|${g.mode}`; if (!seen.has(key)) { seen.add(key); out.push(g) } }
  return out.slice(0, limit * 2)
}

/** Stops matching a name or stop number, grouped by name (both sides of the road share a name). */
export function searchStops(data, query, limit = 8) {
  const q = norm(query); if (!q) return []
  if (/^\d+$/.test(q) && data.byCode[q]) return [{ name: data.stops[data.byCode[q][0]][1], ids: data.byCode[q] }]
  if (data.stops[query]) return [{ name: data.stops[query][1], ids: [query] }]
  const words = q.split(' ')
  const groups = new Map()
  for (const [id, s] of Object.entries(data.stops)) {
    const n = norm(s[1]), toks = n.split(' ')
    if (!words.every((w) => toks.some((t) => t.startsWith(w)))) continue
    const key = `${s[1]}|${s[4]}`
    if (!groups.has(key)) groups.set(key, { name: s[1], mode: s[4], ids: [], exact: n === q })
    groups.get(key).ids.push(id)
  }
  const found = [...groups.values()].sort((a, b) => (b.exact - a.exact) || (a.name.length - b.name.length)).slice(0, limit)
  // nothing found: forgive a typo at the end of the last word ("watervillw" -> "watervill")
  const last = words[words.length - 1]
  if (!found.length && last.length > 4) return searchStops(data, [...words.slice(0, -1), last.slice(0, -1)].join(' '), limit)
  return found
}

/** Next departures of one route pattern at one stop, with the live NTA estimate matched by trip start time. */
async function departures(origin, data, now, sid, rid, dir, limit = 3, liveFor = stopRouteLive) {
  const shard = await file(origin, `/data/trips/${now.daytype}/${shardOf(sid)}.json`)
  const list = shard[`${sid}:${rid}:${dir}`] || []
  const slots = list.map(([m, start]) => [m % 1440, start]).filter(([m]) => m >= now.mins - LATE && m <= now.mins + AHEAD)   // 24:05 is 0:05 tonight
  if (!slots.length) return []
  const shape = data.shapes[`${rid}:${dir}`] || []
  let live = []
  if (data.stops[sid]?.[4] === 'bus') { try { live = (await liveFor(sid, rid, shape, dir)).live || [] } catch { /* timetable only */ } }
  const byStart = new Map(live.filter((c) => c.startTime).map((c) => [hm(c.startTime), c]))
  const out = []
  for (const [m, start] of slots) {
    const c = byStart.get(start)
    const exp = c ? (c.atMs != null ? now.mins + (c.atMs - Date.now()) / 60000 : m + (c.delaySec || 0) / 60) : null
    if (exp != null ? exp < now.mins : m < now.mins) continue   // gone (a live estimate overrides the timetable)
    out.push({ scheduled: clock(m), expected: exp != null ? clock(exp) : null, delayMin: c?.delaySec != null ? Math.round(c.delaySec / 60) : null, live: !!c, liveAtThisStop: c ? !!c.exact : false, sortKey: exp ?? m })
  }
  return out.sort((a, b) => a.sortKey - b.sortKey).slice(0, limit)
}

async function boardFor(data, sid) {
  const s = data.stops[sid]; if (!s || s[4] === 'bus') return null
  try { const b = await (s[4] === 'tram' ? luasBoard(s[2], s[3]) : railBoard(s[2], s[3])); return b } catch { return null }
}

export async function findStops(origin, { query }) {
  const data = await stopsData(origin)
  const groups = searchStops(data, query)
  if (!groups.length) return { found: [], tip: 'No stop has that name. Try a street or area name, or the stop number on the pole.' }
  return { found: groups.map((g) => ({ name: g.name, mode: data.stops[g.ids[0]][4], stops: g.ids.slice(0, 4).map((id) => ({ number: data.stops[id][0] || null, routes: [...new Set((data.stopRoutes[id] || []).map(([r]) => data.routes[r]?.[0]).filter(Boolean))].slice(0, 15) })) })) }
}

/** The next departures from one place towards another (or every route at a stop when `to` is empty). */
export async function nextDepartures(origin, { from, to, mode, route, last }, now = dublinNow(), liveFor = stopRouteLive) {
  const data = await stopsData(origin)
  const prefer = (groups) => { const m = mode && groups.filter((g) => g.mode === mode); return m && m.length ? m : groups }   // "dart from pearse" -> the station
  const isLandmark = (q) => !!LANDMARKS[norm(q || '').replace(/^(the|dublin) /, '')]
  const fromG = prefer(searchPlace(data, from, 40)).slice(0, isLandmark(from) ? 8 : 3), toG = to ? prefer(searchPlace(data, to, 40)).slice(0, 8) : []
  if (!fromG.length) return { error: `No stop found for "${from}". Ask the user for the stop name or number.` }
  if (to && !toG.length) return { error: `No stop found for "${to}". For a landmark, try the street it is on (e.g. Spire -> O'Connell Street).` }
  const fromIds = fromG.slice(0, isLandmark(from) ? 8 : 2).flatMap((g) => g.ids), toSet = new Set(toG.flatMap((g) => g.ids))
  const cands = []
  for (const sid of fromIds) for (const [rid, dir] of data.stopRoutes[sid] || []) {
    const shape = data.shapes[`${rid}:${dir}`], off = data.offsets[`${rid}:${dir}`]; if (!shape) continue
    const i = shape.indexOf(sid); if (i < 0) continue
    const j = to ? shape.findIndex((x, k) => k > i && toSet.has(x)) : -1
    if (to && j < 0) continue
    cands.push({ sid, rid, dir, toSid: j >= 0 ? shape[j] : null, ride: j >= 0 && off ? off[j] - off[i] : null })
  }
  if (route) {   // "when's the 46A from ...": only that route, or say plainly it doesn't stop there
    const want = String(route).toUpperCase(), mine = cands.filter((c) => String(data.routes[c.rid]?.[0]).toUpperCase() === want)
    if (!mine.length) {
      const here = [...new Set(fromIds.flatMap((sid) => (data.stopRoutes[sid] || []).map(([r]) => data.routes[r]?.[0])).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      return { error: `Route ${want} doesn't stop at ${data.stops[fromIds[0]][1]}${to ? ` on the way to ${to}` : ''}. Routes that do: ${here.join(', ')}.` }
    }
    cands.splice(0, cands.length, ...mine)
  }
  if (last && cands.length) {   // "last bus tonight": the final departure of each route from here
    const rows = []
    for (const c of cands.slice(0, 12)) {
      const sh = await file(origin, `/data/trips/${now.daytype}/${shardOf(c.sid)}.json`), l = sh[`${c.sid}:${c.rid}:${c.dir}`]
      if (!l?.length) continue
      const mins = l.map(([m]) => m), night = [1, 2, 3, 4].every((h) => mins.some((m) => m >= 1440 + h * 60 && m < 1440 + (h + 1) * 60))   // a bus every hour 1am-5am: a 24-hour route
      rows.push({ route: data.routes[c.rid]?.[0], from: `${data.stops[c.sid][1]} (stop ${data.stops[c.sid][0]})`, last: night ? 9999 : mins[mins.length - 1], allNight: night, ride: c.ride })
    }
    const best = new Map(); for (const r of rows) if (!best.has(r.route) || best.get(r.route).last < r.last) best.set(r.route, r)
    return { now: clock(now.mins), lastDepartures: [...best.values()].sort((a, b) => b.last - a.last).slice(0, 6).map((r) => ({ ...r, last: r.allNight ? null : clock(r.last) })), note: `Times are from the ${now.daytype === 'wk' ? 'weekday' : now.daytype === 'sat' ? 'Saturday' : 'Sunday'} timetable.` }
  }
  const head = (rid, dir) => { const s = data.shapes[`${rid}:${dir}`]; return s ? data.stops[s[s.length - 1]]?.[1] : null }
  if (cands.length) {
    const rows = []
    for (const c of cands.slice(0, 10)) {
      for (const d of await departures(origin, data, now, c.sid, c.rid, c.dir, 3, liveFor)) rows.push({ route: data.routes[c.rid]?.[0], towards: head(c.rid, c.dir), from: `${data.stops[c.sid][1]} (stop ${data.stops[c.sid][0]})`, to: c.toSid ? data.stops[c.toSid][1] : undefined, rideMinutes: c.ride ?? undefined, ...d })
    }
    rows.sort((a, b) => a.sortKey - b.sortKey)
    if (!rows.length) {   // late at night: say when the first one runs
      const firsts = []
      for (const c of cands.slice(0, 10)) { const sh = await file(origin, `/data/trips/${now.daytype}/${shardOf(c.sid)}.json`); const l = sh[`${c.sid}:${c.rid}:${c.dir}`]; if (l?.length) firsts.push([l[0][0], data.routes[c.rid]?.[0]]) }
      firsts.sort((a, b) => a[0] - b[0])
      return { now: clock(now.mins), direct: true, departures: [], note: firsts.length ? `Nothing in the next two hours. The first ${firsts[0][1]} is at ${clock(firsts[0][0])} (timetable for ${now.daytype === 'wk' ? 'a weekday' : now.daytype === 'sat' ? 'Saturday' : 'Sunday'}).` : 'No departures found on this route today.' }
    }
    const boards = (await Promise.all([...new Set(fromIds)].slice(0, 2).map((sid) => boardFor(data, sid)))).filter(Boolean)
    return { now: clock(now.mins), direct: true, departures: rows.slice(0, 8).map(({ sortKey, ...r }) => r), liveBoards: boards.length ? boards : undefined, note: 'expected = live NTA estimate; live:false means timetable only. liveAtThisStop:false means the delay is carried from the last stop the bus reported.' }
  }
  if (!to) return { now: clock(now.mins), departures: [], note: 'No departures found from this stop in the next two hours.' }
  // no single bus or tram goes there: plan a journey with changes (weekday timetable)
  index ||= buildIndex(data)
  const journeys = plan(index, new Set(fromIds), new Set(toSet), now.mins)
  if (!journeys.length) return { now: clock(now.mins), journeys: [], note: 'No journey found within three legs. Suggest the Commute page journey planner.' }
  const j = journeys[journeys.length - 1].minutes <= journeys[0].minutes + 10 ? journeys[journeys.length - 1] : journeys[0]
  const legs = j.legs.map((l) => l.type === 'walk' ? { walk: `${l.mins} min (${Math.round(l.metres)} m) to ${data.stops[l.to]?.[1]}` } : { route: data.routes[l.pattern.split(':')[0]]?.[0], from: data.stops[l.from][1], to: data.stops[l.to][1], departs: clock(l.depart), arrives: clock(l.arrive) })
  const first = j.legs.find((l) => l.type === 'ride')
  const live = first ? await departures(origin, data, now, first.from, ...first.pattern.split(':'), 2, liveFor) : []
  return { now: clock(now.mins), direct: false, changes: j.changes, totalMinutes: j.minutes, arrive: clock(j.arrive), legs, firstLegLive: live.map(({ sortKey, ...r }) => r), note: 'Journey times are from the weekday timetable; firstLegLive has live times for the first bus.' }
}

const COLLEGES = { tcd: ['trinity', 'tcd'], ucd: ['ucd', 'university college', 'belfield'], dcu: ['dcu', 'dublin city university', 'glasnevin'], tud: ['tu dublin', 'tud', 'grangegorman', 'dit'], rcsi: ['rcsi', 'royal college of surgeons'], nci: ['nci', 'national college of ireland'], dbs: ['dbs', 'dublin business school'], griffith: ['griffith'], iadt: ['iadt', 'dun laoghaire', 'dún laoghaire'] }
export function collegeId(name, campuses) {
  const q = norm(name)
  for (const [id, keys] of Object.entries(COLLEGES)) if (keys.some((k) => q.includes(norm(k)))) return id
  return campuses.find((c) => norm(c.name).includes(q))?.id || null
}

/** Areas ranked by your share of the rent, for a college, a travel time limit and a home: sorted in code, not by the AI. */
export function rankAreas(data, { college, maxMinutes, bedrooms = 2, people, homeType = 'any', travel = 'transit', limit = 8 }) {
  const assumed = !maxMinutes; maxMinutes ||= travel === 'walk' ? 30 : 35   // "near" without a number: a sensible limit, said in the answer
  const id = collegeId(college || '', data.campuses)
  if (!id) return { error: `Unknown college "${college}". Colleges: ${data.campuses.map((c) => c.name).join(', ')}.` }
  const bed = String(Math.min(4, Math.max(1, Number(bedrooms) || 2))), n = Math.max(1, Number(people) || Number(bed))
  const rows = []
  for (const a of data.areas) {
    const t = a.toCampus?.[id]; if (!t) continue
    const mins = travel === 'cycle' ? t.cycleMinutes : travel === 'walk' ? t.walkMinutes : t.transit?.minutes
    if (mins == null || (maxMinutes && mins > maxMinutes)) continue
    const r = rentForHome(a, bed, homeType, n); if (!r) continue
    rows.push({ area: a.label, link: `#/areas/${a.id}`, yourShare: r.perPerson, wholeHome: r.total, rentIs: r.how, minutes: mins, changes: travel === 'transit' ? t.transit?.changes : undefined })
  }
  rows.sort((x, y) => x.yourShare - y.yourShare || x.minutes - y.minutes)
  return { college: data.campuses.find((c) => c.id === id).name, home: `${bed}-bedroom, ${homeType === 'any' ? 'any type' : homeType}, shared by ${n}`, travel, maxMinutes, limitNote: assumed ? `No time limit was given, so this uses ${maxMinutes} minutes; ask for another limit if you like.` : undefined, matches: rows.length, cheapestFirst: rows.slice(0, limit) }
}

const JOB_KIND = { retail: 'retail', shop: 'retail', shops: 'retail', food: 'food', restaurant: 'food', cafe: 'food', bar: 'food', hospitality: 'food', hotel: 'hotels', hotels: 'hotels', gym: 'leisure', cinema: 'leisure', leisure: 'leisure' }
/** Areas with the most places that could hire a student nearby, for a kind of work; optionally within a trip of a college. */
export function rankWork(data, { kind = 'retail', college, maxMinutes, limit = 8 }) {
  const k = JOB_KIND[norm(kind).split(' ')[0]] || (['retail', 'food', 'hotels', 'leisure'].includes(kind) ? kind : 'retail')
  const id = college ? collegeId(college, data.campuses) : null
  if (college && !id) return { error: `Unknown college "${college}".` }
  const rows = []
  for (const a of data.areas) {
    const w = a.work?.[k]; if (!w) continue
    const mins = id ? a.toCampus?.[id]?.transit?.minutes : undefined
    if (id && maxMinutes && (mins == null || mins > maxMinutes)) continue
    rows.push({ area: a.label, link: `#/areas/${a.id}`, places: w.capped ? `${w.n}+` : w.n, n: w.n, minutesToCollege: mins })
  }
  rows.sort((x, y) => y.n - x.n)
  return { kind: k, meaning: 'places (shops, cafes, hotels or gyms) within about 1 km that could hire a student, counted from OpenStreetMap: not vacancies', college: id ? data.campuses.find((c) => c.id === id).name : undefined, mostFirst: rows.slice(0, limit).map(({ n, ...r }) => r), page: '#/work' }
}

/** One or more areas in full: rent by home size, the trip to every college, shops, transport and jobs. */
export function areaDetails(data, { area }) {
  const q = norm(area || '')
  const hits = data.areas.filter((a) => norm(a.label).includes(q) || norm(a.name).includes(q)).slice(0, 3)
  if (!hits.length) return { error: `No Settld area matches "${area}". Areas: ${data.areas.map((a) => a.name).join(', ')}.` }
  const campuses = campusesOf(data)
  return { legend: 'rent = whole-home monthly rent for 1, 2, 3 bedrooms (est = estimated, carried = older quarter); per college "minutes/changes" by bus, Luas or rail for an 8am weekday arrival, cyc = cycling minutes, walk = walking minutes; shops = walking minutes; jobs = places that could hire a student within ~1 km', areas: hits.map((a) => areaLine(a, campuses)) }
}

export const TOOLS = [{ functionDeclarations: [
  { name: 'rank_work', description: 'Areas with the most places nearby that could hire a student, for a kind of part-time work (retail, food, hotels, leisure), optionally within a trip of a college. Use for any question about where the part-time jobs are.', parametersJsonSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['retail', 'food', 'hotels', 'leisure'], description: 'retail = shops and supermarkets, food = cafes, restaurants and bars, hotels, leisure = gyms and cinemas.' }, college: { type: 'string' }, maxMinutes: { type: 'number' } }, required: ['kind'] } },
  { name: 'area_details', description: "One area's figures: whole-home rent by bedrooms, travel time to every college, nearest supermarkets, stops and routes, stations and student jobs. Use for any question about a specific area.", parametersJsonSchema: { type: 'object', properties: { area: { type: 'string', description: 'Area name, e.g. Rathmines, Ranelagh, Phibsborough.' } }, required: ['area'] } },
  { name: 'rank_areas', description: 'Areas ranked from cheapest (your share of the rent) for a college, a travel-time limit and a home. Use for any question about the cheapest, best or closest areas: never sort or filter areas yourself.', parametersJsonSchema: { type: 'object', properties: { college: { type: 'string', description: 'College name, e.g. UCD, Trinity, DCU, TU Dublin.' }, maxMinutes: { type: 'number', description: 'Longest acceptable trip in minutes (8am weekday arrival).' }, bedrooms: { type: 'number', description: 'Bedrooms in the home, 1-4. Default 2.' }, people: { type: 'number', description: 'People sharing the rent. Default: one per bedroom.' }, homeType: { type: 'string', enum: ['any', 'apartment', 'terrace', 'semi', 'detached'] }, travel: { type: 'string', enum: ['transit', 'cycle', 'walk'], description: 'transit = bus, Luas or rail (default).' } }, required: ['college'] } },
  { name: 'find_stops', description: 'Find bus, Luas or rail stops by name or stop number, with the routes that serve them. Use when the user names a place and you need the stop.', parametersJsonSchema: { type: 'object', properties: { query: { type: 'string', description: "Stop name, street or stop number, e.g. 'Waterville', 'O'Connell Street', '786'. For a landmark use its street (the Spire -> O'Connell Street)." } }, required: ['query'] } },
  { name: 'next_departures', description: "Next buses, Luas or trains from one place, optionally towards another, with live expected times and delays from the National Transport Authority. If no single route goes there, returns a journey with changes. Use for any question about the next bus or tram, when it is due, or how to get somewhere now.", parametersJsonSchema: { type: 'object', properties: { from: { type: 'string', description: 'Where the user is leaving from: stop name, street or stop number.' }, to: { type: 'string', description: "Where they are going (stop, street or landmark street, e.g. 'O'Connell Street' for the Spire). Leave out for every departure at the stop." } }, required: ['from'] } }
] }]

export async function runTool(origin, name, args) {
  try {
    if (name === 'rank_work') return rankWork(await file(origin, '/data/areas.json'), args || {})
    if (name === 'area_details') return areaDetails(await file(origin, '/data/areas.json'), args || {})
    if (name === 'rank_areas') return rankAreas(await file(origin, '/data/areas.json'), args || {})
    if (name === 'find_stops') return await findStops(origin, args || {})
    if (name === 'next_departures') return await nextDepartures(origin, args || {})
    return { error: `Unknown tool ${name}` }
  } catch (e) { console.error('chat tool', name, e); return { error: 'Live transport data is unavailable right now.' } }
}
