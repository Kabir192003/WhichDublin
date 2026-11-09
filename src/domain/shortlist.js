/** Saved areas: kept in this browser (if storage is allowed) and shareable as a link. Never sent anywhere. */
import { useEffect, useState } from 'react'
const KEY = 'wd.shortlist.v1'
const listeners = new Set()
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 30) : [] } catch { return [] } }
let ids = read()
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* private mode: keep in memory */ } listeners.forEach((f) => f(ids)) }
export const toggle = (id) => { ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]; write() }
export const setAll = (list) => { ids = [...new Set(list)].slice(0, 30); write() }
export const getIds = () => ids
/** Non-React subscription, for domain/account.js to mirror changes to an account without being a component. */
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export function useShortlist() {
  const [v, setV] = useState(ids)
  useEffect(() => { listeners.add(setV); return () => listeners.delete(setV) }, [])
  return v
}
export const shareUrl = (list) => `${location.origin}${location.pathname}#/shortlist/${list.join(',')}`
