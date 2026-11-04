/**
 * Ranking without hiding trade-offs. Each eligible area gets a 0..1 score per criterion, relative to the other
 * eligible areas, then a weighted sum. Per-criterion scores are returned so the UI can explain a position, and
 * rankMovement() shows how the order changes when the weights change.
 *
 * row:   { id, rent: number|null, commute: number|null, groceries: number|null }   (monthly euro, minutes, minutes)
 * prefs: { budget, weights: { rent, commute, groceries } }                         weights are relative
 */
export function rankAreas(rows, prefs) {
  const w = { rent: 0, commute: 0, groceries: 0, ...prefs.weights }
  const wsum = w.rent + w.commute + w.groceries
  if (!(wsum > 0)) throw new Error('At least one weight must be positive')

  const missing = rows.filter((r) => r.rent == null || r.commute == null).map((r) => r.id)
  const usable = rows.filter((r) => r.rent != null && r.commute != null)
  const overBudget = usable.filter((r) => r.rent > prefs.budget).map((r) => ({ id: r.id, over: Math.round(r.rent - prefs.budget) })).sort((a, b) => a.over - b.over)
  const eligible = usable.filter((r) => r.rent <= prefs.budget)

  const lowerIsBetter = (vals, v) => { const lo = Math.min(...vals), hi = Math.max(...vals); return hi === lo ? 1 : 1 - (v - lo) / (hi - lo) }
  const rents = eligible.map((r) => r.rent), commutes = eligible.map((r) => r.commute)
  const groc = eligible.filter((r) => r.groceries != null).map((r) => r.groceries)

  const ranked = eligible.map((r) => {
    const parts = {
      rent: lowerIsBetter(rents, r.rent),
      commute: lowerIsBetter(commutes, r.commute),
      // no grocery data is scored neutrally and flagged, never silently rewarded or punished
      groceries: r.groceries != null && groc.length ? lowerIsBetter(groc, r.groceries) : 0.5
    }
    const score = (parts.rent * w.rent + parts.commute * w.commute + parts.groceries * w.groceries) / wsum
    return { id: r.id, score, parts, groceriesMissing: r.groceries == null }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  ranked.forEach((r, i) => { r.rank = i + 1 })
  return { ranked, overBudget, missing }
}

/** How the order changes between two weightings: [{ id, from, to, delta }] sorted by biggest move. */
export function rankMovement(rows, prefsA, prefsB) {
  const a = Object.fromEntries(rankAreas(rows, prefsA).ranked.map((r) => [r.id, r.rank]))
  const b = Object.fromEntries(rankAreas(rows, prefsB).ranked.map((r) => [r.id, r.rank]))
  return Object.keys(a).filter((id) => id in b).map((id) => ({ id, from: a[id], to: b[id], delta: a[id] - b[id] })).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
}

export const PRESETS = {
  balanced: { label: 'Best overall', weights: { rent: 1, commute: 1, groceries: 0.4 } },
  cheapest: { label: 'Cheapest', weights: { rent: 3, commute: 1, groceries: 1 } },
  shortest: { label: 'Closest to college', weights: { rent: 1, commute: 3, groceries: 0.4 } }
}
