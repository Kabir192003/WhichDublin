import React from 'react'
import { CHECKED } from '../content/facts.js'

/** Provenance line used on every hand-maintained fact. Says plainly when we have not read the official page. */
export default function Source({ sources = [], check, note }) {
  return (
    <p className="source">
      Checked {CHECKED}. {check?.startsWith('secondary') ? 'Reported by universities, regulators or reputable outlets; not yet read on the official page. ' : ''}
      {note} {sources.length > 0 && <>Sources: {sources.map((s, i) => <React.Fragment key={s.url}>{i > 0 && ', '}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></React.Fragment>)}.</>}
    </p>
  )
}
