import React, { useEffect, useState } from 'react'
import Home from './components/Home.jsx'
import Finder from './components/Finder.jsx'
import Method from './components/Method.jsx'
import Work from './components/Work.jsx'
import Settle from './components/Settle.jsx'
import { parseState, stateToSearch } from './domain/model.js'

const DATA_URL = `${import.meta.env.BASE_URL}data/areas.json`
const NAV = [['#/', 'Start', (h) => h === '' || h === '#/' || h === '#'], ['#/areas', 'Areas', (h) => h.startsWith('#/areas')], ['#/work', 'Work', (h) => h.startsWith('#/work')], ['#/settle', 'Settling in', (h) => h.startsWith('#/settle')], ['#/method', 'Method', (h) => h.startsWith('#/method')]]

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => { const f = () => { setHash(location.hash); window.scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return hash
}

export default function App() {
  const [data, setData] = useState(null), [err, setErr] = useState(null)
  const hash = useHash()
  const [s, setS] = useState(() => parseState(location.search, []))
  useEffect(() => { fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then((d) => { setData(d); setS(parseState(location.search, d.campuses.map((c) => c.id))) }).catch((e) => setErr(String(e))) }, [])
  useEffect(() => { history.replaceState(null, '', `?${stateToSearch(s)}${location.hash}`) }, [s])
  const set = (patch) => setS((p) => ({ ...p, ...patch }))

  let body
  if (err) body = <p className="notice">Could not load the data ({err}). Please refresh.</p>
  else if (!data) body = <p className="notice">Loading data…</p>
  else if (hash.startsWith('#/areas')) body = <Finder data={data} s={s} set={set} />
  else if (hash.startsWith('#/work')) body = <Work data={data} />
  else if (hash.startsWith('#/settle')) body = <Settle />
  else if (hash.startsWith('#/method')) body = <Method data={data} />
  else body = <Home data={data} s={s} set={set} />
  const fullBleed = data && hash.startsWith('#/areas')

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <a className="brand" href="#/" aria-label="Which Dublin, start"><span className="mark" aria-hidden="true" />Which Dublin</a>
        <nav aria-label="Main">{NAV.map(([href, label, on]) => <a key={href} href={href} aria-current={on(hash) ? 'page' : undefined}>{label}</a>)}</nav>
      </header>
      <main id="main" className={fullBleed ? 'bleed' : 'scroll'}>{body}</main>
    </>
  )
}
