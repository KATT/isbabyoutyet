/**
 * Service-worker notification clicks should reuse the open baby tab (hash
 * ignored) instead of stacking windows. Overlay URLs keep their own tab.
 */
export const NOTIFICATION_CLICK_MESSAGE = "notification-click";

/** @internal Exported for tests; the service worker keeps a copy in `sw.js`. */
export function isBabyOverlayPath(pathname: string) {
  return (
    /\/baby\/[^/]+\/(?:photo|settings|post|share|login)\/?$/.test(pathname) ||
    /\/baby\/[^/]+\/updates\/[^/]+\/photo\/?$/.test(pathname)
  );
}

/** @internal Exported for tests; the service worker keeps a copy in `sw.js`. */
export function shouldReuseBabyClient(opts: { clientUrl: string; targetUrl: string }) {
  const client = new URL(opts.clientUrl);
  const target = new URL(opts.targetUrl);
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
