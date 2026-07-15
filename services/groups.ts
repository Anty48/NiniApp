import { getFirebase } from '@/services/firebase';
import { makeMember, mutateGroupData } from '@/services/groupData';
import { Group, GroupData, User } from '@/types/models';

/** Un usuario puede pertenecer como máximo a 3 grupos. */
export const MAX_GROUPS = 3;

/** ID corta legible para compartir (ej. "K7KQ2M"). */
function generateGroupId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
}

function generateAccessPassword(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function addGroupToUserDoc(userId: string, groupId: string): Promise<void> {
  const { db } = getFirebase();
  const { doc, updateDoc, arrayUnion } = require('@firebase/firestore');
  await updateDoc(doc(db, 'users', userId), { groupIds: arrayUnion(groupId) }).catch(() => {});
}

/**
 * Crea un grupo. La contraseña la elige el creador; si la deja vacía se
 * genera una automáticamente. El creador queda como administrador.
 */
export async function createGroup(
  name: string,
  creator: User,
  password?: string,
): Promise<Group> {
  const accessPassword = password?.trim() || generateAccessPassword();

  const { db } = getFirebase();
  const { doc, getDoc, setDoc } = require('@firebase/firestore');

  // ID única: se reintenta si por azar ya existe.
  let id = generateGroupId();
  for (let i = 0; i < 5; i++) {
    const snap = await getDoc(doc(db, 'groups', id));
    if (!snap.exists()) break;
    id = generateGroupId();
  }

  const group: Group = {
    id,
    name,
    accessPassword,
    memberRoles: { [creator.id]: 'admin' },
    createdAt: new Date().toISOString(),
  };
  const data: GroupData = {
    group,
    members: [makeMember(creator, 'admin')],
    events: [],
    votes: [],
    counter: null,
    contributions: [],
    pokes: [],
  };
  await setDoc(doc(db, 'groups', id), data);
  await addGroupToUserDoc(creator.id, id);
  return group;
}

/** Unirse con ID + contraseña. Lanza Error('join-invalid') si no coinciden. */
export async function joinGroup(
  groupId: string,
  accessPassword: string,
  user: User,
): Promise<Group> {
  const id = groupId.trim().toUpperCase();

  // Transacción: la validación y el alta se hacen sobre el documento fresco,
  // sin pisar cambios concurrentes de otros miembros.
  // TODO(backend): validar en una Cloud Function para no exponer la
  // contraseña en el documento a clientes no miembros (reglas + hash).
  let group: Group | null = null;
  await mutateGroupData(id, (data) => {
    if (!data || data.group.accessPassword !== accessPassword) {
      throw new Error('join-invalid'); // aborta la transacción
    }
    if (data.members.some((m) => m.userId === user.id)) {
      group = data.group;
      return null; // ya era miembro: no hay nada que escribir
    }
    const next: GroupData = {
      ...data,
      group: {
        ...data.group,
        memberRoles: { ...data.group.memberRoles, [user.id]: 'member' },
      },
      members: [...data.members, makeMember(user, 'member')],
    };
    group = next.group;
    return next;
  });
  await addGroupToUserDoc(user.id, id);
  return group!;
}

/** Recupera los objetos Group de los grupos del usuario (para el login). */
export async function fetchGroupsFor(user: User): Promise<Group[]> {
  const ids = user.groupIds.slice(0, MAX_GROUPS);
  const groups: Group[] = [];

  const { db } = getFirebase();
  const { doc, getDoc } = require('@firebase/firestore');
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'groups', id));
    if (snap.exists()) groups.push((snap.data() as GroupData).group);
  }
  return groups;
}
