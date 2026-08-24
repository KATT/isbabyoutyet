/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useMatches,
  useRouteContext,
  useRouterState,
} from "@tanstack/react-router";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { ConvexQueryPreloader } from "@workspace/convex-prefetch";
import type { QueryClient } from "@tanstack/react-query";
import type { ConvexReactClient } from "convex/react";
import { useConvexAuth } from "convex/react";
import * as React from "react";
import { useEffect, useState } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { AuthClient } from "@convex-dev/better-auth/react";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ThemeProvider } from "next-themes";
import appCss from "../../../../packages/ui/src/styles/globals.css?url";
import typeCss from "@/styles/app.css?url";
import nunitoCss from "@fontsource-variable/nunito/index.css?url";
import { Analytics } from "@vercel/analytics/react";
import { authClient } from "@/lib/auth-client";
import { Progress } from "@workspace/ui/components/progress";
import { Toaster } from "@workspace/ui/components/sonner";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { Baby, IconContext } from "@phosphor-icons/react";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { LocaleProvider, getDetectedLocale, translate, useI18n } from "@/lib/i18n";
import { detectRequestLocale } from "@/lib/detect-locale";
import { aiNoTrainHeaders, aiNoTrainMeta } from "@/lib/robots";
import { DevBar } from "@/components/dev-bar";
import { m } from "@/paraglide/messages";
import { privateCacheHeaders } from "@/lib/cachePolicy";
import { reportConvexAuthState } from "@/lib/convexAuthHandoff";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
  convexClient: ConvexReactClient;
  convexPreloader: ConvexQueryPreloader;
  locale: SupportedLocale;
  isAuthenticated: boolean;
  token: string | null | undefined;
}>()({
  beforeLoad: async () => {
    // SSR: resolve the locale from request headers (PARAGLIDE_LOCALE cookie,
    // then Accept-Language) via the server function.
    if (typeof window === "undefined") {
      return {
        locale: await detectRequestLocale(),
        isAuthenticated: false,
        token: null,
      };
    }
    // Client navigations: zero network. beforeLoad re-runs on EVERY navigation
    // (back button included) and the router blocks on it, so a server-function
    // round-trip here would tax them all — that's what made cached navigations
    // show the top progress bar. Paraglide resolves the same cookie →
    // preferredLanguage chain locally.
    return {
      locale: getDetectedLocale(),
      isAuthenticated: false,
      token: null,
    };
  },
  head: (opts) => {
    const locale = opts.match.context.locale ?? getDetectedLocale();
    const description = translate(
      locale,
      "Track the progress of labour and birth – know when baby arrives!",
    );
    const title = m.app_name({}, { locale });
    return {
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title,
        },
        {
          name: "description",
          content: description,
        },
        {
          property: "og:locale",
          content: locale.replace("-", "_"),
        },
        {
          property: "og:site_name",
          content: title,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "theme-color",
          content: "#ea580c",
        },
        {
          name: "mobile-web-app-capable",
          content: "yes",
        },
        {
          name: "apple-mobile-web-app-capable",
          content: "yes",
        },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "black-translucent",
        },
        ...aiNoTrainMeta(),
      ],
      links: [
        {
          rel: "stylesheet",
          href: nunitoCss,
        },
        {
          rel: "stylesheet",
          href: appCss,
        },
        {
          rel: "stylesheet",
          href: typeCss,
        },
        {
          rel: "apple-touch-icon",
          href: "/apple-touch-icon.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon-32x32.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/favicon-16x16.png",
        },
      ],
    };
  },
  headers() {
    return {
      ...privateCacheHeaders(),
      ...aiNoTrainHeaders(),
    };
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });
  const matches = useMatches();
  const token = matches.reduce<string | null | undefined>((currentToken, match) => {
    const matchContext = match.context as { token: string | null | undefined };
    return matchContext.token ?? currentToken;
  }, context.token);
  const locale = matches.reduce((currentLocale, match) => {
    const matchContext = match.context as { locale: SupportedLocale | undefined };
    return matchContext.locale ?? currentLocale;
  }, context.locale);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {/* Cast: better-auth >=1.6.18 broke assignability to @convex-dev/better-auth's
          AuthClient type (upstream types against better-auth 1.6.15). Runtime is
          compatible per the peer range (>=1.6.11 <1.7.0). */}
      <ConvexBetterAuthProvider
        client={context.convexQueryClient.convexClient}
        authClient={authClient as unknown as AuthClient}
        initialToken={token}
      >
        <ProviderAuthObserver />
        {/* Phosphor icons render in the two-tone "duotone" style app-wide */}
        <IconContext.Provider value={{ weight: "duotone" }}>
          <TooltipProvider>
            <LocaleProvider locale={locale}>
              <RootDocument locale={locale}>
                <Outlet />
              </RootDocument>
            </LocaleProvider>
          </TooltipProvider>
        </IconContext.Provider>
      </ConvexBetterAuthProvider>
    </ThemeProvider>
  );
}

