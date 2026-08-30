import { QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import type { ReactElement, ReactNode } from "react";
import { LocaleProvider } from "@/lib/i18n";
import type { ConvexTestHarness } from "@/test/convexTestHarness";
import { renderResource } from "@/test/renderResource";

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
  return renderResource(
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
}
