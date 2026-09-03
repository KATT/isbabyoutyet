import { Shield, SignOut } from "@phosphor-icons/react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useRef } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { AccountSettings } from "@/components/account-settings";
import { Form, FormGuardProvider, SubmitButton, useFormGuard, useZodForm } from "@/components/Form";
import { LanguageSettings } from "@/components/language-settings";
import { authClient } from "@/lib/auth-client";
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
 * Mutable sign-out adapter so sheet tests can avoid the Proxy-backed
 * better-auth client without `vi.mock`.
 *
 * @internal
 */
export const settingsAuthAdapter = {
  signOut: (opts: Parameters<typeof authClient.signOut>[0]) => authClient.signOut(opts),
};

/**
 * Convex-wired sheet: resolves the admin flag from the preloaded profile and
 * owns sign-out.
 *
 * @internal exported for tests
 */
export function DashboardSettingsSheet(props: {
  profile: PreloadedConvexQuery<typeof api.profile.get>;
  queryClient: QueryClient;
}) {
  const profileQuery = usePreloadedConvexQuery(api.profile.get, props.profile);
  const settings = useDashboardSettingsOverlayNav();

  return (
    <DashboardSettingsSheetView
      accountSettings={<AccountSettings />}
      isAdmin={profileQuery.data?.isAdmin === true}
      languageSettings={<LanguageSettings profile={props.profile} />}
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
  accountSettings: ReactNode;
  isAdmin: boolean;
  languageSettings: ReactNode;
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
            <SettingsSection title={t("Account")}>
              {props.accountSettings}
              {props.languageSettings}
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
