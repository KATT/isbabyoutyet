import { useState } from "react";
import { Palette, Shield, SignOut, User } from "@phosphor-icons/react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { api } from "@workspace/convex/convex/_generated/api";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { allKeyed } from "@workspace/query-prefetch";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
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
import { useOverlayNav } from "@/lib/overlay-nav";
import { ADMIN_DEFAULT_SEARCH } from "@/routes/_auth/dashboard/admin";
import { DashboardPage, type DashboardLoaderData } from "@/routes/_auth/dashboard/index";

const authRoute = getRouteApi("/_auth");

export const Route = createFileRoute("/_auth/dashboard/settings")({
  loader: async (opts) => {
    return await allKeyed({
      babies: opts.context.convexPreloader.ensureQueryData(api.baby.listByUser, {}),
      onboarding: opts.context.convexPreloader.ensureQueryData(api.onboarding.getMine, {}),
    });
  },
  component: DashboardSettingsRoute,
});

function DashboardSettingsRoute() {
  const loaderData: DashboardLoaderData = Route.useLoaderData();

  return (
    <>
      <DashboardPage babies={loaderData.babies} onboarding={loaderData.onboarding} />
      <DashboardSettingsSheet />
    </>
  );
}

export function DashboardSettingsSheet() {
  const { t } = useI18n();
  const authContext = authRoute.useRouteContext();
  const profileQuery = usePreloadedConvexQuery(api.profile.get, authContext.profile);
  const [open, setOpen] = useState(true);
  const settings = useOverlayNav({
    open: { to: "/dashboard/settings" },
    close: { to: "/dashboard" },
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setOpen(false);
        }
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          settings.dismiss();
        }
      }}
    >
      <SheetContent side="right" className="w-full border-0 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{t("Settings")}</SheetTitle>
          <SheetDescription>{t("Manage your profile and app preferences.")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
            <Avatar size="lg" className="after:border-0">
              <AvatarFallback>
                <User />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-bold">{t("Settings")}</p>
              <p className="text-sm text-muted-foreground">
                {t("Manage your profile and app preferences.")}
              </p>
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="px-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("Language and time zone")}
            </h3>
            <LanguageSettings profile={authContext.profile} className="justify-start" />
          </section>

          <ItemGroup className="gap-2">
            <Item variant="muted">
              <ItemMedia variant="icon">
                <Palette />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t("Appearance")}</ItemTitle>
                <ItemDescription>{t("Theme")}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ModeToggle className="rounded-full border-0" />
              </ItemActions>
            </Item>

            {profileQuery.data?.isAdmin ? (
              <Item
                variant="muted"
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
            ) : null}
          </ItemGroup>
        </div>

        <SheetFooter>
          <Button
            variant="ghost"
            onClick={async () => {
              await authClient.signOut({
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
          >
            <SignOut data-icon="inline-start" />
            {t("Logout")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
