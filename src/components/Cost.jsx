import React, { useEffect, useState } from 'react'
import { travelCost, monthlyCost } from '../domain/model.js'
import { eur } from './ui.jsx'
import { Section } from './AreaParts.jsx'

const KEY = 'wd.cost.v1'
const DEF = { bills: '', food: '', phone: '', days: 5, card: 'student' }
function load() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEF } }
export function useCostSettings() {
  const [c, setC] = useState(load)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* storage blocked */ } }, [c])
  return [c, (p) => setC((x) => ({ ...x, ...p }))]
}
export const fareFor = (card) => (card === 'adult' ? 2 : 1)

/** Monthly cost: rent share and travel are calculated; bills, food and phone are the user's own numbers. */
export function CostCard({ rentShare, mode }) {
  const [c, set] = useCostSettings()
  const travel = travelCost(mode, { daysPerWeek: Number(c.days) || 0, fare: fareFor(c.card) })
  const m = monthlyCost({ rentShare, travel, bills: Number(c.bills) || 0, food: Number(c.food) || 0, phone: Number(c.phone) || 0 })
  const num = (k, label, ph) => (
    <label className="field" style={{ gap: 4 }}><span className="hint" style={{ fontWeight: 600, color: 'var(--ink2)' }}>{label}</span>
      <input className="select" style={{ minHeight: 42, fontWeight: 600, width: "100%", minWidth: 0, padding: "0 12px" }} inputMode="numeric" placeholder={ph} value={c[k]} onChange={(e) => set({ [k]: e.target.value.replace(/[^0-9]/g, '').slice(0, 5) })} /></label>)
  return (
    <Section icon="info" badge="b-plum" title="Your monthly cost"
      how={<p>Rent is your share of the average. Travel is the Dublin 90-minute fare ({c.card === 'adult' ? '€2 adult' : '€1 student or young adult Leap'}) twice a day, {c.days} days a week, without fare caps (we could not confirm the current caps, which may lower this). Bills, food and phone are your own estimates: we do not guess them. They are saved only in this browser.</p>}>
      <div className="kpi" style={{ background: 'var(--plum-50)', margin: '4px 0 12px' }}><b>{eur(m.total)}</b><p>a month: rent {eur(m.parts.rent)} + travel {eur(travel)}{m.parts.bills || m.parts.food || m.parts.phone ? ` + your ${eur(m.parts.bills + m.parts.food + m.parts.phone)}` : ''}</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
        {num('bills', 'Bills, your share', '€ e.g. 70')}{num('food', 'Food', '€ your guess')}{num('phone', 'Phone', '€')}
        {mode === 'transit' && <label className="field" style={{ gap: 4 }}><span className="hint" style={{ fontWeight: 600, color: 'var(--ink2)' }}>Leap card</span>
          <div className="select" style={{ minHeight: 42, minWidth: 0 }}><select value={c.card} onChange={(e) => set({ card: e.target.value })}><option value="student">Student / Young adult</option><option value="adult">Adult</option></select></div></label>}
        {mode === 'transit' && <label className="field" style={{ gap: 4 }}><span className="hint" style={{ fontWeight: 600, color: 'var(--ink2)' }}>Days in college</span>
          <div className="select" style={{ minHeight: 42, minWidth: 0 }}><select value={c.days} onChange={(e) => set({ days: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} a week</option>)}</select></div></label>}
      </div>
    </Section>
  )
}
