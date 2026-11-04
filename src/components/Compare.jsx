import React from 'react'
import { RENT_TYPES, MODES, rentPerPerson, commuteFor } from '../domain/model.js'
import { eur, SHORT, CONF } from './ui.jsx'

export default function Compare({ a, b, s, onClose }) {
  const cols = [a, b]
  const best = (vals, low = true) => { const n = vals.map((v) => (typeof v === 'number' ? v : null)); const ok = n.filter((v) => v != null); if (ok.length < 2 || ok[0] === ok[1]) return -1; const m = low ? Math.min(...ok) : Math.max(...ok); return n.indexOf(m) }
  const groups = [
    { label: `Rent, your share a month (${RENT_TYPES[s.type].label.toLowerCase()})`, nums: cols.map((x) => rentPerPerson(x, s.type)?.perPerson ?? null), fmt: (v) => v == null ? 'No figure' : eur(v), low: true },
    { label: `To ${SHORT[s.campus]} (${MODES[s.mode].label.toLowerCase()})`, nums: cols.map((x) => commuteFor(x, s.campus, s.mode)?.minutes ?? null), fmt: (v) => v == null ? 'No journey' : `${v} min`, low: true },
    { label: 'Walk to Lidl or Aldi', nums: cols.map((x) => x.nearestBudgetGroceryMinutes ?? null), fmt: (v) => v == null ? '–' : `${v} min`, low: true }
  ]
  const text = [
    ['Rent confidence', (x) => CONF[x.rent.confidence]],
    ['Nearest Lidl', (x) => x.groceries?.Lidl ? `${x.groceries.Lidl.walkMinutes} min walk` : 'none nearby'],
    ['Nearest Aldi', (x) => x.groceries?.Aldi ? `${x.groceries.Aldi.walkMinutes} min walk` : 'none nearby'],
    ['Nearest Tesco', (x) => x.groceries?.Tesco ? `${x.groceries.Tesco.walkMinutes} min walk` : 'none nearby'],
    ['Nearest stop', (x) => x.transit?.nearestStop ? `${x.transit.nearestStop.name}, ${x.transit.nearestStop.walkMinutes} min` : 'none within 10 min']
  ]
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Compare two areas" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>Compare</h2><button className="btn ghost sm" onClick={onClose}>Close</button></div>
        <table>
          <thead><tr><th scope="col"><span className="sr">Measure</span></th>{cols.map((c) => <th key={c.id} scope="col">{c.label}</th>)}</tr></thead>
          <tbody>
            {groups.map((g) => { const w = best(g.nums, g.low); return <tr key={g.label}><th scope="row">{g.label}</th>{g.nums.map((v, i) => <td key={i} className={w === i ? 'win' : ''}>{g.fmt(v)}{w === i && <small> better</small>}</td>)}</tr> })}
            {text.map(([l, f]) => <tr key={l}><th scope="row">{l}</th>{cols.map((c) => <td key={c.id}>{f(c)}</td>)}</tr>)}
          </tbody>
        </table>
        <p className="source">Same sources and dates as each area page. Rent is an average, travel time is scheduled.</p>
      </div>
    </div>
  )
}
