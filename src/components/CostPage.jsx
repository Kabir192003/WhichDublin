import React, { useEffect, useMemo, useState } from 'react'
import { useShortlist } from '../domain/shortlist.js'
import { HOME_TYPES, MODES, rentForHome, hourLimit, grossPay, costRange, travelCost } from '../domain/model.js'
import { WAGE, STUDENT_WORK, BILLS, GROCERIES, PHONE, BER_FACTOR } from '../content/facts.js'
import { CostCard, useCostSettings, fareFor } from './Cost.jsx'
import { Pill, eur, HOW_CHIP, Icon } from './ui.jsx'

const MODE_LABEL = { transit: 'Bus / Luas', bikeshare: 'Dublinbikes', cycle: 'Own bike', walk: 'Walk' }
const KEY = 'settld.cost.area', HOME_KEY = 'settld.cost.home'
const BEDS = [['1', '1 bedroom'], ['2', '2 bedrooms'], ['3', '3 bedrooms'], ['4', '4+ bedrooms']]
/** How a given number of people fills a home: whole rooms each, then pairs sharing. */
function layout(beds, people) {
  const b = Number(beds)
  if (people <= b) return people === 1 ? 'one person' : `${people} people, own rooms`
  const shared = people - b            // people who must double up
  const pairs = Math.min(shared, b)    // rooms shared by two (more than two per room is not assumed)
  return `${b - pairs} own ${b - pairs === 1 ? 'room' : 'rooms'}, ${pairs} shared`
}
const loadHome = () => { try { return { beds: '2', people: 2, ...JSON.parse(localStorage.getItem(HOME_KEY) || '{}') } } catch { return { beds: '2', people: 2 } } }
const num = (v) => (v === '' || v == null ? null : Number(v))

/** The monthly budget for one area and one way of living, with what part-time hours would cover.
 * Every figure comes from the same calculations the area pages use; nothing here is a new estimate. */
