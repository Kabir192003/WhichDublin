/** Error reporting, only when a VITE_SENTRY_DSN is configured. Loaded on demand so the SDK costs
 * nothing for visitors when it's switched off, and never before the app itself has rendered. */
const DSN = import.meta.env.VITE_SENTRY_DSN
let ready = null
const load = () => (ready ||= import('@sentry/react').then((S) => { S.init({ dsn: DSN, tracesSampleRate: 0, sendDefaultPii: false }); return S }))
export function report(error, extra) { if (DSN) load().then((S) => S.captureException(error, { extra })).catch(() => {}) }
export function startMonitoring() {
  if (!DSN) return
  addEventListener('error', (e) => report(e.error || new Error(e.message)))
  addEventListener('unhandledrejection', (e) => report(e.reason instanceof Error ? e.reason : new Error(String(e.reason))))
}
