// One place that loads MapLibre and points it at its worker. From v6 the worker is a separate
// module that the library looks for beside its own file, which isn't where a bundler puts it, so
// Vite builds the worker as its own chunk and we hand the library that URL.
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

maplibregl.setWorkerUrl(workerUrl)

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'
export default maplibregl
