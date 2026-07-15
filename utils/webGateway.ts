/**
 * Recuerda, durante la sesión de la app, que el usuario ya cruzó la puerta de
 * entrada web ("Entrar a la Web" en `app/gateway.tsx`), para que el guard de
 * navegación (`app/_layout.tsx`) no lo devuelva a ella una y otra vez.
 *
 * Es un simple flag en memoria: si recarga la página (web) vuelve a verla, lo
 * cual es el comportamiento deseado para una "landing" de entrada.
 */
let entered = false;

export function hasEnteredWeb(): boolean {
  return entered;
}

export function markEnteredWeb(): void {
  entered = true;
}
