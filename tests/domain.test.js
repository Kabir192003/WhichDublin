import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confidence, reliabilityBand, worst } from '../src/domain/confidence.js'
import { rankAreas, rankMovement } from '../src/domain/rank.js'
import { rentPerPerson, commuteFor, parseState, stateToSearch, DEFAULTS, hourLimit, grossPay, workByArea, workMix } from '../src/domain/model.js'
import { journey, journeys, medianCommute, buildTransfers, haversineMetres } from '../src/domain/csa.js'

test('confidence: rent needs a deep local market and recent data; missing input means "do not show"', () => {
  assert.equal(confidence('rent', { cells: 18, ageDays: 300 }), 'high')
  assert.equal(confidence('rent', { cells: 18, ageDays: 500 }), 'medium')
  assert.equal(confidence('rent', { cells: 3, ageDays: 100 }), 'low')
  assert.equal(confidence('rent', { cells: 50 }), null)
  assert.equal(confidence('rent', null), null)
  assert.equal(worst('high', 'low', 'medium'), 'low')
})
test('confidence: commute and reliability thresholds', () => {
  assert.equal(confidence('commute', { departures: 10, walkShare: 0.3 }), 'high')
  assert.equal(confidence('commute', { departures: 10, walkShare: 0.6 }), 'medium')
  assert.equal(confidence('commute', { departures: 2, walkShare: 0.1 }), 'low')
  assert.equal(confidence('reliability', { weeks: 5, trips: 500 }), 'high')
  assert.equal(confidence('reliability', { weeks: 1, trips: 500 }), 'low')
})
test('reliability bands use plain language', () => {
  assert.equal(reliabilityBand(0.05).label, 'Usually on time')
  assert.equal(reliabilityBand(0.2).label, 'Sometimes late')
  assert.equal(reliabilityBand(0.4).label, 'Often late')
  assert.equal(reliabilityBand(null), null)
})

const R = (id, rent, commute, groceries) => ({ id, rent, commute, groceries })
const toy = [R('a', 1000, 40, 5), R('b', 1800, 15, 5), R('c', 1400, 25, 20), R('d', 3000, 10, 2), R('e', null, 20, 5)]

test('ranking: budget filter, missing data reported, weights change the order', () => {
  const cheap = rankAreas(toy, { budget: 2000, weights: { rent: 10, commute: 1, groceries: 1 } })
  assert.deepEqual(cheap.overBudget, [{ id: 'd', over: 1000 }]); assert.deepEqual(cheap.missing, ['e'])
  assert.equal(cheap.ranked[0].id, 'a')
  const quick = rankAreas(toy, { budget: 2000, weights: { rent: 1, commute: 10, groceries: 1 } })
  assert.equal(quick.ranked[0].id, 'b')
  const mv = rankMovement(toy, { budget: 2000, weights: { rent: 10, commute: 1, groceries: 1 } }, { budget: 2000, weights: { rent: 1, commute: 10, groceries: 1 } })
  assert.ok(mv.some((m) => m.delta !== 0))
  assert.throws(() => rankAreas(toy, { budget: 2000, weights: {} }))
})
test('ranking: areas without grocery data are flagged, not rewarded', () => {
  const r = rankAreas([R('x', 1000, 20, null), R('y', 1000, 20, 30)], { budget: 2000, weights: { rent: 1, commute: 1, groceries: 1 } })
  assert.equal(r.ranked.find((q) => q.id === 'x').groceriesMissing, true)
})
test('ranking: every area at the same value does not divide by zero', () => {
  const r = rankAreas([R('p', 1000, 20, 5), R('q', 1000, 20, 5)], { budget: 2000, weights: { rent: 1, commute: 1, groceries: 1 } })
  assert.equal(r.ranked.length, 2); assert.ok(r.ranked.every((x) => Number.isFinite(x.score)))
})

