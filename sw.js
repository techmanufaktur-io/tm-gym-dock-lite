// savvyGYM Service Worker
// Bump CACHE version on every deploy to trigger updates
//
// OneSignal Web Push: imports their SW into ours so push events are handled
// alongside our own caching. Both push handler and cache logic coexist here.
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE = 'savvygym-v11';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  // DO NOT call skipWaiting() here — the new SW must enter "waiting"
  // state so the client can detect it and show the update banner.
  // skipWaiting() is called only when the user clicks "Update".
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Listen for skip-waiting message from client
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  // Network-first for API calls
  if (e.request.url.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // Network-first for HTML
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
