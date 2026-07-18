import { getFirebase } from '@/services/firebase';
import {
  CounterContribution,
  EventVote,
  EventVoteValue,
  Group,
  GroupCounter,
  GroupData,
  GroupEvent,
  GroupMember,
  GroupRole,
  Phrase,
  User,
  UserId,
} from '@/types/models';
import { dayKey, daysBetweenKeys, DAY_MS } from '@/utils/date';

/**
 * Estado del grupo: un documento Firestore por grupo (groups/{id}) con toda
 * la lógica de dominio (scores, rachas, votos, coches...) en el cliente.
 *
 * TODO(backend): mover las funciones puras de mutación de este archivo a
 * Cloud Functions o reglas de seguridad; la forma de los datos ya es la
 * definitiva.
 */

// ---------- Constantes del algoritmo ----------

export const SCORE_START = 100;
/** Cambiar el voto dentro del periodo de cierre. */
export const PENALTY_LATE_VOTE_CHANGE = 5;
/** Decir SÍ y no presentarse (validado por el creador del evento). */
export const PENALTY_NO_SHOW = 15;
/** Recuperación pasiva y muy lenta: +0,5 puntos por día sin penalizaciones. */
export const RECOVERY_PER_DAY = 0.5;
/** Los eventos pasados se conservan un mes antes de borrarse. */
export const EVENT_RETENTION_DAYS = 30;
/** Las fotos de prueba del contador caducan a las 24 h. */
export const PROOF_TTL_MS = 24 * 3600 * 1000;
export const GROUP_MILESTONES = [7, 30, 67, 365];
export const PERSONAL_MILESTONES = [5, 10];
/** A partir del 4º clic del día la foto de prueba es obligatoria. */
export const CLICKS_BEFORE_PROOF_REQUIRED = 3;
/**
 * "Tocar": cooldown por destinatario que depende del compromiso de quien
 * toca. Mínimo 12 h con 100% de compromiso; con menos compromiso tarda más,
 * hasta 24 h con 0%.
 */
export const POKE_MIN_COOLDOWN_MS = 12 * 3600 * 1000;
export const POKE_MAX_COOLDOWN_MS = 24 * 3600 * 1000;
export function pokeCooldownMs(commitmentScore: number): number {
  const score = Math.max(0, Math.min(100, commitmentScore));
  return POKE_MIN_COOLDOWN_MS + ((100 - score) / 100) * (POKE_MAX_COOLDOWN_MS - POKE_MIN_COOLDOWN_MS);
}
/** Los estados de miembros caducan a las 24 h. */
export const STATUS_TTL_MS = 24 * 3600 * 1000;
/** Las encuestas se borran solas a las 24 h de crearse. */
export const POLL_TTL_MS = 24 * 3600 * 1000;
/** Copipuntos con los que arranca todo miembro al crear/unirse a un grupo. */
export const COPIPOINTS_START = 100;

export function makeMember(user: User, role: GroupRole): GroupMember {
  return {
    userId: user.id,
    name: user.username,
    nickname: user.nickname,
    description: user.description,
    photoUrl: user.photoUrl,
    allowPokes: user.allowPokes ?? true,
    birthday: user.birthday,
    showBirthday: user.showBirthday,
    role,
    commitmentScore: SCORE_START,
    lastRecoveryAt: new Date().toISOString(),
    counterContributions: 0,
    personalStreakDays: 0,
    copipoints: COPIPOINTS_START,
  };
}

// ---------- Carga / guardado ----------

/**
 * Mutación atómica del grupo: `runTransaction` relee el documento fresco,
 * le aplica la función pura y escribe el resultado. Así dos miembros que
 * actúan a la vez no se pisan (antes cada cliente hacía `setDoc` del estado
 * local entero = last-writer-wins).
 *
 * `fn` recibe el estado fresco (o null si el doc no existe) y puede
 * ejecutarse varias veces si la transacción reintenta: debe ser pura.
 * Si devuelve null no se escribe nada (p. ej. cooldown de un toque).
 * Devuelve el estado confirmado en el servidor, o null si no se escribió.
 */
export async function mutateGroupData(
  groupId: string,
  fn: (current: GroupData | null) => GroupData | null,
): Promise<GroupData | null> {
  const { db } = getFirebase();
  const { doc, runTransaction } = require('@firebase/firestore');
  const ref = doc(db, 'groups', groupId);
  return runTransaction(db, async (tx: any) => {
    const snap = await tx.get(ref);
    const next = fn(snap.exists() ? (snap.data() as GroupData) : null);
    if (next) tx.set(ref, next);
    return next;
  });
}

