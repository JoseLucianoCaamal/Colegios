# Arquitectura del sistema

## Áreas funcionales

| Área | Entrada | Responsabilidad |
|---|---|---|
| Portal público | `index.html` | Información, calendario, galería y acceso |
| Autenticación | `pages/login.html` | Inicio de sesión y resolución del rol |
| Superadministración | `pages/dashboard-superadmin.html` | Seguridad, usuarios, infraestructura y auditoría |
| Dirección | `pages/dashboard-directora.html` | Docentes, grupos y supervisión académica |
| Docencia | `pages/dashboard-maestro.html` | Asistencia, calificaciones, fichas, materias y fotos |
| Recepción | `pages/dashboard-recepcion.html` | Registro y consulta de estudiantes |
| Comunicaciones | `pages/centro-mensajes.html` | Mensajes directos y colectivos |
| Perfil | `pages/perfil.html` | Personalización segura del usuario |

## Capas compartidas

- `js/firebase-config.js`: inicializa los SDK públicos de Firebase.
- `js/security.js`: carga el perfil UID, protege rutas y registra auditoría.
- `js/role-nav.js`: resuelve el panel correspondiente a cada rol.
- `js/message-widget.js`: mensajería disponible dentro de los paneles.
- `js/cloudinary-config.js`: cargas firmadas por preset; nunca contiene el API Secret.
- `firestore.rules`: autorización real. La interfaz no sustituye estas reglas.

## Decisión sobre las rutas

Las páginas internas están centralizadas en `pages/`. Los enlaces entre módulos permanecen relativos a esa carpeta y los recursos compartidos usan `../css`, `../js` y `../img`.

## Orden recomendado para la siguiente refactorización

1. Extraer scripts incrustados de autenticación y dashboards.
2. Extraer estilos incrustados de módulos académicos a `css/pages/`.
3. Crear componentes compartidos de encabezado, navegación y estados de carga.
4. Unificar mensajes de error y confirmaciones.
5. Añadir pruebas con Firebase Emulator Suite.
