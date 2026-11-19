// The 2D / 3D choice, shared by every map on the page and remembered on this device.
import { useEffect, useState } from 'react'

const KEY = 'map-mode'
export const savedMode = () => { try { return localStorage.getItem(KEY) === '3d' ? '3d' : '2d' } catch { return '2d' } }
export function setMapMode(mode) { try { localStorage.setItem(KEY, mode) } catch {} ; window.dispatchEvent(new Event(KEY)) }
export function useMapMode() {
  const [mode, set] = useState(savedMode)
  useEffect(() => { const f = () => set(savedMode()); window.addEventListener(KEY, f); return () => window.removeEventListener(KEY, f) }, [])
  return mode
}
