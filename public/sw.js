const CACHE_NAME = 'kaf-v2';

// Install — cache shell
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', (e) => {
  // Skip non-GET and socket.io requests
  if (e.request.method !== 'GET' || e.request.url.includes('socket.io')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ─── Web Push: receive push from server ──────────────────
// This fires even when the app is in the background / phone locked!
self.addEventListener('push', (e) => {
  let data = { title: 'KAF Bestellung', body: 'Neue Bestellung eingegangen!' };
  try {
    data = e.data.json();
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [300, 100, 300, 100, 300],
      tag: 'kaf-order-' + Date.now(),
      renotify: true,
      requireInteraction: true, // Stay visible until tapped
    })
  );
});

// Handle messages from the app (fallback notifications)
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [300, 100, 300, 100, 300],
      tag: 'kaf-order',
      renotify: true,
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});
