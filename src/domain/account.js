/** Fully optional accounts: a username and a password, nothing else. Signing in only pulls in your
 * saved areas so they follow you to another device; everything else in the app works the same
 * signed in or out, and your shortlist stays usable locally even if you never sign in. */
import { useEffect, useState } from 'react'
import { getIds, setAll, subscribe } from './shortlist.js'

const listeners = new Set()
let username = null
let prevSynced = null   // null while signed out; a Set of area ids once signed in

const setUsername = (u) => { username = u; listeners.forEach((f) => f(u)) }

async function call(path, opts) {
  const r = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`)
  return body
}

async function pushDiff(ids) {
  if (!prevSynced) return
  const now = new Set(ids), was = prevSynced
  prevSynced = now
  const added = [...now].filter((x) => !was.has(x))
  const removed = [...was].filter((x) => !now.has(x))
  await Promise.all([
    ...added.map((area) => call('/api/saved-areas', { method: 'POST', body: JSON.stringify({ area }) }).catch(() => {})),
    ...removed.map((area) => call(`/api/saved-areas?area=${encodeURIComponent(area)}`, { method: 'DELETE' }).catch(() => {})),
  ])
}
subscribe((ids) => { if (prevSynced) pushDiff(ids) })

async function afterSignIn(name) {
  setUsername(name)
  try {
    const { areas } = await call('/api/saved-areas')
    const merged = [...new Set([...getIds(), ...areas])]
    prevSynced = new Set(areas)
    setAll(merged)
  } catch { prevSynced = new Set(getIds()) }   // couldn't load the server list; still usable locally
}

export async function checkSession() {
  try { const { username: u } = await call('/api/auth/me'); if (u) await afterSignIn(u) } catch { /* signed out */ }
}
export async function signup(user, pass) { const { username: u } = await call('/api/auth/signup', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) }); await afterSignIn(u) }
export async function login(user, pass) { const { username: u } = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) }); await afterSignIn(u) }
export async function logout() { await call('/api/auth/logout', { method: 'POST' }).catch(() => {}); prevSynced = null; setUsername(null) }

export function useAccount() {
  const [v, setV] = useState(username)
  useEffect(() => { listeners.add(setV); return () => listeners.delete(setV) }, [])
  return v
}
