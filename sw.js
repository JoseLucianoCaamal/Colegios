// Cambiamos la versión para forzar la actualización en todos los celulares
const CACHE_NAME = 'colegio-v10.5';
const ASSETS = [
  '/Colegios/',
  '/Colegios/index.html',
  '/Colegios/pages/login.html',
  '/Colegios/pages/dashboard-directora.html',
  '/Colegios/pages/dashboard-superadmin.html',
  '/Colegios/pages/admin-sistema.html',
  '/Colegios/pages/centro-mensajes.html',
  '/Colegios/pages/perfil.html',
  '/Colegios/pages/dashboard-maestro.html',
  '/Colegios/pages/dashboard-recepcion.html',
  '/Colegios/pages/gestionar-maestros.html',
  '/Colegios/pages/fotos.html',
  '/Colegios/pages/galeria-publica.html',
  '/Colegios/pages/limpiar-asistencia.html',
  '/Colegios/css/styles.css',
  '/Colegios/css/home.css',
  '/Colegios/css/dashboard.css',
  '/Colegios/css/superadmin.css',
  '/Colegios/css/admin-system.css',
  '/Colegios/css/messages.css',
  '/Colegios/css/message-widget.css',
  '/Colegios/css/profile.css',
  '/Colegios/css/login.css',
  '/Colegios/css/gallery.css',
  '/Colegios/css/admin-power.css',
  '/Colegios/css/manage.css',
  '/Colegios/css/academic.css',
  '/Colegios/css/workspace.css',
  '/Colegios/js/app.js',
  '/Colegios/js/auth-logic.js',
  '/Colegios/js/security.js',
  '/Colegios/js/role-nav.js',
  '/Colegios/js/admin-system.js',
  '/Colegios/js/messages.js',
  '/Colegios/js/message-widget.js',
  '/Colegios/js/profile.js',
  '/Colegios/js/cloudinary-config.js',
  '/Colegios/manifest.json',
  '/Colegios/Img/logo.png',
  '/Colegios/Img/logo2.png',
  '/Colegios/Img/Enero-2025.pdf'
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

// HTML, JavaScript y CSS usan red primero para evitar ejecutar versiones antiguas.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isLocal = url.origin === self.location.origin;
  const networkFirst = isLocal && (
    e.request.mode === 'navigate' ||
    ['document', 'script', 'style'].includes(e.request.destination)
  );

  if (networkFirst) {
    e.respondWith(
      fetch(e.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
        return response;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(caches.match(e.request).then(response => response || fetch(e.request)));
});
