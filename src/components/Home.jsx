import React from 'react'
import Controls from './Controls.jsx'
import { EircodeBox, Icon } from './ui.jsx'
import { CityLive } from './Live.jsx'

// The three things someone moving to Dublin needs to work out, and where each is answered.
const QUESTIONS = [
  ['Where should I live?', 'Rank areas by rent and commute for your college, or browse all of them on the map.',
    [['#/areas', 'Explore areas'], ['#/shortlist', 'Compare your shortlist']]],
  ['What will it cost?', 'A monthly budget for any area: rent share, travel, bills, groceries and phone.',
    [['#/cost', 'Cost of living'], ['#/work', 'What part-time work pays']]],
  ['What will daily life be like?', 'Buses, Luas and trains from any stop, and what to sort out in your first weeks.',
    [['#/stop', 'Commute and live departures'], ['#/settle', 'Moving to Dublin checklist'], ['#/renting', 'Renting safely']]]
]

export default function Home({ data, s, set }) {
  const bt = data.sources.rent.backtest?.specific
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1>Decide where to live in Dublin.</h1>
            <p className="lead">Compare {data.areas.length} areas by rent, commute and everyday costs. Every figure comes from public data and shows its source.</p>
            <EircodeBox />
            <p className="sub">Viewing a place? Enter its Eircode to see the trip to every college, and the shops and stops nearby.</p>
            <ul className="hero-facts">
              <li><Icon name="check" size={16} /><span><b>{data.areas.length}</b> areas and <b>{data.campuses.length}</b> colleges</span></li>
              <li><Icon name="check" size={16} /><span>Rents from the RTB, journeys from official timetables</span></li>
              <li><Icon name="check" size={16} /><span>No sign-up needed, no ads, no listings</span></li>
            </ul>
            <CityLive />
          </div>
          <section className="setup" aria-labelledby="setup-h">
            <h2 id="setup-h">Find areas that fit you</h2>
            <p className="hint" style={{ margin: 0 }}>Five choices. You can change them at any point.</p>
            <Controls data={data} s={s} set={set} />
            <a className="btn block" href="#/areas" style={{ marginTop: 22 }}>Show matching areas <Icon name="arrow" size={18} stroke={2} /></a>
          </section>
        </div>
      </section>

      <section className="section wrap" aria-labelledby="q-h">
        <h2 id="q-h">Three questions, answered in order</h2>
        <p className="lead">Most people piece this together from listings, maps and group chats. Here it is in one place.</p>
        <div className="questions">
          {QUESTIONS.map(([title, text, links], i) => (
            <div className="question" key={title}>
              <span className="q-no">Step {i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <ul>{links.map(([href, label]) => <li key={href}><a href={href}>{label}<Icon name="arrow" size={14} stroke={2} /></a></li>)}</ul>
            </div>))}
        </div>
      </section>

      <section className="wrap">
        <div className="band">
          <div style={{ flex: '1 1 420px' }}>
            <h2>How sure is each number?</h2>
            <p>Rents start from RTB averages. Where the RTB published nothing for a home type, we estimate from the closest figure it did publish and label it.{bt && ` Tested against ${bt.n} published figures, half of our estimates were within ${bt.medianPct}%.`} <a href="#/method">Sources and methods</a></p>
          </div>
          <div className="tags"><span className="chip pub">Published</span><span className="chip carried">Carried forward</span><span className="chip estimated">Estimated</span></div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap">
          <span>Settld is a planning aid built by a student, for people renting in Dublin. Data: RTB and CSO, National Transport Authority, © OpenStreetMap contributors, Wikipedia.</span>
          <nav aria-label="Footer"><a href="#/method">Sources and methods</a><a href="https://github.com/Kabir192003/WhichDublin/issues/new" target="_blank" rel="noreferrer">Report a problem</a></nav>
        </div>
      </footer>
    </>
  )
}
