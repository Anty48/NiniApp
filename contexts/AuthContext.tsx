import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as authService from '@/services/auth';
import * as groupsService from '@/services/groups';
import { getItem, removeItem, setItem, StorageKeys } from '@/services/storage';
import { Group, User } from '@/types/models';

/**
 * Sesión persistida en el dispositivo. Si existe, el usuario entra directo;
 * si no, se le redirige a Login/Signup (ver AuthGate en app/_layout.tsx).
 * El usuario puede pertenecer hasta a MAX_GROUPS grupos; uno está "activo".
 */
interface PersistedSession {
  user: User;
  groups: Group[];
  activeGroupId: string | null;
  /** Formato antiguo (un solo grupo); se migra al cargar. */
  group?: Group | null;
}

/** Campos del perfil propio editables desde la app. */
export type ProfileFields = Partial<
  Pick<
    User,
    | 'username'
    | 'nickname'
    | 'description'
    | 'photoUrl'
    | 'allowPokes'
    | 'birthday'
    | 'showBirthday'
  >
>;

interface AuthContextValue {
  user: User | null;
  /** Grupo activo. null => onboarding obligatorio de crear/unirse a grupo. */
  group: Group | null;
  /** Todos los grupos del usuario (máx. 3). */
  groups: Group[];
  canAddGroup: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Añade un grupo (tras crear/unirse) y lo convierte en el activo. */
  addGroup: (group: Group) => Promise<void>;
  /** Cambia el grupo activo desde el menú de grupos. */
  switchGroup: (groupId: string) => Promise<void>;
  /** Actualiza los datos del grupo activo en la sesión (nombre, contraseña...). */
  updateGroup: (group: Group) => Promise<void>;
  /** Abandona el grupo activo; si quedan otros, activa el siguiente. */
  clearGroup: () => Promise<void>;
  /** Edita el perfil propio (foto, nombre, apodo, descripción, tocar...). */
  updateProfile: (fields: ProfileFields) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restaura la sesión al arrancar. La fuente de verdad es Firebase Auth:
  // se espera a que rehidrate su usuario persistido y, si no hay ninguno,
  // cualquier sesión guardada en el dispositivo (p. ej. del antiguo modo
  // local) se descarta — si no, se harían peticiones a Firestore sin
  // autenticar y las reglas las rechazarían ("insufficient permissions").
  useEffect(() => {
    let cancelled = false;

    // Relee el perfil y los grupos desde Firestore y actualiza la sesión.
    // La copia local puede estar desactualizada si el usuario editó su perfil
    // (foto, apodo...) o los grupos desde OTRO dispositivo.
    const refreshFromFirestore = async (
      fbUser: NonNullable<Awaited<ReturnType<typeof authService.restoreFirebaseUser>>>,
      preferredActiveId: string | null,
    ) => {
      const nextUser = await authService.loadUserDoc(fbUser);
      const userGroups = await groupsService.fetchGroupsFor(nextUser);
      if (cancelled) return;
      const nextActiveId = userGroups.some((g) => g.id === preferredActiveId)
        ? preferredActiveId
        : (userGroups[0]?.id ?? null);
      setUser(nextUser);
      setGroups(userGroups);
      setActiveGroupId(nextActiveId);
      await setItem(StorageKeys.session, {
        user: nextUser,
        groups: userGroups,
        activeGroupId: nextActiveId,
      });
    };

    (async () => {
      try {
        const session = await getItem<PersistedSession>(StorageKeys.session);
        const fbUser = await authService.restoreFirebaseUser();
        if (cancelled) return;

        if (!fbUser) {
          if (session) await removeItem(StorageKeys.session);
          return;
        }

        if (session && session.user.id === fbUser.uid) {
          // Arranque instantáneo con la copia local...
          setUser(session.user);
          const sessionGroups = session.groups ?? (session.group ? [session.group] : []);
          const sessionActiveId =
            session.activeGroupId ?? sessionGroups[0]?.id ?? null;
          setGroups(sessionGroups);
          setActiveGroupId(sessionActiveId);
          // ...y refresco en segundo plano (no bloquea isLoading).
          refreshFromFirestore(fbUser, sessionActiveId).catch((e) =>
            console.warn('No se pudo refrescar el perfil desde Firestore', e),
          );
          return;
        }

        // Hay usuario de Firebase pero la sesión guardada falta o es de otra
        // identidad: se reconstruye desde Firestore.
        await refreshFromFirestore(fbUser, session?.activeGroupId ?? null);
      } catch (e) {
        console.warn('No se pudo restaurar la sesión', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (nextUser: User, nextGroups: Group[], nextActiveId: string | null) => {
      setUser(nextUser);
      setGroups(nextGroups);
      setActiveGroupId(nextActiveId);
      await setItem(StorageKeys.session, {
        user: nextUser,
        groups: nextGroups,
        activeGroupId: nextActiveId,
      });
    },
    [],
  );

  /** Tras autenticar, recupera los grupos del usuario (multi-dispositivo). */
  const finishLogin = useCallback(
    async (nextUser: User) => {
      const userGroups = await groupsService.fetchGroupsFor(nextUser);
      await persist(nextUser, userGroups, userGroups[0]?.id ?? null);
    },
    [persist],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      await finishLogin(await authService.signInWithEmail(email, password));
    },
    [finishLogin],
  );

  const signUp = useCallback(
    async (username: string, email: string, password: string) => {
      await finishLogin(await authService.signUpWithEmail(username, email, password));
    },
    [finishLogin],
  );

  const signInWithGoogle = useCallback(async () => {
    await finishLogin(await authService.signInWithGoogle());
  }, [finishLogin]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setGroups([]);
    setActiveGroupId(null);
    await removeItem(StorageKeys.session);
  }, []);

  const addGroup = useCallback(
    async (nextGroup: Group) => {
      if (!user || groups.length >= groupsService.MAX_GROUPS) return;
      const nextGroups = [...groups.filter((g) => g.id !== nextGroup.id), nextGroup];
      const nextUser = {
        ...user,
        groupIds: Array.from(new Set([...user.groupIds, nextGroup.id])),
      };
      await persist(nextUser, nextGroups, nextGroup.id);
    },
    [persist, user, groups],
  );

  const switchGroup = useCallback(
    async (groupId: string) => {
      if (!user || !groups.some((g) => g.id === groupId)) return;
      await persist(user, groups, groupId);
    },
    [persist, user, groups],
  );

  const updateGroup = useCallback(
    async (nextGroup: Group) => {
      if (!user) return;
      const nextGroups = groups.map((g) => (g.id === nextGroup.id ? nextGroup : g));
      await persist(user, nextGroups, activeGroupId);
    },
    [persist, user, groups, activeGroupId],
  );

  const clearGroup = useCallback(async () => {
    if (!user || !activeGroupId) return;
    const nextGroups = groups.filter((g) => g.id !== activeGroupId);
    const nextUser = {
      ...user,
      groupIds: user.groupIds.filter((id) => id !== activeGroupId),
    };
    await persist(nextUser, nextGroups, nextGroups[0]?.id ?? null);
    await authService.saveUserDoc(nextUser);
  }, [persist, user, groups, activeGroupId]);

  const updateProfile = useCallback(
    async (fields: ProfileFields) => {
      if (!user) return;
      const nextUser = { ...user, ...fields };
      await persist(nextUser, groups, activeGroupId);
      await authService.saveUserDoc(nextUser);
    },
    [persist, user, groups, activeGroupId],
  );

  const group = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const value = useMemo(
    () => ({
      user,
      group,
      groups,
      canAddGroup: groups.length < groupsService.MAX_GROUPS,
      isLoading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      addGroup,
      switchGroup,
      updateGroup,
      clearGroup,
      updateProfile,
    }),
    [
      user,
      group,
      groups,
      isLoading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      addGroup,
      switchGroup,
      updateGroup,
      clearGroup,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
