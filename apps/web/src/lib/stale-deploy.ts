type StaleDeployNavigateEvent = {
  hrefChanged: boolean;
  toLocation: {
    href: string;
  };
};

export type StaleDeployRouter = {
  subscribe: (
    eventName: "onBeforeNavigate",
    listener: (event: StaleDeployNavigateEvent) => void,
  ) => () => void;
};

export type StaleReloadDocument = {
  visibilityState: string;
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
};

export type StaleReloadWindow = {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
};

export function bindHardNavigation(
  router: StaleDeployRouter,
  assignLocation: (href: string) => void,
) {
  return router.subscribe("onBeforeNavigate", (event) => {
    if (!event.hrefChanged) {
      return;
    }
    assignLocation(event.toLocation.href);
  });
}

export function bindStaleReloadTriggers(opts: {
  reload: () => void;
  document: StaleReloadDocument;
  window: StaleReloadWindow;
}) {
  const onVisibilityChange = () => {
    if (opts.document.visibilityState === "visible") {
      opts.reload();
    }
  };
  const onPageShow = (event: Event) => {
    if ("persisted" in event && event.persisted === true) {
      opts.reload();
    }
  };
  opts.document.addEventListener("visibilitychange", onVisibilityChange);
  opts.window.addEventListener("pageshow", onPageShow);
  return () => {
    opts.document.removeEventListener("visibilitychange", onVisibilityChange);
    opts.window.removeEventListener("pageshow", onPageShow);
  };
}
