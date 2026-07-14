import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    
    // Auth SIEMPRE necesita minúsculas para funcionar
    let emailParaAuth = usuarioEscrito.includes('@') ? usuarioEscrito : `${usuarioEscrito}@amorylibertad.org`;
    emailParaAuth = emailParaAuth.toLowerCase();

    Swal.fire({
        title: 'Verificando datos...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        await setPersistence(auth, browserLocalPersistence);
        
        // 1. Iniciar sesión en el servidor de contraseñas (Auth)
        await signInWithEmailAndPassword(auth, emailParaAuth, password);

        // 2. BUSCADOR INTELIGENTE EN LA BASE DE DATOS
        let userData = null;

        // Intento A: Búsqueda rápida por correo en minúsculas
        const q = query(collection(db, "usuarios"), where("email", "==", emailParaAuth));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            userData = querySnapshot.docs[0].data();
        } else {
            // Intento B: Si lo anterior falló por culpa de las mayúsculas (Ej: RecepcionCEAL o id_directora)
            // Hacemos un escaneo profundo de todos los usuarios
            const allUsersSnap = await getDocs(collection(db, "usuarios"));
            allUsersSnap.forEach((documento) => {
                const data = documento.data();
                if (data.email && data.email.toLowerCase() === emailParaAuth) {
                    userData = data;
                }
            });
        }

        // 3. Redirección
        if (userData) {
            Swal.fire({ icon: 'success', title: '¡Acceso Concedido!', showConfirmButton: false, timer: 1200 }).then(() => {
                if (userData.rol === "directora") window.location.href = "dashboard-directora.html";
                else if (userData.rol === "maestro") window.location.href = "dashboard-maestro.html";
                else if (userData.rol === "recepcion") window.location.href = "dashboard-recepcion.html";
                else { Swal.fire('Error', 'Rol no reconocido.', 'error'); auth.signOut(); }
            });
        } else {
            Swal.fire('Error de Base de Datos', 'Tu usuario no tiene un rol asignado en el sistema.', 'error');
            auth.signOut();
        }
    } catch (error) {
        console.error(error);
        Swal.fire('Error de Acceso', 'La contraseña es incorrecta o el usuario no existe.', 'error');
    }
};