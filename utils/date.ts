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
