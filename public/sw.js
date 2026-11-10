// Settld service worker: the app shell and data work offline after the first visit.
// Same-origin only. Pages and data: network first, cache as fallback. Built assets: cache first (hashed names).
const CACHE = 'wd-v1'
self.addEventListener('install', (e) => { self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  const hashed = url.pathname.includes('/assets/')
  if (hashed) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)) } return r })))
    return
  }
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)) } return r }).catch(() => caches.match(e.request).then((hit) => hit || caches.match(new URL('./', self.registration.scope).href))))
})
