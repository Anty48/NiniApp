/**
 * Función serverless de Vercel que entrega las notificaciones push.
 * (Vercel despliega todo lo que hay en /api junto a la web estática.)
 *
 * POST /api/push  { groupId, toUserIds[], title, body, url? }
 *   - Authorization: Bearer <Firebase ID token> del remitente.
 *   - Verifica el token, comprueba que remitente y destinatarios son miembros
 *     del grupo y entrega a cada dispositivo registrado en users/{uid}:
 *       · kind 'web' -> web-push (VAPID), lo pinta public/push-sw.js
 *       · kind 'fcm' -> Firebase Cloud Messaging (APK Android)
 *   - Los dispositivos muertos (suscripción caducada, token invalidado) se
 *     eliminan del documento del usuario.
 *
 * Variables de entorno (Vercel):
 *   FIREBASE_SERVICE_ACCOUNT  JSON de la cuenta de servicio de niniapp-c401b
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 */

// API modular de firebase-admin (subpaths CJS con exports con nombre): el
// namespace clásico `require('firebase-admin')` llega roto tras el bundler
// de Vercel (admin.apps/admin.credential undefined).
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const webpush = require('web-push');

const MAX_TARGETS = 50;
const MAX_TEXT = 300;

let ready = false;
function init() {
  if (ready) return;
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({ credential: cert(serviceAccount) });
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:psardapalla48@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  ready = true;
}

module.exports = async (req, res) => {
  // CORS abierto: la autorización real es el ID token de Firebase.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'push-not-configured' });
  }
  init();

  const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const sender = await getAuth().verifyIdToken(idToken).catch(() => null);
  if (!sender) return res.status(401).json({ error: 'unauthorized' });

  const { groupId, toUserIds, title, body, url } = req.body || {};
  if (
    typeof groupId !== 'string' ||
    !Array.isArray(toUserIds) ||
    toUserIds.length === 0 ||
    toUserIds.length > MAX_TARGETS ||
    !toUserIds.every((id) => typeof id === 'string') ||
    typeof title !== 'string' ||
    typeof body !== 'string'
  ) {
    return res.status(400).json({ error: 'bad-request' });
  }

  const db = getFirestore();

  // El remitente y todos los destinatarios deben ser miembros del grupo.
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  const roles = groupSnap.exists ? (groupSnap.data().group || {}).memberRoles || {} : {};
  if (!(sender.uid in roles)) return res.status(403).json({ error: 'not-a-member' });
  const targets = [...new Set(toUserIds)].filter((id) => id !== sender.uid && id in roles);

  const payload = {
    title: title.slice(0, MAX_TEXT),
    body: body.slice(0, MAX_TEXT),
    url: typeof url === 'string' ? url.slice(0, MAX_TEXT) : '/',
  };

  let delivered = 0;
  await Promise.all(
    targets.map(async (uid) => {
      const userRef = db.doc(`users/${uid}`);
      const userSnap = await userRef.get();
      const devices = (userSnap.exists && userSnap.data().pushDevices) || [];
      if (!devices.length) return;

      const dead = [];
      await Promise.all(
        devices.map(async (device) => {
          try {
            if (device.kind === 'web' && device.subscription) {
              await webpush.sendNotification(device.subscription, JSON.stringify(payload), {
                TTL: 24 * 3600,
              });
            } else if (device.kind === 'fcm' && device.token) {
              await getMessaging().send({
                token: device.token,
                notification: { title: payload.title, body: payload.body },
                data: { url: payload.url },
                android: { priority: 'high', notification: { channelId: 'default' } },
              });
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
    }),
  );

  return res.status(200).json({ delivered });
};
