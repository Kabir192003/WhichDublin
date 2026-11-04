import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'

/** Areas as circles coloured by rank band, the campus as a square-ish ring. Click selects an area. */
export default function MapView({ campus, points, selectedId, onSelect }) {
  const el = useRef(null), map = useRef(null), ready = useRef(false)
  const cb = useRef(onSelect); cb.current = onSelect

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [-6.2603, 53.3498], zoom: 11, attributionControl: { compact: true } })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      m.addSource('areas', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addSource('campus', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'areas', type: 'circle', source: 'areas', paint: {
        'circle-radius': ['case', ['get', 'selected'], 11, 8],
        'circle-color': ['get', 'color'], 'circle-stroke-color': ['case', ['get', 'selected'], '#0b1f3a', '#ffffff'], 'circle-stroke-width': ['case', ['get', 'selected'], 3, 1.5] } })
      m.addLayer({ id: 'area-labels', type: 'symbol', source: 'areas', minzoom: 12.2, layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#1c2733', 'text-halo-color': '#fff', 'text-halo-width': 1.2 } })
      m.addLayer({ id: 'campus', type: 'circle', source: 'campus', paint: { 'circle-radius': 9, 'circle-color': '#0b1f3a', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } })
      m.addLayer({ id: 'campus-label', type: 'symbol', source: 'campus', layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, -1.4], 'text-anchor': 'bottom', 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#0b1f3a', 'text-halo-color': '#fff', 'text-halo-width': 1.6 } })
      m.on('click', 'areas', (e) => cb.current(e.features[0].properties.id))
      m.on('mouseenter', 'areas', () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'areas', () => { m.getCanvas().style.cursor = '' })
      ready.current = true; draw()
    })
    map.current = m
    const ro = new ResizeObserver(() => m.resize()); ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); ready.current = false }
  }, [])

  function draw() {
    const m = map.current; if (!m || !ready.current) return
    m.getSource('areas').setData({ type: 'FeatureCollection', features: points.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { id: p.id, name: p.name, color: p.color, selected: p.id === selectedId } })) })
    m.getSource('campus').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [campus.lon, campus.lat] }, properties: { name: campus.short } }] })
  }
  useEffect(draw, [points, selectedId, campus])

  useEffect(() => {
    const m = map.current; if (!m || !points.length) return
    const b = new maplibregl.LngLatBounds([campus.lon, campus.lat], [campus.lon, campus.lat])
    points.filter((p) => p.shown).forEach((p) => b.extend([p.lon, p.lat]))
    m.fitBounds(b, { padding: 50, maxZoom: 13.5, duration: 600 })
  }, [campus.id, points.length])

  return <div className="map" ref={el} role="region" aria-label="Map of areas. The list on the left has the same information." />
}
