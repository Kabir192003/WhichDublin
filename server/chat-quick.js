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
