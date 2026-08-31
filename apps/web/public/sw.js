/**
 * Shared notification-click matching for the service worker. Keep this in
 * sync with `apps/web/src/lib/notification-click.ts`.
 */
function isBabyOverlayPath(pathname) {
  return (
    /\/baby\/[^/]+\/(?:photo|settings|post|share|login)\/?$/.test(pathname) ||
    /\/baby\/[^/]+\/updates\/[^/]+\/photo\/?$/.test(pathname)
  );
}

function shouldReuseBabyClient(clientUrl, targetUrl) {
  const client = new URL(clientUrl);
  const target = new URL(targetUrl);
  if (client.origin !== target.origin) {
    return false;
  }
  if (isBabyOverlayPath(client.pathname)) {
    return false;
  }
  const clientBaby = /^\/baby\/([^/]+)\/?$/.exec(client.pathname);
  const targetBaby = /^\/baby\/([^/]+)\/?$/.exec(target.pathname);
  return Boolean(clientBaby && targetBaby && clientBaby[1] === targetBaby[1]);
}

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
        for (const client of clientList) {
          if (shouldReuseBabyClient(client.url, urlToOpen) && "focus" in client) {
            // WindowClient.postMessage has no targetOrigin; this client is already same-origin.
            // oxlint-disable-next-line unicorn/require-post-message-target-origin
            client.postMessage({ type: "notification-click", url: urlToOpen });
            if ("navigate" in client) {
              return client.navigate(urlToOpen).then(() => client.focus());
            }
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});
