/** Turns the published dataset into rows for a chosen campus, rent type and commute mode. Pure, so it is unit-tested. */
import { RENT_NEW_TENANCY } from '../content/facts.js'

/** The RTB's own figures track existing tenancies, which run below what a new tenancy actually costs (see facts.js).
 * We scale every rent figure we show by this ratio so the numbers reflect a tenancy starting now, not one already running. */
export const MARKET_FACTOR = RENT_NEW_TENANCY.dublinNew / RENT_NEW_TENANCY.dublinExisting
export const toMarket = (v) => Math.round(v * MARKET_FACTOR)

export const RENT_TYPES = {
  own1: { label: 'Whole 1-bed', short: 'a whole 1-bed (you pay all of it)', bed: '1', people: 1, hint: 'A whole 1-bedroom home, all yours.' },
  own2: { label: 'Whole 2-bed', short: 'a whole 2-bed (you pay all of it)', bed: '2', people: 1, hint: 'A whole 2-bedroom home and you pay all of the rent, e.g. as a couple paying from one budget.' },
  own3: { label: 'Whole 3-bed', short: 'a whole 3-bed (you pay all of it)', bed: '3', people: 1, hint: 'A whole 3-bedroom home and you pay all of the rent.' },
  share2: { label: 'Shared 2-bed', short: 'sharing a 2-bed', bed: '2', people: 2, hint: 'A 2-bedroom home with the rent split between everyone living there.' },
  share3: { label: 'Shared 3-bed', short: 'sharing a 3-bed', bed: '3', people: 3, hint: 'A 3-bedroom home with the rent split between everyone living there.' },
  share4: { label: 'Shared 4-bed', short: 'sharing a 4-bed', bed: '4', people: 4, hint: 'A 4-bedroom home with the rent split between everyone living there.' }
}
export const isShared = (type) => RENT_TYPES[type]?.people > 1
/** People sharing the rent: one per bedroom by default, at most two per bedroom; 1 for a whole home. */
export function sharers(type, people) {
  const t = RENT_TYPES[type]; if (!t || t.people === 1) return 1
  const n = Math.round(Number(people)); return Number.isFinite(n) ? Math.min(Math.max(n, 2), Number(t.bed) * 2) : t.people
}
/** How the rooms work out, in words: "own room each", "1 spare room", "2 rooms shared by two". */
export function roomsText(beds, people) {
  const b = Number(beds), n = people
  if (n <= b) return n === b ? 'own room each' : `own room each, ${b - n} spare`
  const shared = n - b
  return shared === b ? 'every room shared by two' : `${shared} ${shared === 1 ? 'room' : 'rooms'} shared by two, ${b - shared} on their own`
}
/** The living choice in a sentence, for headings and summaries. */
export function livingText(s) {
  const t = RENT_TYPES[s.type]; if (!isShared(s.type)) return t.short
  const n = sharers(s.type, s.people)
  return `sharing a ${t.bed}-bed with ${n - 1} ${n - 1 === 1 ? 'other' : 'others'} (${roomsText(t.bed, n)})`
}
export const livingLabel = (s) => isShared(s.type) ? `${RENT_TYPES[s.type].label}, ${sharers(s.type, s.people)} people` : RENT_TYPES[s.type].label
export const HOME_TYPES = { any: 'Any type', apartment: 'Apartment', terrace: 'Terraced house', semi: 'Semi-detached', detached: 'Detached house' }
const HOW_LABEL = { published: 'Published', carried: 'Carried forward', estimated: 'Estimated' }

/** Confidence of one rent cell from how it was obtained. */
export function cellConfidence(area, c) {
  if (c.how === 'published') return area.rent.confidence
  if (c.how === 'carried') return 'medium'
  return c.anchor && c.anchor !== 'all:any' ? 'medium' : 'low'
}

/** Monthly rent per person for the chosen setup. Every area has a figure; `how` says whether it is published or derived. */
export function rentPerPerson(area, type, ptype = 'any', people) {
  const t = { ...RENT_TYPES[type], people: sharers(type, people) }
  const c = area.rent.cells[`${t.bed}:${ptype}`]
  if (!c) return null
  const rtb = typeof c === 'number' ? c : c.v
  const v = toMarket(rtb)
  return { total: v, perPerson: Math.round(v / t.people), rtbTotal: rtb, people: t.people, how: c.how || 'published', howLabel: HOW_LABEL[c.how || 'published'], q: c.q, anchor: c.anchor, confidence: typeof c === 'number' ? area.rent.confidence : cellConfidence(area, c) }
}

/** Rent for a whole home of `bed` bedrooms split between `people`, for any mix of own and shared rooms. */
export function rentForHome(area, bed, ptype = 'any', people = 1) {
  const c = area.rent.cells[`${bed}:${ptype}`]
  if (!c) return null
  const rtb = typeof c === 'number' ? c : c.v
  const total = toMarket(rtb), n = Math.max(1, people)
  return { total, perPerson: Math.round(total / n), rtbTotal: rtb, people: n, how: c.how || 'published', q: c.q, confidence: typeof c === 'number' ? area.rent.confidence : cellConfidence(area, c) }
}

