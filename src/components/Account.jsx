import React, { useState } from 'react'
import { useAccount, login, signup, logout } from '../domain/account.js'
import { Icon, Modal } from './ui.jsx'

/** Optional sign-in. Its only purpose is keeping your shortlist across devices, and the form says so. */
export default function Account({ className = 'top-btn outline' }) {
  const username = useAccount()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('login')
  const [user, setUser] = useState(''), [pass, setPass] = useState('')
  const [err, setErr] = useState(null), [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true)
    try { await (mode === 'signup' ? signup(user, pass) : login(user, pass)); setOpen(false); setUser(''); setPass('') }
    catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  const input = { className: 'select', style: { width: '100%' } }

  return (
    <>
      <button type="button" className={className} onClick={() => { setErr(null); setOpen(true) }}>
        <Icon name="user" size={16} />{username || 'Sign in'}
      </button>
      {open && username && (
        <Modal title="Your account" onClose={() => setOpen(false)} width={420}>
          <p>Signed in as <b>{username}</b>. Your shortlist is saved to this account and follows you to other devices.</p>
          <div className="actions"><button className="btn ghost" onClick={async () => { await logout(); setOpen(false) }}>Sign out</button></div>
          <p className="hint">Signing out keeps the shortlist in this browser.</p>
        </Modal>)}
      {open && !username && (
        <Modal as="form" title={mode === 'signup' ? 'Create an account' : 'Sign in'} onClose={() => setOpen(false)} width={420} onSubmit={submit}>
          <p className="hint" style={{ marginTop: 0 }}>Optional. An account only keeps your shortlist across devices. We don't ask for a name or email, so use a made-up username and a password you don't use anywhere else.</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <label className="field"><span className="flabel">Username</span>
              <input {...input} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" required minLength={3} maxLength={24} /></label>
            <label className="field"><span className="flabel">Password</span>
              <input {...input} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={5} />
              {mode === 'signup' && <span className="hint">At least 5 characters. It can't be recovered if you forget it.</span>}</label>
            {err && <p className="form-msg err" role="alert">{err}</p>}
            <button className="btn" type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
            <button type="button" className="link" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(null) }}>
              {mode === 'signup' ? 'I already have an account' : 'Create an account instead'}
            </button>
          </div>
        </Modal>)}
    </>
  )
}
