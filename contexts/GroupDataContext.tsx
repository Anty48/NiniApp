import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ProfileFields, useAuth } from '@/contexts/AuthContext';
import { i18n, SUPPORTED_LANGUAGES } from '@/i18n';
import * as gd from '@/services/groupData';
import { notifyLocal } from '@/services/notifications';
import { PushPayload, sendPushToUsers } from '@/services/push';
import {
  CarDetails,
  EventVoteValue,
  Group,
  GroupCounter,
  GroupData,
  GroupEvent,
  GroupMember,
  GroupRole,
  Phrase,
  Poll,
  SavedColor,
  Song,
  UserId,
} from '@/types/models';

interface GroupDataContextValue {
  data: GroupData | null;
  isLoading: boolean;
  /** Mi entrada como miembro del grupo activo. */
  me: GroupMember | null;
  isAdmin: boolean;
  createEvent: (event: GroupEvent) => Promise<void>;
  updateEvent: (event: GroupEvent) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  vote: (eventId: string, value: EventVoteValue) => Promise<void>;
  setAttendance: (eventId: string, userId: UserId, attended: boolean) => Promise<void>;
  toggleCarSeat: (eventId: string, carId: string) => Promise<void>;
  saveCounter: (counter: GroupCounter) => Promise<void>;
  contribute: (proofPhotoUrl?: string) => Promise<void>;
  /** Borra una contribución equivocada (resta total y aportes; la racha no se toca). */
  removeContribution: (contributionId: string) => Promise<void>;
  updateGroupSettings: (
    fields: Partial<Pick<Group, 'name' | 'accessPassword' | 'photoUrl'>>,
  ) => Promise<void>;
  setMemberRole: (userId: UserId, role: GroupRole) => Promise<void>;
  /** Sale del grupo borrando los datos propios; si era admin, traspasa el rol. */
  leaveGroup: (successorId?: UserId) => Promise<void>;
  updateMyProfile: (fields: ProfileFields) => Promise<void>;
  /** "Tocar" a otro miembro (cooldown de 12-24 h según tu compromiso). */
  pokeMember: (toUserId: UserId) => Promise<'ok' | 'cooldown' | 'disabled'>;
  /** Suma/resta copipuntos a un miembro (solo conductores, edición directa). */
  adjustCopipoints: (userId: UserId, delta: number) => Promise<void>;
  /** Asigna o retira el rol de conductor (solo admin). */
  setDriver: (userId: UserId, isDriver: boolean) => Promise<void>;
  /** Asigna o retira el rol de músico (solo admin). */
  setMusician: (userId: UserId, isMusician: boolean) => Promise<void>;
  /** El conductor edita o quita los datos de su propio coche. */
  updateMyCar: (carDetails: CarDetails | undefined) => Promise<void>;
  /** El admin asigna, edita o quita el coche de cualquier conductor. */
  setMemberCar: (userId: UserId, carDetails: CarDetails | undefined) => Promise<void>;
  /** Frasario: cualquier miembro añade, edita o borra frases. */
  addPhrase: (phrase: Phrase) => Promise<void>;
  updatePhrase: (phraseId: string, text: string) => Promise<void>;
  deletePhrase: (phraseId: string) => Promise<void>;
  /** Canciones: crear/editar (upsert) y borrar; solo músicos y admins. */
  saveSong: (song: Song) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  /** Encuestas: cualquiera crea (notifica por push) y vota. */
  createPoll: (poll: Poll) => Promise<void>;
  votePoll: (pollId: string, optionIndexes: number[]) => Promise<void>;
  /** Mi estado efímero (texto y/o foto, caduca a las 24 h). */
  setMyStatus: (fields: { text?: string; photoUrl?: string }) => Promise<void>;
  clearMyStatus: () => Promise<void>;
  /** Colores guardados del grupo, editables por cualquier miembro. */
  addSavedColor: (color: SavedColor) => Promise<void>;
  removeSavedColor: (colorId: string) => Promise<void>;
}

const GroupDataContext = createContext<GroupDataContextValue | null>(null);

