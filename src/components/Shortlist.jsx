import React, { useEffect, useState } from 'react'
import { useShortlist, toggle, setAll, shareUrl } from '../domain/shortlist.js'
import { rentPerPerson, commuteFor, travelCost, costRange, RENT_TYPES, HOME_TYPES, MODES } from '../domain/model.js'
import { BILLS, GROCERIES, PHONE, BER_FACTOR } from '../content/facts.js'
import { useCostSettings, fareFor } from './Cost.jsx'
import { useAccount } from '../domain/account.js'
import { eur, SHORT, Icon, Pill, CONF, HOW_CHIP } from './ui.jsx'

const MODE_LABEL = { transit: 'Bus / Luas', bikeshare: 'Dublinbikes', cycle: 'Own bike', walk: 'Walk' }
const num = (v) => (v === '' || v == null ? null : Number(v))
const min = (v) => (v == null ? null : `${v} min`)

/** Index of the single lowest value, or -1 when fewer than two areas have one or the lowest is shared. */
function lowest(vals) {
  const ok = vals.filter((v) => typeof v === 'number')
  if (ok.length < 2) return -1
  const m = Math.min(...ok)
  return ok.filter((v) => v === m).length === 1 ? vals.indexOf(m) : -1
}

/** What the figures say when put side by side. Statements of difference only: which area suits someone is theirs to decide. */
function tradeoffs(cols, college) {
  const out = []
  const withBoth = cols.filter((c) => c.rent != null && c.commute != null)
  if (withBoth.length >= 2) {
    const cheap = withBoth.reduce((a, b) => (b.rent < a.rent ? b : a)), fast = withBoth.reduce((a, b) => (b.commute < a.commute ? b : a))
    if (cheap.area.id === fast.area.id) out.push(<><b>{cheap.area.name}</b> has both the lowest rent share and the shortest trip to {college} of these areas.</>)
    else {
      const save = fast.rent - cheap.rent, longer = cheap.commute - fast.commute
      out.push(<><b>{cheap.area.name}</b> costs {eur(save)} a month less in rent than <b>{fast.area.name}</b> ({eur(save * 12)} over a year){longer > 0 ? <>, and the trip to {college} takes {longer} min longer each way.</> : <>, with the same trip time to {college}.</>}</>)
    }
  }
  const groc = cols.filter((c) => c.groceries != null)
  if (groc.length >= 2) {
    const near = groc.reduce((a, b) => (b.groceries < a.groceries ? b : a)), far = groc.reduce((a, b) => (b.groceries > a.groceries ? b : a))
    if (far.groceries - near.groceries >= 5) out.push(<>A Lidl or Aldi is a {near.groceries} min walk in <b>{near.area.name}</b> and {far.groceries} min in <b>{far.area.name}</b>.</>)
  }
  const late = cols.filter((c) => c.late != null && c.commute != null && c.late - c.commute >= 15)
  late.forEach((c) => out.push(<>Getting home to <b>{c.area.name}</b> late at night takes {c.late} min, {c.late - c.commute} min longer than the morning trip.</>))
  const rail = cols.filter((c) => c.area.transit?.routes?.tram?.length || c.area.transit?.routes?.rail?.length), noRail = cols.filter((c) => !rail.includes(c))
  if (rail.length && noRail.length) out.push(<>{rail.map((c) => c.area.name).join(' and ')} {rail.length === 1 ? 'has' : 'have'} a Luas or rail line nearby; {noRail.map((c) => c.area.name).join(' and ')} {noRail.length === 1 ? 'relies' : 'rely'} on buses.</>)
  return out
}

