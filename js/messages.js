import { auth, db } from './firebase-config.js';
import { requireRoles, auditEvent } from './security.js';
import { uploadToCloudinary } from './cloudinary-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc, query, where, orderBy, limit, serverTimestamp, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const { user, profile } = await requireRoles(['superadmin','directora','maestro','recepcion']);
const role = profile.rol;
const OPTIONS = {
  superadmin: [['colegio','Todo el colegio'],['docentes','Todos los docentes'],['direccion','Todo el equipo directivo'],['grupo','Un grupo'],['nivel','Un nivel'],['alumno','Un estudiante / tutor'],['usuario','Una persona específica']],
  directora: [['colegio','Todo el colegio'],['docentes','Todos los docentes'],['grupo','Un grupo'],['nivel','Un nivel'],['alumno','Un estudiante / tutor'],['usuario','Una persona específica']],
  maestro: [['direccion','Dirección'],['docentes','Todos los docentes'],['grupo','Mi grupo'],['alumno','Estudiante / tutor'],['usuario','Una persona específica']]
};
const allowed = OPTIONS[role] || [];
const typeSelect = document.getElementById('msg-target-type');
const targetWrap = document.getElementById('msg-target-wrap');
const targetSearch = document.getElementById('msg-target-search');
const targetId = document.getElementById('msg-target-id');
const resultsBox = document.getElementById('contact-results');
const selectedTarget = document.getElementById('selected-target');
if (role === 'recepcion') { document.querySelector('.msg-compose').hidden = true; document.querySelector('.msg-main').style.gridTemplateColumns = '1fr'; }
typeSelect.innerHTML = allowed.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
document.getElementById('msg-user-name').textContent = profile.nombre || user.email;
document.getElementById('msg-user-role').textContent = role;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const formatDate = value => value?.toDate ? value.toDate().toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}) : 'Ahora';
let notices = [], filter = 'received', contacts = [], groups = [], students = [], subjects = [];
const assignedGroups = new Set();

async function loadDirectory() {
  const [usersSnap, groupsSnap, studentsSnap, subjectsSnap] = await Promise.all(['usuarios','grupos','alumnos','materias'].map(name => getDocs(collection(db,name))));
  contacts = usersSnap.docs.map(item => ({ id:item.id, ...item.data() })).filter(item => item.uid && item.activo !== false && item.id !== user.uid);
  groups = groupsSnap.docs.map(item => ({ id:item.id, ...item.data() }));
  students = studentsSnap.docs.map(item => ({ id:item.id, ...item.data() }));
  subjects = subjectsSnap.docs.map(item => ({ id:item.id, ...item.data() }));
  if (role === 'maestro') subjectsSnap.docs.map(item => item.data()).filter(item => String(item.maestro_email || '').toLowerCase() === String(user.email).toLowerCase()).forEach(item => { if(item.grupo) assignedGroups.add(String(item.grupo)); });
}
function automaticTarget(type) {
  return { colegio:'rol:todos', docentes:'rol:maestro', direccion:'rol:directora' }[type] || '';
}
function updateTargetMode() {
  const type = typeSelect.value, automatic = automaticTarget(type);
  targetId.value = automatic; targetSearch.value = ''; selectedTarget.textContent = ''; resultsBox.innerHTML = '';
  const hidden = Boolean(automatic);
  targetWrap.classList.toggle('target-hidden', hidden);
  if (hidden) selectedTarget.textContent = type === 'docentes' ? 'Se enviará a todas las cuentas con rol maestro.' : type === 'direccion' ? 'Se enviará a dirección.' : 'Se enviará a todo el personal autorizado.';
  else targetSearch.placeholder = type === 'usuario' ? 'Busca por nombre, usuario o correo' : type === 'grupo' ? 'Busca un grupo' : type === 'alumno' ? 'Busca un estudiante' : 'Escribe o busca el nivel';
}
function searchCandidates(term) {
  const type=typeSelect.value, needle=term.toLowerCase().trim(); if(!needle) return [];
  const source = type === 'usuario' ? contacts.map(x=>({...x,label:x.nombre || x.usuario || x.email,detail:`${x.rol} · ${x.email}`,value:x.id})) : type === 'grupo' ? groups.map(x=>({...x,label:x.nombre || x.id,detail:'Grupo escolar',value:x.nombre || x.id})) : type === 'alumno' ? students.map(x=>({...x,label:x.nombre || x.id,detail:`${x.grupo || 'Sin grupo'} · Tutor: ${x.tutor || 'sin registrar'}`,value:x.id})) : groups.map(x=>({label:x.nombre || x.id,detail:'Nivel o grupo',value:x.nombre || x.id}));
  return source.filter(x=>`${x.label} ${x.detail || ''}`.toLowerCase().includes(needle)).slice(0,8);
}
targetSearch.addEventListener('input',()=>{const matches=searchCandidates(targetSearch.value);resultsBox.innerHTML=matches.map((item,index)=>`<button type="button" data-result="${index}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></button>`).join('');resultsBox.querySelectorAll('[data-result]').forEach(button=>button.addEventListener('click',()=>{const item=matches[Number(button.dataset.result)];targetId.value=item.value;targetSearch.value=item.label;selectedTarget.textContent=`Seleccionado: ${item.label}`;resultsBox.innerHTML='';}));});
typeSelect.addEventListener('change',updateTargetMode);