export async function loadGroupData(group: Group, me: User): Promise<GroupData> {
  const data = await mutateGroupData(group.id, (current) => {
    let d: GroupData = current ?? {
      group,
      members: [],
      events: [],
      votes: [],
      counter: null,
      contributions: [],
      pokes: [],
    };
    // Si el usuario acaba de unirse y aún no figura como miembro, se añade.
    if (!d.members.some((m) => m.userId === me.id)) {
      const role = d.group.memberRoles[me.id] ?? (current ? 'member' : 'admin');
      d = { ...d, members: [...d.members, makeMember(me, role)] };
    }
    return runMaintenance(d);
  });
  return data!;
}

/**
 * Suscripción en tiempo real al grupo: cualquier cambio hecho por otro
 * miembro llega al instante (Firestore onSnapshot).
 */
export function subscribeGroupData(
  groupId: string,
  onChange: (data: GroupData) => void,
): () => void {
  const { db } = getFirebase();
  const { doc, onSnapshot } = require('@firebase/firestore');
  return onSnapshot(
    doc(db, 'groups', groupId),
    (snap: any) => {
      if (snap.exists()) onChange(snap.data() as GroupData);
    },
    (e: unknown) => console.warn(`Suscripción al grupo ${groupId} interrumpida`, e),
  );
}

// ---------- Mantenimiento periódico (se ejecuta al cargar) ----------

export function runMaintenance(data: GroupData, now: Date = new Date()): GroupData {
  const nowMs = now.getTime();
  const today = dayKey(now);

  // 1) Histórico: los eventos terminados hace más de un mes se borran.
  const events = data.events.filter(
    (e) => new Date(e.endsAt).getTime() > nowMs - EVENT_RETENTION_DAYS * DAY_MS,
  );
  const eventIds = new Set(events.map((e) => e.id));
  const votes = data.votes.filter((v) => eventIds.has(v.eventId));

  // 2) Fotos de prueba caducadas (24 h): se elimina la foto, no el aporte.
  const contributions = data.contributions.map((c) =>
    c.proofPhotoUrl && nowMs - new Date(c.at).getTime() > PROOF_TTL_MS
      ? { ...c, proofPhotoUrl: undefined }
      : c,
  );

  // 2b) Toques caducados: solo sirven para el cooldown (24 h como máximo).
  const pokes = (data.pokes ?? []).filter(
    (p) => nowMs - new Date(p.at).getTime() < POKE_MAX_COOLDOWN_MS,
  );

  // 2c) Estados de miembros y encuestas: caducan a las 24 h.
  const statuses = (data.statuses ?? []).filter(
    (s) => nowMs - new Date(s.at).getTime() < STATUS_TTL_MS,
  );
  const polls = (data.polls ?? []).filter(
    (p) => nowMs - new Date(p.createdAt).getTime() < POLL_TTL_MS,
  );

  // 3) Racha del grupo: si pasó un día entero sin que nadie sumara, se
  //    reinicia a 0 (el acumulado total NO se pierde).
  let counter = data.counter;
  if (
    counter &&
    counter.streakDays > 0 &&
    counter.lastContributionDate &&
    daysBetweenKeys(counter.lastContributionDate, today) > 1
  ) {
    counter = { ...counter, streakDays: 0 };
  }

  // 4) Rachas personales y recuperación pasiva del compromiso.
  const members = data.members.map((m) => {
    const member = { ...m };
    // Backfill: los miembros anteriores al sistema de copipuntos arrancan
    // con el saldo inicial.
    if (typeof member.copipoints !== 'number') member.copipoints = COPIPOINTS_START;
    if (
      member.personalStreakDays > 0 &&
      member.lastContributionDate &&
      daysBetweenKeys(member.lastContributionDate, today) > 1
    ) {
      member.personalStreakDays = 0;
    }
    const lastRecovery = new Date(member.lastRecoveryAt).getTime();
    const days = Math.floor((nowMs - lastRecovery) / DAY_MS);
    if (days > 0) {
      member.commitmentScore = Math.min(
        SCORE_START,
        member.commitmentScore + days * RECOVERY_PER_DAY,
      );
      member.lastRecoveryAt = new Date(lastRecovery + days * DAY_MS).toISOString();
    }
    return member;
  });

  return { ...data, events, votes, contributions, pokes, statuses, polls, counter, members };
}

// ---------- "Tocar" ----------

