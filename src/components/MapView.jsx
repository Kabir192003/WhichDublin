import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const fc = (features) => ({ type: 'FeatureCollection', features })
const pt = (lon, lat, properties) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties })

/**
 * points:   [{ id, name, lat, lon, color, shown }]   areas, coloured by the caller
 * campuses: [{ id, short, lat, lon }]               drawn as dark squares with labels
 * pin:      optional { lat, lon, label }             an Eircode location
 */
export default function MapView({ points, campuses = [], selectedId, onSelect, pin, fitKey }) {
  const el = useRef(null), map = useRef(null), ready = useRef(false)
  const cb = useRef(onSelect); cb.current = onSelect
  const latest = useRef({}); latest.current = { points, campuses, selectedId, pin }

  useEffect(() => {
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [-6.2603, 53.3498], zoom: 11, attributionControl: { compact: true } })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    m.on('load', () => {
      for (const id of ['areas', 'campus', 'pin']) m.addSource(id, { type: 'geojson', data: fc([]) })
      m.addLayer({ id: 'areas', type: 'circle', source: 'areas', paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['case', ['get', 'selected'], 11, 6], 14, ['case', ['get', 'selected'], 14, 10]],
        'circle-color': ['get', 'color'], 'circle-stroke-color': ['case', ['get', 'selected'], '#10212B', '#FFFFFF'], 'circle-stroke-width': ['case', ['get', 'selected'], 3, 2] } })
      m.addLayer({ id: 'area-labels', type: 'symbol', source: 'areas', minzoom: 12.3, layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#10212B', 'text-halo-color': '#fff', 'text-halo-width': 1.4 } })
      m.addLayer({ id: 'campus', type: 'circle', source: 'campus', paint: { 'circle-radius': 7, 'circle-color': '#10212B', 'circle-stroke-color': '#F4B740', 'circle-stroke-width': 3 } })
      m.addLayer({ id: 'campus-label', type: 'symbol', source: 'campus', layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, -1.3], 'text-anchor': 'bottom', 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': false }, paint: { 'text-color': '#10212B', 'text-halo-color': '#fff', 'text-halo-width': 1.8 } })
      m.addLayer({ id: 'pin', type: 'circle', source: 'pin', paint: { 'circle-radius': 10, 'circle-color': '#E8613C', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } })
      m.on('click', 'areas', (e) => cb.current && cb.current(e.features[0].properties.id))
      m.on('mouseenter', 'areas', () => { m.getCanvas().style.cursor = 'pointer' })
      m.on('mouseleave', 'areas', () => { m.getCanvas().style.cursor = '' })
      ready.current = true; draw(); fit()
    })
    map.current = m
    const ro = new ResizeObserver(() => m.resize()); ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); ready.current = false }
  }, [])

  function draw() {
    const m = map.current; if (!m || !ready.current) return
    const { points, campuses, selectedId, pin } = latest.current
    m.getSource('areas').setData(fc(points.map((p) => pt(p.lon, p.lat, { id: p.id, name: p.name, color: p.color, selected: p.id === selectedId }))))
    m.getSource('campus').setData(fc(campuses.map((c) => pt(c.lon, c.lat, { name: c.short }))))
    m.getSource('pin').setData(fc(pin ? [pt(pin.lon, pin.lat, { name: pin.label })] : []))
  }
  function fit() {
    const m = map.current; if (!m || !ready.current) return
    const { points, campuses, pin } = latest.current
    const all = [...points.filter((p) => p.shown !== false), ...campuses, ...(pin ? [pin] : [])]
    if (!all.length) return
    const b = new maplibregl.LngLatBounds([all[0].lon, all[0].lat], [all[0].lon, all[0].lat])
    all.forEach((p) => b.extend([p.lon, p.lat]))
    m.fitBounds(b, { padding: 50, maxZoom: pin ? 13.5 : 13, duration: 500 })
  }
  useEffect(draw, [points, campuses, selectedId, pin])
  useEffect(fit, [fitKey])
  useEffect(() => {   // centre on a newly selected area
    const m = map.current, p = points.find((x) => x.id === selectedId)
    if (m && ready.current && p) m.easeTo({ center: [p.lon, p.lat], zoom: Math.max(m.getZoom(), 12.5), duration: 400 })
  }, [selectedId])

  return <div className="map" ref={el} role="region" aria-label="Map of areas. The list has the same information." />
}
