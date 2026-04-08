// ══════════════════════════════════════════════════
//  Service Worker — شجرة العائلة
//  Cache-first pour assets statiques, network-first pour données
// ══════════════════════════════════════════════════
'use strict';

const CACHE_VERSION = 'v2';
const STATIC_CACHE  = 'ft-static-' + CACHE_VERSION;
const DATA_CACHE    = 'ft-data-' + CACHE_VERSION;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&family=Amiri:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js',
];

// Installation : mise en cache des assets statiques
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => console.warn('[SW] Cache install error:', err))
  );
});

// Activation : suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch : stratégie selon le type de ressource
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  // API GitHub → réseau uniquement (jamais en cache)
  if (url.hostname === 'api.github.com') return;

  // Fichiers JSON → network-first avec fallback cache
  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Assets statiques → cache-first avec fallback réseau
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// Messages de l'application principale
self.addEventListener('message', event => {
  if (event.data === 'CLEAR_DATA_CACHE') {
    caches.open(DATA_CACHE).then(cache =>
      cache.keys().then(keys => keys.forEach(k => cache.delete(k)))
    );
  }
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Helpers ──────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}
