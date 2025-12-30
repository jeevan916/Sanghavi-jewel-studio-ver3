
const CACHE_NAME = 'sanghavi-v3-prod';
const CDN_IMAGE_REGEX = /cloudinary|imgix|hostinger|googleusercontent|cdn-icons-png/;

const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass API calls
  if (url.pathname.startsWith('/api/')) return;

  // Strategy: Stale-While-Revalidate for CDN Images
  if (CDN_IMAGE_REGEX.test(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networked = fetch(request).then((res) => {
          const cacheCopy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, cacheCopy));
          return res;
        }).catch(() => cached);
        return cached || networked;
      })
    );
    return;
  }

  // Default Strategy
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
