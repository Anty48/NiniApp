# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Deploy

- Web: `git push` → Vercel (proyecto `nini-app`) despliega solo, incluida la
  función serverless de `api/`.
- APK Android (solo cambios de JS, sin tocar nativo): `npx eas update --channel production`.
  Solo llega a APKs compilados con `expo-updates` (builds posteriores a jul 2026).
- Cambios nativos (dependencias con código nativo, app.json/plugins): además
  `npx eas build -p android --profile production` y redistribuir el APK.
