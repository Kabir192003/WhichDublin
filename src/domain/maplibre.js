// One place that loads MapLibre and points it at its worker. From v6 the worker is a separate
// module that the library looks for beside its own file, which isn't where a bundler puts it, so
// Vite builds the worker as its own chunk and we hand the library that URL.
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'

maplibregl.setWorkerUrl(workerUrl)
maplibregl.addProtocol('pmtiles', new Protocol().tile)   // our own Dublin buildings file (pipeline/build-buildings.py)

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
export default maplibregl

// 2D / 3D: one button on every map, all open data and free. 3D tilts the camera, raises OpenStreetMap's
// buildings (Dublin's from our own OpenStreetMap build, full outlines and parts), lifts the ground with open elevation
// data (Mapzen Terrarium on AWS Open Data), shades hills, and adds sky and haze. Remembered per device.
const KEY = 'map-mode'
const saved = () => { try { return localStorage.getItem(KEY) === '3d' ? '3d' : '2d' } catch { return '2d' } }
const H = ['get', 'h']

function setup3D(m) {
  if (m.getSource('dem')) return
  const before = m.getStyle().layers.find((l) => l.type === 'symbol')?.id   // keep street names on top
  m.addSource('dem', { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14,
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    attribution: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen, AWS Open Data</a>' })
  m.addLayer({ id: 'hills-3d', type: 'hillshade', source: 'dem', layout: { visibility: 'none' }, paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#5B6B76', 'hillshade-highlight-color': '#FFFFFF' } }, before)
  m.addSource('dublin-buildings', { type: 'vector', url: `pmtiles://${location.origin}/data/buildings.pmtiles`, attribution: '© OpenStreetMap contributors' })
  m.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: 'dublin-buildings', 'source-layer': 'buildings', minzoom: 12,
    layout: { visibility: 'none' }, paint: {
    // stone to slate by height
    'fill-extrusion-color': ['interpolate', ['linear'], H, 0, '#E9E4DA', 15, '#D9D3C7', 40, '#BCC3CA', 100, '#8E9BA8'],
    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12, 0, 13.5, H],
    'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 12, 0, 13.5, ['get', 'b']],
    'fill-extrusion-opacity': 0.95, 'fill-extrusion-vertical-gradient': true } }, before)
  m.setLight({ anchor: 'map', position: [1.4, 215, 35], color: '#FFFFFF', intensity: 0.35 })
}

function apply(m, mode, animate) {
  setup3D(m)
  const on = mode === '3d'
  for (const id of ['hills-3d', 'buildings-3d']) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  for (const l of m.getStyle().layers) if (l.id.includes('shield')) m.setLayoutProperty(l.id, 'visibility', on ? 'none' : 'visible')   // road-number badges clutter the 3D view
  m.setTerrain(on ? { source: 'dem', exaggeration: 1.5 } : null)
  m.setSky(on ? { 'sky-color': '#9CC3E4', 'horizon-color': '#E7EEF3', 'fog-color': '#E7EEF3', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.3, 'fog-ground-blend': 0.08, 'atmosphere-blend': 0.6 } : {})
  m.setMaxPitch(on ? 75 : 60)
  const cam = on ? { pitch: 55, bearing: -20, zoom: Math.max(m.getZoom(), 14) } : { pitch: 0, bearing: 0 }
  animate ? m.easeTo({ ...cam, duration: 1000 }) : m.jumpTo(cam)
}

/** Adds the 2D/3D button to a map and applies the remembered mode once the map has loaded. */
export function enable3D(m) {
  let mode = saved()
  const box = document.createElement('div'); box.className = 'maplibregl-ctrl maplibregl-ctrl-group'
  const b = document.createElement('button'); b.type = 'button'; b.className = 'map-mode-btn'; box.append(b)
  const label = () => { b.textContent = mode === '3d' ? '2D' : '3D'; b.setAttribute('aria-label', mode === '3d' ? 'Switch to flat 2D map' : 'Switch to 3D map with buildings and hills'); b.title = b.getAttribute('aria-label') }
  label()
  b.onclick = () => { mode = mode === '3d' ? '2d' : '3d'; try { localStorage.setItem(KEY, mode) } catch {} ; label(); if (m.isStyleLoaded()) apply(m, mode, true) }
  m.addControl({ onAdd: () => box, onRemove: () => box.remove() }, 'top-right')
  m.once('load', () => apply(m, mode, false))
}
