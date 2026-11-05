/** Pure geography helpers for the Eircode lookup. Same walking/cycling assumptions as the pipeline. */
export const WALK_MS = 1.25, DETOUR = 1.3, CYCLE_MS = 15 / 3.6

export function haversine(a, b) {
  const R = 6371000, r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
export const walkMin = (m) => Math.round((m * DETOUR) / WALK_MS / 60)
export const cycleMin = (m) => Math.round((m * DETOUR) / CYCLE_MS / 60)

// Eircode: routing key (letter + 2 digits, or D6W) + 4-character unique identifier
const KEY = /^([AC-FHKNPRTV-Y]\d{2}|D6W)$/
const UID = /^[0-9AC-FHKNPRTV-Y]{4}$/

/** Normalise user input. Returns { key, uid, full } or null when it cannot be an Eircode. */
export function parseEircode(input) {
  const s = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (s.length !== 7 && s.length !== 3) return null
  const key = s.slice(0, 3), uid = s.slice(3)
  if (!KEY.test(key)) return null
  if (uid && !UID.test(uid)) return null
  return { key, uid: uid || null, full: uid ? `${key} ${uid}` : key }
}

export function nearest(list, point, n = 1) {
  return list.map((x) => ({ x, m: haversine(point, x) })).sort((a, b) => a.m - b.m).slice(0, n)
}

/** Everything the Eircode page shows, from a point and the published dataset. */
export function fromPoint(point, data) {
  const [na] = nearest(data.areas, point)
  const area = na?.x
  const colleges = data.campuses.map((c) => {
    const m = haversine(point, c)
    const t = area?.toCampus?.[c.id]?.transit
    return { id: c.id, name: c.name, km: Math.round(m / 100) / 10, walk: walkMin(m), cycle: cycleMin(m), transit: t ? t.minutes : null }
  }).sort((a, b) => a.km - b.km)
  const shops = ['Lidl', 'Aldi', 'Tesco'].map((brand) => {
    const [s] = nearest(data.stores.filter((x) => x.brand === brand), point)
    return s ? { brand, name: s.x.name, metres: Math.round((s.m * DETOUR) / 10) * 10, walk: walkMin(s.m), lat: s.x.lat, lon: s.x.lon } : { brand, name: null }
  })
  const [dock] = nearest(data.docks || [], point)
  const near = nearest(data.areas, point, 8).filter((a) => a.m <= 3000).map((a) => a.x)
  const hubs = {}
  for (const cat of ['retail', 'food', 'hotels', 'leisure']) {
    const best = near.filter((a) => a.work?.[cat]).sort((a, b) => b.work[cat].n - a.work[cat].n)[0]
    if (best) hubs[cat] = { id: best.id, name: best.label, n: best.work[cat].n, capped: best.work[cat].capped }
  }
  return { area, areaMetres: na ? Math.round(na.m) : null, colleges, shops, dock: dock && dock.m <= 2000 ? { name: dock.x.name, walk: walkMin(dock.m), metres: Math.round(dock.m * DETOUR / 10) * 10 } : null, hubs }
}
