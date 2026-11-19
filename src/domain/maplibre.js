// One place that loads MapLibre and points it at its worker. From v6 the worker is a separate
// module that the library looks for beside its own file, which isn't where a bundler puts it, so
// Vite builds the worker as its own chunk and we hand the library that URL.
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

maplibregl.setWorkerUrl(workerUrl)

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
export default maplibregl

// 2D / 3D: one button on every map. 3D tilts the camera and raises OpenStreetMap's buildings from
// the same tiles (heights where mapped, a low default where not). The choice is remembered per device.
const KEY = 'map-mode'
const saved = () => { try { return localStorage.getItem(KEY) === '3d' ? '3d' : '2d' } catch { return '2d' } }
const H = ['coalesce', ['get', 'render_height'], 8]

function apply(m, mode, animate) {
  if (!m.getLayer('buildings-3d')) {
    const before = m.getStyle().layers.find((l) => l.type === 'symbol')?.id   // under the street names
    m.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 12, paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], H, 0, '#E6E9EC', 30, '#CBD3DA', 90, '#A9B6C2'],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12, 0, 14, H],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.9 } }, before)
  }
  m.setLayoutProperty('buildings-3d', 'visibility', mode === '3d' ? 'visible' : 'none')
  const cam = mode === '3d' ? { pitch: 60, bearing: -20, zoom: Math.max(m.getZoom(), 14) } : { pitch: 0, bearing: 0 }
  animate ? m.easeTo({ ...cam, duration: 900 }) : m.jumpTo(cam)
}

/** Adds the 2D/3D button to a map and applies the remembered mode once the map has loaded. */
export function enable3D(m) {
  let mode = saved()
  const box = document.createElement('div'); box.className = 'maplibregl-ctrl maplibregl-ctrl-group'
  const b = document.createElement('button'); b.type = 'button'; b.className = 'map-mode-btn'; box.append(b)
  const label = () => { b.textContent = mode === '3d' ? '2D' : '3D'; b.setAttribute('aria-label', mode === '3d' ? 'Switch to flat 2D map' : 'Switch to 3D map with buildings'); b.title = b.getAttribute('aria-label') }
  label()
  b.onclick = () => { mode = mode === '3d' ? '2d' : '3d'; try { localStorage.setItem(KEY, mode) } catch {} ; label(); if (m.loaded() || m.isStyleLoaded()) apply(m, mode, true) }
  m.addControl({ onAdd: () => box, onRemove: () => box.remove() }, 'top-right')
  m.once('load', () => apply(m, mode, false))
}
