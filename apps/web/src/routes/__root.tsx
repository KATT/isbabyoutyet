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
import type { ConvexReactClient } from "convex/react";
import * as React from "react";
import { useEffect } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { AuthClient } from "@convex-dev/better-auth/react";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
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
import { Baby, IconContext } from "@phosphor-icons/react";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { LocaleProvider, getDetectedLocale, translate, useI18n } from "@/lib/i18n";
import { detectRequestLocale } from "@/lib/detect-locale";
import { aiNoTrainHeaders, aiNoTrainMeta } from "@/lib/robots";
import { DevBar } from "@/components/dev-bar";
import { m } from "@/paraglide/messages";

export const Route = createRootRouteWithContext<{
  convexClient: ConvexReactClient;
  locale: SupportedLocale;
}>()({
  beforeLoad: async () => {
    // SSR detects the locale from request headers. Client navigations resolve
    // the same cookie → preferred-language chain locally — beforeLoad runs on
    // every navigation (back button included), so a server round-trip here
    // would tax them all.
    if (typeof window === "undefined") {
      return { locale: await detectRequestLocale() };
    }
    return { locale: getDetectedLocale() };
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
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=86400",
      Vary: "Accept-Language, Cookie",
      ...aiNoTrainHeaders(),
    };
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });
  const matches = useMatches();
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
        client={context.convexClient}
        authClient={authClient as unknown as AuthClient}
      >
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

function NotFoundComponent() {
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

// Global pending indicator: the URL updates immediately on navigation, but on
// slow connections the next page's chunks/loaders can take a while — without
// this the app looks frozen. SPAs can't trigger the browser's native loading
// indicator, so we show a top progress bar while the router is loading.
// value={null} puts Progress in its indeterminate (sweeping) state; the
// delayed fade-in keeps fast navigations from flashing it.
export function NavigationProgress() {
  const { t } = useI18n();
  const isNavigating = useRouterState({ select: (state) => state.isLoading });

  if (!isNavigating) {
    return null;
  }
  return (
    <Progress
      value={null}
      aria-label={t("Loading")}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 opacity-0 animate-appear-delayed"
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
