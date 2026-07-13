import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function iniciarSesion(usuarioIngresado, pass) {
    try {
        console.log("Intentando iniciar sesión con:", usuarioIngresado);
        
        // Buscamos el documento donde el campo 'usuario' coincide con lo que escribió la directora
        const q = query(collection(db, "usuarios"), where("usuario", "==", usuarioIngresado));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            alert("Error: Usuario no encontrado en la base de datos.");
            return;
        }

        const userData = snapshot.docs[0].data();
        
        // Autenticamos usando el email real y la contraseña
        await signInWithEmailAndPassword(auth, userData.email, pass);
        
        await signInWithEmailAndPassword(auth, userData.email, pass);
        console.log("Autenticación exitosa. Redirigiendo...");
        
        // ¡ESTA ES LA PARTE NUEVA!
        if (userData.rol === "directora") {
            window.location.href = "dashboard-directora.html";
        } else if (userData.rol === "maestro") {
            window.location.href = "dashboard-maestro.html"; // Redirige al maestro
        } else {
            alert("Acceso denegado: Rol no reconocido.");
        }
    } catch (error) {
        console.error("Error completo de Firebase:", error);
        alert("Error al ingresar: " + error.message);
    }
}