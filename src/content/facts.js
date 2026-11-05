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
