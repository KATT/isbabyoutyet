import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CaretDown, CaretUp, Shield, Translate, Users } from "@phosphor-icons/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { allKeyed } from "@workspace/query-prefetch";
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
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";
import { Switch } from "@workspace/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { VisuallyHidden } from "@workspace/ui-patterns/components/visually-hidden";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";
import { z } from "zod";
import { usePreloadedConvexInfiniteQuery } from "@workspace/convex-prefetch";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { useIntersectionAction } from "@/lib/use-intersection-action";

const ADMIN_PAGE_SIZE = 20;

const styles = stylex.create({
  page: {
    backgroundColor: colors.background,
    backgroundImage: `radial-gradient(color-mix(in oklab, ${colors.border} 80%, transparent) 1.5px, transparent 1.5px)`,
    backgroundSize: "22px 22px",
    minHeight: "100vh",
  },
  inner: {
    marginInline: "auto",
    maxWidth: "72rem",
    paddingBlock: spacing.s10,
    paddingInline: spacing.s6,
  },
  backRow: {
    display: "flex",
  },
  iconMark: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderRadius: radius.lg,
    color: colors.primary,
    display: "flex",
    flexShrink: 0,
    height: "2.5rem",
    justifyContent: "center",
    width: "2.5rem",
  },
  headerBorder: {
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
  },
  loadingMore: {
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    borderTopWidth: "1px",
    display: "flex",
    justifyContent: "center",
    paddingBlock: spacing.s3,
  },
  sentinel: {
    height: "2rem",
    width: "100%",
  },
  sortLink: {
    alignItems: "center",
    display: "inline-flex",
    fontWeight: 500,
    gap: spacing.s1,
    textDecoration: "none",
    textUnderlineOffset: "4px",
    ":hover": {
      textDecoration: "underline",
    },
  },
  sortLinkActive: {
    color: colors.foreground,
  },
  sortLinkMuted: {
    color: colors.mutedForeground,
  },
  sortIconHidden: {
    opacity: 0,
  },
  sortIconVisible: {
    opacity: 1,
  },
  cellLink: {
    color: "inherit",
    textDecoration: "none",
    textUnderlineOffset: "4px",
    ":hover": {
      textDecoration: "underline",
    },
  },
  wrapCell: {
    maxWidth: "20rem",
    whiteSpace: "normal",
  },
  tabToolbar: {
    alignItems: {
      default: "stretch",
      "@media (min-width: 640px)": "center",
    },
    display: "flex",
    flexDirection: {
      default: "column",
      "@media (min-width: 640px)": "row",
    },
    gap: spacing.s3,
    justifyContent: {
      default: "flex-start",
      "@media (min-width: 640px)": "space-between",
    },
  },
});

const adminSearchSchema = z.object({
  tab: z.enum(["babies", "languages", "users"]).default("babies"),
  sort: z.enum(["created", "updated"]).default("created"),
  order: z.enum(["asc", "desc"]).default("desc"),
  hideDemo: z.boolean().default(true),
});

type AdminTab = z.infer<typeof adminSearchSchema>["tab"];
type SortBy = z.infer<typeof adminSearchSchema>["sort"];
type SortOrder = z.infer<typeof adminSearchSchema>["order"];
type AdminSearch = z.infer<typeof adminSearchSchema>;

/** Default admin babies list: newest created first, demos hidden. */
export const ADMIN_DEFAULT_SEARCH = {
  tab: "babies",
  sort: "created",
  order: "desc",
  hideDemo: true,
} as const satisfies AdminSearch;

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

type UserRow = {
  _id: string;
  email: string;
  name: string;
  createdAt: number;
  babies: Array<{
    name: string;
    publicId: string;
    demo: boolean;
  }>;
};

