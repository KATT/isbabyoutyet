/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from "@tanstack/react-router";
import type { ConvexReactClient } from "convex/react";
import * as React from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ThemeProvider } from "next-themes";
import appCss from "../styles.css?url";
import { authClient } from "@/lib/auth-client";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{
  convexClient: ConvexReactClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "description",
        content: "Track the progress of labor and birth - know when baby arrives!",
      },
      {
        name: "theme-color",
        content: "#ea580c",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ConvexBetterAuthProvider client={context.convexClient} authClient={authClient}>
        <RootDocument>
          <Outlet />
        </RootDocument>
      </ConvexBetterAuthProvider>
    </ThemeProvider>
  );
}

function RootDocument(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {props.children}
        <Toaster />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
