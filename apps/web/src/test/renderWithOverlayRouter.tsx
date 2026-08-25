import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";
import { vi } from "vitest";

/**
 * Renders UI under a real TanStack memory router with history shaped for
 * overlay dismiss tests: either a push entry marked `state.overlay` (so
 * dismiss prefers `history.back()`) or a replace entry (so dismiss falls
 * back to `navigate(closeLink)`).
 */
export async function renderWithOverlayRouter(opts: {
  ui: ReactElement;
  /** When true, push an overlay history entry so dismiss uses history.back(). */
  overlayPush: boolean;
  /** Extra providers (e.g. QueryClientProvider) wrapped around `ui`. */
  wrap: ((children: ReactNode) => ReactNode) | null;
}) {
  const history = createMemoryHistory({ initialEntries: ["/baby/baby-smith"] });
  if (opts.overlayPush) {
    history.push("/overlay", { overlay: true });
  } else {
    history.replace("/overlay");
  }

  const wrapped = opts.wrap ? opts.wrap(opts.ui) : opts.ui;

  const rootRoute = createRootRoute({
    component: function TestRoot() {
      return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>
            <LocaleProvider locale="en-GB">{wrapped}</LocaleProvider>
          </TooltipProvider>
        </ThemeProvider>
      );
    },
  });

  const router = createRouter({
    routeTree: rootRoute,
    history,
    defaultPendingMinMs: 0,
  });

  await router.load();

  const navigate = vi.spyOn(router, "navigate");
  const back = vi.spyOn(history, "back");
  const view = render(<RouterProvider router={router} />);

  return makeResource({ view, router, history, navigate, back }, () => {
    navigate.mockRestore();
    back.mockRestore();
    view.unmount();
  });
}
