---
name: verify
description: Cómo verificar NiniApp end-to-end en web con puppeteer-core + Edge contra el Firebase real
---

# Verificar NiniApp (web)

Receta que funcionó (jul 2026). La app es 100 % online contra Firebase
(niniapp-c401b): verificar crea datos reales (usuarios/grupos de prueba).

## Arranque

```bash
npx expo start --web --port 8081   # en background; ~15 s hasta bundle listo
```

Al terminar, matar el proceso `node` que escucha en 8081 (parar la shell de
fondo NO mata a Metro): `Get-NetTCPConnection -LocalPort 8081 -State Listen`
→ `Stop-Process -Id <pid>`.

## Handle: puppeteer-core + Edge del sistema

No hay Playwright. `npm i puppeteer-core` en un dir temporal y lanzar con
`executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'`,
`headless: 'new'`.

Gotchas de conducción (react-native-web):

- **Clic por coordenadas, no por handle**: `page.$$('input')[i].click()` falla
  ("Node is either not clickable") por elementos invisibles. Filtrar por
  `getClientRects().length > 0`, sacar el centro del `getBoundingClientRect()`
  y usar `page.mouse.click(x, y)`.
- **Botones/textos**: buscar `div,span,button,a` con `textContent.trim() === t`,
  ordenar por menos descendientes y clicar el centro del primero.
- **Inputs**: sin placeholder ni testID; van por orden visual de la pantalla.
- **Switches**: `[role="switch"]` (2 en counter-settings; el 2º es
  "varias veces al día").
- **Diálogos**: registrar `page.on('dialog', d => d.accept())` — la app usa
  `window.alert/confirm` en web y bloquean si no se aceptan.
- **Subir foto**: `Promise.all([page.waitForFileChooser(), clickText(...)])` y
  `chooser.accept([jpg])` — expo-image-picker web abre file chooser nativo.

## Flujo que cubre el dominio

1. Primer arranque → "Elige tu idioma" → "Español" → "Inicia sesión" →
   "¿No tienes cuenta? Regístrate" (3 inputs) → "Registrarse".
   Emails de prueba: `claude-verify-*-<ts>@example.com` / `verify123456`.
2. "Crear un grupo" (nombre + contraseña opcional) → parsear la ID de 6
   caracteres del texto "ID del grupo" → "Continuar".
3. Contador: tab "Contador" → "Crear contador" → nombre + switch 2 ON →
   "Guardar" → "+1" y "+1 con foto" (comprobar `Total acumulado: N` y que la
   foto de prueba tenga src `firebasestorage.googleapis.com`).
4. Segundo usuario en `browser.createBrowserContext()` (incógnito) → "Unirse
   a un grupo" con ID+contraseña → carrera: ambos clican "+1" a la vez →
   el total debe subir exactamente +2 (transacciones sin escrituras perdidas).
5. Perfil: "Perfil" → "Editar perfil" → "Cambiar foto" (file chooser) →
   "Guardar" → avatar con src de Storage `users/{uid}/profile-*.jpg`.
6. Sondas negativas: unirse con contraseña mala / ID inexistente →
   "ID o contraseña incorrectas".

## Limpieza

Los usuarios `claude-verify-*` y sus grupos quedan en Firebase (Auth,
Firestore `groups/{id}`, Storage `groups/{id}/`); borrarlos a mano en la
consola si molestan.
