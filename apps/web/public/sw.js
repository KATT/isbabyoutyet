// Service Worker for Push Notifications
const CACHE_NAME = "isbabyoutyet-v1";

function isString(value) {
  return typeof value === "string";
}

// Install event - cache static assets
self.addEventListener("install", (_event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
    }),
  );
  return self.clients.claim();
});

// Push event - handle incoming push notifications
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.error("Push event received without data");
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error("Failed to parse push data:", e);
    return;
  }

  event.waitUntil(
    (async () => {
      if (data.dismiss === true) {
        if (!isString(data.tag)) {
          return;
        }
        const notifications = await self.registration.getNotifications({ tag: data.tag });
        for (const notification of notifications) {
          notification.close();
        }
        return;
      }

      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon,
        badge: data.icon, // Use same icon for badge
        image: isString(data.image) ? data.image : undefined,
        data: { url: data.url },
        tag: data.tag,
        requireInteraction: false,
      });
    })(),
  );
});

// Notification click event - open the baby page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlPath = event.notification.data?.url || "/";
  // Convert relative URL to absolute for proper comparison with client.url
  const urlToOpen = new URL(urlPath, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (const client of clientList) {
          // Compare absolute URLs (client.url is always absolute)
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});
