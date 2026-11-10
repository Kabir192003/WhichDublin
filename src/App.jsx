import React, { useEffect, useState } from 'react'
import Home from './components/Home.jsx'
import Finder from './components/Finder.jsx'
import Explore from './components/Explore.jsx'
import Eircode from './components/Eircode.jsx'
import Method from './components/Method.jsx'
import Stop from './components/Stop.jsx'
import Work from './components/Work.jsx'
import Settle from './components/Settle.jsx'
import Renting from './components/Renting.jsx'
import Shortlist from './components/Shortlist.jsx'
import { useShortlist } from './domain/shortlist.js'
import { checkSession } from './domain/account.js'
import { parseState, stateToSearch } from './domain/model.js'
import { Logo, EircodeBox, Icon } from './components/ui.jsx'
import Feedback from './components/Feedback.jsx'
import Account from './components/Account.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const DATA_URL = `${import.meta.env.BASE_URL}data/areas.json`
const NAV = [['#/', 'Start', (h) => h === '' || h === '#/' || h === '#'], ['#/explore', 'Explore', (h) => h.startsWith('#/explore')], ['#/areas', 'Find my area', (h) => h.startsWith('#/areas')],
  ['#/work', 'Part-time work', (h) => h.startsWith('#/work')], ['#/stop', 'Find a stop', (h) => h.startsWith('#/stop')], ['#/settle', 'Settling in', (h) => h.startsWith('#/settle')], ['#/renting', 'Renting safely', (h) => h.startsWith('#/renting')], ['#/method', 'How we know', (h) => h.startsWith('#/method')]]

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => { const f = () => { setHash(location.hash); document.querySelector('main')?.scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return hash
}

export default function App() {
  const [data, setData] = useState(null), [err, setErr] = useState(null)
  const hash = useHash()
  const [s, setS] = useState(() => parseState(location.search, []))
  useEffect(() => { fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then((d) => { setData(d); setS(parseState(location.search, d.campuses.map((c) => c.id))) }).catch((e) => setErr(String(e))) }, [])
  useEffect(() => { checkSession() }, [])
  useEffect(() => { history.replaceState(null, '', `?${stateToSearch(s)}${location.hash}`) }, [s])
  const set = (patch) => setS((p) => ({ ...p, ...patch }))
  const saved = useShortlist()

  let body, bleed = false
  if (err) body = <p className="notice">Could not load the data ({err}). Please refresh.</p>
  else if (!data) body = <p className="notice">Loading Dublin…</p>
  else if (hash.startsWith('#/areas')) { body = <Finder data={data} s={s} set={set} />; bleed = true }
  else if (hash.startsWith('#/explore')) { body = <Explore data={data} />; bleed = true }
  else if (hash.startsWith('#/eircode')) body = <Eircode data={data} code={decodeURIComponent(hash.split('/')[2] || '')} />
  else if (hash.startsWith('#/work')) body = <Work data={data} />
  else if (hash.startsWith('#/stop')) body = <Stop />
  else if (hash.startsWith('#/settle')) body = <Settle />
  else if (hash.startsWith('#/method')) body = <Method data={data} />
  else if (hash.startsWith('#/renting')) body = <Renting />
  else if (hash.startsWith('#/shortlist')) body = <Shortlist data={data} s={s} shared={decodeURIComponent(hash.split('/')[2] || '')} />
  else body = <Home data={data} s={s} set={set} />

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <div className="top-in">
          <a className="brand" href="#/" aria-label="Settld, start"><Logo />Settld</a>
          <nav className="nav" aria-label="Main">{NAV.map(([href, label, on]) => <a key={href} href={href} aria-current={on(hash) ? 'page' : undefined}>{label}</a>)}</nav>
          <a className="saved-link" href="#/shortlist" aria-current={hash.startsWith('#/shortlist') ? 'page' : undefined}><Icon name="star" size={15} filled={saved.length > 0} stroke={2} />Shortlist{saved.length ? ` (${saved.length})` : ''}</a>
          <Feedback />
          <Account />
          {data && !(hash === '' || hash === '#/' || hash.startsWith('#/eircode')) && <div className="top-eir"><EircodeBox small /></div>}
        </div>
      </header>
      <main id="main" className={bleed ? 'bleed' : 'scroll'}><ErrorBoundary resetKey={hash}>{body}</ErrorBoundary></main>
    </>
  )
}
