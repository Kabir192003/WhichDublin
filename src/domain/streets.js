/** Live street routing (walk and bike) from one point, via the OpenStreetMap community OSRM servers (FOSSGIS). */
const BASE = 'https://routing.openstreetmap.de'

/** Returns [{ metres, secs }] parallel to dests, or null when the service is unavailable. */
export async function streetTable(profile, origin, dests) {
  if (!dests.length) return []
  const coords = [origin, ...dests].map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';')
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${BASE}/routed-${profile}/table/v1/${profile}/${coords}?sources=0&annotations=duration,distance`)
      if (r.ok) {
        const d = await r.json()
        if (d.code === 'Ok') return dests.map((_, i) => d.distances[0][i + 1] == null ? null : { metres: Math.round(d.distances[0][i + 1]), secs: Math.round(d.durations[0][i + 1]) })
      }
    } catch { /* busy or offline: retry */ }
    await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)))
  }
  return null
}

/** Free-text address search in the Dublin area (Nominatim). */
export async function searchAddress(text) {
  const p = new URLSearchParams({ q: text, format: 'jsonv2', limit: '6', countrycodes: 'ie', viewbox: '-6.55,53.64,-6.0,53.18', bounded: '1', addressdetails: '0' })
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`)
  if (!r.ok) return []
  return (await r.json()).map((x) => ({ lat: +x.lat, lon: +x.lon, label: x.display_name.split(',').slice(0, 3).join(',') }))
}
