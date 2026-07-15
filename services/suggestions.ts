import { Platform } from 'react-native';

import { getFirebase } from '@/services/firebase';
import { User } from '@/types/models';

/** Días que vive una sugerencia antes de que el TTL de Firestore la borre. */
export const SUGGESTION_TTL_DAYS = 5;

/**
 * Envía una sugerencia sobre la app al desarrollador. Se guarda en la
 * colección `suggestions` de Firestore, que solo el desarrollador lee desde
 * la consola de Firebase (las reglas prohíben leerla desde el cliente).
 *
 * Si `anonymous` es true no se guarda ningún dato del remitente (ni id, ni
 * nombre, ni email): el anonimato es real también para el desarrollador.
 *
 * Cada documento lleva `expireAt` = ahora + 5 días (Timestamp de Firestore):
 * con la política TTL de Firestore activada sobre ese campo, Firebase borra
 * la sugerencia sola y gratis pasado ese plazo.
 */
export async function sendSuggestion(
  user: User,
  text: string,
  anonymous = false,
): Promise<void> {
  const { db } = getFirebase();
  // '@firebase/*' scoped, igual que el resto del proyecto (ver firebase.ts).
  const { collection, addDoc, serverTimestamp, Timestamp } = require('@firebase/firestore');
  const expireMs = Date.now() + SUGGESTION_TTL_DAYS * 24 * 3600 * 1000;
  await addDoc(collection(db, 'suggestions'), {
    text: text.trim(),
    anonymous,
    ...(anonymous
      ? {}
      : {
          userId: user.id,
          userName: user.nickname ?? user.username,
          userEmail: user.email,
        }),
    platform: Platform.OS,
    createdAt: serverTimestamp(),
    expireAt: Timestamp.fromMillis(expireMs),
  });
}
