const CACHE_VERSION = 'ptg-compta-v2';
const STATIC_ASSETS = [
  '/Compta/',
  '/Compta/index.html',
  '/Compta/manifest.json',
  '/Compta/icon-192.png',
  '/Compta/icon-512.png'
];

// Installation : mise en cache des assets statiques
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activation : supprime les vieux caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch : stratégie Network First pour l'app, cache pour les assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne jamais intercepter Firebase, Google, Vercel
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('vercel.app') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('fonts.googleapis') ||
    url.protocol === 'chrome-extension:'
  ) return;

  // Network First : essaie le réseau, fallback cache
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Met à jour le cache avec la nouvelle version
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
