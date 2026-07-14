import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const iniciarSesion = async (e) => {
    if (e && typeof e.preventDefault === 'function') { e.preventDefault(); }
    
    const inputEmail = document.getElementById('email') || document.getElementById('usuario') || document.getElementById('user');
    const inputPassword = document.getElementById('password') || document.getElementById('pass') || document.getElementById('clave');
    
    if (!inputEmail || !inputPassword) return;

    const usuarioEscrito = inputEmail.value.trim();
    const password = inputPassword.value;
    
    if (!usuarioEscrito || !password) {
        Swal.fire('Campos Vacíos', 'Por favor, ingresa tu usuario y contraseña.', 'info');
        return;
    }
    
    // Auth SIEMPRE usa minúsculas
    let emailParaAuth = usuarioEscrito.includes('@') ? usuarioEscrito : `${usuarioEscrito}@amorylibertad.org`;
    emailParaAuth = emailParaAuth.toLowerCase();

    Swal.fire({
        title: 'Verificando datos...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // FORZAR PERSISTENCIA (Para que no se cierre en celulares)
        await setPersistence(auth, browserLocalPersistence);
        
        // 1. Iniciar sesión en el servidor de Auth
        const userCredential = await signInWithEmailAndPassword(auth, emailParaAuth, password);
        const idUsuarioMinusculas = userCredential.user.email.split('@')[0];

        // 2. Buscar en la Base de Datos (Primero en minúsculas)
        let docRef = doc(db, "usuarios", idUsuarioMinusculas);
        let docSnap = await getDoc(docRef);

        // Si no lo encuentra, buscamos exactamente como lo escribió el usuario (¡Esto salva a RecepcionCEAL!)
        if (!docSnap.exists()) {
            docRef = doc(db, "usuarios", usuarioEscrito);
            docSnap = await getDoc(docRef);
        }

        // 3. Redirección
        if (docSnap.exists()) {
            const userData = docSnap.data();
            Swal.fire({ icon: 'success', title: '¡Acceso Concedido!', showConfirmButton: false, timer: 1200 }).then(() => {
                if (userData.rol === "directora") window.location.href = "dashboard-directora.html";
                else if (userData.rol === "maestro") window.location.href = "dashboard-maestro.html";
                else if (userData.rol === "recepcion") window.location.href = "dashboard-recepcion.html";
                else { Swal.fire('Error', 'Rol no reconocido.', 'error'); auth.signOut(); }
            });
        } else {
            Swal.fire('Error de Base de Datos', 'Tu usuario no tiene un rol asignado.', 'error');
            auth.signOut();
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Error de Acceso', 'La contraseña es incorrecta o el usuario no existe.', 'error');
    }
};