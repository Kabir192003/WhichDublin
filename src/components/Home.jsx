import React from 'react'
import Controls from './Controls.jsx'

const Tile = ({ href, title, text }) => (
  <a className="tile" href={href}><h3>{title}</h3><p>{text}</p><span className="go">Open →</span></a>
)

export default function Home({ data, s, set }) {
  return (
    <div className="home">
      <section className="hero">
        <h1>Find where to live in Dublin, near your college.</h1>
        <p className="lead">Compare {data.areas.length} areas on rent, travel time and nearby Lidl, Aldi and Tesco. Every number shows where it comes from.</p>
      </section>

      <section className="setup card" aria-labelledby="setup-h">
        <h2 id="setup-h">Answer five quick questions</h2>
        <Controls data={data} s={s} set={set} numbered />
        <a className="btn big" href={`#/areas`}>Show me areas</a>
      </section>

      <section aria-labelledby="more-h">
        <h2 id="more-h" className="sec">Also here</h2>
        <div className="tiles">
          <Tile href="#/work" title="Part-time work" text="What you can earn at minimum wage, how many hours you may work, and which areas have the most shops, cafes and hotels." />
          <Tile href="#/settle" title="Settling in" text="Immigration registration (IRP), Leap card, opening a bank account and choosing a mobile plan, in order." />
          <Tile href="#/method" title="How the numbers work" text="Sources, dates, and what each confidence label means. Read this before you trust any number." />
        </div>
      </section>
    </div>
  )
}