function ProviderAuthObserver() {
  const auth = useConvexAuth();

  useEffect(() => {
    // Better Auth exposes its session before Convex has validated the token.
    // useConvexAuth is the documented server-confirmed signal:
    // https://labs.convex.dev/better-auth/basic-usage/authorization
    reportConvexAuthState({
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
    });
  }, [auth.isAuthenticated, auth.isLoading]);

  return null;
}

// Router-wide error fallback (registered as defaultErrorComponent): residual
// failures — expired sessions, stale deploys, dropped connections — land here
// instead of TanStack's raw default, and a full reload re-resolves everything
// from a clean slate.
export function RootErrorComponent(props: { error: Error }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background bg-dots flex items-center justify-center px-6">
      <div className="text-center space-y-5 max-w-md rounded-[2rem] border-2 border-border bg-card p-10 pop-shadow">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20">
          <Baby className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-black text-foreground">{t("Something went wrong")}</h1>
        <p className="text-muted-foreground font-medium">
          {t("An unexpected error occurred. Reloading usually fixes it.")}
        </p>
        {import.meta.env.DEV ? (
          <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {props.error.message}
          </pre>
        ) : null}
        <div className="flex justify-center gap-3">
          <Button
            size="lg"
            className="rounded-full"
            onClick={() => {
              window.location.reload();
            }}
          >
            {t("Reload page")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full"
            render={<Link to="/" />}
            nativeButton={false}
          >
            {t("Go Home")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background bg-dots flex items-center justify-center px-6">
      <div className="text-center space-y-5 max-w-md rounded-[2rem] border-2 border-border bg-card p-10 pop-shadow">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20">
          <Baby className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-6xl font-black text-foreground">404</h1>
        <h2 className="text-2xl font-black text-foreground">{t("Not arrived yet!")}</h2>
        <p className="text-muted-foreground font-medium">
          {t("Looks like this page hasn't arrived yet. Let's get you back home!")}
        </p>
        <Button size="lg" className="rounded-full" render={<Link to="/" />} nativeButton={false}>
          {t("Go Home")}
        </Button>
      </div>
    </div>
  );
}

// The router flips isLoading true on every navigation — including instant
// ones served entirely from the React Query cache — so an undelayed bar
// flashes on every click and makes fast navigations look slow. Only show it
// once loading has persisted past this threshold (same idea as TanStack's
// defaultPendingMs for pending components).
export const NAVIGATION_PROGRESS_DELAY_MS = 200;

// Global pending indicator: the URL updates immediately on navigation, but on
// slow connections the next page's chunks/loaders can take a while — without
// this the app looks frozen. SPAs can't trigger the browser's native loading
// indicator, so we show a top progress bar while the router is loading.
// value={null} puts Progress in its indeterminate (sweeping) state.
export function NavigationProgress() {
  const { t } = useI18n();
  const isNavigating = useRouterState({ select: (state) => state.isLoading });
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    // Show only after the delay; hide on the next tick (a 0ms timeout keeps
    // the setState out of the synchronous effect body).
    const delay = setTimeout(
      () => {
        setShowBar(isNavigating);
      },
      isNavigating ? NAVIGATION_PROGRESS_DELAY_MS : 0,
    );
    return () => {
      clearTimeout(delay);
    };
  }, [isNavigating]);

  if (!showBar) {
    return null;
  }
  return (
    <Progress
      value={null}
      aria-label={t("Loading")}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50",
        "[&_[data-slot=progress-indicator]]:w-1/4 [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-indicator]]:animate-progress-indeterminate",
        "motion-reduce:[&_[data-slot=progress-indicator]]:w-full motion-reduce:[&_[data-slot=progress-indicator]]:animate-none",
      )}
    />
  );
}

function RootDocument(props: { children: React.ReactNode; locale: SupportedLocale }) {
  return (
    <html lang={props.locale} dir="ltr">
      <head>
        <HeadContent />
      </head>
      <body>
        <NavigationProgress />
        {props.children}
        <DevBar />
        <Toaster />
        <Analytics />
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
