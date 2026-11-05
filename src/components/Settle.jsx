import React from 'react'
import { IRP, LEAP, BANKS, BANK_DOCS, BANK_SOURCES, BANK_CHECK, MOBILE, BER } from '../content/facts.js'
import Source from './Source.jsx'

const BER_COLORS = ['#00A651','#19B459','#4CB848','#8CC63F','#B9D532','#E3E01B','#FFF200','#FCD20F','#F8B80F','#F59E1B','#F18A21','#EE6B23','#EA4E25','#E33A26','#D52027']
const go = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
const STEPS = [
  ['irp', 'Register with immigration', 'Book an appointment as soon as you land. Slots fill up.', 'Within 90 days'],
  ['leap', 'Get a Leap card', 'Half-price travel on buses, Luas and trains.', 'First week'],
  ['bank', 'Open a bank account', 'Needed for rent and wages.', 'First weeks'],
  ['mobile', 'Choose a mobile plan', 'Sort a SIM or eSIM early so you can book things.', 'Day one'],
  ['ber', 'Check the energy rating', 'A1 to G on every rental ad. It decides how much you pay to stay warm.', 'When viewing']
]
const Toc = () => (
  <ol className="steps" aria-label="Your checklist">
    {STEPS.map(([id, title, why, when], i) => (
      <li key={id}><a href={`#${id}`} onClick={go(id)}><span className="stepno">{i + 1}</span><span><b>{title}</b><small>{why}</small></span><em>{when}</em></a></li>))}
  </ol>
)

export default function Settle() {
  return (
    <>
    <section className="page-hero"><div className="wrap"><h1>Settling in</h1><p>What to sort out after you land, in a sensible order. Each section says where the information comes from and what we could not confirm.</p></div></section>
    <article className="wrap page-body">
      <div className="card lift"><h2>Your first weeks</h2><Toc /></div>

      <section className="card" id="irp" aria-labelledby="h-irp">
        <h2 id="h-irp">1. Register with immigration (IRP)</h2>
        <p>If you came from outside the EU/EEA to study for more than 90 days, you must register for an Irish Residence Permit within <b>{IRP.deadline}</b>. The fee is <b>€{IRP.fee}</b>.</p>
        <h3>How to book and register</h3>
        <ol>{IRP.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <p><b>Where in Dublin:</b> {IRP.where}.</p>
        <p><a className="btn" href="https://www.irishimmigration.ie/registering-your-immigration-permission/" target="_blank" rel="noreferrer">Open the official booking page</a></p>
        <h3>Documents people are usually asked for</h3>
        <ul className="checklist">{IRP.docs.map((d) => <li key={d}>{d}</li>)}</ul>
        <p className="muted">{IRP.docsNote}</p>
        <Source sources={IRP.sources} check={IRP.check} />
      </section>

      <section className="card" id="leap" aria-labelledby="h-leap">
        <h2 id="h-leap">2. Get a Leap card</h2>
        <p>The Leap card is the pre-paid card for Dublin Bus, Luas, DART and many commuter trains. A student or young adult card halves most fares.</p>
        <table>
          <caption className="sr">Leap card types and the Dublin 90-minute fare</caption>
          <thead><tr><th scope="col">Card</th><th scope="col">Who</th><th scope="col">90-minute fare</th></tr></thead>
          <tbody>{LEAP.cards.map((c) => <tr key={c.name}><th scope="row">{c.name}</th><td>{c.who}</td><td><b>€{c.fare.toFixed(2)}</b></td></tr>)}</tbody>
        </table>
        <p>{LEAP.fareNote}</p>
        <p className="muted">{LEAP.notConfirmed}</p>
        <Source sources={LEAP.sources} check={LEAP.check} />
      </section>

      <section className="card" id="bank" aria-labelledby="h-bank">
        <h2 id="h-bank">3. Open a bank account</h2>
        <p>Landlords and employers usually want an Irish IBAN. The common route is an Irish student account plus a digital account for daily spending.</p>
        <h3>What you usually need</h3>
        <ul>{BANK_DOCS.map((d) => <li key={d}>{d}</li>)}</ul>
        <div className="cards">{BANKS.map((b) => (
          <div className="mini" key={b.name}><h4>{b.name}</h4><p><b>{b.product}</b></p><p>{b.note}</p><a href={b.url} target="_blank" rel="noreferrer">{b.name} site</a></div>))}</div>
        <p className="muted">We do not show account fees: we could not confirm current figures from the banks' own pages.</p>
        <Source sources={BANK_SOURCES} check={BANK_CHECK} />
      </section>

      <section className="card" id="mobile" aria-labelledby="h-mobile">
        <h2 id="h-mobile">4. Get a mobile plan</h2>
        <div className="cards">{MOBILE.networks.map((n) => <div className="mini" key={n.name}><h4>{n.name}</h4><p>{n.network}</p><a href={n.url} target="_blank" rel="noreferrer">See current plans</a></div>)}</div>
        <ul>{MOBILE.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        <p className="muted">{MOBILE.notConfirmed}</p>
        <Source sources={MOBILE.sources} check={MOBILE.check} />
      </section>
      <section className="card" id="ber" aria-labelledby="h-ber">
        <h2 id="h-ber">5. Check the energy rating (BER)</h2>
        <p>{BER.intro}</p>
        <div className="ber-scale" role="img" aria-label="BER scale from A1, the most efficient, to G, the least efficient">
          {BER.scale.map((b, i) => <span key={b} style={{ background: BER_COLORS[i], color: i > 5 && i < 9 ? '#10212B' : '#fff', width: `${48 + i * 3.4}%` }}>{b}</span>)}
        </div>
        <p className="hint" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Lower energy use, lower bills</span><span>Higher energy use, higher bills</span></p>
        <h3>What it means for you</h3>
        <ul>{BER.what.map((t) => <li key={t}>{t}</li>)}</ul>
        <h3>When you view a place</h3>
        <ul className="checklist">{BER.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        <p>Area pages include a monthly cost estimate where you can pick the rating to see how it moves your bills.</p>
        <Source sources={BER.sources} check={BER.check} note="SEAI revised the band thresholds recently, so we don't quote exact kWh figures per band; the order A1 to G is what matters." />
      </section>

      <p className="disclaimer">General information, not legal or financial advice. Rules and prices change: confirm with the official source before you act.</p>
    </article>
    </>
  )
}
