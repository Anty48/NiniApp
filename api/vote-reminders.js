/**
 * Recordatorios programados (cron cada 15 min):
 *  1) Votación: avisa a los miembros que AÚN NO HAN VOTADO un evento cuando
 *     queda menos de 1 hora para que se cierre su votación.
 *  2) Días especiales: cuando llega el día de un evento de tipo "specialDay",
 *     avisa a todo el grupo ("Hoy es ...").
 *  3) Cumpleaños: si un miembro muestra su cumpleaños y es hoy, avisa a todo
 *     el grupo ("Hoy es el cumpleaños de ...").
 * Los avisos de día (2 y 3) se envían a partir de las 08:00 hora española,
 * para no notificar de madrugada.
 *
 * No lo dispara ningún usuario: lo invoca un cron externo (GitHub Actions,
 * .github/workflows/vote-reminders.yml, cada 15 min) con
 *   Authorization: Bearer <CRON_SECRET>
 * (el plan Hobby de Vercel solo permite crons diarios, insuficiente aquí).
 *
 * Idempotente: marca event.voteReminderSentAt / event.specialDayNotifiedAt /
 * member.birthdayNotifiedOn dentro de una transacción, así dos ejecuciones
 * simultáneas no duplican avisos. El idioma de cada aviso es el del
 * destinatario (users/{uid}.language, que la app sincroniza al abrir).
 */

const { env, init, clampPayload, deliverToUser, getFirestore } = require('./_lib/pushCore');

/** Se avisa cuando falta menos de esto para el cierre (65 min: colchón sobre 1 h). */
const WINDOW_MS = 65 * 60 * 1000;
/** Hora española a partir de la cual se envían los avisos de día. */
const DAY_NOTICE_FROM_HOUR = 8;
/** Zona horaria del grupo (la app es de un grupo español). */
const TZ = 'Europe/Madrid';

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

const TEXTS_SPECIAL_DAY = {
  es: { title: '🎉 Día especial', body: (t) => `¡Hoy es "${t}"!` },
  en: { title: '🎉 Special day', body: (t) => `Today is "${t}"!` },
  ca: { title: '🎉 Dia especial', body: (t) => `Avui és "${t}"!` },
};

const TEXTS_BIRTHDAY = {
  es: { title: '🎂 ¡Cumpleaños!', body: (n) => `¡Hoy es el cumpleaños de ${n}!` },
  en: { title: '🎂 Birthday!', body: (n) => `Today is ${n}'s birthday!` },
  ca: { title: '🎂 Aniversari!', body: (n) => `Avui és l'aniversari de ${n}!` },
};

function lockTimeMs(event) {
  return new Date(event.startsAt).getTime() - (event.voteLockHoursBefore || 0) * 3600 * 1000;
}

/** Día (YYYY-MM-DD), día/mes (DD/MM) y hora de una fecha en hora española. */
function madridParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    ddmm: `${parts.day}/${parts.month}`,
    hour: parseInt(parts.hour, 10),
  };
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
  const today = madridParts();
  const dayNoticesActive = today.hour >= DAY_NOTICE_FROM_HOUR;
  const groups = await db.collection('groups').get();

  let reminded = 0;
  let dayNotices = 0;
  let delivered = 0;

  for (const groupDoc of groups.docs) {
    const data = groupDoc.data();

    // ---------- 1) Recordatorios de votación ----------
    const pending = (data.events || []).filter((e) => {
      // Las quedadas informales y los días especiales no tienen votación.
      if (e.kind && e.kind !== 'standard') return false;
      const lock = lockTimeMs(e);
      return lock > now && lock - now <= WINDOW_MS && !e.voteReminderSentAt;
    });
    if (pending.length) {
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
          delivered += await deliverToUser(db, uid, (u) => {
            const T = TEXTS[u.language] || TEXTS.es;
            return clampPayload({
              title: T.title,
              body: T.body(event.title),
              url: `/event/${event.id}`,
            });
          });
        }
      }
    }

    // ---------- 2 y 3) Avisos de día: días especiales y cumpleaños ----------
    if (!dayNoticesActive) continue;
    const dueSpecial = (data.events || []).filter(
      (e) =>
        e.kind === 'specialDay' &&
        !e.specialDayNotifiedAt &&
        madridParts(new Date(e.startsAt)).dayKey === today.dayKey,
    );
    const dueBirthdays = (data.members || []).filter(
      (m) => m.showBirthday && m.birthday === today.ddmm && m.birthdayNotifiedOn !== today.dayKey,
    );
    if (!dueSpecial.length && !dueBirthdays.length) continue;

    // Transacción: marca eventos y miembros sobre el doc fresco y devuelve
    // los que este proceso debe anunciar.
    const claimedDay = await db.runTransaction(async (tx) => {
      const snap = await tx.get(groupDoc.ref);
      if (!snap.exists) return { events: [], birthdays: [] };
      const fresh = snap.data();
      const eventIds = new Set(
        (fresh.events || [])
          .filter((e) => dueSpecial.some((d) => d.id === e.id) && !e.specialDayNotifiedAt)
          .map((e) => e.id),
      );
      const memberIds = new Set(
        (fresh.members || [])
          .filter(
            (m) =>
              dueBirthdays.some((d) => d.userId === m.userId) &&
              m.birthdayNotifiedOn !== today.dayKey,
          )
          .map((m) => m.userId),
      );
      if (!eventIds.size && !memberIds.size) return { events: [], birthdays: [] };
      const events = (fresh.events || []).map((e) =>
        eventIds.has(e.id) ? { ...e, specialDayNotifiedAt: new Date(now).toISOString() } : e,
      );
      const members = (fresh.members || []).map((m) =>
        memberIds.has(m.userId) ? { ...m, birthdayNotifiedOn: today.dayKey } : m,
      );
      tx.update(groupDoc.ref, { events, members });
      return {
        events: (fresh.events || []).filter((e) => eventIds.has(e.id)),
        birthdays: (fresh.members || []).filter((m) => memberIds.has(m.userId)),
      };
    });

    const everyone = (data.members || []).map((m) => m.userId);
    for (const event of claimedDay.events) {
      dayNotices++;
      for (const uid of everyone) {
        delivered += await deliverToUser(db, uid, (u) => {
          const T = TEXTS_SPECIAL_DAY[u.language] || TEXTS_SPECIAL_DAY.es;
          return clampPayload({
            title: T.title,
            body: T.body(event.title),
            url: `/event/${event.id}`,
          });
        });
      }
    }
    for (const member of claimedDay.birthdays) {
      dayNotices++;
      const name = member.nickname || member.name || '';
      for (const uid of everyone) {
        delivered += await deliverToUser(db, uid, (u) => {
          const T = TEXTS_BIRTHDAY[u.language] || TEXTS_BIRTHDAY.es;
          return clampPayload({
            title: T.title,
            body: T.body(name),
            url: `/member/${member.userId}`,
          });
        });
      }
    }
  }

  return res
    .status(200)
    .json({ groups: groups.size, eventsReminded: reminded, dayNotices, delivered });
};
