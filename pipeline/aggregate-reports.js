// Aggregates student rent reports (GitHub issues labelled "rent-report") into public/data/reports.json.
// Publishes a median only when an area/room type has at least MIN reports; never publishes individual reports.
import fs from 'node:fs'
const MIN = 5
const repo = process.env.GITHUB_REPOSITORY || 'Kabir192003/WhichDublin'
const token = process.env.GITHUB_TOKEN
const areas = JSON.parse(fs.readFileSync('public/data/areas.json', 'utf8')).areas
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const byName = new Map(areas.flatMap((a) => [[norm(a.label), a.id], [norm(a.name), a.id]]))

export function parse(body) {
  const f = {}
  for (const m of body.matchAll(/### (.+?)\n+([\s\S]*?)(?=\n### |$)/g)) f[m[1].trim()] = m[2].trim()
  const rent = Number(String(f['Your rent per month (euro)'] || '').replace(/[^0-9.]/g, ''))
  const id = byName.get(norm(f.Area || '')) || null
  const since = /(\d{1,2})\s*\/\s*(\d{4})/.exec(f['When did this rent start? (month and year)'] || '')
  return { id, room: f['What you rent'] || null, rent, bills: f['Are bills included?'] || null, since: since ? `${since[2]}-${since[1].padStart(2, '0')}` : null, consent: /\[x\]/i.test(f.Consent || '') }
}
export function aggregate(reports, minN = MIN) {
  const groups = {}
  for (const r of reports) {
    if (!r.id || !r.room || !r.consent || !(r.rent >= 250 && r.rent <= 4000)) continue
    const k = `${r.id}|${r.room}`; (groups[k] ||= []).push(r.rent)
  }
  const out = {}
  for (const [k, v] of Object.entries(groups)) {
    const [id, room] = k.split('|'); v.sort((a, b) => a - b)
    const median = v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
    ;(out[id] ||= {})[room] = v.length >= minN ? { n: v.length, median: Math.round(median) } : { n: v.length }
  }
  return out
}

if (process.argv[1] && process.argv[1].endsWith('aggregate-reports.js')) {
  const all = []
  for (let page = 1; page < 50; page++) {
    const r = await fetch(`https://api.github.com/repos/${repo}/issues?labels=rent-report&state=all&per_page=100&page=${page}`, { headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
    if (!r.ok) throw new Error(`GitHub API ${r.status}`)
    const items = await r.json(); if (!items.length) break
    for (const i of items) if (!i.pull_request && !(i.labels || []).some((l) => l.name === 'invalid')) all.push(parse(i.body || ''))
  }
  const areasOut = aggregate(all)
  fs.writeFileSync('public/data/reports.json', JSON.stringify({ updated: new Date().toISOString().slice(0, 10), minReports: MIN, total: all.length, areas: areasOut }))
  console.log('reports', all.length, 'areas', Object.keys(areasOut).length)
}
