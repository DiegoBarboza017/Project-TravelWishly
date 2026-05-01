// sw.js - Service Worker PWA TravelWishly
const CACHE_NAME = 'travelwishly-v4';

// Recursos críticos a cachear estáticamente
const ASSETS_TO_CACHE = [
  '/',
  '/dashboard',
  '/guia',
  '/static/style.css',
  '/static/app.js',
  '/static/ai_packing.js',
  '/static/globe_logic.js',
  '/static/logo.png',
  '/static/cat_bot.png',
  '/static/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.3/font/bootstrap-icons.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cacheando assets cruciales...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Limpiar caches antiguos
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar Peticiones
self.addEventListener('fetch', event => {
  // Solo interceptamos GETs
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si red OK y es un request de nuestro dominio o CDNs seguros, guardamos la versión fresca al cache dinamico
        if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // RED CAIDA -> Servimos desde Cache
        return caches.match(event.request)
          .then(cachedResponse => {
             if (cachedResponse) return cachedResponse;
             
             // Si el documento requerido era html pero no estab en chache (un /itinerario loco)
             if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/'); // Mandarlo al inicio logico cached
             }
          });
      })
  );
});
