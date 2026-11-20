import React, { useMemo } from 'react'
import { RENT_TYPES, HOME_TYPES, MODES, isShared, sharers, roomsText, buildRows } from '../domain/model.js'
import { eur, Icon, Select } from './ui.jsx'

const MODE_ICON = { transit: 'bus', bikeshare: 'bike', cycle: 'bike', walk: 'walk' }
const MODE_SHORT = { transit: 'Bus / Luas', bikeshare: 'Dublinbikes', cycle: 'Own bike', walk: 'Walk' }

export default function Controls({ data, s, set }) {
  const shared = isShared(s.type)
  return (
    <div className="stack">
      <Select id="college" label="Your college" icon="cap" value={s.campus} onChange={(v) => set({ campus: v })} options={data.campuses.map((c) => [c.id, c.name])} />

      <Living s={s} set={set} />

      <Select id="ptype" label="Type of home" icon="home" value={s.ptype} onChange={(v) => set({ ptype: v })} options={Object.entries(HOME_TYPES)} />

      <div className="field">
        <label htmlFor="budget" className="flabel">{shared ? 'Most you can pay, your share' : 'Most you can pay for the whole rent'} <span className="value-badge num">{eur(s.budget)} / month</span></label>
        <input id="budget" type="range" min="300" max="3000" step="25" value={Math.min(Math.max(s.budget, 300), 3000)} onChange={(e) => set({ budget: Number(e.target.value) })} />
        <FitCount data={data} s={s} set={set} />
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

const WHOLE = ['own1', 'own2', 'own3'], SHARE = ['share2', 'share3', 'share4']

/** How you'll live: share a home (choose its size, then how many split the rent) or have a whole home. */
function Living({ s, set }) {
  const shared = isShared(s.type), t = RENT_TYPES[s.type], beds = Number(t.bed), n = sharers(s.type, s.people)
  const pick = (type) => set({ type, people: RENT_TYPES[type].people })
  return (
    <div className="field living" role="group" aria-labelledby="lv">
      <span className="flabel" id="lv">How you’ll live</span>
      <div className="seg" role="radiogroup" aria-label="Share or whole home">
        <button type="button" role="radio" aria-checked={shared} onClick={() => !shared && pick('share' + Math.max(2, beds))}><Icon name="user" size={16} />Share a home</button>
        <button type="button" role="radio" aria-checked={!shared} onClick={() => shared && pick('own' + Math.min(3, beds))}><Icon name="home" size={16} />Whole home</button>
      </div>

      <span className="sub" id="beds">{shared ? 'Home size' : 'Size'}</span>
      <div className="choices three" role="group" aria-labelledby="beds">
        {(shared ? SHARE : WHOLE).map((k) => <button key={k} type="button" className="choice" aria-pressed={s.type === k} onClick={() => pick(k)}>{RENT_TYPES[k].bed}-bed</button>)}
      </div>

      {shared && <>
        <span className="sub" id="ppl">People sharing the rent</span>
        <div className="stepper" role="group" aria-labelledby="ppl">
          <button type="button" onClick={() => set({ people: n - 1 })} disabled={n <= 2} aria-label="One fewer person">−</button>
          <output aria-live="polite"><b className="num">{n}</b>&nbsp;people</output>
          <button type="button" onClick={() => set({ people: n + 1 })} disabled={n >= beds * 2} aria-label="One more person">+</button>
        </div>
      </>}

      <p className="living-sum" aria-live="polite">
        <Icon name={shared ? 'user' : 'home'} size={18} />
        {shared
          ? <span>You + {n - 1} {n - 1 === 1 ? 'other' : 'others'} in a {beds}-bed · {roomsText(beds, n)} · <b>your share is 1/{n} of the rent</b></span>
          : <span>A whole {beds}-bed home · <b>you pay all of the rent</b></span>}
      </p>
    </div>
  )
}

/** How many areas fit right now, and a way forward when none do. */
function FitCount({ data, s, set }) {
  const rows = useMemo(() => buildRows(data.areas, s).filter((r) => r.rent != null && r.commute != null), [data, s.campus, s.type, s.mode, s.ptype, s.people])
  const fit = rows.filter((r) => r.rent <= s.budget).length
  if (!rows.length) return null
  if (fit) return <p className="fit ok" aria-live="polite"><Icon name="check" size={16} /> <b>{fit}</b> {fit === 1 ? 'area fits' : 'areas fit'} this budget</p>
  const cheapest = rows.reduce((a, b) => (b.rent < a.rent ? b : a)), area = data.areas.find((a) => a.id === cheapest.id)
  const shared = isShared(s.type), n = sharers(s.type, s.people), beds = Number(RENT_TYPES[s.type].bed)
  return (
    <div className="fit none" aria-live="polite">
      <p>No area fits {eur(s.budget)} yet. The cheapest is <b>{eur(cheapest.rent)}</b> in {area.name}.</p>
      <div className="fit-fix">
        <button type="button" className="btn ghost sm" onClick={() => set({ budget: Math.ceil(cheapest.rent / 25) * 25 })}>Set budget to {eur(Math.ceil(cheapest.rent / 25) * 25)}</button>
        {shared && n < beds * 2 && <button type="button" className="btn ghost sm" onClick={() => set({ people: n + 1 })}>Add a sharer</button>}
        {!shared && <button type="button" className="btn ghost sm" onClick={() => set({ type: 'share' + Math.max(2, beds), people: Math.max(2, beds) })}>Try sharing</button>}
      </div>
    </div>
  )
}