export const Route = createFileRoute("/_auth/dashboard_/admin")({
  component: AdminDashboardPage,
  validateSearch: adminSearchSchema,
  loaderDeps: (opts) => opts.search,
  loader: async (opts) => {
    if (!opts.context.profile.initialData?.isAdmin) {
      throw redirect({ to: "/dashboard" });
    }

    const preloader = opts.context.convexPreloader;
    const search = opts.deps;
    // Infinite queries stay blocking on the client too: the react-query cache
    // makes revisits free, and suspense churn on paginated tables isn't worth it.
    return await allKeyed({
      babies: preloader.ensureInfiniteQueryData(api.admin.listBabies, {
        args: {
          sortBy: search.sort,
          sortOrder: search.order,
          hideDemo: search.hideDemo,
        },
        numItems: ADMIN_PAGE_SIZE,
      }),
      languages: preloader.ensureInfiniteQueryData(api.admin.listLanguageRequests, {
        args: {},
        numItems: ADMIN_PAGE_SIZE,
      }),
      users: preloader.ensureInfiniteQueryData(api.admin.listUsers, {
        args: {},
        numItems: ADMIN_PAGE_SIZE,
      }),
    });
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

/**
 * Next URL sort state when a sortable column header is clicked.
 * Selecting a column always starts at desc; clicking the active desc column
 * toggles to asc.
 */
export function nextSortSearch(opts: {
  currentSort: SortBy;
  currentOrder: SortOrder;
  clicked: SortBy;
}) {
  if (opts.clicked === opts.currentSort && opts.currentOrder === "desc") {
    return { sort: opts.clicked, order: "asc" as SortOrder };
  }
  return { sort: opts.clicked, order: "desc" as SortOrder };
}

function InfiniteScrollSentinel(props: { canLoadMore: boolean; onLoadMore: () => void }) {
  const sentinelRef = useIntersectionAction({
    enabled: props.canLoadMore,
    onIntersect: props.onLoadMore,
    threshold: 0.1,
  });
  return <div ref={sentinelRef} {...stylex.props(styles.sentinel)} aria-hidden="true" />;
}

function AdminTableCard(props: {
  children: ReactNode;
  canLoadMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <Card>
      <CardContent>
        {props.children}
        <InfiniteScrollSentinel canLoadMore={props.canLoadMore} onLoadMore={props.onLoadMore} />
        {props.isLoadingMore ? (
          <div {...stylex.props(styles.loadingMore)}>
            <Spinner />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SortableHeaderLink(props: {
  label: string;
  column: SortBy;
  sort: SortBy;
  order: SortOrder;
  tab: AdminTab;
  hideDemo: boolean;
}) {
  const active = props.column === props.sort;
  const next = nextSortSearch({
    currentSort: props.sort,
    currentOrder: props.order,
    clicked: props.column,
  });
  const SortIcon = active && props.order === "asc" ? CaretUp : CaretDown;
  const iconStyle = stylex.props(active ? styles.sortIconVisible : styles.sortIconHidden);

  return (
    <TableHead>
      <Link
        to="/dashboard/admin"
        search={{
          tab: props.tab,
          sort: next.sort,
          order: next.order,
          hideDemo: props.hideDemo,
        }}
        replace
        resetScroll={false}
        {...stylex.props(styles.sortLink, active ? styles.sortLinkActive : styles.sortLinkMuted)}
      >
        {props.label}
        <SortIcon
          data-icon="inline-end"
          className={iconStyle.className}
          style={iconStyle.style}
          aria-hidden="true"
        />
      </Link>
    </TableHead>
  );
}

export function LanguageRequestsSection(props: {
  requests: LanguageRequestRow[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const { t, locale } = useI18n();

  if (props.requests.length === 0) {
    return (
      <Empty>
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
      canLoadMore={props.hasNextPage && !props.isFetchingNextPage}
      isLoadingMore={props.isFetchingNextPage}
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
          {props.requests.map((request) => (
            <TableRow key={request._id}>
              <TableCell>
                <Text as="span" weight="medium">
                  {request.requestedLocale}
                </Text>
              </TableCell>
              <TableCell>{request.userEmail ?? request.userId}</TableCell>
              <TableCell>{formatWhen(request.createdAt, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminTableCard>
  );
}

export function UsersSection(props: {
  users: UserRow[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const { t, locale } = useI18n();

  if (props.users.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>{t("No users yet")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <AdminTableCard
      canLoadMore={props.hasNextPage && !props.isFetchingNextPage}
      isLoadingMore={props.isFetchingNextPage}
      onLoadMore={props.onLoadMore}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Name")}</TableHead>
            <TableHead>{t("Email")}</TableHead>
            <TableHead>{t("Babies")}</TableHead>
            <TableHead>{t("Signed up")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.users.map((user) => (
            <TableRow key={user._id}>
              <TableCell>
                <Text as="span" weight="medium">
                  {user.name}
                </Text>
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <div {...stylex.props(styles.wrapCell)}>
                  {user.babies.length === 0 ? (
                    <Text as="span" tone="muted">
                      —
                    </Text>
                  ) : (
                    user.babies.map((baby, index) => (
                      <span key={baby.publicId}>
                        {index > 0 ? ", " : null}
                        <Link
                          to="/baby/$publicId"
                          params={{ publicId: baby.publicId }}
                          {...stylex.props(styles.cellLink)}
                        >
                          {baby.name}
                        </Link>
                        {baby.demo ? ` (${t("Demo")})` : null}
                      </span>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell>{formatWhen(user.createdAt, locale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminTableCard>
  );
}

export function BabiesSection(props: {
  babies: BabyRow[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  sort: SortBy;
  order: SortOrder;
  tab: AdminTab;
  hideDemo: boolean;
  onLoadMore: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <AdminTableCard
      canLoadMore={props.hasNextPage && !props.isFetchingNextPage}
      isLoadingMore={props.isFetchingNextPage}
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
              hideDemo={props.hideDemo}
            />
            <SortableHeaderLink
              label={t("Updated")}
              column="updated"
              sort={props.sort}
              order={props.order}
              tab={props.tab}
              hideDemo={props.hideDemo}
            />
            <TableHead>
              <VisuallyHidden>{t("Open")}</VisuallyHidden>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.babies.map((baby) => (
            <TableRow key={baby._id}>
              <TableCell>
                <Inline gap="s2" wrap={false}>
                  <Text as="span" weight="medium">
                    {baby.name}
                  </Text>
                  {baby.demo ? <Badge variant="outline">{t("Demo")}</Badge> : null}
                </Inline>
              </TableCell>
              <TableCell>{statusLabel(baby.status, t)}</TableCell>
              <TableCell>
                <div {...stylex.props(styles.wrapCell)}>{baby.managerEmails.join(", ")}</div>
              </TableCell>
              <TableCell>{formatWhen(baby.createdAt, locale)}</TableCell>
              <TableCell>{formatWhen(baby.updatedAt, locale)}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link to="/baby/$publicId" params={{ publicId: baby.publicId }} />}
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

function AdminBabiesTab() {
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const babiesQuery = usePreloadedConvexInfiniteQuery(api.admin.listBabies, {
    handle: loaderData.babies,
    remixArgs: null,
  });

  const babies = babiesQuery.data.pages.flatMap((page) => page.page);

  return (
    <BabiesSection
      babies={babies}
      hasNextPage={babiesQuery.hasNextPage}
      isFetchingNextPage={babiesQuery.isFetchingNextPage}
      sort={search.sort}
      order={search.order}
      tab={search.tab}
      hideDemo={search.hideDemo}
      onLoadMore={() => {
        void babiesQuery.fetchNextPage();
      }}
    />
  );
}

function AdminLanguagesTab() {
  const loaderData = Route.useLoaderData();
  const languagesQuery = usePreloadedConvexInfiniteQuery(api.admin.listLanguageRequests, {
    handle: loaderData.languages,
    remixArgs: null,
  });

  const requests = languagesQuery.data.pages.flatMap((page) => page.page);

  return (
    <LanguageRequestsSection
      requests={requests}
      hasNextPage={languagesQuery.hasNextPage}
      isFetchingNextPage={languagesQuery.isFetchingNextPage}
      onLoadMore={() => {
        void languagesQuery.fetchNextPage();
      }}
    />
  );
}

function AdminUsersTab() {
  const loaderData = Route.useLoaderData();
  const usersQuery = usePreloadedConvexInfiniteQuery(api.admin.listUsers, {
    handle: loaderData.users,
    remixArgs: null,
  });

  const users = usersQuery.data.pages.flatMap((page) => page.page);

  return (
    <UsersSection
      users={users}
      hasNextPage={usersQuery.hasNextPage}
      isFetchingNextPage={usersQuery.isFetchingNextPage}
      onLoadMore={() => {
        void usersQuery.fetchNextPage();
      }}
    />
  );
}

export function isAdminTab(value: string): value is AdminTab {
  return value === "babies" || value === "languages" || value === "users";
}

export function AdminDashboardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/dashboard/admin" });

  return (
    <AdminDashboardView
      tab={search.tab}
      sort={search.sort}
      order={search.order}
      hideDemo={search.hideDemo}
      onTabChange={(tab) => {
        void navigate({ search: (prev) => ({ ...prev, tab }), replace: true, resetScroll: false });
      }}
      onHideDemoChange={(hideDemo) => {
        void navigate({
          search: (prev) => ({ ...prev, hideDemo }),
          replace: true,
          resetScroll: false,
        });
      }}
      babiesTab={<AdminBabiesTab />}
      usersTab={<AdminUsersTab />}
      languagesTab={<AdminLanguagesTab />}
    />
  );
}

/**
 * Admin chrome: tab links, the hide-demo filter, and whichever tab body is
 * active. Tab bodies arrive as nodes and URL state as plain props, so tests can
 * render it without the route's search params or Convex pagination.
 *
 * @internal Exported for tests; production uses `AdminDashboardPage`.
 */
export function AdminDashboardView(props: {
  tab: AdminTab;
  sort: SortBy;
  order: SortOrder;
  hideDemo: boolean;
  onTabChange: (tab: AdminTab) => void;
  onHideDemoChange: (hideDemo: boolean) => void;
  babiesTab: ReactNode;
  usersTab: ReactNode;
  languagesTab: ReactNode;
}) {
  const { t } = useI18n();

  const tabSearch = (tab: AdminTab): AdminSearch => ({
    tab,
    sort: props.sort,
    order: props.order,
    hideDemo: props.hideDemo,
  });

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.inner)}>
        <Stack gap="s6" fullWidth>
          <div {...stylex.props(styles.backRow)}>
            <Button
              variant="outline"
              size="sm"
              render={<Link to="/dashboard" />}
              nativeButton={false}
            >
              <ArrowLeft data-icon="inline-start" />
              {t("Back to Dashboard")}
            </Button>
          </div>

          <Card>
            <div {...stylex.props(styles.headerBorder)}>
              <CardHeader>
                <Inline gap="s3" align="start" wrap={false}>
                  <div {...stylex.props(styles.iconMark)}>
                    <Shield size={20} />
                  </div>
                  <Stack gap="s1">
                    <CardTitle>{t("Admin dashboard")}</CardTitle>
                    <CardDescription>
                      {t("Review babies, users, and language requests across the platform.")}
                    </CardDescription>
                  </Stack>
                </Inline>
              </CardHeader>
            </div>
            <CardContent>
              <Stack gap="s4" fullWidth>
                <Tabs
                  value={props.tab}
                  orientation="horizontal"
                  onValueChange={(value) => {
                    if (isAdminTab(value)) {
                      props.onTabChange(value);
                    }
                  }}
                >
                  <div {...stylex.props(styles.tabToolbar)}>
                    <TabsList variant="default">
                      <TabsTrigger
                        value="babies"
                        nativeButton={false}
                        render={
                          <Link
                            to="/dashboard/admin"
                            search={tabSearch("babies")}
                            replace
                            resetScroll={false}
                          />
                        }
                      >
                        {t("All babies")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="users"
                        nativeButton={false}
                        render={
                          <Link
                            to="/dashboard/admin"
                            search={tabSearch("users")}
                            replace
                            resetScroll={false}
                          />
                        }
                      >
                        {t("Recent users")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="languages"
                        nativeButton={false}
                        render={
                          <Link
                            to="/dashboard/admin"
                            search={tabSearch("languages")}
                            replace
                            resetScroll={false}
                          />
                        }
                      >
                        {t("Requested languages")}
                      </TabsTrigger>
                    </TabsList>

                    {props.tab === "babies" ? (
                      <Field orientation="horizontal">
                        <Switch
                          id="admin-hide-demo"
                          checked={props.hideDemo}
                          onCheckedChange={(hideDemo) => {
                            props.onHideDemoChange(hideDemo);
                          }}
                        />
                        <FieldLabel htmlFor="admin-hide-demo">{t("Hide demo babies")}</FieldLabel>
                      </Field>
                    ) : null}
                  </div>

                  <TabsContent value="babies">
                    {props.tab === "babies" ? props.babiesTab : null}
                  </TabsContent>

                  <TabsContent value="users">{props.tab === "users" ? props.usersTab : null}</TabsContent>

                  <TabsContent value="languages">
                    {props.tab === "languages" ? props.languagesTab : null}
                  </TabsContent>
                </Tabs>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </div>
    </div>
  );
}
