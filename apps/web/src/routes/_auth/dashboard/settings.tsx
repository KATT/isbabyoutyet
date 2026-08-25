import { Palette, Shield, SignOut } from "@phosphor-icons/react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useRef } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { api } from "@workspace/convex/convex/_generated/api";
import type { InitiatedConvexQuery, PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { Button } from "@workspace/ui/components/button";
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
import { LanguageSettings } from "@/components/language-settings";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { useDashboardSettingsOverlayNav } from "@/lib/overlay-nav";
import { ADMIN_DEFAULT_SEARCH } from "@/routes/_auth/dashboard_.admin";

const authRoute = getRouteApi("/_auth");

export const Route = createFileRoute("/_auth/dashboard/settings")({
  component: DashboardSettingsRoute,
});

export function DashboardSettingsRoute() {
  const authContext = authRoute.useRouteContext();
  return <DashboardSettingsSheet profile={authContext.profile} />;
}

function SettingsSection(props: { title: string; children: ReactNode }) {
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: (open: boolean) => void;
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
  profile:
    | PreloadedConvexQuery<typeof api.profile.get>
    | InitiatedConvexQuery<typeof api.profile.get>;
}) {
  const profileQuery = usePreloadedConvexQuery(api.profile.get, props.profile);
  const settings = useDashboardSettingsOverlayNav();

  return (
    <DashboardSettingsSheetView
      isAdmin={profileQuery.data?.isAdmin === true}
      overlay={settings}
      languageSettings={<LanguageSettings profile={props.profile} className="justify-start" />}
      onSignOut={async () => {
        await settingsAuthAdapter.signOut({
          fetchOptions: {
            onSuccess: () => {
              window.location.href = "/";
            },
            onError: (error) => {
              toast.error(error.error.message);
            },
          },
        });
      }}
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
  isAdmin: boolean;
  overlay: OverlayControl;
  languageSettings: ReactNode;
  onSignOut: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement | null>(null);

  return (
    <Sheet
      open={props.overlay.open}
      onOpenChange={props.overlay.onOpenChange}
      onOpenChangeComplete={props.overlay.onOpenChangeComplete}
    >
      <SheetContent
        ref={contentRef}
        initialFocus={contentRef}
        side="right"
        className="w-full sm:max-w-sm"
      >
        <SheetHeader>
          <SheetTitle>{t("Settings")}</SheetTitle>
          <SheetDescription>{t("Manage your profile and app preferences.")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
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
                  <Link to="/dashboard/admin" search={ADMIN_DEFAULT_SEARCH} preload="viewport" />
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
          <Button
            onClick={() => {
              void props.onSignOut();
            }}
          >
            <SignOut data-icon="inline-start" />
            {t("Logout")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
