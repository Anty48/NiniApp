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
     botón "Continuar con Google" en la web/PWA. El login con Google nativo
     en Android ya funciona (`react-native-nitro-google-signin` + development
     build de EAS; requiere `google-services.json` y el SHA-1 del keystore de
     EAS dado de alta en Firebase).

## 3. Activar Cloud Firestore

1. Menú lateral → **Firestore Database** → **Crear base de datos**.
2. Ubicación: `eur3 (europe-west)` va bien.
3. Pega estas reglas **v2** en la pestaña *Reglas* y pulsa **Publicar**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /groups/{groupId} {
      // Leer: cualquier autenticado (necesario para unirse con ID+contraseña).
      allow read: if request.auth != null;
      // Crear: solo si el creador queda registrado como admin del grupo.
      allow create: if request.auth != null
        && request.resource.data.group.memberRoles[request.auth.uid] == 'admin';
      // Actualizar: miembros actuales del grupo, o alguien que se está
      // añadiendo a sí mismo como 'member' (flujo de unirse). Salir del grupo
      // también entra por la primera rama (el que sale aún es miembro).
      allow update: if request.auth != null && (
        request.auth.uid in resource.data.group.memberRoles
        || request.resource.data.group.memberRoles[request.auth.uid] == 'member'
      );
      // El cliente nunca borra documentos de grupo.
      allow delete: if false;
    }
    match /suggestions/{suggestionId} {
      // Buzón de sugerencias para el desarrollador: cualquier usuario
      // autenticado puede CREAR una sugerencia, pero nadie puede leerlas,
      // editarlas ni borrarlas desde la app. El desarrollador las lee desde
      // la consola de Firebase (que salta las reglas). El borrado a los
      // 5 días lo hace la política TTL de Firestore sobre `expireAt`.
      allow create: if request.auth != null;
      allow read, update, delete: if false;
    }
  }
}
```

### Activar el autoborrado (TTL) de las sugerencias

Para que las sugerencias se borren solas 5 días después de crearse (gratis,
sin Cloud Functions):

1. Consola de Firebase → **Firestore Database** → pestaña **TTL** (o *Time to
   live*).
2. **Crear política** → **Colección**: `suggestions` → **Campo de tiempo de
   vida**: `expireAt` → **Crear**.

Firestore borrará cada documento automáticamente a partir de la fecha guardada
en `expireAt` (creación + 5 días; el borrado real ocurre dentro de las 24-72 h
siguientes a esa fecha, comportamiento normal del TTL). El campo `expireAt` ya
lo escribe la app en cada envío (`services/suggestions.ts`).

> ⚠️ Límite conocido de la v2: la contraseña del grupo viaja dentro del
> documento (legible por cualquier autenticado) y las reglas no pueden
> comprobarla, así que un usuario malicioso podría unirse sin contraseña
> escribiéndose como 'member'. Para el lanzamiento real, mover la validación
> de unirse a una Cloud Function y guardar la contraseña hasheada (TODO en
> `services/groups.ts`).

## 4. Activar Cloud Storage (fotos)

Las fotos (perfil, grupo y pruebas del contador) se suben a Firebase Storage
(`services/photos.ts`) y en Firestore solo se guarda la URL.

1. Menú lateral → **Storage** → **Comenzar**. Desde finales de 2024 los
   proyectos nuevos necesitan el plan **Blaze** (pago por uso, requiere
   tarjeta) para crear el bucket; la cuota gratuita mensual (5 GB, 1 GB/día de
   descarga) sobra de largo para un grupo de amigos, coste ≈ 0 €.
2. Ubicación: la misma región que Firestore.
3. Pega estas reglas en la pestaña *Reglas* de Storage y pulsa **Publicar**
   (usan `firestore.get` para comprobar la membresía del grupo):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Foto de perfil: cada usuario escribe solo en su carpeta.
    match /users/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
    // Foto del grupo y pruebas del contador: solo miembros del grupo.
    match /groups/{groupId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/.*')
        && request.auth.uid in firestore.get(
             /databases/(default)/documents/groups/$(groupId)
           ).data.group.memberRoles;
    }
  }
}
```

Si Storage no está activado, la app sigue funcionando: al fallar la subida se
muestra un aviso y no se guarda la foto.

## 5. Probar

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
  - Simple y en tiempo real; límite de 1 MB por documento (las fotos ya NO
    van dentro: se suben a Storage y solo se guarda la URL).
  - Todas las escrituras del cliente pasan por `runTransaction`
    (`mutateGroupData` en `services/groupData.ts`): se relee el documento
    fresco y se le aplica la mutación, así dos miembros simultáneos no se
    pisan.
- `suggestions/{id}` → sugerencias sobre la app para el desarrollador
  (`types/models.ts` → `Suggestion`). Solo se crean desde el cliente; se leen
  desde la consola de Firebase y se autoborran a los 5 días con la política
  TTL sobre `expireAt`.
- Storage: `users/{uid}/profile-*.jpg`, `groups/{gid}/photo-*.jpg` y
  `groups/{gid}/proofs/{uid}-*.jpg`.

## Pendiente para después (marcado con TODO en el código)

- **Push reales**: FCM (Android) + Web Push con VAPID (PWA iOS) enviados desde
  Cloud Functions al crear eventos, hitos de racha y toques. Ahora mismo las
  notificaciones son locales al dispositivo.
- **Unirse vía Cloud Function** con contraseña hasheada (ver aviso en las
  reglas de Firestore).
- **Borrado programado** de fotos de prueba a las 24 h con Cloud Scheduler:
  la referencia se quita del documento al abrir la app, pero el archivo
  sigue en Storage hasta que exista esa limpieza.
