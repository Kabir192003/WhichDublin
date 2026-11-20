// GET  /api/chat -> { enabled }: whether the assistant is switched on (a GEMINI_API_KEY is set).
// POST /api/chat { messages: [{ role: 'user' | 'assistant', text }] } -> the answer, streamed as plain text.
// Answers only from Settld's own published data and facts (server/chat-knowledge.js). Nothing is stored here.
import { GoogleGenAI, ApiError } from '@google/genai'
import { buildKnowledge, RULES } from '../server/chat-knowledge.js'
import { send, fail, crash, readJson, sameOrigin } from '../server/http.js'

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const MAX_TURNS = 12, MAX_CHARS = 1200
let knowledge = { at: 0, text: null }

/** The area data is the same file the app loads, so the assistant can never drift from what the pages show. */
async function getKnowledge(req) {
  if (knowledge.text && Date.now() - knowledge.at < 3_600_000) return knowledge.text
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https')
  const r = await fetch(`${proto}://${host}/data/areas.json`)
  if (!r.ok) throw new Error(`areas.json ${r.status}`)
  knowledge = { at: Date.now(), text: buildKnowledge(await r.json()) }
  return knowledge.text
}

/** Untrusted input: a short, well-formed conversation that ends with the user's question. */
export function cleanMessages(body) {
  const list = Array.isArray(body?.messages) ? body.messages : null
  if (!list || !list.length || list.length > MAX_TURNS) return null
  const out = []
  for (const m of list) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.text !== 'string') return null
    const text = m.text.trim().slice(0, MAX_CHARS)
    if (!text) return null
    out.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text }] })
  }
  return out[out.length - 1].role === 'user' ? out : null
}

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY
  if (req.method === 'GET') return send(res, 200, { enabled: !!key }, 'public, s-maxage=300')
  if (req.method !== 'POST') return fail(res, 405, 'GET or POST only')
  if (!key) return fail(res, 503, 'The assistant is not switched on yet')
  if (!sameOrigin(req)) return fail(res, 403, 'Same-origin requests only')
  try {
    const contents = cleanMessages(await readJson(req, 32 * 1024))
    if (!contents) return fail(res, 400, 'Send messages: a short conversation ending with your question')
    const ai = new GoogleGenAI({ apiKey: key })
    const stream = await ai.models.generateContentStream({
      model: MODEL, contents,
      config: { systemInstruction: `${RULES}\n\n${await getKnowledge(req)}`, maxOutputTokens: 1500 }
    })
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    for await (const chunk of stream) if (chunk.text) res.write(chunk.text)
    res.end()
  } catch (e) {
    if (res.headersSent) { res.end('\n\n(The answer was cut off. Please ask again.)'); return }
    if (e instanceof ApiError && e.status === 429) return fail(res, 429, 'Lots of questions right now. Please try again in a minute.')
    if (e instanceof ApiError) { console.error('gemini', e.status, e.message); return fail(res, 502, 'The assistant is unavailable right now. Please try again shortly.') }
    await crash(res, e, 'The assistant is unavailable right now. Please try again shortly.')
  }
}
