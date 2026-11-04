import React from 'react'

export default function Method({ data }) {
  const s = data.sources
  return (
    <article className="doc">
      <p><a href="#/">← Back to the finder</a></p>
      <h1>How we know this</h1>
      <p className="lead">Every number on Which Dublin comes from an open dataset, shows where it came from and when, and carries a confidence label. Here is what that means, and where it can be wrong.</p>

      <h2>Rent</h2>
      <p>From the Residential Tenancies Board (RTB) Average Monthly Rent Report, published by the CSO (<a href={s.rent.url}>{s.rent.name}</a>, {s.rent.licence}). Latest quarter used: <b>{s.rent.asOf}</b>.</p>
      <ul>
        <li>It is the average rent of tenancies <em>registered</em> in that quarter, for the <b>whole property</b>. It is not the price of a room.</li>
        <li>For shared homes we divide the average 2-bed or 3-bed rent by the number of people. Real rooms vary, and a master bedroom costs more than a box room.</li>
        <li>Areas are the RTB's named areas (for example Rathmines, Dublin 6). Postal-district figures stopped in 2021, so we use named areas.</li>
        <li>An area is missing a figure when the RTB did not publish that size of home there. We never fill gaps with guesses.</li>
        <li>Confidence: <b>high</b> needs at least 12 size and type groups with data and a figure under about 13 months old; <b>medium</b> needs 6 and under 2 years; otherwise <b>low</b>.</li>
      </ul>

      <h2>Commute</h2>
      <p>We run a timetable search over the National Transport Authority's GTFS data (<a href={s.transit.url}>{s.transit.name}</a>, {s.transit.licence}) for the service day <b>{s.transit.serviceDate}</b>, a Wednesday in term.</p>
      <ul>
        <li>For each area we plan journeys leaving every 5 minutes from 07:30 to 08:30 and show the <b>median</b>, with the best and worst in the detail view.</li>
        <li>Door to door: walk to a stop (up to 800 m), ride, change (stops up to 300 m apart), walk to campus. Walking pace 1.25 m/s with a 1.3 detour factor on straight-line distance.</li>
        <li>These are <b>scheduled</b> times. Real services run late, are cancelled or get diverted. We do not yet measure reliability, because that needs weeks of live data. Where a number would rest on thin evidence we say so, or hide it.</li>
        <li>Cycling is distance divided by 15 km/h; walking likewise. Both are estimates, not routed.</li>
      </ul>

      <h2>Supermarkets</h2>
      <p>Lidl, Aldi and Tesco locations come from OpenStreetMap ({s.groceries.licence}), fetched {s.groceries.fetched}. Walk time is straight-line distance with the same detour factor. OpenStreetMap is community maintained and can miss a new or recently closed store.</p>

      <h2>Areas and campuses</h2>
      <p>Area positions are OpenStreetMap place locations, checked to fall inside the correct postal district; those that did not were removed rather than guessed. Campus positions are OpenStreetMap locations of each main entrance area. Area descriptions are from Wikipedia ({s.descriptions.licence}).</p>

      <h2>Ranking</h2>
      <p>Areas over your budget are set aside. The rest are scored 0 to 1 on rent, commute and supermarket access relative to each other, then combined using the priority you chose. A high rank means "good for what you asked", not "safe" or "nice". We do not score safety or crime, and we do not use listing sites.</p>

      <h2>What this is not</h2>
      <ul>
        <li>Not a listing site and not a live asking-price tracker.</li>
        <li>Not a guarantee of any commute time or rent.</li>
        <li>No accounts, no cookies, no tracking of your searches.</li>
      </ul>
      <p>Found something wrong? <a href="https://github.com/Kabir192003/WhichDublin/issues/new">Tell us</a>. Data was last built on {data.version}.</p>

      <h2>Attribution</h2>
      <p>Contains data from the RTB and CSO (CC BY 4.0), the National Transport Authority (CC BY 4.0), © OpenStreetMap contributors (ODbL) and Wikipedia (CC BY-SA 4.0). Map tiles by OpenFreeMap.</p>
    </article>
  )
}
