// Template: vite.config.ts fills in VERSION and SHELL at build time.
const VERSION = '__VERSION__'
const SHELL = __SHELL__
const SHELL_CACHE = `breath-shell-${VERSION}`
const SOUND_CACHE = 'breath-sounds-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('breath-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== location.origin) return

  if (request.mode === 'navigate') {
    // Network first so a new version shows up; the cached shell keeps the app working offline.
    event.respondWith(fetch(request).catch(() => caches.match('./', { ignoreSearch: true })))
    return
  }

  if (url.pathname.includes('/sounds/')) {
    // Ambiences are cached the first time they are played, not at install.
    event.respondWith(
      caches.open(SOUND_CACHE).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok) cache.put(request, res.clone())
        return res
      }),
    )
    return
  }

  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)))
})
