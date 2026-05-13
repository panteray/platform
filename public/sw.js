// Panteray service worker — minimal app-shell cache for PWA install + offline fallback.
// Does NOT cache API responses or authenticated pages. Keeps caching conservative so
// stale data never surprises a tech in the field.

const CACHE_VERSION = 'panteray-v2'
const APP_SHELL = [
  '/manifest.json',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first for everything. Fall back to cache ONLY for the static app shell.
// Never cache API routes or dynamic pages — those must always hit the network.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/_next/')) return

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/manifest.json')))
  )
})
