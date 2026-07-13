const CACHE_NAME = 'colegio-v1';
const ASSETS = [
  '/Colegios/',
  '/Colegios/index.html',
  '/Colegios/css/styles.css',
  '/Colegios/js/app.js',
  '/Colegios/manifest.json',
  '/Colegios/Img/logo.png' 
];

// Instalar el Service Worker
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos un bucle para añadir archivos y que falle solo el que no encuentra
      return Promise.all(
        ASSETS.map(url => cache.add(url).catch(err => console.error('No se pudo cachear:', url)))
      );
    })
  );
});

// Interceptar peticiones
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});