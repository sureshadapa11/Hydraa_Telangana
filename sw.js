// =====================================================
//   Service Worker — HYDRAA Telangana PWA
//   Cache static assets, network-first for API
// =====================================================

const CACHE_NAME   = 'hydraa-v6';
const OFFLINE_URL  = '/offline.html';

// Only cache non-HTML static assets — HTML is always fetched fresh from network
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/http-client.js',
  '/app.js',
  '/session-timeout.js',
];

// ── Install: cache static assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch(() => {
      // Non-fatal: some assets may not exist yet
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches, claim clients, signal pages to reload ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' })))
  );
});

// ── Fetch: routing strategy ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API calls — Network first, no cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ success: false, message: 'You are offline. Please check your connection.' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // HTML pages — Always fetch fresh from network, never serve from cache
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).then(response => {
        return response;
      }).catch(() =>
        caches.match(request).then(cached => cached || caches.match(OFFLINE_URL))
      )
    );
    return;
  }

  // JS / CSS / Images — Cache first (these are versioned; cache is fine)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && (
          request.destination === 'script' ||
          request.destination === 'style' ||
          request.destination === 'image'
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(OFFLINE_URL));
    })
  );
});

// ── Background sync for offline complaint submission ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-complaints') {
    event.waitUntil(syncPendingComplaints());
  }
});

async function syncPendingComplaints() {
  // Placeholder — can be extended to replay queued API requests
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

// ── Push notifications (future use) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'HYDRAA Telangana', {
      body:    data.body || 'You have a new update on your complaint.',
      icon:    '/icon.svg',
      badge:   '/icon.svg',
      tag:     data.tag || 'hydraa-notification',
      data:    { url: data.url || '/hydraa-my-complaints.html' },
      actions: [
        { action: 'view',    title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = (event.notification.data && event.notification.data.url) || '/hydraa-my-complaints.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url === url && 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
