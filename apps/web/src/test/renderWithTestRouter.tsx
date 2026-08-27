import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@workspace/ui-cssinjs/components/tooltip";
import { makeResource } from "@workspace/convex/convex/test.resource";

/**
 * Render UI under a real TanStack memory router (and theme/tooltip providers)
 * so `Link` / `ModeToggle` work without `vi.mock`.
 *
 * Returns a promise: the router resolves its initial match asynchronously,
 * so callers must `await` this before asserting on the rendered output.
 *
 * A single root route is enough — `Link` still builds the correct `href`
 * from `to` / `params` without registering every destination path, and
 * components reading `useRouterState().location` see `opts.path`.
 *
 * The returned view carries the `router`, so tests that assert on
 * location-derived UI can navigate instead of re-rendering.
 */
export async function renderWithTestRouter(ui: ReactElement, opts = { path: "/" }) {
  const rootRoute = createRootRoute({
    component: function TestRoot() {
      return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>{ui}</TooltipProvider>
        </ThemeProvider>
      );
    },
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [opts.path] }),
    defaultPendingMinMs: 0,
  });

  // Resolve the initial match before rendering so the first paint isn't the
  // (empty) pending fallback.
  await router.load();

  const view = render(<RouterProvider router={router} />);
  return makeResource(Object.assign(view, { router }), () => {
    view.unmount();
  });
}
