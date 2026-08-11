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
        title: 'Verificando acceso',
        text: 'Estamos validando tus credenciales.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        await setPersistence(auth, browserLocalPersistence);
        
        // 1. Iniciar sesión en el servidor de contraseñas (Auth)
        await signInWithEmailAndPassword(auth, emailParaAuth, password);

        // 2. Perfil de seguridad por UID. Se conserva un respaldo temporal para migración.
        let userData = null;
        const userUid = auth.currentUser.uid;
        const uidSnapshot = await getDoc(doc(db, "usuarios", userUid));

        if (uidSnapshot.exists()) {
            userData = uidSnapshot.data();
        }

        if (!userData) {
            const q = query(collection(db, "usuarios"), where("email", "==", emailParaAuth));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) userData = querySnapshot.docs[0].data();
        }

        if (!userData) {
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
        if (userData && userData.activo !== false) {
            let rolNormalizado = String(userData.rol || '').trim().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            // Compatibilidad temporal durante la migración de documentos antiguos.
            if (!['superadmin', 'directora', 'maestro', 'recepcion'].includes(rolNormalizado)) {
                if (emailParaAuth === 'recepcionceal@amorylibertad.org') rolNormalizado = 'recepcion';
                else if (emailParaAuth === 'directora@amorylibertad.org') rolNormalizado = 'directora';
            }
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Acceso concedido', showConfirmButton: false, timer: 850, timerProgressBar: true }).then(() => {
                if (rolNormalizado === "superadmin") window.location.href = "dashboard-superadmin.html";
                else if (rolNormalizado === "directora") window.location.href = "dashboard-directora.html";
                else if (rolNormalizado === "maestro") window.location.href = "dashboard-maestro.html";
                else if (rolNormalizado === "recepcion") window.location.href = "dashboard-recepcion.html";
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
