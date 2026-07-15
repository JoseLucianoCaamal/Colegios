// Cambiamos la versión para forzar la actualización en todos los celulares
const CACHE_NAME = 'colegio-v5.6'; 
const ASSETS = [
  '/Colegios/',
  '/Colegios/index.html',
  '/Colegios/login.html',
  '/Colegios/dashboard-directora.html',
  '/Colegios/dashboard-maestro.html',
  '/Colegios/dashboard-recepcion.html',
  '/Colegios/gestionar-maestros.html',
  '/Colegios/fotos.html',
  '/Colegios/galeria-publica.html', 
  '/Colegios/limpiar-asistencia.html', 
  '/Colegios/css/styles.css',
  '/Colegios/js/app.js',
  '/Colegios/js/auth-logic.js',
  '/Colegios/manifest.json',
  '/Colegios/Img/logo.png',
  '/Colegios/Img/logo2.png'
];

// Instalar y forzar que tome el control inmediatamente
self.addEventListener('install', (e) => {
  self.skipWaiting(); 
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS.map(url => cache.add(url).catch(err => console.error('No se pudo cachear:', url)))
      );
    })
  );
});

// Activar y borrar la caché vieja (Esto arregla el problema del teléfono)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Borrando caché antigua:', key);
            return caches.delete(key);
          }
        })
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