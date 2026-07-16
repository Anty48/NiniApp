/**
 * Service worker de Web Push de NiniApp (web y PWA de iOS/Android).
 * Lo registra services/push.ts; los mensajes los envía api/push.js con la
 * librería web-push (VAPID). Solo gestiona push: no cachea ni intercepta red.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Payload no JSON: se muestra igualmente con los textos por defecto.
  }
  const title = data.title || 'NiniApp';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          if (client.navigate) client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
