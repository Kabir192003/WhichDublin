import React from 'react'
export const eur = (n) => `€${Math.round(n).toLocaleString('en-IE')}`
export const SHORT = { tcd: 'Trinity', ucd: 'UCD', dcu: 'DCU', tud: 'TU Dublin', rcsi: 'RCSI', nci: 'NCI', dbs: 'DBS', griffith: 'Griffith', iadt: 'IADT' }
export const CONF = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }
export const Conf = ({ level }) => level ? <span className={`conf conf-${level}`}>{CONF[level]}</span> : null
export const Icon = ({ d }) => <svg className="ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