export default function Shortlist({ data, s, set, shared }) {
  const mine = useShortlist()
  const user = useAccount()
  const sharedIds = (shared || '').split(',').filter((id) => data.areas.some((a) => a.id === id))
  const ids = sharedIds.length ? sharedIds : mine
  const [copied, setCopied] = useState(false)
  const [c] = useCostSettings()
  const college = SHORT[s.campus]
  const copy = async () => { try { await navigator.clipboard.writeText(shareUrl(ids)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { prompt('Copy this link', shareUrl(ids)) } }
  useEffect(() => setCopied(false), [shared])

  const travel = travelCost(s.mode, { daysPerWeek: Number(c.days) || 0, fare: fareFor(c.card) })
  const cols = ids.map((id) => data.areas.find((a) => a.id === id)).filter(Boolean).map((area) => {
    const r = rentPerPerson(area, s.type, s.ptype), t = area.toCampus[s.campus], trip = commuteFor(area, s.campus, s.mode)
    const month = r ? costRange({ rentShare: r.perPerson, travel, people: r.people, berFactor: BER_FACTOR[c.ber]?.f ?? null, bills: BILLS, groceries: GROCERIES, phone: PHONE, own: { bills: num(c.bills), food: num(c.food), phone: num(c.phone) } }).typical.total : null
    return { area, r, rent: r?.perPerson ?? null, month, trip, commute: trip?.minutes ?? null, late: t?.late?.minutes ?? null, groceries: area.nearestBudgetGroceryMinutes ?? null }
  })
  const notes = tradeoffs(cols, college)

  // rows: [label, sublabel, value per column, numbers to pick the lowest from (or null for no highlight)]
  const row = (label, sub, cell, nums) => {
    const best = nums ? lowest(cols.map(nums)) : -1
    return <tr key={label}><th scope="row">{label}{sub && <small>{sub}</small>}</th>{cols.map((col, i) => <td key={col.area.id} className={best === i ? 'best' : ''}>{cell(col) ?? <span className="muted">No figure</span>}{best === i && <span className="sr"> (lowest)</span>}</td>)}</tr>
  }
  const group = (label) => <tr className="group" key={label}><th scope="colgroup" colSpan={cols.length + 1}>{label}</th></tr>

  return (
    <>
      <section className="page-hero"><div className="wrap">
        <h1>{sharedIds.length ? 'A shared shortlist' : 'Compare your shortlist'}</h1>
        <p>{sharedIds.length ? 'Someone sent you these areas. The figures below use your own choices.' : 'Your shortlisted areas side by side, with the differences that matter spelled out.'}</p>
      </div></section>
      <article className="wrap page-body">
        {cols.length === 0 ? (
          <div className="card empty">
            <span className="badge"><Icon name="star" /></span>
            <h2>Nothing shortlisted yet</h2>
            <p className="hint">Use the Shortlist button on any area, then come back here to compare.</p>
            <p><a className="btn" href="#/areas">Explore areas</a></p>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="filters" style={{ border: 0, padding: 0 }}>
                <Pill label="College" value={s.campus} onChange={(v) => set({ campus: v })} options={data.campuses.map((x) => [x.id, SHORT[x.id]])} />
                <Pill label="Living" value={s.type} onChange={(v) => set({ type: v })} options={Object.entries(RENT_TYPES).map(([k, v]) => [k, v.label])} />
                <Pill label="Home" value={s.ptype} onChange={(v) => set({ ptype: v })} options={Object.entries(HOME_TYPES)} />
                <Pill label="Travel" value={s.mode} onChange={(v) => set({ mode: v })} options={Object.keys(MODES).map((k) => [k, MODE_LABEL[k]])} />
                <span className="grow" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {sharedIds.length > 0 && <button className="btn sm" onClick={() => { setAll([...mine, ...sharedIds]); location.hash = '#/shortlist' }}>Add these to my shortlist</button>}
                  <button className="btn ghost sm" onClick={copy}>{copied ? <><Icon name="tick" size={15} stroke={2.2} />Link copied</> : <><Icon name="share" size={15} />Share this list</>}</button>
                </span>
              </div>
            </div>

            {cols.length === 1 && <p className="notice-inline">One area so far. Shortlist at least one more to see how they differ. <a href="#/areas">Explore areas</a></p>}

            {notes.length > 0 && (
              <section className="card" aria-labelledby="diff-h">
                <h2 id="diff-h">What sets them apart</h2>
                <ul className="tradeoffs">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                <p className="hint" style={{ margin: '10px 0 0' }}>These lines only restate the figures below. They don't weigh up what matters to you.</p>
              </section>)}

            <section className="card" aria-labelledby="cmp-h">
              <h2 id="cmp-h" className="sr">Side by side</h2>
              <div className="cmp-wrap">
                <table className="cmp">
                  <thead><tr><th scope="col"><span className="sr">Measure</span></th>{cols.map(({ area }) => (
                    <th key={area.id} scope="col">{area.name}<small>{area.district ? `Dublin ${area.district.slice(1)}` : 'Co. Dublin'}</small>
                      <span style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 13, fontWeight: 500 }}>
                        <a href={`#/areas/${area.id}`}>Open</a>
                        {!sharedIds.length && <button className="link" onClick={() => toggle(area.id)} aria-label={`Remove ${area.label}`}>Remove</button>}
                      </span></th>))}</tr></thead>
                  <tbody>
                    {group('Cost each month')}
                    {row('Rent, your share', RENT_TYPES[s.type].label, (x) => x.r && <><b className="num">{eur(x.rent)}</b><br /><span className={`chip ${x.r.how === 'published' ? 'pub' : x.r.how}`}>{HOW_CHIP[x.r.how]}</span></>, (x) => x.rent)}
                    {row('Typical month in total', 'Rent, travel, bills, groceries, phone', (x) => x.month != null && <b className="num">{eur(x.month)}</b>, (x) => x.month)}
                    {group(`Getting to ${college}`)}
                    {row(MODES[s.mode].label, s.mode === 'transit' ? 'Timetabled, leaving around 8am' : 'Estimate from distance', (x) => x.trip && <><b className="num">{x.commute} min</b>{x.trip.kind === 'scheduled' && <><br /><span className="hint">{x.trip.changes} change{x.trip.changes === 1 ? '' : 's'}, {x.trip.walkMinutes} min on foot</span></>}</>, (x) => x.commute)}
                    {row('Home late at night', 'Public transport', (x) => min(x.late), (x) => x.late)}
                    {row('By bike', 'Estimate from distance', (x) => min(x.area.toCampus[s.campus]?.cycleMinutes), (x) => x.area.toCampus[s.campus]?.cycleMinutes)}
                    {group('Everyday')}
                    {row('Walk to Lidl or Aldi', null, (x) => min(x.groceries), (x) => x.groceries)}
                    {row('Walk to Tesco', null, (x) => min(x.area.groceries?.Tesco?.walkMinutes), (x) => x.area.groceries?.Tesco?.walkMinutes)}
                    {row('Nearest stop', null, (x) => x.area.transit?.nearestStop && <>{x.area.transit.nearestStop.name}<br /><span className="hint">{x.area.transit.nearestStop.walkMinutes} min walk</span></>)}
                    {row('Luas or rail nearby', null, (x) => { const r = x.area.transit?.routes; const l = [...(r?.tram || []).map((n) => `Luas ${n}`), ...(r?.rail || [])]; return l.length ? l.join(', ') : <span className="muted">Buses only</span> })}
                    {group('How solid the rent figure is')}
                    {row('Rent confidence', null, (x) => x.r && <span className={`conf conf-${x.r.confidence}`}>{CONF[x.r.confidence]}</span>)}
                  </tbody>
                </table>
              </div>
              <p className="source">Green marks the single lowest figure in a row. Rent: RTB averages for {data.sources.rent.asOf}, scaled to new-tenancy level. Travel times: NTA timetables for {data.sources.transit.serviceDate}, scheduled not live. Monthly total uses the figures on the <a href="#/cost">Cost of living</a> page. {user ? 'Your shortlist is saved to your account.' : 'Your shortlist is kept in this browser; sign in to keep it across devices.'}</p>
            </section>
          </>
        )}
      </article>
    </>
  )
}

/** The one way to keep an area: adds it to the shortlist that the Compare page reads. */
export function SaveButton({ id, small }) {
  const list = useShortlist(); const on = list.includes(id)
  return <button type="button" className={small ? 'cmp-btn' : 'btn ghost sm'} aria-pressed={on} onClick={() => toggle(id)}><Icon name="star" size={15} filled={on} stroke={2} />{on ? 'Shortlisted' : 'Shortlist'}</button>
}

/** Shown wherever areas are listed once something is shortlisted: the count and the way to the comparison. */
export function ShortlistBar() {
  const n = useShortlist().length
  if (!n) return null
  return (
    <div className="compare-bar" role="status">
      <Icon name="star" size={16} filled stroke={2} />
      <span style={{ flex: 1 }}>{n} {n === 1 ? 'area' : 'areas'} shortlisted{n === 1 ? '. Add another to compare.' : ''}</span>
      <a className="btn coral sm" href="#/shortlist">{n > 1 ? 'Compare' : 'View'}</a>
    </div>
  )
}
