import React, { useEffect, useState } from 'react'
import { travelCost, costRange } from '../domain/model.js'
import { BILLS, GROCERIES, PHONE, BER_FACTOR, ASKING_PREMIUM } from '../content/facts.js'
import { eur } from './ui.jsx'
import { Section } from './AreaParts.jsx'
import Source from './Source.jsx'

const KEY = 'wd.cost.v2'
const DEF = { bills: '', food: '', phone: '', days: 5, card: 'student', ber: 'unknown' }
function load() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEF } }
export function useCostSettings() {
  const [c, setC] = useState(load)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* storage blocked */ } }, [c])
  return [c, (p) => setC((x) => ({ ...x, ...p }))]
}
export const fareFor = (card) => (card === 'adult' ? 2 : 1)
const num = (v) => (v === '' || v == null ? null : Number(v))

/** Monthly cost as a range: rent and travel calculated, bills split between sharers, groceries and phone from typical figures. */
export function CostCard({ rentShare, rentLow, mode, people = 1 }) {
  const [c, set] = useCostSettings()
  const days = Number(c.days) || 0
  const travel = { low: travelCost(mode, { daysPerWeek: days, fare: 1 }), typical: travelCost(mode, { daysPerWeek: days, fare: fareFor(c.card) }), high: travelCost(mode, { daysPerWeek: days, fare: 2 }) }
  const rent = { low: Math.min(rentLow ?? rentShare, rentShare), typical: rentShare, high: Math.round(rentShare * (1 + ASKING_PREMIUM)) }
  const r = costRange({ rentShare: rent, travel, people, berFactor: BER_FACTOR[c.ber]?.f ?? null, bills: BILLS, groceries: GROCERIES, phone: PHONE, own: { bills: num(c.bills), food: num(c.food), phone: num(c.phone) } })
  const row = (k, label) => <tr key={k}><th scope="row">{label}</th><td className="num">{eur(r.low.parts[k])}</td><td className="num"><b>{eur(r.typical.parts[k])}</b></td><td className="num">{eur(r.high.parts[k])}</td></tr>
  const field = (k, label, ph) => (
    <label className="field" style={{ gap: 4 }}><span className="hint" style={{ fontWeight: 600, color: 'var(--ink2)' }}>{label}</span>
      <input className="select" style={{ minHeight: 42, fontWeight: 600, width: '100%', minWidth: 0, padding: '0 12px' }} inputMode="numeric" placeholder={ph} value={c[k]} onChange={(e) => set({ [k]: e.target.value.replace(/[^0-9]/g, '').slice(0, 5) })} /></label>)
  return (
    <Section icon="wallet" title="Your monthly cost"
      how={<>
        <p>Rent: typical is your share of the RTB average for new tenancies; low is the RTB's average for existing tenancies; high allows {Math.round(ASKING_PREMIUM * 100)}% for a home advertised today (our assumption). Travel: low is the student fare, high the adult fare, for the same days. Travel is the Dublin 90-minute fare ({c.card === 'adult' ? '€2 adult' : '€1 student or young adult Leap'}) twice a day, {c.days} days a week, without fare caps. Bills are a whole home's electricity, gas and broadband, split between {people} {people === 1 ? 'person' : 'people'}; the energy rating, if you pick it, moves the electricity and gas part. Groceries assume mostly Lidl and Aldi. Phone is a SIM-only plan.</p>
        <p>{BILLS.electricity.note} {BILLS.gas.note} {BILLS.broadband.note} {GROCERIES.note}</p>
        <Source sources={[BILLS.electricity.source, BILLS.gas.source, BILLS.broadband.source, ...GROCERIES.sources]} check="secondary" />
      </>}>
      <div className="kpi" style={{ margin: '4px 0 12px' }}>
        <b className="num">{eur(r.low.total)} – {eur(r.high.total)}</b>
        <p>a month, typically about <strong>{eur(r.typical.total)}</strong>. Rent, travel, bills, food and phone.</p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="rtable">
          <thead><tr><th scope="col"><span className="sr">Cost</span></th><th scope="col">Low</th><th scope="col">Typical</th><th scope="col">High</th></tr></thead>
          <tbody>{row('rent', 'Rent, your share')}{row('travel', 'Travel')}{row('bills', `Bills, your share${people > 1 ? ` (÷${people})` : ''}`)}{row('food', 'Groceries')}{row('phone', 'Phone')}</tbody>
        </table>
      </div>
      <h3 style={{ fontSize: 14, margin: '14px 0 6px' }}>Make it yours</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        <label className="field" style={{ gap: 4 }}><span className="hint" style={{ fontWeight: 600, color: 'var(--ink2)' }}>Energy rating (BER)</span>
          <div className="select" style={{ minHeight: 42, minWidth: 0 }}><select value={c.ber} onChange={(e) => set({ ber: e.target.value })}>{Object.entries(BER_FACTOR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div></label>
        {field('bills', 'Your bills share', `€ ~${r.typical.parts.bills}`)}{field('food', 'Your groceries', `€ ~${GROCERIES.typical}`)}{field('phone', 'Your phone', `€ ~${PHONE.typical}`)}
        {mode === 'transit' && <label className="field" style={{ gap: 4 }}><span className="hint" style={{ fontWeight: 600, color: 'var(--ink2)' }}>Leap card</span>
          <div className="select" style={{ minHeight: 42, minWidth: 0 }}><select value={c.card} onChange={(e) => set({ card: e.target.value })}><option value="student">Student / Young adult</option><option value="adult">Adult</option></select></div></label>}
        {mode === 'transit' && <label className="field" style={{ gap: 4 }}><span className="hint" style={{ fontWeight: 600, color: 'var(--ink2)' }}>Days in college</span>
          <div className="select" style={{ minHeight: 42, minWidth: 0 }}><select value={c.days} onChange={(e) => set({ days: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} a week</option>)}</select></div></label>}
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Leave a box empty to use the typical figure. Your numbers are kept only in this browser. <a href="#/settle">What does the energy rating mean?</a></p>
    </Section>
  )
}
