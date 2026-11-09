import React, { useState } from 'react'
import { useAccount, login, signup, logout } from '../domain/account.js'
import { Icon } from './ui.jsx'

/** Fully optional sign-in, just to keep a saved-areas list across devices. No real-world identity
 * is collected, and the form says so plainly rather than leaving people to assume otherwise. */
export default function Account() {
  const username = useAccount()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('login')   // 'login' | 'signup'
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  if (username) {
    return (
      <div className="pill" style={{ gap: 8 }}>
        <Icon name="check" size={15} stroke={2.2} />
        <span>{username}</span>
        <button type="button" className="link" onClick={() => logout()}>Sign out</button>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      if (mode === 'signup') await signup(user, pass); else await login(user, pass)
      setOpen(false); setUser(''); setPass('')
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  if (!open) return <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>Sign in</button>

  return (
    <div className="card lift doc" style={{ position: 'absolute', right: 16, top: 64, zIndex: 20, width: 300, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>{mode === 'signup' ? 'Create an account' : 'Sign in'}</strong>
        <button type="button" className="link" onClick={() => setOpen(false)} aria-label="Close">×</button>
      </div>
      <p className="hint" style={{ margin: '0 0 10px' }}>Fully optional, only used to keep your saved areas across devices. No name, email or anything else is asked for. Use a made-up username, and a password you don't use anywhere important.</p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="pill"><span className="k">Username</span>
          <input className="select" style={{ border: 'none', minHeight: 34, width: '100%' }} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" required minLength={3} maxLength={24} /></label>
        <label className="pill"><span className="k">Password</span>
          <input className="select" style={{ border: 'none', minHeight: 34, width: '100%' }} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={5} /></label>
        {mode === 'signup' && <p className="hint" style={{ margin: 0 }}>At least 5 characters, nothing else required.</p>}
        {err && <p className="notice" style={{ margin: 0 }}>{err}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(null) }}>
          {mode === 'signup' ? 'Already have an account? Sign in' : "No account yet? Create one"}
        </button>
      </form>
    </div>
  )
}
