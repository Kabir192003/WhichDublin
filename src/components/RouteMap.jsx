import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const fc = (features) => ({ type: 'FeatureCollection', features })
const pt = (lon, lat, properties) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties })
const line = (coords) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} })

/** A route's path with every stop, the user's stop highlighted. Minimal, no area colouring. */
export default function RouteMap({ stops, youId }) {
  const el = useRef(null), map = useRef(null), ready = useRef(false)
  const latest = useRef({}); latest.current = { stops, youId }

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [-6.2603, 53.3498], zoom: 11, attributionControl: { compact: true } })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      m.addSource('line', { type: 'geojson', data: fc([]) })
      m.addSource('stops', { type: 'geojson', data: fc([]) })
      m.addLayer({ id: 'line', type: 'line', source: 'line', paint: { 'line-color': '#0B6B57', 'line-width': 3 } })
      m.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: {
        'circle-radius': ['case', ['get', 'you'], 9, 4],
        'circle-color': ['case', ['get', 'you'], '#E8613C', '#0B6B57'],
        'circle-stroke-color': '#fff', 'circle-stroke-width': ['case', ['get', 'you'], 3, 1.5] } })
      m.addLayer({ id: 'you-label', type: 'symbol', source: 'stops', filter: ['get', 'you'], layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, -1.4], 'text-anchor': 'bottom', 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#10212B', 'text-halo-color': '#fff', 'text-halo-width': 1.8 } })
      ready.current = true; draw(); fit()
    })
    map.current = m
    const ro = new ResizeObserver(() => m.resize()); ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); ready.current = false }
  }, [])

  function draw() {
    const m = map.current; if (!m || !ready.current) return
    const { stops, youId } = latest.current
    const pts = stops.filter((s) => s.lat != null)
    m.getSource('line').setData(fc(pts.length > 1 ? [line(pts.map((s) => [s.lon, s.lat]))] : []))
    m.getSource('stops').setData(fc(pts.map((s) => pt(s.lon, s.lat, { name: s.name, you: s.id === youId }))))
  }
  function fit() {
    const m = map.current; if (!m || !ready.current) return
    const pts = latest.current.stops.filter((s) => s.lat != null)
    if (!pts.length) return
    const b = new maplibregl.LngLatBounds([pts[0].lon, pts[0].lat], [pts[0].lon, pts[0].lat])
    pts.forEach((p) => b.extend([p.lon, p.lat]))
    m.fitBounds(b, { padding: 40, maxZoom: 15, duration: 400 })
  }
  useEffect(() => { draw(); fit() }, [stops, youId])

  return <div className="map" style={{ height: 320, borderRadius: 12, overflow: 'hidden' }} ref={el} role="region" aria-label="Map of the route, your stop highlighted" />
}
