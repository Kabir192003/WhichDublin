/** Turns the published dataset into rows for a chosen campus, rent type and commute mode. Pure, so it is unit-tested. */

export const RENT_TYPES = {
  own1: { label: 'Own 1-bed', short: 'a 1-bed on your own', cell: '1:any', people: 1, hint: 'Average rent for a 1-bed, all of it yours.' },
  share2: { label: 'Share a 2-bed', short: 'sharing a 2-bed', cell: '2:any', people: 2, hint: 'Average 2-bed rent split between 2 people.' },
  share3: { label: 'Share a 3-bed', short: 'sharing a 3-bed', cell: '3:any', people: 3, hint: 'Average 3-bed rent split between 3 people.' }
}
export const MODES = {
  transit: { label: 'Public transport' },
  cycle: { label: 'Cycling' },
  walk: { label: 'Walking' }
}

/** Monthly rent per person for the chosen setup, or null when RTB published no figure for that area and type. */
export function rentPerPerson(area, type) {
  const t = RENT_TYPES[type]
  const v = area.rent.cells[t.cell]
  return v == null ? null : { total: v, perPerson: Math.round(v / t.people), people: t.people }
}

/** Commute minutes for the mode, with the detail the UI shows. null when there is no usable journey. */
export function commuteFor(area, campusId, mode) {
  const c = area.toCampus[campusId]
  if (!c) return null
  if (mode === 'walk') return { minutes: c.walkMinutes, kind: 'estimate', confidence: 'medium', detail: `${c.distanceKm} km, straight-line distance x 1.3` }
  if (mode === 'cycle') return { minutes: c.cycleMinutes, kind: 'estimate', confidence: 'medium', detail: `${c.distanceKm} km at 15 km/h` }
  if (!c.transit) return null
  return { minutes: c.transit.minutes, kind: 'scheduled', confidence: c.transit.confidence, best: c.transit.bestMinutes, worst: c.transit.worstMinutes,
           changes: c.transit.changes, walkMinutes: c.transit.walkMinutes, departures: c.transit.departures }
}

export function buildRows(areas, { campus, type, mode }) {
  return areas.map((a) => {
    const rent = rentPerPerson(a, type), commute = commuteFor(a, campus, mode)
    return { id: a.id, rent: rent ? rent.perPerson : null, commute: commute ? commute.minutes : null, groceries: a.nearestBudgetGroceryMinutes ?? null, _rent: rent, _commute: commute }
  })
}

export const DEFAULTS = { campus: 'tcd', type: 'share2', mode: 'transit', budget: 1100, priority: 'balanced' }
const OK = { type: Object.keys(RENT_TYPES), mode: Object.keys(MODES), priority: ['balanced', 'cheapest', 'shortest'] }

/** Read and sanitise state from a query string, so shared links can't put the app into an invalid state. */
export function parseState(search, campusIds) {
  const p = new URLSearchParams(search)
  const pick = (key, list, fb) => (list.includes(p.get(key)) ? p.get(key) : fb)
  const b = Number(p.get('budget'))
  return {
    campus: pick('campus', campusIds, DEFAULTS.campus), type: pick('type', OK.type, DEFAULTS.type), mode: pick('mode', OK.mode, DEFAULTS.mode),
    priority: pick('priority', OK.priority, DEFAULTS.priority), budget: Number.isFinite(b) && b >= 200 && b <= 6000 ? Math.round(b) : DEFAULTS.budget
  }
}
export const stateToSearch = (s) => new URLSearchParams({ campus: s.campus, type: s.type, mode: s.mode, priority: s.priority, budget: String(s.budget) }).toString()
