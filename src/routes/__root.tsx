/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
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
import { Button } from "@/components/ui/button";
import { Baby } from "lucide-react";

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
  notFoundComponent: NotFoundComponent,
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

function NotFoundComponent() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 mb-4">
          <Baby className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-6xl font-black text-foreground">404</h1>
        <h2 className="text-2xl font-bold text-foreground">Page Not Found</h2>
        <p className="text-muted-foreground">
          Looks like this page hasn't arrived yet. Let's get you back home!
        </p>
        <Button size="lg" asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    </div>
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
