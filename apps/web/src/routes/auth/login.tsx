import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { authClient, getBrowserAuthHeaders } from "@/lib/auth-client";
import { Input } from "@workspace/ui/components/input";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Form, SubmitButton, useZodForm } from "@/components/Form";
import { Baby, SignIn } from "@phosphor-icons/react";
import { DEMO_USER } from "@workspace/convex/src/seedCredentials";
import { DemoAccountPicker } from "@/components/demo-account-picker";
import { hasDemoLogin } from "@/lib/has-demo-login";
import type { TranslationFunction } from "@/lib/i18n";
import { translate, useI18n } from "@/lib/i18n";
import { robotsNoIndexMeta } from "@/lib/seo";
import { authPageCacheHeaders } from "@/lib/cachePolicy";
import { waitForConvexAuth } from "@/lib/convexAuthHandoff";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  page: {
    alignItems: "center",
    backgroundColor: colors.background,
    backgroundImage: `radial-gradient(color-mix(in oklab, ${colors.border} 80%, transparent) 1.5px, transparent 1.5px)`,
    backgroundSize: "22px 22px",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: spacing.s6,
  },
  column: {
    maxWidth: "28rem",
    width: "100%",
  },
  brandLink: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.background} 85%, transparent)`,
    borderColor: colors.border,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    display: "flex",
    gap: spacing.s2,
    marginBottom: spacing.s6,
    marginInline: "auto",
    paddingBlock: spacing.s1_5,
    paddingInlineEnd: spacing.s4,
    paddingInlineStart: spacing.s2,
    textDecoration: "none",
    transition: "transform 0.15s ease",
    width: "fit-content",
    ":hover": {
      transform: "rotate(-2deg)",
    },
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderRadius: "9999px",
    color: colors.primary,
    display: "flex",
    height: "1.75rem",
    justifyContent: "center",
    width: "1.75rem",
  },
  brandName: {
    color: colors.foreground,
    fontSize: "0.875rem",
    fontWeight: 800,
    letterSpacing: "-0.025em",
  },
  emoji: {
    fontSize: "2.25rem",
    lineHeight: "2.5rem",
    margin: 0,
  },
  formFields: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s5,
    width: "100%",
  },
  submitHost: {
    display: "grid",
    width: "100%",
  },
  footer: {
    marginTop: spacing.s6,
    textAlign: "center",
  },
  footerLink: {
    color: {
      ":hover": `color-mix(in oklab, ${colors.primary} 80%, transparent)`,
      default: colors.primary,
    },
    fontWeight: 500,
    textDecorationLine: "underline",
    textUnderlineOffset: "4px",
  },
});

function loginSchema(t: TranslationFunction) {
  return z.object({
    email: z.string().email(t("Invalid email address")),
    password: z.string().min(6, t("Password must be at least 6 characters")),
  });
}

type Credentials = { email: string; password: string };

/**
 * `signIn` reports failure as a message rather than the auth client's own
 * result shape, so the flow below stays independent of better-auth types.
 *
 * @internal Exported for tests.
 */
export type SignInHandoff = {
  signIn: (
    body: Credentials & { rememberMe: boolean },
    fetchOptions: { headers: Record<string, string> },
  ) => Promise<{ errorMessage: string | null }>;
  headers: () => Record<string, string>;
  waitForAuth: () => Promise<void>;
  navigate: () => Promise<void>;
  failedMessage: string;
};

/**
 * Sign in, then wait for the Convex provider to confirm the new identity
 * before navigating — /dashboard would otherwise load against a still
 * anonymous client and bounce straight back here.
 *
 * @internal Exported for tests; production wires it up in `LoginPage`.
 */
export async function signInAndHandoff(values: Credentials, deps: SignInHandoff) {
  const result = await deps.signIn(
    { email: values.email, password: values.password, rememberMe: true },
    { headers: deps.headers() },
  );

  if (result.errorMessage !== null) {
    throw new Error(result.errorMessage || deps.failedMessage);
  }

  await deps.waitForAuth();
  await deps.navigate();
}

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
  headers: authPageCacheHeaders,
  head: (opts) => ({
    meta: [
      {
        title: translate(opts.match.context.locale, "Log in – Is Baby Out Yet?"),
      },
      ...robotsNoIndexMeta(),
    ],
  }),
});

/**
 * Mutable auth adapters so route smoke tests can swap the network-backed
 * better-auth client without `vi.mock` (its methods are Proxy-backed and
 * not spyable).
 *
 * @internal
 */
export const loginAuthAdapter = {
  signInEmail: (
    body: Credentials & { rememberMe: boolean },
    fetchOptions: { headers: Record<string, string> },
  ) => authClient.signIn.email(body, fetchOptions),
  headers: () => getBrowserAuthHeaders(),
  waitForAuth: () => waitForConvexAuth(),
};

/**
 * @internal Exported for smoke tests; production mounts it via `Route`.
 */
export function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <LoginCard
      demoLoginEnabled={hasDemoLogin}
      onSignIn={(values) =>
        signInAndHandoff(values, {
          signIn: async (body, fetchOptions) => {
            const result = await loginAuthAdapter.signInEmail(body, fetchOptions);
            return { errorMessage: result.error ? (result.error.message ?? "") : null };
          },
          headers: () => loginAuthAdapter.headers(),
          waitForAuth: () => loginAuthAdapter.waitForAuth(),
          navigate: () => router.navigate({ to: "/dashboard" }),
          failedMessage: t("Failed to sign in"),
        })
      }
    />
  );
}

/**
 * Login form and its demo-account prefill. Takes the sign-in flow as a prop so
 * tests can render it without an auth client.
 *
 * @internal Exported for tests; production uses `LoginPage`.
 */
export function LoginCard(props: {
  demoLoginEnabled: boolean;
  onSignIn: (values: Credentials) => Promise<void>;
}) {
  const { t } = useI18n();

  const form = useZodForm({
    schema: loginSchema(t),
    defaultValues: props.demoLoginEnabled
      ? {
          email: DEMO_USER.email,
          password: DEMO_USER.password,
        }
      : {
          email: "",
          password: "",
        },
  });

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.column)}>
        <Link to="/" {...stylex.props(styles.brandLink)}>
          <span {...stylex.props(styles.brandMark)}>
            <Baby size={16} />
          </span>
          <span {...stylex.props(styles.brandName)}>isbabyoutyet</span>
        </Link>
        <Card emphasis>
          <CardHeader>
            <Stack gap="s1_5" align="center" fullWidth>
              <p {...stylex.props(styles.emoji)} aria-hidden="true">
                👋
              </p>
              <Text as="h2" size="2xl" weight="black" align="center">
                {t("Welcome back!")}
              </Text>
              <Text tone="muted" weight="medium" align="center" size="sm">
                {t("Sign in to keep everyone in the loop")}
              </Text>
            </Stack>
          </CardHeader>
          <CardContent>
            <DemoAccountPicker
              enabled={props.demoLoginEnabled}
              onPrefill={(account) => {
                form.setValue("email", account.email);
                form.setValue("password", account.password);
                form.formRef.current?.requestSubmit();
              }}
            />
            <Form form={form} handleSubmit={(values) => props.onSignIn(values)}>
              <div {...stylex.props(styles.formFields)}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Email")}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Password")}</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div {...stylex.props(styles.submitHost)}>
                  <SubmitButton
                    form="context"
                    IconComponent={SignIn}
                    iconPosition="start"
                    size="lg"
                    shape="pill"
                  >
                    {t("Sign In")}
                  </SubmitButton>
                </div>
              </div>
            </Form>

            <div {...stylex.props(styles.footer)}>
              <Text as="span" size="sm" tone="muted">
                {t("Don't have an account?")}{" "}
              </Text>
              <Link to="/auth/signup" {...stylex.props(styles.footerLink)}>
                {t("Sign up")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
