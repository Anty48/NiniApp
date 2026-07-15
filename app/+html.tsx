import { ScrollViewStyleReset } from 'expo-router/html';

// Web-only: HTML raíz de todas las páginas durante el renderizado estático.
// Aquí se configura todo lo necesario para que la web funcione como PWA
// instalable en iOS (anclada a la pantalla de inicio).
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS: anclar a pantalla de inicio */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NiniApp" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />

        {/* Evita parpadeos de fondo al cargar en modo oscuro. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* El CSS de arriba sigue al tema del SISTEMA; este script lo corrige
            con la preferencia guardada en la app (localStorage) antes de que
            cargue el bundle, para que el fondo no cambie al refrescar. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #fff;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #000;
  }
}`;

// AsyncStorage en web guarda bajo la misma clave en localStorage, con el
// valor serializado en JSON ('"dark"'); ver services/storage.ts.
const themeBootstrap = `
(function () {
  try {
    var mode = JSON.parse(localStorage.getItem('niniapp.themeMode') || 'null');
    var dark =
      mode === 'dark' ||
      (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var style = document.createElement('style');
    style.textContent = 'body { background-color: ' + (dark ? '#000' : '#fff') + ' !important; }';
    document.head.appendChild(style);
  } catch (e) {}
})();`;
