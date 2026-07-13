import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const iniciarSesion = async (e) => {
    // 1. Detenemos la recarga de la página si existe el evento
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    
    // 2. Búsqueda inteligente: buscamos las cajas de texto por sus nombres más comunes
    const inputEmail = document.getElementById('email') || document.getElementById('usuario') || document.getElementById('user');
    const inputPassword = document.getElementById('password') || document.getElementById('pass') || document.getElementById('clave');
    
    // Si de plano no encuentra las cajas, nos avisa en lugar de romper el sistema
    if (!inputEmail || !inputPassword) {
        alert("Error: No se encontraron las cajas de texto. Asegúrate de que en tu login.html tengan id='email' y id='password'.");
        return;
    }

    const emailUsuario = inputEmail.value;
    const password = inputPassword.value;
    
    // Autocompletar el dominio si no lo escribieron
    const emailCompleto = emailUsuario.includes('@') ? emailUsuario : `${emailUsuario}@amorylibertad.org`;

    try {
        // 3. Buscar el rol en Firestore usando el ID del usuario (sin el @)
        const idUsuario = emailUsuario.replace('@amorylibertad.org', '');
        const usuarioRef = doc(db, "usuarios", idUsuario);
        const docSnap = await getDoc(usuarioRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            
            // 4. Si existe en la base de datos, intentamos iniciar sesión
            await signInWithEmailAndPassword(auth, emailCompleto, password);
            
            // 5. Redirigir según el rol
            if (userData.rol === "directora") {
                window.location.href = "dashboard-directora.html";
            } else if (userData.rol === "maestro") {
                window.location.href = "dashboard-maestro.html";
            } else if (userData.rol === "recepcion") {
                window.location.href = "dashboard-recepcion.html";
            } else {
                alert("Acceso denegado: Rol no reconocido.");
                auth.signOut(); 
            }
        } else {
            alert("El usuario no existe en la base de datos.");
        }
    } catch (error) {
        console.error("Error en login:", error);
        alert("Credenciales incorrectas o error de conexión.");
    }
};