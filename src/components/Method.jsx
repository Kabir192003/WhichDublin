import React from 'react'
import { RENT_COMPARISON } from '../content/facts.js'

export default function Method({ data }) {
  const s = data.sources
  return (
    <>
    <section className="page-hero"><div className="wrap"><h1>How we know this</h1><p>Sources, dates, and what each label means.</p></div></section>
    <article className="wrap page-body"><div className="card lift doc">
      <p className="lead" style={{ fontSize: 17 }}>Every number on Settld comes from an open dataset, shows where it came from and when, and carries a confidence label. Here is what that means, and where it can be wrong.</p>

      <h2>Rent</h2>
      <p>From the Residential Tenancies Board (RTB) Average Monthly Rent Report, published by the CSO (<a href={s.rent.url}>{s.rent.name}</a>, {s.rent.licence}). Latest quarter used: <b>{s.rent.asOf}</b>.</p>
      <ul>
        <li>It is the average rent of tenancies <em>registered</em> in that quarter, for the <b>whole property</b>. It is not the price of a room.</li>
        <li>For shared homes we divide the average 2-bed or 3-bed rent by the number of people. Real rooms vary, and a master bedroom costs more than a box room.</li>
        <li>Areas are the RTB's named areas (for example Rathmines, Dublin 6). Postal-district figures stopped in 2021, so we use named areas.</li>
        <li>Every area shows all 25 combinations of size (1, 2, 3, 4+ beds, all) and type (any, apartment, terraced, semi-detached, detached). Each figure is labelled: <b>published</b> by the RTB for that quarter; <b>carried forward</b> from the latest published quarter in the previous two years, adjusted for rent growth; or <b>estimated</b> from the closest figure the RTB did publish for that area, scaled by how the two compare across Dublin.</li>
        <li>We tested the estimates by hiding figures the RTB did publish and estimating them. Anchored on the same size or type: half within {s.rent.backtest?.specific?.medianPct}%, 8 in 10 within {s.rent.backtest?.specific?.p80Pct}% ({s.rent.backtest?.specific?.n} tests). Anchored only on the all-homes average: half within {s.rent.backtest?.all?.medianPct}%, 8 in 10 within {s.rent.backtest?.all?.p80Pct}%.</li>
        <li>Confidence: <b>high</b> needs at least 12 size and type groups with data and a figure under about 13 months old; <b>medium</b> needs 6 and under 2 years; otherwise <b>low</b>.</li>
        <li>The RTB and CSO take roughly 10-11 months to publish a quarter's figures, since a tenancy has to be registered first. <b>{s.rent.asOf}</b> is the newest quarter published as of our last data refresh, not a lag on our side.</li>
        <li>In a small area, different bed sizes can be carried forward from different, older quarters (one from a year back, another from two years back), each grown forward by its own small factor. That can occasionally make a smaller home show as more expensive than a bigger one in the same area, or vice versa. A marker next to a figure (hover for the quarter it's from) means it isn't a fresh, same-quarter number.</li>
      </ul>

      <h2>Rent: how this compares with Daft.ie's own report</h2>
      <p>{RENT_COMPARISON.intro}</p>
      <p>Daft.ie's latest report (<b>{RENT_COMPARISON.dublinQuarter}</b>) put the Dublin-wide average for a two-bed apartment at roughly <b>€{RENT_COMPARISON.dublinTwoBedApartment.low.toLocaleString('en-IE')}–€{RENT_COMPARISON.dublinTwoBedApartment.high.toLocaleString('en-IE')}</b> a month (press coverage of the same figure varied slightly). That is noticeably higher than most of our RTB-based figures for similarly sized homes, for real reasons, not because either number is wrong:</p>
      <ul>
        {RENT_COMPARISON.why.map((w, i) => <li key={i}>{w}</li>)}
      </ul>
      <p>{RENT_COMPARISON.granularity}</p>
      <p className="hint">{RENT_COMPARISON.check}</p>
      <p className="source">Sources: {RENT_COMPARISON.sources.map((src, i) => <React.Fragment key={src.url}>{i > 0 && ', '}<a href={src.url} target="_blank" rel="noreferrer">{src.name}</a></React.Fragment>)}.</p>

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

      <h2>Dublinbikes</h2>
      <p>Dock locations come from OpenStreetMap ({s.bikes?.licence}). In the Dublinbikes travel mode we add: walk to the nearest dock, ride between docks at 15 km/h with a 1.3 detour factor, 2 minutes to undock and dock, and the walk from the dock nearest your college. It is shown only when both docks are within 1.5 km. OpenStreetMap may not list every station and we do not know how many bikes are free right now, so check the official Dublinbikes app.</p>

      <h2>Part-time work</h2>
      <p>The pay and hours rules are written by hand from the sources named on that page, each with the date we checked it. The "places that hire students" counts are numbers of shops, restaurants, cafes, pubs, hotels, gyms and cinemas in OpenStreetMap within about 1 km. They show where employers are, <b>not</b> which have vacancies.</p>

      <h2>Settling in</h2>
      <p>The immigration, Leap card, bank and mobile guides are written by hand. Where we could not read the official page, the page says so. We leave out prices we could not confirm rather than show an old figure.</p>

      <h2>Eircode lookup</h2>
      <p>We send the Eircode you type to OpenStreetMap's Nominatim service to find it. If the full code is not in OpenStreetMap we use the centre of its postal district and say so. Public transport times come from the nearest area we have timetable results for; walking and cycling use the exact distance.</p>

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
    </div></article>
    </>
  )
}
