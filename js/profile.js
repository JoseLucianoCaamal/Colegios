import { auth, db } from './firebase-config.js';
import { requireRoles, auditEvent } from './security.js';
import { dashboardForRole } from './role-nav.js';
import { uploadToCloudinary } from './cloudinary-config.js';
import { doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const { user, profile } = await requireRoles(['superadmin', 'directora', 'recepcion', 'maestro']);
const $ = selector => document.querySelector(selector);
const form = $('#profile-form'), preview = $('#profile-preview'), photoInput = $('#profile-photo'), status = $('#profile-status');
let pendingPhoto = null;
const home = dashboardForRole(profile.rol);
$('#profile-back').href = home;
$('#profile-cancel').href = home;
$('#profile-name').value = profile.nombre || '';
$('#profile-phone').value = profile.telefonoPerfil || '';
$('#profile-bio').value = profile.bio || '';
$('#profile-color').value = profile.colorPerfil || '#1c5d8c';
$('#profile-email').textContent = profile.email || user.email || '—';
$('#profile-role').textContent = profile.rol || '—';
$('#bio-count').textContent = $('#profile-bio').value.length;
status.textContent = 'Perfil cargado';

function renderPhoto(url = profile.fotoPerfil) {
  preview.style.background = $('#profile-color').value;
  preview.style.color = '#fff';
  preview.innerHTML = url ? `<img src="${url}" alt="Fotografía de perfil">` : `<span>${(profile.nombre || user.email || 'U').split(/\s+/).slice(0,2).map(value=>value[0]).join('').toUpperCase()}</span>`;
}
renderPhoto();
$('#profile-bio').addEventListener('input', event => { $('#bio-count').textContent = event.target.value.length; });
$('#profile-color').addEventListener('input', () => { preview.style.background = $('#profile-color').value; });
photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { status.textContent = 'La imagen supera 5 MB'; status.className = 'profile-status error'; photoInput.value = ''; return; }
  pendingPhoto = file;
  renderPhoto(URL.createObjectURL(file));
  status.textContent = 'Fotografía lista para guardar';
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#profile-save');
  button.disabled = true;
  status.className = 'profile-status';
  status.textContent = pendingPhoto ? 'Subiendo fotografía…' : 'Guardando cambios…';
  try {
    let photo = null;
    if (pendingPhoto) photo = await uploadToCloudinary(pendingPhoto, `perfiles/${user.uid}`);
    const changes = {
      nombre: $('#profile-name').value.trim(),
      telefonoPerfil: $('#profile-phone').value.trim(),
      bio: $('#profile-bio').value.trim(),
      colorPerfil: $('#profile-color').value,
      perfilActualizadoEn: serverTimestamp()
    };
    if (photo) { changes.fotoPerfil = photo.url; changes.fotoPerfilPublicId = photo.publicId; }
    await updateDoc(doc(db, 'usuarios', user.uid), changes);
    await auditEvent('usuario.perfil_actualizado', { collection:'usuarios', id:user.uid }, 'Actualización de perfil personal');
    pendingPhoto = null;
    status.textContent = 'Cambios guardados';
    status.className = 'profile-status saved';
    setTimeout(() => { location.href = home; }, 900);
  } catch (error) {
    console.error(error);
    status.textContent = 'No se pudo guardar';
    status.className = 'profile-status error';
    window.Swal?.fire?.('No se pudo guardar', error.message, 'error');
  } finally { button.disabled = false; }
});
