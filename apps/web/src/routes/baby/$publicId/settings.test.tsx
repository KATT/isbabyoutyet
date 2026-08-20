import { QueryClient } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { expect, test } from "vitest";

const routeModule = await import("@/routes/baby/$publicId/settings");

function makeLoaderQueryClient(handlers: Record<string, unknown>) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: (ctx) => {
          const name = String(ctx.queryKey[1]);
          return Promise.resolve(handlers[name] ?? null);
        },
      },
    },
  });
}

async function runSettingsLoader(handlers: Record<string, unknown>) {
  const queryClient = makeLoaderQueryClient(handlers);
  const loader = routeModule.Route.options.loader as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<Record<string, unknown>>;
  return await loader({
    context: {
      queryClient,
      convexPreloader: getConvexQueryPreloader(queryClient),
    },
    params: { publicId: "baby-smith" },
  });
}

test("settings loader fetches only manager settings data", async () => {
  const result = await runSettingsLoader({
    "baby:getManagerBaby": { _id: "baby-id", name: "Baby Smith" },
    "coParents:myAccess": { canManage: true, isOwner: true },
    "coParents:listForBaby": { coParents: [], invites: [] },
    "profile:get": { locale: "en-GB" },
  });

  expect(result.managerBaby).toMatchObject({
    input: { babyId: "baby-smith" },
    initialData: { name: "Baby Smith" },
  });
  expect(result.coParentsList).toMatchObject({
    input: { babyId: "baby-smith" },
    initialData: { coParents: [], invites: [] },
  });
  expect(result.profile).toMatchObject({
    initialData: { locale: "en-GB" },
  });
});

test("settings loader redirects non-managers to the public baby page", async () => {
  await expect(
    runSettingsLoader({
      "baby:getManagerBaby": "forbidden",
      "coParents:myAccess": { canManage: false, isOwner: false },
      "coParents:listForBaby": "forbidden",
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
    },
  });
});
