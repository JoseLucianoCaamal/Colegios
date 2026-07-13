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

window.addEventListener('beforeinstallprompt', (e) => {
    // Evita que el navegador muestre su propio mensaje de instalación automático
    e.preventDefault();
    // Guardamos el evento para usarlo después
    promptDiferido = e;
    // Mostramos nuestro botón personalizado en el menú
    btnInstalar.style.display = 'inline-block';
});

btnInstalar.addEventListener('click', () => {
    // Escondemos el botón
    btnInstalar.style.display = 'none';
    // Mostramos la ventana oficial de instalación del teléfono/PC
    promptDiferido.prompt();
    // Comprobamos qué eligió el usuario
    promptDiferido.userChoice.then((resultado) => {
        if (resultado.outcome === 'accepted') {
            console.log('El usuario aceptó instalar la App');
        } else {
            console.log('El usuario rechazó la instalación');
        }
        promptDiferido = null;
    });
});