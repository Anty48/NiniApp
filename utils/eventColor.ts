/** Color aleatorio y muy transparente para etiquetar un evento en el calendario. */
export function randomEventColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsla(${hue}, 70%, 55%, 0.28)`;
}

/** Misma tonalidad pero más sólida, para marcas pequeñas (puntos, barras). */
export function solidEventColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  return color.replace(/,\s*[\d.]+\)$/, ', 0.85)');
}
