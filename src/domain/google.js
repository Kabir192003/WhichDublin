/**
 * Google Maps Platform, used only for live, per-person lookups on the Eircode page (never stored, never mixed into the
 * open dataset). Active only when the site is built with VITE_GOOGLE_MAPS_KEY. Results are shown on a Google map.
 *   - Geocoding (Maps JS Geocoder): Eircode -> exact location
 *   - Places API (New), Text Search: nearest Lidl, Aldi and Tesco
 *   - Routes API, computeRouteMatrix: walking, cycling and public transport times
 */
export const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
export const hasGoogle = () => !!GOOGLE_KEY

let loader = null
export function loadMaps() {
  if (!GOOGLE_KEY) return Promise.reject(new Error('no key'))
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps)
  loader ||= new Promise((resolve, reject) => {
    const cb = '__wdGoogleReady'
    window[cb] = () => resolve(window.google.maps)
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&loading=async&region=IE&language=en-GB&callback=${cb}`
    s.async = true; s.onerror = () => reject(new Error('Google Maps failed to load'))
    document.head.appendChild(s)
  })
  return loader
}

/** Eircode -> { lat, lon, address } or null. */
export async function geocodeEircode(full) {
  const maps = await loadMaps()
  const { Geocoder } = await maps.importLibrary('geocoding')
  const res = await new Geocoder().geocode({ address: full, componentRestrictions: { country: 'IE' } }).catch(() => null)
  const r = res?.results?.[0]
  if (!r) return null
  const exact = r.types?.includes('postal_code') || r.address_components?.some((c) => c.types.includes('postal_code') && c.long_name.replace(/\s/g, '') === full.replace(/\s/g, ''))
  return { lat: r.geometry.location.lat(), lon: r.geometry.location.lng(), address: r.formatted_address, exact: !!exact }
}

const headers = (mask) => ({ 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': mask })

/** Nearest store of a brand around a point, by distance. */
export async function nearestStore(brand, p) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST', headers: headers('places.displayName,places.formattedAddress,places.location,places.businessStatus'),
    body: JSON.stringify({ textQuery: brand, includedType: 'supermarket', rankPreference: 'DISTANCE', maxResultCount: 5, locationBias: { circle: { center: { latitude: p.lat, longitude: p.lon }, radius: 5000 } } })
  })
  if (!r.ok) throw new Error(`Places ${r.status}`)
  const j = await r.json()
  const hit = (j.places || []).find((x) => x.businessStatus !== 'CLOSED_PERMANENTLY' && (x.displayName?.text || '').toLowerCase().includes(brand.toLowerCase()))
  return hit ? { brand, name: hit.displayName.text, address: hit.formattedAddress, lat: hit.location.latitude, lon: hit.location.longitude } : { brand, name: null }
}

function nextWeekday8am() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1)
  // 08:00 in Dublin; Ireland is UTC+0 in winter, UTC+1 in summer
  const s = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Dublin' })
  const offset = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', timeZoneName: 'shortOffset' }).formatToParts(d).find((x) => x.type === 'timeZoneName')?.value
  const h = offset && offset.includes('+1') ? '07' : '08'
  return `${s}T${h}:00:00Z`
}

/** One origin to many destinations. mode: WALK | BICYCLE | TRANSIT. Returns [{ metres, secs } | null]. */
export async function routeMatrix(origin, dests, mode) {
  const wp = (p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lon } } } })
  const body = { origins: [wp(origin)], destinations: dests.map(wp), travelMode: mode }
  if (mode === 'TRANSIT') body.departureTime = nextWeekday8am()
  const r = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', { method: 'POST', headers: headers('destinationIndex,distanceMeters,duration,condition'), body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`Routes ${r.status}`)
  const rows = await r.json()
  const out = dests.map(() => null)
  for (const e of rows) if (e.condition === 'ROUTE_EXISTS' && e.duration) out[e.destinationIndex ?? 0] = { metres: e.distanceMeters ?? null, secs: parseInt(e.duration, 10) }
  return out
}
