/** Turns the published dataset into rows for a chosen campus, rent type and commute mode. Pure, so it is unit-tested. */

export const RENT_TYPES = {
  own1: { label: 'Own 1-bed', short: 'a 1-bed on your own', cell: '1:any', people: 1, hint: 'Average rent for a 1-bed, all of it yours.' },
  share2: { label: 'Share a 2-bed', short: 'sharing a 2-bed', cell: '2:any', people: 2, hint: 'Average 2-bed rent split between 2 people.' },
  share3: { label: 'Share a 3-bed', short: 'sharing a 3-bed', cell: '3:any', people: 3, hint: 'Average 3-bed rent split between 3 people.' }
}
export const MODES = {
  transit: { label: 'Public transport' },
  bikeshare: { label: 'Dublinbikes' },
  cycle: { label: 'Own bike' },
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
  if (mode === 'bikeshare') {
    const b = c.bikeshare; if (!b) return null
    return { minutes: b.minutes, kind: 'estimate', confidence: 'medium', bike: b, detail: `${b.walkFromHomeMinutes} min walk to ${b.fromDock}, ${b.rideMinutes} min ride (${b.rideKm} km), ${b.walkToCampusMinutes} min walk from ${b.toDock}` }
  }
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

// ---- part-time work -------------------------------------------------------------------------------------------

export const WORK_CATEGORIES = {
  retail: { label: 'Retail', hint: 'Supermarkets, clothes shops, convenience stores' },
  food: { label: 'Food and drink', hint: 'Restaurants, cafes, fast food, pubs' },
  hotels: { label: 'Hotels', hint: 'Hotels and guesthouses' },
  leisure: { label: 'Gyms and cinemas', hint: 'Gyms, fitness centres, cinemas' }
}

/** Weekly hour cap for a non-EEA student on Stamp 2, from the date. Months are 0-based. */
export function hourLimit(date, rules) {
  const m = date.getMonth(), d = date.getDate()
  const on = (from, to) => {
    const a = from[0] * 100 + from[1], b = to[0] * 100 + to[1], x = m * 100 + d
    return a <= b ? x >= a && x <= b : x >= a || x <= b   // a window that wraps the new year
  }
  const hol = rules.holidays.find((h) => on(h.from, h.to))
  return hol ? { hours: rules.holidayHours, period: 'holiday', label: hol.label } : { hours: rules.termHours, period: 'term' }
}

export const grossPay = (hours, rate) => ({ week: hours * rate, month: (hours * rate * 52) / 12 })

/** How the areas compare for one kind of work: the share of the busiest area, with honest 'at least' flags for capped counts. */
export function workByArea(areas, cat) {
  const rows = areas.filter((a) => a.work && a.work[cat]).map((a) => ({ id: a.id, n: a.work[cat].n, capped: a.work[cat].capped }))
  const max = Math.max(1, ...rows.map((r) => r.n))
  return rows.map((r) => ({ ...r, share: r.n / max })).sort((x, y) => y.n - x.n || x.id.localeCompare(y.id))
}

/** The kind of work an area leans towards: its category with the biggest share of that category's citywide maximum. */
export function workMix(area, areas) {
  if (!area.work) return null
  const best = Object.keys(WORK_CATEGORIES).map((c) => {
    const max = Math.max(1, ...areas.filter((a) => a.work?.[c]).map((a) => a.work[c].n))
    return { cat: c, n: area.work[c]?.n ?? 0, rel: (area.work[c]?.n ?? 0) / max }
  }).sort((x, y) => y.rel - x.rel)
  return { top: best[0].rel > 0 ? best[0].cat : null, items: best }
}
