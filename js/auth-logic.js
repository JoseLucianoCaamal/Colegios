import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const iniciarSesion = async (e) => {
    if (e && typeof e.preventDefault === 'function') { e.preventDefault(); }
    
    const inputEmail = document.getElementById('email') || document.getElementById('usuario') || document.getElementById('user');
    const inputPassword = document.getElementById('password') || document.getElementById('pass') || document.getElementById('clave');
    
    if (!inputEmail || !inputPassword) {
        Swal.fire('Error de Interfaz', 'No se encontraron las cajas de texto en tu HTML.', 'error');
        return;
    }

    const emailUsuario = inputEmail.value.trim();
    const password = inputPassword.value;
    
    if (!emailUsuario || !password) {
        Swal.fire('Campos Vacíos', 'Por favor, ingresa tu usuario y contraseña.', 'info');
        return;
    }
    
    const emailCompleto = emailUsuario.includes('@') ? emailUsuario : `${emailUsuario}@amorylibertad.org`;

    // Ponemos una pantalla de carga para que la app se sienta profesional
    Swal.fire({
        title: 'Verificando datos...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
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
            Swal.fire('Usuario no encontrado', 'El usuario ingresado no existe en nuestra base de datos.', 'error');
        }
    } catch (error) {
        Swal.fire('Error de Acceso', 'La contraseña es incorrecta o hubo un problema de red.', 'error');
    }
};