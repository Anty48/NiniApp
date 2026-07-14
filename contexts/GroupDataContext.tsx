import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { i18n } from '@/i18n';
import * as gd from '@/services/groupData';
import { notifyLocal } from '@/services/notifications';
import {
  EventVoteValue,
  Group,
  GroupCounter,
  GroupData,
  GroupEvent,
  GroupMember,
  GroupRole,
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
  updateGroupSettings: (
    fields: Partial<Pick<Group, 'name' | 'accessPassword' | 'photoUrl' | 'presetCars'>>,
  ) => Promise<void>;
  setMemberRole: (userId: UserId, role: GroupRole) => Promise<void>;
  /** Sale del grupo borrando los datos propios; si era admin, traspasa el rol. */
  leaveGroup: (successorId?: UserId) => Promise<void>;
  updateMyProfile: (fields: {
    username?: string;
    nickname?: string;
    description?: string;
    photoUrl?: string;
    allowPokes?: boolean;
  }) => Promise<void>;
  /** "Tocar" a otro miembro (una vez cada 24 h por persona). */
  pokeMember: (toUserId: UserId) => Promise<'ok' | 'cooldown' | 'disabled'>;
}

const GroupDataContext = createContext<GroupDataContextValue | null>(null);

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
      await mutate((d) => ({ ...d, events: [...d.events, event] }));
      // TODO(backend): push real (FCM / Web Push) a todos los miembros.
      notifyLocal(i18n.t('notifications.newEventTitle'), i18n.t('notifications.newEventBody', { title: event.title }));
    },
    [mutate],
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
        notifyLocal(
          i18n.t('notifications.groupMilestoneTitle'),
          i18n.t('notifications.groupMilestoneBody', { count: result.groupMilestone }),
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

  const updateGroupSettings = useCallback(
    async (fields: Partial<Pick<Group, 'name' | 'accessPassword' | 'photoUrl' | 'presetCars'>>) => {
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
    async (fields: {
      username?: string;
      nickname?: string;
      description?: string;
      photoUrl?: string;
      allowPokes?: boolean;
    }) => {
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
        const last = gd.lastPokeAt(fresh, user.id, toUserId);
        if (last && Date.now() - last < gd.POKE_COOLDOWN_MS) {
          status = 'cooldown';
          return null;
        }
        status = 'ok';
        return gd.addPoke(fresh, user.id, toUserId);
      });
      if (committed) setData(committed);
      // (cast: TS no ve las asignaciones hechas dentro del closure)
      if ((status as string) !== 'ok') return status;
      // TODO(backend): push real al destinatario vía FCM/Web Push. En local se
      // muestra la notificación en este dispositivo como demostración.
      const myName = me?.nickname ?? me?.name ?? '';
      notifyLocal(i18n.t('poke.notifTitle'), i18n.t('poke.notifBody', { name: myName }));
      return 'ok';
    },
    [user, data, me],
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
      updateGroupSettings,
      setMemberRole,
      leaveGroup,
      updateMyProfile,
      pokeMember,
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
      updateGroupSettings,
      setMemberRole,
      leaveGroup,
      updateMyProfile,
      pokeMember,
    ],
  );

  return <GroupDataContext.Provider value={value}>{children}</GroupDataContext.Provider>;
}

export function useGroupData(): GroupDataContextValue {
  const ctx = useContext(GroupDataContext);
  if (!ctx) throw new Error('useGroupData debe usarse dentro de <GroupDataProvider>');
  return ctx;
}
