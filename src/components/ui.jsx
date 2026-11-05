import React, { useState } from 'react'
import { MapPin, GraduationCap, House, Clock, ShoppingCart, Briefcase, CircleCheck, Bus, Bike, Footprints, ArrowRight, ArrowLeft, ChevronDown, Search, Map as MapIcon, Info, Star, Check, ArrowUpRight, Plus, Copy, TrainFront, TramFront, Wallet, ShieldAlert, ShieldCheck, Pill as PillIcon, Stethoscope, WashingMachine, Receipt, MessageSquare } from 'lucide-react'
import { parseEircode } from '../domain/geo.js'

export const eur = (n) => `€${Math.round(n).toLocaleString('en-IE')}`
export const SHORT = { tcd: 'Trinity', ucd: 'UCD', dcu: 'DCU', tud: 'TU Dublin', rcsi: 'RCSI', nci: 'NCI', dbs: 'DBS', griffith: 'Griffith', iadt: 'IADT' }
export const CONF = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }
export const Conf = ({ level }) => level ? <span className={`conf conf-${level}`}>{CONF[level]}</span> : null
export const HOW_CHIP = { published: 'Rent published', carried: 'Rent carried forward', estimated: 'Rent estimated' }

// Lucide icons (lucide.dev): one consistent, hand-tuned set instead of ad-hoc paths.
const ICONS = {
  pin: MapPin, cap: GraduationCap, home: House, clock: Clock, cart: ShoppingCart, work: Briefcase, check: CircleCheck,
  bus: Bus, bike: Bike, walk: Footprints, arrow: ArrowRight, back: ArrowLeft, chev: ChevronDown, search: Search, map: MapIcon,
  info: Info, star: Star, tick: Check, external: ArrowUpRight, plus: Plus, copy: Copy, train: TrainFront, tram: TramFront,
  wallet: Wallet, alert: ShieldAlert, safe: ShieldCheck, pill: PillIcon, gp: Stethoscope, laundry: WashingMachine, receipt: Receipt, message: MessageSquare
}
export const Icon = ({ name, size = 20, stroke = 1.75, filled = false }) => {
  const C = ICONS[name] || Info
  return <C className="ico" size={size} strokeWidth={stroke} aria-hidden="true" focusable="false" fill={filled ? 'currentColor' : 'none'} />
}

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
