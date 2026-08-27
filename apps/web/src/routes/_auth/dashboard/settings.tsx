import { Palette, Shield, SignOut } from "@phosphor-icons/react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useRef } from "react";
import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { toast } from "sonner";
import { api } from "@workspace/convex/convex/_generated/api";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
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
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { LanguageSettings } from "@/components/language-settings";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { useDashboardSettingsOverlayNav } from "@/lib/overlay-nav";
import { ADMIN_DEFAULT_SEARCH } from "@/routes/_auth/dashboard_.admin";

const authRoute = getRouteApi("/_auth");

const styles = stylex.create({
  body: {
    display: "flex",
    flexGrow: 1,
    flexDirection: "column",
    gap: spacing.s6,
    overflowY: "auto",
    paddingInline: spacing.s4,
    paddingBottom: spacing.s4,
  },
  sectionTitle: {
    margin: 0,
    paddingInline: spacing.s0_5,
    fontSize: "0.75rem",
    lineHeight: "1rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: colors.mutedForeground,
  },
  sectionCard: {
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    backgroundColor: `color-mix(in oklab, ${colors.card} 50%, transparent)`,
  },
});

export const Route = createFileRoute("/_auth/dashboard/settings")({
  component: DashboardSettingsRoute,
});

export function DashboardSettingsRoute() {
  const authContext = authRoute.useRouteContext();
  return <DashboardSettingsSheet profile={authContext.profile} />;
}

function SettingsSection(props: { title: string; children: ReactNode }) {
  return (
    <Stack gap="s2">
      <h3 {...stylex.props(styles.sectionTitle)}>{props.title}</h3>
      <div {...stylex.props(styles.sectionCard)}>
        <ItemGroup>{props.children}</ItemGroup>
      </div>
    </Stack>
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
  profile: PreloadedConvexQuery<typeof api.profile.get>;
}) {
  const profileQuery = usePreloadedConvexQuery(api.profile.get, props.profile);
  const settings = useDashboardSettingsOverlayNav();

  return (
    <DashboardSettingsSheetView
      isAdmin={profileQuery.data?.isAdmin === true}
      overlay={settings}
      languageSettings={<LanguageSettings profile={props.profile} justify={undefined} />}
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
      <SheetContent ref={contentRef} initialFocus={contentRef} side="right">
        <SheetHeader>
          <SheetTitle>{t("Settings")}</SheetTitle>
          <SheetDescription>{t("Manage your profile and app preferences.")}</SheetDescription>
        </SheetHeader>

        <div {...stylex.props(styles.body)}>
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
