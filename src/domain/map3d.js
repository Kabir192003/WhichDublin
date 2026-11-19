import maplibregl from './maplibre.js'
import { Protocol } from 'pmtiles'
import { ROOF_LAYER, ROOF_ZOOM, mappedRoof, osmRoofLayer } from './osm-roofs.js'
const BUILDINGS = 'settld-buildings-3d'
const SOURCE = 'settld-dublin-buildings'
const protocol = new Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)
const CITY_CENTER = [-6.257315, 53.344406]
const NOTE = 'OpenStreetMap building parts · mapped heights first · estimated where missing'

function addScene(map) {
  const label = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id
  const url = new URL(`${import.meta.env.BASE_URL}data/dublin-buildings.pmtiles`, window.location.origin).href
  map.addSource(SOURCE, { type: 'vector', url: `pmtiles://${url}`, attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors (ODbL)</a>' })
  // Our archive contains original outlines and actual building parts. Only the
  // derived render volumes are drawn, so the outlines never double-stack parts.
  map.addLayer({ id: BUILDINGS, type: 'fill-extrusion', source: SOURCE, 'source-layer': 'buildings', minzoom: 14,
    filter: ['==', ['get', 'render'], 1], paint: {
      'fill-extrusion-color': ['case', ['has', 'building_colour'], ['interpolate',['linear'],0.32,0,'#d9d4c9',1,['to-color', ['get', 'building_colour'], '#d9d4c9']],
        ['match', ['get','kind'], ['office','commercial','retail','hotel'], '#c9cdcb', ['apartments','dormitory'], '#d4cdc0', ['house','detached','semidetached_house','terrace','residential'], '#dfd9cd', ['industrial','warehouse','garage','garages'], '#c9cbc7', '#d9d4c9']],
      'fill-extrusion-height': ['step',['zoom'],['get','height'],ROOF_ZOOM,['case',mappedRoof,['get','eave'],['get','height']]], 'fill-extrusion-base': ['get','base'], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true
    }
  }, label)
  map.addLayer(osmRoofLayer(SOURCE),label)
}

function removeScene(map) {
  if (map.getLayer(ROOF_LAYER)) map.removeLayer(ROOF_LAYER)
  if (map.getLayer(BUILDINGS)) map.removeLayer(BUILDINGS)
  if (map.getSource(SOURCE)) map.removeSource(SOURCE)
}

/** One control shared by Explore and both kinds of commute map. The original map and its live data stay mounted. */
export function add3DControl(map, { cityOverview = false } = {}) {
  let active = false, root, two, three, detail, scanButton
  const camera = (options) => map.easeTo({ ...options, duration: 650 })
  const sync = () => {
    two.setAttribute('aria-pressed', String(!active)); three.setAttribute('aria-pressed', String(active))
    detail.hidden = !active; scanButton.hidden = !active
  }
  const select = (enable) => {
    if (enable === active) return
    if (enable) {
      try {
        addScene(map); active = true; detail.textContent = NOTE; sync()
        map.setMaxPitch(75)
        const zoom = map.getZoom()
        camera({ ...(cityOverview && zoom < 13 ? { center: CITY_CENTER } : {}), zoom: cityOverview ? Math.max(zoom, 14.6) : Math.max(zoom - 0.2, 0), pitch: 55, bearing: -20 })
      } catch (err) {
        removeScene(map); active = false; sync(); detail.hidden = false; detail.textContent = '3D could not load. The 2D map is available.'
        console.warn('Settld 3D map:', err.message)
      }
    } else {
      removeScene(map); active = false; sync()
      map.setMaxPitch(0); camera({ pitch: 0, bearing: 0 })
    }
  }
  map.setMaxPitch(0)
  map.addControl({
    onAdd() {
      root = document.createElement('div'); root.className = 'maplibregl-ctrl settld-map-mode'
      const group = document.createElement('div'); group.className = 'maplibregl-ctrl-group settld-map-switch'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Map view')
      two = document.createElement('button'); two.type = 'button'; two.textContent = '2D'; two.title = 'Flat map'; two.setAttribute('aria-label', '2D map'); two.onclick = () => select(false)
      three = document.createElement('button'); three.type = 'button'; three.textContent = '3D'; three.title = 'Architectural 3D model'; three.setAttribute('aria-label', '3D map'); three.onclick = () => select(true)
      group.append(two, three); root.append(group)
      scanButton = document.createElement('button'); scanButton.type = 'button'; scanButton.className = 'map-scan-button'; scanButton.textContent = 'City centre'; scanButton.onclick = () => camera({ center: CITY_CENTER, zoom: 16.5, pitch: 57, bearing: -20 }); root.append(scanButton)
      detail = document.createElement('p'); detail.className = 'map-3d-note'; detail.textContent = NOTE; detail.setAttribute('role', 'status'); root.append(detail)
      sync(); return root
    },
    onRemove() { root?.remove() }
  }, 'top-left')
}
