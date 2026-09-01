import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { authClient, getBrowserAuthHeaders } from "@/lib/auth-client";
import { Input } from "@workspace/ui/components/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
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
import {
  babyLoginHomeLink,
  babyLoginSuccessTarget,
  loginRedirectQuery,
} from "@/lib/baby-login-redirect";
import { waitForConvexAuth } from "@/lib/convexAuthHandoff";

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
  failedMessage: string;
  headers: () => Record<string, string>;
  navigate: () => Promise<void>;
  signIn: (
    body: Credentials & { rememberMe: boolean },
    fetchOptions: { headers: Record<string, string> },
  ) => Promise<{ errorMessage: string | null }>;
  waitForAuth: () => Promise<void>;
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
  head: (opts) => ({
    meta: [
      {
        title: translate(opts.match.context.locale, "Log in – Is Baby Out Yet?"),
      },
      ...robotsNoIndexMeta(),
    ],
  }),
  headers: authPageCacheHeaders,
  validateSearch: z.object({
    redirect: z.string().optional(),
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
  headers: () => getBrowserAuthHeaders(),
  signInEmail: (
    body: Credentials & { rememberMe: boolean },
    fetchOptions: { headers: Record<string, string> },
  ) => authClient.signIn.email(body, fetchOptions),
  waitForAuth: () => waitForConvexAuth(),
};

/**
 * @internal Exported for smoke tests; production mounts it via `Route`.
 */
export function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const redirect = loginRedirectQuery(router.state.location.searchStr);
  const homeLink = babyLoginHomeLink(redirect);
  const successTarget = babyLoginSuccessTarget(redirect);

  return (
    <LoginCard
      demoLoginEnabled={hasDemoLogin}
      homeLink={homeLink}
      onSignIn={(values) =>
        signInAndHandoff(values, {
          failedMessage: t("Failed to sign in"),
          headers: () => loginAuthAdapter.headers(),
          navigate: () => router.navigate(successTarget),
          signIn: async (body, fetchOptions) => {
            const result = await loginAuthAdapter.signInEmail(body, fetchOptions);
            return { errorMessage: result.error ? (result.error.message ?? "") : null };
          },
          waitForAuth: () => loginAuthAdapter.waitForAuth(),
        })
      }
      variant="page"
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
  homeLink: { to: "/" } | { params: { publicId: string }; to: "/baby/$publicId" };
  onSignIn: (values: Credentials) => Promise<void>;
  variant: "page" | "dialog";
}) {
  const { t } = useI18n();

  const form = useZodForm({
    defaultValues: props.demoLoginEnabled
      ? {
          email: DEMO_USER.email,
          password: DEMO_USER.password,
        }
      : {
          email: "",
          password: "",
        },
    schema: loginSchema(t),
  });

  const card = (
    <Card
      className={
        props.variant === "dialog"
          ? "border-0 shadow-none"
          : "rounded-[2rem] border-2 pop-shadow-strong"
      }
    >
      <CardHeader className="text-center">
        <p aria-hidden="true" className="text-4xl">
          👋
        </p>
        <CardTitle className="text-2xl font-black">{t("Welcome back!")}</CardTitle>
        <CardDescription className="font-medium">
          {t("Sign in to keep everyone in the loop")}
        </CardDescription>
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
          <div className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Email")}</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" type="email" {...field} />
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

            <SubmitButton
              className="w-full rounded-full font-extrabold pop-shadow"
              form="context"
              IconComponent={SignIn}
              iconPosition="start"
              size="lg"
            >
              {t("Sign In")}
            </SubmitButton>
          </div>
        </Form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {t("Don't have an account?")}{" "}
          <Link
            className="text-primary hover:text-primary/80 font-medium underline underline-offset-4"
            to="/auth/signup"
          >
            {t("Sign up")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );

  if (props.variant === "dialog") {
    return card;
  }

  return (
    <div className="min-h-screen bg-background bg-dots flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          {...props.homeLink}
          className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border-2 border-border bg-background/85 py-1.5 pl-2 pr-4 shadow-sm transition-transform hover:-rotate-2"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
            <Baby className="h-4 w-4 text-primary" />
          </span>
          <span className="text-sm font-extrabold tracking-tight">isbabyoutyet</span>
        </Link>
        {card}
      </div>
    </div>
  );
}
