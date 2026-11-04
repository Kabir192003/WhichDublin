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
  for (const [cell, v] of Object.entries(a.rent?.cells ?? {})) if (!(v >= 300 && v <= 9000)) bad(`${w} rent ${cell}=${v} implausible`)
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
if (errors.length) { console.error(`validate: ${errors.length} problem(s)\n - ` + errors.slice(0, 40).join('\n - ')); process.exit(1) }
console.log(`validate: ${d.areas.length} areas, ${campusIds.size} campuses OK`)
