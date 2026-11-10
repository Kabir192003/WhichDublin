/**
 * Hand-maintained facts. Every entry carries where it came from, when we checked, and how sure we are.
 * `check: 'official'` = read on the official page; `check: 'secondary'` = reported by a university, regulator
 * notice or reputable outlet but not yet read on the official page. Prices we could not confirm are NOT included.
 */
export const CHECKED = '4 Nov 2026'

export const WAGE = {
  adult: 14.15, from: '1 January 2026', ageNote: 'workers aged 20 and over',
  youth: [{ label: '19 years old', pct: 90 }, { label: '18 years old', pct: 80 }, { label: 'Under 18', pct: 70 }],
  source: { name: 'Ibec (National Minimum Wage Order 2025)', url: 'https://www.ibec.ie/employer-hub/latest-hr-and-ir-news/news/2025/12/22/national-minimum-wage-increases-to-14-euro-15-cent-per-hour-from-january-1-2026' },
  check: 'secondary'
}

export const STUDENT_WORK = {
  termHours: 20, holidayHours: 40,
  holidays: [{ from: [5, 1], to: [8, 30], label: '1 June to 30 September' }, { from: [11, 15], to: [0, 15], label: '15 December to 15 January' }], // [month0, day]
  applies: 'Non-EEA students on Stamp 2 permission (full-time courses on the official list). Stamp 2A does not allow work. EU/EEA and Irish students have no such cap.',
  rule: 'The limit is per week, not an average over the term.',
  sources: [
    { name: 'UCD Global: working in Ireland', url: 'https://www.ucd.ie/global/studentexperience/workinginireland/' },
    { name: 'Workplace Relations Commission notice', url: 'https://workplacerelations.ie/en/news-media/workplace_relations_notices/changes_to_employment_entitlements_of_non-eea_students_holding_immigration_stamp_2.html' }
  ],
  official: 'https://www.irishimmigration.ie',
  check: 'secondary'
}

export const JOB_BOARDS = [
  { name: 'Indeed Ireland', url: 'https://ie.indeed.com/jobs?q=part+time&l=Dublin' },
  { name: 'Jobs.ie', url: 'https://www.jobs.ie/' },
  { name: 'Your college careers service', url: null }
]

export const IRP = {
  fee: 300, deadline: '90 days from arrival',
  where: 'Burgh Quay Registration Office, 13-14 Burgh Quay, Dublin 2 (for people living in Dublin)',
  steps: [
    'Book an appointment online on the Irish Immigration (ISD) site. There are no walk-ins, and slots can fill fast, so check regularly.',
    'Pay the €300 registration fee. The official page says card only (credit or debit).',
    'Attend your appointment with your documents. Your card is posted to you afterwards.'
  ],
  docs: [
    'Valid passport',
    'Your visa or immigration permission, if you needed one to enter',
    'Letter of acceptance or enrolment from your college',
    'Evidence your fees are paid',
    'Private medical insurance valid for your studies',
    'Evidence you can support yourself (the amount differs between sources, so check the current figure)',
    'Proof of address in Ireland',
    'Your appointment confirmation'
  ],
  docsNote: 'The document list below is compiled from university and agency guides. The official list is the one that counts: open it the week before your appointment.',
  sources: [
    { name: 'Irish Immigration: registering your permission', url: 'https://www.irishimmigration.ie/registering-your-immigration-permission/' },
    { name: 'Required documents (official)', url: 'https://www.irishimmigration.ie/registering-your-immigration-permission/how-to-register-your-immigration-permission-for-the-first-time/required-documents/' }
  ],
  check: 'secondary (fee, location and 90-day rule match the official page as quoted in search results)'
}

export const LEAP = {
  cards: [
    { name: 'Adult Leap', who: 'Anyone', fare: 2 },
    { name: 'Young Adult Leap', who: 'Ages 19 to 25', fare: 1 },
    { name: 'Student Leap', who: 'Full-time third-level students (collected in person at a Student Leap agent, where your student status is checked)', fare: 1 }
  ],
  fareNote: 'The Dublin 90-minute fare: one fare covers unlimited bus, Luas and DART/Commuter rail rides within 90 minutes in the Dublin area.',
  notConfirmed: 'We could not confirm the card issue fee or the daily and weekly caps, so we do not show them. Check on leapcard.ie.',
  sources: [{ name: 'Transport for Ireland: fare reductions', url: 'https://www.transportforireland.ie/fares-reductions' }, { name: 'Leap Card', url: 'https://www.leapcard.ie' }],
  check: 'secondary'
}

