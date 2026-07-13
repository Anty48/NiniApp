/**
 * Modelos de dominio de NiniApp.
 * Son la fuente de verdad del esquema que luego se materializará en el
 * backend en tiempo real (Firestore). Los IDs son strings generados por el backend.
 */

export type UserId = string;
export type GroupId = string;
export type EventId = string;

// ---------- Usuario ----------

export interface User {
  id: UserId;
  email: string;
  /** Nombre de usuario único. Si entra con Google, se hereda de la cuenta. */
  username: string;
  /** Apodo visible dentro del grupo. */
  nickname?: string;
  description?: string;
  photoUrl?: string;
  /** Función "Tocar": si acepta recibir toques. Activada por defecto. */
  allowPokes?: boolean;
  /** IDs de los grupos a los que pertenece (máximo 3). */
  groupIds: GroupId[];
  createdAt: string; // ISO 8601
}

// ---------- Grupo ----------

export type GroupRole = 'admin' | 'member';

export interface Group {
  id: GroupId;
  name: string;
  photoUrl?: string;
  /** Contraseña de acceso para unirse (el backend la almacenará hasheada). */
  accessPassword: string;
  /** El creador es admin; puede asignar más admins. */
  memberRoles: Record<UserId, GroupRole>;
  /** Coches predefinidos activables en bloque al crear un evento. */
  presetCars: CarPreset[];
  createdAt: string;
}

/** Miembro del grupo con su perfil visible y sus estadísticas. */
export interface GroupMember {
  userId: UserId;
  name: string;
  nickname?: string;
  description?: string;
  photoUrl?: string;
  /** Si acepta recibir "toques" de otros miembros. */
  allowPokes?: boolean;
  role: GroupRole;
  /** % de compromiso (0-100). Baja con penalizaciones, se recupera lento. */
  commitmentScore: number;
  /** Marca desde la que se aplica la recuperación pasiva del score. */
  lastRecoveryAt: string;
  /** Contribuciones totales al contador activo. */
  counterContributions: number;
  /** Racha individual de días seguidos contribuyendo (hitos: 5, 10). */
  personalStreakDays: number;
  /** Último día (YYYY-MM-DD) en que contribuyó al contador. */
  lastContributionDate?: string;
}

/** "Toque" entre miembros (estilo poke). Máx. uno cada 24 h por destinatario. */
export interface Poke {
  fromUserId: UserId;
  toUserId: UserId;
  at: string; // ISO 8601
}

/** Estado completo de un grupo tal y como lo consume la UI. */
export interface GroupData {
  group: Group;
  members: GroupMember[];
  events: GroupEvent[];
  votes: EventVote[];
  counter: GroupCounter | null;
  contributions: CounterContribution[];
  pokes?: Poke[];
}

// ---------- Eventos y votación ----------

export type EventVoteValue = 'yes' | 'no' | 'deciding';

export interface GroupEvent {
  id: EventId;
  groupId: GroupId;
  createdBy: UserId;
  /** Solo los admins pueden crear eventos especiales. */
  isSpecial: boolean;
  title: string;
  description?: string;
  /** Dirección/enlace de Google Maps. */
  mapsAddress?: string;
  startsAt: string;
  /** Puede ser otro día: los eventos pueden durar más de un día. */
  endsAt: string;
  /** Horas antes del inicio en que se cierra la votación (por defecto 12). */
  voteLockHoursBefore: number;
  cars?: EventCar[];
  /** Los eventos pasados se guardan 1 mes en histórico antes de borrarse. */
  archivedAt?: string;
}

export interface EventVote {
  eventId: EventId;
  userId: UserId;
  value: EventVoteValue;
  updatedAt: string;
  /** true si el último cambio ocurrió dentro del periodo de cierre (penaliza). */
  changedDuringLockPeriod: boolean;
  /** Validación del creador tras el evento: asistió realmente o no. */
  attendanceConfirmed?: boolean;
}

// ---------- Coches (logística de eventos) ----------

export interface CarPreset {
  id: string;
  name: string;
  seats: number; // por defecto 4
}

export interface EventCar {
  id: string;
  name: string;
  seats: number;
  /** Usuarios (con voto SÍ) asignados a plaza, en orden. */
  occupants: UserId[];
}

// ---------- Contador de rachas ----------

export interface GroupCounter {
  groupId: GroupId;
  name: string;
  /** Acumulado total; nunca se reinicia. */
  totalValue: number;
  initialValue: number; // por defecto 0
  /** Si pueden sumar todos los miembros o solo los admins. */
  anyoneCanIncrement: boolean;
  /** Si un mismo usuario puede pulsar más de una vez al día. */
  multiplePerDay: boolean;
  /** Días seguidos con al menos una contribución del grupo. Se reinicia a 0 si un día nadie suma. */
  streakDays: number;
  /** Última fecha (YYYY-MM-DD) con alguna contribución. */
  lastContributionDate?: string;
}

export interface CounterContribution {
  id: string;
  groupId: GroupId;
  userId: UserId;
  at: string;
  /** Foto de prueba: opcional en los 3 primeros clics del día, obligatoria en el 4º. Se borra a las 24h. */
  proofPhotoUrl?: string;
}