export const MODES = {
  transit: { label: 'Public transport' },
  bikeshare: { label: 'Dublinbikes' },
  cycle: { label: 'Own bike' },
  walk: { label: 'Walking' }
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

export function buildRows(areas, { campus, type, mode, ptype = 'any', people }) {
  return areas.map((a) => {
    const rent = rentPerPerson(a, type, ptype, people), commute = commuteFor(a, campus, mode)
    return { id: a.id, rent: rent ? rent.perPerson : null, commute: commute ? commute.minutes : null, groceries: a.nearestBudgetGroceryMinutes ?? null, _rent: rent, _commute: commute }
  })
}

export const DEFAULTS = { campus: 'tcd', type: 'share2', ptype: 'any', mode: 'transit', budget: 1100, priority: 'balanced', people: 2 }
const OK = { ptype: Object.keys(HOME_TYPES), type: Object.keys(RENT_TYPES), mode: Object.keys(MODES), priority: ['balanced', 'cheapest', 'shortest'] }

/** Read and sanitise state from a query string, so shared links can't put the app into an invalid state. */
export function parseState(search, campusIds) {
  const p = new URLSearchParams(search)
  const pick = (key, list, fb) => (list.includes(p.get(key)) ? p.get(key) : fb)
  // before the college list has loaded (campusIds null), keep a plausible id so the link isn't rewritten to the default
  const campus = campusIds ? pick('campus', campusIds, DEFAULTS.campus) : (/^[a-z]{2,12}$/.test(p.get('campus') || '') ? p.get('campus') : DEFAULTS.campus)
  const b = Number(p.get('budget'))
  return {
    campus, type: pick('type', OK.type, DEFAULTS.type), ptype: pick('ptype', OK.ptype, DEFAULTS.ptype), mode: pick('mode', OK.mode, DEFAULTS.mode),
    priority: pick('priority', OK.priority, DEFAULTS.priority), budget: Number.isFinite(b) && b >= 200 && b <= 6000 ? Math.round(b) : DEFAULTS.budget,
    people: sharers(pick('type', OK.type, DEFAULTS.type), p.get('people') ?? undefined)
  }
}
export const stateToSearch = (s) => new URLSearchParams({ campus: s.campus, type: s.type, ptype: s.ptype, mode: s.mode, priority: s.priority, budget: String(s.budget), ...(isShared(s.type) && { people: String(sharers(s.type, s.people)) }) }).toString()

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

// ---- monthly cost -----------------------------------------------------------------------------------------------
/** Public transport cost a month, from the Dublin 90-minute fare. Fare caps are not applied (we could not confirm them). */
export function travelCost(mode, { daysPerWeek = 5, fare = 1 } = {}) {
  if (mode !== 'transit') return 0
  return Math.round(fare * 2 * daysPerWeek * 52 / 12)
}
export function monthlyCost({ rentShare, travel = 0, bills = 0, food = 0, phone = 0 }) {
  const parts = { rent: rentShare || 0, travel, bills, food, phone }
  return { parts, total: Object.values(parts).reduce((a, b) => a + (Number(b) || 0), 0) }
}

/**
 * Monthly cost range for one person. Household bills are split between the people sharing; energy (electricity and
 * gas) is scaled by the home's energy rating when known. Every input can be overridden by the user's own figure.
 * bills: { electricity, gas, broadband } each { low, typical, high }; groceries/phone: { low?, typical, high? }.
 */
/** Cash needed to move in: a deposit (at most one month's rent, RTB rule), the first month's costs (rent paid in
 *  advance plus everything else), and the immigration registration fee for non-EU/EEA students. */
export function firstMonth({ rentShare, month, irpFee = 0 }) {
  const parts = { deposit: rentShare, month, irp: irpFee }
  return { parts, total: parts.deposit + parts.month + parts.irp }
}

export function costRange({ rentShare, travel = 0, people = 1, berFactor = null, bills, groceries, phone, own = {} }) {
  const n = Math.max(1, people)
  const energy = (k, lvl) => {
    const v = bills[k][lvl]
    if (berFactor == null) return v
    return Math.round(bills[k].typical * berFactor * (lvl === 'low' ? 0.85 : lvl === 'high' ? 1.15 : 1))
  }
  const level = (lvl) => {
    const billsHH = own.bills != null ? own.bills * n : energy('electricity', lvl) + energy('gas', lvl) + bills.broadband[lvl]
    const pick = (v) => (v != null && typeof v === 'object' ? v[lvl] : v)
    const parts = {
      rent: pick(rentShare) || 0, travel: pick(travel) || 0,
      bills: Math.round(billsHH / n),
      food: own.food != null ? own.food : (groceries[lvl] ?? groceries.typical),
      phone: own.phone != null ? own.phone : (phone[lvl] ?? phone.typical)
    }
    return { parts, total: Object.values(parts).reduce((a, b) => a + b, 0) }
  }
  return { low: level('low'), typical: level('typical'), high: level('high') }
}
