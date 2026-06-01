// Service Worker for SozuCredit PWA
const CACHE_NAME = 'sozucredit-v5';
const RUNTIME_CACHE = 'sozucredit-runtime-v5';

function isDevTunnelHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.ngrok-free.app') ||
    hostname.endsWith('.ngrok.app') ||
    hostname.endsWith('.ngrok.io')
  );
}

// Precache: icon used by the inline preloader + manifest so the splash paints offline
const PRECACHE_ASSETS = [
  '/icons/sozu_icon_192.png',
  '/icons/sozu_icon_512.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_ASSETS).catch(() => Promise.resolve())
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      )
    )
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Dev tunnels: never intercept — ngrok interstitials break SW fetch and surface "Offline"
  if (isDevTunnelHost(self.location.hostname)) return;

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // /_next/static — immutable hashed assets: cache-first, no network needed after first fetch
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // API routes — always network, never cache
  if (url.pathname.startsWith('/api/')) return;

  // Everything else — network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then(async (response) => {
        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('/home') ?? caches.match('/');
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
      )
  );
});
