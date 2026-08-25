if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .catch(err => console.error('Error SW', err));
}

let promptDiferido;
const btnInstalar = document.getElementById('btn-instalar');

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
        promptDiferido.userChoice.then(() => {
            promptDiferido = null;
        });
    });
}
