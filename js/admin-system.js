import { auth, db } from './firebase-config.js';
import { requireRoles, auditEvent } from './security.js';
import { signOut, sendPasswordResetEmail, getAuth, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, getDocs, getCountFromServer, doc, getDoc, updateDoc, setDoc, addDoc, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { checkCloudinaryAvailability } from './cloudinary-config.js';

const { user, profile } = await requireRoles(['superadmin']);
document.getElementById('nombre-usuario').textContent = profile.nombre || 'Superadministrador';

const formatDate = value => {
  if (!value) return 'Sin registro';
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin registro' : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
};
const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

document.getElementById('form-usuario').addEventListener('submit', async event => {
  event.preventDefault();
  const nombre = document.getElementById('nuevo-nombre').value.trim();
  const rol = document.getElementById('nuevo-rol').value;
  const entrada = document.getElementById('nuevo-email').value.trim();
  const password = document.getElementById('nuevo-password').value;
  const usuarioOriginal = entrada.includes('@') ? entrada.split('@')[0] : entrada;
  const email = entrada.includes('@') ? entrada.toLowerCase() : `${entrada.toLowerCase().replace(/\s+/g, '')}@amorylibertad.org`;
  if (password.length < 6) return Swal.fire('Contraseña insuficiente', 'Debe contener al menos 6 caracteres.', 'warning');
  if (rol !== 'maestro' && !entrada.includes('@')) return Swal.fire('Correo requerido', 'Dirección, recepción y superadministración deben usar su correo completo.', 'warning');
  const secondary = initializeApp(auth.app.options, `crear-${Date.now()}`);
  try {
    Swal.fire({ title: 'Creando cuenta…', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const secondaryAuth = getAuth(secondary);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = credential.user.uid;
    await setDoc(doc(db, 'usuarios', uid), { uid, nombre, email, rol, activo: true, usuario: usuarioOriginal, usuario_original: usuarioOriginal, creadoEn: serverTimestamp(), creadoPorUid: user.uid });
    await secondaryAuth.signOut();
    await auditEvent('usuario.cuenta_creada', { collection: 'usuarios', id: uid }, `${rol}: ${email}`);
    event.target.reset();
    await Swal.fire('Cuenta creada', `${nombre} ya puede acceder con ${rol === 'maestro' ? usuarioOriginal : email}.`, 'success');
    await loadUsers();
  } catch (error) {
    const messages = { 'auth/email-already-in-use': 'El correo ya existe en Firebase Authentication.', 'auth/weak-password': 'La contraseña no cumple los requisitos.', 'auth/invalid-email': 'El correo no es válido.' };
    Swal.fire('No se pudo crear', messages[error.code] || error.message, 'error');
  } finally { await deleteApp(secondary).catch(() => {}); }
});

document.querySelectorAll('.sys-tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.sys-tab,.sys-section').forEach(element => element.classList.remove('active'));
  button.classList.add('active');
  document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
  if (button.dataset.tab === 'infraestructura' && !button.dataset.loaded) {
    button.dataset.loaded = 'true';
    loadInfrastructure().catch(error => Swal.fire('Métricas no disponibles', error.message, 'error'));
  }
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

async function loadInfrastructure() {
  const names = ['usuarios','alumnos','grupos','materias','asistencias','calificaciones','fichas','fotos','avisos','auditoria'];
  const countSnapshots = await Promise.all(names.map(name => getCountFromServer(collection(db, name))));
  const counts = Object.fromEntries(names.map((name, index) => [name, countSnapshots[index].data().count]));
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  document.getElementById('infra-docs').textContent = total.toLocaleString('es-MX');
  document.getElementById('infra-collections').textContent = names.filter(name => counts[name] > 0).length;
  document.getElementById('infra-audit').textContent = counts.auditoria;
  document.getElementById('firebase-status').textContent = 'Conectado · reglas por rol activas';
  document.getElementById('firebase-dot').classList.add('online');
  const max = Math.max(...Object.values(counts), 1);
  document.getElementById('collection-chart').innerHTML = names.map(name => `<div class="chart-row"><span>${escapeHtml(name)}</span><div class="chart-track"><div class="chart-fill" style="width:${Math.max(2, counts[name] / max * 100)}%"></div></div><strong>${counts[name]}</strong></div>`).join('');
  const [photosSnapshot, noticesSnapshot] = await Promise.all([getDocs(collection(db,'fotos')), getDocs(collection(db,'avisos'))]);
  const files = [...photosSnapshot.docs.map(item => item.data()), ...noticesSnapshot.docs.map(item => item.data()).filter(item => item.archivoUrl)];
  const bytes = files.reduce((sum, item) => sum + Number(item.archivoBytes || item.bytes || 0), 0);
  document.getElementById('cloud-assets').textContent = files.length;
  document.getElementById('cloud-bytes').textContent = bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : 'Sin dato';
  const cloud = await checkCloudinaryAvailability();
  document.getElementById('cloudinary-status').textContent = cloud.reachable ? 'CDN disponible · carga configurada' : 'Configurado · prueba CDN no concluyente';
  document.getElementById('cloud-latency').textContent = `${cloud.latency} ms`;
  if (cloud.reachable) document.getElementById('cloudinary-dot').classList.add('online');
}

document.getElementById('generar-respaldo').addEventListener('click', async () => { const names = ['usuarios','alumnos','grupos','materias','asistencias','calificaciones','fichas','fotos','avisos','configuracion','auditoria','web_config']; const backup = { metadata: { generatedAt: new Date().toISOString(), generatedBy: user.uid, project: 'colegio-628e8', formatVersion: 1 }, collections: {} }; for (const name of names) { const snapshot = await getDocs(collection(db, name)); backup.collections[name] = snapshot.docs.map(item => ({ id: item.id, data: item.data() })); } const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `respaldo_colegio_${new Date().toISOString().slice(0,10)}.json`; anchor.click(); URL.revokeObjectURL(url); await auditEvent('sistema.respaldo_generado', { collection: 'sistema', id: 'backup' }, `${names.length} colecciones`); });

document.getElementById('ejecutar-diagnostico').addEventListener('click', runHealth); document.getElementById('cargar-auditoria').addEventListener('click', loadAudit); document.getElementById('actualizar-infra').addEventListener('click', loadInfrastructure); document.getElementById('recargar').addEventListener('click', async () => { await Promise.all([loadUsers(), loadAudit(), loadConfig(), loadNotices(), loadInfrastructure()]); }); document.getElementById('cerrar-sesion').addEventListener('click', async () => { await signOut(auth); window.location.replace('index.html'); });

await Promise.all([loadUsers(), loadAudit(), loadConfig(), loadNotices()]);
