/**
 * Tipografía de toda la app: Lora (Google Fonts), serif clásica optimizada
 * para pantalla. Los archivos de fuente se cargan en `app/_layout.tsx` con
 * `useFonts` bajo estos nombres, idénticos en Android, iOS y web.
 *
 * OJO: son fuentes por archivo (un peso = un archivo). Donde se use
 * FONT_BOLD no hay que añadir `fontWeight`: la negrita ya viene del propio
 * archivo, y un fontWeight extra provoca negrita sintética borrosa en web.
 */
export const FONT_REGULAR = 'Lora-Regular';
export const FONT_BOLD = 'Lora-Bold';
