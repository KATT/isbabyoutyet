import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, EnvelopeSimple, Key, User } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { Form, FormGuardProvider, SubmitButton, useFormGuard, useZodForm } from "@/components/Form";
import { authClient } from "@/lib/auth-client";
import type { TranslationFunction } from "@/lib/i18n";
import { translate, useI18n } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/site-url";

export const PROFILE_NOTICES = [
  "email-change-sent",
  "name",
  "password",
  "verified",
  "verify-sent",
] as const;

export type ProfileNotice = (typeof PROFILE_NOTICES)[number];

const profileSearchSchema = z.object({
  notice: z.enum(PROFILE_NOTICES).optional(),
});

export function profileNoticeMessage(notice: ProfileNotice, t: TranslationFunction) {
  switch (notice) {
    case "email-change-sent":
      return t("Check your inbox to confirm the new address.");
    case "name":
      return t("Your name has been updated.");
    case "password":
      return t("Your password has been updated.");
    case "verified":
      return t("Your email is now verified.");
    case "verify-sent":
      return t("Check your inbox to verify this email.");
    default: {
      const _exhaustive: never = notice;
      return _exhaustive;
    }
  }
}

export type ProfileAuthResult = {
  errorMessage: string | null;
};

/**
 * @internal Exported for tests; production wires it in `ProfilePage`.
 */
export async function completeProfileAuthAction(
  result: ProfileAuthResult,
  opts: { failedMessage: string; onSuccess: () => Promise<void> },
) {
  if (result.errorMessage !== null) {
    throw new Error(result.errorMessage || opts.failedMessage);
  }
  await opts.onSuccess();
}

function nameSchema(t: TranslationFunction) {
  return z.object({
    name: z.string().trim().min(2, t("Name must be at least 2 characters")),
  });
}

function passwordSchema(t: TranslationFunction) {
  return z
    .object({
      confirmPassword: z.string(),
      currentPassword: z.string().min(1, t("Current password is required.")),
      newPassword: z.string().min(8, t("Password must be at least 8 characters")),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: t("Passwords do not match"),
      path: ["confirmPassword"],
    });
}

function changeEmailSchema(t: TranslationFunction, currentEmail: string) {
  return z
    .object({
      newEmail: z.string().trim().email(t("Invalid email address")),
    })
    .refine((values) => values.newEmail.toLowerCase() !== currentEmail.toLowerCase(), {
      message: t("Choose a different email address."),
      path: ["newEmail"],
    });
}

export type ProfileUser = {
  email: string;
  emailVerified: boolean;
  name: string;
};

export type ProfilePageHandlers = {
  onChangeEmail: (values: { newEmail: string }) => Promise<void>;
  onChangePassword: (values: {
    confirmPassword: string;
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
  onSendVerification: () => Promise<void>;
  onUpdateName: (values: { name: string }) => Promise<void>;
};

export type ProfileSessionSnapshot = {
  data: { user: ProfileUser } | null;
};

/**
 * Maps a Better Auth user (or logged-out `null`) onto the profile page's
 * session snapshot. Tests call this when stubbing `profileAuthAdapter.useSession`.
 *
 * @internal
 */
export function profileSessionSnapshot(
  user: { email: string; emailVerified: boolean; name: string } | null,
): ProfileSessionSnapshot {
  if (user === null) {
    return { data: null };
  }
  return {
    data: {
      user: {
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
      },
    },
  };
}

/**
 * Mutable auth adapters so route smoke tests can swap the network-backed
 * better-auth client without `vi.mock`.
 *
 * @internal
 */
export const profileAuthAdapter = {
  changeEmail: (body: { callbackURL: string; newEmail: string }) => authClient.changeEmail(body),
  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions: true;
  }) => authClient.changePassword(body),
  sendVerificationEmail: (body: { callbackURL: string; email: string }) =>
    authClient.sendVerificationEmail(body),
  updateUser: (body: { name: string }) => authClient.updateUser(body),
  useSession: (): ProfileSessionSnapshot =>
    profileSessionSnapshot(authClient.useSession().data?.user ?? null),
};

export const Route = createFileRoute("/_auth/dashboard_/profile")({
  component: ProfilePage,
  validateSearch: profileSearchSchema,
  head: (opts) => ({
    meta: [
      {
        title: translate(opts.match.context.locale, "Profile – Is Baby Out Yet?"),
      },
    ],
  }),
});

/**
 * @internal Exported for smoke tests; production mounts it via `Route`.
 */
