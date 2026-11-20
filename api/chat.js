// GET  /api/chat -> { enabled }: whether the assistant is switched on (a GEMINI_API_KEY is set).
// Common factual questions are answered instantly from facts.js (server/chat-quick.js) without calling the AI.
// POST /api/chat { messages: [{ role: 'user' | 'assistant', text }] } -> the answer as plain text. Live bus, Luas and
// train questions use tools (server/chat-tools.js) that read the timetable and the live NTA feeds.
// Answers only from Settld's own published data and facts (server/chat-knowledge.js). Nothing is stored here.
import { GoogleGenAI, ApiError } from '@google/genai'
import { buildKnowledge, RULES } from '../server/chat-knowledge.js'
import { TOOLS, runTool, nextDepartures } from '../server/chat-tools.js'
import { quickAnswer, parseTransport, formatDepartures } from '../server/chat-quick.js'
import { send, fail, crash, readJson, sameOrigin } from '../server/http.js'

// first that answers wins: a model Google has overloaded is skipped for the next one (Google's minimum deadline is 10 s)
// lightest first: each model has its own free-plan allowance, and Flash-Lite is the fastest
const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.6-flash').split(',').map((m) => m.trim()).filter(Boolean)
const MAX_TURNS = 12, MAX_CHARS = 1200, MAX_TOOL_ROUNDS = 3
let knowledge = { at: 0, text: null }

/** The area data is the same file the app loads, so the assistant can never drift from what the pages show. */
const originOf = (req) => { const host = req.headers['x-forwarded-host'] || req.headers.host; return `${req.headers['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https')}://${host}` }
async function getKnowledge(req) {
  if (knowledge.text && Date.now() - knowledge.at < 3_600_000) return knowledge.text
  const r = await fetch(`${originOf(req)}/data/areas.json`, { signal: AbortSignal.timeout(8000) })
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

function answer(res, text) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(text.trim() || 'Sorry, I couldn’t answer that. Try asking another way.')
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
    const t0 = Date.now(), log = (step) => console.log(`chat ${step} ${Date.now() - t0}ms`)
    const quick = quickAnswer(contents[contents.length - 1].parts[0].text)
    if (quick) { log('quick answer'); return answer(res, quick) }
    // a plain "next bus from X to Y": looked up and written in code, no AI needed
    const trip = parseTransport(contents[contents.length - 1].parts[0].text)
    if (trip) {
      const r = await nextDepartures(originOf(req), trip).catch(() => null)
      if (r && !(r.error && /No stop found/.test(r.error))) { log('direct departures'); return answer(res, formatDepartures(r, trip)) }
    }
    const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 12000 } })
    const gen = async (params) => {
      let last
      for (const model of MODELS) {
        try { return await ai.models.generateContent({ ...params, model }) } catch (e) {
          last = e; const busy = (e instanceof ApiError && [429, 500, 503, 504].includes(e.status)) || /timed? ?out|abort/i.test(String(e?.message))
          console.error('chat model', model, e?.status, String(e?.message).slice(0, 120)); if (!busy) throw e
        }
      }
      throw last
    }
    const config = { systemInstruction: `${RULES}\n\n${await getKnowledge(req)}`, maxOutputTokens: 8192, tools: TOOLS }
    log('knowledge')
    // tool rounds (live transport) first; the model's own turn is passed back unchanged so its thought signatures survive
    let lastNote = null
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const r = await gen({ contents, config })
      const calls = r.functionCalls || []
      log(`gemini round ${round}: ${calls.map((c) => c.name).join(',') || 'answer'}`)
      if (!calls.length) return answer(res, r.text || lastNote || '')
      contents.push(r.candidates[0].content)
      const results = await Promise.all(calls.map(async (c) => { const result = await runTool(originOf(req), c.name, c.args); if (result?.note && !result.departures?.length && !result.legs) lastNote = result.note; return { functionResponse: { id: c.id, name: c.name, response: { result } } } }))
      contents.push({ role: 'user', parts: results })
      log('tools')
    }
    const r = await gen({ contents, config: { ...config, toolConfig: { functionCallingConfig: { mode: 'NONE' } } } })
    answer(res, r.text || lastNote || '')
  } catch (e) {
    if (res.headersSent) { res.end('\n\n(The answer was cut off. Please ask again.)'); return }
    if (e instanceof ApiError && e.status === 429) return fail(res, 429, 'Lots of questions right now. Please try again in a minute.')
    console.error('chat failed', e?.status, e?.name, String(e?.message).slice(0, 300))
    if (e instanceof ApiError) { return fail(res, 502, 'The assistant is unavailable right now. Please try again shortly.') }
    await crash(res, e, 'The assistant is unavailable right now. Please try again shortly.')
  }
}
