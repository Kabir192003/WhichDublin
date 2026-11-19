import React, { useEffect, useRef } from 'react'
import maplibregl, { MAP_STYLE as STYLE, enable3D } from '../domain/maplibre.js'

const fc = (features) => ({ type: 'FeatureCollection', features })
const pt = (lon, lat, properties) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties })
const line = (coords) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} })

/**
 * A route's path with every stop, the user's stop highlighted.
 * stops: [{ id, name, lat, lon }]
 * youId: the stop id to highlight, or an array of ids (e.g. origin + destination)
 * path:  [[lat, lon], ...] road-following geometry (GTFS shapes.txt); falls back to straight
 *        lines stop-to-stop when not available (e.g. before it's loaded, or a feed with none)
 * color: line colour; teal by default, pass a different one (e.g. for a journey leg) to distinguish it
 */
export default function RouteMap({ stops, youId, path, color = '#0B6B57', buses = [], legs }) {
  const el = useRef(null), map = useRef(null), ready = useRef(false)
  const latest = useRef({}); latest.current = { stops, youId, path, buses, legs }

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [-6.2603, 53.3498], zoom: 11, attributionControl: { compact: true } })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right'); enable3D(m)
    m.on('load', () => {
      m.addSource('line', { type: 'geojson', data: fc([]) })
      m.addSource('stops', { type: 'geojson', data: fc([]) })
      m.addSource('buses', { type: 'geojson', data: fc([]) })
      m.addSource('legs', { type: 'geojson', data: fc([]) })
      m.addLayer({ id: 'line', type: 'line', source: 'line', paint: { 'line-color': color, 'line-width': 3 } })
      m.addLayer({ id: 'legs-solid', type: 'line', source: 'legs', filter: ['!', ['get', 'dashed']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 5 } })
      m.addLayer({ id: 'legs-walk', type: 'line', source: 'legs', filter: ['get', 'dashed'], paint: { 'line-color': ['get', 'color'], 'line-width': 3.5, 'line-dasharray': [1.2, 1.4] } })
      m.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: {
        'circle-radius': ['case', ['get', 'you'], 9, 4],
        'circle-color': ['case', ['get', 'you'], '#E8613C', color],
        'circle-stroke-color': '#fff', 'circle-stroke-width': ['case', ['get', 'you'], 3, 1.5] } })
      m.addLayer({ id: 'you-label', type: 'symbol', source: 'stops', filter: ['get', 'you'], layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, -1.4], 'text-anchor': 'bottom', 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#10212B', 'text-halo-color': '#fff', 'text-halo-width': 1.8 } })
      m.addLayer({ id: 'buses-halo', type: 'circle', source: 'buses', paint: { 'circle-radius': 11, 'circle-color': '#fff', 'circle-opacity': 0.95 } })
      m.addLayer({ id: 'buses', type: 'circle', source: 'buses', paint: { 'circle-radius': 7.5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#10212B', 'circle-stroke-width': 1.5 } })
      m.addLayer({ id: 'bus-label', type: 'symbol', source: 'buses', layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, -1.5], 'text-anchor': 'bottom', 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': false, 'text-optional': true }, paint: { 'text-color': '#10212B', 'text-halo-color': '#fff', 'text-halo-width': 2 } })
      m.on('click', 'buses', (e) => { const f = e.features?.[0]; if (f) new maplibregl.Popup({ closeButton: false, offset: 12 }).setLngLat(f.geometry.coordinates).setText(f.properties.label || 'Bus').addTo(m) })
      m.on('mouseenter', 'buses', () => { m.getCanvas().style.cursor = 'pointer' }); m.on('mouseleave', 'buses', () => { m.getCanvas().style.cursor = '' })
      ready.current = true; draw(); fit()
    })
    map.current = m
    const ro = new ResizeObserver(() => m.resize()); ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); ready.current = false }
  }, [])

  function draw() {
    const m = map.current; if (!m || !ready.current) return
    const { stops, youId, path, buses, legs } = latest.current
    m.getSource('legs').setData(fc((legs || []).map((l) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.coords.map(([la, lo]) => [lo, la]) }, properties: { color: l.color, dashed: !!l.dashed } }))))
    m.getSource('buses').setData(fc((buses || []).map((b) => pt(b.lon, b.lat, { color: b.color || '#C9441F', name: b.name || '', label: b.label || '' }))))
    const pts = stops.filter((s) => s.lat != null)
    const lineCoords = legs ? [] : path && path.length > 1 ? path.map(([lat, lon]) => [lon, lat]) : pts.map((s) => [s.lon, s.lat])   // a planned journey draws its own legs instead
    m.setPaintProperty('line', 'line-color', color)
    m.setPaintProperty('stops', 'circle-color', ['case', ['get', 'you'], '#E8613C', color])
    m.getSource('line').setData(fc(lineCoords.length > 1 ? [line(lineCoords)] : []))
    const isYou = (id) => Array.isArray(youId) ? youId.includes(id) : id === youId
    m.getSource('stops').setData(fc(pts.map((s) => pt(s.lon, s.lat, { name: s.name, you: isYou(s.id) }))))
  }
  function fit() {
    const m = map.current; if (!m || !ready.current) return
    const { stops, path, legs } = latest.current
    const pts = (legs && legs.length ? legs.flatMap((l) => l.coords.map(([lat, lon]) => ({ lat, lon }))) : path && path.length ? path.map(([lat, lon]) => ({ lat, lon })) : stops.filter((s) => s.lat != null))
    if (!pts.length) return
    const b = new maplibregl.LngLatBounds([pts[0].lon, pts[0].lat], [pts[0].lon, pts[0].lat])
    pts.forEach((p) => b.extend([p.lon, p.lat]))
    m.fitBounds(b, { padding: 40, maxZoom: 15, duration: 400 })
  }
  useEffect(() => { draw(); fit() }, [stops, youId, path, color, legs])
  useEffect(() => { draw() }, [buses])   // bus markers move every 30 s without re-fitting the map

  return <div className="routemap" ref={el} role="region" aria-label="Map of the route, your stop highlighted, with live bus positions when available" />
}
