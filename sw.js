// Instant Cache Wipe & Self-Unregistering Service Worker for VidSavor
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    })
    .then(() => self.registration.unregister())
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Never intercept API calls, POST requests, or proxy downloads
  if (
    e.request.method !== 'GET' ||
    e.request.url.includes('/api/') ||
    e.request.url.includes('/fetch') ||
    e.request.url.includes('/proxy-download') ||
    e.request.url.includes('/resolve-youtube')
  ) {
    return; // Pass directly to native browser networking
  }
  e.respondWith(fetch(e.request));
});