/** Timestamp (ms) del último toque de `from` a `to`, o null. */
export function lastPokeAt(data: GroupData, from: UserId, to: UserId): number | null {
  const times = (data.pokes ?? [])
    .filter((p) => p.fromUserId === from && p.toUserId === to)
    .map((p) => new Date(p.at).getTime());
  return times.length ? Math.max(...times) : null;
}

export function addPoke(
  data: GroupData,
  from: UserId,
  to: UserId,
  now: Date = new Date(),
): GroupData {
  return {
    ...data,
    pokes: [...(data.pokes ?? []), { fromUserId: from, toUserId: to, at: now.toISOString() }],
  };
}

// ---------- Eventos y votación ----------

export function voteLockTime(event: GroupEvent): Date {
  return new Date(new Date(event.startsAt).getTime() - event.voteLockHoursBefore * 3600 * 1000);
}

export function isVoteLocked(event: GroupEvent, now: Date = new Date()): boolean {
  return now >= voteLockTime(event);
}

export function hasStarted(event: GroupEvent, now: Date = new Date()): boolean {
  return now >= new Date(event.startsAt);
}

export function hasEnded(event: GroupEvent, now: Date = new Date()): boolean {
  return now >= new Date(event.endsAt);
}

function applyPenalty(members: GroupMember[], userId: UserId, amount: number): GroupMember[] {
  const nowIso = new Date().toISOString();
  return members.map((m) =>
    m.userId === userId
      ? {
          ...m,
          commitmentScore: Math.max(0, m.commitmentScore - amount),
          lastRecoveryAt: nowIso, // la recuperación pasiva empieza de cero
        }
      : m,
  );
}

export function castVote(
  data: GroupData,
  eventId: string,
  userId: UserId,
  value: EventVoteValue,
  now: Date = new Date(),
): { data: GroupData; penalized: boolean } {
  const event = data.events.find((e) => e.id === eventId);
  if (!event || hasStarted(event, now)) return { data, penalized: false };

  const existing = data.votes.find((v) => v.eventId === eventId && v.userId === userId);
  if (existing?.value === value) return { data, penalized: false };

  // Solo penaliza CAMBIAR el voto dentro del periodo de cierre, no el primero.
  const penalized = isVoteLocked(event, now) && !!existing;

  const vote: EventVote = {
    eventId,
    userId,
    value,
    updatedAt: now.toISOString(),
    changedDuringLockPeriod: penalized || (existing?.changedDuringLockPeriod ?? false),
    attendanceConfirmed: existing?.attendanceConfirmed,
  };
  const votes = existing
    ? data.votes.map((v) => (v === existing ? vote : v))
    : [...data.votes, vote];

  // Si deja de ser SÍ, libera su plaza de coche.
  let events = data.events;
  if (value !== 'yes') {
    events = data.events.map((e) =>
      e.id === eventId && e.cars
        ? {
            ...e,
            cars: e.cars.map((c) => ({
              ...c,
              occupants: c.occupants.filter((u) => u !== userId),
            })),
          }
        : e,
    );
  }

  const members = penalized
    ? applyPenalty(data.members, userId, PENALTY_LATE_VOTE_CHANGE)
    : data.members;

  return { data: { ...data, votes, events, members }, penalized };
}

/** Validación del creador tras el evento: marca si un "SÍ" vino de verdad. */
export function setAttendance(
  data: GroupData,
  eventId: string,
  userId: UserId,
  attended: boolean,
): GroupData {
  const vote = data.votes.find((v) => v.eventId === eventId && v.userId === userId);
  if (!vote || vote.attendanceConfirmed === attended) return data;

  const votes = data.votes.map((v) =>
    v === vote ? { ...v, attendanceConfirmed: attended } : v,
  );

  let members = data.members;
  if (!attended) {
    members = applyPenalty(members, userId, PENALTY_NO_SHOW);
  } else if (vote.attendanceConfirmed === false) {
    // Se deshace una marca de "no vino" anterior.
    members = members.map((m) =>
      m.userId === userId
        ? { ...m, commitmentScore: Math.min(SCORE_START, m.commitmentScore + PENALTY_NO_SHOW) }
        : m,
    );
  }
  return { ...data, votes, members };
}

/** Ocupa o libera una plaza. Un usuario solo puede ocupar una plaza por evento. */
export function toggleCarSeat(
  data: GroupData,
  eventId: string,
  carId: string,
  userId: UserId,
): GroupData {
  const events = data.events.map((e) => {
    if (e.id !== eventId || !e.cars) return e;
    const target = e.cars.find((c) => c.id === carId);
    if (!target) return e;
    const alreadyInTarget = target.occupants.includes(userId);
    return {
      ...e,
      cars: e.cars.map((c) => {
        const without = c.occupants.filter((u) => u !== userId);
        if (c.id !== carId || alreadyInTarget) return { ...c, occupants: without };
        if (without.length >= c.seats) return { ...c, occupants: without };
        return { ...c, occupants: [...without, userId] };
      }),
    };
  });
  return { ...data, events };
}

