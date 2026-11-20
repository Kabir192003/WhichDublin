// Instant answers to the common factual questions, straight from Settld's facts (no AI call): free, instant, and
// they work when the AI is busy. Only a clear match on exactly one topic is answered; anything else goes to the AI.
import { WAGE, STUDENT_WORK, IRP, LEAP, RIGHTS, RENTING } from '../src/content/facts.js'
import { hourLimit } from '../src/domain/model.js'

const eur = (n) => `€${Number(n).toFixed(2).replace(/\.00$/, '')}`
const dublinDate = (d) => new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Dublin' }))

/** [notice band index] for a tenancy of `months` months. */
function noticeBand(months) {
  const edges = [6, 12, 24, 48, 96]
  const i = edges.findIndex((e) => months < e)
  return i < 0 ? RIGHTS.notice.length - 1 : i
}

const TOPICS = [
  ['hours', (q) => /\b(hours?|hrs)\b/.test(q) && /\b(work|working|job|jobs|part[ -]?time|stamp ?2|allowed|limit)\b/.test(q), (q, now) => {
    const lim = hourLimit(dublinDate(now), STUDENT_WORK)
    return `On Stamp 2 (non-EEA students on a full-time course on the official list) you can work **up to ${STUDENT_WORK.termHours} hours a week in term** and **up to ${STUDENT_WORK.holidayHours} hours a week in the holidays** (${STUDENT_WORK.holidays.map((h) => h.label).join(' and ')}). Right now the limit is **${lim.hours} hours a week**. ${STUDENT_WORK.rule} Stamp 2A does not allow work; EU/EEA and Irish students have no cap.\n\nMore on the [Part-time work](#/work) page. The official source is irishimmigration.ie.`
  }],
  ['wage', (q) => /minimum wage|min wage|\bwage\b|hourly (rate|pay)|per hour|an hour/.test(q) && !/\bhours? a week\b/.test(q), () =>
    `The national minimum wage is **${eur(WAGE.adult)} an hour** for ${WAGE.ageNote}, from ${WAGE.from}. Younger workers have a lower legal minimum: ${WAGE.youth.map((y) => `${y.label} ${eur(Math.round(WAGE.adult * y.pct) / 100)}`).join(', ')}.\n\nSee what a week or month of work earns on the [Part-time work](#/work) page.`],
  ['notice', (q) => /\bnotice\b/.test(q) && /(leav|move out|moving out|end|landlord|tenan|lease|give|quit)/.test(q), (q) => {
    const m = q.match(/(\d+(?:\.\d+)?)\s*(month|months|mo|year|years|yr|yrs)\b/)
    const months = m ? Number(m[1]) * (m[2].startsWith('y') ? 12 : 1) : null
    const head = months != null ? (() => { const [len, days] = RIGHTS.notice[noticeBand(months)]; return `After ${m[1]} ${m[2]}, that's the **${len.toLowerCase()}** band: you give **${days}' notice**.\n\n` })() : ''
    return `${head}The notice you give your landlord depends on how long you've lived there:\n${RIGHTS.notice.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n${RIGHTS.noticeNotes.join(' ')}\n\nMore on [Renting safely](#/renting).`
  }],
  ['deposit', (q) => /\bdeposit\b/.test(q), (q) => /\b(back|return|keep|kept|refund)\b/.test(q)
    ? `${RIGHTS.deposit}\n\nMore on [Renting safely](#/renting).`
    : `${RENTING.deposit} ${RENTING.depositNote}\n\nMore on [Renting safely](#/renting).`],
  ['irp', (q) => /\b(irp|gnib|immigration registration|register with immigration|residence permit)\b/.test(q), () =>
    `If you're from outside the EU/EEA and studying for more than 90 days, register for an Irish Residence Permit (IRP) within **${IRP.deadline}**. The fee is **€${IRP.fee}** (card only). In Dublin it's at ${IRP.where}.\n${IRP.steps.map((s) => `- ${s}`).join('\n')}\n\nThe documents list and booking link are on [Moving to Dublin](#/settle).`],
  ['leap', (q) => /\bleap\b|\bfares?\b|ticket price|how much is the bus/.test(q), () =>
    `With a Leap card, one Dublin 90-minute fare covers unlimited bus, Luas and DART/Commuter rail rides within 90 minutes:\n${LEAP.cards.map((c) => `- ${c.name} (${c.who.split(' (')[0]}): ${eur(c.fare)}`).join('\n')}\n\nA student or young adult card halves most fares. ${LEAP.notConfirmed}\n\nMore on [Moving to Dublin](#/settle).`],
  ['rent-rise', (q) => /rent (increase|rise|review|go up|going up)|(increase|raise|put up).{0,20}rent|how much can .{0,30}rent/.test(q), () =>
    `${RIGHTS.rent}\n\nMore on [Renting safely](#/renting).`]
]