export function ProfilePage() {
  const { t } = useI18n();
  const router = useRouter();
  const search = Route.useSearch();
  const session = profileAuthAdapter.useSession();
  const sessionUser = session.data === null ? null : session.data.user;
  const verifyCallbackUrl = absoluteUrl("/dashboard/profile?notice=verified");

  const navigateNotice = (notice: ProfileNotice) =>
    router.navigate({
      replace: true,
      search: { notice },
      to: "/dashboard/profile",
    });

  return (
    <ProfilePageView
      notice={search.notice ?? null}
      onChangeEmail={
        sessionUser
          ? async (values) => {
              const result = await profileAuthAdapter.changeEmail({
                callbackURL: verifyCallbackUrl,
                newEmail: values.newEmail,
              });
              await completeProfileAuthAction(
                { errorMessage: result.error ? (result.error.message ?? "") : null },
                {
                  failedMessage: t("Unable to change your email"),
                  onSuccess: () => navigateNotice("email-change-sent"),
                },
              );
            }
          : null
      }
      onChangePassword={
        sessionUser
          ? async (values) => {
              const result = await profileAuthAdapter.changePassword({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
                revokeOtherSessions: true,
              });
              await completeProfileAuthAction(
                { errorMessage: result.error ? (result.error.message ?? "") : null },
                {
                  failedMessage: t("Unable to update your password"),
                  onSuccess: () => navigateNotice("password"),
                },
              );
            }
          : null
      }
      onSendVerification={
        sessionUser
          ? async () => {
              const result = await profileAuthAdapter.sendVerificationEmail({
                callbackURL: verifyCallbackUrl,
                email: sessionUser.email,
              });
              await completeProfileAuthAction(
                { errorMessage: result.error ? (result.error.message ?? "") : null },
                {
                  failedMessage: t("Unable to send a verification email"),
                  onSuccess: () => navigateNotice("verify-sent"),
                },
              );
            }
          : null
      }
      onUpdateName={
        sessionUser
          ? async (values) => {
              const result = await profileAuthAdapter.updateUser({
                name: values.name,
              });
              await completeProfileAuthAction(
                { errorMessage: result.error ? (result.error.message ?? "") : null },
                {
                  failedMessage: t("Unable to update your name"),
                  onSuccess: () => navigateNotice("name"),
                },
              );
            }
          : null
      }
      user={
        sessionUser
          ? {
              email: sessionUser.email,
              emailVerified: sessionUser.emailVerified,
              name: sessionUser.name,
            }
          : null
      }
    />
  );
}

/**
 * Presentational profile forms. Auth + navigate arrive as props so tests can
 * drive submit without mocking the better-auth client or the router module.
 *
 * @internal exported for tests
 */
export function ProfilePageView(props: {
  notice: ProfileNotice | null;
  onChangeEmail: ProfilePageHandlers["onChangeEmail"] | null;
  onChangePassword: ProfilePageHandlers["onChangePassword"] | null;
  onSendVerification: ProfilePageHandlers["onSendVerification"] | null;
  onUpdateName: ProfilePageHandlers["onUpdateName"] | null;
  user: ProfileUser | null;
}) {
  const { t } = useI18n();
  const overlay = useFormGuard({ onOpenChange: undefined });

  return (
    <FormGuardProvider guard={overlay}>
      <div className="min-h-screen bg-background bg-dots">
        <div className="mx-auto max-w-xl px-6 py-10">
          <Button
            className="mb-8 rounded-full border-2 font-bold"
            nativeButton={false}
            render={<Link to="/dashboard" />}
            size="sm"
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("Back to Dashboard")}
          </Button>

          <div className="mb-8 text-center">
            <p aria-hidden="true" className="text-5xl">
              👤
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground md:text-5xl">
              {t("Profile")}
            </h1>
            <p className="mt-2 font-semibold text-muted-foreground">
              {t("Manage your name, email, and password.")}
            </p>
          </div>

          {props.notice ? (
            <Alert className="mb-6 rounded-2xl border-2" role="status">
              <AlertDescription className="font-semibold text-foreground">
                {profileNoticeMessage(props.notice, t)}
              </AlertDescription>
            </Alert>
          ) : null}

          {props.user === null ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-8" />
              <span className="sr-only">{t("Loading")}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <NameCard name={props.user.name} onUpdateName={props.onUpdateName} />
              <EmailCard
                email={props.user.email}
                emailVerified={props.user.emailVerified}
                onChangeEmail={props.onChangeEmail}
                onSendVerification={props.onSendVerification}
              />
              <PasswordCard onChangePassword={props.onChangePassword} />
            </div>
          )}
        </div>
      </div>
    </FormGuardProvider>
  );
}

