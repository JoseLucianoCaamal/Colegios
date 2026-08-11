import { auth, db, storage } from './firebase-config.js';
import { requireRoles, auditEvent } from './security.js';
import { signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, addDoc, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const { user, profile } = await requireRoles(['superadmin']);
document.getElementById('nombre-usuario').textContent = profile.nombre || 'Superadministrador';

const formatDate = value => {
  if (!value) return 'Sin registro';
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin registro' : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
};
const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

document.querySelectorAll('.sys-tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.sys-tab,.sys-section').forEach(element => element.classList.remove('active'));
  button.classList.add('active');
  document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
}));

async function loadUsers() {
  const snapshot = await getDocs(collection(db, 'usuarios'));
  const users = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => item.uid && item.id === item.uid);
  document.getElementById('total-usuarios').textContent = `${users.length} perfiles`;
  document.getElementById('tabla-usuarios').innerHTML = users.map(item => `<tr data-id="${escapeHtml(item.id)}"><td><strong>${escapeHtml(item.nombre || item.usuario || item.email)}</strong><br><small>${escapeHtml(item.email)}</small></td><td><select class="user-role"><option ${item.rol === 'superadmin' ? 'selected' : ''}>superadmin</option><option ${item.rol === 'directora' ? 'selected' : ''}>directora</option><option ${item.rol === 'recepcion' ? 'selected' : ''}>recepcion</option><option ${item.rol === 'maestro' ? 'selected' : ''}>maestro</option></select></td><td><span class="sys-pill ${item.activo === false ? 'off' : ''}">${item.activo === false ? 'Suspendido' : 'Activo'}</span></td><td>${formatDate(item.ultimoAcceso)}</td><td><div class="sys-inline-actions"><button class="sys-icon-btn save-user">Guardar</button><button class="sys-icon-btn toggle-user">${item.activo === false ? 'Activar' : 'Suspender'}</button><button class="sys-icon-btn reset-user">Restablecer clave</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="sys-empty">No hay perfiles UID.</td></tr>';

  document.querySelectorAll('.save-user').forEach(button => button.addEventListener('click', async () => {
    const row = button.closest('tr'); const id = row.dataset.id; const role = row.querySelector('.user-role').value;
    if (id === user.uid && role !== 'superadmin') return Swal.fire('Acción bloqueada', 'No puedes retirar tu propio rol superadmin.', 'warning');
    await updateDoc(doc(db, 'usuarios', id), { rol: role });
    await auditEvent('usuario.rol_actualizado', { collection: 'usuarios', id }, `Nuevo rol: ${role}`);
    Swal.fire('Actualizado', 'El rol fue guardado.', 'success'); await loadUsers();
  }));
  document.querySelectorAll('.toggle-user').forEach(button => button.addEventListener('click', async () => {
    const row = button.closest('tr'); const id = row.dataset.id;
    if (id === user.uid) return Swal.fire('Acción bloqueada', 'No puedes suspender tu propia cuenta.', 'warning');
    const current = button.textContent.trim() === 'Suspender';
    const result = await Swal.fire({ title: current ? '¿Suspender acceso?' : '¿Activar acceso?', text: 'El cambio se aplicará en el próximo acceso.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar' });
    if (!result.isConfirmed) return;
    await updateDoc(doc(db, 'usuarios', id), { activo: !current });
    await auditEvent(current ? 'usuario.suspendido' : 'usuario.activado', { collection: 'usuarios', id }); await loadUsers();
  }));
  document.querySelectorAll('.reset-user').forEach(button => button.addEventListener('click', async () => {
    const row = button.closest('tr'); const target = users.find(item => item.id === row.dataset.id);
    if (!target?.email) return;
    await sendPasswordResetEmail(auth, target.email);
    await auditEvent('usuario.restablecimiento_enviado', { collection: 'usuarios', id: target.id }, target.email);
    Swal.fire('Correo enviado', 'Firebase envió el enlace de restablecimiento.', 'success');
  }));
}

async function runHealth() {
  const [usersSnap, studentsSnap, groupsSnap, subjectsSnap] = await Promise.all(['usuarios','alumnos','grupos','materias'].map(name => getDocs(collection(db, name))));
  const users = usersSnap.docs.map(item => ({ id: item.id, ...item.data() }));
  const students = studentsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
  const groups = new Set(groupsSnap.docs.map(item => item.data().nombre));
  const teacherEmails = new Set(users.filter(item => item.rol === 'maestro' && item.activo !== false && item.uid).map(item => String(item.email).toLowerCase()));
  const legacy = users.filter(item => !item.uid || item.id !== item.uid);
  const incomplete = students.filter(item => !item.nombre || !item.grupo || !item.tutor || !item.telefono);
  const relations = [];
  students.filter(item => item.grupo && !groups.has(item.grupo)).forEach(item => relations.push(`Alumno ${item.nombre || item.id}: grupo inexistente ${item.grupo}`));
  subjectsSnap.docs.map(item => item.data()).filter(item => item.maestro_email && !teacherEmails.has(String(item.maestro_email).toLowerCase())).forEach(item => relations.push(`Materia ${item.nombre}: docente no activo ${item.maestro_email}`));
  document.getElementById('h-usuarios').textContent = users.filter(item => item.uid && item.id === item.uid).length;
  document.getElementById('h-legados').textContent = legacy.length;
  document.getElementById('h-incompletos').textContent = incomplete.length;
  document.getElementById('h-relaciones').textContent = relations.length;
  const issues = [
    ...legacy.map(item => ({ title: `Perfil antiguo: ${item.id}`, text: 'Conservar solo hasta terminar las pruebas y luego retirar.' })),
    ...incomplete.map(item => ({ title: `Alumno incompleto: ${item.nombre || item.id}`, text: 'Falta nombre, grupo, tutor o teléfono.' })),
    ...relations.map(text => ({ title: 'Relación inconsistente', text }))
  ];
  document.getElementById('lista-problemas').innerHTML = issues.length ? issues.map(item => `<div class="issue"><span class="issue-dot"></span><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></div></div>`).join('') : '<div class="issue ok"><span class="issue-dot"></span><div><strong>Integridad correcta</strong><span>No se encontraron problemas en las comprobaciones actuales.</span></div></div>';
  await auditEvent('sistema.diagnostico_ejecutado', { collection: 'sistema', id: 'salud' }, `${issues.length} observaciones`);
}

async function loadAudit() {
  const snapshot = await getDocs(query(collection(db, 'auditoria'), orderBy('fecha', 'desc'), limit(80)));
  document.getElementById('lista-auditoria').innerHTML = snapshot.empty ? '<div class="sys-empty">Sin actividad registrada.</div>' : snapshot.docs.map(item => { const data = item.data(); return `<div class="audit-row"><span>${formatDate(data.fecha)}</span><div><strong>${escapeHtml(data.accion)}</strong><span>${escapeHtml(data.resumen || '')}</span></div><span>${escapeHtml(data.usuarioNombre || data.usuarioUid)} · ${escapeHtml(data.rol)}</span></div>`; }).join('');
}

async function loadConfig() {
  const snapshot = await getDoc(doc(db, 'configuracion', 'cicloActual')); if (!snapshot.exists()) return;
  const data = snapshot.data(); document.getElementById('ciclo').value = data.cicloEscolar || ''; document.getElementById('periodo').value = data.periodo || 'Trimestre 1'; document.getElementById('estado-ciclo').value = data.estado || 'activo'; document.getElementById('fecha-inicio').value = data.fechaInicio || ''; document.getElementById('fecha-fin').value = data.fechaFin || '';
}
document.getElementById('form-config').addEventListener('submit', async event => { event.preventDefault(); const data = { cicloEscolar: document.getElementById('ciclo').value.trim(), periodo: document.getElementById('periodo').value, estado: document.getElementById('estado-ciclo').value, fechaInicio: document.getElementById('fecha-inicio').value, fechaFin: document.getElementById('fecha-fin').value, actualizadoPorUid: user.uid, actualizadoEn: serverTimestamp() }; await setDoc(doc(db, 'configuracion', 'cicloActual'), data, { merge: true }); await auditEvent('configuracion.ciclo_actualizado', { collection: 'configuracion', id: 'cicloActual' }, `${data.cicloEscolar} - ${data.periodo}`); Swal.fire('Configuración guardada', '', 'success'); });

async function loadNotices() { const snapshot = await getDocs(query(collection(db, 'avisos'), orderBy('creadoEn', 'desc'), limit(30))); document.getElementById('lista-avisos').innerHTML = snapshot.empty ? '<div class="sys-empty">No hay avisos.</div>' : snapshot.docs.map(item => { const data = item.data(); return `<div class="notice-row"><strong>${escapeHtml(data.titulo)} <span class="sys-pill">${escapeHtml(data.prioridad)}</span></strong><span>${escapeHtml(data.destinatarioTipo)} ${escapeHtml(data.destinatarioId || '')} · ${formatDate(data.creadoEn)}</span></div>`; }).join(''); }
document.getElementById('form-aviso').addEventListener('submit', async event => { event.preventDefault(); const file = document.getElementById('aviso-archivo').files[0]; if (file && file.size > 10 * 1024 * 1024) return Swal.fire('Archivo demasiado grande', 'El máximo es 10 MB.', 'warning'); const record = { titulo: document.getElementById('aviso-titulo').value.trim(), mensaje: document.getElementById('aviso-mensaje').value.trim(), prioridad: document.getElementById('aviso-prioridad').value, destinatarioTipo: document.getElementById('aviso-tipo').value, destinatarioId: document.getElementById('aviso-destino').value.trim(), creadoPorUid: user.uid, creadoPorNombre: profile.nombre, creadoEn: serverTimestamp(), activo: true, archivoUrl: '' }; const created = await addDoc(collection(db, 'avisos'), record); if (file) { const fileRef = ref(storage, `avisos/${created.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`); await uploadBytes(fileRef, file); await updateDoc(created, { archivoUrl: await getDownloadURL(fileRef), archivoNombre: file.name }); } await auditEvent('aviso.publicado', { collection: 'avisos', id: created.id }, record.titulo); event.target.reset(); Swal.fire('Aviso publicado', '', 'success'); await loadNotices(); });

document.getElementById('generar-respaldo').addEventListener('click', async () => { const names = ['usuarios','alumnos','grupos','materias','asistencias','calificaciones','fichas','fotos','avisos','configuracion','auditoria','web_config']; const backup = { metadata: { generatedAt: new Date().toISOString(), generatedBy: user.uid, project: 'colegio-628e8', formatVersion: 1 }, collections: {} }; for (const name of names) { const snapshot = await getDocs(collection(db, name)); backup.collections[name] = snapshot.docs.map(item => ({ id: item.id, data: item.data() })); } const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `respaldo_colegio_${new Date().toISOString().slice(0,10)}.json`; anchor.click(); URL.revokeObjectURL(url); await auditEvent('sistema.respaldo_generado', { collection: 'sistema', id: 'backup' }, `${names.length} colecciones`); });

document.getElementById('ejecutar-diagnostico').addEventListener('click', runHealth); document.getElementById('cargar-auditoria').addEventListener('click', loadAudit); document.getElementById('recargar').addEventListener('click', async () => { await Promise.all([loadUsers(), loadAudit(), loadConfig(), loadNotices()]); }); document.getElementById('cerrar-sesion').addEventListener('click', async () => { await signOut(auth); window.location.replace('index.html'); });

await Promise.all([loadUsers(), loadAudit(), loadConfig(), loadNotices()]);
