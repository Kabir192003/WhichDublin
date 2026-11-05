import React from 'react'
import Controls from './Controls.jsx'
import { EircodeBox, Icon } from './ui.jsx'
import { CityLive } from './Live.jsx'

const FEATURES = [
  ['home', 'b-teal', 'Rent for every home', '1 to 4+ beds; apartments, terraced, semi-detached and detached. Each figure says if it is published or estimated.', '#/areas'],
  ['clock', 'b-sky', 'Real journey times', 'Timetabled door-to-door trips at 8am, plus Dublinbikes, cycling and walking.', '#/areas'],
  ['cart', 'b-sand', 'Cheap groceries', 'Walking time to the nearest Lidl, Aldi and Tesco from every area.', '#/areas'],
  ['work', 'b-coral', 'Part-time work', 'Minimum wage, your weekly hour limit, and areas with the most shops and cafes.', '#/work'],
  ['check', 'b-plum', 'Settling in', 'IRP registration, Leap card, bank account and mobile plan, in the right order.', '#/settle']
]

export default function Home({ data, s, set }) {
  const bt = data.sources.rent.backtest?.specific
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="kicker">Built by a student, for students renting in Dublin</p>
            <h1>Find your part of Dublin before you sign a lease.</h1>
            <p className="lead">Rent for every home type, real timetable journeys to your college, the nearest Lidl, Aldi and Tesco, and where the part-time jobs are. Every number says where it came from.</p>
            <EircodeBox />
            <p className="sub">Viewing a place? Enter its Eircode to see the trip to every college, groceries, bikes and jobs nearby.</p>
            <CityLive />
            <div className="figs">
              <div><b className="num">{data.areas.length}</b><span>areas compared</span></div>
              <div><b className="num">{data.campuses.length}</b><span>colleges</span></div>
              <div><b className="num">25</b><span>home sizes and types</span></div>
              <div><b className="num">0</b><span>accounts or cookies</span></div>
            </div>
          </div>
          <section className="setup" aria-labelledby="setup-h">
            <h2 id="setup-h">Find areas that fit you</h2>
            <p className="hint" style={{ margin: 0 }}>Five answers. You can change them any time.</p>
            <Controls data={data} s={s} set={set} />
            <a className="btn block" href="#/areas" style={{ marginTop: 22 }}>Show me areas <Icon name="arrow" size={18} stroke={2} /></a>
          </section>
        </div>
      </section>

      <section className="section wrap" aria-labelledby="feat-h">
        <h2 id="feat-h">Everything you check before renting, in one place</h2>
        <p className="lead">No listings and no ads. Open data you can trace back to its source.</p>
        <div className="tiles">
          {FEATURES.map(([icon, badge, title, text, href]) => (
            <a key={title} className="tile" href={href}><span className={`badge ${badge}`}><Icon name={icon} size={22} stroke={1.9} /></span><b>{title}</b><span>{text}</span></a>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="band">
          <div style={{ flex: '1 1 420px' }}>
            <h2>How sure is each number?</h2>
            <p>Rents are RTB averages for new tenancies. Where the RTB published nothing for a home type, we estimate it from the closest figure it did publish and label it.{bt && ` Tested against ${bt.n} figures the RTB did publish, half of our estimates were within ${bt.medianPct}%.`} <a href="#/method">How we know</a></p>
          </div>
          <div className="tags"><span className="chip pub">Published</span><span className="chip carried">Carried forward</span><span className="chip estimated">Estimated</span></div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap">
          <span>Data: RTB and CSO (CC BY 4.0), National Transport Authority (CC BY 4.0), © OpenStreetMap contributors (ODbL), Wikipedia (CC BY-SA).</span>
          <span>Planning aid only. <a href="https://github.com/Kabir192003/WhichDublin/issues/new" target="_blank" rel="noreferrer">Report a problem</a></span>
        </div>
      </footer>
    </>
  )
}
