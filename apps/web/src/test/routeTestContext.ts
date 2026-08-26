import type { AnyRoute } from "@tanstack/react-router";
import type { ConvexTestHarness } from "@/test/convexTestHarness";

export type RouteTestContext = {
  queryClient: ConvexTestHarness["queryClient"];
  convexPreloader: ConvexTestHarness["convexPreloader"];
  convexQueryClient: ConvexTestHarness["convexQueryClient"];
  convexClient: ConvexTestHarness["convexClient"];
};

export function routeContextFromHarness(harness: ConvexTestHarness): RouteTestContext {
  return {
    queryClient: harness.queryClient,
    convexPreloader: harness.convexPreloader,
    convexQueryClient: harness.convexQueryClient,
    convexClient: harness.convexClient,
  };
}

export async function runRouteBeforeLoad(opts: {
  harness: ConvexTestHarness;
  route: AnyRoute;
  params: Record<string, string>;
}) {
  const beforeLoad = opts.route.options.beforeLoad as
    | ((routeOpts: {
        context: RouteTestContext;
        params: Record<string, string>;
      }) => Promise<unknown>)
    | undefined;
  if (!beforeLoad) {
    return undefined;
  }
  return await beforeLoad({
    context: routeContextFromHarness(opts.harness),
    params: opts.params,
  });
}

export async function runRouteLoader<TLoaderData>(opts: {
  harness: ConvexTestHarness;
  route: AnyRoute;
  params: Record<string, string>;
}) {
  const loader = opts.route.options.loader as
    | ((routeOpts: {
        context: RouteTestContext;
        params: Record<string, string>;
      }) => Promise<TLoaderData>)
    | undefined;
  if (!loader) {
    throw new Error("Route has no loader");
  }
  return await loader({
    context: routeContextFromHarness(opts.harness),
    params: opts.params,
  });
}
