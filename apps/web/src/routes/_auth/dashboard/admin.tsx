import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { ArrowLeft, CaretDown, CaretUp, Shield, Translate } from "@phosphor-icons/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
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
  order: z.enum(["asc", "desc"]).default("desc"),
});

type AdminTab = z.infer<typeof adminSearchSchema>["tab"];
type SortBy = z.infer<typeof adminSearchSchema>["sort"];
type SortOrder = z.infer<typeof adminSearchSchema>["order"];

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

/** Next URL sort state when a sortable column header is clicked. */
export function nextSortSearch(opts: {
  currentSort: SortBy;
  currentOrder: SortOrder;
  clicked: SortBy;
}) {
  if (opts.clicked === opts.currentSort) {
    return {
      sort: opts.clicked,
      order: (opts.currentOrder === "desc" ? "asc" : "desc") as SortOrder,
    };
  }
  return { sort: opts.clicked, order: "desc" as SortOrder };
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

function RefreshingBadge() {
  const { t } = useI18n();
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex justify-center py-2">
      <Badge variant="secondary" className="gap-1.5">
        <Spinner />
        {t("Loading")}
      </Badge>
    </div>
  );
}

function SortableHeaderLink(props: {
  label: string;
  column: SortBy;
  sort: SortBy;
  order: SortOrder;
  tab: AdminTab;
}) {
  const active = props.column === props.sort;
  const next = nextSortSearch({
    currentSort: props.sort,
    currentOrder: props.order,
    clicked: props.column,
  });
  const SortIcon = active && props.order === "asc" ? CaretUp : CaretDown;

  return (
    <TableHead
      aria-sort={active ? (props.order === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        to="/dashboard/admin"
        search={{ tab: props.tab, sort: next.sort, order: next.order }}
        replace
        className={cn(
          "inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {props.label}
        <SortIcon
          data-icon="inline-end"
          className={cn("opacity-0", active && "opacity-100")}
          aria-hidden="true"
        />
      </Link>
    </TableHead>
  );
}

function AdminTableCard(props: {
  children: ReactNode;
  isRefreshing: boolean;
  canLoadMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <Card className="relative gap-0 py-0">
      {props.isRefreshing ? <RefreshingBadge /> : null}
      <CardContent className={cn("p-0", props.isRefreshing && "opacity-70")}>
        {props.children}
      </CardContent>
      <InfiniteScrollSentinel canLoadMore={props.canLoadMore} onLoadMore={props.onLoadMore} />
      {props.isLoadingMore ? (
        <div className="flex justify-center border-t py-3">
          <Spinner className="size-5 text-primary" />
        </div>
      ) : null}
    </Card>
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

  return (
    <AdminTableCard
      isRefreshing={isRefreshing}
      canLoadMore={props.status === "CanLoadMore"}
      isLoadingMore={props.status === "LoadingMore"}
      onLoadMore={props.onLoadMore}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Language")}</TableHead>
            <TableHead>{t("Requester")}</TableHead>
            <TableHead>{t("Created")}</TableHead>
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
    </AdminTableCard>
  );
}

export function BabiesSection(props: {
  babies: BabyRow[];
  status: string;
  sort: SortBy;
  order: SortOrder;
  tab: AdminTab;
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

  return (
    <AdminTableCard
      isRefreshing={isRefreshing}
      canLoadMore={props.status === "CanLoadMore"}
      isLoadingMore={props.status === "LoadingMore"}
      onLoadMore={props.onLoadMore}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Name")}</TableHead>
            <TableHead>{t("Status")}</TableHead>
            <TableHead>{t("Managers")}</TableHead>
            <SortableHeaderLink
              label={t("Created")}
              column="created"
              sort={props.sort}
              order={props.order}
              tab={props.tab}
            />
            <SortableHeaderLink
              label={t("Updated")}
              column="updated"
              sort={props.sort}
              order={props.order}
              tab={props.tab}
            />
            <TableHead>
              <span className="sr-only">{t("Open")}</span>
            </TableHead>
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
    </AdminTableCard>
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
    auth.isAuthenticated && search.tab === "babies"
      ? { sortBy: search.sort, sortOrder: search.order }
      : "skip",
    { initialNumItems: ADMIN_PAGE_SIZE },
  );

  function setTab(tab: AdminTab) {
    void navigate({
      search: (prev) => ({ ...prev, tab }),
      replace: true,
    });
  }

  return (
    <div className="min-h-screen bg-background bg-dots">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          render={<Link to="/dashboard" preload="viewport" />}
          nativeButton={false}
        >
          <ArrowLeft data-icon="inline-start" />
          {t("Back to Dashboard")}
        </Button>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Shield className="size-5 text-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {t("Admin dashboard")}
                </CardTitle>
                <CardDescription>
                  {t("Review babies and language requests across the platform.")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
            <Tabs
              value={search.tab}
              orientation="horizontal"
              className="flex w-full flex-col gap-4"
              onValueChange={(value) => {
                if (value === "babies" || value === "languages") {
                  setTab(value);
                }
              }}
            >
              <TabsList variant="default">
                <TabsTrigger value="babies">{t("All babies")}</TabsTrigger>
                <TabsTrigger value="languages">{t("Requested languages")}</TabsTrigger>
              </TabsList>

              <TabsContent value="babies" className="mt-0">
                <BabiesSection
                  babies={babiesQuery.results}
                  status={babiesQuery.status}
                  sort={search.sort}
                  order={search.order}
                  tab={search.tab}
                  onLoadMore={() => babiesQuery.loadMore(ADMIN_PAGE_SIZE)}
                />
              </TabsContent>

              <TabsContent value="languages" className="mt-0">
                <LanguageRequestsSection
                  requests={languageQuery.results}
                  status={languageQuery.status}
                  onLoadMore={() => languageQuery.loadMore(ADMIN_PAGE_SIZE)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
