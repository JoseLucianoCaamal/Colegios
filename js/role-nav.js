import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getCurrentProfile } from './security.js';

export function dashboardForRole(role = '') {
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'superadmin') return 'dashboard-superadmin.html';
  if (normalized === 'directora') return 'dashboard-directora.html';
  if (normalized === 'maestro') return 'dashboard-maestro.html';
  if (normalized === 'recepcion') return 'dashboard-recepcion.html';
  return 'login.html';
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const profile = await getCurrentProfile(user);
    if (!profile) return;
    document.querySelectorAll('[data-role-home]').forEach(link => {
      link.href = dashboardForRole(profile.rol);
    });
  } catch (error) {
    console.error('No se pudo actualizar la navegación por rol.', error);
  }
});
