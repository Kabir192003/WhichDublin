import React from 'react'
import { RENT_TYPES, MODES } from '../domain/model.js'
import { PRESETS } from '../domain/rank.js'
import { eur } from './ui.jsx'

const Seg = ({ items, value, onPick, label }) => (
  <div className="seg wrap" role="group" aria-label={label}>
    {items.map(([k, text]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onPick(k)}>{text}</button>)}
  </div>
)

/** The five questions. `numbered` shows 1-5 for the start screen. */
export default function Controls({ data, s, set, numbered }) {
  const N = ({ i }) => numbered ? <span className="stepno" aria-hidden="true">{i}</span> : null
  return (
    <div className="controls-grid">
      <div className="q"><label htmlFor="college"><N i={1} />Which college?</label>
        <select id="college" value={s.campus} onChange={(e) => set({ campus: e.target.value })}>
          {data.campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="q"><span className="ql" id="q-type"><N i={2} />Where will you live?</span>
        <Seg label="Where will you live" items={Object.entries(RENT_TYPES).map(([k, v]) => [k, v.label])} value={s.type} onPick={(k) => set({ type: k })} />
        <small>{RENT_TYPES[s.type].hint} The price shown is your share.</small>
      </div>
      <div className="q"><label htmlFor="budget"><N i={3} />Most you can pay a month: <b>{eur(s.budget)}</b></label>
        <input id="budget" type="range" min="300" max="2500" step="25" value={Math.min(Math.max(s.budget, 300), 2500)} onChange={(e) => set({ budget: Number(e.target.value) })} />
        <small>Your share of the rent. Bills and food are extra.</small>
      </div>
      <div className="q"><span className="ql"><N i={4} />How will you get to college?</span>
        <Seg label="How you travel" items={Object.entries(MODES).map(([k, v]) => [k, v.label])} value={s.mode} onPick={(k) => set({ mode: k })} />
      </div>
      <div className="q"><span className="ql"><N i={5} />Sort areas by</span>
        <Seg label="Sort areas by" items={Object.entries(PRESETS).map(([k, v]) => [k, v.label])} value={s.priority} onPick={(k) => set({ priority: k })} />
      </div>
    </div>
  )
}
