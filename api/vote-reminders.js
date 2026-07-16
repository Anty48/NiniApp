/**
 * Recordatorios de votación: avisa a los miembros que AÚN NO HAN VOTADO un
 * evento cuando queda menos de 1 hora para que se cierre su votación.
 *
 * No lo dispara ningún usuario: lo invoca un cron externo (GitHub Actions,
 * .github/workflows/vote-reminders.yml, cada 15 min) con
 *   Authorization: Bearer <CRON_SECRET>
 * (el plan Hobby de Vercel solo permite crons diarios, insuficiente aquí).
 *
 * Idempotente: marca event.voteReminderSentAt dentro de una transacción, así
 * dos ejecuciones simultáneas no duplican avisos. El idioma de cada aviso es
 * el del destinatario (users/{uid}.language, que la app sincroniza al abrir).
 */

const { env, init, clampPayload, deliverToUser, getFirestore } = require('./_lib/pushCore');

/** Se avisa cuando falta menos de esto para el cierre (65 min: colchón sobre 1 h). */
const WINDOW_MS = 65 * 60 * 1000;

const TEXTS = {
  es: {
    title: '⏳ Votación a punto de cerrarse',
    body: (t) => `Aún no has votado "${t}". La votación se cierra en menos de 1 hora.`,
  },
  en: {
    title: '⏳ Voting closes soon',
    body: (t) => `You haven't voted on "${t}" yet. Voting closes in less than an hour.`,
  },
  ca: {
    title: '⏳ La votació es tanca aviat',
    body: (t) => `Encara no has votat "${t}". La votació es tanca en menys d'1 hora.`,
  },
};

function lockTimeMs(event) {
  return new Date(event.startsAt).getTime() - (event.voteLockHoursBefore || 0) * 3600 * 1000;
}

module.exports = async (req, res) => {
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!env('CRON_SECRET') || auth !== env('CRON_SECRET')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!env('FIREBASE_SERVICE_ACCOUNT')) {
    return res.status(500).json({ error: 'push-not-configured' });
  }
  init();

  const db = getFirestore();
  const now = Date.now();
  const groups = await db.collection('groups').get();

  let reminded = 0;
  let delivered = 0;

  for (const groupDoc of groups.docs) {
    const data = groupDoc.data();
    const pending = (data.events || []).filter((e) => {
      const lock = lockTimeMs(e);
      return lock > now && lock - now <= WINDOW_MS && !e.voteReminderSentAt;
    });
    if (!pending.length) continue;

    // Transacción: reclama los eventos re-comprobando la marca sobre el doc
    // fresco; devuelve los que este proceso debe notificar.
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(groupDoc.ref);
      if (!snap.exists) return [];
      const fresh = snap.data();
      const ids = new Set(
        (fresh.events || [])
          .filter((e) => pending.some((p) => p.id === e.id) && !e.voteReminderSentAt)
          .map((e) => e.id),
      );
      if (!ids.size) return [];
      const events = (fresh.events || []).map((e) =>
        ids.has(e.id) ? { ...e, voteReminderSentAt: new Date(now).toISOString() } : e,
      );
      tx.update(groupDoc.ref, { events });
      return (fresh.events || []).filter((e) => ids.has(e.id));
    });

    for (const event of claimed) {
      const voted = new Set(
        (data.votes || []).filter((v) => v.eventId === event.id).map((v) => v.userId),
      );
      const targets = (data.members || []).map((m) => m.userId).filter((id) => !voted.has(id));
      reminded++;
      for (const uid of targets) {
        const userSnap = await db.doc(`users/${uid}`).get();
        const lang = (userSnap.exists && TEXTS[userSnap.data().language] && userSnap.data().language) || 'es';
        const payload = clampPayload({
          title: TEXTS[lang].title,
          body: TEXTS[lang].body(event.title),
          url: `/event/${event.id}`,
        });
        delivered += await deliverToUser(db, uid, payload);
      }
    }
  }

  return res.status(200).json({ groups: groups.size, eventsReminded: reminded, delivered });
};
