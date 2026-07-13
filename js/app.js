if ('serviceWorker' in navigator) {
    // Si estás en local usa '/', si estás en GitHub Pages usa '/Colegios/'
    const path = window.location.hostname === 'localhost' ? '/sw.js' : '/Colegios/sw.js';
    navigator.serviceWorker.register(path)
        .then(reg => console.log('SW registrado correctamente en:', path))
        .catch(err => console.error('Error al registrar SW', err));
}