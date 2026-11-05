import React, { useEffect, useState } from 'react'
import Home from './components/Home.jsx'
import Finder from './components/Finder.jsx'
import Explore from './components/Explore.jsx'
import Eircode from './components/Eircode.jsx'
import Method from './components/Method.jsx'
import Work from './components/Work.jsx'
import Settle from './components/Settle.jsx'
import { parseState, stateToSearch } from './domain/model.js'
import { Logo, EircodeBox } from './components/ui.jsx'

const DATA_URL = `${import.meta.env.BASE_URL}data/areas.json`
const NAV = [['#/', 'Start', (h) => h === '' || h === '#/' || h === '#'], ['#/explore', 'Explore', (h) => h.startsWith('#/explore')], ['#/areas', 'Find my area', (h) => h.startsWith('#/areas')],
  ['#/work', 'Part-time work', (h) => h.startsWith('#/work')], ['#/settle', 'Settling in', (h) => h.startsWith('#/settle')], ['#/method', 'How we know', (h) => h.startsWith('#/method')]]

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
  useEffect(() => { history.replaceState(null, '', `?${stateToSearch(s)}${location.hash}`) }, [s])
  const set = (patch) => setS((p) => ({ ...p, ...patch }))

  let body, bleed = false
  if (err) body = <p className="notice">Could not load the data ({err}). Please refresh.</p>
  else if (!data) body = <p className="notice">Loading Dublin…</p>
  else if (hash.startsWith('#/areas')) { body = <Finder data={data} s={s} set={set} />; bleed = true }
  else if (hash.startsWith('#/explore')) { body = <Explore data={data} />; bleed = true }
  else if (hash.startsWith('#/eircode')) body = <Eircode data={data} code={decodeURIComponent(hash.split('/')[2] || '')} />
  else if (hash.startsWith('#/work')) body = <Work data={data} />
  else if (hash.startsWith('#/settle')) body = <Settle />
  else if (hash.startsWith('#/method')) body = <Method data={data} />
  else body = <Home data={data} s={s} set={set} />

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <div className="top-in">
          <a className="brand" href="#/" aria-label="Which Dublin, start"><Logo />Which Dublin</a>
          <nav className="nav" aria-label="Main">{NAV.map(([href, label, on]) => <a key={href} href={href} aria-current={on(hash) ? 'page' : undefined}>{label}</a>)}</nav>
          {data && !(hash === '' || hash === '#/' || hash.startsWith('#/eircode')) && <div className="top-eir"><EircodeBox small /></div>}
        </div>
      </header>
      <main id="main" className={bleed ? 'bleed' : 'scroll'}>{body}</main>
    </>
  )
}
