/**
 * Función serverless de Vercel que entrega las notificaciones push que un
 * usuario dispara con sus acciones (tocar, crear evento, hito de racha).
 * (Vercel despliega todo lo que hay en /api junto a la web estática.)
 *
 * POST /api/push  { groupId, toUserIds[], title, body, url?, i18n? }
 *   - Authorization: Bearer <Firebase ID token> del remitente.
 *   - i18n (opcional): { es: {title, body}, en: {...}, ca: {...} }. Si llega,
 *     cada destinatario recibe el texto en SU idioma (users/{uid}.language);
 *     title/body quedan como reserva si falta su idioma.
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

const { env, init, clampPayload, deliverToUser, getAuth, getFirestore } = require('./_lib/pushCore');

const MAX_TARGETS = 50;

module.exports = async (req, res) => {
  // CORS abierto: la autorización real es el ID token de Firebase.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });

  if (!env('FIREBASE_SERVICE_ACCOUNT')) {
    return res.status(500).json({ error: 'push-not-configured' });
  }
  init();

  const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const sender = await getAuth().verifyIdToken(idToken).catch(() => null);
  if (!sender) return res.status(401).json({ error: 'unauthorized' });

  const { groupId, toUserIds, title, body, url, i18n } = req.body || {};
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

  // Variantes por idioma saneadas: { es: {title, body}, ... }
  const variants = {};
  if (i18n && typeof i18n === 'object') {
    for (const lang of Object.keys(i18n)) {
      const v = i18n[lang];
      if (v && typeof v.title === 'string' && typeof v.body === 'string') {
        variants[lang] = clampPayload({ title: v.title, body: v.body, url });
      }
    }
  }

  const db = getFirestore();

  // El remitente y todos los destinatarios deben ser miembros del grupo.
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  const roles = groupSnap.exists ? (groupSnap.data().group || {}).memberRoles || {} : {};
  if (!(sender.uid in roles)) return res.status(403).json({ error: 'not-a-member' });
  const targets = [...new Set(toUserIds)].filter((id) => id !== sender.uid && id in roles);

  // Cada destinatario recibe el texto en su idioma si hay variante.
  const fallback = clampPayload({ title, body, url });
  const payloadFor = (userData) => variants[userData.language] || fallback;
  const counts = await Promise.all(targets.map((uid) => deliverToUser(db, uid, payloadFor)));

  return res.status(200).json({ delivered: counts.reduce((a, b) => a + b, 0) });
};
