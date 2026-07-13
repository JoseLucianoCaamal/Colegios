import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Importamos las funciones para hacer consultas (queries)
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const iniciarSesion = async (e) => {
    // 1. Detenemos la recarga
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    
    // 2. Buscamos las cajas de texto
    const inputEmail = document.getElementById('email') || document.getElementById('usuario') || document.getElementById('user');
    const inputPassword = document.getElementById('password') || document.getElementById('pass') || document.getElementById('clave');
    
    if (!inputEmail || !inputPassword) {
        alert("Error: No se encontraron las cajas de texto.");
        return;
    }

    // Quitamos los espacios en blanco por si se fue uno sin querer
    const emailUsuario = inputEmail.value.trim();
    const password = inputPassword.value;
    
    if (!emailUsuario || !password) {
        alert("Por favor, ingresa tu usuario y contraseña.");
        return;
    }
    
    // Autocompletar el dominio si solo ponen el nombre
    const emailCompleto = emailUsuario.includes('@') ? emailUsuario : `${emailUsuario}@amorylibertad.org`;

    try {
        // 3. MAGIA NUEVA: Buscamos en la colección "usuarios" donde el CAMPO "email" sea igual al correo
        const q = query(collection(db, "usuarios"), where("email", "==", emailCompleto));
        const querySnapshot = await getDocs(q);

        // Si querySnapshot NO está vacío, significa que sí encontró el usuario
        if (!querySnapshot.empty) {
            
            // Sacamos la información de ese usuario encontrado
            const userData = querySnapshot.docs[0].data();
            
            // 4. Intentamos iniciar sesión con la contraseña en Authentication
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
            // Si el querySnapshot está vacío, no existe
            alert("El usuario no existe en la base de datos.");
        }
    } catch (error) {
        console.error("Error en login:", error);
        alert("Credenciales incorrectas o error de conexión.");
    }
};