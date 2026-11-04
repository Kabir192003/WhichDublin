import React from 'react'
import { RENT_TYPES, MODES, WORK_CATEGORIES, rentPerPerson, commuteFor } from '../domain/model.js'
import { eur, SHORT, Conf } from './ui.jsx'

const mapsLink = (a, campus, mode) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lon}&destination=${campus.lat},${campus.lon}&travelmode=${mode === 'transit' ? 'transit' : mode === 'walk' ? 'walking' : 'bicycling'}`

function Card({ title, conf, headline, children, source, how }) {
  return (
    <section className="fact">
      <div className="fact-head"><h3>{title}</h3><Conf level={conf} /></div>
      {headline && <p className="big">{headline}</p>}
      {children}
      {how && <details className="how"><summary>How this is worked out</summary><div>{how}</div></details>}
      {source && <p className="source">Source: {source}</p>}
    </section>
  )
}

export default function Detail({ area, s, campus, row, rank, data, onBack, inCompare, onCompare }) {
  const rent = rentPerPerson(area, s.type), commute = commuteFor(area, s.campus, s.mode)
  const src = data.sources, college = SHORT[s.campus]
  const summary = [rent && `${eur(rent.perPerson)} a month`, commute && `${commute.minutes} min to ${college}`, area.nearestBudgetGroceryMinutes != null && `Lidl or Aldi ${area.nearestBudgetGroceryMinutes} min walk`].filter(Boolean).join(' · ')
  return (
    <article className="detail" aria-label={area.label}>
      <button className="link back" onClick={onBack}>← Back to all areas</button>
      <h2>{area.label}</h2>
      <p className="verdict">{rank ? <>Ranked <b>{rank.rank}</b> for your choices. </> : <>Not ranked: outside your budget or missing data. </>}{summary}</p>
      {area.about && <p className="about">{area.about.text} <a href={area.about.url} target="_blank" rel="noreferrer">Wikipedia</a></p>}
      <div className="actions top">
        <button className="btn sm" onClick={onCompare}>{inCompare ? '✓ In compare list' : '+ Add to compare'}</button>
        <a className="btn ghost sm" href={mapsLink(area, campus, s.mode)} target="_blank" rel="noreferrer">Live route in Google Maps</a>
      </div>

      <Card title="Rent" conf={area.rent.confidence}
        headline={rent ? <><b>{eur(rent.perPerson)}</b> a month, your share</> : <>No figure published</>}
        source={`RTB via CSO, ${src.rent.asOf}, ${src.rent.licence}`}
        how={rent ? <p>{RENT_TYPES[s.type].label}: the average rent for this size of home here is {eur(rent.total)} {rent.people > 1 ? `a month, split between ${rent.people} people` : 'a month for the whole home'}. It averages new tenancies registered in {src.rent.asOf} and uses {area.rent.populatedCells} size and type groups that had data. A year earlier the all-homes average was {area.rent.prevAll ? eur(area.rent.prevAll) : 'not published'}. Real rooms differ: a larger bedroom costs more.</p> : <p>The RTB has not published an average for this size of home in this area. We do not estimate it.</p>}>
        {rent && <p>{RENT_TYPES[s.type].label}: average for new tenancies, not a live listing.</p>}
      </Card>

      <Card title={`Getting to ${college}`} conf={commute?.confidence}
        headline={commute ? <><b>{commute.minutes} min</b> {s.mode === 'transit' ? 'by public transport' : MODES[s.mode].label.toLowerCase()}</> : <>No usable journey</>}
        source={s.mode === 'transit' ? `NTA timetables, ${src.transit.serviceDate}, ${src.transit.licence}` : s.mode === 'bikeshare' ? `${src.bikes.name}, ${src.bikes.licence}` : 'Distance between OpenStreetMap locations'}
        how={commute ? (commute.kind === 'scheduled'
          ? <p>Middle value of 13 timetabled trips leaving between 07:30 and 08:30 (fastest {commute.best} min, slowest {commute.worst} min), door to door. Includes {commute.walkMinutes} min walking and {commute.changes} change{commute.changes === 1 ? '' : 's'}. These are scheduled times: real buses can run late.</p>
          : <p>{commute.detail}. An estimate, not a routed journey. Walking is 1.25 m/s, riding is 15 km/h, and distances use a 1.3 detour factor.</p>)
          : <p>{s.mode === 'bikeshare' ? 'No Dublinbikes dock within 1.5 km of home or college.' : 'No bus, tram or train journey was found within walking distance of both ends.'}</p>}>
        {commute && (commute.kind === 'scheduled'
          ? <p>Fastest {commute.best} min, slowest {commute.worst} min · {commute.changes} change{commute.changes === 1 ? '' : 's'} · {commute.walkMinutes} min walking. Scheduled, not live.</p>
          : <p>{commute.detail}.</p>)}
      </Card>

      <Card title="Cheap supermarkets" conf="medium" source={`${src.groceries.name}, fetched ${src.groceries.fetched}, ${src.groceries.licence}`} how={<p>Walk time is straight-line distance to the nearest store of each chain, times 1.3 for streets, at 1.25 m/s. {src.groceries.note}</p>}>
        <ul className="stores">{['Lidl', 'Aldi', 'Tesco'].map((b) => { const g = area.groceries?.[b]; return (
          <li key={b}><b>{b}</b> {g ? <>{g.walkMinutes} min walk <small>({g.metres >= 1000 ? (g.metres / 1000).toFixed(1) + ' km' : g.metres + ' m'}){g.within1km > 1 ? `, ${g.within1km} within 1 km` : ''}</small></> : <span className="muted">none found nearby</span>}</li>) })}</ul>
      </Card>

      {area.nearestDock && <Card title="Dublinbikes" source={`${src.bikes.name}, fetched ${src.bikes.fetched}, ${src.bikes.licence}`} how={<p>{src.bikes.note}</p>}>
        <p>Nearest dock to home: <b>{area.nearestDock.name}</b>, {area.nearestDock.walkMinutes} min walk.</p>
        <p>Nearest to {college}: {campus.dock ? <><b>{campus.dock.name}</b>, {campus.dock.walkMinutes} min walk.</> : 'none within 1.5 km.'}</p>
      </Card>}

      {area.work && <Card title="Places that hire students nearby" source={`${src.employers.name}, fetched ${src.employers.fetched}, ${src.employers.licence}`} how={<p>{src.employers.note}</p>}>
        <ul className="stores">{Object.entries(WORK_CATEGORIES).map(([k, v]) => <li key={k}><b>{v.label}</b> {area.work[k].capped ? `${area.work[k].n}+` : area.work[k].n} <small>within about 1 km</small></li>)}</ul>
        <p><a href="#/work">Part-time work: pay, hours and where to look</a></p>
      </Card>}

      <Card title="Buses, Luas and trains near home" source={`${src.transit.name}, ${src.transit.licence}`} how={<p>Routes with a stop within a 10 minute walk.</p>}>
        {area.transit?.nearestStop ? <p>Nearest stop: <b>{area.transit.nearestStop.name}</b>, {area.transit.nearestStop.walkMinutes} min walk.</p> : <p className="muted">No stop within a 10 minute walk.</p>}
        {area.transit?.routes && <p className="routes">{[['Bus', area.transit.routes.bus], ['Luas', area.transit.routes.tram], ['Rail', area.transit.routes.rail]].filter(([, r]) => r?.length).map(([l, r]) => <span key={l}><b>{l}</b> {r.join(', ')}</span>)}</p>}
      </Card>

      <p className="disclaimer">Planning aid only. Check live listings and current timetables before you decide.</p>
    </article>
  )
}
