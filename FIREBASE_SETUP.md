# Configurar Firebase para NiniApp

La app ya está conectada al proyecto **niniapp-c401b** (configuración en
`services/firebase.ts`) y funciona 100 % online en tiempo real: autenticación
con Firebase Auth y datos en Firestore. El antiguo modo local con miembros
demo se eliminó. Estos pasos quedan como referencia de cómo se configuró.

## 1. Crear el proyecto (5 min)

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google.
2. **Añadir proyecto** → nombre `niniapp` (el que quieras) → puedes desactivar
   Google Analytics → **Crear**.
3. En la pantalla del proyecto, pulsa el icono **Web `</>`** para añadir una
   app web → apodo `NiniApp` → **Registrar app**.
4. La consola te muestra un bloque `const firebaseConfig = { ... }`.
   **Copia esos valores en `services/firebase.ts`** (sustituye los `'TODO'`).

## 2. Activar Authentication

1. Menú lateral → **Authentication** → **Comenzar**.
2. Pestaña *Sign-in method*:
   - Activa **Correo electrónico/contraseña**.
   - Activa **Google** (elige un correo de soporte). Esto hace funcionar el
     botón "Continuar con Google" en la web/PWA. Para el login con Google
     nativo en Android hará falta además crear el OAuth client de Android en
     Google Cloud y usar `expo-auth-session` (pendiente, marcado con TODO en
     `services/auth.ts`).

## 3. Activar Cloud Firestore

1. Menú lateral → **Firestore Database** → **Crear base de datos**.
2. Ubicación: `eur3 (europe-west)` va bien.
3. Empieza en **modo de prueba** para probar ya mismo, y luego pega estas
   reglas mínimas (pestaña *Reglas*):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /groups/{groupId} {
      // v1: cualquier usuario autenticado puede leer (necesario para unirse
      // con ID+contraseña) y los miembros pueden escribir.
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

> ⚠️ v1 pragmática: la contraseña del grupo viaja dentro del documento del
> grupo. Para el lanzamiento real, mover la validación de unirse a una Cloud
> Function y guardar la contraseña hasheada (TODO en `services/groups.ts`).

## 4. Probar

```bash
npm run web      # o npm run android
```

Regístrate con un email real, crea un grupo desde un dispositivo y únete desde
otro con la ID + contraseña: los votos, el contador y los toques se sincronizan
en tiempo real (Firestore `onSnapshot`).

## Modelo de datos

- `users/{uid}` → perfil del usuario (`types/models.ts` → `User`).
- `groups/{groupId}` → **todo el estado del grupo** en un documento
  (`GroupData`: miembros, eventos, votos, contador, aportes, toques).
  - Simple y en tiempo real; límite de 1 MB por documento. Las fotos van en
    base64 comprimido — para muchos usuarios/fotos, migrar a Firebase Storage
    (TODO en `utils/pickImage.ts`).

## Pendiente para después (marcado con TODO en el código)

- **Push reales**: FCM (Android) + Web Push con VAPID (PWA iOS) enviados desde
  Cloud Functions al crear eventos, hitos de racha y toques. Ahora mismo las
  notificaciones son locales al dispositivo.
- **Google nativo Android** con `expo-auth-session`.
- **Borrado programado** de fotos de prueba a las 24 h con Cloud Scheduler
  (ahora se hace al abrir la app).
