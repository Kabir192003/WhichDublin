import React from 'react'
import { RENT_TYPES, HOME_TYPES, MODES, rentPerPerson, commuteFor } from '../domain/model.js'
import { eur, SHORT, HOW_CHIP } from './ui.jsx'
import { SaveButton } from './Shortlist.jsx'
import { CostCard } from './Cost.jsx'
import { Essentials, RoomReports, Section, RentTable, Colleges, collegeRowsForArea, Groceries, shopsForArea, Work, Dock } from './AreaParts.jsx'

const mapsLink = (a, campus, mode) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lon}&destination=${campus.lat},${campus.lon}&travelmode=${mode === 'transit' ? 'transit' : mode === 'walk' ? 'walking' : 'bicycling'}`

export default function Detail({ area, s, campus, rank, data, onBack, inCompare, onCompare }) {
  const rent = rentPerPerson(area, s.type, s.ptype), commute = commuteFor(area, s.campus, s.mode)
  const src = data.sources, college = SHORT[s.campus]
  return (
    <article className="detail" aria-label={area.label}>
      <button className="link back" onClick={onBack}>← Back to results</button>
      <h1>{area.label}</h1>
      <p className="verdict">{rank ? <>Ranked <b>{rank.rank}</b> for your choices.</> : <>Outside your budget, or no journey for this travel mode.</>}</p>
      <div className="glance">
        <div className="stat s-rent"><b>{rent ? eur(rent.perPerson) : '–'}</b><small>your share / month</small></div>
        <div className="stat s-time"><b>{commute ? `${commute.minutes} min` : '–'}</b><small>to {college}</small></div>
        <div className="stat s-groc"><b>{area.nearestBudgetGroceryMinutes ?? '–'} min</b><small>to Lidl/Aldi</small></div>
      </div>
      <div className="actions">
        <SaveButton id={area.id} />
        <button className="btn sm" onClick={onCompare}>{inCompare ? '✓ In compare list' : '+ Add to compare'}</button>
        <a className="btn ghost sm" href={mapsLink(area, campus, s.mode)} target="_blank" rel="noreferrer">Live route in Google Maps</a>
      </div>
      {area.about && <p className="about">{area.about.text} <a href={area.about.url} target="_blank" rel="noreferrer">Wikipedia</a></p>}

      {rent && <Section icon="home" badge="b-teal" title="Your rent" conf={rent.confidence} source={`RTB via CSO, ${src.rent.asOf}, ${src.rent.licence}`}>
        <p className="big"><b>{eur(rent.perPerson)}</b> a month, your share</p>
        <p>{RENT_TYPES[s.type].label}, {HOME_TYPES[s.ptype].toLowerCase()}: average {eur(rent.total)}{rent.people > 1 ? ` split ${rent.people} ways` : ' for the whole home'}. <span className={`chip ${rent.how === 'published' ? 'pub' : rent.how}`}>{HOW_CHIP[rent.how]}{rent.how === 'carried' ? ` from ${rent.q}` : ''}</span></p>
      </Section>}

      {rent && <CostCard rentShare={rent.perPerson} mode={s.mode} />}

      <Section icon="clock" badge="b-sky" title={`Getting to ${college}`} conf={commute?.confidence}
        source={s.mode === 'transit' ? `NTA timetables, ${src.transit.serviceDate}, ${src.transit.licence}` : s.mode === 'bikeshare' ? `${src.bikes.name}, ${src.bikes.licence}` : 'Distance between OpenStreetMap locations'}
        how={commute?.kind === 'scheduled' ? <p>Middle value of 13 timetabled trips leaving 07:30 to 08:30, door to door. Scheduled, not live: buses can be late.</p> : <p>An estimate, not a routed journey: walking 1.25 m/s, riding 15 km/h, distance times 1.3 for streets{s.mode === 'bikeshare' ? ', plus 2 minutes to undock and dock' : ''}.</p>}>
        {commute ? <>
          <p className="big"><b>{commute.minutes} min</b> {s.mode === 'transit' ? 'by bus, Luas or train' : MODES[s.mode].label.toLowerCase()}</p>
          {commute.kind === 'scheduled' ? <p>Fastest {commute.best}, slowest {commute.worst} min · {commute.changes} change{commute.changes === 1 ? '' : 's'} · {commute.walkMinutes} min walking</p> : <p>{commute.detail}</p>}
        </> : <p>{s.mode === 'bikeshare' ? 'No Dublinbikes dock within 1.5 km of home or college.' : 'No journey found within walking distance of both ends.'}</p>}
      </Section>

      <RentTable area={area} data={data} highlight={{ bed: RENT_TYPES[s.type].bed, ptype: s.ptype }} />
      <RoomReports area={area} />
      <Colleges rows={collegeRowsForArea(area, data)} data={data} streets={!!data.sources.streets} />
      <Groceries shops={shopsForArea(area)} data={data} />
      <Essentials area={area} data={data} />
      <Dock home={area.nearestDock} campusDock={campus.dock} campusName={college} data={data} />
      {area.work && <Work work={area.work} data={data} />}

      <Section icon="bus" badge="b-sky" title="Buses, Luas and trains near home" source={`${src.transit.name}, ${src.transit.licence}`}>
        {area.transit?.nearestStop ? <p>Nearest stop: <b>{area.transit.nearestStop.name}</b>, {area.transit.nearestStop.walkMinutes} min walk.</p> : <p className="muted">No stop within a 10 minute walk.</p>}
        {area.transit?.routes && <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>{[['Bus', area.transit.routes.bus], ['Luas', area.transit.routes.tram], ['Rail', area.transit.routes.rail]].filter(([, r]) => r?.length).map(([l, r]) => <p key={l} style={{ margin: 0 }}><b>{l}</b> {r.join(', ')}</p>)}</div>}
      </Section>
      <p className="disclaimer">Planning aid only. Check live listings and current timetables before you decide.</p>
    </article>
  )
}