function teacherReceives(data) {
  if (data.destinatarioTipo === 'colegio' || data.destinatarioTipo === 'docentes') return true;
  if (data.destinatarioTipo === 'usuario') return [user.uid,user.email,profile.usuario,profile.usuario_original].filter(Boolean).includes(data.destinatarioId);
  if (data.destinatarioTipo === 'grupo') return assignedGroups.has(String(data.destinatarioId));
  if (data.destinatarioTipo === 'nivel') return [...assignedGroups].some(group=>group.toLowerCase().includes(String(data.destinatarioId).toLowerCase()));
  if (data.destinatarioTipo === 'alumno') return assignedGroups.has(String(students.find(item=>item.id===data.destinatarioId)?.grupo || ''));
  return false;
}
function receivedBy(data) { if(data.creadoPorUid===user.uid)return false;if(['superadmin','directora'].includes(role))return true;return teacherReceives(data); }
function canDelete(data) { return ['superadmin','directora'].includes(role) || data.creadoPorUid === user.uid; }
function renderMessages() {
  const visible=notices.filter(({data})=>filter==='all'||(filter==='sent'?data.creadoPorUid===user.uid:receivedBy(data)));
  document.getElementById('message-list').innerHTML=visible.length?visible.map(({id,data})=>`<article class="message-card ${escapeHtml(data.prioridad)}"><div class="message-meta"><span>${escapeHtml(data.creadoPorNombre||'Personal escolar')} · ${escapeHtml(data.creadoPorRol||'')}</span><span>${formatDate(data.creadoEn)}</span></div><h3>${escapeHtml(data.titulo)}</h3><p>${escapeHtml(data.mensaje)}</p><div class="message-foot"><span class="read-badge">${escapeHtml(data.destinatarioTipo)} ${escapeHtml(data.destinatarioId||'')}</span><div>${data.archivoUrl?`<a href="${escapeHtml(data.archivoUrl)}" target="_blank" rel="noopener">Adjunto</a>`:''}${data.creadoPorUid!==user.uid?`<button data-read="${id}">Marcar leído</button>`:''}${canDelete(data)?`<button class="delete-message" data-delete="${id}">Eliminar</button>`:''}</div></div></article>`).join(''):'<div class="msg-empty">No hay mensajes en esta vista.</div>';
  document.querySelectorAll('[data-read]').forEach(button=>button.addEventListener('click',async()=>{await setDoc(doc(db,'avisos',button.dataset.read,'lecturas',user.uid),{uid:user.uid,nombre:profile.nombre||user.email,leidoEn:serverTimestamp()},{merge:true});localStorage.setItem(`msg-read-${button.dataset.read}`,'1');button.textContent='Leído';button.disabled=true;}));
  document.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',async()=>{const message=notices.find(item=>item.id===button.dataset.delete);const answer=await Swal.fire({title:'¿Eliminar mensaje?',text:message?.data.archivoPublicId?'El mensaje se eliminará, pero el adjunto deberá borrarse desde Cloudinary Console.':'Esta acción no se puede deshacer.',icon:'warning',showCancelButton:true,confirmButtonText:'Sí, eliminar',cancelButtonText:'Cancelar',confirmButtonColor:'#c64650'});if(!answer.isConfirmed)return;await deleteDoc(doc(db,'avisos',button.dataset.delete));await auditEvent('aviso.eliminado',{collection:'avisos',id:button.dataset.delete},message?.data.titulo||'');Swal.fire('Mensaje eliminado','','success');}));
}
function listenMessages(){const fail=error=>Swal.fire('No se pudo abrir la bandeja',error.message,'error');if(['superadmin','directora'].includes(role))return onSnapshot(query(collection(db,'avisos'),orderBy('creadoEn','desc'),limit(100)),snap=>{notices=snap.docs.map(item=>({id:item.id,data:item.data()}));renderMessages();},fail);let receivedMap=new Map(),sentMap=new Map();const merge=()=>{notices=[...new Map([...receivedMap,...sentMap]).values()].sort((a,b)=>(b.data.creadoEn?.seconds||0)-(a.data.creadoEn?.seconds||0));renderMessages();};const stopReceived=onSnapshot(query(collection(db,'avisos'),where('destinatarioUids','array-contains',user.uid),limit(100)),snap=>{receivedMap=new Map(snap.docs.map(item=>[item.id,{id:item.id,data:item.data()}]));merge();},fail);const stopSent=onSnapshot(query(collection(db,'avisos'),where('creadoPorUid','==',user.uid),limit(100)),snap=>{sentMap=new Map(snap.docs.map(item=>[item.id,{id:item.id,data:item.data()}]));merge();},fail);return()=>{stopReceived();stopSent();};}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));button.classList.add('active');filter=button.dataset.filter;renderMessages();}));
document.getElementById('refresh-messages').addEventListener('click',renderMessages);
function resolveRecipients(type,destination){const active=contacts.filter(item=>item.activo!==false),management=active.filter(item=>['superadmin','directora'].includes(item.rol)),teacherForGroup=(item,group)=>item.rol==='maestro'&&subjects.some(subject=>String(subject.grupo||'')===String(group)&&String(subject.maestro_email||'').toLowerCase()===String(item.email||'').toLowerCase());let recipients=[];if(type==='colegio')recipients=active;if(type==='docentes')recipients=active.filter(item=>item.rol==='maestro');if(type==='direccion')recipients=management;if(type==='usuario')recipients=active.filter(item=>item.id===destination);if(type==='grupo')recipients=active.filter(item=>item.grupo===destination||(Array.isArray(item.grupos)&&item.grupos.includes(destination))||teacherForGroup(item,destination));if(type==='nivel')recipients=active.filter(item=>String(item.grupo||'').toLowerCase().includes(String(destination).toLowerCase())||(Array.isArray(item.grupos)&&item.grupos.some(group=>String(group).toLowerCase().includes(String(destination).toLowerCase()))||(item.rol==='maestro'&&subjects.some(subject=>String(subject.grupo||'').toLowerCase().includes(String(destination).toLowerCase())&&String(subject.maestro_email||'').toLowerCase()===String(item.email||'').toLowerCase())));if(type==='alumno'){const student=students.find(item=>item.id===destination),group=student?.grupo;recipients=active.filter(item=>(Array.isArray(item.alumnoIds)&&item.alumnoIds.includes(destination))||(group&&teacherForGroup(item,group)));}if(['grupo','nivel','alumno'].includes(type))recipients=[...recipients,...management];return[...new Set(recipients.map(item=>item.id).filter(Boolean).filter(uid=>uid!==user.uid))];}
document.getElementById('message-form').addEventListener('submit',async event=>{event.preventDefault();const type=typeSelect.value;if(!allowed.some(([value])=>value===type))return Swal.fire('Destino no permitido','','error');const destination=targetId.value.trim();if(!destination)return Swal.fire('Selecciona el destinatario','Usa el buscador para elegir una persona, grupo o estudiante.','warning');const destinatarioUids=resolveRecipients(type,destination);if(!destinatarioUids.length)return Swal.fire('Sin destinatarios','No existen cuentas activas vinculadas con esa selección.','warning');const file=document.getElementById('msg-file').files[0],state=document.getElementById('upload-state');try{state.textContent=file?'Subiendo adjunto a Cloudinary…':'Publicando…';const attachment=file?await uploadToCloudinary(file,'avisos'):null;const record={titulo:document.getElementById('msg-title').value.trim(),mensaje:document.getElementById('msg-body').value.trim(),prioridad:document.getElementById('msg-priority').value,destinatarioTipo:type,destinatarioId:destination,destinatarioNombre:targetSearch.value.trim(),destinatarioUids,creadoPorUid:user.uid,creadoPorNombre:profile.nombre||user.email,creadoPorRol:role,creadoEn:serverTimestamp(),activo:true,archivoUrl:attachment?.url||'',archivoNombre:attachment?.nombre||'',archivoPublicId:attachment?.publicId||'',archivoBytes:attachment?.bytes||0,archivoProveedor:attachment?'cloudinary':''};const created=await addDoc(collection(db,'avisos'),record);await auditEvent('aviso.publicado',{collection:'avisos',id:created.id},`${record.titulo} · ${destinatarioUids.length} destinatarios`);event.target.reset();updateTargetMode();state.textContent='';Swal.fire('Mensaje enviado',`Se notificará a ${destinatarioUids.length} destinatario(s).`,'success');}catch(error){state.textContent='';Swal.fire('No se pudo publicar',error.message,'error');}});
await loadDirectory(); updateTargetMode();
const preselectedUid=new URLSearchParams(location.search).get('to');
if(preselectedUid){const contact=contacts.find(item=>item.id===preselectedUid);if(contact){typeSelect.value='usuario';updateTargetMode();targetId.value=contact.id;targetSearch.value=contact.nombre||contact.usuario||contact.email;selectedTarget.textContent=`Seleccionado: ${targetSearch.value}`;}}
listenMessages();
