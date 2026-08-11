import { auth, db } from './firebase-config.js';
import { requireRoles, auditEvent } from './security.js';
import { uploadToCloudinary } from './cloudinary-config.js';
import { collection, addDoc, getDocs, doc, setDoc, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const { user, profile } = await requireRoles(['superadmin','directora','maestro']);
const role = profile.rol;
const OPTIONS = {
  superadmin: [['colegio','Todo el colegio'],['docentes','Todo el personal docente'],['direccion','Dirección'],['grupo','Un grupo'],['nivel','Un nivel'],['alumno','Un estudiante / tutor'],['usuario','Una persona del personal']],
  directora: [['colegio','Todo el colegio'],['docentes','Todo el personal docente'],['grupo','Un grupo'],['nivel','Un nivel'],['alumno','Un estudiante / tutor'],['usuario','Una persona del personal']],
  maestro: [['direccion','Dirección'],['docentes','Otros docentes'],['grupo','Mi grupo'],['alumno','Estudiante / tutor'],['usuario','Una persona del personal']]
};
const allowed = OPTIONS[role] || [];
const typeSelect = document.getElementById('msg-target-type');
typeSelect.innerHTML = allowed.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
document.getElementById('msg-user-name').textContent = profile.nombre || user.email;
document.getElementById('msg-user-role').textContent = role;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatDate = value => value?.toDate ? value.toDate().toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}) : 'Ahora';
let notices = [], filter = 'received';
const assignedGroups = new Set();
const studentGroups = new Map();
async function loadAudienceContext() {
  if (role !== 'maestro') return;
  const [subjects, students] = await Promise.all([getDocs(collection(db,'materias')), getDocs(collection(db,'alumnos'))]);
  subjects.docs.map(item => item.data()).filter(item => String(item.maestro_email || '').toLowerCase() === String(user.email).toLowerCase()).forEach(item => { if (item.grupo) assignedGroups.add(String(item.grupo)); });
  students.docs.forEach(item => { const data=item.data(); studentGroups.set(item.id,String(data.grupo || '')); studentGroups.set(String(data.nombre || '').toLowerCase(),String(data.grupo || '')); });
}
function receivedBy(data) {
  if (data.creadoPorUid === user.uid) return false;
  if (['superadmin','directora'].includes(role)) return true;
  if (data.destinatarioTipo === 'colegio') return true;
  if (data.destinatarioTipo === 'usuario') return [user.uid,user.email,profile.usuario,profile.usuario_original].filter(Boolean).includes(data.destinatarioId);
  if (data.destinatarioTipo === 'docentes') return role === 'maestro';
  if (data.destinatarioTipo === 'direccion') return ['directora','superadmin'].includes(role);
  if (data.destinatarioTipo === 'grupo') return assignedGroups.has(String(data.destinatarioId));
  if (data.destinatarioTipo === 'nivel') return [...assignedGroups].some(group => group.toLowerCase().includes(String(data.destinatarioId).toLowerCase()));
  if (data.destinatarioTipo === 'alumno') return assignedGroups.has(studentGroups.get(String(data.destinatarioId).toLowerCase()) || studentGroups.get(String(data.destinatarioId)));
  return false;
}
function renderMessages() {
  const visible = notices.filter(({data}) => filter === 'all' || (filter === 'sent' ? data.creadoPorUid === user.uid : receivedBy(data)));
  document.getElementById('message-list').innerHTML = visible.length ? visible.map(({id,data}) => `<article class="message-card ${escapeHtml(data.prioridad)}"><div class="message-meta"><span>${escapeHtml(data.creadoPorNombre || 'Personal escolar')} · ${escapeHtml(data.creadoPorRol || '')}</span><span>${formatDate(data.creadoEn)}</span></div><h3>${escapeHtml(data.titulo)}</h3><p>${escapeHtml(data.mensaje)}</p><div class="message-foot"><span class="read-badge">${escapeHtml(data.destinatarioTipo)} ${escapeHtml(data.destinatarioId || '')}</span><div>${data.archivoUrl ? `<a href="${escapeHtml(data.archivoUrl)}" target="_blank" rel="noopener">Ver adjunto</a>` : ''}${data.creadoPorUid !== user.uid ? `<button data-read="${id}">Confirmar lectura</button>` : ''}</div></div></article>`).join('') : '<div class="msg-empty">No hay mensajes en esta vista.</div>';
  document.querySelectorAll('[data-read]').forEach(button => button.addEventListener('click', async () => { await setDoc(doc(db,'avisos',button.dataset.read,'lecturas',user.uid),{uid:user.uid,nombre:profile.nombre || user.email,leidoEn:serverTimestamp()},{merge:true}); button.textContent='Lectura confirmada'; button.disabled=true; }));
}
async function loadMessages() { const snap = await getDocs(query(collection(db,'avisos'),orderBy('creadoEn','desc'),limit(80))); notices = snap.docs.map(item => ({id:item.id,data:item.data()})); renderMessages(); }
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));button.classList.add('active');filter=button.dataset.filter;renderMessages();}));
document.getElementById('refresh-messages').addEventListener('click',loadMessages);
document.getElementById('message-form').addEventListener('submit',async event=>{event.preventDefault();const type=typeSelect.value;if(!allowed.some(([value])=>value===type))return Swal.fire('Destino no permitido','','error');const file=document.getElementById('msg-file').files[0];const state=document.getElementById('upload-state');try{state.textContent=file?'Subiendo adjunto a Cloudinary…':'Publicando…';let attachment=null;if(file)attachment=await uploadToCloudinary(file,'avisos');const record={titulo:document.getElementById('msg-title').value.trim(),mensaje:document.getElementById('msg-body').value.trim(),prioridad:document.getElementById('msg-priority').value,destinatarioTipo:type,destinatarioId:document.getElementById('msg-target-id').value.trim(),creadoPorUid:user.uid,creadoPorNombre:profile.nombre || user.email,creadoPorRol:role,creadoEn:serverTimestamp(),activo:true,archivoUrl:attachment?.url || '',archivoNombre:attachment?.nombre || '',archivoPublicId:attachment?.publicId || '',archivoBytes:attachment?.bytes || 0,archivoProveedor:attachment?'cloudinary':''};const created=await addDoc(collection(db,'avisos'),record);await auditEvent('aviso.publicado',{collection:'avisos',id:created.id},record.titulo);event.target.reset();state.textContent='';await Swal.fire('Mensaje publicado','La comunicación quedó disponible para sus destinatarios.','success');await loadMessages();}catch(error){state.textContent='';Swal.fire('No se pudo publicar',error.message,'error');}});
await loadAudienceContext();
await loadMessages();
