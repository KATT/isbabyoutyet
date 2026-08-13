import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { makeResource } from "@workspace/convex/convex/test.resource";

/**
 * Render UI under a real TanStack memory router (and theme/tooltip providers)
 * so `Link` / `ModeToggle` work without `vi.mock`.
 *
 * Returns a promise: the router resolves its initial match asynchronously,
 * so callers must `await` this before asserting on the rendered output.
 */
export async function renderWithTestRouter(ui: ReactElement) {
  const rootRoute = createRootRoute({
    component: function TestRoot() {
      return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>{ui}</TooltipProvider>
        </ThemeProvider>
      );
    },
  });

  // Register the paths tests link to so typed `Link` resolves at runtime.
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/auth/login" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/auth/signup" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/dashboard" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/dashboard/add" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/baby/$publicId" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/preview" }),
  ]);

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultPendingMinMs: 0,
  });

  // Resolve the initial match before rendering so the first paint isn't the
  // (empty) pending fallback.
  await router.load();

  const view = render(<RouterProvider router={router} />);
  return makeResource(view, () => {
    view.unmount();
  });
}
