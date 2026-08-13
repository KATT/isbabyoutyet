import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { ArrowLeft, CaretDown, Shield, Translate } from "@phosphor-icons/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { cn } from "@workspace/ui/lib/utils";
import { z } from "zod";
import { authServer } from "@/lib/auth-server";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

export const ADMIN_PAGE_SIZE = 20;

const adminSearchSchema = z.object({
  tab: z.enum(["babies", "languages"]).default("babies"),
  sort: z.enum(["created", "updated"]).default("updated"),
});

type AdminTab = z.infer<typeof adminSearchSchema>["tab"];
type SortBy = z.infer<typeof adminSearchSchema>["sort"];

type LanguageRequestRow = {
  _id: string;
  requestedLocale: string;
  createdAt: number;
  userId: string;
  userEmail: string | null;
};

type BabyRow = {
  _id: string;
  name: string;
  publicId: string;
  status: "not_yet" | "labor_started" | "gone_to_hospital" | "born";
  demo: boolean;
  createdAt: number;
  updatedAt: number;
  managerEmails: string[];
};

export const Route = createFileRoute("/_auth/dashboard/admin")({
  component: AdminDashboardPage,
  validateSearch: adminSearchSchema,
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

export function statusLabel(status: BabyRow["status"], t: TranslationFunction) {
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

export function formatWhen(ms: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function useStablePaginatedRows<T>(opts: { results: T[]; status: string }) {
  const [rows, setRows] = useState(opts.results);
  const isFirstLoad = opts.status === "LoadingFirstPage" && rows.length === 0;
  const isRefreshing = opts.status === "LoadingFirstPage" && rows.length > 0;

  useEffect(() => {
    if (opts.status !== "LoadingFirstPage") {
      setRows(opts.results);
    }
  }, [opts.results, opts.status]);

  return { rows, isFirstLoad, isRefreshing };
}

function InfiniteScrollSentinel(props: { canLoadMore: boolean; onLoadMore: () => void }) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!props.canLoadMore) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          props.onLoadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => {
      observer.unobserve(node);
    };
  }, [props.canLoadMore, props.onLoadMore]);

  return <div ref={loadMoreRef} className="h-8 w-full" aria-hidden="true" />;
}

function SortableTableHead(props: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "-ml-2 h-7 gap-1 px-2 font-medium",
          props.active ? "text-foreground" : "text-muted-foreground",
        )}
        disabled={props.disabled}
        aria-pressed={props.active}
        onClick={props.onClick}
      >
        {props.label}
        <CaretDown
          data-icon="inline-end"
          className={cn("opacity-0", props.active && "opacity-100")}
        />
      </Button>
    </TableHead>
  );
}

