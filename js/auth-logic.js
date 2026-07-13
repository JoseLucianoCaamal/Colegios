import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Agregué la palabra 'export' aquí para que sea visible desde otros archivos
export async function iniciarSesion(usuarioIngresado, pass) {
    try {
        // 1. Buscamos el usuario por su nombre (ej: "directora")
        const q = query(collection(db, "usuarios"), where("usuario", "==", usuarioIngresado));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            
            // 2. Autenticamos con el correo real (vinculado en Firestore)
            await signInWithEmailAndPassword(auth, userData.email, pass);
            
            // 3. Redirección según rol
            if (userData.rol === "directora") {
                window.location.href = "dashboard-directora.html";
            } else {
                alert("Acceso denegado: No tienes permisos de directora.");
            }
        } else {
            alert("Usuario no encontrado");
        }
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        alert("Contraseña incorrecta o error de conexión.");
    }
}