/** The instant answer for a question about one of the common topics, or null to let the AI answer. */
export function quickAnswer(text, now = new Date()) {
  const q = String(text).toLowerCase()
  if (q.length > 200) return null   // long questions usually combine things: the AI handles them
  const hits = TOPICS.filter(([, test]) => test(q))
  return hits.length === 1 ? hits[0][2](q, now) : null
}

/** "next bus from X to Y", "when is the luas from X", "buses from 786": the places, or null if it isn't that question. */
export function parseTransport(text) {
  const q = String(text).trim().replace(/[?!.]+$/, '')
  if (!/\b(bus|buses|luas|tram|trams|train|trains|dart)\b/i.test(q) || !/\bfrom\b/i.test(q)) return null
  if (/\b(cheap|rent|cost|price|area|areas|live)\b/i.test(q)) return null   // about where to live, not a departure
  const m = q.match(/\bfrom\s+(.+?)(?:\s+(?:to|towards|for)\s+(?:the\s+)?(.+?))?(?:\s+(?:now|tonight|today|right now|please))?$/i)
  if (!m) return null
  const clean = (s) => s && s.replace(/^(the|stop)\s+/i, '').trim()
  return { from: clean(m[1]), to: clean(m[2]) || undefined }
}

/** The tool result, written out for a student. */
export function formatDepartures(r, { from, to }) {
  if (r.error) return `${r.error.replace('Ask the user for', 'Try')}\n\nYou can also search by stop name or number on the [Commute](#/stop) page.`
  if (r.liveBoards?.length) {   // Luas and trains: the operator's own live board is the real answer
    const b = r.liveBoards[0]
    const rows = b.kind === 'tram'
      ? b.directions.map((d) => `- **${d.name}**: ${d.trams.slice(0, 3).map((t) => `${t.destination} ${t.due === 0 ? 'due now' : `in ${t.due} min`}`).join(', ')}`)
      : (b.trains || []).slice(0, 5).map((t) => `- **${t.destination}**: in ${t.due} min${t.late > 0 ? ` (${t.late} min late)` : ''}, departs ${t.departs}`)
    if (rows.length) return `Live ${b.kind === 'tram' ? 'Luas' : 'trains'} at **${b.station}** (now ${r.now}):\n${rows.join('\n')}${b.message ? `\n\n${b.message}` : ''}\n\nLive times from ${b.kind === 'tram' ? 'Transport Infrastructure Ireland' : 'Irish Rail'}. More on the [Commute](#/stop) page.`
  }
  if (r.departures) {
    if (!r.departures.length) return `${r.note || 'No departures found.'}\n\nThe live board is on the [Commute](#/stop) page.`
    const lines = r.departures.slice(0, 5).map((d) => {
      const when = d.live && d.expected ? `**${d.expected}** (due ${d.scheduled}${d.delayMin ? `, ${d.delayMin > 0 ? `${d.delayMin} min late` : `${-d.delayMin} min early`}` : ', on time'}${d.liveAtThisStop ? '' : ', estimated'})` : `**${d.scheduled}** (timetable only)`
      return `- **${d.route}** towards ${d.towards}: ${when}${d.rideMinutes != null ? `, about ${d.rideMinutes} min to ${d.to}` : ''}, from ${d.from}`
    })
    return `Next departures from ${from}${to ? ` to ${to}` : ''} (now ${r.now}):\n${lines.join('\n')}\n\nLive times come from the National Transport Authority. The live board is on the [Commute](#/stop) page.`
  }
  if (r.legs) {
    const legs = r.legs.map((l) => l.walk ? `- Walk ${l.walk}` : `- **${l.route}** from ${l.from} at ${l.departs}, to ${l.to} (${l.arrives})`)
    const live = r.firstLegLive?.[0]?.expected ? `\nThe first bus is expected at **${r.firstLegLive[0].expected}** (live).` : ''
    return `No single route goes from ${from} to ${to}. Quickest from now, with ${r.changes} change${r.changes === 1 ? '' : 's'}, arriving about ${r.arrive}:\n${legs.join('\n')}${live}\n\nTimes are from the timetable. Plan it on the [Commute](#/stop) page for live times on every leg.`
  }
  return `${r.note || 'No journey found.'}\n\nTry the journey planner on the [Commute](#/stop) page.`
}
