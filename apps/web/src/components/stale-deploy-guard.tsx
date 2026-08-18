import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { api } from "@workspace/convex/convex/_generated/api";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  bindHardNavigation,
  bindStaleReloadTriggers,
  createDeployShaWatch,
} from "@/lib/stale-deploy";
import type { StaleDeployRouter, StaleReloadDocument, StaleReloadWindow } from "@/lib/stale-deploy";

function subscribeNever() {
  return () => {};
}

function clientSnapshot() {
  return true;
}

function serverSnapshot() {
  return false;
}

export function StaleDeployGuard() {
  const router = useRouter();
  const isClient = useSyncExternalStore(subscribeNever, clientSnapshot, serverSnapshot);
  const [watch] = useState(createDeployShaWatch);
  const [isStale, setIsStale] = useState(false);

  const gitShaQuery = useQuery({
    ...convexQuery(api.version.gitSha, {}),
    enabled: isClient,
  });

  useEffect(() => {
    if (!watch.observe(gitShaQuery.data)) {
      return;
    }
    setIsStale(true);
  }, [gitShaQuery.data, watch]);

  useEffect(() => {
    if (!isStale) {
      return;
    }
    return bindHardNavigation(router as unknown as StaleDeployRouter, (href) => {
      window.location.assign(href);
    });
  }, [isStale, router]);

  useEffect(() => {
    if (!isStale) {
      return;
    }
    return bindStaleReloadTriggers({
      reload: () => {
        window.location.reload();
      },
      document: document as StaleReloadDocument,
      window: window as unknown as StaleReloadWindow,
    });
  }, [isStale]);

  return null;
}
