import React, { useEffect, useRef } from 'react'
import { loadMaps } from '../domain/google.js'

/** A Google map for Google-sourced results (their terms require Google results to be shown on a Google map). */
export default function GoogleMap({ point, campuses = [], shops = [] }) {
  const el = useRef(null)
  useEffect(() => {
    let alive = true
    loadMaps().then(async (maps) => {
      if (!alive) return
      const { Map, InfoWindow } = await maps.importLibrary('maps')
      const { Marker } = await maps.importLibrary('marker')
      const map = new Map(el.current, { center: { lat: point.lat, lng: point.lon }, zoom: 14, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, clickableIcons: false })
      const bounds = new maps.LatLngBounds()
      const add = (p, label, color, scale, fit = true) => {
        const m = new Marker({ map, position: { lat: p.lat, lng: p.lon }, title: label, icon: { path: maps.SymbolPath.CIRCLE, scale, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } })
        const iw = new InfoWindow({ content: label }); m.addListener('click', () => iw.open({ map, anchor: m }))
        if (fit) bounds.extend({ lat: p.lat, lng: p.lon })
      }
      add(point, 'This address', '#E8613C', 10)
      shops.filter((s) => s.lat).forEach((s) => add(s, `${s.name}${s.address ? ', ' + s.address : ''}`, '#0B7A65', 7))
      campuses.forEach((c) => add(c, c.name, '#10212B', 6, false))   // colleges stay on the map but don't drive the zoom
      map.fitBounds(bounds, 60)
    }).catch(() => {})
    return () => { alive = false }
  }, [point.lat, point.lon, shops.length])
  return <div ref={el} style={{ position: 'absolute', inset: 0 }} role="region" aria-label="Google map of this address, nearby supermarkets and colleges" />
}