/**
 * Payload de push con el texto en los tres idiomas: el servidor entrega a
 * cada destinatario la variante de SU idioma. (Antes las notificaciones
 * llegaban en el idioma de quien disparaba la acción, no del que las recibía.)
 */
function localizedPush(
  titleKey: string,
  bodyKey: string,
  params: Record<string, unknown> = {},
): Omit<PushPayload, 'url'> {
  return {
    title: i18n.t(titleKey, params),
    body: i18n.t(bodyKey, params),
    i18n: Object.fromEntries(
      SUPPORTED_LANGUAGES.map((locale) => [
        locale,
        {
          title: i18n.t(titleKey, { ...params, locale }),
          body: i18n.t(bodyKey, { ...params, locale }),
        },
      ]),
    ),
  };
}

export function GroupDataProvider({ children }: { children: ReactNode }) {
  const { user, group, updateGroup, clearGroup, updateProfile } = useAuth();
  const [data, setData] = useState<GroupData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    if (!user || !group) {
      setData(null);
      return;
    }
    setIsLoading(true);
    gd.loadGroupData(group, user)
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        // Escucha los cambios de otros miembros en tiempo real.
        unsubscribe = gd.subscribeGroupData(group.id, (next) => {
          if (!cancelled) setData(next);
        });
      })
      .catch((e) => {
        console.warn(`No se pudo cargar el grupo ${group.id}`, e);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user?.id, group?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutate = useCallback(
    async (fn: (d: GroupData) => GroupData): Promise<GroupData | null> => {
      if (!data) return null;
      // Optimista: pinta ya el resultado local. La transacción relee el doc
      // fresco del servidor y le aplica la misma función, así dos miembros
      // actuando a la vez no se pisan; onSnapshot reconcilia después.
      setData(fn(data));
      const committed = await gd.mutateGroupData(data.group.id, (fresh) =>
        fresh ? fn(fresh) : null,
      );
      if (committed) setData(committed);
      return committed;
    },
    [data],
  );

  const me = useMemo(
    () => data?.members.find((m) => m.userId === user?.id) ?? null,
    [data, user?.id],
  );
  const isAdmin = me?.role === 'admin';

  const createEvent = useCallback(
    async (event: GroupEvent) => {
      const committed = await mutate((d) => ({ ...d, events: [...d.events, event] }));
      // Push real al resto de miembros (el creador no se notifica a sí mismo),
      // con texto según la categoría del evento.
      const members = (committed ?? data)?.members ?? [];
      if (data) {
        const prefix =
          event.kind === 'informal'
            ? 'notifications.newInformal'
            : event.kind === 'specialDay'
              ? 'notifications.newSpecialDay'
              : 'notifications.newEvent';
        sendPushToUsers(
          data.group.id,
          members.filter((m) => m.userId !== user?.id).map((m) => m.userId),
          {
            ...localizedPush(`${prefix}Title`, `${prefix}Body`, { title: event.title }),
            url: `/event/${event.id}`,
          },
        );
      }
    },
    [mutate, data, user],
  );

  const updateEvent = useCallback(
    async (event: GroupEvent) => {
      await mutate((d) => ({
        ...d,
        events: d.events.map((e) => (e.id === event.id ? event : e)),
      }));
    },
    [mutate],
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      await mutate((d) => ({
        ...d,
        events: d.events.filter((e) => e.id !== eventId),
        votes: d.votes.filter((v) => v.eventId !== eventId),
      }));
    },
    [mutate],
  );

  const vote = useCallback(
    async (eventId: string, value: EventVoteValue) => {
      if (!user) return;
      await mutate((d) => gd.castVote(d, eventId, user.id, value).data);
    },
    [mutate, user],
  );

  const setAttendance = useCallback(
    async (eventId: string, userId: UserId, attended: boolean) => {
      await mutate((d) => gd.setAttendance(d, eventId, userId, attended));
    },
    [mutate],
  );

  const toggleCarSeat = useCallback(
    async (eventId: string, carId: string) => {
      if (!user) return;
      await mutate((d) => gd.toggleCarSeat(d, eventId, carId, user.id));
    },
    [mutate, user],
  );

  const saveCounter = useCallback(
    async (counter: GroupCounter) => {
      await mutate((d) => ({ ...d, counter }));
    },
    [mutate],
  );

  const contribute = useCallback(
    async (proofPhotoUrl?: string) => {
      if (!user || !data) return;
      // Los hitos se calculan sobre el estado fresco leído en la transacción.
      let lastRun: ReturnType<typeof gd.contribute> | null = null;
      const committed = await gd.mutateGroupData(data.group.id, (fresh) => {
        if (!fresh) return null;
        lastRun = gd.contribute(fresh, user.id, proofPhotoUrl);
        return lastRun.data;
      });
      // TS no ve las asignaciones hechas dentro del closure de la transacción.
      const result = lastRun as ReturnType<typeof gd.contribute> | null;
      if (!committed || !result) return;
      setData(committed);
      if (result.groupMilestone) {
        // El hito es del grupo entero: local para quien pulsa, push al resto.
        notifyLocal(
          i18n.t('notifications.groupMilestoneTitle'),
          i18n.t('notifications.groupMilestoneBody', { count: result.groupMilestone }),
        );
        sendPushToUsers(
          committed.group.id,
          committed.members.filter((m) => m.userId !== user.id).map((m) => m.userId),
          {
            ...localizedPush('notifications.groupMilestoneTitle', 'notifications.groupMilestoneBody', {
              count: result.groupMilestone,
            }),
            url: '/counter',
          },
        );
      }
      if (result.personalMilestone) {
        notifyLocal(
          i18n.t('notifications.personalMilestoneTitle'),
          i18n.t('notifications.personalMilestoneBody', { count: result.personalMilestone }),
        );
      }
    },
    [user, data],
  );

  const removeContribution = useCallback(
    async (contributionId: string) => {
      await mutate((d) => gd.removeContribution(d, contributionId));
    },
    [mutate],
  );

  const updateGroupSettings = useCallback(
    async (fields: Partial<Pick<Group, 'name' | 'accessPassword' | 'photoUrl'>>) => {
      const committed = await mutate((d) => ({ ...d, group: { ...d.group, ...fields } }));
      if (committed) await updateGroup(committed.group);
    },
    [mutate, updateGroup],
  );

  const setMemberRole = useCallback(
    async (userId: UserId, role: GroupRole) => {
      await mutate((d) => ({
        ...d,
        group: { ...d.group, memberRoles: { ...d.group.memberRoles, [userId]: role } },
        members: d.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
      }));
    },
    [mutate],
  );

  const leaveGroup = useCallback(
    async (successorId?: UserId) => {
      if (!user || !data) return;
      await gd.mutateGroupData(data.group.id, (fresh) =>
        fresh ? gd.removeMember(fresh, user.id, successorId) : null,
      );
      setData(null);
      await clearGroup(); // el guard redirige al onboarding de grupo
    },
    [user, data, clearGroup],
  );

  const updateMyProfile = useCallback(
    async (fields: ProfileFields) => {
      await updateProfile(fields);
      if (data && user) {
        await mutate((d) => ({
          ...d,
          members: d.members.map((m) =>
            m.userId === user.id
              ? {
                  ...m,
                  name: fields.username ?? m.name,
                  nickname: fields.nickname ?? m.nickname,
                  description: fields.description ?? m.description,
                  photoUrl: fields.photoUrl ?? m.photoUrl,
                  allowPokes: fields.allowPokes ?? m.allowPokes,
                  birthday: fields.birthday ?? m.birthday,
                  showBirthday: fields.showBirthday ?? m.showBirthday,
                }
              : m,
          ),
        }));
      }
    },
    [updateProfile, data, user, mutate],
  );

  const pokeMember = useCallback(
    async (toUserId: UserId): Promise<'ok' | 'cooldown' | 'disabled'> => {
      if (!user || !data) return 'disabled';
      // El cooldown y el permiso se comprueban sobre el estado fresco dentro
      // de la transacción: dos toques simultáneos no lo saltan.
      let status: 'ok' | 'cooldown' | 'disabled' = 'disabled';
      const committed = await gd.mutateGroupData(data.group.id, (fresh) => {
        if (!fresh) return null;
        const target = fresh.members.find((m) => m.userId === toUserId);
        if (!target || target.allowPokes === false) {
          status = 'disabled';
          return null;
        }
        // El cooldown depende del compromiso de quien toca: 12 h con el 100%
        // y hasta 24 h con el 0%.
        const sender = fresh.members.find((m) => m.userId === user.id);
        const cooldown = gd.pokeCooldownMs(sender?.commitmentScore ?? 100);
        const last = gd.lastPokeAt(fresh, user.id, toUserId);
        if (last && Date.now() - last < cooldown) {
          status = 'cooldown';
          return null;
        }
        status = 'ok';
        return gd.addPoke(fresh, user.id, toUserId);
      });
      if (committed) setData(committed);
      // (cast: TS no ve las asignaciones hechas dentro del closure)
      if ((status as string) !== 'ok') return status;
      // Push real AL DESTINATARIO en todos sus dispositivos. (Antes aquí se
      // mostraba una notificación local, que le llegaba al que tocaba en vez
      // de al tocado.)
      const myName = me?.nickname ?? me?.name ?? '';
      sendPushToUsers(data.group.id, [toUserId], {
        ...localizedPush('poke.notifTitle', 'poke.notifBody', { name: myName }),
        url: user ? `/member/${user.id}` : '/',
      });
      return 'ok';
    },
    [user, data, me],
  );

  const adjustCopipoints = useCallback(
    async (userId: UserId, delta: number) => {
      await mutate((d) => ({
        ...d,
        members: d.members.map((m) =>
          m.userId === userId
            ? { ...m, copipoints: (m.copipoints ?? gd.COPIPOINTS_START) + delta }
            : m,
        ),
      }));
    },
    [mutate],
  );

  const setDriver = useCallback(
    async (userId: UserId, isDriver: boolean) => {
      await mutate((d) => ({
        ...d,
        members: d.members.map((m) => (m.userId === userId ? { ...m, isDriver } : m)),
      }));
    },
    [mutate],
  );

  const setMusician = useCallback(
    async (userId: UserId, isMusician: boolean) => {
      await mutate((d) => ({
        ...d,
        members: d.members.map((m) => (m.userId === userId ? { ...m, isMusician } : m)),
      }));
    },
    [mutate],
  );

  const addPhrase = useCallback(
    async (phrase: Phrase) => {
      await mutate((d) => ({ ...d, phrases: [...(d.phrases ?? []), phrase] }));
    },
    [mutate],
  );

  const updatePhrase = useCallback(
    async (phraseId: string, text: string) => {
      await mutate((d) => ({
        ...d,
        phrases: (d.phrases ?? []).map((p) => (p.id === phraseId ? { ...p, text } : p)),
      }));
    },
    [mutate],
  );

  const deletePhrase = useCallback(
    async (phraseId: string) => {
      await mutate((d) => ({
        ...d,
        phrases: (d.phrases ?? []).filter((p) => p.id !== phraseId),
      }));
    },
    [mutate],
  );

  const saveSong = useCallback(
    async (song: Song) => {
      await mutate((d) => {
        const songs = d.songs ?? [];
        const exists = songs.some((s) => s.id === song.id);
        return {
          ...d,
          songs: exists ? songs.map((s) => (s.id === song.id ? song : s)) : [...songs, song],
        };
      });
    },
    [mutate],
  );

  const deleteSong = useCallback(
    async (songId: string) => {
      await mutate((d) => ({ ...d, songs: (d.songs ?? []).filter((s) => s.id !== songId) }));
    },
    [mutate],
  );

  const createPoll = useCallback(
    async (poll: Poll) => {
      const committed = await mutate((d) => ({ ...d, polls: [...(d.polls ?? []), poll] }));
      // Push real al resto de miembros al crearse la encuesta.
      const members = (committed ?? data)?.members ?? [];
      if (data) {
        sendPushToUsers(
          data.group.id,
          members.filter((m) => m.userId !== user?.id).map((m) => m.userId),
          {
            ...localizedPush('polls.notifTitle', 'polls.notifBody', { title: poll.title }),
            url: '/polls',
          },
        );
      }
    },
    [mutate, data, user],
  );

  const votePoll = useCallback(
    async (pollId: string, optionIndexes: number[]) => {
      if (!user) return;
      await mutate((d) => ({
        ...d,
        polls: (d.polls ?? []).map((p) =>
          p.id === pollId ? { ...p, votes: { ...p.votes, [user.id]: optionIndexes } } : p,
        ),
      }));
    },
    [mutate, user],
  );

  const setMyStatus = useCallback(
    async (fields: { text?: string; photoUrl?: string }) => {
      if (!user) return;
      await mutate((d) => ({
        ...d,
        statuses: [
          ...(d.statuses ?? []).filter((s) => s.userId !== user.id),
          { userId: user.id, ...fields, at: new Date().toISOString() },
        ],
      }));
    },
    [mutate, user],
  );

  const clearMyStatus = useCallback(async () => {
    if (!user) return;
    await mutate((d) => ({
      ...d,
      statuses: (d.statuses ?? []).filter((s) => s.userId !== user.id),
    }));
  }, [mutate, user]);

  const addSavedColor = useCallback(
    async (color: SavedColor) => {
      await mutate((d) => ({ ...d, savedColors: [...(d.savedColors ?? []), color] }));
    },
    [mutate],
  );

  const removeSavedColor = useCallback(
    async (colorId: string) => {
      await mutate((d) => ({
        ...d,
        savedColors: (d.savedColors ?? []).filter((c) => c.id !== colorId),
      }));
    },
    [mutate],
  );

  const updateMyCar = useCallback(
    async (carDetails: CarDetails | undefined) => {
      if (!user) return;
      await mutate((d) => ({
        ...d,
        members: d.members.map((m) => (m.userId === user.id ? { ...m, carDetails } : m)),
      }));
    },
    [mutate, user],
  );

  const setMemberCar = useCallback(
    async (userId: UserId, carDetails: CarDetails | undefined) => {
      await mutate((d) => ({
        ...d,
        members: d.members.map((m) => (m.userId === userId ? { ...m, carDetails } : m)),
      }));
    },
    [mutate],
  );

  const value = useMemo(
    () => ({
      data,
      isLoading,
      me,
      isAdmin,
      createEvent,
      updateEvent,
      deleteEvent,
      vote,
      setAttendance,
      toggleCarSeat,
      saveCounter,
      contribute,
      removeContribution,
      updateGroupSettings,
      setMemberRole,
      leaveGroup,
      updateMyProfile,
      pokeMember,
      adjustCopipoints,
      setDriver,
      setMusician,
      updateMyCar,
      setMemberCar,
      addPhrase,
      updatePhrase,
      deletePhrase,
      saveSong,
      deleteSong,
      createPoll,
      votePoll,
      setMyStatus,
      clearMyStatus,
      addSavedColor,
      removeSavedColor,
    }),
    [
      data,
      isLoading,
      me,
      isAdmin,
      createEvent,
      updateEvent,
      deleteEvent,
      vote,
      setAttendance,
      toggleCarSeat,
      saveCounter,
      contribute,
      removeContribution,
      updateGroupSettings,
      setMemberRole,
      leaveGroup,
      updateMyProfile,
      pokeMember,
      adjustCopipoints,
      setDriver,
      setMusician,
      updateMyCar,
      setMemberCar,
      addPhrase,
      updatePhrase,
      deletePhrase,
      saveSong,
      deleteSong,
      createPoll,
      votePoll,
      setMyStatus,
      clearMyStatus,
      addSavedColor,
      removeSavedColor,
    ],
  );

  return <GroupDataContext.Provider value={value}>{children}</GroupDataContext.Provider>;
}

export function useGroupData(): GroupDataContextValue {
  const ctx = useContext(GroupDataContext);
  if (!ctx) throw new Error('useGroupData debe usarse dentro de <GroupDataProvider>');
  return ctx;
}
