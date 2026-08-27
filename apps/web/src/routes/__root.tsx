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
import * as React from "react";
import * as stylex from "@stylexjs/stylex";
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
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";
import { Baby, IconContext } from "@phosphor-icons/react";
import type { SupportedLocale } from "@workspace/convex/src/i18n";
import { LocaleProvider, getDetectedLocale, translate, useI18n } from "@/lib/i18n";
import { detectRequestLocale } from "@/lib/detect-locale";
import { DevBar } from "@/components/dev-bar";
import { m } from "@/paraglide/messages";
import "@/lib/register-service-worker";
import "@/lib/stylex-dev";
import { privateCacheHeaders } from "@/lib/cachePolicy";
import { ConvexAuthObserver } from "@/lib/convexAuthHandoff";
import { useDelayedBoolean } from "@/lib/use-delayed-action";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { Inline } from "@workspace/ui-patterns/components/inline";

/** Same gate as `hasDemoLogin` — inlined so Vite can DCE `DevBar` in prod. */
const showDevBar = import.meta.env.DEV || import.meta.env.VITE_HAS_DEMO_LOGIN === "true";

const styles = stylex.create({
  page: {
    minHeight: "100vh",
    backgroundColor: colors.background,
    backgroundImage: `radial-gradient(color-mix(in oklab, ${colors.border} 80%, transparent) 1.5px, transparent 1.5px)`,
    backgroundSize: "22px 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingInline: spacing.s6,
  },
  card: {
    textAlign: "center",
    maxWidth: "28rem",
    borderRadius: "2rem",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.s10,
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
  },
  iconWell: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "5rem",
    height: "5rem",
    borderRadius: "9999px",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: `color-mix(in oklab, ${colors.primary} 20%, transparent)`,
  },
  babyIcon: {
    width: "2.5rem",
    height: "2.5rem",
    color: colors.primary,
  },
  notFoundCode: {
    margin: 0,
    fontSize: "3.75rem",
    lineHeight: 1,
    fontWeight: 900,
    color: colors.foreground,
  },
  errorPre: {
    maxHeight: "10rem",
    overflow: "auto",
    borderRadius: "0.5rem",
    backgroundColor: colors.muted,
    padding: spacing.s3,
    textAlign: "left",
    fontSize: "0.75rem",
    lineHeight: "1rem",
    color: colors.mutedForeground,
    margin: 0,
  },
});

/**
 * Root `beforeLoad` with locale detection injected so tests can drive the SSR
 * branch without mocking `createServerFn` / `detectRequestLocale`.
 *
 * @internal exported for tests
 */
export async function resolveRootBeforeLoad(opts: {
  detectLocale: () => Promise<SupportedLocale>;
  getClientLocale: () => SupportedLocale;
}) {
  // SSR: resolve the locale from request headers (PARAGLIDE_LOCALE cookie,
  // then Accept-Language) via the server function.
  if (typeof window === "undefined") {
    return {
      locale: await opts.detectLocale(),
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
    locale: opts.getClientLocale(),
    isAuthenticated: false,
    token: null,
  };
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
  convexClient: ConvexReactClient;
  convexPreloader: ConvexQueryPreloader;
  locale: SupportedLocale;
  isAuthenticated: boolean;
  token: string | null | undefined;
}>()({
  beforeLoad: async () =>
    await resolveRootBeforeLoad({
      detectLocale: detectRequestLocale,
      getClientLocale: getDetectedLocale,
    }),
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
      ],
      links: [
        // StyleX unplugin serves aggregated atomic CSS here in Vite serve.
        // TanStack Start SSR skips transformIndexHtml, so link it explicitly.
        ...(import.meta.env.DEV
          ? ([
              {
                rel: "stylesheet",
                href: "/virtual:stylex.css",
              },
            ] as const)
          : []),
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
    return privateCacheHeaders();
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
        <ConvexAuthObserver />
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

// Router-wide error fallback (registered as defaultErrorComponent): residual
// failures — expired sessions, stale deploys, dropped connections — land here
// instead of TanStack's raw default, and a full reload re-resolves everything
// from a clean slate.
export function RootErrorComponent(props: { error: Error }) {
  const { t } = useI18n();
  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.card)}>
        <Stack gap="s5" align="center">
          <span {...stylex.props(styles.iconWell)}>
            <Baby {...stylex.props(styles.babyIcon)} />
          </span>
          <Text as="h1" size="2xl" weight="black">
            {t("Something went wrong")}
          </Text>
          <Text tone="muted" weight="medium">
            {t("An unexpected error occurred. Reloading usually fixes it.")}
          </Text>
          {import.meta.env.DEV ? (
            <pre {...stylex.props(styles.errorPre)}>{props.error.message}</pre>
          ) : null}
          <Inline gap="s3" justify="center">
            <Button
              size="lg"
              shape="pill"
              onClick={() => {
                window.location.reload();
              }}
            >
              {t("Reload page")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              shape="pill"
              render={<Link to="/" />}
              nativeButton={false}
            >
              {t("Go Home")}
            </Button>
          </Inline>
        </Stack>
      </div>
    </div>
  );
}

export function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.card)}>
        <Stack gap="s5" align="center">
          <span {...stylex.props(styles.iconWell)}>
            <Baby {...stylex.props(styles.babyIcon)} />
          </span>
          <h1 {...stylex.props(styles.notFoundCode)}>404</h1>
          <Text as="h2" size="2xl" weight="black">
            {t("Not arrived yet!")}
          </Text>
          <Text tone="muted" weight="medium">
            {t("Looks like this page hasn't arrived yet. Let's get you back home!")}
          </Text>
          <Button size="lg" shape="pill" render={<Link to="/" />} nativeButton={false}>
            {t("Go Home")}
          </Button>
        </Stack>
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
export function NavigationProgress() {
  const isNavigating = useRouterState({ select: (state) => state.isLoading });
  return <NavigationProgressBar isNavigating={isNavigating} />;
}

/**
 * Presentational progress bar. `isNavigating` is a prop so tests can drive the
 * delay/hide behaviour without mocking `useRouterState`.
 *
 * @internal exported for tests
 */
export function NavigationProgressBar(props: { isNavigating: boolean }) {
  const { t } = useI18n();
  const showBar = useDelayedBoolean({
    value: props.isNavigating,
    delayMs: NAVIGATION_PROGRESS_DELAY_MS,
  });

  if (!showBar) {
    return null;
  }
  return <Progress value={null} placement="navigation" aria-label={t("Loading")} />;
}

/** @internal exported for tests — document shell without Convex/auth providers. */
export function RootDocument(props: { children: React.ReactNode; locale: SupportedLocale }) {
  return (
    <html lang={props.locale} dir="ltr">
      <head>
        <HeadContent />
      </head>
      <body>
        <NavigationProgress />
        {props.children}
        {/* Inlined env gate (not `hasDemoLogin`) so Vite DCE drops DevBar in prod. */}
        {showDevBar ? <DevBar /> : null}
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