export function LanguageRequestsSection(props: {
  requests: LanguageRequestRow[];
  status: string;
  onLoadMore: () => void;
}) {
  const { t, locale } = useI18n();
  const { rows, isFirstLoad, isRefreshing } = useStablePaginatedRows({
    results: props.requests,
    status: props.status,
  });

  if (isFirstLoad) {
    return <Spinner className="size-6 text-primary" />;
  }

  if (rows.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Translate />
          </EmptyMedia>
          <EmptyTitle>{t("No language requests yet")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const canLoadMore = props.status === "CanLoadMore";
  const isLoadingMore = props.status === "LoadingMore";

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      {isRefreshing ? (
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center py-2">
          <Badge variant="secondary" className="gap-1.5">
            <Spinner />
            {t("Loading")}
          </Badge>
        </div>
      ) : null}
      <Table className={cn(isRefreshing && "opacity-70")}>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Language")}</TableHead>
            <TableHead>{t("Requester")}</TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1 font-medium">
                {t("Created")}
                <CaretDown data-icon="inline-end" />
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((request) => (
            <TableRow key={request._id}>
              <TableCell className="font-medium">{request.requestedLocale}</TableCell>
              <TableCell>{request.userEmail ?? request.userId}</TableCell>
              <TableCell>{formatWhen(request.createdAt, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <InfiniteScrollSentinel canLoadMore={canLoadMore} onLoadMore={props.onLoadMore} />
      {isLoadingMore ? (
        <div className="flex justify-center py-3">
          <Spinner className="size-5 text-primary" />
        </div>
      ) : null}
    </div>
  );
}

export function BabiesSection(props: {
  babies: BabyRow[];
  status: string;
  sortBy: SortBy;
  onSortByChange: (sortBy: SortBy) => void;
  onLoadMore: () => void;
}) {
  const { t, locale } = useI18n();
  const { rows, isFirstLoad, isRefreshing } = useStablePaginatedRows({
    results: props.babies,
    status: props.status,
  });

  if (isFirstLoad) {
    return <Spinner className="size-6 text-primary" />;
  }

  const canLoadMore = props.status === "CanLoadMore";
  const isLoadingMore = props.status === "LoadingMore";

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      {isRefreshing ? (
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center py-2">
          <Badge variant="secondary" className="gap-1.5">
            <Spinner />
            {t("Loading")}
          </Badge>
        </div>
      ) : null}
      <Table className={cn(isRefreshing && "opacity-70")}>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Name")}</TableHead>
            <TableHead>{t("Status")}</TableHead>
            <TableHead>{t("Managers")}</TableHead>
            <SortableTableHead
              label={t("Created")}
              active={props.sortBy === "created"}
              disabled={isRefreshing}
              onClick={() => props.onSortByChange("created")}
            />
            <SortableTableHead
              label={t("Updated")}
              active={props.sortBy === "updated"}
              disabled={isRefreshing}
              onClick={() => props.onSortByChange("updated")}
            />
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((baby) => (
            <TableRow key={baby._id}>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-2">
                  {baby.name}
                  {baby.demo ? <Badge variant="outline">{t("Demo")}</Badge> : null}
                </span>
              </TableCell>
              <TableCell>{statusLabel(baby.status, t)}</TableCell>
              <TableCell className="max-w-xs whitespace-normal">
                {baby.managerEmails.join(", ")}
              </TableCell>
              <TableCell>{formatWhen(baby.createdAt, locale)}</TableCell>
              <TableCell>{formatWhen(baby.updatedAt, locale)}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
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
      <InfiniteScrollSentinel canLoadMore={canLoadMore} onLoadMore={props.onLoadMore} />
      {isLoadingMore ? (
        <div className="flex justify-center py-3">
          <Spinner className="size-5 text-primary" />
        </div>
      ) : null}
    </div>
  );
}

export function AdminDashboardPage() {
  const { t } = useI18n();
  const auth = useConvexAuth();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/dashboard/admin" });

  const languageQuery = usePaginatedQuery(
    api.admin.listLanguageRequests,
    auth.isAuthenticated && search.tab === "languages" ? {} : "skip",
    { initialNumItems: ADMIN_PAGE_SIZE },
  );
  const babiesQuery = usePaginatedQuery(
    api.admin.listBabies,
    auth.isAuthenticated && search.tab === "babies" ? { sortBy: search.sort } : "skip",
    { initialNumItems: ADMIN_PAGE_SIZE },
  );

  function setTab(tab: AdminTab) {
    void navigate({
      search: (prev) => ({ ...prev, tab }),
      replace: true,
    });
  }

  function setSort(sort: SortBy) {
    void navigate({
      search: (prev) => ({ ...prev, sort }),
      replace: true,
    });
  }

  return (
    <div className="min-h-screen bg-background bg-dots">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <Button
          variant="outline"
          size="sm"
          className="w-fit rounded-full border-2 font-bold"
          render={<Link to="/dashboard" preload="viewport" />}
          nativeButton={false}
        >
          <ArrowLeft data-icon="inline-start" />
          {t("Back to Dashboard")}
        </Button>

        <div className="text-center">
          <p className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/15">
            <Shield className="size-6 text-primary" />
          </p>
          <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
            {t("Admin dashboard")}
          </h1>
        </div>

        <Tabs
          value={search.tab}
          onValueChange={(value) => {
            if (value === "babies" || value === "languages") {
              setTab(value);
            }
          }}
        >
          <TabsList variant="default" className="mx-auto">
            <TabsTrigger value="babies">{t("All babies")}</TabsTrigger>
            <TabsTrigger value="languages">{t("Requested languages")}</TabsTrigger>
          </TabsList>

          <TabsContent value="babies" className="mt-6">
            <BabiesSection
              babies={babiesQuery.results}
              status={babiesQuery.status}
              sortBy={search.sort}
              onSortByChange={setSort}
              onLoadMore={() => babiesQuery.loadMore(ADMIN_PAGE_SIZE)}
            />
          </TabsContent>

          <TabsContent value="languages" className="mt-6">
            <LanguageRequestsSection
              requests={languageQuery.results}
              status={languageQuery.status}
              onLoadMore={() => languageQuery.loadMore(ADMIN_PAGE_SIZE)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
