import React, { useEffect, useState } from 'react'
import { useShortlist, toggle, setAll, shareUrl } from '../domain/shortlist.js'
import { rentPerPerson, commuteFor, travelCost, RENT_TYPES, HOME_TYPES } from '../domain/model.js'
import { useCostSettings, fareFor } from './Cost.jsx'
import { eur, SHORT, Icon } from './ui.jsx'

export default function Shortlist({ data, s, shared }) {
  const mine = useShortlist()
  const sharedIds = (shared || '').split(',').filter((id) => data.areas.some((a) => a.id === id))
  const ids = sharedIds.length ? sharedIds : mine
  const [copied, setCopied] = useState(false)
  const [c] = useCostSettings()
  const areas = ids.map((id) => data.areas.find((a) => a.id === id)).filter(Boolean)
  const copy = async () => { try { await navigator.clipboard.writeText(shareUrl(ids)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { prompt('Copy this link', shareUrl(ids)) } }
  useEffect(() => setCopied(false), [shared])
  return (
    <>
      <section className="page-hero"><div className="wrap"><h1>{sharedIds.length ? 'A shared shortlist' : 'Your shortlist'}</h1><p>Compare the areas you saved, then send one link to your housemates. Nothing is stored on a server: the list lives in the link and in this browser.</p></div></section>
      <article className="wrap page-body">
        <div className="card lift">
          {areas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <span className="badge b-teal" style={{ margin: '0 auto 10px' }}><Icon name="home" /></span>
              <h2>No areas saved yet</h2>
              <p className="hint">Tap Save on any area in <a href="#/areas">Find my area</a> or <a href="#/explore">Explore</a>.</p>
            </div>
          ) : (
            <>
              <div className="actions" style={{ marginTop: 0 }}>
                <button className="btn" onClick={copy}>{copied ? <><Icon name="tick" size={16} stroke={2.2} />Link copied</> : <><Icon name="copy" size={16} />Copy link to share</>}</button>
                {sharedIds.length > 0 && <button className="btn ghost" onClick={() => { setAll([...mine, ...sharedIds]); location.hash = '#/shortlist' }}>Save these to my shortlist</button>}
              </div>
              <p className="hint">Figures for {SHORT[s.campus]}, {RENT_TYPES[s.type].short}{s.ptype !== 'any' ? `, ${HOME_TYPES[s.ptype].toLowerCase()}` : ''}. Change these in <a href="#/areas">Find my area</a>.</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="rtable" style={{ fontSize: 14 }}>
                  <thead><tr><th scope="col">Area</th><th scope="col">Rent share</th><th scope="col">Rent + travel</th><th scope="col">8am to {SHORT[s.campus]}</th><th scope="col">Home at night</th><th scope="col">Lidl/Aldi</th><th scope="col"><span className="sr">Remove</span></th></tr></thead>
                  <tbody>{areas.map((a) => {
                    const r = rentPerPerson(a, s.type, s.ptype), t = a.toCampus[s.campus]
                    const travel = travelCost('transit', { daysPerWeek: c.days, fare: fareFor(c.card) })
                    return (
                      <tr key={a.id}>
                        <th scope="row" style={{ fontWeight: 700 }}>{a.label}</th>
                        <td className="num">{r ? eur(r.perPerson) : '–'}</td>
                        <td className="num"><b>{r ? eur(r.perPerson + travel) : '–'}</b></td>
                        <td className="num">{t.transit ? `${t.transit.minutes} min` : '–'}</td>
                        <td className="num">{t.late ? `${t.late.minutes} min` : '–'}</td>
                        <td className="num">{a.nearestBudgetGroceryMinutes ?? '–'} min</td>
                        <td>{!sharedIds.length && <button className="link" onClick={() => toggle(a.id)} aria-label={`Remove ${a.label}`}>Remove</button>}</td>
                      </tr>)
                  })}</tbody>
                </table>
              </div>
              <p className="source">Travel: Dublin 90-minute fare twice a day, {c.days} days a week, no caps applied. Rent: RTB averages, {data.sources.rent.asOf}.</p>
            </>
          )}
        </div>
      </article>
    </>
  )
}

/** Small save toggle used on cards and area pages. */
export function SaveButton({ id, small }) {
  const list = useShortlist(); const on = list.includes(id)
  return <button type="button" className={small ? 'cmp-btn' : 'btn ghost sm'} aria-pressed={on} onClick={() => toggle(id)}><Icon name="star" size={15} filled={on} stroke={2} />{on ? 'Saved' : 'Save'}</button>
}
