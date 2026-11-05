import React from 'react'
import { RENT_TYPES, HOME_TYPES, MODES } from '../domain/model.js'
import { eur, Icon, Select } from './ui.jsx'

const MODE_ICON = { transit: 'bus', bikeshare: 'bike', cycle: 'bike', walk: 'walk' }
const MODE_SHORT = { transit: 'Bus / Luas', bikeshare: 'Dublinbikes', cycle: 'Own bike', walk: 'Walk' }

export default function Controls({ data, s, set }) {
  return (
    <div className="stack">
      <Select id="college" label="Your college" icon="cap" value={s.campus} onChange={(v) => set({ campus: v })} options={data.campuses.map((c) => [c.id, c.name])} />

      <div className="field">
        <span className="flabel" id="lv">How you'll live</span>
        <div className="choices" role="group" aria-labelledby="lv">
          {Object.entries(RENT_TYPES).map(([k, v]) => <button key={k} type="button" className="choice" aria-pressed={s.type === k} onClick={() => set({ type: k })}>{v.label}</button>)}
        </div>
      </div>

      <Select id="ptype" label="Type of home" icon="home" value={s.ptype} onChange={(v) => set({ ptype: v })} options={Object.entries(HOME_TYPES)} />

      <div className="field">
        <label htmlFor="budget" className="flabel">Most you can pay, your share <span className="value-badge num">{eur(s.budget)} / month</span></label>
        <input id="budget" type="range" min="300" max="3000" step="25" value={Math.min(Math.max(s.budget, 300), 3000)} onChange={(e) => set({ budget: Number(e.target.value) })} />
      </div>

      <div className="field">
        <span className="flabel" id="tr">Getting to college</span>
        <div className="choices" role="group" aria-labelledby="tr" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
          {Object.keys(MODES).map((k) => <button key={k} type="button" className="choice icon" aria-pressed={s.mode === k} onClick={() => set({ mode: k })}><Icon name={MODE_ICON[k]} size={22} />{MODE_SHORT[k]}</button>)}
        </div>
      </div>
    </div>
  )
}
