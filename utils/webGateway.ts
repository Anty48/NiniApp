/**
 * Recuerda que el usuario ya cruzó la web de recepción ("Acceder a la app" en
 * `app/gateway.tsx`), para que el guard de navegación (`app/_layout.tsx`) no la
 * vuelva a mostrar. Antes era un flag solo en memoria (reaparecía al recargar);
 * ahora se persiste en `localStorage`, así los usuarios que ya entraron —sobre
 * todo los de iOS con la web anclada— no ven la recepción cada vez que abren.
 *
 * Solo tiene sentido en web; en nativo (sin `localStorage`) siempre es `false`
 * y, además, el guard nunca llega a mostrar la recepción fuera de la web.
 */
const KEY = 'niniapp.enteredWeb';

export function hasEnteredWeb(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markEnteredWeb(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, '1');
  } catch {
    // Modo privado / almacenamiento bloqueado: la recepción reaparecerá, sin más.
  }
}
