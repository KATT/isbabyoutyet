import { QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import type { ReactElement, ReactNode } from "react";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";
import type { ConvexTestHarness } from "@/test/convexTestHarness";

/**
 * Renders under the production Convex + React Query provider stack, backed by
 * `convex-test` instead of stubbed query data.
 */
export function renderWithConvexTest(opts: {
  harness: ConvexTestHarness;
  ui: ReactElement;
  wrap: ((children: ReactNode) => ReactNode) | null;
}) {
  const wrapped = opts.wrap ? opts.wrap(opts.ui) : opts.ui;
  const view = render(
    <QueryClientProvider client={opts.harness.queryClient}>
      <ConvexProvider client={opts.harness.convexClient as unknown as ConvexReactClient}>
        {wrapped}
      </ConvexProvider>
    </QueryClientProvider>,
    {
      wrapper: (wrapperProps) => (
        <LocaleProvider locale="en-GB">{wrapperProps.children}</LocaleProvider>
      ),
    },
  );
  return makeResource(view as RenderResult, () => {
    view.unmount();
  });
}
