/**
 * Confidence labels (plan section 7.3). The rules are data, published on the "How we know this" page, so the
 * page and the code can never disagree.
 *
 * Rent: the CSO table does not publish sample sizes. We use what it does tell us: the age of the quarter, and how
 * many bedroom/property-type cells RTB populated for the area (a proxy for how deep the local rental market is).
 */
export const CONFIDENCE_RULES = {
  rent: {
    description: 'Based on how many kinds of tenancy RTB published a figure for in this area (a proxy for market size), and how old the quarter is.',
    high: { minCells: 12, maxAgeDays: 400 },
    medium: { minCells: 6, maxAgeDays: 730 }
  },
  commute: {
    description: 'Scheduled door-to-door time on a typical weekday morning. Based on how many departures were sampled and how much of the trip is walking.',
    high: { minDepartures: 8, maxWalkShare: 0.5 },
    medium: { minDepartures: 4, maxWalkShare: 0.7 }
  },
  reliability: {
    description: 'Based on how many weeks of real-time observations and how many trips were observed.',
    high: { minWeeks: 4, minTrips: 200 },
    medium: { minWeeks: 2, minTrips: 60 }
  }
}

const order = ['low', 'medium', 'high']
export const worst = (...levels) => order[Math.min(...levels.map((l) => order.indexOf(l)))]

/** @returns {'high'|'medium'|'low'|null}  null means the input is missing: do not show the number. */
export function confidence(kind, v, rules = CONFIDENCE_RULES) {
  const r = rules[kind]
  if (!r || v == null) return null
  if (kind === 'rent') {
    if (v.cells == null || v.ageDays == null) return null
    if (v.cells >= r.high.minCells && v.ageDays <= r.high.maxAgeDays) return 'high'
    if (v.cells >= r.medium.minCells && v.ageDays <= r.medium.maxAgeDays) return 'medium'
    return 'low'
  }
  if (kind === 'commute') {
    if (v.departures == null || v.walkShare == null) return null
    if (v.departures >= r.high.minDepartures && v.walkShare <= r.high.maxWalkShare) return 'high'
    if (v.departures >= r.medium.minDepartures && v.walkShare <= r.medium.maxWalkShare) return 'medium'
    return 'low'
  }
  if (kind === 'reliability') {
    if (v.weeks == null || v.trips == null) return null
    if (v.weeks >= r.high.minWeeks && v.trips >= r.high.minTrips) return 'high'
    if (v.weeks >= r.medium.minWeeks && v.trips >= r.medium.minTrips) return 'medium'
    return 'low'
  }
  return null
}

/** Plain-language meaning of the reliability share (plan 8.3). `lateShare` = share of trips more than N minutes late. */
export function reliabilityBand(lateShare) {
  if (lateShare == null) return null
  if (lateShare <= 0.1) return { id: 'usually-on-time', label: 'Usually on time' }
  if (lateShare <= 0.25) return { id: 'sometimes-late', label: 'Sometimes late' }
  return { id: 'often-late', label: 'Often late' }
}
