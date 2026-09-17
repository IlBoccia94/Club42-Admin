const APP_BASE = new URL('./', self.location.href).href;
const DEFAULT_ICON = new URL('assets/IMG-20260914-WA0013.jpg', APP_BASE).href;

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Club42 Admin', body: event.data?.text?.() || 'Hai una nuova notifica.' };
  }

  const title = payload.title || 'Club42 Admin';
  const options = {
    body: payload.body || '',
    icon: payload.icon || DEFAULT_ICON,
    tag: payload.category ? `club42-${payload.category}` : undefined,
    renotify: true,
    data: {
      url: payload.url || `${APP_BASE}#dashboard`
    },
    actions: [
      { action: 'open', title: 'Apri Club42' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || `${APP_BASE}#dashboard`;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      try {
        await client.navigate(url);
        return client.focus();
      } catch {}
    }
    return self.clients.openWindow(url);
  })());
});
