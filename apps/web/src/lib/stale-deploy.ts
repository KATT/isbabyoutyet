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

/**
 * Remembers the first non-empty deploy hash seen in this JS context (a full
 * document load). Later hashes from Convex mean a new deploy is live.
 */
export function createDeployShaWatch() {
  let shaAtPageLoad: string | null = null;

  return {
    observe(liveSha: string | null | undefined) {
      if (liveSha == null || liveSha === "") {
        return false;
      }
      if (shaAtPageLoad == null) {
        shaAtPageLoad = liveSha;
        return false;
      }
      return liveSha !== shaAtPageLoad;
    },
  };
}

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
