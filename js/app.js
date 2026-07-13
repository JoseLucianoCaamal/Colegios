// 1. Registro del Service Worker
if ('serviceWorker' in navigator) {
    const path = window.location.hostname === 'localhost' ? '/sw.js' : '/Colegios/sw.js';
    navigator.serviceWorker.register(path)
        .then(reg => console.log('SW registrado en:', path))
        .catch(err => console.error('Error SW', err));
}


// 2. Lógica para el botón de instalación PWA
let promptDiferido;
const btnInstalar = document.getElementById('btn-instalar');

// ¡AQUÍ ESTÁ EL CAMBIO! Solo ejecutamos si el botón existe en la página
if (btnInstalar) {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        promptDiferido = e;
        btnInstalar.style.display = 'inline-block';
    });

    btnInstalar.addEventListener('click', () => {
        btnInstalar.style.display = 'none';
        promptDiferido.prompt();
        promptDiferido.userChoice.then((resultado) => {
            promptDiferido = null;
        });
    });
}