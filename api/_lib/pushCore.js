/**
 * Núcleo compartido de envío de push (lo usan api/push.js y
 * api/vote-reminders.js). Vercel no publica como ruta los archivos bajo
 * directorios con prefijo "_".
 *
 * Gotchas de este runtime (aprendidos a base de FUNCTION_INVOCATION_FAILED):
 *  - Usar la API modular de firebase-admin (subpaths); el namespace clásico
 *    llega roto tras el bundler.
 *  - firebase-admin debe ser v12: v13+ arrastra jose v6 solo-ESM que el
 *    runtime no puede require().
 *  - Las env vars pueden traer BOM si se grabaron desde Windows: env() lo sanea.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const webpush = require('web-push');

const MAX_TEXT = 300;

/** Sanea una env var: fuera BOM (se cuela al pegar valores en Windows) y espacios. */
function env(name) {
  return (process.env[name] || '').replace(new RegExp('^\\uFEFF'), '').trim();
}

let ready = false;
function init() {
  if (ready) return;
  const serviceAccount = JSON.parse(env('FIREBASE_SERVICE_ACCOUNT'));
  initializeApp({ credential: cert(serviceAccount) });
  webpush.setVapidDetails(
    env('VAPID_SUBJECT') || 'mailto:psardapalla48@gmail.com',
    env('VAPID_PUBLIC_KEY'),
    env('VAPID_PRIVATE_KEY'),
  );
  ready = true;
}

/** Recorta título/cuerpo/url a tamaños sanos. */
function clampPayload({ title, body, url }) {
  return {
    title: String(title).slice(0, MAX_TEXT),
    body: String(body).slice(0, MAX_TEXT),
    url: typeof url === 'string' ? url.slice(0, MAX_TEXT) : '/',
  };
}

/**
 * Entrega el payload a todos los dispositivos registrados del usuario
 * (users/{uid}.pushDevices) y elimina del doc los dispositivos muertos.
 * Devuelve el número de entregas correctas.
 *
 * `payload` puede ser una función (userData) => payload para construir el
 * texto en el idioma del destinatario (users/{uid}.language).
 *
 * `repeat` (1-10) manda esa misma notificación varias veces de golpe (lo usan
 * los "tipos de tocar" del grupo). Cada envío es una notificación separada.
 */
async function deliverToUser(db, uid, payload, repeat = 1) {
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const userData = (userSnap.exists && userSnap.data()) || {};
  if (typeof payload === 'function') payload = payload(userData);
  const devices = userData.pushDevices || [];
  if (!devices.length) return 0;
  const times = Math.max(1, Math.min(10, Math.floor(Number(repeat) || 1)));

  let delivered = 0;
  const dead = [];
  await Promise.all(
    devices.map(async (device) => {
      try {
        if (device.kind === 'web' && device.subscription) {
          for (let i = 0; i < times; i++) {
            await webpush.sendNotification(device.subscription, JSON.stringify(payload), {
              TTL: 24 * 3600,
            });
          }
        } else if (device.kind === 'fcm' && device.token) {
          for (let i = 0; i < times; i++) {
            await getMessaging().send({
              token: device.token,
              notification: { title: payload.title, body: payload.body },
              // tag único por envío: Android/FCM no colapsa las repeticiones.
              data: { url: payload.url, tag: `${Date.now()}-${i}` },
              android: {
                priority: 'high',
                notification: { channelId: 'default', tag: `poke-${Date.now()}-${i}` },
              },
            });
          }
        } else {
          return;
        }
        delivered++;
      } catch (e) {
        const gone =
          e.statusCode === 404 ||
          e.statusCode === 410 ||
          e.code === 'messaging/registration-token-not-registered' ||
          e.code === 'messaging/invalid-argument';
        if (gone) dead.push(device);
        else console.warn(`Push a ${uid} falló`, e.message || e);
      }
    }),
  );
  if (dead.length) {
    const alive = devices.filter((d) => !dead.includes(d));
    await userRef.update({ pushDevices: alive }).catch(() => {});
  }
  return delivered;
}

module.exports = { env, init, clampPayload, deliverToUser, getAuth, getFirestore };
