import React, { useEffect, useRef, useState } from 'react'
import { getJson } from '../domain/api.js'
import { Icon } from './ui.jsx'

const SUGGEST = ['Cheapest areas under 30 minutes from UCD?', 'How much money do I need for my first month?', 'How much notice do I give to move out?', 'Can I work 40 hours a week in summer?']

/** Turns the answer's light markdown into React elements: **bold**, "- " lists and [text](#/page) links.
 * Only links inside Settld are made clickable; anything else stays plain text. No HTML is ever injected. */
export function renderAnswer(text) {
  const inline = (s, key) => s.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((p, i) => {
    const b = p.match(/^\*\*([^*]+)\*\*$/); if (b) return <b key={`${key}-${i}`}>{b[1]}</b>
    const l = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/); if (l) return /^#\/[\w/-]*$/.test(l[2]) ? <a key={`${key}-${i}`} href={l[2]}>{l[1]}</a> : l[1]
    return p
  })
  const out = []; let list = []
  const flush = (k) => { if (list.length) { out.push(<ul key={`u${k}`}>{list}</ul>); list = [] } }
  text.split('\n').forEach((line, i) => {
    const li = line.match(/^\s*[-*•]\s+(.*)/)
    if (li) { list.push(<li key={i}>{inline(li[1], i)}</li>); return }
    flush(i); if (line.trim()) out.push(<p key={i}>{inline(line, i)}</p>)
  })
  flush('end'); return out
}

/** "Ask Settld": answers from the app's own data. Shown only when the server has the assistant switched on. */
export default function Chat() {
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null), input = useRef(null)
  useEffect(() => { getJson('/api/chat').then((x) => setEnabled(!!x.enabled)).catch(() => {}) }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, open])
  useEffect(() => { if (open) input.current?.focus() }, [open])
  useEffect(() => { const close = () => setOpen(false); window.addEventListener('hashchange', close); return () => window.removeEventListener('hashchange', close) }, [])
  if (!enabled) return null

  async function ask(q) {
    const question = q.trim(); if (!question || busy) return
    const next = [...msgs, { role: 'user', text: question }]
    setMsgs([...next, { role: 'assistant', text: '' }]); setDraft(''); setBusy(true)
    const put = (text) => setMsgs([...next, { role: 'assistant', text }])
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.slice(-11) }) })
      if (!r.ok) { const j = await r.json().catch(() => ({})); put(j.error || 'The assistant is unavailable right now. Please try again shortly.'); return }
      const reader = r.body.getReader(), dec = new TextDecoder(); let text = ''
      for (;;) { const { done, value } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true }); put(text) }
      if (!text.trim()) put('Sorry, I couldn’t answer that. Try asking another way.')
    } catch { put('Couldn’t reach the assistant. Check your connection and try again.') } finally { setBusy(false) }
  }

  return (
    <>
      {!open && <button type="button" className="chat-fab" onClick={() => setOpen(true)} aria-haspopup="dialog"><Icon name="message" size={18} /> Ask Settld</button>}
      {open && (
        <section className="chat" role="dialog" aria-label="Ask Settld" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
          <header className="chat-head">
            <b>Ask Settld</b>
            <button type="button" className="chat-x" onClick={() => setOpen(false)} aria-label="Close"><Icon name="close" size={18} /></button>
          </header>
          <div className="chat-body" aria-live="polite">
            {msgs.length === 0 && <>
              <p className="hint" style={{ marginTop: 0 }}>Ask about areas, rent, commuting, costs, renting rules, settling in or part-time work. Answers come from Settld’s own data, with links to the page.</p>
              <div className="chat-suggest">{SUGGEST.map((s) => <button type="button" key={s} onClick={() => ask(s)}>{s}</button>)}</div>
            </>}
            {msgs.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}>{m.role === 'user' ? m.text : m.text ? renderAnswer(m.text) : <span className="hint">Thinking…</span>}</div>)}
            <div ref={end} />
          </div>
          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); ask(draft) }}>
            <label className="sr" htmlFor="chat-q">Your question</label>
            <input id="chat-q" ref={input} className="select" value={draft} maxLength={1200} onChange={(e) => setDraft(e.target.value)} placeholder="Ask a question" autoComplete="off" />
            <button type="submit" className="btn" disabled={busy || !draft.trim()} aria-label="Send"><Icon name="arrow" size={18} /></button>
          </form>
          <p className="chat-note">Answers are written by Google Gemini from Settld’s data and can be wrong: check the linked page. Questions are sent to Google, which may use them to improve its products, so don’t share personal details.</p>
        </section>)}
    </>
  )
}
