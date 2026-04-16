// ARMORY Service Worker — v1
// Handles caching for offline support and enables the PWA install prompt on Android

const CACHE_NAME = 'armory-v1';

// Core assets to pre-cache on install
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ── INSTALL: pre-cache core assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(['./index.html', './manifest.json'])
        .then(() => cache.addAll(PRECACHE_URLS.slice(2)).catch(() => {}));
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first for local assets, network-first for API calls ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Groq API calls — always go to network
  if (url.hostname === 'api.groq.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first strategy for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
