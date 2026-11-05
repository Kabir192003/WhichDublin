// Fails the build when published data is impossible or missing its provenance. Run by `npm run build`.
import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync('public/data/areas.json', 'utf8'))
const errors = []
const bad = (m) => errors.push(m)

for (const k of ['rent', 'transit', 'geography', 'groceries']) {
  const s = d.sources?.[k]
  if (!s?.name || !s?.licence || !s?.url && !s?.note) bad(`sources.${k} incomplete`)
}
if (!d.sources?.rent?.asOf) bad('sources.rent.asOf missing')
if (!d.sources?.transit?.serviceDate) bad('sources.transit.serviceDate missing')
if (d.areas.length < 50) bad(`only ${d.areas.length} areas`)
const campusIds = new Set(d.campuses.map((c) => c.id))
const inDublin = (lat, lon) => lat > 53.2 && lat < 53.5 && lon > -6.5 && lon < -6.05
const ids = new Set()

for (const a of d.areas) {
  const w = `${a.id}:`
  if (ids.has(a.id)) bad(`${w} duplicate id`); ids.add(a.id)
  if (!inDublin(a.lat, a.lon)) bad(`${w} coordinates outside Dublin ${a.lat},${a.lon}`)
  if (!a.rent?.quarter) bad(`${w} rent has no quarter`)
  if (!['high', 'medium', 'low'].includes(a.rent?.confidence)) bad(`${w} rent has no confidence`)
  for (const [cell, c] of Object.entries(a.rent?.cells ?? {})) {
    if (!(c.v >= 300 && c.v <= 12000)) bad(`${w} rent ${cell}=${c.v} implausible`)
    if (!['published', 'carried', 'estimated'].includes(c.how)) bad(`${w} rent ${cell} has no method`)
  }
  if (Object.keys(a.rent?.cells ?? {}).length !== 25) bad(`${w} rent does not cover every size and type`)
  for (const c of campusIds) {
    const t = a.toCampus?.[c]
    if (!t) { bad(`${w} missing campus ${c}`); continue }
    if (!(t.distanceKm >= 0 && t.distanceKm < 40)) bad(`${w} ${c} distance ${t.distanceKm}`)
    if (!(t.walkMinutes >= 0 && t.cycleMinutes >= 0 && t.cycleMinutes <= t.walkMinutes)) bad(`${w} ${c} walk/cycle inconsistent`)
    const x = t.transit
    if (x) {
      if (!(x.minutes > 0 && x.minutes < 180)) bad(`${w} ${c} transit ${x.minutes} min`)
      if (!(x.bestMinutes <= x.minutes && x.minutes <= x.worstMinutes)) bad(`${w} ${c} best/median/worst out of order`)
      if (!['high', 'medium', 'low'].includes(x.confidence)) bad(`${w} ${c} transit has no confidence`)
      // a bus cannot beat the straight line at walking pace by an absurd margin
      if (x.minutes < t.distanceKm / 0.6) bad(`${w} ${c} faster than 36 km/h straight-line`)
    }
  }
  for (const [brand, g] of Object.entries(a.groceries ?? {})) if (g && !(g.metres >= 0 && g.walkMinutes >= 0 && g.osm)) bad(`${w} grocery ${brand} invalid`)
}
// work, bike share and docks
for (const a of d.areas) {
  const w = `${a.id}:`
  for (const [cat, v] of Object.entries(a.work ?? {})) if (!(Number.isInteger(v.n) && v.n >= 0 && v.n <= 200)) bad(`${w} work.${cat}=${v.n} implausible`)
  if (a.nearestDock && !(a.nearestDock.walkMinutes >= 0 && a.nearestDock.walkMinutes <= 25)) bad(`${w} dock walk ${a.nearestDock.walkMinutes}`)
  for (const [c, t] of Object.entries(a.toCampus)) {
    const b = t.bikeshare; if (!b) continue
    if (!(b.minutes > 0 && b.minutes < 120 && b.rideKm > 0 && b.rideKm < 30)) bad(`${w} ${c} bikeshare implausible`)
    if (b.minutes < b.walkFromHomeMinutes + b.walkToCampusMinutes) bad(`${w} ${c} bikeshare shorter than its own walking legs`)
    if (b.rideKm / (Math.max(1, b.rideMinutes) / 60) > 20) bad(`${w} ${c} bike ride faster than 20 km/h`)
  }
}
if (d.areas.some((a) => a.work) && !d.sources.employers?.fetched) bad('employers source has no fetched date')
if (d.areas.some((a) => a.nearestDock) && !d.sources.bikes?.fetched) bad('bikes source has no fetched date')
if (errors.length) { console.error(`validate: ${errors.length} problem(s)\n - ` + errors.slice(0, 40).join('\n - ')); process.exit(1) }
console.log(`validate: ${d.areas.length} areas, ${campusIds.size} campuses OK`)
