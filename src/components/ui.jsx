import React, { useState } from 'react'
import { parseEircode } from '../domain/geo.js'

export const eur = (n) => `€${Math.round(n).toLocaleString('en-IE')}`
export const SHORT = { tcd: 'Trinity', ucd: 'UCD', dcu: 'DCU', tud: 'TU Dublin', rcsi: 'RCSI', nci: 'NCI', dbs: 'DBS', griffith: 'Griffith', iadt: 'IADT' }
export const CONF = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }
export const Conf = ({ level }) => level ? <span className={`conf conf-${level}`}>{CONF[level]}</span> : null
export const HOW_CHIP = { published: 'Rent published', carried: 'Rent carried forward', estimated: 'Rent estimated' }

export const ICONS = {
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  cap: 'M3 9l9-5 9 5-9 5-9-5zM7 11v5c3 2 7 2 10 0v-5',
  home: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  cart: 'M3 4h2l2 12h11l2-8H6M9 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM17 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z',
  work: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  check: 'M5 12l4 4 10-10',
  bus: 'M6 17h12M7 4h10a2 2 0 0 1 2 2v9H5V6a2 2 0 0 1 2-2zM8 20v-3M16 20v-3M5 11h14',
  bike: 'M5.5 17.5m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M18.5 17.5m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M5.5 17.5l4-7h6l3 7M9.5 10.5l3 7M14 6h3',
  walk: 'M13 4.5a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3M8 12l3-4 4 3 3 1M11 8l-1 5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chev: 'M6 9l6 6 6-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  info: 'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'
}
export const Icon = ({ name, size = 20, stroke = 1.8 }) => (
  <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
)

export const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="#F4B740" /><path d="M7 17c3-4 5-4 7 0s4 4 7 0" fill="none" stroke="#0B4F45" strokeWidth="2.4" strokeLinecap="round" /><circle cx="14" cy="9" r="2.4" fill="#0B4F45" /></svg>
)

/** Styled native select: keyboard and screen reader behave as a real dropdown. */
export function Select({ id, label, value, onChange, options, icon, hideLabel }) {
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'sr' : 'flabel'}>{label}</label>
      <div className="select">
        {icon && <span style={{ color: 'var(--teal)' }}><Icon name={icon} /></span>}
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <span className="chev"><Icon name="chev" size={16} stroke={2} /></span>
      </div>
    </div>
  )
}

/** Compact filter pill around a native select. */
export function Pill({ label, value, onChange, options }) {
  const id = 'pill-' + label.toLowerCase().replace(/\W+/g, '-')
  return (
    <label className="pill" htmlFor={id}>
      <span className="k">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      <span className="chev"><Icon name="chev" size={14} stroke={2.2} /></span>
    </label>
  )
}

/** Eircode input. Validates the format before going anywhere. */
export function EircodeBox({ small, initial = '', autoFocus }) {
  const [v, setV] = useState(initial)
  const [err, setErr] = useState(null)
  const go = (e) => {
    e.preventDefault()
    const p = parseEircode(v)
    if (!p) { setErr('That does not look like an Eircode. It is 7 characters, like D02 X285.'); return }
    setErr(null); location.hash = `#/eircode/${p.full.replace(' ', '')}`
  }
  return (
    <form onSubmit={go} role="search" aria-label="Look up an Eircode">
      <div className={`eirbox ${small ? 'small' : ''}`}>
        <div className="in"><Icon name="pin" />
          <label htmlFor={small ? 'eir-s' : 'eir'} className="sr">Eircode</label>
          <input id={small ? 'eir-s' : 'eir'} value={v} onChange={(e) => setV(e.target.value)} placeholder={small ? 'Eircode' : 'Got an Eircode? e.g. D02 X285'} autoComplete="postal-code" maxLength={9} autoFocus={autoFocus} aria-invalid={!!err} aria-describedby={err ? 'eir-err' : undefined} />
        </div>
        <button className="btn coral" type="submit">{small ? 'Go' : 'Check this address'}</button>
      </div>
      {err && <p id="eir-err" className="eir-err" role="alert">{err}</p>}
    </form>
  )
}

/** Google Maps directions link (free: opens the Maps app or site, no API key, no quota). origin/dest: text or {lat, lon}. */
export function gmapsDir(origin, dest, mode = 'transit') {
  const f = (x) => (typeof x === 'string' ? x : `${x.lat},${x.lon}`)
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(f(origin))}&destination=${encodeURIComponent(f(dest))}&travelmode=${mode}`
}
