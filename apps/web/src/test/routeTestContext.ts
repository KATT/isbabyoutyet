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

/** beforeLoad may enrich context, return nothing, or throw (redirect/notFound). */
type RouteBeforeLoadResult = object | void | null;

export async function runRouteBeforeLoad(opts: {
  harness: ConvexTestHarness;
  route: AnyRoute;
  params: Record<string, string>;
}) {
  // SAFETY: Test fixture is a subset of the production type.
  const beforeLoad = opts.route.options.beforeLoad as
    | ((routeOpts: {
        context: RouteTestContext;
        params: Record<string, string>;
      }) => Promise<RouteBeforeLoadResult>)
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
  // SAFETY: Test fixture is a subset of the production type.
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