export const BANKS = [
  { name: 'Bank of Ireland', product: 'Third Level account', note: 'Has an account-opening service aimed at international students and returning emigrants. Described as having no maintenance fee.', url: 'https://www.bankofireland.com/about-bank-of-ireland/press-releases/2025/bank-of-ireland-launches-new-account-opening-service-to-support-returning-emigrants-and-international-students/' },
  { name: 'AIB', product: 'Student Plus account', note: 'For full-time third-level students on a course of at least one academic year. May ask for two address documents if you are not yet resident.', url: 'https://aib.ie' },
  { name: 'PTSB', product: 'Student current account', note: 'Reported to be opened in a branch, with proof of enrolment.', url: 'https://www.ptsb.ie' },
  { name: 'Revolut', product: 'Digital account', note: 'Can be opened before you arrive. Useful for daily spending; some people find an Irish bank account is still needed for salary and rent.', url: 'https://www.revolut.com' }
]
export const BANK_DOCS = ['Passport or national ID', 'College acceptance or enrolment letter', 'Proof of address (an accommodation letter or home-country bill is often accepted)', 'A PPS number is generally not needed to open a student account']
export const BANK_SOURCES = [{ name: 'Education in Ireland: banking', url: 'https://www.educationinireland.com/en/living-in-ireland/banking-in-ireland' }]
export const BANK_CHECK = 'secondary. Fees and exact requirements change: confirm with each bank.'

export const MOBILE = {
  networks: [
    { name: 'Three', network: 'Own network', url: 'https://www.three.ie' },
    { name: 'Vodafone', network: 'Own network', url: 'https://www.vodafone.ie' },
    { name: 'eir', network: 'Own network', url: 'https://www.eir.ie' },
    { name: 'Tesco Mobile', network: "Runs on Three's network", url: 'https://www.tescomobile.ie' },
    { name: 'GoMo', network: "eir's digital-only brand", url: 'https://www.gomo.ie' }
  ],
  tips: [
    'Compare coverage at your own address on the regulator ComReg\'s tool, not only price.',
    'Prepay (top-up) needs no contract. Monthly plans can be better value but check the minimum term.',
    'An eSIM lets you set up before you land if your phone supports it.',
    'If you are buying at the airport, expect to pay more than in a shop or online.'
  ],
  notConfirmed: 'We do not show plan prices: they change often and we could not confirm current figures from the operators\' own pages. Use the links to see today\'s prices.',
  sources: [{ name: 'ComReg: compare coverage', url: 'https://www.comreg.ie' }],
  check: 'secondary'
}

export const RENT_NEW_TENANCY = {
  quarter: '2025 Q4',
  dublinNew: 2232,
  dublinExisting: 1939,
  intro: "The RTB itself splits its data the same way, by how long the tenancy has run. The figures on this page come from its 'existing tenancies' series, which includes long-standing tenancies capped by Rent Pressure Zone rules years ago. Its separate 'new tenancies' series tracks only tenancies that have just started, so it sits much closer to what you'd actually be quoted moving in today.",
  sources: [
    { name: 'RTB Rent Index, Q4 2025', url: 'https://rtb.ie/wp-content/uploads/2026/05/RTB-Rent-Index-Q4-2025.pdf' },
    { name: "RTB Director's Quarterly Update, May 2026", url: 'https://www.rtb.ie/wp-content/uploads/2026/05/RTB-Directors-Quarterly-Update-May-2026.pdf' }
  ],
  granularity: 'The RTB publishes this split for County Dublin as a whole (and by local electoral area in its own appendices), not for our 106 named areas, so this is one Dublin-wide figure, not an area-by-area one.',
  check: 'secondary. We could not reach rtb.ie directly from our build environment, so these figures are as reported in search results citing the RTB’s own PDF and its Director’s Quarterly Update, not read directly from the PDF ourselves.'
}

