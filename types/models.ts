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
  /** Cumpleaños en formato DD/MM (ej. "24/05"). */
  birthday?: string;
  /** Si el cumpleaños se muestra como día especial en el calendario del grupo. */
  showBirthday?: boolean;
  /**
   * Idioma de la interfaz ('es' | 'en' | 'ca'). Se sincroniza al abrir la app
   * para que el servidor (api/vote-reminders.js) notifique en el idioma del
   * destinatario.
   */
  language?: string;
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
  /** LEGADO: antiguo enlace a Google Docs del Frasario (hoy las frases viven en GroupData.phrases). */
  phrasebookUrl?: string;
  createdAt: string;
}

/**
 * Datos del coche de un conductor. Solo existe un coche por conductor,
 * atado a su persona: lo asigna el admin al darle el rol y lo puede editar
 * después tanto el admin como el propio conductor.
 */
export interface CarDetails {
  /** Nombre propio del coche (ej. "La Pantera"), aparte del modelo. */
  name?: string;
  model?: string;
  color?: string;
  seats?: number;
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
  /** "Copipuntos": saldo del copiloto, lo administran los conductores. */
  copipoints: number;
  /** Conductor: lo asigna el admin; desbloquea la Zona de Conductores. */
  isDriver?: boolean;
  /** Coche del conductor, editable por él en la Zona de Conductores. */
  carDetails?: CarDetails;
  /** Músico del grupo: lo asigna el admin; puede añadir canciones. */
  isMusician?: boolean;
  /** Cumpleaños (DD/MM) copiado del perfil, para pintarlo en el calendario. */
  birthday?: string;
  showBirthday?: boolean;
  /** Último día (YYYY-MM-DD) en que el cron anunció su cumpleaños al grupo. */
  birthdayNotifiedOn?: string;
}

/** "Toque" entre miembros (estilo poke). Máx. uno cada 24 h por destinatario. */
export interface Poke {
  fromUserId: UserId;
  toUserId: UserId;
  at: string; // ISO 8601
}

/** Frase memorable del Frasario. Cualquier miembro puede añadirla o editarla. */
export interface Phrase {
  id: string;
  /** La frase, sin comillas (la UI la pinta entre comillas y con — autor). */
  text: string;
  /** Autor si es un miembro del grupo... */
  memberId?: UserId;
  /** ...o su nombre libre si la dijo alguien de fuera del grupo. */
  externalName?: string;
  addedBy: UserId;
  createdAt: string;
}

/** Canción del grupo, la crean los músicos (título + letra con su formato). */
export interface Song {
  id: string;
  title: string;
  /** Letra en texto plano: se respetan saltos de línea, espacios e indentación. */
  lyrics: string;
  createdBy: UserId;
  createdAt: string;
}

/** Encuesta rápida: se borra sola a las 24 h y no afecta a nada más. */
export interface Poll {
  id: string;
  title: string;
  options: string[];
  /** Votación anónima: no se muestra quién ha votado cada opción. */
  anonymous: boolean;
  /** Si cada persona puede marcar varias opciones. */
  multi: boolean;
  createdBy: UserId;
  createdAt: string;
  /** Índices de opción votados por cada usuario. */
  votes: Record<UserId, number[]>;
}

/** Estado efímero de un miembro (texto y/o foto); caduca a las 24 h. */
export interface MemberStatus {
  userId: UserId;
  text?: string;
  photoUrl?: string;
  at: string;
}

/** Color guardado del grupo con nombre (ej. "Verde UAB"), reutilizable. */
export interface SavedColor {
  id: string;
  name: string;
  /** Hexadecimal #RRGGBB. */
  color: string;
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
  phrases?: Phrase[];
  songs?: Song[];
  polls?: Poll[];
  statuses?: MemberStatus[];
  savedColors?: SavedColor[];
}

// ---------- Eventos y votación ----------

export type EventVoteValue = 'yes' | 'no' | 'deciding';

/**
 * Categoría del evento:
 *  - standard: evento normal con votación de asistencia.
 *  - informal: quedada informal, sin votación ni penalizaciones.
 *  - specialDay: día especial (fiestas mayores, cumpleaños...), sin votación.
 */
export type EventKind = 'standard' | 'informal' | 'specialDay';

export interface GroupEvent {
  id: EventId;
  groupId: GroupId;
  createdBy: UserId;
  /** Solo los admins pueden crear eventos especiales. */
  isSpecial: boolean;
  /** Categoría (los eventos antiguos sin campo son 'standard'). */
  kind?: EventKind;
  title: string;
  description?: string;
  /** Dirección/enlace de Google Maps. */
  mapsAddress?: string;
  startsAt: string;
  /** Puede ser otro día: los eventos pueden durar más de un día. */
  endsAt: string;
  /** Si es true, startsAt/endsAt son las 00:00 y 23:59 de sus días (sin hora concreta). */
  allDay?: boolean;
  /** Color del evento en el calendario: aleatorio y transparente por defecto. */
  color?: string;
  /** Horas antes del inicio en que se cierra la votación (por defecto 12). */
  voteLockHoursBefore: number;
  cars?: EventCar[];
  /** Los eventos pasados se guardan 1 mes en histórico antes de borrarse. */
  archivedAt?: string;
  /** Marca del recordatorio "queda <1 h de votación" (lo escribe api/vote-reminders.js). */
  voteReminderSentAt?: string;
  /** Marca del aviso "hoy es el día especial" (lo escribe api/vote-reminders.js). */
  specialDayNotifiedAt?: string;
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

export interface EventCar {
  id: string;
  /** Conductor dueño del coche, si es un coche del grupo (queda atado a él). */
  driverId?: UserId;
  /** Solo para coches temporales (creados solo para este evento, sin dueño). */
  name?: string;
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

// ---------- Buzón de sugerencias (para el desarrollador) ----------

/**
 * Sugerencia sobre la app que un usuario envía al desarrollador. Se guarda en
 * la colección `suggestions` de Firestore; solo el desarrollador la lee desde
 * la consola de Firebase. `expireAt` es un Timestamp de Firestore = creación
 * + 5 días: con la política TTL activada sobre ese campo, Firebase borra la
 * sugerencia sola y gratis pasado ese plazo.
 */
export interface Suggestion {
  text: string;
  /** true = sin datos del remitente (tampoco los ve el desarrollador). */
  anonymous: boolean;
  userId?: UserId;
  userName?: string;
  userEmail?: string;
  platform: string;
  /** serverTimestamp() de Firestore. */
  createdAt: unknown;
  /** Timestamp de Firestore usado por la política TTL para autoborrado. */
  expireAt: unknown;
}
