import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import { loadSignedInProfile } from "@/lib/signed-in-profile";

type ProfileCtx = {
  convexClient:
    | { setAuth: (fetchToken: () => Promise<string | null>) => void }
    | Record<string, never>;
  convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
  convexQueryClient: {
    serverHttpClient: { setAuth: (token: string) => void };
  };
  queryClient: QueryClient;
  token: string | null;
};

type ProfileSnapshot = {
  isAdmin: boolean;
  locale: string;
  timeZone: string;
};

function makeProfileCtx() {
  const queryFn = vi.fn<() => Promise<null | ProfileSnapshot>>(() => Promise.resolve(null));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { queryFn, retry: false } },
  });
  const context: ProfileCtx = {
    convexClient: {},
    convexPreloader: getConvexQueryPreloader(queryClient),
    convexQueryClient: { serverHttpClient: { setAuth: vi.fn<(token: string) => void>() } },
    queryClient,
    token: null,
  };
  return { context, queryClient, queryFn };
}

async function load(opts: { context: ProfileCtx; fetchToken: () => Promise<string | null> }) {
  return await loadSignedInProfile({
    // SAFETY: Test fixture is a subset of the production type.
    context: opts.context as Parameters<typeof loadSignedInProfile>[0]["context"],
    fetchToken: opts.fetchToken,
  });
}

test("stale cached anonymous profile with a cookie waits for Convex identity", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("jwt");
  const profile = makeProfileCtx();
  profile.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, null);
  profile.queryFn.mockResolvedValue({
    isAdmin: false,
    locale: "sv",
    timeZone: "Europe/London",
  });

  const result = await load({
    context: profile.context,
    fetchToken,
  });

  expect(result).toMatchObject({
    locale: "sv",
    token: "jwt",
  });
  expect(fetchToken).toHaveBeenCalledTimes(1);
  expect(profile.queryFn).toHaveBeenCalled();
});

test("cached anonymous profile with no cookie bounces without waiting on Convex", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
  const profile = makeProfileCtx();
  profile.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, null);

  const result = await load({
    context: profile.context,
    fetchToken,
  });

  expect(result).toBeNull();
  expect(fetchToken).toHaveBeenCalledTimes(1);
  expect(profile.queryFn).not.toHaveBeenCalled();
});
