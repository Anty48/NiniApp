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
/** "Tocar": una vez cada 24 h por destinatario. */
export const POKE_COOLDOWN_MS = 24 * 3600 * 1000;

export function makeMember(user: User, role: GroupRole): GroupMember {
  return {
    userId: user.id,
    name: user.username,
    nickname: user.nickname,
    description: user.description,
    photoUrl: user.photoUrl,
    allowPokes: user.allowPokes ?? true,
    role,
    commitmentScore: SCORE_START,
    lastRecoveryAt: new Date().toISOString(),
    counterContributions: 0,
    personalStreakDays: 0,
  };
}

// ---------- Carga / guardado ----------

export async function loadGroupData(group: Group, me: User): Promise<GroupData> {
  const { db } = getFirebase();
  const { doc, getDoc } = require('@firebase/firestore');
  const snap = await getDoc(doc(db, 'groups', group.id));
  let data: GroupData | null = snap.exists() ? (snap.data() as GroupData) : null;

  if (data) {
    // Si el usuario acaba de unirse y aún no figura como miembro, se añade.
    if (!data.members.some((m) => m.userId === me.id)) {
      data = {
        ...data,
        members: [...data.members, makeMember(me, group.memberRoles[me.id] ?? 'member')],
      };
    }
  } else {
    data = {
      group,
      members: [makeMember(me, group.memberRoles[me.id] ?? 'admin')],
      events: [],
      votes: [],
      counter: null,
      contributions: [],
      pokes: [],
    };
  }
  data = runMaintenance(data);
  await saveGroupData(data);
  return data;
}

export async function saveGroupData(data: GroupData): Promise<void> {
  const { db } = getFirebase();
  const { doc, setDoc } = require('@firebase/firestore');
  await setDoc(doc(db, 'groups', data.group.id), data);
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

  // 2b) Toques caducados: solo sirven para el cooldown de 24 h.
  const pokes = (data.pokes ?? []).filter(
    (p) => nowMs - new Date(p.at).getTime() < POKE_COOLDOWN_MS,
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

  return { ...data, events, votes, contributions, pokes, counter, members };
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

// ---------- Ranking ----------

export function sortByCommitment(members: GroupMember[]): GroupMember[] {
  return [...members].sort((a, b) => b.commitmentScore - a.commitmentScore);
}

export function sortByContributions(members: GroupMember[]): GroupMember[] {
  return [...members].sort((a, b) => b.counterContributions - a.counterContributions);
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

  return { ...data, group: { ...data.group, memberRoles }, members, votes, contributions, events };
}