export const RENT_COMPARISON = {
  dublinQuarter: '2025 Q4',
  dublinTwoBedApartment: { low: 2517, high: 2696 },
  intro: "The RTB figures on this page track rents of tenancies already registered, which can run behind the live market (see above). Daft.ie's own quarterly Rental Price Report measures something different: the asking prices of homes currently advertised for rent.",
  why: [
    'Timing: a tenancy agreed several months ago may only be registered with the RTB this quarter, so the RTB figure can reflect older rents in a rising market.',
    "Different homes: Daft's figures lean towards properties being let for the first time, which are not bound by the lower rent-increase caps that apply to a sitting tenant's existing lease in a Rent Pressure Zone. The RTB figures include many long-standing, capped tenancies, which pulls that average down further.",
    'Neither figure is the rent for one specific home: Daft reports what is being asked right now; the RTB reports what was actually agreed and registered.'
  ],
  granularity: "Daft splits Dublin into a handful of broad zones, not the 106 named areas we use, so we can only show one Dublin-wide figure for comparison, not an area-by-area one.",
  sources: [
    { name: 'RTÉ: Daft.ie Rental Price Report coverage', url: 'https://www.rte.ie/news/rental-prices' },
    { name: "Echo Live: rental supply hits record low as prices keep climbing", url: 'https://www.echolive.ie/nationalnews/arid-41799134.html' },
    { name: 'rentprices.ie: Daft Rental Report vs RTB Rent Index, why the figures differ', url: 'https://rentprices.ie/guides/daft-report-vs-rtb-rent-index/' }
  ],
  check: 'secondary. We could not reach daft.ie, reports.daft.ie or rte.ie directly to read the report or Daft\'s terms of use, so this figure is as reported by press coverage of Daft\'s report, not read from Daft directly, and press accounts of the same figure varied by a few percent.'
}

