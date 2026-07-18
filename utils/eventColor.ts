/** Color aleatorio y muy transparente para etiquetar un evento en el calendario. */
export function randomEventColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsla(${hue}, 70%, 55%, 0.28)`;
}

/**
 * Convierte un color sólido #RRGGBB (elegido por el usuario o guardado del
 * grupo) al formato translúcido con que se pintan los eventos (#RRGGBB48,
 * ~28% de opacidad, como el aleatorio).
 */
export function hexToEventColor(hex: string): string {
  return `${hex}48`;
}

/** Misma tonalidad pero sólida, para marcas pequeñas (puntos, barras). */
export function solidEventColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  // #RRGGBBAA -> #RRGGBB
  if (color.startsWith('#') && color.length === 9) return color.slice(0, 7);
  return color.replace(/,\s*[\d.]+\)$/, ', 0.85)');
}
