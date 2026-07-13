import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const iniciarSesion = async (e) => {
    // Solución al error: Solo detenemos el evento si 'e' realmente existe
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    
    // Obtener los valores del formulario
    const emailUsuario = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Autocompletar el dominio si no lo escribieron
    const emailCompleto = emailUsuario.includes('@') ? emailUsuario : `${emailUsuario}@amorylibertad.org`;

    try {
        // 1. Buscar el rol en Firestore usando el ID del usuario (sin el @)
        const idUsuario = emailUsuario.replace('@amorylibertad.org', '');
        const usuarioRef = doc(db, "usuarios", idUsuario);
        const docSnap = await getDoc(usuarioRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            
            // 2. Si existe en la base de datos, intentamos iniciar sesión
            await signInWithEmailAndPassword(auth, emailCompleto, password);
            
            // 3. Redirigir según el rol
            if (userData.rol === "directora") {
                window.location.href = "dashboard-directora.html";
            } else if (userData.rol === "maestro") {
                window.location.href = "dashboard-maestro.html";
            } else if (userData.rol === "recepcion") {
                window.location.href = "dashboard-recepcion.html";
            } else {
                alert("Acceso denegado: Rol no reconocido.");
                auth.signOut(); // Cerramos la sesión si el rol es inválido
            }
        } else {
            alert("El usuario no existe en la base de datos.");
        }
    } catch (error) {
        console.error("Error en login:", error);
        alert("Credenciales incorrectas o error de conexión.");
    }
};