export default function CostPage({ data, s, set }) {
  const saved = useShortlist()
  const sorted = useMemo(() => [...data.areas].sort((a, b) => a.label.localeCompare(b.label)), [data])
  const [id, setId] = useState(() => { try { return localStorage.getItem(KEY) } catch { return null } })
  const area = data.areas.find((a) => a.id === id) || data.areas.find((a) => a.id === saved[0]) || null
  useEffect(() => { try { if (id) localStorage.setItem(KEY, id) } catch { /* storage blocked */ } }, [id])

  const [home, setHome] = useState(loadHome)
  useEffect(() => { try { localStorage.setItem(HOME_KEY, JSON.stringify(home)) } catch { /* storage blocked */ } }, [home])
  const maxPeople = Number(home.beds) * 2
  const people = Math.min(Math.max(1, Number(home.people) || 1), maxPeople)
  const rent = area && rentForHome(area, home.beds, s.ptype, people)
  const [c] = useCostSettings()
  const lim = hourLimit(new Date(), STUDENT_WORK)
  const [hours, setHours] = useState(0)
  const [stamp2, setStamp2] = useState(true)
  const cap = stamp2 ? lim.hours : 40
  const h = Math.min(hours, cap)
  const pay = grossPay(h, WAGE.adult)
  const typical = rent ? costRange({ rentShare: rent.perPerson, travel: travelCost(s.mode, { daysPerWeek: Number(c.days) || 0, fare: fareFor(c.card) }), people: rent.people, berFactor: BER_FACTOR[c.ber]?.f ?? null, bills: BILLS, groceries: GROCERIES, phone: PHONE, own: { bills: num(c.bills), food: num(c.food), phone: num(c.phone) } }).typical.total : null
  const left = typical != null ? Math.round(typical - pay.month) : null

  return (
    <>
      <section className="page-hero"><div className="wrap"><h1>Cost of living</h1><p>What a month costs in one area: rent, travel, bills, groceries and phone. Change any figure to your own.</p></div></section>
      <article className="wrap page-body">
        <section className="card" aria-labelledby="cost-setup">
          <h2 id="cost-setup">Where and how you'd live</h2>
          <div className="filters" style={{ border: 0, padding: 0 }}>
            <label className="pill" htmlFor="cost-area"><span className="k">Area</span>
              <select id="cost-area" value={area?.id || ''} onChange={(e) => setId(e.target.value)}>
                {!area && <option value="">Choose an area</option>}
                {saved.length > 0 && <optgroup label="Your shortlist">{saved.map((x) => data.areas.find((a) => a.id === x)).filter(Boolean).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</optgroup>}
                <optgroup label="All areas">{sorted.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</optgroup>
              </select><span className="chev"><Icon name="chev" size={14} stroke={2.2} /></span></label>
            <Pill label="Home size" value={home.beds} onChange={(v) => setHome((h) => ({ ...h, beds: v, people: Math.min(h.people, Number(v) * 2) }))} options={BEDS} />
            <Pill label="People living there" value={people} onChange={(v) => setHome((h) => ({ ...h, people: Number(v) }))} options={Array.from({ length: maxPeople }, (_, i) => [i + 1, String(i + 1)])} />
            <Pill label="Home" value={s.ptype} onChange={(v) => set({ ptype: v })} options={Object.entries(HOME_TYPES)} />
            <Pill label="Travel" value={s.mode} onChange={(v) => set({ mode: v })} options={Object.keys(MODES).map((k) => [k, MODE_LABEL[k]])} />
          </div>
          {!area && <p className="hint" style={{ marginBottom: 0 }}>Pick an area to see its monthly cost. Not sure where yet? <a href="#/areas">Explore areas</a> first.</p>}
          {area && rent && <p className="hint" style={{ marginBottom: 0 }}>{BEDS.find(([k]) => k === home.beds)[1]}, {people} {people === 1 ? 'person' : 'people'} ({layout(home.beds, people)}). The whole home averages {eur(rent.total)}, so your share is {eur(rent.perPerson)}. Bills are split the same way. An average, not a quote. <span className={`chip ${rent.how === 'published' ? 'pub' : rent.how}`}>{HOW_CHIP[rent.how]}</span></p>}
          {area && !rent && <p className="notice-inline">There is no rent figure for this kind of home in {area.name}. Try another home type.</p>}
        </section>

        {area && rent && <>
          <CostCard rentShare={rent.perPerson} rentLow={Math.round(rent.rtbTotal / people)} mode={s.mode} people={people} />

          <section className="fact" aria-labelledby="cost-work">
            <div className="fact-head"><h2 id="cost-work">What part-time work would cover</h2></div>
            <div className="field" style={{ maxWidth: 520 }}>
              <label htmlFor="cost-hours" className="flabel">Hours a week <span className="value-badge num">{h} {h === 1 ? 'hour' : 'hours'}</span></label>
              <input id="cost-hours" type="range" min="0" max="40" step="1" value={h} onChange={(e) => setHours(Number(e.target.value))} />
            </div>
            <label className="check"><input type="checkbox" checked={stamp2} onChange={(e) => setStamp2(e.target.checked)} /> I'm a non-EEA student on Stamp 2 (limit is {lim.hours} hours a week right now)</label>
            {h === 0 ? <p className="hint">Move the slider to see how much of the month a job at minimum wage would pay for.</p> : (
              <table className="rtable" style={{ maxWidth: 520 }}>
                <tbody>
                  <tr><th scope="row">Typical month in {area.name}</th><td className="num">{eur(typical)}</td></tr>
                  <tr><th scope="row">{h} hours a week at {`€${WAGE.adult.toFixed(2)}`}, before tax</th><td className="num">− {eur(pay.month)}</td></tr>
                  <tr><th scope="row"><b>{left > 0 ? 'Still to cover' : 'Left over'}</b></th><td className="num"><b>{eur(Math.abs(left))}</b></td></tr>
                </tbody>
              </table>)}
            <p className="source">Minimum wage for {WAGE.ageNote}, from {WAGE.from}. Pay is before tax and deductions, so take-home will be lower. <a href="#/work">Hour limits and where the jobs are</a></p>
          </section>
          <p className="disclaimer">A planning aid, not financial advice. Rent is an RTB average for {data.sources.rent.asOf}, scaled to new-tenancy level. <a href="#/method">Sources and methods</a></p>
        </>}
      </article>
    </>
  )
}
