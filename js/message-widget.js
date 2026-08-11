import { auth, db } from './firebase-config.js';
import { getCurrentProfile, auditEvent } from './security.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, getDocs, addDoc, onSnapshot, query, where, limit, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const initials = name => String(name || 'U').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const formatDate = value => value?.toDate ? value.toDate().toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';

onAuthStateChanged(auth, async user => {
  if (!user) return;
  const profile = await getCurrentProfile(user);
  if (!profile) return;

  const role = profile.rol;
  let received = new Map(), sent = new Map(), messages = [], contacts = [], view = 'messages', activeContact = null, firstSnapshot = true;

  ['css/message-widget.css', 'css/message-conversation.css'].forEach(href => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = href;
    document.head.appendChild(style);
  });

  const root = document.createElement('div');
  root.className = 'message-widget';
  root.innerHTML = `
    <button class="mw-launcher" aria-label="Abrir mensajes" title="Mensajes">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v12H7l-3 3z"/><path d="M8 9h8M8 13h5"/></svg>
      <span class="mw-count"></span>
    </button>
    <aside class="mw-drawer" aria-label="Mensajería escolar">
      <header class="mw-head">
        <a class="mw-avatar mw-profile-avatar" href="perfil.html" title="Personalizar mi perfil">${profile.fotoPerfil ? `<img src="${escapeHtml(profile.fotoPerfil)}" alt="">` : initials(profile.nombre)}</a>
        <div><strong>${escapeHtml(profile.nombre || user.email)}</strong><span>Mensajería escolar · ${escapeHtml(role)}</span></div>
        <a class="mw-profile-link" href="perfil.html">Mi perfil</a>
        <button class="mw-close" aria-label="Cerrar">×</button>
      </header>
      <div class="mw-toolbar">
        <input class="mw-search" placeholder="Buscar mensajes o contactos">
        <div class="mw-tabs"><button class="active" data-mw-view="messages">Mensajes</button><button data-mw-view="contacts">Contactos</button></div>
      </div>
      <div class="mw-list"></div>
    </aside>`;

  const headerHost = document.querySelector('.user-area, .sa-user');
  if (headerHost) {
    root.classList.add('mw-inline');
    const logout = headerHost.querySelector('#btn-logout');
    headerHost.insertBefore(root, logout || headerHost.firstChild);
  } else document.body.appendChild(root);

  const pageAvatar = document.querySelector('.user-avatar, .sa-user-avatar');
  if (pageAvatar) {
    pageAvatar.setAttribute('role', 'link');
    pageAvatar.setAttribute('tabindex', '0');
    pageAvatar.title = 'Personalizar mi perfil';
    if (profile.fotoPerfil) pageAvatar.innerHTML = `<img src="${escapeHtml(profile.fotoPerfil)}" alt="">`;
    const openProfile = () => { location.href = 'perfil.html'; };
    pageAvatar.addEventListener('click', openProfile);
    pageAvatar.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openProfile(); });
  }

  const drawer = root.querySelector('.mw-drawer');
  const list = root.querySelector('.mw-list');
  const badge = root.querySelector('.mw-count');
  const search = root.querySelector('.mw-search');
  const toolbar = root.querySelector('.mw-toolbar');
  const usersSnap = await getDocs(collection(db, 'usuarios'));
  contacts = usersSnap.docs.map(item => ({ id:item.id, ...item.data() })).filter(item => item.uid && item.activo !== false && item.id !== user.uid);

  const merge = () => {
    messages = [...new Map([...received, ...sent]).values()].sort((a, b) => (a.data.creadoEn?.seconds || 0) - (b.data.creadoEn?.seconds || 0));
    render();
  };
  const unread = () => [...received.values()].filter(item => !localStorage.getItem(`msg-read-${item.id}`));
  async function markRead(id) {
    localStorage.setItem(`msg-read-${id}`, '1');
    await setDoc(doc(db, 'avisos', id, 'lecturas', user.uid), { uid:user.uid, nombre:profile.nombre || user.email, leidoEn:serverTimestamp() }, { merge:true }).catch(() => {});
  }
  function openConversation(contact) { activeContact = contact; view = 'conversation'; search.value = ''; render(); }

  function renderConversation() {
    toolbar.hidden = true;
    list.classList.add('conversation-mode');
    const thread = messages.filter(({ data }) => data.destinatarioTipo === 'usuario' && ((data.creadoPorUid === user.uid && data.destinatarioId === activeContact.id) || (data.creadoPorUid === activeContact.id && Array.isArray(data.destinatarioUids) && data.destinatarioUids.includes(user.uid))));
    list.innerHTML = `
      <div class="mw-conversation-head"><button class="mw-back">‹</button><span class="mw-contact-avatar">${initials(activeContact.nombre)}</span><div><strong>${escapeHtml(activeContact.nombre || activeContact.usuario || activeContact.email)}</strong><span>${escapeHtml(activeContact.rol)} · ${escapeHtml(activeContact.usuario_original || activeContact.email)}</span></div></div>
      <div class="mw-thread">${thread.length ? thread.map(({ data }) => `<article class="mw-bubble ${data.creadoPorUid === user.uid ? 'mine' : 'theirs'}"><strong>${escapeHtml(data.titulo)}</strong><p>${escapeHtml(data.mensaje)}</p><time>${formatDate(data.creadoEn)}</time></article>`).join('') : '<div class="mw-empty">Inicia la conversación con este contacto.</div>'}</div>
      ${role === 'recepcion' ? '' : '<form class="mw-quick-form"><input maxlength="120" placeholder="Asunto" required><textarea maxlength="1000" placeholder="Escribir un mensaje…" required></textarea><button type="submit" aria-label="Enviar">➤</button></form>'}`;

    list.querySelector('.mw-back').addEventListener('click', () => { view = 'contacts'; activeContact = null; toolbar.hidden = false; render(); });
    thread.filter(item => item.data.creadoPorUid !== user.uid).forEach(item => markRead(item.id));
    const form = list.querySelector('.mw-quick-form');
    if (form) form.addEventListener('submit', async event => {
      event.preventDefault();
      const [input, textarea] = form.querySelectorAll('input,textarea');
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        const record = { titulo:input.value.trim(), mensaje:textarea.value.trim(), prioridad:'normal', destinatarioTipo:'usuario', destinatarioId:activeContact.id, destinatarioNombre:activeContact.nombre || activeContact.email, destinatarioUids:[activeContact.id], creadoPorUid:user.uid, creadoPorNombre:profile.nombre || user.email, creadoPorRol:role, creadoEn:serverTimestamp(), activo:true, archivoUrl:'' };
        const created = await addDoc(collection(db, 'avisos'), record);
        await auditEvent('aviso.privado_enviado', { collection:'avisos', id:created.id }, record.titulo);
        form.reset();
      } catch (error) { window.Swal?.fire('No se pudo enviar', error.message, 'error'); }
      finally { button.disabled = false; }
    });
    const threadBox = list.querySelector('.mw-thread');
    threadBox.scrollTop = threadBox.scrollHeight;
  }

  function render() {
    if (view === 'conversation' && activeContact) { renderConversation(); return; }
    list.classList.remove('conversation-mode');
    toolbar.hidden = false;
    const term = search.value.toLowerCase().trim();
    root.querySelectorAll('[data-mw-view]').forEach(item => item.classList.toggle('active', item.dataset.mwView === view));
    if (view === 'contacts') {
      const items = contacts.filter(item => `${item.nombre} ${item.usuario} ${item.email} ${item.rol}`.toLowerCase().includes(term));
      const mass = role === 'recepcion' ? '' : '<button class="mw-contact mw-mass-contact" data-mass-message><span class="mw-contact-avatar">✦</span><div><strong>Crear mensaje masivo</strong><span>Docentes, padres o destinatarios</span></div><b>›</b></button>';
      list.innerHTML = mass + (items.length ? items.map(item => `<button class="mw-contact" data-contact="${item.id}"><span class="mw-contact-avatar">${initials(item.nombre)}</span><div><strong>${escapeHtml(item.nombre || item.usuario || item.email)}</strong><span>${escapeHtml(item.rol)} · ${escapeHtml(item.usuario_original || item.email)}</span></div><b>›</b></button>`).join('') : '<div class="mw-empty">No se encontraron contactos.</div>');
      list.querySelector('[data-mass-message]')?.addEventListener('click', () => { location.href = 'centro-mensajes.html'; });
      list.querySelectorAll('[data-contact]').forEach(button => button.addEventListener('click', () => openConversation(contacts.find(item => item.id === button.dataset.contact))));
      return;
    }
    const items = [...received.values()].sort((a, b) => (b.data.creadoEn?.seconds || 0) - (a.data.creadoEn?.seconds || 0)).filter(item => `${item.data.titulo} ${item.data.mensaje} ${item.data.creadoPorNombre}`.toLowerCase().includes(term));
    list.innerHTML = items.length ? items.map(({ id, data }) => `<button class="mw-item ${localStorage.getItem(`msg-read-${id}`) ? '' : 'unread'}" data-mw-message="${id}"><span class="mw-item-top"><strong>${escapeHtml(data.creadoPorNombre || 'Personal escolar')}</strong><time>${formatDate(data.creadoEn)}</time></span><p>${escapeHtml(data.titulo)} · ${escapeHtml(data.mensaje)}</p></button>`).join('') : '<div class="mw-empty">No tienes mensajes nuevos.</div>';
    list.querySelectorAll('[data-mw-message]').forEach(button => button.addEventListener('click', async () => {
      const item = received.get(button.dataset.mwMessage), contact = contacts.find(contactItem => contactItem.id === item?.data.creadoPorUid);
      await markRead(button.dataset.mwMessage);
      if (contact) openConversation(contact); else { view = 'messages'; render(); }
    }));
    const count = unread().length;
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.toggle('visible', count > 0);
  }

  function toast(data) {
    root.querySelector('.mw-toast')?.remove();
    const toastNode = document.createElement('div');
    toastNode.className = 'mw-toast';
    toastNode.innerHTML = `<strong>Nuevo mensaje de ${escapeHtml(data.creadoPorNombre || 'personal escolar')}</strong><span>${escapeHtml(data.titulo)}</span>`;
    root.appendChild(toastNode);
    setTimeout(() => toastNode.remove(), 5500);
    if (window.Notification?.permission === 'granted') new Notification(data.titulo, { body:data.mensaje, icon:'Img/logo.png' });
  }

  root.querySelector('.mw-launcher').addEventListener('click', () => drawer.classList.add('open'));
  root.querySelector('.mw-close').addEventListener('click', () => drawer.classList.remove('open'));
  root.querySelectorAll('[data-mw-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.mwView; activeContact = null; render(); }));
  search.addEventListener('input', render);
  onSnapshot(query(collection(db, 'avisos'), where('destinatarioUids', 'array-contains', user.uid), limit(60)), snapshot => {
    const previous = new Set(received.keys());
    received = new Map(snapshot.docs.map(item => [item.id, { id:item.id, data:item.data() }]));
    if (!firstSnapshot) { const newest = [...received.values()].find(item => !previous.has(item.id)); if (newest) toast(newest.data); }
    firstSnapshot = false; merge();
  });
  onSnapshot(query(collection(db, 'avisos'), where('creadoPorUid', '==', user.uid), limit(60)), snapshot => { sent = new Map(snapshot.docs.map(item => [item.id, { id:item.id, data:item.data() }])); merge(); });
});
