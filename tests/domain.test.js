import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confidence, reliabilityBand, worst } from '../src/domain/confidence.js'
import { rankAreas, rankMovement } from '../src/domain/rank.js'
import { rentPerPerson, commuteFor, parseState, stateToSearch, DEFAULTS } from '../src/domain/model.js'
import { journey, journeys, medianCommute, buildTransfers, haversineMetres } from '../pipeline/csa.js'

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
  assert.deepEqual(rentPerPerson(a, 'own1'), { total: 1500, perPerson: 1500, people: 1 })
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
  assert.deepEqual(ok, { campus: 'ucd', type: 'own1', mode: 'cycle', priority: 'cheapest', budget: 750 })
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
