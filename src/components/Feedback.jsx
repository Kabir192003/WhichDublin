import React, { useState } from 'react'
import { health, postJson } from '../domain/api.js'

const KINDS = [['wrong-data', 'A number looks wrong'], ['bug', 'Something is broken'], ['idea', 'An idea'], ['other', 'Something else']]

/** "Feedback" in the top bar: a small form that goes to our database, or GitHub issues when the site has no server. */
export default function Feedback() {
  const [open, setOpen] = useState(false), [kind, setKind] = useState('wrong-data'), [text, setText] = useState('')
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(null)
  const start = async () => {
    const h = await health()
    if (!h.database) { window.open('https://github.com/Kabir192003/WhichDublin/issues/new', '_blank', 'noopener'); return }
    setMsg(null); setOpen(true)
  }
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    try { await postJson('/api/feedback', { kind, message: text, page: location.hash || '#/' }); setMsg({ ok: true, t: 'Thanks, we got it.' }); setText('') }
    catch (err) { setMsg({ ok: false, t: err.message }) } finally { setBusy(false) }
  }
  return (
    <>
      <button type="button" className="saved-link" style={{ border: 0, cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700, marginLeft: 0 }} onClick={start}>Feedback</button>
      {open && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="fb-h" onClick={() => setOpen(false)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={send} style={{ maxWidth: 520 }}>
            <div className="modal-head"><h2 id="fb-h">Tell us</h2><button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>Close</button></div>
            <div className="choices" role="group" aria-label="What is it about" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', margin: '8px 0 12px' }}>
              {KINDS.map(([k, l]) => <button type="button" key={k} className="choice" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
            </div>
            <label htmlFor="fb-text" className="flabel" style={{ marginBottom: 6 }}>What happened?</label>
            <textarea id="fb-text" className="select" required minLength={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. The Lidl near Drumcondra closed in October" />
            {msg && <p className={`form-msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.t}</p>}
            <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button></div>
            <p className="hint">No account and no email needed. We store your message and which page you were on, nothing else.</p>
          </form>
        </div>)}
    </>
  )
}
