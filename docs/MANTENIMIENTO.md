# Guía de mantenimiento

## Antes de publicar

1. Ejecutar `npm run check`.
2. Revisar `git diff --check`.
3. Confirmar que no se añadieron secretos o contraseñas.
4. Si cambió JavaScript, CSS o HTML cacheado, aumentar la versión en `sw.js`.
5. Si cambió `firestore.rules`, publicarlas por separado y probar cada rol.

## Convención de nombres

- HTML: `kebab-case.html`.
- JavaScript compartido: nombre funcional, por ejemplo `role-nav.js`.
- CSS de área: nombre funcional, por ejemplo `messages.css`.
- Colecciones Firestore: plural y minúsculas.
- Roles actuales: `superadmin`, `directora`, `recepcion`, `maestro`.

## Estrategia de refactorización

Nunca mover todas las páginas simultáneamente. Para cada módulo:

1. Identificar estilos y scripts incrustados.
2. Extraerlos a archivos propios.
3. Conservar IDs, rutas y comportamiento.
4. Ejecutar auditoría y prueba manual por rol.
5. Publicar en un cambio pequeño y reversible.
