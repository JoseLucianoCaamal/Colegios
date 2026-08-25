# Centro Educativo Amor y Libertad

Portal público y plataforma escolar estática desplegada en GitHub Pages. Usa Firebase Authentication y Cloud Firestore para identidad y datos, y Cloudinary para archivos e imágenes.

## Estructura del proyecto

```text
Colegio/
├─ index.html                 Portal público
├─ pages/                     Acceso, paneles y módulos funcionales
├─ css/                       Estilos por área
├─ js/                        Configuración, seguridad y funciones compartidas
├─ img/                       Identidad visual y documentos públicos
├─ docs/                      Arquitectura y convenciones
├─ tools/                     Auditorías locales sin dependencias
├─ firestore.rules            Autorización de Cloud Firestore
├─ firebase.json              Configuración de Firebase CLI
├─ manifest.json              Aplicación instalable
└─ sw.js                      Caché y actualización de la aplicación
```

`index.html` es la única página HTML de la raíz. El acceso, los paneles y los módulos viven en `pages/`; sus recursos compartidos permanecen en `css/`, `js/` e `img/`.

## Comprobación rápida

No requiere instalar dependencias:

```bash
npm run audit
npm run check
```

La auditoría detecta recursos locales inexistentes, IDs HTML duplicados y mide cuánto código continúa incrustado en las páginas.

## Reglas básicas

- No guardar secretos de Cloudinary ni credenciales administrativas en el navegador.
- El ID de `usuarios/{uid}` debe coincidir con el UID de Firebase Authentication.
- Toda página protegida debe usar `requireRoles()`.
- Todo enlace de regreso al panel debe usar `data-role-home`.
- Los archivos nuevos deben escribirse en UTF-8.
- Los cambios del Service Worker deben aumentar `CACHE_NAME`.

Consulta [Arquitectura](docs/ARQUITECTURA.md) y [Guía de mantenimiento](docs/MANTENIMIENTO.md).