const area = (rent, to) => ({ id: 'z', rent: { cells: rent }, toCampus: to, nearestBudgetGroceryMinutes: 7 })
test('model: rent per person depends on how you rent, and missing cells stay missing', () => {
  const a = area({ '1:any': 1500, '2:any': 2100 }, {})
  assert.equal(rentPerPerson(a, 'own1').perPerson, 1500); assert.equal(rentPerPerson(a, 'own1').people, 1)
  assert.equal(rentPerPerson(a, 'share2').perPerson, 1050)
  assert.equal(rentPerPerson(a, 'share3'), null)
})
test('model: commute follows the chosen mode; no transit journey means no commute, not a guess', () => {
  const a = area({}, { tcd: { distanceKm: 3, walkMinutes: 42, cycleMinutes: 13, transit: { minutes: 25, bestMinutes: 20, worstMinutes: 31, changes: 1, walkMinutes: 8, departures: 13, confidence: 'high' } }, ucd: { distanceKm: 9, walkMinutes: 130, cycleMinutes: 40, transit: null } })
  assert.equal(commuteFor(a, 'tcd', 'transit').minutes, 25); assert.equal(commuteFor(a, 'tcd', 'cycle').minutes, 13); assert.equal(commuteFor(a, 'tcd', 'walk').minutes, 42)
  assert.equal(commuteFor(a, 'ucd', 'transit'), null); assert.equal(commuteFor(a, 'ucd', 'cycle').minutes, 40)
  assert.equal(commuteFor(a, 'nope', 'transit'), null)
})
test('model: shared links are sanitised', () => {
  const ok = parseState('?campus=ucd&type=own1&mode=cycle&priority=cheapest&budget=750', ['tcd', 'ucd'])
  assert.deepEqual(ok, { campus: 'ucd', type: 'own1', ptype: 'any', mode: 'cycle', priority: 'cheapest', budget: 750 })
  const bad = parseState('?campus=<script>&type=x&mode=y&priority=z&budget=-5', ['tcd', 'ucd'])
  assert.deepEqual(bad, { ...DEFAULTS, campus: 'tcd' })
  assert.equal(parseState('?budget=999999', ['tcd']).budget, DEFAULTS.budget)
  assert.equal(parseState(stateToSearch(ok) ? '?' + stateToSearch(ok) : '', ['tcd', 'ucd']).campus, 'ucd')
})

// A toy city: stops on a line ~0.8 km apart.
const stops = [0, 1, 2, 3].map((i) => ({ lat: 53.34, lon: -6.30 + i * 0.012 }))
const bus = (trip, t0) => stops.slice(0, -1).map((s, i) => ({ dep: t0 + i * 600, arr: t0 + i * 600 + 480, from: i, to: i + 1, trip }))
const list = [...bus(0, 8 * 3600), ...bus(1, 8 * 3600 + 1800)].sort((a, b) => a.dep - b.dep)
const conn = { dep: list.map((c) => c.dep), arr: list.map((c) => c.arr), from: list.map((c) => c.from), to: list.map((c) => c.to), trip: list.map((c) => c.trip) }
const network = { stops, conn, transfers: buildTransfers(stops, 300) }
const noWalk = { maxWalkOnlyMetres: 1000 } // force the bus: the toy campus is 2.4 km away
const home = { lat: 53.3402, lon: -6.3003 }, campus = { lat: 53.3398, lon: -6.2638 }

