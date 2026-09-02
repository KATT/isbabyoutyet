import { Check, Palette, Shield, SignOut, User } from "@phosphor-icons/react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useRef } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { Form, FormGuardProvider, SubmitButton, useFormGuard, useZodForm } from "@/components/Form";
import { LanguageSettings } from "@/components/language-settings";
import { authClient } from "@/lib/auth-client";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { useDashboardSettingsOverlayNav } from "@/lib/overlay-nav";
import { ADMIN_DEFAULT_SEARCH } from "@/routes/_auth/dashboard_.admin";

const authRoute = getRouteApi("/_auth");
const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/_auth/dashboard/settings")({
  component: DashboardSettingsRoute,
});

export function DashboardSettingsRoute() {
  const authContext = authRoute.useRouteContext();
  const { queryClient } = rootRoute.useRouteContext();
  return <DashboardSettingsSheet profile={authContext.profile} queryClient={queryClient} />;
}

function SettingsSection(props: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {props.title}
      </h3>
      <div className="overflow-hidden rounded-xl border border-border bg-card/50">
        <ItemGroup className="gap-0">{props.children}</ItemGroup>
      </div>
    </section>
  );
}

type OverlayControl = {
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: (open: boolean) => void;
  open: boolean;
};

/**
 * Mutable auth adapter so sheet tests can avoid the Proxy-backed
 * better-auth client without `vi.mock`.
 *
 * @internal
 */
export const settingsAuthAdapter = {
  signOut: (opts: Parameters<typeof authClient.signOut>[0]) => authClient.signOut(opts),
  updateUser: (body: { name: string }) => authClient.updateUser(body),
};

/**
 * Convex-wired sheet: resolves the admin flag from the preloaded profile and
 * owns sign-out and account name updates.
 *
 * @internal exported for tests
 */
export function DashboardSettingsSheet(props: {
  profile: PreloadedConvexQuery<typeof api.profile.get>;
  queryClient: QueryClient;
}) {
  const profileQuery = usePreloadedConvexQuery(api.profile.get, props.profile);
  const settings = useDashboardSettingsOverlayNav();
  const session = authClient.useSession();
  const { t } = useI18n();

  return (
    <DashboardSettingsSheetView
      accountName={session.data?.user.name ?? ""}
      isAdmin={profileQuery.data?.isAdmin === true}
      languageSettings={<LanguageSettings className="justify-start" profile={props.profile} />}
      onSaveName={async (name) => {
        const result = await settingsAuthAdapter.updateUser({ name });
        if (result.error) {
          throw new Error(result.error.message ?? t("Failed to update name"));
        }
      }}
      onSignOut={async () => {
        props.queryClient.clear();
        await settingsAuthAdapter.signOut({
          fetchOptions: {
            onError: (error) => {
              toast.error(error.error.message);
            },
            onSuccess: () => {
              window.location.href = "/";
            },
          },
        });
      }}
      overlay={settings}
    />
  );
}

/**
 * Presentational sheet — no Convex, no auth client, no route context — so the
 * layout, admin gating, and log-out wiring are testable in isolation.
 *
 * @internal exported for tests
 */
export function DashboardSettingsSheetView(props: {
  accountName: string;
  isAdmin: boolean;
  languageSettings: ReactNode;
  onSaveName: (name: string) => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
  overlay: OverlayControl;
}) {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const formOverlay = useFormGuard({ onOpenChange: props.overlay.onOpenChange });

  return (
    <Sheet
      open={props.overlay.open}
      {...formOverlay.rootProps}
      onOpenChangeComplete={props.overlay.onOpenChangeComplete}
    >
      <SheetContent
        className="w-full sm:max-w-sm"
        initialFocus={contentRef}
        ref={contentRef}
        side="right"
      >
        <FormGuardProvider guard={formOverlay}>
          <SheetHeader>
            <SheetTitle>{t("Settings")}</SheetTitle>
            <SheetDescription>{t("Manage your profile and app preferences.")}</SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
            <SettingsSection title={t("Profile")}>
              <Item>
                <ItemMedia variant="icon">
                  <User />
                </ItemMedia>
                <ItemContent>
                  <AccountNameForm accountName={props.accountName} onSaveName={props.onSaveName} />
                </ItemContent>
              </Item>
            </SettingsSection>

            <SettingsSection title={t("Language and time zone")}>
              <Item>
                <ItemContent>{props.languageSettings}</ItemContent>
              </Item>
            </SettingsSection>

            <SettingsSection title={t("Appearance")}>
              <Item>
                <ItemMedia variant="icon">
                  <Palette />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{t("Appearance")}</ItemTitle>
                  <ItemDescription>{t("Theme")}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ModeToggle />
                </ItemActions>
              </Item>
            </SettingsSection>

            {props.isAdmin ? (
              <SettingsSection title={t("Admin")}>
                <Item
                  render={
                    <Link preload="viewport" search={ADMIN_DEFAULT_SEARCH} to="/dashboard/admin" />
                  }
                >
                  <ItemMedia variant="icon">
                    <Shield />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{t("Admin dashboard")}</ItemTitle>
                  </ItemContent>
                </Item>
              </SettingsSection>
            ) : null}
          </div>

          <SheetFooter>
            <SignOutForm onSignOut={props.onSignOut} />
          </SheetFooter>
        </FormGuardProvider>
      </SheetContent>
    </Sheet>
  );
}

const MAX_NAME_LENGTH = 50;

function accountNameSchema(t: TranslationFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, t("Name must be at least 2 characters"))
      .max(
        MAX_NAME_LENGTH,
        t("Name must be {{count}} characters or less", { count: MAX_NAME_LENGTH }),
      ),
  });
}

function AccountNameForm(props: {
  accountName: string;
  onSaveName: (name: string) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const form = useZodForm({
    defaultValues: { name: props.accountName },
    schema: accountNameSchema(t),
  });

  return (
    <Form
      form={form}
      handleSubmit={async (values) => {
        await props.onSaveName(values.name);
        form.reset({ name: values.name });
        toast.success(t("Name saved"));
      }}
    >
      <div className="flex flex-col gap-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("Name")}</FormLabel>
              <FormControl>
                <Input maxLength={MAX_NAME_LENGTH} placeholder={t("Your name")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-xs text-muted-foreground">
          {t("Past guestbook messages keep the name you wrote then.")}
        </p>
        <SubmitButton form="context" IconComponent={Check} iconPosition="start">
          {t("Save")}
        </SubmitButton>
      </div>
    </Form>
  );
}

function SignOutForm(props: { onSignOut: () => void | Promise<void> }) {
  const { t } = useI18n();
  const form = useZodForm({
    defaultValues: {},
    schema: z.object({}),
  });

  return (
    <Form
      form={form}
      handleSubmit={async () => {
        await props.onSignOut();
      }}
    >
      <SubmitButton form="context" IconComponent={SignOut} iconPosition="start">
        {t("Logout")}
      </SubmitButton>
    </Form>
  );
}
