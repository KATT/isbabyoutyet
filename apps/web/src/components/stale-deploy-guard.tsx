import { useRouter } from "@tanstack/react-router";
import { api } from "@workspace/convex/convex/_generated/api";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { useEffect, useState } from "react";
import { bindHardNavigation, bindStaleReloadTriggers } from "@/lib/stale-deploy";
import type { StaleDeployRouter, StaleReloadDocument, StaleReloadWindow } from "@/lib/stale-deploy";

type StaleDeployGuardProps = {
  gitSha: PreloadedConvexQuery<typeof api.version.gitSha>;
};

export function StaleDeployGuard(props: StaleDeployGuardProps) {
  const router = useRouter();
  const gitShaQuery = usePreloadedConvexQuery(api.version.gitSha, props.gitSha);
  const [gitShaAtPageLoad] = useState(gitShaQuery.data);
  const isStale = gitShaQuery.data !== gitShaAtPageLoad;

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
