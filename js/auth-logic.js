import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const iniciarSesion = async (e) => {
    if (e && typeof e.preventDefault === 'function') { e.preventDefault(); }
    
    const inputEmail = document.getElementById('email') || document.getElementById('usuario') || document.getElementById('user');
    const inputPassword = document.getElementById('password') || document.getElementById('pass') || document.getElementById('clave');
    
    if (!inputEmail || !inputPassword) return;

    // Convertimos a minúsculas automáticamente para evitar errores de mayúsculas
    const emailUsuario = inputEmail.value.trim().toLowerCase();
    const password = inputPassword.value;
    
    if (!emailUsuario || !password) {
        Swal.fire('Campos Vacíos', 'Por favor, ingresa tu usuario y contraseña.', 'info');
        return;
    }
    
    const emailCompleto = emailUsuario.includes('@') ? emailUsuario : `${emailUsuario}@amorylibertad.org`;

    Swal.fire({
        title: 'Verificando datos...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // MAGIA: Forzar que la sesión se quede guardada en el dispositivo
        await setPersistence(auth, browserLocalPersistence);

        const q = query(collection(db, "usuarios"), where("email", "==", emailCompleto));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            await signInWithEmailAndPassword(auth, emailCompleto, password);
            
            Swal.fire({ icon: 'success', title: '¡Acceso Concedido!', showConfirmButton: false, timer: 1200 }).then(() => {
                if (userData.rol === "directora") window.location.href = "dashboard-directora.html";
                else if (userData.rol === "maestro") window.location.href = "dashboard-maestro.html";
                else if (userData.rol === "recepcion") window.location.href = "dashboard-recepcion.html";
                else { Swal.fire('Error', 'Rol no reconocido.', 'error'); auth.signOut(); }
            });
        } else {
            Swal.fire('Usuario no encontrado', 'El usuario ingresado no existe.', 'error');
        }
    } catch (error) {
        Swal.fire('Error de Acceso', 'La contraseña es incorrecta.', 'error');
    }
};