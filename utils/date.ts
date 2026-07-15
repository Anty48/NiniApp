export const DAY_MS = 86_400_000;

/** Clave de día local YYYY-MM-DD (para rachas y límites diarios). */
export function dayKey(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Días entre dos claves YYYY-MM-DD (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

/** Convierte los inputs de texto del formulario ("2026-07-12", "18:00") a Date. */
export function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const date = dateStr.trim();
  const time = timeStr.trim().padStart(5, '0');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateInput(iso: string): string {
  return dayKey(iso);
}

export function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const LOCALE_MAP: Record<string, string> = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' };

export function formatDateTime(iso: string, lang: string | null): string {
  return new Date(iso).toLocaleString(LOCALE_MAP[lang ?? 'es'] ?? 'es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeAgoOrDate(iso: string, lang: string | null): string {
  return formatDateTime(iso, lang);
}

function formatDay(iso: string, lang: string | null): string {
  return new Date(iso).toLocaleDateString(LOCALE_MAP[lang ?? 'es'] ?? 'es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

/** Rango legible de un evento: sin horas si es "todo el día". */
export function formatEventRange(
  event: { startsAt: string; endsAt: string; allDay?: boolean },
  lang: string | null,
): string {
  if (!event.allDay) return `${formatDateTime(event.startsAt, lang)} → ${formatDateTime(event.endsAt, lang)}`;
  const startDay = toDateInput(event.startsAt);
  const endDay = toDateInput(event.endsAt);
  return startDay === endDay
    ? formatDay(event.startsAt, lang)
    : `${formatDay(event.startsAt, lang)} → ${formatDay(event.endsAt, lang)}`;
}

/** Primer día (lunes) de la semana que contiene `date`. */
function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - weekday);
  return d;
}

/** Cuadrícula de 42 días (6 semanas, lunes a domingo) cubriendo el mes de `month`. */
export function buildMonthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = startOfWeekMonday(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function monthLabel(date: Date, lang: string | null): string {
  const label = date.toLocaleDateString(LOCALE_MAP[lang ?? 'es'] ?? 'es-ES', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Eventos que ocupan un día concreto (comparación lexicográfica YYYY-MM-DD). */
export function eventsOnDay<T extends { startsAt: string; endsAt: string }>(
  events: T[],
  day: string,
): T[] {
  return events
    .filter((e) => toDateInput(e.startsAt) <= day && day <= toDateInput(e.endsAt))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Nombres cortos de lunes a domingo en el idioma del usuario. */
export function weekdayLabels(lang: string | null): string[] {
  // 2024-01-01 fue lunes: base estable para generar las 7 etiquetas en orden.
  const base = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toLocaleDateString(LOCALE_MAP[lang ?? 'es'] ?? 'es-ES', { weekday: 'short' });
  });
}
