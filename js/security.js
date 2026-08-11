import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, serverTimestamp, addDoc, collection } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const LOGIN_URL = 'login.html';

export async function getCurrentProfile(user = auth.currentUser) {
  if (!user) return null;
  const snapshot = await getDoc(doc(db, 'usuarios', user.uid));
  if (!snapshot.exists()) return null;
  return { uid: user.uid, ...snapshot.data() };
}

export function requireRoles(allowedRoles = []) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace(LOGIN_URL);
        return;
      }

      try {
        const profile = await getCurrentProfile(user);
        const allowed = profile?.activo === true && allowedRoles.includes(profile.rol);
        if (!allowed) {
          await signOut(auth);
          window.location.replace(`${LOGIN_URL}?error=sin-permisos`);
          return;
        }
        resolve({ user, profile });
      } catch (error) {
        console.error('No fue posible validar el perfil de seguridad.', error);
        await signOut(auth);
        window.location.replace(`${LOGIN_URL}?error=validacion`);
      }
    });
  });
}

export async function auditEvent(action, target = {}, summary = '') {
  const user = auth.currentUser;
  if (!user) return;
  const profile = await getCurrentProfile(user);
  if (!profile) return;

  await addDoc(collection(db, 'auditoria'), {
    usuarioUid: user.uid,
    usuarioNombre: profile.nombre || user.email,
    rol: profile.rol,
    accion: action,
    coleccion: target.collection || '',
    documentoId: target.id || '',
    resumen: String(summary).slice(0, 500),
    fecha: serverTimestamp()
  });
}
