import { Platform } from 'react-native';

import { getFirebase } from '@/services/firebase';

/**
 * Push real multiplataforma.
 *
 * Registro (este archivo, lado cliente):
 *  - Web (incluida la PWA de iOS 16.4+): Web Push estándar con VAPID. El
 *    service worker `public/push-sw.js` muestra la notificación al llegar.
 *  - Android nativo: token de dispositivo FCM vía expo-notifications (el APK
 *    se compila con google-services.json, así que el token existe sin más).
 *
 * Los dispositivos se guardan en `users/{uid}.pushDevices` (solo el propio
 * usuario puede escribir su doc; el servidor los lee con el SDK admin).
 *
 * Envío: POST a /api/push (función serverless en Vercel, `api/push.js`) con
 * el ID token de Firebase del remitente. El servidor verifica el token,
 * comprueba que remitente y destinatarios comparten grupo y entrega vía
 * web-push (VAPID) o FCM según el tipo de dispositivo.
 */

/** Clave pública VAPID (es pública por diseño; la privada vive en Vercel). */
export const VAPID_PUBLIC_KEY =
  'BEsFu5udpxKlCEFbGCHr_MhRvc9KVk45X1hroMXDrEi2PNDK_-CxEyozDqPN5NQMj7Hl4bpAiU2SnjqYcPLHXYU';

/** En web el endpoint es del mismo origen; en nativo se llama a producción. */
const PUSH_ENDPOINT =
  Platform.OS === 'web' ? '/api/push' : 'https://www.niniapp.org/api/push';

export interface PushDevice {
  kind: 'web' | 'fcm';
  /** Identificador único: endpoint de la suscripción (web) o token (fcm). */
  endpoint?: string;
  subscription?: unknown;
  token?: string;
  updatedAt: string;
}

export type PushStatus =
  /** Registrado y con permiso en este dispositivo. */
  | 'enabled'
  /** Soportado pero aún sin activar. */
  | 'off'
  /** El usuario denegó el permiso (se reactiva desde ajustes del sistema/navegador). */
  | 'denied'
  /** iOS en Safari sin instalar: hay que añadir la PWA a la pantalla de inicio. */
  | 'need-install'
  | 'unsupported';

// ---------- Detección de soporte ----------

function webPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** iOS solo expone la Push API dentro de la PWA instalada (iOS 16.4+). */
function isIosBrowserWithoutInstall(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos =
    /iP(hone|ad|od)/.test(ua) ||
    // iPadOS se anuncia como Mac pero tiene pantalla táctil.
    (ua.includes('Mac') && 'ontouchend' in document);
  const standalone =
    (navigator as any).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)')?.matches === true;
  return isIos && !standalone;
}

// ---------- Registro del dispositivo ----------

/** Añade/actualiza el dispositivo en users/{uid}.pushDevices (dedupe por id). */
async function savePushDevice(device: PushDevice): Promise<void> {
  const { auth, db } = getFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const { doc, getDoc, updateDoc } = require('@firebase/firestore');
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const current: PushDevice[] = (snap.exists() && snap.data().pushDevices) || [];
  const id = device.endpoint ?? device.token;
  const rest = current.filter((d) => (d.endpoint ?? d.token) !== id);
  await updateDoc(ref, { pushDevices: [...rest, device] });
}

async function registerWebDevice(): Promise<void> {
  const registration = await navigator.serviceWorker.register('/push-sw.js');
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  await savePushDevice({
    kind: 'web',
    endpoint: subscription.endpoint,
    // toJSON() serializa endpoint + claves p256dh/auth, lo que necesita web-push.
    subscription: JSON.parse(JSON.stringify(subscription.toJSON())),
    updatedAt: new Date().toISOString(),
  });
}

async function registerNativeDevice(): Promise<void> {
  const Notifications = require('expo-notifications');
  if (Platform.OS === 'android') {
    // En Android 13+ el prompt de permiso no aparece sin un canal creado.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'NiniApp',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  const token = await Notifications.getDevicePushTokenAsync();
  await savePushDevice({
    kind: 'fcm',
    token: String(token.data),
    updatedAt: new Date().toISOString(),
  });
}

/** Estado actual del push en este dispositivo (para pintar el ajuste). */
export async function getPushStatus(): Promise<PushStatus> {
  try {
    if (Platform.OS === 'web') {
      if (!webPushSupported()) {
        return isIosBrowserWithoutInstall() ? 'need-install' : 'unsupported';
      }
      if (Notification.permission === 'denied') return 'denied';
      if (Notification.permission !== 'granted') return 'off';
      const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
      const subscription = registration && (await registration.pushManager.getSubscription());
      return subscription ? 'enabled' : 'off';
    }
    const Notifications = require('expo-notifications');
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) return 'enabled';
    return permission.canAskAgain === false ? 'denied' : 'off';
  } catch {
    return 'unsupported';
  }
}

/**
 * Activación explícita (botón del Perfil): pide el permiso y registra el
 * dispositivo. Debe llamarse desde un gesto del usuario (iOS lo exige).
 */
export async function enablePush(): Promise<PushStatus> {
  try {
    if (Platform.OS === 'web') {
      if (!webPushSupported()) {
        return isIosBrowserWithoutInstall() ? 'need-install' : 'unsupported';
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
      await registerWebDevice();
      return 'enabled';
    }
    const Notifications = require('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return 'denied';
    await registerNativeDevice();
    return 'enabled';
  } catch (e) {
    console.warn('No se pudo activar el push', e);
    return 'unsupported';
  }
}

/**
 * Re-registro silencioso al arrancar con sesión: si el permiso ya está
 * concedido, refresca el token/suscripción (rotan con el tiempo). Nunca
 * muestra el prompt de permiso.
 */
export async function refreshPushIfEnabled(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (!webPushSupported() || Notification.permission !== 'granted') return;
      await registerWebDevice();
      return;
    }
    const Notifications = require('expo-notifications');
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) await registerNativeDevice();
  } catch (e) {
    console.warn('No se pudo refrescar el registro de push', e);
  }
}

// ---------- Envío ----------

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /**
   * Variantes por idioma ({ es: {title, body}, ... }): el servidor entrega a
   * cada destinatario la de SU idioma; title/body quedan como reserva.
   */
  i18n?: Record<string, { title: string; body: string }>;
  /** Nº de notificaciones a enviar de golpe a cada destinatario (1-10). */
  repeat?: number;
}

/**
 * Notifica a otros miembros del grupo en todos sus dispositivos registrados.
 * Fire-and-forget: nunca bloquea ni rompe la acción que lo dispara.
 */
export function sendPushToUsers(
  groupId: string,
  toUserIds: string[],
  payload: PushPayload,
): void {
  if (toUserIds.length === 0) return;
  (async () => {
    const { auth } = getFirebase();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    const response = await fetch(PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ groupId, toUserIds, ...payload }),
    });
    if (!response.ok) {
      console.warn(`El envío de push respondió ${response.status}`);
    }
  })().catch((e) => console.warn('No se pudo enviar el push', e));
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
