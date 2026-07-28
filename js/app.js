// 1. Registro del Service Worker
if ('serviceWorker' in navigator) {
    // Uso de ruta relativa para que funcione en distintos hosts/paths
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('SW registrado en:', reg.scope))
        .catch(err => console.error('Error SW', err));
}


// 2. Lógica para el botón de instalación PWA
let promptDiferido;
const btnInstalar = document.getElementById('btn-instalar');

// Solo ejecutamos si el botón existe en la página
if (btnInstalar) {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        promptDiferido = e;
        btnInstalar.style.display = 'inline-block';
        btnInstalar.setAttribute('aria-hidden', 'false');
    });

    btnInstalar.addEventListener('click', () => {
        btnInstalar.style.display = 'none';
        if (!promptDiferido) return;
        promptDiferido.prompt();
        promptDiferido.userChoice.then((resultado) => {
            promptDiferido = null;
        });
    });
}