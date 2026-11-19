import React, { useState } from 'react'
import { RENTING, RIGHTS } from '../content/facts.js'
import Source from './Source.jsx'
import { Icon, MovingTabs } from './ui.jsx'

const LEVEL = [
  [0, 'b-teal', 'No warning signs ticked', 'Still view it, get a receipt and a written agreement before paying.'],
  [1, 'b-sand', 'Be careful', 'One warning sign is enough to slow down. Don’t send money until it’s resolved.'],
  [2, 'b-coral', 'This looks like a scam', 'Several classic scam signs. Don’t pay. Report the ad, and call Threshold (1800 454 454) or the Gardaí if you have already paid.']
]

export default function Renting() {
  const [ticked, setTicked] = useState({})
  const n = Object.values(ticked).filter(Boolean).length
  const [, badge, title, text] = n === 0 ? LEVEL[0] : n === 1 ? LEVEL[1] : LEVEL[2]
  return (
    <>
      <section className="page-hero"><div className="wrap"><h1>Renting safely</h1><p>Check a listing for scam signs, know your rights as a tenant, and understand digs before you pay anything.</p><MovingTabs page="renting" /></div></section>
      <article className="wrap page-body">
        <section className="card lift" aria-labelledby="chk">
          <h2 id="chk">Is this listing a scam?</h2>
          <p className="hint" style={{ marginTop: -4 }}>Tick anything that’s happening with the place you’re looking at.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {RENTING.scamSigns.map(([k, t]) => (
              <li key={k} style={{ display: 'block' }}><label className="check" style={{ alignItems: 'flex-start', margin: '6px 0' }}><input type="checkbox" checked={!!ticked[k]} onChange={(e) => setTicked({ ...ticked, [k]: e.target.checked })} /> <span>{t}</span></label></li>))}
          </ul>
          <div className="band" style={{ margin: '12px 0 0', padding: 18, background: n === 0 ? 'var(--teal-50)' : n === 1 ? 'var(--sand-50)' : 'var(--coral-50)' }} role="status" aria-live="polite">
            <span className={`badge ${badge}`}><Icon name={n === 0 ? 'check' : 'info'} size={22} /></span>
            <div style={{ flex: 1 }}><h2 style={{ fontSize: 18 }}>{title}</h2><p style={{ color: 'var(--ink2)' }}>{text}</p></div>
          </div>
          <Source sources={RENTING.scamSources} check={RENTING.check} />
        </section>

        <section className="card" aria-labelledby="rights">
          <h2 id="rights">Your rights as a tenant</h2>
          <p className="hint" style={{ marginTop: -4 }}>The main rules from the Residential Tenancies Board (RTB), the state body for renting.</p>
          <h3>First, which kind of let is it?</h3>
          <table className="rtable"><tbody>{RIGHTS.types.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
          <p>Ask your landlord for the RTB registration, or <a href={RIGHTS.register} target="_blank" rel="noreferrer">check the RTB register</a> yourself.</p>
          <div className="grid2" style={{ alignItems: 'start', marginTop: 8 }}>
            <div>
              <h3>Moving out: the notice you give</h3>
              <table className="rtable"><thead><tr><th scope="col">You’ve lived there</th><th scope="col">Notice</th></tr></thead>
                <tbody>{RIGHTS.notice.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td className="num">{v}</td></tr>)}</tbody></table>
              <ul>{RIGHTS.noticeNotes.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div>
              <h3>Rent increases</h3>
              <p>{RIGHTS.rent}</p>
              <h3>Getting your deposit back</h3>
              <p>{RIGHTS.deposit}</p>
            </div>
          </div>
          <h3>If something goes wrong</h3>
          <ol className="checklist" style={{ listStyle: 'decimal', paddingLeft: 20 }}>{RIGHTS.disputes.map(([k, v]) => <li key={k} style={{ display: 'list-item' }}><b>{k}.</b> {v}</li>)}</ol>
          <p>Free, independent advice: Threshold, 1800 454 454.</p>
          <Source sources={RIGHTS.sources} check={RIGHTS.check} note={RIGHTS.read} />
        </section>

        <div className="grid2" style={{ alignItems: 'start' }}>
          <section className="card">
            <h2>The deposit rule</h2>
            <div className="kpi" style={{ background: 'var(--teal-50)', marginBottom: 10 }}><b>2 months max</b><p>1 month deposit + 1 month rent in advance</p></div>
            <p>{RENTING.deposit}</p>
            <p className="hint">{RENTING.depositNote}</p>
            <Source sources={RENTING.depositSources} check={RENTING.check} />
          </section>
          <section className="card">
            <h2>Before you pay anything</h2>
            <ul className="checklist">{RENTING.checks.map((c) => <li key={c}>{c}</li>)}</ul>
          </section>
          <section className="card">
            <h2>Digs: renting a room in someone’s home</h2>
            <p>{RENTING.digs}</p>
            <Source sources={RENTING.digsSources} check={RENTING.check} />
          </section>
          <section className="card">
            <h2>HAP</h2>
            <p>{RENTING.hap}</p>
          </section>
        </div>
        <p className="disclaimer">General information, not legal advice. For your situation, contact Threshold or the RTB.</p>
      </article>
    </>
  )
}
