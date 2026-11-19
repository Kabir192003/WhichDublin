import React, { useEffect, useRef } from 'react'
import { loadMaps } from '../domain/google.js'
import { setMapMode } from '../domain/mapmode.js'

const M = 111320   // metres per degree of latitude

/**
 * Google's photorealistic 3D Dublin, drawing the same things as the flat map.
 * markers: [{ id, lat, lon, label, color, small }]   lines: [{ coords: [[lat, lon]], color, dashed }]
 * focus:   [[lat, lon]] framed when focusKey changes    onSelect(id) when a marker with an id is clicked
 */
export default function Photo3D({ markers = [], lines = [], focus = [], focusKey, flyTo, onSelect, className, label }) {
  const el = useRef(null), map = useRef(null), lib = useRef(null), drawn = useRef([])
  const sel = useRef(onSelect); sel.current = onSelect
  const latest = useRef({}); latest.current = { markers, lines, focus }

  useEffect(() => {
    let alive = true
    loadMaps().then(async (maps) => {
      const l = await maps.importLibrary('maps3d'), { PinElement } = await maps.importLibrary('marker')
      if (!alive) return
      lib.current = { ...l, PinElement }
      const m = new l.Map3DElement({ center: { lat: 53.3449, lng: -6.2675, altitude: 0 }, range: 6000, tilt: 60, heading: -20, mode: 'HYBRID', defaultUIHidden: false })
      m.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
      el.current.append(m); map.current = m
      draw(); frame(false)
    }).catch(() => setMapMode('2d'))   // no key, blocked key or no WebGL: back to the flat map
    return () => { alive = false; map.current?.remove(); map.current = null }
  }, [])

  function draw() {
    const m = map.current, L = lib.current; if (!m || !L) return
    drawn.current.forEach((x) => x.remove()); drawn.current = []
    const { markers, lines } = latest.current
    for (const ln of lines) {
      if (!ln.coords || ln.coords.length < 2) continue
      const p = new L.Polyline3DElement({ altitudeMode: 'CLAMP_TO_GROUND', strokeColor: ln.color, strokeWidth: ln.dashed ? 5 : 9, outerColor: '#FFFFFF', outerWidth: ln.dashed ? 0 : 0.35, drawsOccludedSegments: true })
      p.coordinates = ln.coords.map(([lat, lng]) => ({ lat, lng }))
      m.append(p); drawn.current.push(p)
    }
    for (const k of markers) {
      const Cls = k.id != null && sel.current ? L.Marker3DInteractiveElement : L.Marker3DElement
      const mk = new Cls({ position: { lat: k.lat, lng: k.lon, altitude: k.small ? 8 : 40 }, altitudeMode: 'RELATIVE_TO_GROUND', extruded: !k.small, label: k.label || null, drawsWhenOccluded: true, sizePreserved: true, collisionBehavior: k.small ? 'OPTIONAL_AND_HIDES_LOWER_PRIORITY' : 'REQUIRED', zIndex: k.small ? 1 : 10 })
      mk.append(new L.PinElement({ background: k.color, borderColor: '#FFFFFF', glyphColor: '#FFFFFF', scale: k.small ? 0.6 : 1 }))
      if (Cls === L.Marker3DInteractiveElement) mk.addEventListener('gmp-click', () => sel.current?.(k.id))
      m.append(mk); drawn.current.push(mk)
    }
  }
  function frame(animate = true) {
    const m = map.current, pts = latest.current.focus; if (!m || !pts.length) return
    const la = pts.map((p) => p[0]), lo = pts.map((p) => p[1])
    const c = { lat: (Math.min(...la) + Math.max(...la)) / 2, lng: (Math.min(...lo) + Math.max(...lo)) / 2, altitude: 0 }
    const span = Math.max((Math.max(...la) - Math.min(...la)) * M, (Math.max(...lo) - Math.min(...lo)) * M * Math.cos(c.lat * Math.PI / 180))
    const cam = { center: c, range: Math.min(30000, Math.max(900, span * 1.9)), tilt: 55, heading: -20 }
    if (animate) m.flyCameraTo({ endCamera: cam, durationMillis: 1400 }); else Object.assign(m, cam)
  }
  useEffect(draw, [markers, lines])
  useEffect(() => frame(), [focusKey])
  useEffect(() => { if (flyTo && map.current) map.current.flyCameraTo({ endCamera: { center: { lat: flyTo[0], lng: flyTo[1], altitude: 0 }, range: 1400, tilt: 60, heading: -20 }, durationMillis: 1200 }) }, [flyTo?.[0], flyTo?.[1]])

  return (
    <div className={className} ref={el} role="region" aria-label={label} style={{ background: '#DCE3E8' }}>
      <button type="button" className="map-mode-btn photo3d-toggle" onClick={() => setMapMode('2d')} aria-label="Switch to flat 2D map" title="Switch to flat 2D map">2D</button>
    </div>
  )
}
