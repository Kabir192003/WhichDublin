import React, { Suspense, lazy, useEffect, useState } from 'react'
import Home from './components/Home.jsx'
import Method from './components/Method.jsx'
import Work from './components/Work.jsx'
import Settle from './components/Settle.jsx'
import Renting from './components/Renting.jsx'
import Shortlist from './components/Shortlist.jsx'
import CostPage from './components/CostPage.jsx'
import { useShortlist } from './domain/shortlist.js'
import { checkSession } from './domain/account.js'
import { parseState, stateToSearch } from './domain/model.js'
import { Logo, Icon } from './components/ui.jsx'
import Feedback from './components/Feedback.jsx'
import Account from './components/Account.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// The map library is most of the bundle, so the pages that draw a map load on demand.
const Finder = lazy(() => import('./components/Finder.jsx'))
const Explore = lazy(() => import('./components/Explore.jsx'))
const Eircode = lazy(() => import('./components/Eircode.jsx'))
const Stop = lazy(() => import('./components/Stop.jsx'))

const DATA_URL = `${import.meta.env.BASE_URL}data/areas.json`
const at = (...prefixes) => (h) => prefixes.some((p) => h.startsWith(p))
// One entry per stage of deciding where to live. Each can cover more than one route.
const NAV = [
  ['#/areas', 'Explore', at('#/areas', '#/explore', '#/eircode')],
  ['#/shortlist', 'Compare', at('#/shortlist', '#/compare')],
  ['#/cost', 'Cost of living', at('#/cost')],
  ['#/stop', 'Commute', at('#/stop')],
  ['#/settle', 'Moving to Dublin', at('#/settle', '#/renting')],
  ['#/work', 'Part-time work', at('#/work')]
]
const TITLES = [['#/areas', 'Explore areas'], ['#/explore', 'All areas'], ['#/eircode', 'Check an address'], ['#/shortlist', 'Compare'], ['#/compare', 'Compare'], ['#/cost', 'Cost of living'], ['#/stop', 'Commute'], ['#/settle', 'Moving to Dublin'], ['#/renting', 'Renting safely'], ['#/work', 'Part-time work'], ['#/method', 'Sources and methods']]

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => { const f = () => { setHash(location.hash); document.querySelector('main')?.scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return hash
}

export default function App() {
  const [data, setData] = useState(null), [err, setErr] = useState(null)
  const hash = useHash()
  const [s, setS] = useState(() => parseState(location.search, []))
  const [menu, setMenu] = useState(false)
  useEffect(() => { fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then((d) => { setData(d); setS(parseState(location.search, d.campuses.map((c) => c.id))) }).catch((e) => setErr(String(e))) }, [])
  useEffect(() => { checkSession() }, [])
  useEffect(() => { history.replaceState(null, '', `?${stateToSearch(s)}${location.hash}`) }, [s])
  useEffect(() => { setMenu(false); const t = TITLES.find(([p]) => hash.startsWith(p)); document.title = t ? `${t[1]} · Settld` : 'Settld: decide where to live in Dublin' }, [hash])
  const set = (patch) => setS((p) => ({ ...p, ...patch }))
  const saved = useShortlist()

  let body, bleed = false
  if (err) body = <div className="notice" role="alert"><p><b>The area data didn't load.</b> Check your connection and try again.</p><button className="btn sm" onClick={() => location.reload()}>Try again</button></div>
  else if (!data) body = <p className="notice" role="status">Loading Dublin…</p>
  else if (hash.startsWith('#/areas')) { body = <Finder data={data} s={s} set={set} initial={data.areas.some((a) => a.id === hash.split('/')[2]) ? hash.split('/')[2] : null} />; bleed = true }
  else if (hash.startsWith('#/explore')) { body = <Explore data={data} />; bleed = true }
  else if (hash.startsWith('#/eircode')) body = <Eircode data={data} code={decodeURIComponent(hash.split('/')[2] || '')} />
  else if (hash.startsWith('#/work')) body = <Work data={data} />
  else if (hash.startsWith('#/stop')) body = <Stop />
  else if (hash.startsWith('#/cost')) body = <CostPage data={data} s={s} set={set} />
  else if (hash.startsWith('#/settle')) body = <Settle />
  else if (hash.startsWith('#/method')) body = <Method data={data} />
  else if (hash.startsWith('#/renting')) body = <Renting />
  else if (hash.startsWith('#/shortlist') || hash.startsWith('#/compare')) body = <Shortlist data={data} s={s} set={set} shared={decodeURIComponent(hash.split('/')[2] || '')} />
  else body = <Home data={data} s={s} set={set} />

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top" data-open={menu}>
        <div className="top-in">
          <a className="brand" href="#/" aria-label="Settld home"><Logo />Settld</a>
          <nav className="nav" id="site-nav" aria-label="Main">
            {NAV.map(([href, label, on]) => (
              <a key={href} href={href} aria-current={on(hash) ? 'page' : undefined}>{label}{href === '#/shortlist' && saved.length > 0 && <span className="count" aria-label={`${saved.length} shortlisted`}>{saved.length}</span>}</a>))}
            <a className="nav-extra" href="#/method" aria-current={hash.startsWith('#/method') ? 'page' : undefined}>Sources and methods</a>
          </nav>
          <div className="top-actions">
            <a className="top-btn hide-md" href="#/method">Sources</a>
            <Feedback className="top-btn hide-sm" />
            <Account />
            <button type="button" className="top-btn menu-btn" aria-expanded={menu} aria-controls="site-nav" onClick={() => setMenu((m) => !m)}><Icon name={menu ? 'close' : 'menu'} size={20} /><span className="sr">Menu</span></button>
          </div>
        </div>
      </header>
      <main id="main" className={bleed ? 'bleed' : 'scroll'}>
        <ErrorBoundary resetKey={hash}><Suspense fallback={<p className="notice" role="status">Loading…</p>}>{body}</Suspense></ErrorBoundary>
      </main>
    </>
  )
}