test('csa: finds a one-ride journey and splits walk from ride time', () => {
  const j = journey(network, home, campus, 8 * 3600 - 300, noWalk)
  assert.ok(j && j.rides === 1 && j.totalSecs > 600 && j.totalSecs < 3000, JSON.stringify(j))
  assert.ok(j.walkSecs < j.totalSecs)
})
test('csa: a missed last departure becomes a wait, and no service gives null', () => {
  const early = journey(network, home, campus, 7 * 3600, noWalk)
  assert.ok(early.totalSecs > 3600, 'waits for the first bus')
  assert.equal(journey(network, home, campus, 23 * 3600, noWalk), null)
})
test('csa: a short trip is faster on foot and is reported as walking', () => {
  const near = { lat: 53.3402, lon: -6.2990 }
  const j = journey(network, home, near, 8 * 3600)
  assert.equal(j.rides, 0); assert.equal(j.walkSecs, j.totalSecs)
})
test('csa: median over departures and the fields the confidence label needs', () => {
  const m = medianCommute(network, home, campus, [8 * 3600 - 300, 8 * 3600 + 900, 8 * 3600 + 1500, 8 * 3600 + 2100], noWalk)
  assert.ok(m.minutes > 10 && m.minutes < 60); assert.equal(m.attempted, 4); assert.ok(m.departures >= 1 && m.walkShare >= 0 && m.walkShare <= 1)
  assert.equal(medianCommute(network, home, campus, [23 * 3600], noWalk), null)
})
test('haversine sanity: ~1 degree of latitude is ~111 km', () => {
  assert.ok(Math.abs(haversineMetres({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 111195) < 300)
})

test('csa: one scan serves many destinations and matches single-destination results', () => {
  const dests = [campus, { lat: 53.3401, lon: -6.2880 }]
  const many = journeys(network, home, dests, 8 * 3600 - 300, noWalk)
  assert.deepEqual(many[0], journey(network, home, dests[0], 8 * 3600 - 300, noWalk))
  assert.ok(many[1].totalSecs < many[0].totalSecs, 'the nearer destination is faster')
})
test('csa: footpath transfers connect two lines that do not share a stop', () => {
  const st = [{ lat: 53.34, lon: -6.30 }, { lat: 53.34, lon: -6.28 }, { lat: 53.3402, lon: -6.2802 }, { lat: 53.34, lon: -6.26 }]
  const cs = [{ dep: 8 * 3600, arr: 8 * 3600 + 300, from: 0, to: 1, trip: 0 }, { dep: 8 * 3600 + 600, arr: 8 * 3600 + 900, from: 2, to: 3, trip: 1 }]
  const net = { stops: st, conn: { dep: cs.map((c) => c.dep), arr: cs.map((c) => c.arr), from: cs.map((c) => c.from), to: cs.map((c) => c.to), trip: cs.map((c) => c.trip) }, transfers: buildTransfers(st, 300) }
  const r = journey(net, { lat: 53.34, lon: -6.3003 }, { lat: 53.34, lon: -6.2597 }, 8 * 3600 - 120, { maxWalkOnlyMetres: 500 })
  assert.equal(r.rides, 2)
})

const RULES = { termHours: 20, holidayHours: 40, holidays: [{ from: [5, 1], to: [8, 30], label: 'summer' }, { from: [11, 15], to: [0, 15], label: 'winter' }] }
test('work: weekly cap switches between term and the two holiday windows, including across new year', () => {
  assert.equal(hourLimit(new Date(2026, 10, 4), RULES).hours, 20)       // 4 Nov
  assert.equal(hourLimit(new Date(2026, 5, 1), RULES).hours, 40)        // 1 Jun
  assert.equal(hourLimit(new Date(2026, 8, 30), RULES).hours, 40)       // 30 Sep
  assert.equal(hourLimit(new Date(2026, 9, 1), RULES).hours, 20)        // 1 Oct
  assert.equal(hourLimit(new Date(2026, 11, 14), RULES).hours, 20)      // 14 Dec
  assert.equal(hourLimit(new Date(2026, 11, 15), RULES).hours, 40)      // 15 Dec
  assert.equal(hourLimit(new Date(2027, 0, 15), RULES).hours, 40)       // 15 Jan
  assert.equal(hourLimit(new Date(2027, 0, 16), RULES).hours, 20)       // 16 Jan
})
test('work: gross pay at the minimum wage', () => {
  const p = grossPay(20, 14.15)
  assert.equal(Math.round(p.week * 100) / 100, 283); assert.equal(Math.round(p.month), 1226)
})
test('work: areas ranked by count, flag capped, mix picks the relatively strongest category', () => {
  const A = (id, retail, food) => ({ id, work: { retail: { n: retail, capped: false }, food: { n: food, capped: food >= 40 }, hotels: { n: 0, capped: false }, leisure: { n: 0, capped: false } } })
  const areas = [A('a', 30, 5), A('b', 10, 40), A('c', 20, 20)]
  assert.deepEqual(workByArea(areas, 'retail').map((r) => r.id), ['a', 'c', 'b'])
  assert.equal(workByArea(areas, 'food')[0].capped, true)
  assert.equal(workMix(areas[0], areas).top, 'retail'); assert.equal(workMix(areas[1], areas).top, 'food')
  assert.equal(workMix({ id: 'x', work: null }, areas), null)
})
test('model: dublinbikes mode needs both docks, otherwise no journey', () => {
  const a = area({}, { tcd: { distanceKm: 3, walkMinutes: 42, cycleMinutes: 13, transit: null, bikeshare: { minutes: 19, walkFromHomeMinutes: 3, rideMinutes: 12, walkToCampusMinutes: 2, rideKm: 3.4, fromDock: 'A', toDock: 'B' } }, ucd: { distanceKm: 9, walkMinutes: 130, cycleMinutes: 40, transit: null } })
  assert.equal(commuteFor(a, 'tcd', 'bikeshare').minutes, 19); assert.equal(commuteFor(a, 'ucd', 'bikeshare'), null)
})

test('model: rent cells carry how they were obtained, and confidence follows the method', () => {
  const a = { rent: { confidence: 'high', cells: { '2:any': { v: 2000, how: 'published', q: '2025Q4' }, '2:terrace': { v: 2100, how: 'estimated', anchor: '2:any' }, '2:detached': { v: 2600, how: 'estimated', anchor: 'all:any' }, '2:semi': { v: 2200, how: 'carried', q: '2024Q4' } } } }
  assert.equal(rentPerPerson(a, 'share2').confidence, 'high')
  assert.equal(rentPerPerson(a, 'share2', 'terrace').confidence, 'medium')
  assert.equal(rentPerPerson(a, 'share2', 'detached').confidence, 'low')
  assert.equal(rentPerPerson(a, 'share2', 'semi').howLabel, 'Carried forward')
  assert.equal(rentPerPerson(a, 'own2', 'any').perPerson, 2000)
})

import { parseEircode, fromPoint, haversine, walkMin } from '../src/domain/geo.js'
test('eircode: accepts real formats in any spacing or case, rejects others', () => {
  assert.deepEqual(parseEircode('d02 x285'), { key: 'D02', uid: 'X285', full: 'D02 X285' })
  assert.equal(parseEircode('D6W  1234').full, 'D6W 1234')
  assert.equal(parseEircode('A94 F2X3').key, 'A94')
  assert.equal(parseEircode('D07').uid, null)
  assert.equal(parseEircode('B12 3456'), null)       // B is not a routing-key letter
  assert.equal(parseEircode('D02 X28'), null)
  assert.equal(parseEircode('<script>'), null)
  assert.equal(parseEircode(''), null)
})
test('eircode: from a point, colleges sorted by distance and nearest shops found', () => {
  const data = {
    campuses: [{ id: 'far', name: 'Far', lat: 53.40, lon: -6.25 }, { id: 'near', name: 'Near', lat: 53.345, lon: -6.255 }],
    areas: [{ id: 'a', label: 'A', lat: 53.344, lon: -6.256, toCampus: { near: { transit: { minutes: 9 } }, far: { transit: null } }, work: { food: { n: 30, capped: false } } }],
    stores: [{ brand: 'Lidl', name: 'Lidl X', lat: 53.346, lon: -6.25 }], docks: []
  }
  const r = fromPoint({ lat: 53.3445, lon: -6.2555 }, data)
  assert.equal(r.colleges[0].id, 'near'); assert.equal(r.colleges[0].transit, 9); assert.equal(r.colleges[1].transit, null)
  assert.equal(r.shops[0].name, 'Lidl X'); assert.equal(r.shops[1].name, null)
  assert.equal(r.hubs.food.n, 30); assert.equal(r.dock, null)
  assert.ok(Math.abs(haversine({ lat: 53, lon: -6 }, { lat: 53.01, lon: -6 }) - 1112) < 5)
  assert.equal(walkMin(1000), 17)
})