function NameCard(props: {
  name: string;
  onUpdateName: ProfilePageHandlers["onUpdateName"] | null;
}) {
  const { t } = useI18n();
  const form = useZodForm({
    defaultValues: {
      name: props.name,
    },
    schema: nameSchema(t),
  });

  return (
    <Card className="rounded-[2rem] border-2 pop-shadow-strong">
      <CardHeader>
        <CardTitle className="text-xl font-black">{t("Your name")}</CardTitle>
        <CardDescription className="font-medium">
          {t("This is the name on your account.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {props.onUpdateName === null ? null : (
          <Form form={form} handleSubmit={props.onUpdateName}>
            <div className="flex flex-col gap-5">
              <FormField
                control={form.control}
                name="name"
                render={(renderProps) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t("Your name")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...renderProps.field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SubmitButton
                className="w-full rounded-full font-extrabold pop-shadow"
                form="context"
                IconComponent={User}
                iconPosition="start"
                size="lg"
              >
                {t("Save name")}
              </SubmitButton>
            </div>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

function EmailCard(props: {
  email: string;
  emailVerified: boolean;
  onChangeEmail: ProfilePageHandlers["onChangeEmail"] | null;
  onSendVerification: ProfilePageHandlers["onSendVerification"] | null;
}) {
  const { t } = useI18n();
  const verifyForm = useZodForm({
    defaultValues: {},
    schema: z.object({}),
  });
  const changeForm = useZodForm({
    defaultValues: {
      newEmail: "",
    },
    schema: changeEmailSchema(t, props.email),
  });

  return (
    <Card className="rounded-[2rem] border-2 pop-shadow-strong">
      <CardHeader>
        <CardTitle className="text-xl font-black">{t("Email")}</CardTitle>
        <CardDescription className="font-medium">{props.email}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {props.emailVerified ? (
          <p className="font-semibold text-muted-foreground">{t("Your email is verified.")}</p>
        ) : (
          <>
            <p className="font-semibold text-muted-foreground">{t("Email is unverified")}</p>
            {props.onSendVerification === null ? null : (
              <Form form={verifyForm} handleSubmit={props.onSendVerification}>
                <SubmitButton
                  className="w-full rounded-full font-extrabold pop-shadow"
                  form="context"
                  IconComponent={EnvelopeSimple}
                  iconPosition="start"
                  size="lg"
                >
                  {t("Send verification email")}
                </SubmitButton>
              </Form>
            )}
          </>
        )}

        {props.emailVerified && props.onChangeEmail !== null ? (
          <Form form={changeForm} handleSubmit={props.onChangeEmail}>
            <div className="flex flex-col gap-5">
              <FormField
                control={changeForm.control}
                name="newEmail"
                render={(renderProps) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t("New email")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="email" type="email" {...renderProps.field} />
                    </FormControl>
                    <FormDescription>
                      {t("We'll send a confirmation link to the new address.")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SubmitButton
                className="w-full rounded-full font-extrabold pop-shadow"
                form="context"
                IconComponent={EnvelopeSimple}
                iconPosition="start"
                size="lg"
              >
                {t("Change email")}
              </SubmitButton>
            </div>
          </Form>
        ) : props.emailVerified ? null : (
          <p className="font-medium text-muted-foreground">
            {t("Verify your current email before you can change it.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PasswordCard(props: { onChangePassword: ProfilePageHandlers["onChangePassword"] | null }) {
  const { t } = useI18n();
  const form = useZodForm({
    defaultValues: {
      confirmPassword: "",
      currentPassword: "",
      newPassword: "",
    },
    schema: passwordSchema(t),
  });

  return (
    <Card className="rounded-[2rem] border-2 pop-shadow-strong">
      <CardHeader>
        <CardTitle className="text-xl font-black">{t("Change password")}</CardTitle>
        <CardDescription className="font-medium">
          {t("Use at least eight characters for your new password.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {props.onChangePassword === null ? null : (
          <Form form={form} handleSubmit={props.onChangePassword}>
            <div className="flex flex-col gap-5">
              <FormField
                control={form.control}
                name="currentPassword"
                render={(renderProps) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t("Current password")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="current-password"
                        type="password"
                        {...renderProps.field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={(renderProps) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t("New password")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="new-password" type="password" {...renderProps.field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={(renderProps) => (
                  <FormItem>
                    <FormLabel className="font-bold">{t("Confirm new password")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="new-password" type="password" {...renderProps.field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SubmitButton
                className="w-full rounded-full font-extrabold pop-shadow"
                form="context"
                IconComponent={Key}
                iconPosition="start"
                size="lg"
              >
                {t("Update password")}
              </SubmitButton>
            </div>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
