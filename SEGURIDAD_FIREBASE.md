# Activación segura de Firebase

No publiques `firestore.rules` todavía. Primero completa la migración de usuarios.

## 1. Crear el superusuario por UID

1. En Firebase Console abre **Authentication > Users**.
2. Copia el UID de tu cuenta de mantenimiento.
3. En Firestore crea `usuarios/{UID}` usando ese UID como identificador.
4. Agrega estos campos:

```text
nombre: "Administrador del sistema"
email: "tu-correo@amorylibertad.org"
rol: "superadmin"
activo: true
```

No borres todavía el documento antiguo del usuario.

## 2. Migrar las demás cuentas

Cada cuenta de Authentication debe tener un documento `usuarios/{UID}` con:

```text
nombre: string
email: string en minúsculas
rol: "directora" | "maestro" | "recepcion"
activo: true
```

Mantén temporalmente los documentos antiguos hasta actualizar y probar el inicio de sesión.

## 3. Campos requeridos en registros académicos

Las escrituras de maestros se validan usando `maestro_email`. Debe coincidir exactamente con el correo de Firebase Authentication, en minúsculas, dentro de:

- `materias`
- `asistencias`
- `calificaciones`
- `fichas`

## 4. Probar antes de publicar

Usa el simulador de reglas de Firebase o Firebase Emulator Suite. Comprueba como mínimo:

- Un maestro no puede administrar usuarios, grupos ni eliminar registros.
- Recepción puede crear y actualizar alumnos, pero no calificaciones.
- Dirección puede gestionar información académica.
- El superusuario puede administrar usuarios y configuración.
- Una persona sin sesión solo puede leer `fotos` y `web_config`.

## 5. Publicación

Después de verificar todos los documentos UID:

```text
firebase deploy --only firestore:rules,storage
```

## 6. API key y App Check

La API key de Firebase Web es pública por diseño y no autoriza acceso a los datos. No intentes ocultarla con JavaScript ofuscado ni variables de GitHub Pages: el navegador siempre podrá verla.

En Google Cloud Console limita la clave a los dominios autorizados y únicamente a APIs de Firebase. Después registra App Check con reCAPTCHA Enterprise, monitorea solicitudes y activa la aplicación obligatoria en Firestore.

## Archivos y fotografías

Este proyecto utiliza Cloudinary, no Firebase Storage. El navegador solo puede contener el `cloud name` y un `upload preset` sin firma con límites de formato y tamaño. Nunca publiques el API Secret de Cloudinary. `storage.rules` se conserva únicamente como referencia y no forma parte de `firebase.json` ni del despliegue actual.

Nunca coloques en este repositorio:

- claves privadas de cuentas de servicio;
- secretos de reCAPTCHA;
- credenciales de Firebase Admin SDK;
- claves de APIs externas como Gemini, Stripe o correo.

Esos secretos deben vivir en Cloud Functions/Cloud Run y Secret Manager.