export const RENTING = {
  deposit: 'A deposit can be at most one month’s rent, and advance rent to secure a place at most one month. So you can’t be asked for more than two months’ rent in total to secure a tenancy.',
  depositNote: 'From the Residential Tenancies (No. 2) Act 2021. Purpose-built student accommodation can have different payment rules, so check its contract.',
  depositSources: [{ name: 'RTB: Residential Tenancies (No.2) Act 2021 FAQ', url: 'https://www.rtb.ie/images/uploads/general/RTA22021_FAQs_July_2021_Update_(2).pdf' }],
  scamSigns: [
    ['viewing', 'They want a deposit or holding fee before you have viewed the place (in person or by a live video call they run in the property).'],
    ['abroad', 'The “landlord” is abroad or busy and can’t show you the place, so sends photos or documents instead.'],
    ['payment', 'They ask for cash, a money transfer service, crypto, or a payment you can’t trace or reverse.'],
    ['rush', 'You are rushed: “lots of people want it”, “pay today to hold it”.'],
    ['cheap', 'The rent is far below what similar places in the area cost (compare with this app).'],
    ['details', 'They want your money but not your references, ID or details.'],
    ['keys', 'They will post the keys after you pay.']
  ],
  checks: [
    'View the place before paying anything, and try the key in the door.',
    'Get a written agreement and a receipt for every payment, paid to a bank account in the landlord’s or agent’s name.',
    'Landlords must register tenancies with the Residential Tenancies Board (RTB). Ask about it.',
    'Take dated photos of the condition on move-in day.',
    'Unsure? Call Threshold’s free helpline before you send money: 1800 454 454.'
  ],
  scamSources: [
    { name: 'TU Dublin: renting private accommodation', url: 'https://www.tudublin.ie/for-students/student-services-and-support/accommodation--living-in-dublin/campus-commute/renting-private-accommodation/' },
    { name: 'Irish Times: students warned of a spike in accommodation scams (Aug 2026)', url: 'https://www.irishtimes.com/ireland/housing-planning/2026/08/25/students-warned-of-spike-in-accommodation-scams-as-they-return-to-college/' },
    { name: 'RTÉ: how to avoid student accommodation scams', url: 'https://www.rte.ie/lifestyle/living/2025/0902/1531342-how-to-avoid-student-accommodation-scams-this-autumn' }
  ],
  digs: 'Renting a room in the owner’s own home (“digs”) is usually a licence, not a tenancy. Most RTB protections, including its dispute service, do not apply, so agree notice, house rules and what’s included in writing. Owners can earn up to €14,000 a year tax-free under Rent-a-Room relief.',
  digsSources: [{ name: 'Revenue: Rent-a-Room relief', url: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/land-and-property/rent-a-room-relief/qualifying-conditions.aspx' }, { name: 'Dún Laoghaire-Rathdown: Room for a Student FAQ', url: 'https://www.dlrcoco.ie/sites/default/files/2024-03/Room%20for%20a%20Student%20-%20LA%20Tenancies%20FAQ.pdf' }],
  hap: 'HAP (Housing Assistance Payment) is a social housing support run by local councils for people with a long-term housing need. Most full-time students will not qualify; ask your council if your situation is different.',
  check: 'secondary'
}

/** Household running costs, monthly, for a whole home. Ranges, with where each number comes from. */
export const BILLS = {
  electricity: { low: 90, typical: 150, high: 180, note: 'Average household €1,794 a year (CRU estimated annual bill, August 2025). Small flats use less.', source: { name: 'Oireachtas written answer quoting CRU (Nov 2025)', url: 'https://www.oireachtas.ie/en/debates/question/2025-11-04/211/' } },
  gas: { low: 0, typical: 60, high: 125, note: 'About €1,430–€1,480 a year for a gas-heated home. Many flats are all-electric (no gas bill).', source: { name: 'Selectra: average gas and electricity bill', url: 'https://selectra.ie/energy/guides/billing/average-gas-electricity-bill' } },
  broadband: { low: 40, typical: 50, high: 70, note: 'Typical home broadband €40–€70 a month.', source: { name: 'Expat Focus: broadband in Ireland', url: 'https://www.expatfocus.com/?p=24089' } },
  check: 'secondary'
}
export const GROCERIES = { low: 90, typical: 120, high: 160, note: 'Per person, shopping mainly at Lidl and Aldi and cooking at home. Typical is set at €120 a month; published student guides quote higher (€150–€350), so use "Your groceries" if you eat out more.', sources: [{ name: 'Study in Europe: student cost of living in Dublin', url: 'https://www.studyineurope.eu/student-cost-of-living-in-dublin/' }, { name: 'UniAcco: cost of living in Dublin', url: 'https://uniacco.com/blog/cost-of-living-in-dublin' }] }
export const PHONE = { typical: 15, note: 'A SIM-only plan; many are around €10–€20 a month.' }
/** How a home's energy rating moves the energy part of the bill (rough, for the range only). */
export const BER_FACTOR = { ab: { label: 'A or B', f: 0.7 }, c: { label: 'C', f: 0.9 }, d: { label: 'D', f: 1.05 }, eg: { label: 'E, F or G', f: 1.35 }, unknown: { label: "Don't know", f: null } }

export const BER = {
  intro: 'Every home advertised for rent in Ireland must show its Building Energy Rating (BER). It runs from A1 (most energy-efficient) to G (least). It’s on the ad, usually as a coloured badge, sometimes with a number in kWh/m²/yr.',
  scale: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1', 'D2', 'E1', 'E2', 'F', 'G'],
  what: [
    'The rating is the energy the home needs per square metre each year for heating, hot water, lighting and ventilation. The lower the number, the less energy it needs.',
    'For two homes of the same size, one with double the kWh/m²/yr figure needs roughly double the energy, so expect heating bills to rise with it.',
    'A and B homes are usually newer or retrofitted, well insulated and warm. E, F and G homes are often older, draughty, and expensive to keep warm in winter.',
    'A cheaper rent on a G-rated home can be eaten up by higher bills. Compare rent plus bills, not rent alone.'
  ],
  tips: [
    'Ask to see the BER certificate if it isn’t in the ad. If it’s missing, that’s against the rules for advertised homes.',
    'Ask how the home is heated (gas, electric storage heaters, heat pump) and whether bills are included.',
    'Damp patches, mould or single-glazed windows are signs of a cold, costly home whatever the rating says.'
  ],
  sources: [{ name: 'SEAI: BER advertising guidelines', url: 'https://www.seai.ie/home-energy/building-energy-rating-ber/ber-advertising' }, { name: 'SEAI: your guide to Building Energy Rating', url: 'https://www.seai.ie/publications/Your-Guide-to-Building-Energy-Rating.pdf' }],
  check: 'secondary'
}
