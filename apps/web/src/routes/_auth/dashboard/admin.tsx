import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { ArrowLeft, Baby as BabyIcon, Shield } from "@phosphor-icons/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { Button } from "@workspace/ui/components/button";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { authServer } from "@/lib/auth-server";
import { useI18n } from "@/lib/i18n";

type SortBy = "created" | "updated";

export const Route = createFileRoute("/_auth/dashboard/admin")({
  component: AdminDashboardPage,
  beforeLoad: async (opts) => {
    const profile =
      typeof window === "undefined"
        ? await authServer.fetchAuthQuery(api.profile.get, {})
        : await opts.context.convexClient.query(api.profile.get, {});
    if (!profile?.isAdmin) {
      throw redirect({ to: "/dashboard" });
    }
  },
});

function statusLabel(
  status: "not_yet" | "labor_started" | "gone_to_hospital" | "born",
  t: ReturnType<typeof useI18n>["t"],
) {
  switch (status) {
    case "not_yet":
      return t("Not yet");
    case "labor_started":
      return t("Labour started");
    case "gone_to_hospital":
      return t("Gone to hospital");
    case "born":
      return t("Baby born");
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function formatWhen(ms: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function AdminDashboardPage() {
  const { t, locale } = useI18n();
  const auth = useConvexAuth();
  const [sortBy, setSortBy] = useState<SortBy>("updated");
  const languageRequests = useQuery(
    api.admin.listLanguageRequests,
    auth.isAuthenticated ? {} : "skip",
  );
  const babies = useQuery(api.admin.listBabies, auth.isAuthenticated ? { sortBy } : "skip");

  return (
    <div className="min-h-screen bg-background bg-dots">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Button
          variant="outline"
          size="sm"
          className="mb-8 rounded-full border-2 font-bold"
          render={<Link to="/dashboard" preload="viewport" />}
          nativeButton={false}
        >
          <ArrowLeft className="w-4 h-4" />
          {t("Back to Dashboard")}
        </Button>

        <div className="mb-10 text-center">
          <p className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Shield className="h-6 w-6 text-primary" />
          </p>
          <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
            {t("Admin dashboard")}
          </h1>
        </div>

        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-black tracking-tight">{t("Requested languages")}</h2>
          {languageRequests === undefined ? (
            <Spinner className="size-6 text-primary" />
          ) : languageRequests.length === 0 ? (
            <p className="font-medium text-muted-foreground">{t("No language requests yet")}</p>
          ) : (
            <div className="overflow-hidden rounded-[1.5rem] border-2 border-border bg-card/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Language")}</TableHead>
                    <TableHead>{t("Requester")}</TableHead>
                    <TableHead>{t("Created")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {languageRequests.map((request) => (
                    <TableRow key={request._id}>
                      <TableCell className="font-semibold">{request.requestedLocale}</TableCell>
                      <TableCell>{request.userEmail ?? request.userId}</TableCell>
                      <TableCell>{formatWhen(request.createdAt, locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black tracking-tight">{t("All babies")}</h2>
            <NativeSelect
              value={sortBy}
              aria-label={t("Sort by updated")}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "created" || value === "updated") {
                  setSortBy(value);
                }
              }}
            >
              <NativeSelectOption value="updated">{t("Sort by updated")}</NativeSelectOption>
              <NativeSelectOption value="created">{t("Sort by created")}</NativeSelectOption>
            </NativeSelect>
          </div>

          {babies === undefined ? (
            <Spinner className="size-6 text-primary" />
          ) : (
            <div className="overflow-hidden rounded-[1.5rem] border-2 border-border bg-card/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Name")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead>{t("Managers")}</TableHead>
                    <TableHead>{sortBy === "created" ? t("Created") : t("Updated")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {babies.map((baby) => (
                    <TableRow key={baby._id}>
                      <TableCell className="font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <BabyIcon className="h-4 w-4 text-primary" />
                          {baby.name}
                          {baby.demo ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                              {t("Demo")}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{statusLabel(baby.status, t)}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
                        {baby.managerEmails.join(", ")}
                      </TableCell>
                      <TableCell>
                        {formatWhen(
                          sortBy === "created" ? baby.createdAt : baby.updatedAt,
                          locale,
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full font-bold"
                          render={
                            <Link
                              to="/baby/$publicId"
                              params={{ publicId: baby.publicId }}
                              preload="viewport"
                            />
                          }
                          nativeButton={false}
                        >
                          {t("Open")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
