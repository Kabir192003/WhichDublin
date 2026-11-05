import React, { useMemo, useState } from 'react'
import { WAGE, STUDENT_WORK, JOB_BOARDS } from '../content/facts.js'
import { WORK_CATEGORIES, hourLimit, grossPay, workByArea, workMix, commuteFor } from '../domain/model.js'
import Source from './Source.jsx'
import { Select, SHORT } from './ui.jsx'
const COLOR = { retail: 'var(--teal)', food: 'var(--coral)', hotels: 'var(--sky-700)', leisure: 'var(--sand-700)' }

const eur = (n, d = 0) => `€${n.toLocaleString('en-IE', { minimumFractionDigits: d, maximumFractionDigits: d })}`

export default function Work({ data }) {
  const today = new Date()
  const lim = hourLimit(today, STUDENT_WORK)
  const [stamp2, setStamp2] = useState(true)
  const cap = stamp2 ? lim.hours : 40
  const [hours, setHours] = useState(lim.hours)
  const h = Math.min(hours, cap)
  const pay = grossPay(h, WAGE.adult)
  const [cat, setCat] = useState('retail')
  const [campus, setCampus] = useState('tcd')

  const rows = useMemo(() => workByArea(data.areas, cat), [data, cat])
  const byId = useMemo(() => Object.fromEntries(data.areas.map((a) => [a.id, a])), [data])
  const available = data.areas.some((a) => a.work)

  return (
    <>
    <section className="page-hero"><div className="wrap"><h1>Part-time work</h1><p>What you can earn, how many hours you may work, and which areas have the most places that hire students.</p></div></section>
    <article className="wrap page-body">

      <section className="card lift" aria-labelledby="rules">
        <h2 id="rules">The rules and the pay</h2>
        <div className="grid2">
          <div>
            <div className="kpi" style={{ background: 'var(--teal-50)' }}><b>{eur(WAGE.adult, 2)}</b><p>an hour, minimum wage</p></div>
            <p>National minimum wage for {WAGE.ageNote}, from {WAGE.from}. Younger workers have a lower legal minimum: {WAGE.youth.map((y) => `${y.label} ${eur(WAGE.adult * y.pct / 100, 2)}`).join(', ')}.</p>
          </div>
          <div>
            <div className="kpi" style={{ background: 'var(--coral-50)' }}><b>{lim.hours} hours</b><p>a week, your limit right now</p></div>
            <p>{lim.period === 'holiday' ? `It is a holiday period (${lim.label}), so up to ${STUDENT_WORK.holidayHours} hours.` : `Term time: up to ${STUDENT_WORK.termHours} hours. Up to ${STUDENT_WORK.holidayHours} hours in ${STUDENT_WORK.holidays.map((x) => x.label).join(' and ')}.`}</p>
          </div>
        </div>
        <p>{STUDENT_WORK.applies} {STUDENT_WORK.rule}</p>
        <Source sources={[WAGE.source, ...STUDENT_WORK.sources]} check={WAGE.check} note={<>The official source for work permission is <a href={STUDENT_WORK.official} target="_blank" rel="noreferrer">irishimmigration.ie</a>.</>} />

        <h3>What that earns (before tax)</h3>
        <div className="field" style={{ maxWidth: 560 }}>
          <label htmlFor="hours" className="flabel">Hours you work a week <span className="value-badge num">{h} hours</span></label>
          <input id="hours" type="range" min="4" max="40" step="1" value={h} onChange={(e) => setHours(Number(e.target.value))} />
        </div>
        <label className="check"><input type="checkbox" checked={stamp2} onChange={(e) => { setStamp2(e.target.checked); if (e.target.checked) setHours((x) => Math.min(x, lim.hours)) }} /> I am a non-EEA student on Stamp 2 (capped at {lim.hours} hours now)</label>
        <div className="grid2" style={{ margin: '8px 0' }}><div className="kpi" style={{ background: 'var(--sand-50)' }}><b>{eur(pay.week, 2)}</b><p>a week</p></div><div className="kpi" style={{ background: 'var(--sky-50)' }}><b>{eur(pay.month)}</b><p>a month</p></div></div>
        <p className="hint">At {eur(WAGE.adult, 2)} an hour, before tax. Tax, USC and PRSI reduce this; tips and overtime are not included.</p>
        {!stamp2 && h > 20 && <p className="muted">Check your college timetable. Full-time study and long hours do not mix well.</p>}
      </section>

      <section className="card" aria-labelledby="areas">
        <h2 id="areas">Where the work is</h2>
        {!available ? <p className="notice-inline">Employer data is still loading in this build.</p> : <>
          <p>We counted places in OpenStreetMap that could hire a student within about 1 km of each area. More places means more chances to be hired and a shorter trip to work. <b>It does not mean there are vacancies today.</b> Use the job boards below for live jobs.</p>
          <div className="work-controls">
            <div className="field">
              <span className="flabel" id="kind">Kind of work</span>
              <div className="choices" role="group" aria-labelledby="kind" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
                {Object.entries(WORK_CATEGORIES).map(([k, v]) => <button key={k} type="button" className="choice" aria-pressed={cat === k} onClick={() => setCat(k)}>{v.label}</button>)}
              </div>
              <span className="hint">{WORK_CATEGORIES[cat].hint}</span>
            </div>
            <Select id="work-college" label="Show the journey to" icon="cap" value={campus} onChange={setCampus} options={data.campuses.map((c) => [c.id, c.name])} />
          </div>
          <table className="rtable work-table">
            <caption className="sr">Areas by number of {WORK_CATEGORIES[cat].label.toLowerCase()} places within 1 km</caption>
            <thead><tr><th scope="col">Area</th><th scope="col">Places within 1 km</th><th scope="col">To {SHORT[campus]} at 8am</th></tr></thead>
            <tbody>
              {rows.slice(0, 25).map((r) => {
                const a = byId[r.id], mix = workMix(a, data.areas), c = commuteFor(a, campus, 'transit')
                return (
                  <tr key={r.id}>
                    <th scope="row"><b>{a.label}</b>{mix?.top && mix.top !== cat && <span className="chip" style={{ marginLeft: 8 }}>also good for {WORK_CATEGORIES[mix.top].label.toLowerCase()}</span>}</th>
                    <td><span className="hbar" style={{ padding: 0 }}><span className="track"><span className="fill" style={{ width: `${Math.max(3, r.share * 100)}%`, background: COLOR[cat] }} /></span><span className="n num">{r.capped ? `${r.n}+` : r.n}</span></span></td>
                    <td className="num">{c ? <b>{c.minutes} min</b> : '–'}</td>
                  </tr>)
              })}
            </tbody>
          </table>
          <p className="source">Top 25 shown. A "+" means the lookup hit its limit of 40 for at least one place type, so the real count is higher. Source: {data.sources.employers.name}, fetched {data.sources.employers.fetched}, {data.sources.employers.licence}. {data.sources.employers.note}</p>
        </>}
      </section>

      <section className="card">
        <h2>Find live jobs</h2>
        <ul>{JOB_BOARDS.map((b) => <li key={b.name}>{b.url ? <a href={b.url} target="_blank" rel="noreferrer">{b.name}</a> : b.name}</li>)}</ul>
        <p className="muted">Walk in with a CV for shops and cafes, and ask your students' union and careers service about campus jobs. Which Dublin does not list vacancies and has no relationship with any employer.</p>
      </section>
    </article>
    </>
  )
}
