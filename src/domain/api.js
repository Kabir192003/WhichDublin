/** Calls to our own /api functions (Vercel). On a static-only copy of the site they simply aren't there. */
export async function getJson(path) {
  const r = await fetch(path, { headers: { Accept: 'application/json' } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status })
  return j
}
export async function postJson(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status })
  return j
}
let healthP = null
export const health = () => (healthP ||= getJson('/api/health').catch(() => ({ ok: false })))
export const ago = (iso) => { const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000)); return s < 90 ? `${s} s ago` : `${Math.round(s / 60)} min ago` }
