/* Web Push receiver for YAKU ALERT. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "Hay un nuevo aviso de YAKU ALERT UNT." };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "YAKU ALERT · Aviso UNT", {
      body: payload.body || "Hay un nuevo aviso para la comunidad UNT.",
      tag: payload.notification_id || "yaku-alert",
      data: { url: payload.url || "/?mobile=1" },
      icon: "/assets/yaku-alert-icon.png",
      badge: "/assets/yaku-alert-icon.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/?mobile=1", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
