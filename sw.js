
const CACHE_NAME = 'sanghavi-v4-3g-opt';
const CDN_IMAGE_REGEX = /cloudinary|imgix|hostinger|googleusercontent|cdn-icons-png|uploads/;

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
  
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    // If request URL is invalid (e.g. chrome-extension://), skip caching
    return;
  }

  // Skip API calls for SW caching
  if (url.pathname.startsWith('/api/')) return;

  // Optimized for 3G: Stale-While-Revalidate for UI and Images
  if (CDN_IMAGE_REGEX.test(request.url) || STATIC_ASSETS.includes(url.pathname) || STATIC_ASSETS.includes('./' + url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, cacheCopy));
          }
          return networkResponse;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Fallback: Network with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