// ---------- Contador de rachas ----------

export function contributionsToday(data: GroupData, userId: UserId, now: Date = new Date()): number {
  const today = dayKey(now);
  return data.contributions.filter((c) => c.userId === userId && dayKey(c.at) === today).length;
}

export function contribute(
  data: GroupData,
  userId: UserId,
  proofPhotoUrl: string | undefined,
  now: Date = new Date(),
): { data: GroupData; groupMilestone: number | null; personalMilestone: number | null } {
  const counter = data.counter;
  if (!counter) return { data, groupMilestone: null, personalMilestone: null };
  const today = dayKey(now);

  let groupMilestone: number | null = null;
  let newCounter: GroupCounter = { ...counter, totalValue: counter.totalValue + 1 };
  if (counter.lastContributionDate !== today) {
    const continues =
      counter.lastContributionDate && daysBetweenKeys(counter.lastContributionDate, today) === 1;
    const streak = continues ? counter.streakDays + 1 : 1;
    newCounter = { ...newCounter, streakDays: streak, lastContributionDate: today };
    if (GROUP_MILESTONES.includes(streak)) groupMilestone = streak;
  }

  let personalMilestone: number | null = null;
  const members = data.members.map((m) => {
    if (m.userId !== userId) return m;
    let streak = m.personalStreakDays;
    if (m.lastContributionDate !== today) {
      const continues =
        m.lastContributionDate && daysBetweenKeys(m.lastContributionDate, today) === 1;
      streak = continues ? streak + 1 : 1;
      if (PERSONAL_MILESTONES.includes(streak)) personalMilestone = streak;
    }
    return {
      ...m,
      counterContributions: m.counterContributions + 1,
      personalStreakDays: streak,
      lastContributionDate: today,
    };
  });

  const record: CounterContribution = {
    id: `c-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    groupId: data.group.id,
    userId,
    at: now.toISOString(),
    proofPhotoUrl,
  };

  return {
    data: { ...data, counter: newCounter, members, contributions: [record, ...data.contributions] },
    groupMilestone,
    personalMilestone,
  };
}

// ---------- Frasario ----------

/** Nombre visible del autor de una frase (miembro del grupo o externo). */
export function phraseAuthorName(phrase: Phrase, members: GroupMember[]): string {
  if (phrase.memberId) {
    const m = members.find((x) => x.userId === phrase.memberId);
    if (m) return m.nickname ?? m.name;
  }
  return phrase.externalName ?? '—';
}

/** Frases agrupadas por autor, autores en orden alfabético. */
export function phrasesByAuthor(
  phrases: Phrase[],
  members: GroupMember[],
): { author: string; memberId?: UserId; phrases: Phrase[] }[] {
  const groups = new Map<string, { author: string; memberId?: UserId; phrases: Phrase[] }>();
  for (const phrase of phrases) {
    const author = phraseAuthorName(phrase, members);
    const key = phrase.memberId ?? `ext:${author.toLocaleLowerCase()}`;
    const entry = groups.get(key) ?? { author, memberId: phrase.memberId, phrases: [] };
    entry.phrases.push(phrase);
    groups.set(key, entry);
  }
  return [...groups.values()].sort((a, b) =>
    a.author.localeCompare(b.author, undefined, { sensitivity: 'base' }),
  );
}

// ---------- Cumpleaños ----------

export const BIRTHDAY_EVENT_PREFIX = 'bday-';
/** Dorado festivo, translúcido como el resto de colores de evento. */
export const BIRTHDAY_COLOR = 'hsla(45, 90%, 55%, 0.28)';

/** Valida y normaliza un cumpleaños escrito como DD/MM; null si no es válido. */
export function normalizeBirthday(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})[/\-.](\d{1,2})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/**
 * Eventos sintéticos de cumpleaños (uno por miembro con el interruptor
 * activado y por año pedido). No se guardan: se generan al pintar el
 * calendario.
 */
export function birthdayEvents(
  data: GroupData,
  years: number[],
  makeTitle: (name: string) => string,
): GroupEvent[] {
  const list: GroupEvent[] = [];
  for (const member of data.members) {
    if (!member.showBirthday || !member.birthday) continue;
    const [dayStr, monthStr] = member.birthday.split('/');
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    if (!day || !month) continue;
    for (const year of years) {
      const start = new Date(year, month - 1, day, 0, 0, 0);
      if (start.getMonth() !== month - 1) continue; // 29/02 en año no bisiesto
      list.push({
        id: `${BIRTHDAY_EVENT_PREFIX}${member.userId}-${year}`,
        groupId: data.group.id,
        createdBy: member.userId,
        isSpecial: false,
        kind: 'specialDay',
        title: makeTitle(member.nickname ?? member.name),
        startsAt: start.toISOString(),
        endsAt: new Date(year, month - 1, day, 23, 59, 0).toISOString(),
        allDay: true,
        color: BIRTHDAY_COLOR,
        voteLockHoursBefore: 0,
      });
    }
  }
  return list;
}

/**
 * Borra una contribución equivocada: se resta del total acumulado y de los
 * aportes de su autor. Las rachas (de grupo y personal) no se tocan, igual
 * que cuando el admin corrige el valor del contador a mano.
 */
export function removeContribution(data: GroupData, contributionId: string): GroupData {
  const record = data.contributions.find((c) => c.id === contributionId);
  if (!record) return data;
  const counter = data.counter
    ? { ...data.counter, totalValue: data.counter.totalValue - 1 }
    : data.counter;
  const members = data.members.map((m) =>
    m.userId === record.userId
      ? { ...m, counterContributions: Math.max(0, m.counterContributions - 1) }
      : m,
  );
  return {
    ...data,
    counter,
    members,
    contributions: data.contributions.filter((c) => c.id !== contributionId),
  };
}

// ---------- Coches de conductores ----------

/** Miembros conductores que ya tienen un coche configurado, activables en eventos. */
export function driversWithCar(data: GroupData): GroupMember[] {
  return data.members.filter((m) => m.isDriver && m.carDetails);
}

// ---------- Ranking ----------

export function sortByCommitment(members: GroupMember[]): GroupMember[] {
  return [...members].sort((a, b) => b.commitmentScore - a.commitmentScore);
}

export function sortByContributions(members: GroupMember[]): GroupMember[] {
  return [...members].sort((a, b) => b.counterContributions - a.counterContributions);
}

export function sortByCopipoints(members: GroupMember[]): GroupMember[] {
  return [...members].sort(
    (a, b) => (b.copipoints ?? COPIPOINTS_START) - (a.copipoints ?? COPIPOINTS_START),
  );
}

// ---------- Salida del grupo ----------

/**
 * Elimina al miembro y todos sus datos del grupo (votos, aportes, plazas).
 * Si era admin, el rol pasa al sucesor indicado (por defecto, el nº 1 del
 * ranking de compromiso — lo decide la pantalla que llama).
 */
export function removeMember(data: GroupData, userId: UserId, successorId?: UserId): GroupData {
  const leaving = data.members.find((m) => m.userId === userId);
  let members = data.members.filter((m) => m.userId !== userId);
  if (leaving?.role === 'admin' && successorId) {
    members = members.map((m) => (m.userId === successorId ? { ...m, role: 'admin' } : m));
  }
  const votes = data.votes.filter((v) => v.userId !== userId);
  const contributions = data.contributions.filter((c) => c.userId !== userId);
  const events = data.events.map((e) =>
    e.cars
      ? { ...e, cars: e.cars.map((c) => ({ ...c, occupants: c.occupants.filter((u) => u !== userId) })) }
      : e,
  );
  const memberRoles = { ...data.group.memberRoles };
  delete memberRoles[userId];
  if (leaving?.role === 'admin' && successorId) memberRoles[successorId] = 'admin';

  // Su estado desaparece y sus votos de encuesta se retiran. Sus frases del
  // Frasario se conservan (son patrimonio del grupo) pasando a autor externo
  // con el nombre que tenía al salir.
  const statuses = (data.statuses ?? []).filter((s) => s.userId !== userId);
  const polls = (data.polls ?? []).map((p) => {
    if (!(userId in p.votes)) return p;
    const pollVotes = { ...p.votes };
    delete pollVotes[userId];
    return { ...p, votes: pollVotes };
  });
  const leavingName = leaving ? (leaving.nickname ?? leaving.name) : '—';
  const phrases = (data.phrases ?? []).map((p) =>
    p.memberId === userId ? { ...p, memberId: undefined, externalName: leavingName } : p,
  );

  return {
    ...data,
    group: { ...data.group, memberRoles },
    members,
    votes,
    contributions,
    events,
    statuses,
    polls,
    phrases,
  };
}
