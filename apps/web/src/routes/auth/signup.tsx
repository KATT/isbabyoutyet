import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { authClient, getBrowserAuthHeaders } from "@/lib/auth-client";
import { Input } from "@workspace/ui-cssinjs/components/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui-cssinjs/components/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui-cssinjs/components/form";
import { Form, SubmitButton, useZodForm } from "@/components/Form";
import { Baby, UserPlus } from "@phosphor-icons/react";
import type { TranslationFunction } from "@/lib/i18n";
import { translate, useI18n } from "@/lib/i18n";
import { robotsNoIndexMeta } from "@/lib/seo";
import { authPageCacheHeaders } from "@/lib/cachePolicy";
import { waitForConvexAuth } from "@/lib/convexAuthHandoff";

function signupSchema(t: TranslationFunction) {
  return z.object({
    name: z.string().min(2, t("Name must be at least 2 characters")),
    email: z.string().email(t("Invalid email address")),
    password: z.string().min(6, t("Password must be at least 6 characters")),
  });
}

type NewAccount = { name: string; email: string; password: string };

/**
 * `signUp` reports failure as a message rather than the auth client's own
 * result shape, so the flow below stays independent of better-auth types.
 *
 * @internal Exported for tests.
 */
export type SignUpHandoff = {
  signUp: (
    body: NewAccount,
    fetchOptions: { headers: Record<string, string> },
  ) => Promise<{ errorMessage: string | null }>;
  headers: () => Record<string, string>;
  waitForAuth: () => Promise<void>;
  navigate: () => Promise<void>;
  failedMessage: string;
};

/**
 * Create the account, then wait for the Convex provider to confirm the new
 * identity before navigating — /dashboard would otherwise load against a
 * still anonymous client and bounce back to login.
 *
 * @internal Exported for tests; production wires it up in `SignupPage`.
 */
export async function signUpAndHandoff(values: NewAccount, deps: SignUpHandoff) {
  const result = await deps.signUp(
    { email: values.email, password: values.password, name: values.name },
    { headers: deps.headers() },
  );

  if (result.errorMessage !== null) {
    throw new Error(result.errorMessage || deps.failedMessage);
  }

  await deps.waitForAuth();
  await deps.navigate();
}

export const Route = createFileRoute("/auth/signup")({
  component: SignupPage,
  headers: authPageCacheHeaders,
  head: (opts) => ({
    meta: [
      {
        title: translate(opts.match.context.locale, "Sign up – Is Baby Out Yet?"),
      },
      ...robotsNoIndexMeta(),
    ],
  }),
});

/**
 * Mutable auth adapters so route smoke tests can swap the network-backed
 * better-auth client without `vi.mock`.
 *
 * @internal
 */
export const signupAuthAdapter = {
  signUpEmail: (body: NewAccount, fetchOptions: { headers: Record<string, string> }) =>
    authClient.signUp.email(body, fetchOptions),
  headers: () => getBrowserAuthHeaders(),
  waitForAuth: () => waitForConvexAuth(),
};

/**
 * @internal Exported for smoke tests; production mounts it via `Route`.
 */
export function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <SignupCard
      onSignUp={(values) =>
        signUpAndHandoff(values, {
          signUp: async (body, fetchOptions) => {
            const result = await signupAuthAdapter.signUpEmail(body, fetchOptions);
            return { errorMessage: result.error ? (result.error.message ?? "") : null };
          },
          headers: () => signupAuthAdapter.headers(),
          waitForAuth: () => signupAuthAdapter.waitForAuth(),
          navigate: () => router.navigate({ to: "/dashboard" }),
          failedMessage: t("Failed to sign up"),
        })
      }
    />
  );
}

/**
 * Signup form. Takes the account-creation flow as a prop so tests can render
 * it without an auth client.
 *
 * @internal Exported for tests; production uses `SignupPage`.
 */
export function SignupCard(props: { onSignUp: (values: NewAccount) => Promise<void> }) {
  const { t } = useI18n();

  const form = useZodForm({
    schema: signupSchema(t),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  return (
    <div className="min-h-screen bg-background bg-dots flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border-2 border-border bg-background/85 py-1.5 pl-2 pr-4 shadow-sm transition-transform hover:-rotate-2"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15">
            <Baby className="h-4 w-4 text-primary" />
          </span>
          <span className="text-sm font-extrabold tracking-tight">isbabyoutyet</span>
        </Link>
        <Card className="rounded-[2rem] border-2 pop-shadow-strong">
          <CardHeader className="text-center">
            <p className="text-4xl" aria-hidden="true">
              🎈
            </p>
            <CardTitle className="text-2xl font-black">{t("Join the fun!")}</CardTitle>
            <CardDescription className="font-medium">
              {t("Create an account to share your baby's arrival")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form form={form} handleSubmit={(values) => props.onSignUp(values)}>
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("Your name")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <SubmitButton
                  form="context"
                  IconComponent={UserPlus}
                  iconPosition="start"
                  className="w-full rounded-full font-extrabold pop-shadow"
                  size="lg"
                >
                  {t("Sign Up")}
                </SubmitButton>
              </div>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t("Already have an account?")}{" "}
              <Link
                to="/auth/login"
                className="text-primary hover:text-primary/80 font-medium underline underline-offset-4"
              >
                {t("Sign in")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
