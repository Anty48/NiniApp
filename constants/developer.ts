import type { IconName } from '@/components/ui/Icon';

/**
 * Contenido del desarrollador que se promociona dentro de NiniApp (Perfil,
 * pantalla /tstats y popup de novedades). Todo es JS: cambiar algo de aquí
 * llega a los APK por `eas update`, sin recompilar.
 */

/**
 * Web de T-Stats. Mientras sea null, la app dice que "se está cocinando";
 * en cuanto pongas aquí la URL, todos los botones pasan a abrirla.
 */
export const TSTATS_URL: string | null = 'https://t-stats.vercel.app/';

/** Logo de T-Stats (copia reducida del T-S.png de su repositorio). */
export const TSTATS_LOGO = require('../assets/images/tstats-logo.png');

/** Colores de marca de T-Stats (amarillo transporte + tinta casi negra). */
export const TSTATS_YELLOW = '#FDDC02';
export const TSTATS_INK = '#211F1E';

/**
 * Identificador del anuncio del popup de "nuevo contenido". El popup sale una
 * sola vez por dispositivo y anuncio: si algún día quieres volver a mostrarlo
 * (p. ej. cuando la web de T-Stats esté lista), cambia este id.
 */
export const DEV_ANNOUNCEMENT_ID = 'tstats-2026-10';

/** "Más contenido de este desarrollador": enlaces externos del Perfil. */
export const DEV_LINKS: { key: string; icon: IconName; url: string }[] = [
  {
    key: 'devRodalies',
    icon: 'minecraft',
    url: 'https://www.curseforge.com/minecraft/mc-mods/rodalies-decorations',
  },
  { key: 'devCreate', icon: 'cog-outline', url: 'https://createmod.com/es/author/anty48' },
  {
    key: 'devBuildpaste',
    icon: 'cube-outline',
    url: 'https://buildpaste.net/profile/io7uXbS485OjMq431nRknR25EoU2',
  },
  { key: 'devCalculator', icon: 'calculator-variant-outline', url: 'https://github.com/Anty48/physics-calc' },
];
